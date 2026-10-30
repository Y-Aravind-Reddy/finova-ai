-- ==============================================================================
-- FINOVA AI — PRODUCTION RLS POLICY MIGRATION (CORRECTED & COMPLETE)
-- Migration ID: 20261030_finova_complete_rls_policies_v2
-- Environment: PostgreSQL 17.11 (Supabase)
-- 
-- DESCRIPTION:
-- This migration secures 10 critical tables across all 5 operational roles.
-- It utilizes SECURITY DEFINER helper functions to resolve identity without recursion.
-- 
-- ROLES: SUPER_ADMIN, ADMIN, FINANCE_ANALYST, SUPPORT_EXECUTIVE, CUSTOMER.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. PREREQUISITES: IDENTITY HELPERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1),
        'ANON'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_tenant()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1),
        ''
    );
$$;

-- ------------------------------------------------------------------------------
-- 1. TENANT WORKSPACES
-- ------------------------------------------------------------------------------

ALTER TABLE public.tenant_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_tenants" ON public.tenant_workspaces;
CREATE POLICY "super_admin_all_tenants" ON public.tenant_workspaces
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "users_view_own_tenant" ON public.tenant_workspaces;
CREATE POLICY "users_view_own_tenant" ON public.tenant_workspaces
    FOR SELECT
    TO authenticated
    USING (id = public.get_auth_tenant());

DROP POLICY IF EXISTS "anon_view_active_tenants" ON public.tenant_workspaces;
CREATE POLICY "anon_view_active_tenants" ON public.tenant_workspaces
    FOR SELECT
    TO anon
    USING (status = 'Active' AND id <> 'platform_root');

-- ------------------------------------------------------------------------------
-- 2. USER PROFILES
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_manage_all_profiles" ON public.profiles;
CREATE POLICY "super_admin_manage_all_profiles" ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "admin_manage_tenant_profiles" ON public.profiles;
CREATE POLICY "admin_manage_tenant_profiles" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        public.get_auth_role() = 'ADMIN' 
        AND tenant_id = public.get_auth_tenant()
    )
    WITH CHECK (
        public.get_auth_role() = 'ADMIN' 
        AND tenant_id = public.get_auth_tenant()
        AND role IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER')
    );

DROP POLICY IF EXISTS "staff_view_tenant_profiles" ON public.profiles;
CREATE POLICY "staff_view_tenant_profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE')
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------------------------
-- 3. TRANSACTIONS
-- ------------------------------------------------------------------------------

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_transactions" ON public.transactions;
CREATE POLICY "super_admin_all_transactions" ON public.transactions
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "staff_manage_tenant_transactions" ON public.transactions;
CREATE POLICY "staff_manage_tenant_transactions" ON public.transactions
    FOR ALL
    TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    )
    WITH CHECK (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "support_view_tenant_transactions" ON public.transactions;
CREATE POLICY "support_view_tenant_transactions" ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'SUPPORT_EXECUTIVE'
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "customer_own_transactions" ON public.transactions;
CREATE POLICY "customer_own_transactions" ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        AND tenant_id = public.get_auth_tenant()
    );

-- ------------------------------------------------------------------------------
-- 4. FRAUD & AML SURVEILLANCE
-- ------------------------------------------------------------------------------

ALTER TABLE public.fraud_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_fraud" ON public.fraud_cases;
CREATE POLICY "super_admin_all_fraud" ON public.fraud_cases
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "analyst_manage_tenant_fraud" ON public.fraud_cases;
CREATE POLICY "analyst_manage_tenant_fraud" ON public.fraud_cases
    FOR ALL
    TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    )
    WITH CHECK (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    );

-- ------------------------------------------------------------------------------
-- 5. KYC RECORDS
-- ------------------------------------------------------------------------------

ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_kyc" ON public.kyc_records;
CREATE POLICY "super_admin_all_kyc" ON public.kyc_records
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "staff_manage_tenant_kyc" ON public.kyc_records;
CREATE POLICY "staff_manage_tenant_kyc" ON public.kyc_records
    FOR ALL
    TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    )
    WITH CHECK (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "support_view_tenant_kyc" ON public.kyc_records;
CREATE POLICY "support_view_tenant_kyc" ON public.kyc_records
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'SUPPORT_EXECUTIVE'
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "customer_own_kyc_read" ON public.kyc_records;
CREATE POLICY "customer_own_kyc_read" ON public.kyc_records
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "customer_own_kyc_insert" ON public.kyc_records;
CREATE POLICY "customer_own_kyc_insert" ON public.kyc_records
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND status = 'Pending');

