-- ==============================================================================
-- FINOVA AI — STRICT SINGLE SUPER ADMIN PROTECTION MIGRATION
-- Migration: 20261026_strict_single_super_admin.sql
-- Status: IDEMPOTENT, NON-DESTRUCTIVE, AUDITED & HARDENED
--
-- Authorized Platform Super Admin: aravindvicky629@gmail.com
--
-- CORE POLICIES ENFORCED:
-- 1. Exclusively aravindvicky629@gmail.com may hold the SUPER_ADMIN role.
-- 2. Authenticated Supabase Auth user ID and profile must match; client claims rejected.
-- 3. Public signup strictly receives CUSTOMER role and non-root tenant on backend.
-- 4. Role changes are protected: Admins cannot promote/assign SUPER_ADMIN or ADMIN.
-- 5. Users cannot modify their own profile role or tenant assignment.
-- 6. Initial provisioning is controlled via verified auth.uid() cryptographic check.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENFORCE SINGLE SUPER ADMIN TRIGGER FUNCTION ON public.profiles
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_single_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Policy 1: If role is SUPER_ADMIN, email MUST match authorized Super Admin
    IF NEW.role = 'SUPER_ADMIN' THEN
        IF LOWER(TRIM(NEW.email)) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Security Policy Violation: Only aravindvicky629@gmail.com is authorized to hold the SUPER_ADMIN role.';
        END IF;

        -- If an auth.users record exists with this profile ID, ensure its email matches
        IF NEW.id IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
            IF NOT EXISTS (
                SELECT 1 FROM auth.users 
                WHERE id = NEW.id AND LOWER(TRIM(email)) = 'aravindvicky629@gmail.com'
            ) THEN
                RAISE EXCEPTION 'Security Policy Violation: Authenticated Supabase Auth user email does not match authorized Super Admin.';
            END IF;
        END IF;

        -- Ensure Super Admin is linked exclusively to platform operator root
        NEW.tenant_id := 'platform_root';
        NEW.tenant_name := 'Finova AI SaaS Platform Operator';
    END IF;

    -- Policy 2: Ensure platform_root is reserved exclusively for SUPER_ADMIN
    IF NEW.tenant_id = 'platform_root' AND NEW.role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Security Policy Violation: Only Platform Super Admin may be assigned to the platform_root workspace.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_super_admin ON public.profiles;
CREATE TRIGGER trg_enforce_single_super_admin
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_single_super_admin();

-- ------------------------------------------------------------------------------
-- 2. HARDENED PROFILE PRIVILEGE PROTECTION (RBAC HIERARCHY)
-- ------------------------------------------------------------------------------
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
BEGIN
    -- Explicitly allow trusted internal database management / migrations without JWT context
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Look up caller's verified role, tenant, and email from database using verified auth.uid()
    SELECT role::text, tenant_id, email
    INTO caller_role, caller_tenant, caller_email
    FROM public.profiles
    WHERE id = auth.uid();

    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'Access Denied: Unverified caller identity.';
    END IF;

    -- 1. Platform Super Admin has authorization ONLY if verified as aravindvicky629@gmail.com
    IF caller_role = 'SUPER_ADMIN' THEN
        IF LOWER(TRIM(caller_email)) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Unverified Super Admin identity.';
        END IF;

        -- Super Admin cannot create/assign a second SUPER_ADMIN
        IF NEW.role = 'SUPER_ADMIN' AND LOWER(TRIM(NEW.email)) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: There can only be one Platform Super Admin (aravindvicky629@gmail.com).';
        END IF;

        RETURN NEW;
    END IF;

    -- 2. Self-updates for any user: strictly prevent self-elevation or tenant escape
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
            RAISE EXCEPTION 'Permission Denied: Email address changes must be processed through verified authentication flows.';
        END IF;
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Permission Denied: User ID cannot be modified.';
        END IF;
        RETURN NEW;
    END IF;

    -- 3. Company Admin managing other profiles within their tenant:
    IF caller_role = 'ADMIN' THEN
        -- Strictly within caller's own tenant workspace
        IF OLD.tenant_id <> caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Company Admins may only manage profiles in their own tenant workspace.';
        END IF;
        IF NEW.tenant_id <> OLD.tenant_id THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant profile reassignment is restricted to Platform Super Admin.';
        END IF;

        -- Admin CANNOT modify another ADMIN or SUPER_ADMIN
        IF OLD.role IN ('ADMIN', 'SUPER_ADMIN') THEN
            RAISE EXCEPTION 'Access Denied: Company Admins cannot modify Admin or Super Admin accounts.';
        END IF;

        -- Admin CANNOT promote anyone to ADMIN or SUPER_ADMIN
        IF NEW.role NOT IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER') THEN
            RAISE EXCEPTION 'Access Denied: Company Admins may only assign FINANCE_ANALYST, SUPPORT_EXECUTIVE, or CUSTOMER roles.';
        END IF;

        RETURN NEW;
    END IF;

    -- 4. Standard roles (CUSTOMER, FINANCE_ANALYST, SUPPORT_EXECUTIVE) cannot modify other profiles
    RAISE EXCEPTION 'Access Denied: Unauthorized profile modification attempt.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_privileges();

