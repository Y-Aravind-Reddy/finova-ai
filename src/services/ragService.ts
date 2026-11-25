/**
 * Finova Knowledge Base & policy Q&A client.
 *
 * - Policy documents live in the deployed Railway Policy RAG
 *   (finovaairag-production.up.railway.app), reached through the same-origin
 *   Finova Express proxy (/api/rag-proxy/*) so the browser never hits CORS.
 * - Questions go to the single Finova AI Assistant (/api/ai/chat), which merges
 *   the Railway policy answer with live, role-scoped operational data.
 */
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

/** File extensions the unified Knowledge Base accepts. */
export const KB_ACCEPTED_EXTENSIONS = ['pdf'] as const; // Railway RAG indexes PDF documents

export interface RagHealthResponse {
  status: string;
  version: string;
  indexes_built: number;
  indexes_total: number;
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
  thread_id?: string;
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

async function getBearerAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new RagApiError(401, 'Active authenticated Supabase session required. Please sign in again.');
  }
  return data.session.access_token;
}

function formatHttpError(status: number, body: Record<string, unknown>): string {
  const detail =
    (typeof body.detail === 'string' && body.detail) ||
    (typeof body.details === 'string' && body.details) ||
    (typeof body.error === 'string' && body.error) ||
    '';
  if (detail) return detail;
  switch (status) {
    case 401:
      return 'Unauthorized (401): session missing, invalid, or expired.';
    case 403:
      return 'Forbidden (403): your role is not permitted for this operation.';
    case 404:
      return 'Not Found (404): Knowledge Base document not found.';
    case 413:
      return 'Payload Too Large (413): file exceeds the 10 MB upload limit.';
    case 422:
      return 'Validation Error (422): request or file failed validation.';
    case 502:
      return 'Bad Gateway (502): AI model or embedding service error.';
    default:
      return `Unexpected server error (HTTP ${status}).`;
  }
}

