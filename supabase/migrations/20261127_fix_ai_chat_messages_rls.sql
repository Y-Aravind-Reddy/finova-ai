-- ==============================================================================
-- FINOVA AI — FIX: "new row violates row-level security policy for table ai_chat_messages"
-- Migration ID: 20261127_fix_ai_chat_messages_rls
-- Status: Forward-only, idempotent, non-destructive (no table/data drops, RLS stays ON)
--
-- Symptom: Telemetry Copilot stores the user's message, then fails to store the
-- assistant reply. The Express gateway inserts BOTH rows with the caller's JWT,
-- so a policy that only admits role = 'user' rows (or a stale tenant check)
-- rejects the assistant row.
--
-- Fix: replace every policy on ai_chat_messages with two clear policies:
--   SELECT / INSERT allowed only inside a thread owned by the caller, within the
--   caller's tenant, for roles 'user' and 'assistant' (never 'system').
-- ==============================================================================

-- Columns the gateway writes (no-op when they already exist)
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS telemetry JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_chat_messages FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.ai_chat_messages TO authenticated;
GRANT ALL ON TABLE public.ai_chat_messages TO service_role;

-- Remove every existing policy (including ones created by hand in the dashboard)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'ai_chat_messages'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_chat_messages', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "chat_messages_owner_select" ON public.ai_chat_messages
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = (SELECT public.get_auth_tenant())
        AND EXISTS (
            SELECT 1 FROM public.ai_chat_threads t
            WHERE t.id = ai_chat_messages.thread_id
              AND t.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "chat_messages_owner_insert" ON public.ai_chat_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        role IN ('user', 'assistant')
        AND tenant_id = (SELECT public.get_auth_tenant())
        AND EXISTS (
            SELECT 1 FROM public.ai_chat_threads t
            WHERE t.id = ai_chat_messages.thread_id
              AND t.user_id = (SELECT auth.uid())
        )
    );

-- Result: the policies now active on the table
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ai_chat_messages'
ORDER BY policyname;
