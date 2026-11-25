/**
 * Unified Knowledge Base API (Supabase-backed, replaces the Railway Policy RAG).
 *
 *   GET    /api/kb/health                     role-index readiness summary
 *   GET    /api/kb/status                     document & per-role index statistics
 *   GET    /api/kb/documents                  list (search / role / status filters)
 *   GET    /api/kb/documents/:id              one document
 *   POST   /api/kb/documents                  multipart upload: pdf, txt, md, csv, json
 *   PATCH  /api/kb/documents/:id              title, description, category, allowedRoles
 *   DELETE /api/kb/documents/:id              remove document and its chunks
 *   POST   /api/kb/documents/:id/reindex      re-embed stored chunks
 *
 * Every request runs with the caller's own Supabase JWT, so tenant & role
 * visibility is enforced by Postgres RLS (see 20261130 migration). Management
 * routes additionally require role ADMIN or SUPER_ADMIN.
 */
import type { Express, Request, Response } from 'express';
import multer from 'multer';
import { createGeminiClient } from './aiGateway.ts';
import {
  ALLOWED_KB_EXTENSIONS,
  KB_ROLES,
  MAX_KB_PDF_BYTES,
  extractPdfPages,
  ingestKnowledgeDocument,
  parseAllowedRoles,
  reindexKnowledgeDocument,
} from './ragPipeline.ts';

type AuthContext = { supabaseUser: any; user: { id: string }; profile: { role: string; tenant_id: string } };
type Authenticate = (req: Request, res: Response) => Promise<AuthContext | null>;

const CATEGORIES = ['POLICY', 'PROCEDURE', 'REGULATION', 'GUIDE', 'MANUAL'];
const DOC_COLUMNS =
  'id, tenant_id, title, description, source_type, status, metadata, allowed_roles, chunk_count, file_size_bytes, error_message, created_at, updated_at';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_KB_PDF_BYTES, files: 1 } });