async function callApi<T>(path: string, init: RequestInit = {}, withAuth = true): Promise<T> {
  const token = withAuth ? await getBearerAccessToken() : '';
  let resp: Response;
  try {
    resp = await fetch(path, {
      ...init,
      headers: { ...(init.headers || {}), ...(withAuth ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch (err) {
    throw new RagApiError(503, (err as Error)?.message || 'Unable to reach the Finova server.');
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await resp.json()) as Record<string, unknown>;
  } catch {
    // non-JSON
  }
  if (!resp.ok) throw new RagApiError(resp.status, formatHttpError(resp.status, body));
  return body as unknown as T;
}

/**
 * Knowledge Base routes prefer the Railway Policy RAG. A Railway deployment that
 * predates the /admin/knowledge-base/* routes answers FastAPI's bare
 * {"detail":"Not Found"}; in that case this session switches to the Supabase
 * knowledge base (/api/kb/*), which the AI assistant also searches.
 */
let railwayKbUnavailable = false;

function isMissingRailwayRoute(err: unknown): boolean {
  return err instanceof RagApiError && err.status === 404 && err.detail === 'Not Found';
}

async function callKb<T>(railwayPath: string, supabasePath: string, init: RequestInit = {}): Promise<T> {
  if (!railwayKbUnavailable) {
    try {
      return await callApi<T>(railwayPath, init);
    } catch (err) {
      if (!isMissingRailwayRoute(err)) throw err;
      railwayKbUnavailable = true;
      console.warn('[KB] Railway knowledge-base routes not deployed; using the Supabase knowledge base.');
    }
  }
  return callApi<T>(supabasePath, init);
}

/** True when uploads currently go to the Supabase knowledge base instead of Railway. */
export function isUsingSupabaseKnowledgeBase(): boolean {
  return railwayKbUnavailable;
}

/** Railway RAG liveness and built role-index counts. */
export async function checkRagHealth(): Promise<RagHealthResponse> {
  return callApi<RagHealthResponse>('/api/rag-proxy/health', { method: 'GET' }, false);
}

/**
 * Ask a question through the single Finova AI Assistant (/api/ai/chat).
 * The server queries the Railway Policy RAG with the caller's own token and
 * combines its role-scoped answer with live operational data.
 */
export async function sendRagMessage(question: string, threadId?: string | null): Promise<RagChatResponse> {
  const cleanQuestion = String(question || '').trim();
  if (cleanQuestion.length < 3) {
    throw new RagApiError(422, 'Question must be at least 3 characters long.');
  }
  const data = await callApi<Record<string, any>>('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: cleanQuestion, thread_id: threadId || null }),
  });
  const sources: RagSourceDocument[] = Array.isArray(data.sources) ? data.sources : [];
  return {
    answer: String(data.answer || ''),
    role: data.role,
    found: Boolean(data.found),
    sources,
    source_documents: sources.map((s) => s.document),
    source_pages: [...new Set(sources.flatMap((s) => s.pages))],
    context_warning: false,
    thread_id: data.thread_id,
  };
}

/** Per-role FAISS index status on Railway (SUPER_ADMIN / ADMIN). */
export async function getIngestionStatus(roles?: RagCanonicalRole[] | null): Promise<RagIngestStatusResponse> {
  return callApi<RagIngestStatusResponse>('/api/rag-proxy/ingest/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(roles && roles.length > 0 ? { roles } : {}),
  });
}

/** Railway storage volume, document and index diagnostics (ADMIN). */
export async function getKnowledgeBaseStatus(): Promise<KnowledgeBaseStatusResponse> {
  return callKb<KnowledgeBaseStatusResponse>('/api/rag-proxy/admin/knowledge-base/status', '/api/kb/status');
}

export async function getKnowledgeDocuments(filters?: {
  search?: string;
  role?: string;
  status?: string;
}): Promise<KnowledgeDocumentRecord[]> {
  const params = new URLSearchParams();
  if (filters?.search?.trim()) params.set('search', filters.search.trim());
  if (filters?.role && filters.role !== 'ALL') params.set('role', filters.role);
  if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const body = await callKb<{ documents?: KnowledgeDocumentRecord[] }>(
    `/api/rag-proxy/admin/knowledge-base/documents${qs}`,
    `/api/kb/documents${qs}`
  );
  return Array.isArray(body.documents) ? body.documents : [];
}

export async function getKnowledgeDocument(documentId: string): Promise<KnowledgeDocumentRecord> {
  const id = encodeURIComponent(documentId);
  const body = await callKb<{ document: KnowledgeDocumentRecord }>(
    `/api/rag-proxy/admin/knowledge-base/documents/${id}`,
    `/api/kb/documents/${id}`
  );
  return body.document;
}

/** Upload & index a PDF policy document on Railway with role visibility (ADMIN only). */
export async function uploadKnowledgeDocument(
  file: File,
  metadata: UploadKnowledgeDocumentMetadata,
  onProgress?: (pct: number) => void
): Promise<{ success: boolean; document: KnowledgeDocumentRecord; warning?: string | null }> {
  const ext = (file?.name.split('.').pop() || '').toLowerCase();
  if (!file || !(KB_ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new RagApiError(422, `Only ${KB_ACCEPTED_EXTENSIONS.map((e) => '.' + e).join(', ')} files can be uploaded.`);
  }
  if (!metadata.allowedRoles || metadata.allowedRoles.length === 0) {
    throw new RagApiError(422, 'Select at least one authorized role for this document.');
  }

  const token = await getBearerAccessToken();
  const fd = new FormData();
  fd.append('file', file);
  if (metadata.title?.trim()) fd.append('title', metadata.title.trim());
  if (metadata.description?.trim()) fd.append('description', metadata.description.trim());
  fd.append('category', metadata.category);
  fd.append('allowedRoles', JSON.stringify(metadata.allowedRoles));

  const send = (url: string) => new Promise<{ status: number; text: string }>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) onProgress(Math.min(90, Math.round((ev.loaded / ev.total) * 90)));
    };
    xhr.onload = () => {
      if (onProgress) onProgress(100);
      resolve({ status: xhr.status, text: xhr.responseText || '{}' });
    };
    xhr.onerror = () => resolve({ status: 0, text: '{}' });
    xhr.send(fd);
  });

  let result = railwayKbUnavailable
    ? await send('/api/kb/documents')
    : await send('/api/rag-proxy/admin/knowledge-base/upload');
  if (!railwayKbUnavailable && result.status === 404 && /"detail"\s*:\s*"Not Found"/.test(result.text)) {
    railwayKbUnavailable = true;
    console.warn('[KB] Railway upload route not deployed; uploading to the Supabase knowledge base.');
    result = await send('/api/kb/documents');
  }

  if (result.status === 0) throw new RagApiError(503, 'Network error while uploading the document.');
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(result.text) as Record<string, unknown>;
  } catch {
    // non-JSON
  }
  if (result.status < 200 || result.status >= 300) {
    throw new RagApiError(result.status, formatHttpError(result.status, body));
  }
  return { success: Boolean(body.success), document: body.document as KnowledgeDocumentRecord, warning: null };
}

export async function updateKnowledgeDocument(
  id: string,
  metadata: Partial<UploadKnowledgeDocumentMetadata>
): Promise<KnowledgeDocumentRecord> {
  const docId = encodeURIComponent(id);
  const body = await callKb<{ document: KnowledgeDocumentRecord }>(`/api/rag-proxy/admin/knowledge-base/documents/${docId}`, `/api/kb/documents/${docId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  return body.document;
}

export async function deleteKnowledgeDocument(id: string): Promise<{ success: boolean; deletedId: string }> {
  const docId = encodeURIComponent(id);
  const body = await callKb<{ success?: boolean; deletedId?: string }>(
    `/api/rag-proxy/admin/knowledge-base/documents/${docId}`,
    `/api/kb/documents/${docId}`,
    { method: 'DELETE' }
  );
  return { success: Boolean(body.success), deletedId: String(body.deletedId || id) };
}

export async function reindexKnowledgeDocument(id: string): Promise<KnowledgeDocumentRecord> {
  const docId = encodeURIComponent(id);
  const body = await callKb<{ document: KnowledgeDocumentRecord }>(
    `/api/rag-proxy/admin/knowledge-base/documents/${docId}/reindex`,
    `/api/kb/documents/${docId}/reindex`,
    { method: 'POST' }
  );
  return body.document;
}
