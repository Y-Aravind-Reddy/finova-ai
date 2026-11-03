-- ==============================================================================
-- FINOVA AI — REVISED PRODUCTION SQL MIGRATION (V5.2: SECURE & AUDITED)
-- Migration ID: 20261102_finova_rls_v5_revised
-- Environment: PostgreSQL 17.11 (Supabase)
-- 
-- SECURITY OBJECTIVES:
-- 1. Resolve 42501 (Permission Denied) via explicit GRANTS.
-- 2. Prevent identity/tenant forgery in audit logs via session-based trigger.
-- 3. Protect profiles.role/tenant_id/status from unauthorized self-updates.
-- 4. Securely implement and audit aggregate functions (SECURITY INVOKER).
-- 5. Preserve customer mappings and operational policies idempotently.
-- 6. Remove anonymous access from all private tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. IDENTITY HELPERS (JWT-FIRST / SECURITY DEFINER)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    -- Check JWT claims first for performance, fall back to profiles table
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb ->> 'role',
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
    -- Check JWT claims first for performance, fall back to profiles table
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId',
        (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1),
        ''
    );
$$;

-- ------------------------------------------------------------------------------
-- 2. AUDIT LOG INTEGRITY (FORGERY PROTECTION)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.secure_audit_log_handler()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_name TEXT;
BEGIN
    -- Force actor identity from profiles (never trust user-provided values)
    SELECT name INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
    
    NEW.actor := COALESCE(v_actor_name, 'Unknown Session');
    NEW.role := public.get_auth_role();
    NEW.tenant_id := public.get_auth_tenant();
    NEW.timestamp := timezone('utc'::text, now())::text;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_secure_audit_log ON public.audit_logs;
CREATE TRIGGER trg_secure_audit_log
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.secure_audit_log_handler();

-- ------------------------------------------------------------------------------
-- 3. GLOBAL GRANTS (RESOLVING 42501)
-- ------------------------------------------------------------------------------

-- Basic Table Visibility (RLS performs actual filtering)
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT ON public.fraud_cases TO authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT SELECT ON public.kyc_records TO authenticated;
GRANT SELECT ON public.tenant_workspaces TO authenticated;
GRANT SELECT ON public.customer_profile_mapping TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

-- Operational Write Permissions
GRANT UPDATE ON public.profiles TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.kyc_records TO authenticated;

-- Sequence Usage
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Prohibit Anonymous Access (Whitelist public exchange_rates only)
REVOKE ALL ON public.profiles FROM anon, PUBLIC;
REVOKE ALL ON public.transactions FROM anon, PUBLIC;
REVOKE ALL ON public.fraud_cases FROM anon, PUBLIC;
REVOKE ALL ON public.support_tickets FROM anon, PUBLIC;
REVOKE ALL ON public.kyc_records FROM anon, PUBLIC;
REVOKE ALL ON public.audit_logs FROM anon, PUBLIC;
REVOKE ALL ON public.tenant_workspaces FROM anon, PUBLIC;
REVOKE ALL ON public.customer_profile_mapping FROM anon, PUBLIC;

-- ------------------------------------------------------------------------------
-- 4. AGGREGATE FUNCTIONS (AUDITED / SECURITY INVOKER)
-- ------------------------------------------------------------------------------

-- Audit Note: Functions use SECURITY INVOKER to respect table-level RLS.
-- Search path is locked to public, pg_temp. Tenant isolation is enforced in logic.

