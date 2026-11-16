-- ==============================================================================
-- FINOVA AI — PRODUCTION SECURITY & RELIABILITY AUDIT MIGRATION v2.1.5
-- Target: Hardened Rate Limiting, Schema Consistency, and RAG Security
-- ==============================================================================

-- 1. SCHEMA CONSISTENCY & BACKFILL
-- Ensure tenant_id exists and is correctly populated in ai_chat_messages
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_chat_messages' 
        AND column_name = 'tenant_id'
    ) THEN 
        ALTER TABLE public.ai_chat_messages ADD COLUMN tenant_id TEXT REFERENCES public.tenant_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Backfill missing tenant_id from threads
UPDATE public.ai_chat_messages m
SET tenant_id = t.tenant_id
FROM public.ai_chat_threads t
WHERE m.thread_id = t.id AND m.tenant_id IS NULL;

-- Now add NOT NULL constraint and index
DO $$ 
BEGIN 
    ALTER TABLE public.ai_chat_messages ALTER COLUMN tenant_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Could not set NOT NULL on tenant_id, check for orphans.';
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_id ON public.ai_chat_messages(tenant_id);

-- 2. ATOMIC RATE LIMITING (Sliding Window via Advisory Locking)
-- This table will store the rolling window of user requests
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_time ON public.ai_usage_logs(user_id, created_at);

-- Atomic sliding window rate limiter
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit_v215(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INT;
BEGIN
    -- 1. Obtain transaction-level advisory lock for the user
    -- This prevents concurrent requests for the same user from racing the rate limit check
    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));
    
    -- 2. Clean up requests older than 60 seconds for this user
    DELETE FROM public.ai_usage_logs 
    WHERE user_id = p_user_id 
      AND created_at < now() - interval '1 minute';
    
    -- 3. Count remaining requests in the window
    SELECT count(*)::int INTO v_count 
    FROM public.ai_usage_logs 
    WHERE user_id = p_user_id;
    
    -- 4. Enforce limit (10 messages per minute)
    IF v_count < 10 THEN
        INSERT INTO public.ai_usage_logs (user_id) VALUES (p_user_id);
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- 3. RAG SECURITY HARDENING (ACTIVE Document Filtering)
-- Ensure match_ai_chunks correctly joins with documents to filter by ACTIVE status
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
  -- Security Guardrail: Authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Authentication Required (401).';
  END IF;

  -- Resolve Tenant Context
  v_tenant_id := public.get_auth_tenant();
  
  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RAISE EXCEPTION 'Access Denied: Tenant context not found (403).';
  END IF;

  -- Vector Retrieval with strict Tenant and ACTIVE Document status filtering
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
    AND d.status = 'ACTIVE'       
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. PERMISSION LOCKDOWN
REVOKE ALL ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) TO authenticated;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit_v215(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_ai_rate_limit_v215(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit_v215(UUID) TO authenticated;

-- 5. AUDIT COMMENTS
COMMENT ON TABLE public.ai_usage_logs IS 'Logs user AI requests for rolling window rate limiting.';
COMMENT ON FUNCTION public.check_ai_rate_limit_v215 IS 'Genuinely atomic sliding window rate limiter (10 msgs / min) using advisory locks.';
COMMENT ON FUNCTION public.match_ai_chunks IS 'Hardened RAG Engine v2.1.5: Strict tenant isolation and ACTIVE document filtering.';
