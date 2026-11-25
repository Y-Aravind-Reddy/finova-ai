import { supabase } from '../lib/supabase';

export type RagCanonicalRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FINANCE_ANALYST'
  | 'SUPPORT_EXECUTIVE'
  | 'CUSTOMER';

export type DocumentCategory =
  | 'POLICY'
  | 'PROCEDURE'
  | 'REGULATION'
  | 'GUIDE'
  | 'MANUAL';

export interface RagHealthResponse {
  status: string;
  version: string;
  indexes_built: number;
  indexes_total: number;
}

export interface RagRoleInfo {
  role: RagCanonicalRole;
  description: string;
}

export interface RagSourceDocument {
  document: string;
  pages: number[];
}

export interface RagChatResponse {
  answer: string;
  role: RagCanonicalRole;
  found: boolean;
  sources: RagSourceDocument[];
  source_documents: string[];
  source_pages: number[];
  context_warning: boolean;
}

export interface RagIndexStatus {
  role: RagCanonicalRole;
  directory_exists: boolean;
  index_built: boolean;
  embedding_model_matches: boolean;
  built_at?: string | null;
  embedding_model?: string | null;
  chunk_count?: number | null;
  documents?: string[];
  tenants?: string[];
}

export interface RagIngestStatusResponse {
  indexes: RagIndexStatus[];
  note?: string;
}

export interface KnowledgeDocumentRecord {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  filename: string;
  category: DocumentCategory;
  allowedRoles: RagCanonicalRole[];
  pageCount: number;
  chunkCount: number;
  fileSizeBytes: number;
  status: 'ACTIVE' | 'PROCESSING' | 'FAILED' | 'ARCHIVED' | string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadKnowledgeDocumentMetadata {
  title?: string;
  description?: string;
  category: DocumentCategory;
  allowedRoles: RagCanonicalRole[];
}

export class RagApiError extends Error {
  public readonly status: number;
  public readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'RagApiError';
    this.status = status;
    this.detail = detail;
  }
}

export function getRagApiBaseUrl(): string {
  const configured = import.meta.env.VITE_RAG_API_URL?.trim();
  const base = configured || 'https://finovaairag-production.up.railway.app';
  return base.replace(/\/+$/, '');
}

async function getBearerAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new RagApiError(
      401,
      'Active authenticated Supabase session required. Please sign in again.'
    );
  }
  return data.session.access_token;
}

function formatHttpError(status: number, body: Record<string, unknown>, fallback: string): string {
  const detail =
    (typeof body.detail === 'string' && body.detail) ||
    (Array.isArray(body.detail) &&
      body.detail
        .map((item: any) => item?.msg || JSON.stringify(item))
        .filter(Boolean)
        .join('; ')) ||
    (typeof body.details === 'string' && body.details) ||
    (typeof body.error === 'string' && body.error) ||
    '';

  if (detail) return detail;

  switch (status) {
    case 401:
      return 'Unauthorized (401): Supabase access token missing, invalid, or expired.';
    case 403:
      return 'Forbidden (403): Your verified role is not permitted for this operation.';
    case 404:
      return 'Not Found (404): Knowledge Base document not found or Railway /admin/knowledge-base routes are not yet deployed.';
    case 413:
      return 'Payload Too Large (413): PDF file exceeds the maximum allowed upload size.';
    case 422:
      return 'Validation Error (422): Request parameters or file format failed server validation.';
    case 502:
      return 'Bad Gateway (502): Upstream AI or vector engine error.';
    case 503:
      return 'Service Unavailable (503): RAG index or backend subsystem unavailable.';
    default:
      return fallback || `Unexpected server error (HTTP ${status}).`;
  }
}