CREATE OR REPLACE FUNCTION public.get_transaction_aggregates(
    p_tenant_id TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT := public.get_auth_role();
    v_caller_tenant TEXT := public.get_auth_tenant();
    v_enforced_tenant TEXT;
BEGIN
    -- Authorization & Tenant Boundary
    IF v_caller_role = 'SUPER_ADMIN' THEN
        v_enforced_tenant := p_tenant_id;
    ELSIF v_caller_role IN ('ADMIN', 'FINANCE_ANALYST') THEN
        v_enforced_tenant := v_caller_tenant;
    ELSE
        RAISE EXCEPTION 'Access Denied: Role unauthorized for aggregation.';
    END IF;

    RETURN (
        SELECT jsonb_build_object(
            'totalCount', COUNT(*),
            'settledVolumeInr', COALESCE(SUM(amount_inr) FILTER (WHERE status = 'Settled'), 0),
            'source', 'supabase_rpc'
        )
        FROM public.transactions
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_user_id IS NULL OR user_id = p_user_id)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_fraud_aggregates(
    p_tenant_id TEXT DEFAULT NULL,
    p_currency TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_customer_id TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT := public.get_auth_role();
    v_caller_tenant TEXT := public.get_auth_tenant();
BEGIN
    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST') THEN
        RAISE EXCEPTION 'Access Denied: Role unauthorized for fraud surveillance.';
    END IF;

    RETURN (
        SELECT jsonb_build_object(
            'totalCases', COUNT(*),
            'flaggedCount', COUNT(*) FILTER (WHERE status = 'Flagged'),
            'frozenCount', COUNT(*) FILTER (WHERE status = 'Frozen Escrow')
        )
        FROM public.fraud_cases
        WHERE (v_caller_role = 'SUPER_ADMIN' OR tenant_id = v_caller_tenant)
          AND (p_status IS NULL OR status = p_status)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_support_aggregates(
    p_tenant_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT := public.get_auth_role();
    v_caller_tenant TEXT := public.get_auth_tenant();
BEGIN
    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT_EXECUTIVE') THEN
        RAISE EXCEPTION 'Access Denied: Role unauthorized for support metrics.';
    END IF;

    RETURN (
        SELECT jsonb_build_object(
            'totalTickets', COUNT(*),
            'openCount', COUNT(*) FILTER (WHERE status IN ('Open', 'In Progress')),
            'averageCsat', ROUND(AVG(csat_rating)::numeric, 2)
        )
        FROM public.support_tickets
        WHERE (v_caller_role = 'SUPER_ADMIN' OR tenant_id = v_caller_tenant)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_transaction_aggregates TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fraud_aggregates TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_support_aggregates TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. RLS POLICIES: CORRECTED & SHIELDED
-- ------------------------------------------------------------------------------

-- [Profiles]: Self-update shielding
DROP POLICY IF EXISTS "users_update_own_profile_secure" ON public.profiles;
CREATE POLICY "users_update_own_profile_secure" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid() AND
    NEW.role = OLD.role AND
    NEW.tenant_id = OLD.tenant_id AND
    NEW.status = OLD.status
);

-- [Fraud Cases]: Support Executive read-only clearance
DROP POLICY IF EXISTS "support_view_tenant_fraud" ON public.fraud_cases;
CREATE POLICY "support_view_tenant_fraud" ON public.fraud_cases
FOR SELECT TO authenticated
USING (
    (public.get_auth_role() = 'SUPPORT_EXECUTIVE' AND tenant_id = public.get_auth_tenant())
);

-- [Staging Admin Raw]: Quarantine
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'staging_admin_raw') THEN
        ALTER TABLE public.staging_admin_raw ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.staging_admin_raw FROM PUBLIC, anon;
        GRANT SELECT ON public.staging_admin_raw TO authenticated;
        
        DROP POLICY IF EXISTS "staging_select_quarantine" ON public.staging_admin_raw;
        EXECUTE 'CREATE POLICY "staging_select_quarantine" ON public.staging_admin_raw FOR SELECT TO authenticated 
        USING (public.get_auth_role() IN (''ADMIN'', ''SUPER_ADMIN'') AND (tenant_id = public.get_auth_tenant() OR public.get_auth_role() = ''SUPER_ADMIN''))';
    END IF;
END $$;

-- [Customer Profile Mapping]: Preservation
-- (Assumes policies mapping_select_auth and mapping_admin_mgmt from v5.1 are present and valid)

-- ------------------------------------------------------------------------------
-- 6. VERIFICATION & ROLLBACK
-- ------------------------------------------------------------------------------

-- PRE-CHECK: SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- POST-CHECK: SELECT * FROM public.audit_logs LIMIT 1; (Verify trigger application)

/* 
ROLLBACK INSTRUCTIONS:
1. DROP TRIGGER trg_secure_audit_log ON public.audit_logs;
2. DROP FUNCTION public.secure_audit_log_handler();
3. DROP POLICY "users_update_own_profile_secure" ON public.profiles;
4. RESTORE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
5. REVOKE ALL ON public.transactions, public.fraud_cases, public.support_tickets FROM authenticated; (Restore default Supabase posture if needed)
*/