function toRecord(row: any) {
  const meta = (row?.metadata || {}) as Record<string, any>;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description ?? null,
    filename: meta.filename || row.title,
    category: row.source_type,
    allowedRoles: Array.isArray(row.allowed_roles) ? row.allowed_roles : [],
    pageCount: Number(meta.page_count || 1),
    chunkCount: Number(row.chunk_count || 0),
    fileSizeBytes: Number(row.file_size_bytes || meta.bytes || 0),
    status: row.status,
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isManager(role: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function denyNonManager(res: Response, role: string): boolean {
  if (isManager(role)) return false;
  res.status(403).json({ detail: `Forbidden: Knowledge Base management requires ADMIN (current role: ${role}).` });
  return true;
}

async function loadRoleStats(supabaseUser: any) {
  const { data, error } = await supabaseUser
    .from('ai_knowledge_documents')
    .select('title, status, allowed_roles, chunk_count, metadata, updated_at')
    .neq('status', 'ARCHIVED')
    .limit(1000);
  if (error) throw new Error(error.message);
  const docs = (data || []) as any[];
  const active = docs.filter((d) => d.status === 'ACTIVE');
  const indexes = KB_ROLES.map((role) => {
    const visible = active.filter((d) => role === 'ADMIN' || (d.allowed_roles || []).includes(role));
    return {
      role,
      directory_exists: true,
      index_built: visible.length > 0,
      embedding_model_matches: true,
      built_at: visible.map((d) => d.updated_at).sort().pop() || null,
      embedding_model: 'gemini-embedding-2 (768d)',
      chunk_count: visible.reduce((sum, d) => sum + Number(d.chunk_count || 0), 0),
      documents: visible.map((d) => d.title),
    };
  });
  return { docs, active, indexes };
}

export function registerKnowledgeBaseRoutes(app: Express, authenticate: Authenticate) {
  app.get('/api/kb/health', async (req: Request, res: Response) => {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    try {
      const { indexes } = await loadRoleStats(ctx.supabaseUser);
      res.json({
        status: 'ok',
        version: 'supabase-kb',
        indexes_built: indexes.filter((i) => i.index_built).length,
        indexes_total: indexes.length,
      });
    } catch (err) {
      res.status(500).json({ detail: (err as Error).message });
    }
  });

  app.get('/api/kb/status', async (req: Request, res: Response) => {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    try {
      const { docs, indexes } = await loadRoleStats(ctx.supabaseUser);
      res.json({
        tenantId: ctx.profile.tenant_id,
        storage: {
          document_storage_path: 'supabase://public.ai_knowledge_documents',
          vectorstore_path: 'supabase://public.ai_document_chunks (pgvector)',
          storage_root_is_mount: true,
          configured_under_app_storage: true,
          writable: isManager(ctx.profile.role),
        },
        documentStats: {
          total: docs.length,
          active: docs.filter((d) => d.status === 'ACTIVE').length,
          processing: docs.filter((d) => d.status === 'PROCESSING').length,
          failed: docs.filter((d) => d.status === 'FAILED').length,
          totalPages: docs.reduce((s, d) => s + Number(d.metadata?.page_count || 1), 0),
          totalChunks: docs.reduce((s, d) => s + Number(d.chunk_count || 0), 0),
        },
        indexes,
      });
    } catch (err) {
      res.status(500).json({ detail: (err as Error).message });
    }
  });

  app.get('/api/kb/documents', async (req: Request, res: Response) => {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    let query = ctx.supabaseUser
      .from('ai_knowledge_documents')
      .select(DOC_COLUMNS)
      .neq('status', 'ARCHIVED')
      .order('updated_at', { ascending: false })
      .limit(200);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const role = typeof req.query.role === 'string' ? req.query.role.trim().toUpperCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    if (search) query = query.ilike('title', `%${search.replace(/[%_]/g, '')}%`);
    if (role && (KB_ROLES as readonly string[]).includes(role)) query = query.contains('allowed_roles', [role]);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) {
      res.status(error.code === '42501' ? 403 : 500).json({ detail: error.message });
      return;
    }
    res.json({ documents: (data || []).map(toRecord) });
  });

  app.get('/api/kb/documents/:id', async (req: Request, res: Response) => {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const { data, error } = await ctx.supabaseUser
      .from('ai_knowledge_documents')
      .select(DOC_COLUMNS)
      .eq('id', String(req.params.id))
      .maybeSingle();
    if (error) {
      res.status(500).json({ detail: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ detail: 'Knowledge Base document not found in this workspace.' });
      return;
    }
    res.json({ document: toRecord(data) });
  });

  app.post('/api/kb/documents', (req: Request, res: Response) => {
    upload.single('file')(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        const tooLarge = (uploadErr as { code?: string })?.code === 'LIMIT_FILE_SIZE';
        res.status(tooLarge ? 413 : 400).json({
          detail: tooLarge ? 'File exceeds the 10 MB upload limit.' : (uploadErr as Error).message,
        });
        return;
      }
      const ctx = await authenticate(req, res);
      if (!ctx) return;
      if (denyNonManager(res, ctx.profile.role)) return;

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        res.status(500).json({ detail: 'GEMINI_API_KEY is not configured on the server.' });
        return;
      }

      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(422).json({ detail: 'A file is required (field name "file").' });
        return;
      }

      const ext = (file.originalname.split('.').pop() || '').toLowerCase();
      if (ext !== 'pdf' && !(ALLOWED_KB_EXTENSIONS as readonly string[]).includes(ext)) {
        res.status(422).json({ detail: `Unsupported file type ".${ext}". Permitted: pdf, ${ALLOWED_KB_EXTENSIONS.join(', ')}.` });
        return;
      }

      const roles = parseAllowedRoles(req.body?.allowedRoles ?? req.body?.allowed_roles);
      if (!roles.ok) {
        res.status(422).json({ detail: roles.error });
        return;
      }

      const category = String(req.body?.category || 'POLICY').toUpperCase();
      if (!CATEGORIES.includes(category)) {
        res.status(422).json({ detail: `Invalid category "${category}".` });
        return;
      }

      const title = String(req.body?.title || '').trim() || file.originalname.replace(/\.[^.]+$/, '');

      let pages: string[] | undefined;
      let content = '';
      try {
        if (ext === 'pdf') {
          pages = await extractPdfPages(new Uint8Array(file.buffer));
        } else {
          content = file.buffer.toString('utf8');
        }
      } catch (err) {
        res.status(422).json({ detail: (err as Error).message });
        return;
      }

      const result = await ingestKnowledgeDocument({
        supabaseUser: ctx.supabaseUser,
        genAI: createGeminiClient(geminiApiKey, 15000),
        callerId: ctx.user.id,
        callerRole: ctx.profile.role,
        callerTenantId: ctx.profile.tenant_id,
        title,
        description: req.body?.description ? String(req.body.description) : undefined,
        sourceType: category,
        fileType: ext,
        content,
        pages,
        allowedRoles: roles.roles,
        filename: file.originalname,
        rawBytes: file.size,
        forceReingest: String(req.body?.forceReingest || '') === 'true',
      });

      if (!result.success) {
        res.status(result.statusCode).json({ detail: result.error, duplicate: result.duplicate });
        return;
      }
      res.status(201).json({
        success: true,
        document: toRecord(result.document),
        chunkCount: result.chunkCount,
      });
    });
  });

  app.patch('/api/kb/documents/:id', async (req: Request, res: Response) => {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    if (denyNonManager(res, ctx.profile.role)) return;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const body = req.body || {};
    if (typeof body.title === 'string') {
      const t = body.title.trim();
      if (t.length < 3 || t.length > 180) {
        res.status(422).json({ detail: 'Title must be between 3 and 180 characters.' });
        return;
      }
      patch.title = t;
    }
    if (typeof body.description === 'string') patch.description = body.description.slice(0, 500) || null;
    if (typeof body.category === 'string') {
      const c = body.category.toUpperCase();
      if (!CATEGORIES.includes(c)) {
        res.status(422).json({ detail: `Invalid category "${body.category}".` });
        return;
      }
      patch.source_type = c;
    }
    if (body.allowedRoles !== undefined) {
      const roles = parseAllowedRoles(body.allowedRoles);
      if (!roles.ok) {
        res.status(422).json({ detail: roles.error });
        return;
      }
      patch.allowed_roles = roles.roles;
    }

    const { data, error } = await ctx.supabaseUser
      .from('ai_knowledge_documents')
      .update(patch)
      .eq('id', String(req.params.id))
      .select(DOC_COLUMNS)
      .maybeSingle();
    if (error) {
      res.status(error.code === '42501' ? 403 : 500).json({ detail: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ detail: 'Knowledge Base document not found in this workspace.' });
      return;
    }
    res.json({ document: toRecord(data) });
  });

  app.delete('/api/kb/documents/:id', async (req: Request, res: Response) => {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    if (denyNonManager(res, ctx.profile.role)) return;
    const id = String(req.params.id);

    const { error: chunkErr } = await ctx.supabaseUser.from('ai_document_chunks').delete().eq('document_id', id);
    if (chunkErr) {
      res.status(chunkErr.code === '42501' ? 403 : 500).json({ detail: chunkErr.message });
      return;
    }
    const { data, error } = await ctx.supabaseUser
      .from('ai_knowledge_documents')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) {
      res.status(error.code === '42501' ? 403 : 500).json({ detail: error.message });
      return;
    }
    if (!data || data.length === 0) {
      res.status(404).json({ detail: 'Knowledge Base document not found in this workspace.' });
      return;
    }
    res.json({ success: true, deletedId: id });
  });

  app.post('/api/kb/documents/:id/reindex', async (req: Request, res: Response) => {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    if (denyNonManager(res, ctx.profile.role)) return;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      res.status(500).json({ detail: 'GEMINI_API_KEY is not configured on the server.' });
      return;
    }
    const result = await reindexKnowledgeDocument({
      supabaseUser: ctx.supabaseUser,
      genAI: createGeminiClient(geminiApiKey, 15000),
      documentId: String(req.params.id),
    });
    if (!result.success) {
      res.status(result.statusCode).json({ detail: result.error });
      return;
    }
    res.json({ document: toRecord(result.document) });
  });
}
