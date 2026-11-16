-- ==============================================================================
-- FINOVA AI — PRODUCTION SECURITY & RELIABILITY AUDIT MIGRATION v2.1.6
-- Target: Atomic Rate Limiting, Schema Enforcement, and RAG Security
-- ==============================================================================

-- 1. SCHEMA ENFORCEMENT: ai_chat_messages.tenant_id
DO $$ 
BEGIN 
    -- Add tenant_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_chat_messages' 
        AND column_name = 'tenant_id'
    ) THEN 
        ALTER TABLE public.ai_chat_messages ADD COLUMN tenant_id TEXT REFERENCES public.tenant_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Backfill missing tenant_id from threads (safe, multi-tenant aware)
UPDATE public.ai_chat_messages m
SET tenant_id = t.tenant_id
FROM public.ai_chat_threads t
WHERE m.thread_id = t.id AND m.tenant_id IS NULL;

-- 2. ATOMIC USAGE LOGGING & RATE LIMITING
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Ensure index for sliding window performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_time ON public.ai_usage_logs(user_id, created_at);

-- Genuinely atomic sliding window rate limiter
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit_v216(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INT;
BEGIN
    -- [1] Obtain transaction-level advisory lock for the user scope
    -- This guarantees concurrency safety by serializing checks for the same user
    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));
    
    -- [2] Prune expired logs (older than 60s)
    DELETE FROM public.ai_usage_logs 
    WHERE user_id = p_user_id 
      AND created_at < now() - interval '1 minute';
    
    -- [3] Count current window usage
    SELECT count(*)::int INTO v_count 
    FROM public.ai_usage_logs 
    WHERE user_id = p_user_id;
    
    -- [4] Enforce 10 requests per minute
    IF v_count < 10 THEN
        INSERT INTO public.ai_usage_logs (user_id) VALUES (p_user_id);
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- 3. HARDENED VECTOR RETRIEVAL (match_ai_chunks)
-- Standard dimensional alignment for gemini-embedding-2 (768)
CREATE OR REPLACE FUNCTION public.match_ai_chunks (
  query_embedding extensions.vector(768),
  match_threshold float DEFAULT 0.45,
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
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_tenant_id TEXT;
  v_user_id UUID;
BEGIN
  -- [1] Security Guardrail: Authentication Verification
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Bearer token validation failed (401).';
  END IF;

  -- [2] Immutable Tenant Context Resolution
  v_tenant_id := public.get_auth_tenant();
  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RAISE EXCEPTION 'Forbidden: User possesses no authorized tenant context (403).';
  END IF;

  -- [3] Cross-Tenant & Document Status Filtering
  -- Matches both Chunk and Parent Document tenant IDs for double-insulation
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM public.ai_document_chunks c
  INNER JOIN public.ai_knowledge_documents d ON c.document_id = d.id
  WHERE c.tenant_id = v_tenant_id
    AND d.tenant_id = v_tenant_id
    AND d.status = 'ACTIVE'       -- Only retrieve from active institutional knowledge
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. LEAST-PRIVILEGE PERMISSIONS
REVOKE ALL ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) TO authenticated;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit_v216(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_ai_rate_limit_v216(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit_v216(UUID) TO authenticated;

-- 5. AUDIT COMMENTS
COMMENT ON TABLE public.ai_usage_logs IS 'Rolling window tracking for AI rate limiting.';
COMMENT ON FUNCTION public.check_ai_rate_limit_v216 IS 'Concurrency-safe atomic rate limiter (10 msgs / user / min) via transaction advisory locks.';
COMMENT ON FUNCTION public.match_ai_chunks IS 'Institutional RAG retrieval. Enforces tenant-isolation and ACTIVE document filtering.';
