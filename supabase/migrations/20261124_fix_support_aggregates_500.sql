-- ==============================================================================
-- FINOVA AI — SUPPORT AGGREGATES HTTP 500 HOTFIX & RLS RECONCILIATION
-- Migration ID: 20261124_fix_support_aggregates_500
-- Status: Forward-Only, Idempotent, Non-Destructive (Zero DROP TABLE)
--
-- Root Causes Remediated:
-- 1. Statement timeout (57014 -> HTTP 500) from 4 separate unindexed full scans
--    of public.support_tickets compounded by legacy non-InitPlan RLS policies.
-- 2. Numeric precision overflow (22003 -> HTTP 500) on v_average_csat NUMERIC(3,2)
--    / NUMERIC(4,2) when non-normalized CSAT values exist.
-- 3. Schema/type drift (42703 / 42883 / 42804 / 22P02 -> HTTP 500) if any
--    support_tickets columns are missing, enum-typed, or text-typed.
-- 4. Correlated outer aggregate reference (ct.total_cnt inside jsonb_agg).
-- 5. Residual legacy RLS policies & missing authenticated table grants on
--    public.support_tickets (42501 / slow per-row RLS helper calls).
-- 6. Cross-tenant customer policy hardening on customer_own_tickets.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NON-DESTRUCTIVE SCHEMA READINESS & COVERING INDEXES
-- ------------------------------------------------------------------------------
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General Inquiry';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Medium';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Open';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_executive TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS sla_target_hours INT NOT NULL DEFAULT 4;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS hours_open INT NOT NULL DEFAULT 1;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS csat_rating INT;

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_status_opened
    ON public.support_tickets (tenant_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_tenant
    ON public.support_tickets (user_id, tenant_id);

-- ------------------------------------------------------------------------------
-- 2. TABLE GRANTS & COMPLETE LEGACY POLICY RECONCILIATION
--    Removes all legacy per-row policies (from pre-InitPlan migrations) and
--    rebuilds minimal, tenant-isolated, InitPlan-wrapped policies.
-- ------------------------------------------------------------------------------
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.support_tickets FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_tickets TO authenticated;
GRANT ALL ON TABLE public.support_tickets TO service_role;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'support_tickets'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.support_tickets', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "super_admin_all_tickets" ON public.support_tickets
    FOR ALL
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) = 'SUPER_ADMIN'
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.role::text = 'SUPER_ADMIN'
              AND p.status::text = 'Active'
              AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
        )
    )
    WITH CHECK (
        (SELECT public.get_auth_role()) = 'SUPER_ADMIN'
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.role::text = 'SUPER_ADMIN'
              AND p.status::text = 'Active'
              AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
        )
    );

CREATE POLICY "staff_manage_tenant_tickets" ON public.support_tickets
    FOR ALL
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) IN ('ADMIN', 'SUPPORT_EXECUTIVE')
        AND tenant_id = (SELECT public.get_auth_tenant())
    )
    WITH CHECK (
        (SELECT public.get_auth_role()) IN ('ADMIN', 'SUPPORT_EXECUTIVE')
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

CREATE POLICY "customer_own_tickets" ON public.support_tickets
    FOR ALL
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        AND tenant_id = (SELECT public.get_auth_tenant())
    )
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

-- ------------------------------------------------------------------------------
-- 3. HARDENED SINGLE-PASS PUBLIC.GET_SUPPORT_AGGREGATES(p_tenant_id TEXT)
--    - SECURITY INVOKER (respects RLS) & STABLE
--    - Explicit SQLSTATE 42501 on all auth/role/tenant denials
--    - Type-safe coercions, widened NUMERIC(10, 2) precision, zero correlation bugs
--    - Preserves exact canonical camelCase JSONB return contract
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_support_aggregates(TEXT);

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
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_tenant TEXT;
    v_caller_email TEXT;
    v_caller_status TEXT;
    v_enforced_tenant TEXT;

    v_total_tickets INT := 0;
    v_open_count INT := 0;
    v_closed_count INT := 0;
    v_in_progress_count INT := 0;
    v_pending_client_count INT := 0;
    v_sla_compliance_pct NUMERIC(6, 1) := 0.0;
    v_average_csat NUMERIC(10, 2) := 0.00;
    v_priority_dist JSONB := '[]'::jsonb;
    v_category_dist JSONB := '[]'::jsonb;
    v_executive_workload JSONB := '[]'::jsonb;
