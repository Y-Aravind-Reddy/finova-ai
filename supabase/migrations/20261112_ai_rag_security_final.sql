-- ==============================================================================
-- FINOVA AI — RAG SECURITY & PERFORMANCE FINAL UPDATE
-- Target: Hardened Tenant-Aware Vector Retrieval for match_ai_chunks
-- ==============================================================================

-- 1. REVOKE DEFAULT PERMISSIONS
REVOKE ALL ON FUNCTION public.match_ai_chunks(vector(768), float, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_chunks(vector(768), float, int) FROM anon;

-- 2. HARDENED SEARCH FUNCTION
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
  v_user_id UUID;
BEGIN
  -- 1. Authentication Check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Authentication Required (401).';
  END IF;

  -- 2. Input Validation
  IF match_count < 1 OR match_count > 25 THEN
    RAISE EXCEPTION 'Invalid Argument: match_count must be between 1 and 25.';
  END IF;

  -- 3. Resolve Tenant Context (Immutable Backend Resolution)
  -- This function must exist and return the tenant_id of the auth.uid()
  v_tenant_id := public.get_auth_tenant();
  
  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RAISE EXCEPTION 'Access Denied: User tenant context not found (403).';
  END IF;

  -- 4. Vector Retrieval with Document Status Check
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.ai_document_chunks c
  INNER JOIN public.ai_knowledge_documents d ON c.document_id = d.id
  WHERE c.tenant_id = v_tenant_id
    AND d.tenant_id = v_tenant_id
    AND d.status = 'ACTIVE'       -- Only retrieve from authorized active docs
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3. RE-GRANT MINIMAL PERMISSIONS
GRANT EXECUTE ON FUNCTION public.match_ai_chunks(vector(768), float, int) TO authenticated;

-- 4. COMMENT FOR AUDIT
COMMENT ON FUNCTION public.match_ai_chunks IS 'Production RAG engine. Enforces tenant-isolation, auth.uid() validation, and ACTIVE document status filtering.';
