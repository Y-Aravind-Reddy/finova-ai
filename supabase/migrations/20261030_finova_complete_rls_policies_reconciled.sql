-- ==============================================================================
-- FINOVA AI — RECONCILED PRODUCTION RLS POLICY MIGRATION (VERSION 3)
-- Migration ID: 20261030_finova_complete_rls_policies_reconciled
-- Environment: PostgreSQL 17.11 (Supabase)
-- 
-- DESCRIPTION:
-- Strictly idempotent migration using a "Verify-then-Apply" pattern.
-- Resolves ERROR 42710 (already exists) by explicitly checking pg_policies.
-- Every policy is provided as a complete, executable statement.
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

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_workspaces' AND policyname = 'super_admin_all_tenants') THEN
        DROP POLICY "super_admin_all_tenants" ON public.tenant_workspaces;
    END IF;
    CREATE POLICY "super_admin_all_tenants" ON public.tenant_workspaces FOR ALL TO authenticated USING (public.get_auth_role() = 'SUPER_ADMIN') WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_workspaces' AND policyname = 'users_view_own_tenant') THEN
        DROP POLICY "users_view_own_tenant" ON public.tenant_workspaces;
    END IF;
    CREATE POLICY "users_view_own_tenant" ON public.tenant_workspaces FOR SELECT TO authenticated USING (id = public.get_auth_tenant());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_workspaces' AND policyname = 'anon_view_active_tenants') THEN
        DROP POLICY "anon_view_active_tenants" ON public.tenant_workspaces;
    END IF;
    CREATE POLICY "anon_view_active_tenants" ON public.tenant_workspaces FOR SELECT TO anon USING (status = 'Active' AND id <> 'platform_root');
END $$;

-- ------------------------------------------------------------------------------
-- 2. USER PROFILES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'super_admin_manage_all_profiles') THEN
        DROP POLICY "super_admin_manage_all_profiles" ON public.profiles;
    END IF;
    CREATE POLICY "super_admin_manage_all_profiles" ON public.profiles FOR ALL TO authenticated USING (public.get_auth_role() = 'SUPER_ADMIN') WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'admin_manage_tenant_profiles') THEN
        DROP POLICY "admin_manage_tenant_profiles" ON public.profiles;
    END IF;
    CREATE POLICY "admin_manage_tenant_profiles" ON public.profiles FOR ALL TO authenticated USING (public.get_auth_role() = 'ADMIN' AND tenant_id = public.get_auth_tenant()) WITH CHECK (public.get_auth_role() = 'ADMIN' AND tenant_id = public.get_auth_tenant() AND role IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER'));

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'staff_view_tenant_profiles') THEN
        DROP POLICY "staff_view_tenant_profiles" ON public.profiles;
    END IF;
    CREATE POLICY "staff_view_tenant_profiles" ON public.profiles FOR SELECT TO authenticated USING (public.get_auth_role() IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') AND tenant_id = public.get_auth_tenant());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_read_own_profile') THEN
        DROP POLICY "users_read_own_profile" ON public.profiles;
    END IF;
    CREATE POLICY "users_read_own_profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_update_own_profile') THEN
        DROP POLICY "users_update_own_profile" ON public.profiles;
    END IF;
    CREATE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
END $$;

-- ------------------------------------------------------------------------------
-- 3. TRANSACTIONS
-- ------------------------------------------------------------------------------
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'super_admin_all_transactions') THEN
        DROP POLICY "super_admin_all_transactions" ON public.transactions;
    END IF;
    CREATE POLICY "super_admin_all_transactions" ON public.transactions FOR ALL TO authenticated USING (public.get_auth_role() = 'SUPER_ADMIN') WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'staff_manage_tenant_transactions') THEN
        DROP POLICY "staff_manage_tenant_transactions" ON public.transactions;
    END IF;
    CREATE POLICY "staff_manage_tenant_transactions" ON public.transactions FOR ALL TO authenticated USING (public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST') AND tenant_id = public.get_auth_tenant()) WITH CHECK (public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST') AND tenant_id = public.get_auth_tenant());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'support_view_tenant_transactions') THEN
        DROP POLICY "support_view_tenant_transactions" ON public.transactions;
    END IF;
    CREATE POLICY "support_view_tenant_transactions" ON public.transactions FOR SELECT TO authenticated USING (public.get_auth_role() = 'SUPPORT_EXECUTIVE' AND tenant_id = public.get_auth_tenant());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'customer_own_transactions') THEN
        DROP POLICY "customer_own_transactions" ON public.transactions;
    END IF;
    CREATE POLICY "customer_own_transactions" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid() AND tenant_id = public.get_auth_tenant());
