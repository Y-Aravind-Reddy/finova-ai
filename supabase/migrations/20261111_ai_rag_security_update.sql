-- ==============================================================================
-- FINOVA AI — RAG SECURITY & PERFORMANCE UPDATE
-- Target: Enhanced Filtering for match_ai_chunks
-- ==============================================================================

-- 1. HARDENED SEARCH FUNCTION (Updated with Active Document Check)
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
  -- 1. Security Guardrail: Authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Authentication Required.';
  END IF;

  -- 2. Input Validation
  IF match_count < 1 OR match_count > 50 THEN
    RAISE EXCEPTION 'Invalid Argument: match_count must be between 1 and 50.';
  END IF;

  -- 3. Resolve Tenant Context
  v_tenant_id := public.get_auth_tenant();
  
  IF v_tenant_id = '' THEN
    RAISE EXCEPTION 'Access Denied: Tenant context not found.';
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
    AND d.tenant_id = v_tenant_id -- Redundant but safe
    AND d.status = 'ACTIVE'       -- Only retrieve from active documents
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 2. ENSURE PERMISSIONS
GRANT EXECUTE ON FUNCTION public.match_ai_chunks TO authenticated;
