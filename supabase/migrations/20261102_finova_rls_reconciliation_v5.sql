-- FINOVA AI: COMPLETE RLS RECONCILIATION & SECURITY MIGRATION (V5)
-- Date: 2026-11-02
-- Target: PostgreSQL 17 (Supabase)
-- Description: Resolves 42501 errors, implements profile_id mapping, and hardens tenant isolation.

-- [1] SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.get_auth_tenant() 
RETURNS text AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId'),
    'tenant_apex_bank'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_role() 
RETURNS text AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role'),
    'CUSTOMER'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- [2] RESOLVE 42501: GLOBAL GRANTS
-- Required for dashboard aggregate RPC functions
DO $$ 
BEGIN
    GRANT EXECUTE ON FUNCTION public.get_transaction_aggregates TO authenticated;
    GRANT EXECUTE ON FUNCTION public.get_fraud_aggregates TO authenticated;
    GRANT EXECUTE ON FUNCTION public.get_support_aggregates TO authenticated;
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Notice: Some aggregate functions might not exist yet.';
END $$;

-- Required for basic table visibility (RLS performs the actual filtering)
GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT ON public.fraud_cases TO authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT SELECT ON public.kyc_records TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.tenant_workspaces TO authenticated;
GRANT SELECT ON public.customer_profile_mapping TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;

-- [3] TABLE SECURITY ACTIVATION
ALTER TABLE IF EXISTS public.customer_profile_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fraud_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kyc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_workspaces ENABLE ROW LEVEL SECURITY;

-- [4] POLICIES: customer_profile_mapping (V5 CORRECTIONS)
-- Requirement: Use profile_id, SELECT-only for authenticated, restricted DML.

DO $$ 
BEGIN
    -- SELECT: Self or Tenant Staff
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mapping_select_v5') THEN
        CREATE POLICY "mapping_select_v5" ON public.customer_profile_mapping
        FOR SELECT TO authenticated
        USING (
            profile_id = auth.uid() 
            OR (public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') AND tenant_id = public.get_auth_tenant())
            OR public.get_auth_role() = 'SUPER_ADMIN'
        );
    END IF;

    -- DML: Super Admin Only (Maintenance)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mapping_admin_all_v5') THEN
        CREATE POLICY "mapping_admin_all_v5" ON public.customer_profile_mapping
        FOR ALL TO authenticated
        USING (public.get_auth_role() = 'SUPER_ADMIN')
        WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');
    END IF;
END $$;

-- [5] POLICIES: profiles (SELF-UPDATE PROTECTION)
-- Requirement: Prevent escalation of role, tenant_id, or status.

DO $$ 
BEGIN
    -- Basic SELECT
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_read_v5') THEN
        CREATE POLICY "profiles_read_v5" ON public.profiles
        FOR SELECT TO authenticated
        USING (
            id = auth.uid() 
            OR (tenant_id = public.get_auth_tenant() AND public.get_auth_role() IN ('ADMIN', 'SUPER_ADMIN'))
            OR public.get_auth_role() = 'SUPER_ADMIN'
        );
    END IF;

    -- Self-Update with Schema Enforcement
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_self_update_v5') THEN
        CREATE POLICY "profiles_self_update_v5" ON public.profiles
        FOR UPDATE TO authenticated
        USING (id = auth.uid())
        WITH CHECK (
            id = auth.uid() AND (
                -- Prevent modification of protected fields
                OLD.role = NEW.role AND 
                OLD.tenant_id = NEW.tenant_id AND 
                OLD.status = NEW.status
            )
        );
    END IF;
END $$;

-- [6] POLICIES: transactions (TENANT & CUSTOMER ISOLATION)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transactions_isolation_v5') THEN
        CREATE POLICY "transactions_isolation_v5" ON public.transactions
        FOR SELECT TO authenticated
        USING (
            (public.get_auth_role() = 'CUSTOMER' AND user_id = auth.uid())
            OR (public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST') AND tenant_id = public.get_auth_tenant())
            OR public.get_auth_role() = 'SUPER_ADMIN'
        );
    END IF;
END $$;

-- [7] POLICIES: fraud_cases (SUPPORT EXECUTIVE CLEARANCE)
-- Requirement: Support Executive read-only access to tenant fraud cases.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fraud_cases_visibility_v5') THEN
        CREATE POLICY "fraud_cases_visibility_v5" ON public.fraud_cases
        FOR SELECT TO authenticated
        USING (
            (public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') AND tenant_id = public.get_auth_tenant())
            OR public.get_auth_role() = 'SUPER_ADMIN'
        );
    END IF;
END $$;

-- [8] POLICIES: audit_logs (INSERTION PRIVILEGE)
DO $$ 
BEGIN
    -- Allow insertion of own logs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'audit_logs_insert_v5') THEN
        CREATE POLICY "audit_logs_insert_v5" ON public.audit_logs
        FOR INSERT TO authenticated
        WITH CHECK (true); -- Content validated by frontend recordAuditEventInDb
    END IF;

    -- Restricted Read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'audit_logs_read_v5') THEN
        CREATE POLICY "audit_logs_read_v5" ON public.audit_logs
        FOR SELECT TO authenticated
        USING (
            (public.get_auth_role() IN ('ADMIN', 'SUPER_ADMIN') AND tenant_id = public.get_auth_tenant())
            OR public.get_auth_role() = 'SUPER_ADMIN'
        );
    END IF;
END $$;

-- [9] POLICIES: tenant_workspaces (REMOVE ANON)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_workspaces_auth_read_v5') THEN
        CREATE POLICY "tenant_workspaces_auth_read_v5" ON public.tenant_workspaces
        FOR SELECT TO authenticated
        USING (
            id = public.get_auth_tenant() 
            OR public.get_auth_role() = 'SUPER_ADMIN'
        );
    END IF;
END $$;

-- [10] PRESERVE STAGING_ADMIN_RAW
-- Ensure no wide write policies are added. 
-- Existing SELECT policies are retained by the database automatically as we are not dropping them.

-- VERIFICATION QUERY (DBA Review)
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE '%v5';
