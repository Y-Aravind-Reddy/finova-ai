export interface FinovaAiChatRequest {
  message: string;
  thread_id: string | null;
}

export interface FinovaAiChatResponse {
  answer: string;
  thread_id?: string;
  model?: string;
  configuredProfile?: string;
  citations?: Array<{ chunk_id: string; metadata?: unknown; similarity?: number; title?: string; page?: number }>;
  /** Cited knowledge-base documents grouped with their page numbers */
  sources?: Array<{ document: string; pages: number[] }>;
  /** True when at least one role-authorized policy excerpt was retrieved */
  found?: boolean;
  /** Backend-verified caller role */
  role?: string;
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

/**
 * Unified Finova AI Assistant: always served by the Finova Express gateway
 * (/api/ai/chat), which combines role-scoped Knowledge Base retrieval with live
 * operational telemetry. The legacy Supabase Edge Function is no longer used.
 */
export async function invokeFinovaAiChat(
  accessToken: string,
  payload: FinovaAiChatRequest
): Promise<FinovaAiChatResponse> {
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