END $$;

-- ------------------------------------------------------------------------------
-- 4. FRAUD & AML SURVEILLANCE
-- ------------------------------------------------------------------------------
ALTER TABLE public.fraud_cases ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fraud_cases' AND policyname = 'super_admin_all_fraud') THEN
        DROP POLICY "super_admin_all_fraud" ON public.fraud_cases;
    END IF;
    CREATE POLICY "super_admin_all_fraud" ON public.fraud_cases FOR ALL TO authenticated USING (public.get_auth_role() = 'SUPER_ADMIN') WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fraud_cases' AND policyname = 'analyst_manage_tenant_fraud') THEN
        DROP POLICY "analyst_manage_tenant_fraud" ON public.fraud_cases;
    END IF;
    CREATE POLICY "analyst_manage_tenant_fraud" ON public.fraud_cases FOR ALL TO authenticated USING (public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST') AND tenant_id = public.get_auth_tenant()) WITH CHECK (public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST') AND tenant_id = public.get_auth_tenant());
END $$;

-- ------------------------------------------------------------------------------
-- 5. KYC RECORDS
-- ------------------------------------------------------------------------------
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyc_records' AND policyname = 'super_admin_all_kyc') THEN
        DROP POLICY "super_admin_all_kyc" ON public.kyc_records;
    END IF;
    CREATE POLICY "super_admin_all_kyc" ON public.kyc_records FOR ALL TO authenticated USING (public.get_auth_role() = 'SUPER_ADMIN') WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyc_records' AND policyname = 'staff_manage_tenant_kyc') THEN
        DROP POLICY "staff_manage_tenant_kyc" ON public.kyc_records;
    END IF;
    CREATE POLICY "staff_manage_tenant_kyc" ON public.kyc_records FOR ALL TO authenticated USING (public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST') AND tenant_id = public.get_auth_tenant()) WITH CHECK (public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST') AND tenant_id = public.get_auth_tenant());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyc_records' AND policyname = 'support_view_tenant_kyc') THEN
        DROP POLICY "support_view_tenant_kyc" ON public.kyc_records;
    END IF;
    CREATE POLICY "support_view_tenant_kyc" ON public.kyc_records FOR SELECT TO authenticated USING (public.get_auth_role() = 'SUPPORT_EXECUTIVE' AND tenant_id = public.get_auth_tenant());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyc_records' AND policyname = 'customer_own_kyc_read') THEN
        DROP POLICY "customer_own_kyc_read" ON public.kyc_records;
    END IF;
    CREATE POLICY "customer_own_kyc_read" ON public.kyc_records FOR SELECT TO authenticated USING (user_id = auth.uid());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyc_records' AND policyname = 'customer_own_kyc_insert') THEN
        DROP POLICY "customer_own_kyc_insert" ON public.kyc_records;
    END IF;
    CREATE POLICY "customer_own_kyc_insert" ON public.kyc_records FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'Pending');
END $$;

-- ------------------------------------------------------------------------------
-- 6. SUPPORT TICKETS
-- ------------------------------------------------------------------------------
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'super_admin_all_tickets') THEN
        DROP POLICY "super_admin_all_tickets" ON public.support_tickets;
    END IF;
    CREATE POLICY "super_admin_all_tickets" ON public.support_tickets FOR ALL TO authenticated USING (public.get_auth_role() = 'SUPER_ADMIN') WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'staff_manage_tenant_tickets') THEN
        DROP POLICY "staff_manage_tenant_tickets" ON public.support_tickets;
    END IF;
    CREATE POLICY "staff_manage_tenant_tickets" ON public.support_tickets FOR ALL TO authenticated USING (public.get_auth_role() IN ('ADMIN', 'SUPPORT_EXECUTIVE') AND tenant_id = public.get_auth_tenant()) WITH CHECK (public.get_auth_role() IN ('ADMIN', 'SUPPORT_EXECUTIVE') AND tenant_id = public.get_auth_tenant());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'analyst_view_tenant_tickets') THEN
        DROP POLICY "analyst_view_tenant_tickets" ON public.support_tickets;
    END IF;
    CREATE POLICY "analyst_view_tenant_tickets" ON public.support_tickets FOR SELECT TO authenticated USING (public.get_auth_role() = 'FINANCE_ANALYST' AND tenant_id = public.get_auth_tenant());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'customer_own_tickets') THEN
        DROP POLICY "customer_own_tickets" ON public.support_tickets;
    END IF;
    CREATE POLICY "customer_own_tickets" ON public.support_tickets FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