BEGIN
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required for support aggregation.' USING ERRCODE = '42501';
    END IF;

    IF (auth.jwt() ->> 'role') = 'service_role' THEN
        v_caller_role := 'SUPER_ADMIN';
        v_caller_tenant := 'platform_root';
        v_caller_email := 'service_role@finova.internal';
        v_caller_status := 'Active';
    ELSE
        SELECT role::text, tenant_id, email, status::text
        INTO v_caller_role, v_caller_tenant, v_caller_email, v_caller_status
        FROM public.profiles
        WHERE id = v_caller_id;

        IF v_caller_role IS NULL OR v_caller_status <> 'Active' THEN
            RAISE EXCEPTION 'Access Denied: Unverified or inactive caller profile.' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT_EXECUTIVE') THEN
        RAISE EXCEPTION 'Access Denied: Role "%" is unauthorized for support operational metrics.', v_caller_role USING ERRCODE = '42501';
    END IF;

    IF v_caller_role = 'SUPER_ADMIN' THEN
        IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
           AND LOWER(TRIM(COALESCE(v_caller_email, ''))) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Unverified Super Admin identity.' USING ERRCODE = '42501';
        END IF;

        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL;
        END IF;
    ELSE
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant support telemetry access violation.' USING ERRCODE = '42501';
        END IF;
        v_enforced_tenant := v_caller_tenant;
    END IF;

    WITH base_tickets AS MATERIALIZED (
        SELECT
            UPPER(COALESCE(NULLIF(TRIM(status::text), ''), 'OPEN')) AS status_upper,
            COALESCE(NULLIF(TRIM(priority::text), ''), 'Medium') AS priority,
            COALESCE(NULLIF(TRIM(category::text), ''), 'General Inquiry') AS category,
            COALESCE(NULLIF(TRIM(assigned_executive::text), ''), 'Unassigned Desk') AS executive,
            (
                CASE
                    WHEN hours_open IS NOT NULL AND hours_open::text ~ '^\s*-?\d+(\.\d+)?\s*$'
                    THEN hours_open::text::numeric
                    ELSE 0
                END
                <=
                CASE
                    WHEN sla_target_hours IS NOT NULL AND sla_target_hours::text ~ '^\s*-?\d+(\.\d+)?\s*$'
                    THEN sla_target_hours::text::numeric
                    ELSE 4
                END
            ) AS is_sla_compliant,
            CASE
                WHEN csat_rating IS NOT NULL AND csat_rating::text ~ '^\s*\d+(\.\d+)?\s*$'
                THEN csat_rating::text::numeric
                ELSE NULL
            END AS csat_numeric
        FROM public.support_tickets
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
    ),
    core_totals AS (
        SELECT
            COUNT(*)::int AS total_cnt,
            COUNT(*) FILTER (WHERE status_upper NOT IN ('RESOLVED', 'CLOSED'))::int AS open_cnt,
            COUNT(*) FILTER (WHERE status_upper IN ('RESOLVED', 'CLOSED'))::int AS closed_cnt,
            COUNT(*) FILTER (WHERE status_upper IN ('IN PROGRESS', 'IN_PROGRESS'))::int AS in_prog_cnt,
            COUNT(*) FILTER (WHERE status_upper IN ('PENDING CLIENT', 'PENDING_CLIENT'))::int AS pend_cnt,
            COALESCE(ROUND(AVG(CASE WHEN is_sla_compliant THEN 100.0 ELSE 0.0 END), 1), 0.0) AS sla_pct,
            COALESCE(ROUND(AVG(csat_numeric) FILTER (WHERE csat_numeric IS NOT NULL AND csat_numeric > 0), 2), 0.00) AS avg_csat
        FROM base_tickets
    )
    SELECT
        ct.total_cnt,
        ct.open_cnt,
        ct.closed_cnt,
        ct.in_prog_cnt,
        ct.pend_cnt,
        ct.sla_pct,
        ct.avg_csat,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object('priority', p.priority, 'count', p.cnt)
                ORDER BY CASE p.priority
                    WHEN 'Urgent' THEN 1
                    WHEN 'High' THEN 2
                    WHEN 'Medium' THEN 3
                    WHEN 'Low' THEN 4
                    ELSE 5
                END
            )
            FROM (
                SELECT priority, COUNT(*)::int AS cnt
                FROM base_tickets
                GROUP BY priority
            ) p),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'category', c.category,
                    'count', c.cnt,
                    'percentage', CASE WHEN c.grand_total > 0 THEN ROUND(c.cnt * 100.0 / c.grand_total, 1) ELSE 0.0 END
                )
                ORDER BY c.cnt DESC
            )
            FROM (
                SELECT
                    category,
                    COUNT(*)::int AS cnt,
                    SUM(COUNT(*)) OVER () AS grand_total
                FROM base_tickets
                GROUP BY category
            ) c),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'executive', e.executive,
                    'activeTickets', e.active_tickets,
                    'resolvedTickets', e.resolved_tickets
                )
                ORDER BY e.active_tickets DESC
            )
            FROM (
                SELECT
                    executive,
                    COUNT(*) FILTER (WHERE status_upper NOT IN ('RESOLVED', 'CLOSED'))::int AS active_tickets,
                    COUNT(*) FILTER (WHERE status_upper IN ('RESOLVED', 'CLOSED'))::int AS resolved_tickets
                FROM base_tickets
                GROUP BY executive
            ) e),
            '[]'::jsonb
        )
    INTO
        v_total_tickets,
        v_open_count,
        v_closed_count,
        v_in_progress_count,
        v_pending_client_count,
        v_sla_compliance_pct,
        v_average_csat,
        v_priority_dist,
        v_category_dist,
        v_executive_workload
    FROM core_totals ct;

    RETURN jsonb_build_object(
        'totalTickets', COALESCE(v_total_tickets, 0),
        'openCount', COALESCE(v_open_count, 0),
        'closedCount', COALESCE(v_closed_count, 0),
        'inProgressCount', COALESCE(v_in_progress_count, 0),
        'pendingClientCount', COALESCE(v_pending_client_count, 0),
        'priorityDistribution', COALESCE(v_priority_dist, '[]'::jsonb),
        'categoryDistribution', COALESCE(v_category_dist, '[]'::jsonb),
        'executiveWorkload', COALESCE(v_executive_workload, '[]'::jsonb),
        'slaCompliancePct', COALESCE(v_sla_compliance_pct, 0.0),
        'averageCsat', COALESCE(v_average_csat, 0.00),
        'tenantScope', COALESCE(v_enforced_tenant, 'GLOBAL_ALL_TENANTS'),
        'callerRole', v_caller_role,
        'source', 'supabase_rpc_secure'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_aggregates(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_aggregates(TEXT) TO authenticated, service_role;
