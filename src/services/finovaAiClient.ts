import { supabase } from '../lib/supabase';

export interface FinovaAiChatRequest {
  message: string;
  thread_id: string | null;
}

export interface FinovaAiChatResponse {
  answer: string;
  thread_id?: string;
  model?: string;
  citations?: Array<{ chunk_id: string; metadata?: unknown; similarity?: number }>;
  latencyMs?: number;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  version?: string;
}

// Track within the browser session if the remote Supabase Edge Function failed
// with an infrastructure/deployment/model error so subsequent requests avoid
// waiting repeatedly on a stale or overloaded remote deployment.
let preferLocalRelayInSession = false;

async function callLocalAiRelay(
  accessToken: string,
  payload: FinovaAiChatRequest
): Promise<FinovaAiChatResponse> {
  const resp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  let body: Record<string, unknown> = {};
  try {
    body = (await resp.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response
  }

  if (!resp.ok) {
    const details =
      (typeof body.details === 'string' && body.details) ||
      (typeof body.error === 'string' && body.error) ||
      `AI gateway returned HTTP ${resp.status}`;
    throw new Error(details);
  }

  return body as unknown as FinovaAiChatResponse;
}

export async function invokeFinovaAiChat(
  accessToken: string,
  payload: FinovaAiChatRequest
): Promise<FinovaAiChatResponse> {
  if (preferLocalRelayInSession) {
    return callLocalAiRelay(accessToken, payload);
  }

  const { data, error } = await supabase.functions.invoke('finova-ai-chat', {
    body: payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!error && data && typeof data.answer === 'string' && data.answer.trim().length > 0) {
    return data as FinovaAiChatResponse;
  }

  let statusCode = 0;
  let details = error?.message || 'Edge Function invocation failed.';

  try {
    const errorContext = (error as { context?: Response } | null)?.context;
    if (errorContext) {
      statusCode = Number(errorContext.status || 0);
      if (typeof errorContext.json === 'function') {
        const body = (await errorContext.json()) as Record<string, unknown>;
        details =
          (typeof body.details === 'string' && body.details) ||
          (typeof body.error === 'string' && body.error) ||
          details;
      }
    }
  } catch {
    // Keep extracted message
  }

  // Never bypass explicit user/auth/security/rate-limit rejections
  if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 429) {
    throw new Error(details);
  }

  // Edge Function is missing, outdated, or failed upstream (5xx / network / AI generation failure)
  preferLocalRelayInSession = true;
  return callLocalAiRelay(accessToken, payload);
}
