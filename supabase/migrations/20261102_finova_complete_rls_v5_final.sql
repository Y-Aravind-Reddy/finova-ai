-- ==============================================================================
-- FINOVA AI — PRODUCTION RLS POLICY MIGRATION (VERSION 5.1: COMPLETE & CONSOLIDATED)
-- Migration ID: 20261102_finova_complete_rls_v5_final
-- Environment: PostgreSQL 17.11 (Supabase)
-- 
-- DESCRIPTION:
-- This is the final, comprehensive RLS security layer for FINOVA AI.
-- It covers all 10 critical tables and ensures strict multi-tenant isolation.
-- 
-- ROLES: SUPER_ADMIN, ADMIN, FINANCE_ANALYST, SUPPORT_EXECUTIVE, CUSTOMER.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. IDENTITY HELPERS (SECURITY DEFINER)
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
-- 1. GLOBAL HARDENING
-- ------------------------------------------------------------------------------
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. TENANT WORKSPACES
-- ------------------------------------------------------------------------------
ALTER TABLE public.tenant_workspaces ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tenant_workspaces TO authenticated;

DO $$ 
BEGIN
    -- Super Admin: Global access
    DROP POLICY IF EXISTS "super_admin_all_tenants" ON public.tenant_workspaces;
    CREATE POLICY "super_admin_all_tenants" ON public.tenant_workspaces 
    FOR ALL TO authenticated 
    USING (public.get_auth_role() = 'SUPER_ADMIN');

    -- Authenticated: Own workspace context only
    DROP POLICY IF EXISTS "users_view_own_tenant" ON public.tenant_workspaces;
    CREATE POLICY "users_view_own_tenant" ON public.tenant_workspaces 
    FOR SELECT TO authenticated 
    USING (id = public.get_auth_tenant());

    -- Anon: View active tenants for signup (Limited)
    DROP POLICY IF EXISTS "anon_view_active_tenants" ON public.tenant_workspaces;
    CREATE POLICY "anon_view_active_tenants" ON public.tenant_workspaces
    FOR SELECT TO anon
    USING (status = 'Active' AND id <> 'platform_root');
END $$;

-- ------------------------------------------------------------------------------
-- 3. USER PROFILES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

DO $$ 
BEGIN
    -- Super Admin: Manage all
    DROP POLICY IF EXISTS "super_admin_manage_all_profiles" ON public.profiles;
    CREATE POLICY "super_admin_manage_all_profiles" ON public.profiles
    FOR ALL TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

    -- Admin: Manage tenant staff
    DROP POLICY IF EXISTS "admin_manage_tenant_profiles" ON public.profiles;
    CREATE POLICY "admin_manage_tenant_profiles" ON public.profiles 
    FOR ALL TO authenticated 
    USING (public.get_auth_role() = 'ADMIN' AND tenant_id = public.get_auth_tenant())
    WITH CHECK (
        public.get_auth_role() = 'ADMIN' AND 
        tenant_id = public.get_auth_tenant() AND 
        role NOT IN ('ADMIN', 'SUPER_ADMIN')
    );

    -- SELECT: Self
    DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
    CREATE POLICY "users_read_own_profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

    -- UPDATE: Restricted self-update (Cannot escalate role or tenant)
    DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
    DROP POLICY IF EXISTS "users_update_own_profile_safe" ON public.profiles;
    CREATE POLICY "users_update_own_profile_safe" ON public.profiles 
    FOR UPDATE TO authenticated 
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() AND 
        role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND 
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

    -- Staff: View tenant profiles
    DROP POLICY IF EXISTS "staff_view_tenant_profiles" ON public.profiles;
    CREATE POLICY "staff_view_tenant_profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE')
        AND tenant_id = public.get_auth_tenant()
    );
END $$;

-- ------------------------------------------------------------------------------
-- 4. CUSTOMER PROFILE MAPPING
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_profile_mapping') THEN
        ALTER TABLE public.customer_profile_mapping ENABLE ROW LEVEL SECURITY;
        GRANT SELECT ON public.customer_profile_mapping TO authenticated;

        -- Mapping: SELECT Own or Staff access
        DROP POLICY IF EXISTS "mapping_select_auth" ON public.customer_profile_mapping;
        DROP POLICY IF EXISTS "staff_view_tenant_mapping" ON public.customer_profile_mapping;
        EXECUTE 'CREATE POLICY "mapping_select_auth" ON public.customer_profile_mapping FOR SELECT TO authenticated 
        USING (profile_id = auth.uid() OR (public.get_auth_role() IN (''ADMIN'', ''FINANCE_ANALYST'', ''SUPPORT_EXECUTIVE'') AND tenant_id = public.get_auth_tenant()))';

        -- Management (I/U/D): Authorized tenant-scoped Admin or Super Admin
        DROP POLICY IF EXISTS "mapping_admin_mgmt" ON public.customer_profile_mapping;
        DROP POLICY IF EXISTS "super_admin_all_mapping" ON public.customer_profile_mapping;
        EXECUTE 'CREATE POLICY "mapping_admin_mgmt" ON public.customer_profile_mapping FOR ALL TO authenticated 
        USING (
            (public.get_auth_role() = ''ADMIN'' AND tenant_id = public.get_auth_tenant()) OR 
            public.get_auth_role() = ''SUPER_ADMIN''
        )
        WITH CHECK (
            (public.get_auth_role() = ''ADMIN'' AND tenant_id = public.get_auth_tenant()) OR 
            public.get_auth_role() = ''SUPER_ADMIN''
        )';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. TRANSACTIONS
