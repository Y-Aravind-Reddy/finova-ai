-- ==============================================================================
-- FINOVA AI — PRODUCTION HARDENING MIGRATION v2.1.8
-- Target: Enhanced Security Controls, RPC Hardening, and Schema Alignment
-- ==============================================================================

-- 1. CLEANUP & VERSIONING
-- We transition to v2.1.8 logic
DROP FUNCTION IF EXISTS public.check_ai_rate_limit_v217();

-- 2. HARDENED USAGE LOGS (RLS & Permissions)
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_usage_logs FROM anon, authenticated, PUBLIC;

DROP POLICY IF EXISTS "usage_logs_owner_isolation" ON public.ai_usage_logs;
CREATE POLICY "usage_logs_owner_isolation" ON public.ai_usage_logs
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- 3. ATOMIC RATE LIMITER v2.1.8 (Session-based, Advisory Locked)
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit_v218()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_count INT;
    v_is_active BOOLEAN;
BEGIN
    -- [1] Identity Resolution
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Session identification failed (401).';
    END IF;

    -- [2] Redundant Security: Profile Status Check
    SELECT (status = 'Active') INTO v_is_active FROM public.profiles WHERE id = v_user_id;
    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: Institutional account restricted (403).';
    END IF;

    -- [3] Transactional Advisory Lock (User Scope)
    PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));
    
    -- [4] Window Maintenance (60s Sliding Window)
    DELETE FROM public.ai_usage_logs 
    WHERE user_id = v_user_id 
      AND created_at < now() - interval '1 minute';
    
    -- [5] Capacity Check
    SELECT count(*)::int INTO v_count 
    FROM public.ai_usage_logs 
    WHERE user_id = v_user_id;
    
    -- [6] Limit Enforcement (10 queries / minute)
    IF v_count < 10 THEN
        INSERT INTO public.ai_usage_logs (user_id) VALUES (v_user_id);
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- 4. HARDENED VECTOR RETRIEVAL (v2.1.8 Triple-Insulated)
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
  v_is_active BOOLEAN;
BEGIN
  -- [1] Identity & Status Verification
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: RAG access denied (401).';
  END IF;

  SELECT (status = 'Active'), tenant_id INTO v_is_active, v_tenant_id 
  FROM public.profiles WHERE id = v_user_id;

  IF v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Forbidden: AI data access restricted (403).';
  END IF;

  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RAISE EXCEPTION 'Forbidden: Organizational context missing (403).';
  END IF;

  -- [2] Triple-Insulated Retrieval (Chunk Tenant + Doc Tenant + ACTIVE Status)
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
    AND d.status = 'ACTIVE'       -- Institutional policy grounding only
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. MINIMAL PERMISSION MODEL
REVOKE ALL ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) TO authenticated;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit_v218() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit_v218() TO authenticated;

-- 6. AUDIT COMMENTS
COMMENT ON FUNCTION public.check_ai_rate_limit_v218 IS 'Atomic rate limiter v2.1.8. Enforces 10 msgs/min with redundant profile status validation.';
COMMENT ON FUNCTION public.match_ai_chunks IS 'Institutional RAG engine v2.1.8. Triple-insulated tenant isolation and Active document grounding.';