END $$;

-- ------------------------------------------------------------------------------
-- 7. AUDIT LOGS (Append-Only)
-- ------------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'super_admin_read_all_audit') THEN
        DROP POLICY "super_admin_read_all_audit" ON public.audit_logs;
    END IF;
    CREATE POLICY "super_admin_read_all_audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.get_auth_role() = 'SUPER_ADMIN');

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'admin_read_tenant_audit') THEN
        DROP POLICY "admin_read_tenant_audit" ON public.audit_logs;
    END IF;
    CREATE POLICY "admin_read_tenant_audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.get_auth_role() = 'ADMIN' AND tenant_id = public.get_auth_tenant());

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'authenticated_insert_audit') THEN
        DROP POLICY "authenticated_insert_audit" ON public.audit_logs;
    END IF;
    CREATE POLICY "authenticated_insert_audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_auth_tenant() OR public.get_auth_role() = 'SUPER_ADMIN');
END $$;

-- ------------------------------------------------------------------------------
-- 8. EXCHANGE RATES
-- ------------------------------------------------------------------------------
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exchange_rates' AND policyname = 'read_all_rates') THEN
        DROP POLICY "read_all_rates" ON public.exchange_rates;
    END IF;
    CREATE POLICY "read_all_rates" ON public.exchange_rates FOR SELECT TO authenticated, anon USING (true);

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exchange_rates' AND policyname = 'super_admin_manage_rates') THEN
        DROP POLICY "super_admin_manage_rates" ON public.exchange_rates;
    END IF;
    CREATE POLICY "super_admin_manage_rates" ON public.exchange_rates FOR ALL TO authenticated USING (public.get_auth_role() = 'SUPER_ADMIN') WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');
END $$;

-- ------------------------------------------------------------------------------
-- 9. STAGING ADMIN RAW (Dynamic Check)
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staging_admin_raw') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staging_admin_raw' AND policyname = 'super_admin_all_staging') THEN
            EXECUTE 'DROP POLICY "super_admin_all_staging" ON public.staging_admin_raw';
        END IF;
        EXECUTE 'CREATE POLICY "super_admin_all_staging" ON public.staging_admin_raw FOR ALL TO authenticated USING (public.get_auth_role() = ''SUPER_ADMIN'') WITH CHECK (public.get_auth_role() = ''SUPER_ADMIN'')';

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staging_admin_raw' AND policyname = 'admin_manage_tenant_staging') THEN
            EXECUTE 'DROP POLICY "admin_manage_tenant_staging" ON public.staging_admin_raw';
        END IF;
        EXECUTE 'CREATE POLICY "admin_manage_tenant_staging" ON public.staging_admin_raw FOR ALL TO authenticated USING (public.get_auth_role() = ''ADMIN'' AND tenant_id = public.get_auth_tenant()) WITH CHECK (public.get_auth_role() = ''ADMIN'' AND tenant_id = public.get_auth_tenant())';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 10. CUSTOMER PROFILE MAPPING (Dynamic Check)
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_profile_mapping') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_profile_mapping' AND policyname = 'super_admin_all_mapping') THEN
            EXECUTE 'DROP POLICY "super_admin_all_mapping" ON public.customer_profile_mapping';
        END IF;
        EXECUTE 'CREATE POLICY "super_admin_all_mapping" ON public.customer_profile_mapping FOR ALL TO authenticated USING (public.get_auth_role() = ''SUPER_ADMIN'') WITH CHECK (public.get_auth_role() = ''SUPER_ADMIN'')';

        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_profile_mapping' AND policyname = 'staff_view_tenant_mapping') THEN
            EXECUTE 'DROP POLICY "staff_view_tenant_mapping" ON public.customer_profile_mapping';
        END IF;
        EXECUTE 'CREATE POLICY "staff_view_tenant_mapping" ON public.customer_profile_mapping FOR SELECT TO authenticated USING (tenant_id = public.get_auth_tenant())';
    END IF;
END $$;
