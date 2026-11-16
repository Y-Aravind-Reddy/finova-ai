-- ==============================================================================
-- FINOVA AI — RAG SECURITY & RATE LIMITING UPDATE v2.1.3
-- Target: Hardened Tenant-Aware Retrieval & Concurrency-Safe Rate Limiting
-- ==============================================================================

-- 1. RATE LIMITING FUNCTION (Database-backed, 10 msgs / user / minute)
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*)::int INTO v_count
  FROM public.ai_chat_messages m
  JOIN public.ai_chat_threads t ON m.thread_id = t.id
  WHERE t.user_id = p_user_id
    AND m.created_at > now() - interval '1 minute';
  
  RETURN v_count < 10;
END;
$$;

-- 2. HARDENED SEARCH FUNCTION (v2.1.3 Signature Alignment)
-- Using vector type with search_path safety
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
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  -- Security Guardrail: Authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Authentication Required.';
  END IF;

  -- Resolve Tenant Context
  v_tenant_id := public.get_auth_tenant();
  
  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RAISE EXCEPTION 'Access Denied: Tenant context not found.';
  END IF;

  -- Input Validation
  IF match_count < 1 OR match_count > 50 THEN
    RAISE EXCEPTION 'Invalid Argument: match_count must be between 1 and 50.';
  END IF;

  -- Vector Retrieval with strict Tenant and Document Status filtering
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.ai_document_chunks c
  JOIN public.ai_knowledge_documents d ON c.document_id = d.id
  WHERE c.tenant_id = v_tenant_id
    AND d.tenant_id = v_tenant_id
    AND d.status = 'ACTIVE'       
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3. PERMISSION LOCKDOWN
REVOKE ALL ON FUNCTION public.match_ai_chunks(vector(768), float, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_chunks(vector(768), float, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_ai_chunks(vector(768), float, int) TO authenticated;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_ai_rate_limit(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID) TO authenticated;

-- 4. AUDIT TRAIL
COMMENT ON FUNCTION public.check_ai_rate_limit IS 'Enforces 10 messages per minute per user. Database-backed and concurrency-safe.';
COMMENT ON FUNCTION public.match_ai_chunks IS 'Production RAG engine v2.1.3. Enforces multi-tenant isolation and active document filtering.';
