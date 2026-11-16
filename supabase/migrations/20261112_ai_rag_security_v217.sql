-- ==============================================================================
-- FINOVA AI — PRODUCTION SECURITY CORRECTION v2.1.7
-- Target: Atomic auth.uid() Rate Limiting & Multi-Tenant Retrieval Hardening
-- ==============================================================================

-- 1. CLEANUP PREVIOUS VERSIONS (Internal Maintenance)
DROP FUNCTION IF EXISTS public.check_ai_rate_limit_v215(UUID);
DROP FUNCTION IF EXISTS public.check_ai_rate_limit_v216(UUID);

-- 2. HARDENED USAGE LOGS (RLS Enabled)
-- Table already created in v2.1.6, but we ensure RLS and isolation here
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Revoke direct table access to prevent bypassing the rate limiter logic
REVOKE ALL ON TABLE public.ai_usage_logs FROM anon, authenticated;

DROP POLICY IF EXISTS "usage_logs_owner_isolation" ON public.ai_usage_logs;
CREATE POLICY "usage_logs_owner_isolation" ON public.ai_usage_logs
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- 3. ATOMIC RATE LIMITER v2.1.7 (Parameter-less, uses auth.uid())
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit_v217()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_count INT;
BEGIN
    -- [1] Resolve identity from session (Never trust client-supplied ID)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Access Denied: Session identification failed (401).';
    END IF;

    -- [2] Obtain transaction-level advisory lock for the user scope
    -- Hash user UUID to a bigint for the advisory lock
    PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));
    
    -- [3] Prune expired logs (older than 60s)
    DELETE FROM public.ai_usage_logs 
    WHERE user_id = v_user_id 
      AND created_at < now() - interval '1 minute';
    
    -- [4] Count current window usage
    SELECT count(*)::int INTO v_count 
    FROM public.ai_usage_logs 
    WHERE user_id = v_user_id;
    
    -- [5] Enforce institutional safety limit (10 queries / minute)
    IF v_count < 10 THEN
        INSERT INTO public.ai_usage_logs (user_id) VALUES (v_user_id);
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- 4. HARDENED VECTOR RETRIEVAL (v2.1.7)
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
  -- [1] Authentication Guardrail
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Authentication Required (401).';
  END IF;

  -- [2] Tenant Context Resolution
  v_tenant_id := public.get_auth_tenant();
  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RAISE EXCEPTION 'Access Denied: Organizational context not found (403).';
  END IF;

  -- [3] Double-Insulated Retrieval (Chunk Tenant + Document Tenant + ACTIVE Status)
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

-- 5. PERMISSION LOCKDOWN
REVOKE ALL ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) TO authenticated;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit_v217() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_ai_rate_limit_v217() FROM anon;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit_v217() TO authenticated;

-- 6. AUDIT COMMENTS
COMMENT ON FUNCTION public.check_ai_rate_limit_v217 IS 'Institutional atomic rate limiter (v2.1.7). Concurrency-safe sliding window (10/min) using auth.uid().';
COMMENT ON FUNCTION public.match_ai_chunks IS 'RAG Engine v2.1.7. Enforces institutional tenant isolation and ACTIVE document status.';
