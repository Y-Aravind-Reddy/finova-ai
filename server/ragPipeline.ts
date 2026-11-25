import { createHash } from 'node:crypto';
import type { GoogleGenAI } from '@google/genai';
import { EMBEDDING_DIMENSION, generateEmbedding768 } from './aiGateway.ts';

export const ALLOWED_KB_EXTENSIONS = ['txt', 'md', 'csv', 'json'] as const;
export const ALLOWED_SOURCE_TYPES = [
  'POLICY',
  'PROCEDURE',
  'REGULATION',
  'GUIDE',
  'DB_EXPORT',
  'MANUAL',
  'CSV_EXPORT',
] as const;

export const MAX_KB_DOCUMENT_BYTES = 512 * 1024; // 512 KB explicit cap (never truncate silently)
export const MAX_CHUNKS_PER_DOCUMENT = 60;

export function computeContentHash(text: string): string {
  return createHash('sha256').update(text.trim(), 'utf8').digest('hex');
}

export function extractTextSafely(params: {
  rawContent: string;
  fileType?: string;
}): { ok: true; text: string; fileType: string; bytes: number } | { ok: false; error: string; status: number } {
  const { rawContent, fileType = 'text/plain' } = params;
  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    return { ok: false, error: 'Document content must be a non-empty string.', status: 400 };
  }

  const normalizedType = String(fileType || 'text/plain').toLowerCase().trim();
  const allowedMimeOrExt = [
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'txt',
    'md',
    'csv',
    'json',
  ];
  if (!allowedMimeOrExt.includes(normalizedType)) {
    return {
      ok: false,
      error: `Unsupported file type "${fileType}". Permitted formats: txt, md, csv, json.`,
      status: 400,
    };
  }

  const byteSize = Buffer.byteLength(rawContent, 'utf8');
  if (byteSize > MAX_KB_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `Document exceeds maximum permitted size (${byteSize} bytes > ${MAX_KB_DOCUMENT_BYTES} bytes). Split into smaller files before ingestion.`,
      status: 413,
    };
  }

  // Strip null bytes & binary control sequences cleanly
  const cleaned = rawContent.replace(/\u0000/g, '').replace(/\r\n/g, '\n');

  if (normalizedType === 'json' || normalizedType === 'application/json') {
    try {
      const parsed = JSON.parse(cleaned);
      const formatted = JSON.stringify(parsed, null, 2);
      return { ok: true, text: formatted, fileType: 'application/json', bytes: byteSize };
    } catch {
      return {
        ok: false,
        error: 'Malformed JSON document; valid JSON syntax is required for json ingestion.',
        status: 400,
      };
    }
  }

  return {
    ok: true,
    text: cleaned.trim(),
    fileType: normalizedType === 'md' ? 'text/markdown' : normalizedType === 'csv' ? 'text/csv' : 'text/plain',
    bytes: byteSize,
  };
}

export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number }
): string[] {
  const chunkSize = Math.max(200, Math.min(2000, options?.chunkSize ?? 1000));
  const overlap = Math.max(0, Math.min(Math.floor(chunkSize / 2), options?.overlap ?? 200));

  const normalized = text.replace(/\s+\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + chunkSize);

    // Try to break on paragraph/sentence boundary near the end of window
    if (end < normalized.length) {
      const minBoundary = start + Math.floor(chunkSize * 0.6);
      const slice = normalized.slice(start, end);
      const paraIdx = slice.lastIndexOf('\n\n');
      const sentIdx = slice.lastIndexOf('. ');
      const lineIdx = slice.lastIndexOf('\n');

      if (start + paraIdx >= minBoundary) {
        end = start + paraIdx + 2;
      } else if (start + sentIdx >= minBoundary) {
        end = start + sentIdx + 2;
      } else if (start + lineIdx >= minBoundary) {
        end = start + lineIdx + 1;
      }
    }

    const piece = normalized.slice(start, end).trim();
    if (piece.length > 0) {
      chunks.push(piece);
    }

    if (end >= normalized.length) break;
    const nextStart = end - overlap;
    start = nextStart > start ? nextStart : end;

    if (chunks.length >= MAX_CHUNKS_PER_DOCUMENT) {
      throw new Error(
        `Chunk limit exceeded (${MAX_CHUNKS_PER_DOCUMENT} chunks max per document). Upload smaller segmented policies.`
      );
    }
  }

  return chunks;
}