-- ------------------------------------------------------------------------------
-- 3. SECURE PUBLIC SIGNUP TRIGGER ON auth.users
-- Always assigns CUSTOMER role; rejects platform_root tenant selection.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    requested_tenant TEXT;
    valid_tenant_id TEXT;
    valid_tenant_name TEXT;
    clean_name TEXT;
    clean_phone TEXT;
BEGIN
    -- Extract requested tenant from raw user metadata (untrusted input)
    requested_tenant := TRIM(new.raw_user_meta_data->>'tenant_id');

    -- Never allow public registration into platform_root!
    IF requested_tenant = 'platform_root' OR requested_tenant IS NULL OR requested_tenant = '' THEN
        requested_tenant := 'tenant_apex_bank';
    END IF;

    -- Validate tenant existence and active status in public.tenant_workspaces (excluding platform_root)
    SELECT id, name INTO valid_tenant_id, valid_tenant_name
    FROM public.tenant_workspaces
    WHERE id = requested_tenant AND status = 'Active' AND id <> 'platform_root';

    -- Safe fallback to default active workspace if invalid or not provided
    IF valid_tenant_id IS NULL THEN
        SELECT id, name INTO valid_tenant_id, valid_tenant_name
        FROM public.tenant_workspaces
        WHERE id = 'tenant_apex_bank';

        IF valid_tenant_id IS NULL THEN
            SELECT id, name INTO valid_tenant_id, valid_tenant_name
            FROM public.tenant_workspaces
            WHERE status = 'Active' AND id <> 'platform_root'
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;
    END IF;

    clean_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        split_part(new.email, '@', 1)
    );
    clean_phone := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'phone'), ''),
        '+1 (212) 555-0100'
    );

    -- Public signups STRICTLY receive 'CUSTOMER' role on trusted backend
    -- Any client-supplied 'role' in raw_user_meta_data is completely ignored
    INSERT INTO public.profiles (
        id,
        email,
        name,
        role,
        status,
        tier,
        phone,
        country,
        two_factor_enabled,
        tenant_id,
        tenant_name,
        created_at,
        updated_at
    ) VALUES (
        new.id,
        new.email,
        clean_name,
        'CUSTOMER'::public.user_role_type,
        'Active'::public.user_status_type,
        'Private Wealth Tier 3',
        clean_phone,
        COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'country'), ''), 'United States'),
        true,
        valid_tenant_id,
        valid_tenant_name,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(public.profiles.name, EXCLUDED.name),
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 4. CONTROLLED INITIAL PROVISIONING RPC
-- Cryptographically verifies authenticated auth.uid() against auth.users.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_authorized_super_admin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    caller_id UUID;
    caller_email TEXT;
    profile_record RECORD;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Access Denied: Authentication required.';
    END IF;

    -- Look up caller's cryptographically verified email from auth.users
    SELECT email INTO caller_email
    FROM auth.users
    WHERE id = caller_id;

    IF caller_email IS NULL OR LOWER(TRIM(caller_email)) <> 'aravindvicky629@gmail.com' THEN
        RAISE EXCEPTION 'Access Denied: Only the verified owner of aravindvicky629@gmail.com is authorized to provision Super Admin.';
    END IF;

    -- Upsert profile for this verified user ID
    INSERT INTO public.profiles (
        id,
        email,
        name,
        role,
        status,
        tier,
        phone,
        country,
        two_factor_enabled,
        tenant_id,
        tenant_name,
        notes,
        created_at,
        updated_at
    ) VALUES (
        caller_id,
        caller_email,
        'Aravind Vicky',
        'SUPER_ADMIN'::public.user_role_type,
        'Active'::public.user_status_type,
        'Executive Staff',
        '+1 (212) 555-0190',
        'United States',
        true,
        'platform_root',
        'Finova AI SaaS Platform Operator',
        'Authorized Platform Super Admin Provisioned via Verified Supabase Auth UID',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'SUPER_ADMIN'::public.user_role_type,
        tenant_id = 'platform_root',
        tenant_name = 'Finova AI SaaS Platform Operator',
        tier = 'Executive Staff',
        status = 'Active'::public.user_status_type,
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO profile_record;

    -- Immutable audit log recording provisioning
    INSERT INTO public.audit_logs (
        id,
        action,
        actor,
        role,
        target,
        status,
        timestamp,
        tenant_id,
        ip_address
    ) VALUES (
        'AUD-PROV-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
        'SUPER_ADMIN_INITIAL_PROVISIONING',
        caller_email,
        'SUPER_ADMIN',
        'Platform Operator Root (' || caller_id::text || ')',
        'Authorized',
        timezone('utc'::text, now()),
        'platform_root',
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'success', true,
        'userId', caller_id,
        'email', caller_email,
        'role', 'SUPER_ADMIN',
        'tenant_id', 'platform_root',
        'message', 'Super Admin profile successfully provisioned for verified UID.'
    );
END;
$$;

-- Grant EXECUTE strictly to authenticated users (rejected for anonymous public)
REVOKE EXECUTE ON FUNCTION public.provision_authorized_super_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.provision_authorized_super_admin() TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. AUDIT FUNCTION FOR SUPER ADMIN ASSIGNMENTS (READ-ONLY REVIEW REPORT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_super_admin_assignments()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role TEXT,
    tenant_id TEXT,
    is_authorized BOOLEAN,
    action_required TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        p.id AS user_id,
        p.email,
        p.role::text,
        p.tenant_id,
        (LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com') AS is_authorized,
        CASE 
            WHEN LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com' THEN 'AUTHORIZED_SUPER_ADMIN'
            ELSE 'ROLE_MISMATCH_REQUIRES_REVIEW'
        END AS action_required
    FROM public.profiles p
    WHERE p.role = 'SUPER_ADMIN';
$$;

-- Grant EXECUTE to authenticated users
GRANT EXECUTE ON FUNCTION public.audit_super_admin_assignments() TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. DIRECT DATABASE PROVISIONING BLOCK FOR DATABASE ADMINISTRATOR
-- (Idempotent: Executes safely if aravindvicky629@gmail.com is present in auth.users)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_target_uid UUID;
BEGIN
    SELECT id INTO v_target_uid
    FROM auth.users
    WHERE LOWER(TRIM(email)) = 'aravindvicky629@gmail.com'
    LIMIT 1;

    IF v_target_uid IS NOT NULL THEN
        INSERT INTO public.profiles (
            id,
            email,
            name,
            role,
            status,
            tier,
            phone,
            country,
            two_factor_enabled,
            tenant_id,
            tenant_name,
            notes,
            created_at,
            updated_at
        ) VALUES (
            v_target_uid,
            'aravindvicky629@gmail.com',
            'Aravind Vicky',
            'SUPER_ADMIN'::public.user_role_type,
            'Active'::public.user_status_type,
            'Executive Staff',
            '+1 (212) 555-0190',
            'United States',
            true,
            'platform_root',
            'Finova AI SaaS Platform Operator',
            'Authorized Platform Super Admin Provisioned via Verified Auth UID',
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        )
        ON CONFLICT (id) DO UPDATE SET
            role = 'SUPER_ADMIN'::public.user_role_type,
            tenant_id = 'platform_root',
            tenant_name = 'Finova AI SaaS Platform Operator',
            tier = 'Executive Staff',
            status = 'Active'::public.user_status_type,
            updated_at = timezone('utc'::text, now());
    END IF;
END $$;
