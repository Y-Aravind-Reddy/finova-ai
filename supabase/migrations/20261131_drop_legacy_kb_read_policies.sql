-- ==============================================================================
-- FINOVA AI — REMOVE LEGACY TENANT-WIDE KNOWLEDGE BASE READ POLICIES
-- Migration ID: 20261131_drop_legacy_kb_read_policies
--
-- "ai_documents_tenant_read" and "ai_chunks_tenant_read" were created outside the
-- migration files. Postgres combines PERMISSIVE policies with OR, so these let
-- every role in a tenant read every Knowledge Base document and chunk directly,
-- bypassing the role-scoped policies added in 20261130.
--
-- After this migration the only SELECT policies are:
--   kb_role_scoped_select     (ai_knowledge_documents)
--   chunk_role_scoped_select  (ai_document_chunks)
-- ==============================================================================

-- Drop every SELECT policy on the two tables except the role-scoped ones
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('ai_knowledge_documents', 'ai_document_chunks')
          AND cmd = 'SELECT'
          AND policyname NOT IN ('kb_role_scoped_select', 'chunk_role_scoped_select')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
        RAISE NOTICE 'Dropped legacy policy % on %', pol.policyname, pol.tablename;
    END LOOP;
END $$;

-- Result: remaining policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('ai_knowledge_documents', 'ai_document_chunks')
ORDER BY tablename, policyname;