export interface IngestDocumentInput {
  supabaseUser: any;
  genAI: GoogleGenAI;
  callerId: string;
  callerRole: string;
  callerTenantId: string;
  targetTenantId?: string;
  title: string;
  description?: string;
  sourceType?: string;
  fileType?: string;
  content: string;
  forceReingest?: boolean;
}

export interface IngestDocumentResult {
  statusCode: number;
  success: boolean;
  duplicate?: boolean;
  document?: Record<string, unknown>;
  chunkCount?: number;
  error?: string;
}

export async function ingestKnowledgeDocument(
  input: IngestDocumentInput
): Promise<IngestDocumentResult> {
  const {
    supabaseUser,
    genAI,
    callerId,
    callerRole,
    callerTenantId,
    targetTenantId,
    title,
    description,
    sourceType = 'POLICY',
    fileType = 'text/plain',
    content,
    forceReingest = false,
  } = input;

  if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'ADMIN') {
    return {
      statusCode: 403,
      success: false,
      error: `Forbidden: Role "${callerRole}" cannot ingest institutional knowledge documents.`,
    };
  }

  const resolvedTenant =
    callerRole === 'SUPER_ADMIN' && targetTenantId
      ? targetTenantId.trim()
      : callerTenantId;

  if (!resolvedTenant || resolvedTenant === 'ALL') {
    return {
      statusCode: 400,
      success: false,
      error: 'Target tenant_id is required for Knowledge Base ingestion.',
    };
  }

  if (callerRole === 'ADMIN' && targetTenantId && targetTenantId !== callerTenantId) {
    return {
      statusCode: 403,
      success: false,
      error: 'Forbidden: Tenant ADMIN cannot ingest documents into another workspace.',
    };
  }

  const cleanTitle = String(title || '').trim();
  if (cleanTitle.length < 3 || cleanTitle.length > 180) {
    return {
      statusCode: 400,
      success: false,
      error: 'Title must be between 3 and 180 characters.',
    };
  }

  const normalizedSourceType = String(sourceType || 'POLICY').toUpperCase().trim();
  if (!(ALLOWED_SOURCE_TYPES as readonly string[]).includes(normalizedSourceType)) {
    return {
      statusCode: 400,
      success: false,
      error: `Invalid sourceType "${sourceType}".`,
    };
  }

  const extracted = extractTextSafely({ rawContent: content, fileType });
  if (!extracted.ok) {
    return {
      statusCode: extracted.status,
      success: false,
      error: extracted.error,
    };
  }

  const contentHash = computeContentHash(extracted.text);

  // Idempotent duplicate check for active/processing documents in same tenant
  const { data: existingDup, error: dupErr } = await supabaseUser
    .from('ai_knowledge_documents')
    .select('id, title, status, chunk_count, updated_at')
    .eq('tenant_id', resolvedTenant)
    .eq('content_hash', contentHash)
    .neq('status', 'ARCHIVED')
    .maybeSingle();

  if (dupErr && dupErr.code !== '42703') {
    // 42703 means optional content_hash column missing prior to 20261119 migration
    return {
      statusCode: 500,
      success: false,
      error: `Knowledge Base duplicate lookup failed: ${dupErr.message}`,
    };
  }

  if (existingDup && existingDup.status === 'ACTIVE' && !forceReingest) {
    return {
      statusCode: 409,
      success: false,
      duplicate: true,
      document: existingDup,
      error: `Duplicate document detected: "${existingDup.title}" already exists in active KB.`,
    };
  }

  let chunks: string[];
  try {
    chunks = chunkText(extracted.text, { chunkSize: 1000, overlap: 200 });
  } catch (chunkErr) {
    return {
      statusCode: 413,
      success: false,
      error: (chunkErr as Error)?.message || 'Document chunking error.',
    };
  }

  if (chunks.length === 0) {
    return {
      statusCode: 400,
      success: false,
      error: 'Document produced 0 searchable chunks.',
    };
  }

  // Create PROCESSING parent record
  const docPayload: Record<string, unknown> = {
    tenant_id: resolvedTenant,
    title: cleanTitle,
    description: description ? String(description).slice(0, 500) : null,
    source_type: normalizedSourceType,
    status: 'PROCESSING',
    metadata: {
      file_type: extracted.fileType,
      bytes: extracted.bytes,
      chunk_strategy: 'recursive-1000-overlap-200',
    },
    content_hash: contentHash,
    file_type: extracted.fileType,
    file_size_bytes: extracted.bytes,
    chunk_count: chunks.length,
    created_by: callerId,
    updated_at: new Date().toISOString(),
  };

  let docRow: Record<string, any> | null = null;
  const { data: insertedDoc, error: insertErr } = await supabaseUser
    .from('ai_knowledge_documents')
    .insert(docPayload)
    .select('*')
    .single();

  if (insertErr) {
    // Handle case where 20261119 migration columns weren't applied yet gracefully
    if (insertErr.code === '42703') {
      return {
        statusCode: 503,
        success: false,
        error: 'Knowledge Base schema requires 20261119_p0_production_readiness_hardening.sql migration before ingestion.',
      };
    }
    if (insertErr.code === '42501') {
      return {
        statusCode: 403,
        success: false,
        error: `Permission denied by PostgreSQL RLS for KB ingestion (${insertErr.message}).`,
      };
    }
    return {
      statusCode: 500,
      success: false,
      error: `Failed to register KB document: ${insertErr.message}`,
    };
  }

  docRow = insertedDoc;

  try {
    const chunkRecords: Array<Record<string, unknown>> = [];

    for (let idx = 0; idx < chunks.length; idx++) {
      const piece = chunks[idx];
      const vec = await generateEmbedding768(genAI, piece);
      if (vec.length !== EMBEDDING_DIMENSION) {
        throw new Error(`Invalid vector length ${vec.length} for chunk ${idx}`);
      }
      chunkRecords.push({
        document_id: docRow.id,
        tenant_id: resolvedTenant,
        content: piece,
        embedding: vec,
        chunk_index: idx,
        metadata: {
          title: cleanTitle,
          source_type: normalizedSourceType,
          chunk_index: idx,
          total_chunks: chunks.length,
        },
      });
    }

    const { error: chunksInsertErr } = await supabaseUser
      .from('ai_document_chunks')
      .insert(chunkRecords);

    if (chunksInsertErr) {
      throw new Error(`Failed storing embedded chunks: ${chunksInsertErr.message}`);
    }

    const { data: activatedDoc, error: activateErr } = await supabaseUser
      .from('ai_knowledge_documents')
      .update({
        status: 'ACTIVE',
        chunk_count: chunkRecords.length,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', docRow.id)
      .select('*')
      .single();

    if (activateErr) {
      throw new Error(`Failed marking document ACTIVE: ${activateErr.message}`);
    }

    return {
      statusCode: 201,
      success: true,
      document: activatedDoc || { ...docRow, status: 'ACTIVE' },
      chunkCount: chunkRecords.length,
    };
  } catch (err) {
    const errMsg = (err as Error)?.message || 'Embedding pipeline failure';
    await supabaseUser
      .from('ai_knowledge_documents')
      .update({
        status: 'FAILED',
        error_message: errMsg.slice(0, 500),
        retry_count: Number(docRow.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', docRow.id);

    return {
      statusCode: 502,
      success: false,
      document: { ...docRow, status: 'FAILED', error_message: errMsg },
      error: errMsg,
    };
  }
}
