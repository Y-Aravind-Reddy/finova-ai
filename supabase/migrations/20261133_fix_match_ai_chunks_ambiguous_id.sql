-- ==============================================================================
-- FINOVA AI — FIX match_ai_chunks "column reference id is ambiguous" (SQLSTATE 42702)
-- Migration ID: 20261133_fix_match_ai_chunks_ambiguous_id
--
-- match_ai_chunks RETURNS TABLE (id, content, metadata, similarity). Inside the
-- function, "SELECT ... FROM public.profiles WHERE id = v_user_id" is ambiguous
-- between the output column "id" and profiles.id, so every knowledge-base
-- search failed with 42702 and the assistant never received policy excerpts.
-- Fix: qualify the profiles columns with an alias. Logic is otherwise unchanged
-- (role-scoped, tenant-isolated search from 20261130).
-- ==============================================================================

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
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: RAG access denied (401).' USING ERRCODE = '42501';
  END IF;

  IF match_count < 1 OR match_count > 20 THEN
    RAISE EXCEPTION 'Invalid Argument: match_count must be between 1 and 20.';
  END IF;

  SELECT (p.status = 'Active'), p.tenant_id, p.role::text
  INTO v_is_active, v_tenant_id, v_role
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Forbidden: AI data access restricted (403).' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RAISE EXCEPTION 'Forbidden: Organizational context missing (403).' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.content,
    COALESCE(c.metadata, '{}'::jsonb)
      || jsonb_build_object('title', d.title, 'document_id', d.id, 'source_type', d.source_type),
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM public.ai_document_chunks c
  INNER JOIN public.ai_knowledge_documents d ON c.document_id = d.id
  WHERE c.tenant_id = v_tenant_id
    AND d.tenant_id = v_tenant_id
    AND d.status = 'ACTIVE'
    AND (v_role = 'ADMIN' OR v_role = ANY (d.allowed_roles))
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) TO authenticated, service_role;

-- Result: confirms the function compiles and is callable by signed-in users
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'match_ai_chunks' AND pronamespace = 'public'::regnamespace;
