import { supabase } from '../lib/supabase';

export interface FinovaAiChatRequest {
  message: string;
  thread_id: string | null;
}

export interface FinovaAiChatResponse {
  answer: string;
  thread_id?: string;
  model?: string;
  configuredProfile?: string;
  citations?: Array<{ chunk_id: string; metadata?: unknown; similarity?: number }>;
  latencyMs?: number;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  operationalNodes?: Array<{ node: string; status: string; reason?: string }>;
  version?: string;
}

export interface KnowledgeDocumentSummary {
  id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  source_type: string;
  status: string;
  metadata?: Record<string, unknown>;
  updated_at?: string;
  created_at?: string;
}

export interface IngestKnowledgePayload {
  title: string;
  description?: string;
  sourceType: 'POLICY' | 'PROCEDURE' | 'REGULATION' | 'GUIDE' | 'DB_EXPORT' | 'MANUAL' | 'CSV_EXPORT';
  fileType: 'text/plain' | 'text/markdown' | 'text/csv' | 'application/json';
  content: string;
  targetTenantId?: string;
  forceReingest?: boolean;
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

export async function listKnowledgeDocuments(
  accessToken: string,
  tenantId?: string
): Promise<KnowledgeDocumentSummary[]> {
  const qs = tenantId && tenantId !== 'ALL' ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  const resp = await fetch(`/api/ai/knowledge${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await resp.json().catch(() => ({}))) as {
    documents?: KnowledgeDocumentSummary[];
    error?: string;
  };
  if (!resp.ok) {
    throw new Error(body.error || `Failed loading Knowledge Base (HTTP ${resp.status}).`);
  }
  return Array.isArray(body.documents) ? body.documents : [];
}

export async function ingestKnowledgeDocumentClient(
  accessToken: string,
  payload: IngestKnowledgePayload
): Promise<{
  success: boolean;
  document?: KnowledgeDocumentSummary;
  chunkCount?: number;
  error?: string;
  duplicate?: boolean;
}> {
  const resp = await fetch('/api/ai/knowledge/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await resp.json().catch(() => ({}))) as {
    success?: boolean;
    document?: KnowledgeDocumentSummary;
    chunkCount?: number;
    error?: string;
    duplicate?: boolean;
  };
  if (!resp.ok) {
    throw new Error(body.error || `Ingestion rejected (HTTP ${resp.status}).`);
  }
  return {
    success: Boolean(body.success),
    document: body.document,
    chunkCount: body.chunkCount,
    duplicate: body.duplicate,
    error: body.error,
  };
}

export async function archiveKnowledgeDocumentClient(
  accessToken: string,
  docId: string
): Promise<void> {
  const resp = await fetch(`/api/ai/knowledge/${encodeURIComponent(docId)}/archive`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await resp.json().catch(() => ({}))) as { error?: string };
  if (!resp.ok) {
    throw new Error(body.error || `Archive rejected (HTTP ${resp.status}).`);
  }
}
