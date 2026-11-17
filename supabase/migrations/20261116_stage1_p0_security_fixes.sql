-- ==============================================================================
-- FINOVA AI — STAGE 1 P0 SECURITY & IDENTITY HARDENING MIGRATION
-- Migration ID: 20261116_stage1_p0_security_fixes
-- Status: Forward-Only, Idempotent, Non-Destructive
--
-- Fixes Applied:
-- 1. Replace broken NEW/OLD RLS policy syntax on public.profiles with valid
--    row-ownership WITH CHECK + reinforced BEFORE UPDATE privilege trigger.
-- 2. Harden public.get_auth_role() and public.get_auth_tenant() to derive
--    authoritatively from public.profiles WHERE id = auth.uid() rather than
--    mutable/shadowing top-level JWT claims ('role': 'authenticated').
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTHORITATIVE IDENTITY HELPERS (DB-FIRST, SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
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
        (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
        ''
    );
$$;

REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;

REVOKE ALL ON FUNCTION public.get_auth_tenant() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_tenant() TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. FIX INVALID PROFILE RLS POLICY (REMOVE ILLEGAL NEW/OLD REFERENCES)
-- Privilege immutability (role, tenant_id, status, tier, email, id) is enforced
-- by the BEFORE UPDATE trigger public.protect_profile_privileges().
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_update_own_profile_secure" ON public.profiles;
CREATE POLICY "users_update_own_profile_secure" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Re-affirm / harden trigger enforcing immutable security columns on self-update
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    caller_role TEXT;
    caller_tenant TEXT;
    caller_email TEXT;
    caller_status TEXT;
BEGIN
    -- Allow trusted SQL migrations / service_role sessions with no JWT UID
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Resolve caller identity authoritatively from public.profiles
    SELECT p.role::text, p.tenant_id, p.email, p.status::text
    INTO caller_role, caller_tenant, caller_email, caller_status
    FROM public.profiles p
    WHERE p.id = auth.uid();

    IF caller_role IS NULL OR caller_status <> 'Active' THEN
        RAISE EXCEPTION 'Access Denied: Unverified or inactive caller profile.';
    END IF;

    -- 1. Platform Super Admin (strictly single authorized email)
    IF caller_role = 'SUPER_ADMIN' THEN
        IF LOWER(TRIM(caller_email)) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Unverified Super Admin identity.';
        END IF;

        IF NEW.role = 'SUPER_ADMIN' AND LOWER(TRIM(NEW.email)) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Only aravindvicky629@gmail.com may hold the SUPER_ADMIN role.';
        END IF;

        RETURN NEW;
    END IF;

    -- 2. Self-updates: block privilege, tenant, status, tier, email, and ID changes
    IF auth.uid() = OLD.id THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Permission Denied: Users cannot alter their security role.';
        END IF;
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
            RAISE EXCEPTION 'Permission Denied: Users cannot alter their tenant workspace.';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Permission Denied: Users cannot modify their account status.';
        END IF;
        IF NEW.tier IS DISTINCT FROM OLD.tier THEN
            RAISE EXCEPTION 'Permission Denied: Account tier modification requires authorized staff action.';
        END IF;
        IF NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION 'Permission Denied: Email address changes require verified authentication flows.';
        END IF;
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Permission Denied: User ID cannot be modified.';
        END IF;
        RETURN NEW;
    END IF;

    -- 3. Company Admin managing subordinate tenant accounts
    IF caller_role = 'ADMIN' THEN
        IF OLD.tenant_id <> caller_tenant OR NEW.tenant_id <> OLD.tenant_id THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant profile modification is forbidden.';
        END IF;
        IF OLD.role IN ('ADMIN', 'SUPER_ADMIN') THEN
            RAISE EXCEPTION 'Access Denied: Company Admins cannot modify Admin or Super Admin accounts.';
        END IF;
        IF NEW.role NOT IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER') THEN
            RAISE EXCEPTION 'Access Denied: Company Admins may only assign FINANCE_ANALYST, SUPPORT_EXECUTIVE, or CUSTOMER roles.';
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Access Denied: Unauthorized profile modification attempt.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_privileges();