-- ------------------------------------------------------------------------------
-- 6. SUPPORT TICKETS
-- ------------------------------------------------------------------------------

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_tickets" ON public.support_tickets;
CREATE POLICY "super_admin_all_tickets" ON public.support_tickets
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "staff_manage_tenant_tickets" ON public.support_tickets;
CREATE POLICY "staff_manage_tenant_tickets" ON public.support_tickets
    FOR ALL
    TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'SUPPORT_EXECUTIVE')
        AND tenant_id = public.get_auth_tenant()
    )
    WITH CHECK (
        public.get_auth_role() IN ('ADMIN', 'SUPPORT_EXECUTIVE')
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "analyst_view_tenant_tickets" ON public.support_tickets;
CREATE POLICY "analyst_view_tenant_tickets" ON public.support_tickets
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'FINANCE_ANALYST'
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "customer_own_tickets" ON public.support_tickets;
CREATE POLICY "customer_own_tickets" ON public.support_tickets
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 7. AUDIT LOGS (Append-Only)
-- ------------------------------------------------------------------------------

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_all_audit" ON public.audit_logs;
CREATE POLICY "super_admin_read_all_audit" ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "admin_read_tenant_audit" ON public.audit_logs;
CREATE POLICY "admin_read_tenant_audit" ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'ADMIN'
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "authenticated_insert_audit" ON public.audit_logs;
CREATE POLICY "authenticated_insert_audit" ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id = public.get_auth_tenant()
        OR public.get_auth_role() = 'SUPER_ADMIN'
    );

-- ------------------------------------------------------------------------------
-- 8. EXCHANGE RATES
-- ------------------------------------------------------------------------------

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_all_rates" ON public.exchange_rates;
CREATE POLICY "read_all_rates" ON public.exchange_rates
    FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "super_admin_manage_rates" ON public.exchange_rates;
CREATE POLICY "super_admin_manage_rates" ON public.exchange_rates
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ------------------------------------------------------------------------------
-- 9. STAGING ADMIN RAW (Optional / If Exists)
-- ------------------------------------------------------------------------------

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staging_admin_raw') THEN
        ALTER TABLE public.staging_admin_raw ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "super_admin_all_staging" ON public.staging_admin_raw;
        EXECUTE 'CREATE POLICY "super_admin_all_staging" ON public.staging_admin_raw FOR ALL TO authenticated USING (public.get_auth_role() = ''SUPER_ADMIN'') WITH CHECK (public.get_auth_role() = ''SUPER_ADMIN'')';

        DROP POLICY IF EXISTS "admin_manage_tenant_staging" ON public.staging_admin_raw;
        EXECUTE 'CREATE POLICY "admin_manage_tenant_staging" ON public.staging_admin_raw FOR ALL TO authenticated USING (public.get_auth_role() = ''ADMIN'' AND tenant_id = public.get_auth_tenant()) WITH CHECK (public.get_auth_role() = ''ADMIN'' AND tenant_id = public.get_auth_tenant())';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 10. CUSTOMER PROFILE MAPPING (Optional / If Exists)
-- ------------------------------------------------------------------------------

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_profile_mapping') THEN
        ALTER TABLE public.customer_profile_mapping ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "super_admin_all_mapping" ON public.customer_profile_mapping;
        EXECUTE 'CREATE POLICY "super_admin_all_mapping" ON public.customer_profile_mapping FOR ALL TO authenticated USING (public.get_auth_role() = ''SUPER_ADMIN'') WITH CHECK (public.get_auth_role() = ''SUPER_ADMIN'')';

        DROP POLICY IF EXISTS "staff_view_tenant_mapping" ON public.customer_profile_mapping;
        EXECUTE 'CREATE POLICY "staff_view_tenant_mapping" ON public.customer_profile_mapping FOR SELECT TO authenticated USING (tenant_id = public.get_auth_tenant())';
    END IF;
END $$;