async function parseJsonSafe(resp: Response): Promise<Record<string, unknown>> {
  try {
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Calls the configured Railway RAG API directly, falling back transparently to
 * the same-origin Express proxy (/api/rag-proxy/*) ONLY when browser CORS or
 * network policy blocks direct cross-origin requests. HTTP errors (401/403/422/502/503)
 * are always propagated cleanly without hiding backend failures.
 */
async function callRailwayWithCorsFallback<T>(
  directPath: string,
  proxyPath: string,
  init: RequestInit
): Promise<T> {
  const baseUrl = getRagApiBaseUrl();

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}${directPath}`, init);
  } catch (networkErr) {
    // Browser throws TypeError on CORS preflight / missing Access-Control-Allow-Origin
    if (networkErr instanceof TypeError) {
      resp = await fetch(proxyPath, init);
    } else {
      throw new RagApiError(
        503,
        (networkErr as Error)?.message || 'Unable to reach RAG backend service.'
      );
    }
  }

  const body = await parseJsonSafe(resp);
  if (!resp.ok) {
    throw new RagApiError(
      resp.status,
      formatHttpError(resp.status, body, `RAG API error (HTTP ${resp.status})`)
    );
  }

  return body as unknown as T;
}

/** GET /health — Railway RAG service liveness and built-index counts */
export async function checkRagHealth(): Promise<RagHealthResponse> {
  return callRailwayWithCorsFallback<RagHealthResponse>(
    '/health',
    '/api/rag-proxy/health',
    { method: 'GET' }
  );
}

/** GET /roles — Canonical roles recognized by the Railway RAG service */
export async function getRagRoles(): Promise<RagRoleInfo[]> {
  const res = await callRailwayWithCorsFallback<{ roles?: RagRoleInfo[] }>(
    '/roles',
    '/api/rag-proxy/roles',
    { method: 'GET' }
  );
  return Array.isArray(res.roles) ? res.roles : [];
}

/**
 * POST /chat — Ask a banking-policy question grounded in documents permitted
 * for the caller's backend-verified role & tenant.
 * Only sends `{ question }` per Railway ChatRequest OpenAPI schema (`additionalProperties: false`).
 */
export async function sendRagMessage(question: string): Promise<RagChatResponse> {
  const cleanQuestion = String(question || '').trim();
  if (cleanQuestion.length < 3) {
    throw new RagApiError(422, 'Question must be at least 3 characters long.');
  }

  const token = await getBearerAccessToken();
  const data = await callRailwayWithCorsFallback<RagChatResponse>(
    '/chat',
    '/api/rag-proxy/chat',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ question: cleanQuestion }),
    }
  );

  return {
    answer: String(data.answer || ''),
    role: data.role,
    found: Boolean(data.found),
    sources: Array.isArray(data.sources) ? data.sources : [],
    source_documents: Array.isArray(data.source_documents) ? data.source_documents : [],
    source_pages: Array.isArray(data.source_pages) ? data.source_pages : [],
    context_warning: Boolean(data.context_warning),
  };
}

/** POST /ingest/status — Inspect role index status on Railway (SUPER_ADMIN / ADMIN only) */
export async function getIngestionStatus(
  roles?: RagCanonicalRole[] | null
): Promise<RagIngestStatusResponse> {
  const token = await getBearerAccessToken();
  return callRailwayWithCorsFallback<RagIngestStatusResponse>(
    '/ingest/status',
    '/api/rag-proxy/ingest/status',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(roles && roles.length > 0 ? { roles } : {}),
    }
  );
}

export interface KnowledgeBaseStatusResponse {
  tenantId: string;
  storage: {
    document_storage_path: string;
    vectorstore_path: string;
    storage_root_is_mount: boolean;
    configured_under_app_storage: boolean;
    writable: boolean;
  };
  documentStats: {
    total: number;
    active: number;
    processing: number;
    failed: number;
    totalPages: number;
    totalChunks: number;
  };
  indexes: RagIndexStatus[];
}

/**
 * GET /admin/knowledge-base/documents — List tenant KB PDF documents.
 * Enforces backend-verified role === 'ADMIN' strictly (403 for all other roles).
 */
export async function getKnowledgeDocuments(filters?: {
  search?: string;
  role?: string;
  status?: string;
}): Promise<KnowledgeDocumentRecord[]> {
  const token = await getBearerAccessToken();
  const params = new URLSearchParams();
  if (filters?.search?.trim()) params.set('search', filters.search.trim());
  if (filters?.role && filters.role !== 'ALL') params.set('role', filters.role);
  if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const body = await callRailwayWithCorsFallback<{ documents?: KnowledgeDocumentRecord[] }>(
    `/admin/knowledge-base/documents${qs}`,
    `/api/rag-proxy/admin/knowledge-base/documents${qs}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return Array.isArray(body.documents) ? body.documents : [];
}

/** GET /admin/knowledge-base/documents/{document_id} — Fetch single tenant KB document */
export async function getKnowledgeDocument(documentId: string): Promise<KnowledgeDocumentRecord> {
  const token = await getBearerAccessToken();
  const encodedId = encodeURIComponent(documentId);
  const body = await callRailwayWithCorsFallback<{ document: KnowledgeDocumentRecord }>(
    `/admin/knowledge-base/documents/${encodedId}`,
    `/api/rag-proxy/admin/knowledge-base/documents/${encodedId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return body.document;
}

/** GET /admin/knowledge-base/status — Persistent Railway volume & index diagnostics */
export async function getKnowledgeBaseStatus(): Promise<KnowledgeBaseStatusResponse> {
  const token = await getBearerAccessToken();
  return callRailwayWithCorsFallback<KnowledgeBaseStatusResponse>(
    '/admin/knowledge-base/status',
    '/api/rag-proxy/admin/knowledge-base/status',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}

function sendMultipartXhr(
  url: string,
  token: string,
  formData: FormData,
  onProgress?: (pct: number) => void
): Promise<{ status: number; text: string; networkCorsError: boolean }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        const pct = Math.min(95, Math.round((ev.loaded / ev.total) * 95));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (onProgress) onProgress(100);
      resolve({ status: xhr.status, text: xhr.responseText || '{}', networkCorsError: false });
    };

    xhr.onerror = () => {
      resolve({ status: 0, text: '{}', networkCorsError: true });
    };

    xhr.send(formData);
  });
}

/**
 * POST /admin/knowledge-base/upload — Upload & index a PDF policy document.
 * Enforces backend-verified role === 'ADMIN' strictly (403 for all other roles).
 */
export async function uploadKnowledgeDocument(
  file: File,
  metadata: UploadKnowledgeDocumentMetadata,
  onProgress?: (pct: number) => void
): Promise<{
  success: boolean;
  document: KnowledgeDocumentRecord;
  warning?: string | null;
}> {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    throw new RagApiError(422, 'Only .pdf files can be uploaded to the Knowledge Base.');
  }
  if (!metadata.allowedRoles || metadata.allowedRoles.length === 0) {
    throw new RagApiError(422, 'Select at least one authorized role for this document.');
  }

  const token = await getBearerAccessToken();
  const buildForm = () => {
    const fd = new FormData();
    fd.append('file', file);
    if (metadata.title?.trim()) fd.append('title', metadata.title.trim());
    if (metadata.description?.trim()) fd.append('description', metadata.description.trim());
    fd.append('category', metadata.category);
    fd.append('allowedRoles', JSON.stringify(metadata.allowedRoles));
    return fd;
  };

  let attempt = await sendMultipartXhr(
    `${getRagApiBaseUrl()}/admin/knowledge-base/upload`,
    token,
    buildForm(),
    onProgress
  );

  if (attempt.networkCorsError) {
    attempt = await sendMultipartXhr(
      '/api/rag-proxy/admin/knowledge-base/upload',
      token,
      buildForm(),
      onProgress
    );
  }

  if (attempt.networkCorsError) {
    throw new RagApiError(503, 'Network error while uploading PDF document.');
  }

  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(attempt.text) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (attempt.status < 200 || attempt.status >= 300) {
    throw new RagApiError(
      attempt.status,
      formatHttpError(attempt.status, body, `PDF upload failed (HTTP ${attempt.status})`)
    );
  }

  return {
    success: Boolean(body.success),
    document: body.document as KnowledgeDocumentRecord,
    warning: typeof body.warning === 'string' ? body.warning : null,
  };
}

/** PATCH /admin/knowledge-base/documents/{document_id} — Update title, description, category, or authorized roles (ADMIN only) */
export async function updateKnowledgeDocument(
  id: string,
  metadata: Partial<UploadKnowledgeDocumentMetadata>
): Promise<KnowledgeDocumentRecord> {
  const token = await getBearerAccessToken();
  const encodedId = encodeURIComponent(id);
  const body = await callRailwayWithCorsFallback<{ document: KnowledgeDocumentRecord }>(
    `/admin/knowledge-base/documents/${encodedId}`,
    `/api/rag-proxy/admin/knowledge-base/documents/${encodedId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(metadata),
    }
  );
  return body.document;
}

/** DELETE /admin/knowledge-base/documents/{document_id} — Permanently remove PDF document and indexed chunks (ADMIN only) */
export async function deleteKnowledgeDocument(id: string): Promise<{ success: boolean; deletedId: string }> {
  const token = await getBearerAccessToken();
  const encodedId = encodeURIComponent(id);
  const body = await callRailwayWithCorsFallback<{ success?: boolean; deletedId?: string }>(
    `/admin/knowledge-base/documents/${encodedId}`,
    `/api/rag-proxy/admin/knowledge-base/documents/${encodedId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return {
    success: Boolean(body.success),
    deletedId: String(body.deletedId || id),
  };
}

/** POST /admin/knowledge-base/documents/{document_id}/reindex — Trigger vector re-embedding for a PDF document (ADMIN only) */
export async function reindexKnowledgeDocument(id: string): Promise<KnowledgeDocumentRecord> {
  const token = await getBearerAccessToken();
  const encodedId = encodeURIComponent(id);
  const body = await callRailwayWithCorsFallback<{ document: KnowledgeDocumentRecord }>(
    `/admin/knowledge-base/documents/${encodedId}/reindex`,
    `/api/rag-proxy/admin/knowledge-base/documents/${encodedId}/reindex`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return body.document;
}
