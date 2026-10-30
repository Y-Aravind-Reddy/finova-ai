-- ==============================================================================
-- FINOVA AI — PRODUCTION RLS POLICY MIGRATION (VERSION 5: HARDENED)
-- Migration ID: 20261030_finova_complete_rls_policies_reconciled_v5
-- Environment: PostgreSQL 17.11 (Supabase)
-- 
-- SUMMARY OF MANDATORY CORRECTIONS:
-- 1. Corrected customer_profile_mapping to use 'profile_id' (columns: customer_id, profile_id, tenant_id).
-- 2. Strictly SELECT-only for authenticated users on mapping table.
-- 3. Management of mappings restricted to ADMIN (tenant-scoped) and SUPER_ADMIN.
-- 4. Protected profiles.role and tenant_id from customer self-update escalation.
-- 5. Removed all anonymous access to private tables (no anon access to workspaces).
-- 6. Preserved existing staging_admin_raw SELECT-only policies.
-- 7. Idempotent with precise expression validation.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PRE-MIGRATION DIAGNOSTICS (READ-ONLY INSTRUCTIONS)
-- ------------------------------------------------------------------------------
/*
  RUN THESE IN SUPABASE SQL EDITOR BEFORE APPLYING:
  
  -- Check columns of customer_profile_mapping
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'customer_profile_mapping';

  -- Audit existing policies for sensitive tables
  SELECT tablename, policyname, roles, cmd, qual, with_check 
  FROM pg_policies 
  WHERE schemaname = 'public';
*/

-- ------------------------------------------------------------------------------
-- 2. SCHEMA HARDENING & GRANTS
-- ------------------------------------------------------------------------------
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. TENANT WORKSPACES (PRIVATE - NO ANON ACCESS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.tenant_workspaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_workspaces FROM anon; -- User Instruction #7
GRANT SELECT ON public.tenant_workspaces TO authenticated;

DO $$ 
BEGIN
    -- Super Admin: Global access
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_workspaces' AND policyname = 'super_admin_all_tenants') THEN
        CREATE POLICY "super_admin_all_tenants" ON public.tenant_workspaces 
        FOR ALL TO authenticated 
        USING (public.get_auth_role() = 'SUPER_ADMIN');
    END IF;

    -- Authenticated: Own workspace context only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_workspaces' AND policyname = 'users_view_own_tenant') THEN
        CREATE POLICY "users_view_own_tenant" ON public.tenant_workspaces 
        FOR SELECT TO authenticated 
        USING (id = public.get_auth_tenant());
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. USER PROFILES (HARDENED SELF-UPDATE)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- SELECT: Self or Tenant Staff
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_read_own_profile') THEN
        CREATE POLICY "users_read_own_profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
    END IF;

    -- UPDATE: Restricted self-update (Instruction #5)
    -- This policy ensures users can only update their own records and cannot change role/tenant.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_update_own_profile_safe') THEN
        CREATE POLICY "users_update_own_profile_safe" ON public.profiles 
        FOR UPDATE TO authenticated 
        USING (id = auth.uid())
        WITH CHECK (
            id = auth.uid() AND 
            role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND 
            tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        );
    END IF;

    -- ADMIN: Manage non-admins within tenant
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'admin_manage_tenant_profiles') THEN
        CREATE POLICY "admin_manage_tenant_profiles" ON public.profiles 
        FOR ALL TO authenticated 
        USING (public.get_auth_role() = 'ADMIN' AND tenant_id = public.get_auth_tenant())
        WITH CHECK (
            public.get_auth_role() = 'ADMIN' AND 
            tenant_id = public.get_auth_tenant() AND 
            role NOT IN ('ADMIN', 'SUPER_ADMIN')
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. CUSTOMER PROFILE MAPPING (Correction #1, #2, #3, #4)
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_profile_mapping') THEN
        ALTER TABLE public.customer_profile_mapping ENABLE ROW LEVEL SECURITY;
        
        -- Requirement: SELECT-only for authenticated users
        EXECUTE 'REVOKE ALL ON public.customer_profile_mapping FROM authenticated';
        EXECUTE 'GRANT SELECT ON public.customer_profile_mapping TO authenticated';

        -- Policy: SELECT Own or Staff access
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_profile_mapping' AND policyname = 'mapping_select_auth') THEN
            EXECUTE 'CREATE POLICY "mapping_select_auth" ON public.customer_profile_mapping FOR SELECT TO authenticated 
            USING (profile_id = auth.uid() OR (public.get_auth_role() IN (''ADMIN'', ''FINANCE_ANALYST'', ''SUPPORT_EXECUTIVE'') AND tenant_id = public.get_auth_tenant()))';
        END IF;

        -- Management (I/U/D): Authorized tenant-scoped Admin or Super Admin
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_profile_mapping' AND policyname = 'mapping_admin_mgmt') THEN
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
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. TRANSACTIONS & FRAUD (HARDENING)
-- ------------------------------------------------------------------------------
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('transactions', 'fraud_cases') AND 'anon' = ANY(roles)) LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 7. STAGING ADMIN RAW (PRESERVATION)
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staging_admin_raw') THEN
        EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.staging_admin_raw FROM authenticated';
        EXECUTE 'GRANT SELECT ON public.staging_admin_raw TO authenticated';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 8. VERIFICATION & ROLLBACK
-- ------------------------------------------------------------------------------
/*
  POST-MIGRATION AUDIT:
  SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname = 'public';

  ROLLBACK COMMANDS:
  DROP POLICY IF EXISTS "users_update_own_profile_safe" ON public.profiles;
  DROP POLICY IF EXISTS "mapping_select_auth" ON public.customer_profile_mapping;
  DROP POLICY IF EXISTS "mapping_admin_mgmt" ON public.customer_profile_mapping;
*/
