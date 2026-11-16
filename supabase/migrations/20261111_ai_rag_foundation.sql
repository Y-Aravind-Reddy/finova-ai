-- ==============================================================================
-- FINOVA AI — PRODUCTION RAG & AI ASSISTANT FOUNDATION
-- Target: Hardened Multi-Tenant Security & Tenant Isolation
-- ==============================================================================

-- 1. EXTENSIONS
-- Support for vector similarity search (Gemini text-embedding-004)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. KNOWLEDGE MANAGEMENT TABLES
CREATE TABLE IF NOT EXISTS public.ai_knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenant_workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    source_type TEXT NOT NULL DEFAULT 'POLICY' CHECK (source_type IN ('POLICY', 'PROCEDURE', 'REGULATION', 'GUIDE', 'DB_EXPORT')),
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED', 'PROCESSING')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.ai_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.ai_knowledge_documents(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES public.tenant_workspaces(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(768), -- Dimension matches Google text-embedding-004 default
    chunk_index INT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. CHAT MEMORY TABLES
CREATE TABLE IF NOT EXISTS public.ai_chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenant_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Intelligence Query',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.ai_chat_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb, 
    telemetry JSONB DEFAULT '{}'::jsonb, 
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 4. ANALYTICS & LOGS
CREATE TABLE IF NOT EXISTS public.ai_retrieval_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenant_workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    query_text TEXT,
    results JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 5. CONSISTENCY PROTECTIONS
CREATE OR REPLACE FUNCTION public.check_ai_chunk_tenant_consistency()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.ai_knowledge_documents 
        WHERE id = NEW.document_id AND tenant_id = NEW.tenant_id
    ) THEN
        RAISE EXCEPTION 'Tenant Mismatch: Document and Chunk must belong to the same tenant.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_ai_chunk_tenant_consistency
    BEFORE INSERT OR UPDATE ON public.ai_document_chunks
    FOR EACH ROW EXECUTE FUNCTION public.check_ai_chunk_tenant_consistency();

-- 6. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_ai_chunks_vector 
ON public.ai_document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_ai_chunks_tenant_id ON public.ai_document_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_thread_id ON public.ai_chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_threads_lookup ON public.ai_chat_threads(user_id, tenant_id);

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_retrieval_logs ENABLE ROW LEVEL SECURITY;

-- == KNOWLEDGE BASE POLICIES ==
DROP POLICY IF EXISTS "kb_select_policy" ON public.ai_knowledge_documents;
CREATE POLICY "kb_select_policy" ON public.ai_knowledge_documents
    FOR SELECT TO authenticated USING (tenant_id = public.get_auth_tenant());

DROP POLICY IF EXISTS "kb_admin_policy" ON public.ai_knowledge_documents;
CREATE POLICY "kb_admin_policy" ON public.ai_knowledge_documents
    FOR ALL TO authenticated 
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "chunk_select_policy" ON public.ai_document_chunks;
CREATE POLICY "chunk_select_policy" ON public.ai_document_chunks
    FOR SELECT TO authenticated USING (tenant_id = public.get_auth_tenant());

DROP POLICY IF EXISTS "chunk_admin_policy" ON public.ai_document_chunks;
CREATE POLICY "chunk_admin_policy" ON public.ai_document_chunks
    FOR ALL TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- == CHAT POLICIES ==
DROP POLICY IF EXISTS "thread_access_policy" ON public.ai_chat_threads;
CREATE POLICY "thread_access_policy" ON public.ai_chat_threads
    FOR ALL TO authenticated
    USING (user_id = auth.uid() AND tenant_id = public.get_auth_tenant())
    WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_auth_tenant());

DROP POLICY IF EXISTS "message_select_policy" ON public.ai_chat_messages;
CREATE POLICY "message_select_policy" ON public.ai_chat_messages
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.ai_chat_threads t 
        WHERE t.id = ai_chat_messages.thread_id 
        AND t.user_id = auth.uid() 
        AND t.tenant_id = public.get_auth_tenant()
    ));

DROP POLICY IF EXISTS "message_insert_policy" ON public.ai_chat_messages;
CREATE POLICY "message_insert_policy" ON public.ai_chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_chat_threads t 
            WHERE t.id = ai_chat_messages.thread_id 
            AND t.user_id = auth.uid() 
            AND t.tenant_id = public.get_auth_tenant()
        )
    );

-- == LOG POLICIES ==
DROP POLICY IF EXISTS "log_read_policy" ON public.ai_retrieval_logs;
CREATE POLICY "log_read_policy" ON public.ai_retrieval_logs
    FOR SELECT TO authenticated
    USING (
        tenant_id = public.get_auth_tenant() AND 
        public.get_auth_role() IN ('ADMIN', 'SUPER_ADMIN')
    );

-- 8. HARDENED SEARCH FUNCTION (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.match_ai_chunks (
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Authentication Required.';
  END IF;

  IF match_count < 1 OR match_count > 50 THEN
    RAISE EXCEPTION 'Invalid Argument: match_count must be between 1 and 50.';
  END IF;

  v_tenant_id := public.get_auth_tenant();
  
  IF v_tenant_id = '' THEN
    RAISE EXCEPTION 'Access Denied: Tenant context not found.';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.ai_document_chunks c
  WHERE c.tenant_id = v_tenant_id
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 9. LEAST PRIVILEGE GRANTS
GRANT EXECUTE ON FUNCTION public.match_ai_chunks TO authenticated;
GRANT SELECT ON public.ai_knowledge_documents TO authenticated;
GRANT SELECT ON public.ai_document_chunks TO authenticated;
GRANT ALL ON public.ai_chat_threads TO authenticated;
GRANT SELECT, INSERT ON public.ai_chat_messages TO authenticated;
GRANT SELECT ON public.ai_retrieval_logs TO authenticated;
