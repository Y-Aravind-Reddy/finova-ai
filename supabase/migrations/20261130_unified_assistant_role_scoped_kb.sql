-- ==============================================================================
-- FINOVA AI — UNIFIED ASSISTANT: ONE ROLE-SCOPED SUPABASE KNOWLEDGE BASE
-- Migration ID: 20261130_unified_assistant_role_scoped_kb
-- Status: Forward-only, idempotent, non-destructive (no table/data drops, RLS stays ON)
--
-- Replaces the separate Railway Policy RAG with the Supabase Knowledge Base:
--   1. ai_knowledge_documents.allowed_roles  — which roles may retrieve a document
--   2. match_ai_chunks                       — filters by tenant AND caller role,
--                                              returns document title / page metadata
--   3. SELECT RLS on documents & chunks      — same role filter for direct reads
--
-- Visibility rule (tenant-scoped):
--   - ADMIN sees every document in its tenant (it manages them)
--   - any other role sees a document only if its role is in allowed_roles
--   - the single verified SUPER_ADMIN keeps global access
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ROLE VISIBILITY COLUMN
--    Existing documents default to all internal staff roles (not CUSTOMER).
-- ------------------------------------------------------------------------------
ALTER TABLE public.ai_knowledge_documents
    ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] NOT NULL
    DEFAULT ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE']::TEXT[];

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ai_knowledge_documents_allowed_roles_check'
    ) THEN
        ALTER TABLE public.ai_knowledge_documents
            ADD CONSTRAINT ai_knowledge_documents_allowed_roles_check
            CHECK (
                cardinality(allowed_roles) > 0
                AND allowed_roles <@ ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER']::TEXT[]
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_kb_docs_allowed_roles
    ON public.ai_knowledge_documents USING GIN (allowed_roles);

-- ------------------------------------------------------------------------------
-- 2. ROLE-SCOPED SEMANTIC SEARCH
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. ROLE-SCOPED SELECT POLICIES (write policies from 20261119 are unchanged)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "kb_super_admin_or_tenant_select" ON public.ai_knowledge_documents;
DROP POLICY IF EXISTS "kb_role_scoped_select" ON public.ai_knowledge_documents;

CREATE POLICY "kb_role_scoped_select" ON public.ai_knowledge_documents
    FOR SELECT
    TO authenticated
    USING (
        (
            (SELECT public.get_auth_role()) = 'SUPER_ADMIN'
            AND EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid())
                  AND p.role::text = 'SUPER_ADMIN'
                  AND p.status::text = 'Active'
                  AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
            )
        )
        OR (
            tenant_id = (SELECT public.get_auth_tenant())
            AND (
                (SELECT public.get_auth_role()) = 'ADMIN'
                OR (SELECT public.get_auth_role()) = ANY (allowed_roles)
            )
        )
    );

DROP POLICY IF EXISTS "chunk_super_admin_or_tenant_select" ON public.ai_document_chunks;
DROP POLICY IF EXISTS "chunk_role_scoped_select" ON public.ai_document_chunks;

CREATE POLICY "chunk_role_scoped_select" ON public.ai_document_chunks
    FOR SELECT
    TO authenticated
    USING (
        (
            (SELECT public.get_auth_role()) = 'SUPER_ADMIN'
            AND EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid())
                  AND p.role::text = 'SUPER_ADMIN'
                  AND p.status::text = 'Active'
                  AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
            )
        )
        OR (
            tenant_id = (SELECT public.get_auth_tenant())
            AND EXISTS (
                SELECT 1 FROM public.ai_knowledge_documents d
                WHERE d.id = ai_document_chunks.document_id
                  AND (
                      (SELECT public.get_auth_role()) = 'ADMIN'
                      OR (SELECT public.get_auth_role()) = ANY (d.allowed_roles)
                  )
            )
        )
    );

-- Result: confirm the column and policies
SELECT 'column' AS kind, column_name AS name, data_type AS detail
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ai_knowledge_documents' AND column_name = 'allowed_roles'
UNION ALL
SELECT 'policy', policyname, tablename || ' / ' || cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('ai_knowledge_documents', 'ai_document_chunks')
ORDER BY 1, 2;