-- ------------------------------------------------------------------------------
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.transactions TO authenticated;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "super_admin_all_transactions" ON public.transactions;
    CREATE POLICY "super_admin_all_transactions" ON public.transactions
    FOR ALL TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

    DROP POLICY IF EXISTS "staff_manage_tenant_transactions" ON public.transactions;
    CREATE POLICY "staff_manage_tenant_transactions" ON public.transactions
    FOR ALL TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    );

    DROP POLICY IF EXISTS "support_view_tenant_transactions" ON public.transactions;
    CREATE POLICY "support_view_tenant_transactions" ON public.transactions
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() = 'SUPPORT_EXECUTIVE'
        AND tenant_id = public.get_auth_tenant()
    );

    DROP POLICY IF EXISTS "customer_own_transactions" ON public.transactions;
    CREATE POLICY "customer_own_transactions" ON public.transactions
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        AND tenant_id = public.get_auth_tenant()
    );
END $$;

-- ------------------------------------------------------------------------------
-- 6. FRAUD & AML SURVEILLANCE
-- ------------------------------------------------------------------------------
ALTER TABLE public.fraud_cases ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.fraud_cases TO authenticated;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "super_admin_all_fraud" ON public.fraud_cases;
    CREATE POLICY "super_admin_all_fraud" ON public.fraud_cases
    FOR ALL TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

    DROP POLICY IF EXISTS "analyst_manage_tenant_fraud" ON public.fraud_cases;
    CREATE POLICY "analyst_manage_tenant_fraud" ON public.fraud_cases
    FOR ALL TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    );
END $$;

-- ------------------------------------------------------------------------------
-- 7. KYC RECORDS
-- ------------------------------------------------------------------------------
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.kyc_records TO authenticated;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "super_admin_all_kyc" ON public.kyc_records;
    CREATE POLICY "super_admin_all_kyc" ON public.kyc_records
    FOR ALL TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

    DROP POLICY IF EXISTS "staff_manage_tenant_kyc" ON public.kyc_records;
    CREATE POLICY "staff_manage_tenant_kyc" ON public.kyc_records
    FOR ALL TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    );

    DROP POLICY IF EXISTS "support_view_tenant_kyc" ON public.kyc_records;
    CREATE POLICY "support_view_tenant_kyc" ON public.kyc_records
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() = 'SUPPORT_EXECUTIVE'
        AND tenant_id = public.get_auth_tenant()
    );

    DROP POLICY IF EXISTS "customer_own_kyc_read" ON public.kyc_records;
    CREATE POLICY "customer_own_kyc_read" ON public.kyc_records
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "customer_own_kyc_insert" ON public.kyc_records;
    CREATE POLICY "customer_own_kyc_insert" ON public.kyc_records
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND status = 'Pending');
END $$;

-- ------------------------------------------------------------------------------
-- 8. SUPPORT TICKETS
-- ------------------------------------------------------------------------------
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "super_admin_all_tickets" ON public.support_tickets;
    CREATE POLICY "super_admin_all_tickets" ON public.support_tickets
    FOR ALL TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

    DROP POLICY IF EXISTS "staff_manage_tenant_tickets" ON public.support_tickets;
    CREATE POLICY "staff_manage_tenant_tickets" ON public.support_tickets
    FOR ALL TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'SUPPORT_EXECUTIVE')
        AND tenant_id = public.get_auth_tenant()
    );

    DROP POLICY IF EXISTS "customer_own_tickets" ON public.support_tickets;
    CREATE POLICY "customer_own_tickets" ON public.support_tickets
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
END $$;

-- ------------------------------------------------------------------------------
-- 9. AUDIT LOGS (Append-Only)
-- ------------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "super_admin_read_all_audit" ON public.audit_logs;
    CREATE POLICY "super_admin_read_all_audit" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

    DROP POLICY IF EXISTS "admin_read_tenant_audit" ON public.audit_logs;
    CREATE POLICY "admin_read_tenant_audit" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() = 'ADMIN'
        AND tenant_id = public.get_auth_tenant()
    );

    DROP POLICY IF EXISTS "authenticated_insert_audit" ON public.audit_logs;
    CREATE POLICY "authenticated_insert_audit" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_auth_tenant()
        OR public.get_auth_role() = 'SUPER_ADMIN'
    );
END $$;

-- ------------------------------------------------------------------------------
-- 10. EXCHANGE RATES (PUBLIC READ)
-- ------------------------------------------------------------------------------
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.exchange_rates TO authenticated, anon;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "read_all_rates" ON public.exchange_rates;
    CREATE POLICY "read_all_rates" ON public.exchange_rates
    FOR SELECT TO authenticated, anon
    USING (true);

    DROP POLICY IF EXISTS "super_admin_manage_rates" ON public.exchange_rates;
    CREATE POLICY "super_admin_manage_rates" ON public.exchange_rates
    FOR ALL TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');
END $$;

-- ------------------------------------------------------------------------------
-- 11. PERFORMANCE INDEXES (PREVENTS TIMEOUTS)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_tenant_id ON public.fraud_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_records_tenant_id ON public.kyc_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_records_user_id ON public.kyc_records(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_id ON public.support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_profile_mapping') THEN
        CREATE INDEX IF NOT EXISTS idx_mapping_tenant_id ON public.customer_profile_mapping(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_mapping_profile_id ON public.customer_profile_mapping(profile_id);
    END IF;
END $$;
