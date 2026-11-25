-- ==============================================================================
-- FINOVA AI — P1 CRITICAL SUPPORT & FRAUD RPC TIMEOUT REMEDIATION
-- Migration ID: 20261126_p1_support_fraud_timeout_remediation
-- Target Project Ref: rjudrmnnpwlovpkbwnte
-- Status: Forward-Only, Idempotent, Non-Destructive (Zero DROP TABLE, Zero RLS Disable)
--
-- Addresses Confirmed Production Timeouts:
--   1. get_support_aggregates (SQLSTATE 57014, 8,379 ms, scope=tenant_apex_bank, range=ALL)
--   2. get_fraud_aggregates   (SQLSTATE 57014, 8,197 ms, scope=tenant_apex_bank, range=328d)
--
-- Remediation Summary:
-- 1. Adds bounded optional UTC date parameters (p_start_date, p_end_date) to
--    public.get_support_aggregates while maintaining full-history support when
--    explicitly requested (NULL dates), replacing the legacy 1-arg signature.
-- 2. Adds covering composite indexes aligned directly with the active predicates
--    and projections of both RPCs:
--      - support_tickets (tenant_id, opened_at DESC) INCLUDE (...)
--      - support_tickets (opened_at DESC) INCLUDE (...)
--      - fraud_cases (tenant_id, timestamp DESC) INCLUDE (...)
--      - fraud_cases (timestamp DESC) INCLUDE (...)
-- 3. Ensures pg_policies legacy policy cleanup + InitPlan RLS policies on
--    support_tickets and fraud_cases (self-contained even if prior hotfixes
--    were not yet applied).
-- 4. Streams single-pass GROUPING SETS in both RPCs with materialized FX
--    lookup (skipping FX join on INR rows) and pre-bucketed status/risk flags.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TARGETED EVIDENCE-BACKED INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_opened_cover
    ON public.support_tickets (tenant_id, opened_at DESC)
    INCLUDE (status, priority, category, assigned_executive, hours_open, sla_target_hours, csat_rating);

CREATE INDEX IF NOT EXISTS idx_support_tickets_opened_cover
    ON public.support_tickets (opened_at DESC)
    INCLUDE (status, priority, category, assigned_executive, hours_open, sla_target_hours, csat_rating);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_tenant_ts_cover
    ON public.fraud_cases (tenant_id, timestamp DESC)
    INCLUDE (status, amount, amount_inr, currency, exchange_rate, risk_score, payment_channel, rule_triggered, customer_id);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_ts_cover
    ON public.fraud_cases (timestamp DESC)
    INCLUDE (status, amount, amount_inr, currency, exchange_rate, risk_score, payment_channel, rule_triggered, customer_id);

CREATE INDEX IF NOT EXISTS idx_profiles_id_status_role_tenant
    ON public.profiles (id, status, role, tenant_id);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_inr_target_date
    ON public.exchange_rates (target_currency, effective_date DESC)
    WHERE base_currency = 'INR' AND rate > 0;

-- ------------------------------------------------------------------------------
-- 2. SELF-CONTAINED INITPLAN RLS RECONCILIATION (SUPPORT_TICKETS & FRAUD_CASES)
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

ALTER TABLE public.fraud_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.fraud_cases FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON TABLE public.fraud_cases TO authenticated;
GRANT ALL ON TABLE public.fraud_cases TO service_role;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'fraud_cases'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.fraud_cases', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "super_admin_all_fraud" ON public.fraud_cases
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

CREATE POLICY "staff_tenant_fraud_select" ON public.fraud_cases
    FOR SELECT
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

CREATE POLICY "staff_tenant_fraud_update" ON public.fraud_cases
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = (SELECT public.get_auth_tenant())
    )
    WITH CHECK (
        (SELECT public.get_auth_role()) IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

-- ------------------------------------------------------------------------------
-- 3. PUBLIC.GET_SUPPORT_AGGREGATES WITH BOUNDED DATE WINDOW SUPPORT
--    Drops legacy 1-arg signature to prevent PostgREST overload ambiguity.
--    Default NULL dates remain compatible with explicit full-history inspection,
--    while dashboard/service callers pass bounded windows (e.g. 90D / YTD).
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_support_aggregates(TEXT);
DROP FUNCTION IF EXISTS public.get_support_aggregates(TEXT, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_support_aggregates(
    p_tenant_id TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
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
        RAISE EXCEPTION 'Access Denied: Authentication required for support aggregation.'
            USING ERRCODE = '42501';
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
            RAISE EXCEPTION 'Access Denied: Unverified or inactive caller profile.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT_EXECUTIVE') THEN
        RAISE EXCEPTION 'Access Denied: Role "%" is unauthorized for support operational metrics.', v_caller_role
            USING ERRCODE = '42501';
    END IF;

    IF v_caller_role = 'SUPER_ADMIN' THEN
        IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
           AND LOWER(TRIM(COALESCE(v_caller_email, ''))) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Unverified Super Admin identity.'
                USING ERRCODE = '42501';
        END IF;

        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL;
        END IF;
    ELSE
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant support telemetry access violation.'
                USING ERRCODE = '42501';
        END IF;
        v_enforced_tenant := v_caller_tenant;
    END IF;

    WITH base_tickets AS (
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
          AND (p_start_date IS NULL OR opened_at >= (p_start_date::timestamp AT TIME ZONE 'UTC'))
          AND (p_end_date IS NULL OR opened_at < ((p_end_date + 1)::timestamp AT TIME ZONE 'UTC'))
    ),
    grouped_support AS MATERIALIZED (
        SELECT
            (GROUPING(priority) = 1 AND GROUPING(category) = 1 AND GROUPING(executive) = 1) AS is_total,
            (GROUPING(priority) = 0) AS is_prio,
            (GROUPING(category) = 0) AS is_cat,
            (GROUPING(executive) = 0) AS is_exec,
            priority,
            category,
            executive,
            COUNT(*)::int AS cnt,
            COUNT(*) FILTER (WHERE status_upper NOT IN ('RESOLVED', 'CLOSED'))::int AS open_cnt,
            COUNT(*) FILTER (WHERE status_upper IN ('RESOLVED', 'CLOSED'))::int AS closed_cnt,
            COUNT(*) FILTER (WHERE status_upper IN ('IN PROGRESS', 'IN_PROGRESS'))::int AS in_prog_cnt,
            COUNT(*) FILTER (WHERE status_upper IN ('PENDING CLIENT', 'PENDING_CLIENT'))::int AS pend_cnt,
            COALESCE(ROUND(AVG(CASE WHEN is_sla_compliant THEN 100.0 ELSE 0.0 END), 1), 0.0) AS sla_pct,
            COALESCE(ROUND(AVG(csat_numeric) FILTER (WHERE csat_numeric IS NOT NULL AND csat_numeric > 0), 2), 0.00) AS avg_csat
        FROM base_tickets
        GROUP BY GROUPING SETS ((), (priority), (category), (executive))
    )
    SELECT
        ct.cnt,
        ct.open_cnt,
        ct.closed_cnt,
        ct.in_prog_cnt,
        ct.pend_cnt,
        ct.sla_pct,
        ct.avg_csat,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object('priority', g.priority, 'count', g.cnt)
                ORDER BY CASE g.priority
                    WHEN 'Urgent' THEN 1
                    WHEN 'High' THEN 2
                    WHEN 'Medium' THEN 3
                    WHEN 'Low' THEN 4
                    ELSE 5
                END
            )
            FROM grouped_support g
            WHERE g.is_prio),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'category', g.category,
                    'count', g.cnt,
                    'percentage', CASE WHEN ct.cnt > 0 THEN ROUND(g.cnt * 100.0 / ct.cnt, 1) ELSE 0.0 END
                )
                ORDER BY g.cnt DESC
            )
            FROM grouped_support g
            WHERE g.is_cat),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'executive', g.executive,
                    'activeTickets', g.open_cnt,
                    'resolvedTickets', g.closed_cnt
                )
                ORDER BY g.open_cnt DESC
            )
            FROM grouped_support g
            WHERE g.is_exec),
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
    FROM grouped_support ct
    WHERE ct.is_total;

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

REVOKE ALL ON FUNCTION public.get_support_aggregates(TEXT, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_aggregates(TEXT, DATE, DATE) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. OPTIMIZED PUBLIC.GET_FRAUD_AGGREGATES FOR BOUNDED YTD (328D+) SCANS
--    - Single streaming scan with covering (tenant_id, timestamp DESC) index
--    - Materialized small FX lookup (skipped for INR rows)
--    - Pre-classified integer status_bucket & risk_sort to eliminate repeated
--      LIKE / UPPER evaluations across GROUPING SETS filters
-- ------------------------------------------------------------------------------
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
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_tenant TEXT;
    v_caller_email TEXT;
    v_caller_status TEXT;
    v_enforced_tenant TEXT;

    v_total_cases INT := 0;
    v_flagged_count INT := 0;
    v_frozen_count INT := 0;
    v_cleared_count INT := 0;
    v_prevented_volume_inr NUMERIC(18, 2) := 0.00;
    v_prevented_volume_usd NUMERIC(18, 2) := 0.00;
    v_prevented_volume_original NUMERIC(18, 2) := 0.00;
    v_monitored_volume_inr NUMERIC(18, 2) := 0.00;
    v_monitored_volume_usd NUMERIC(18, 2) := 0.00;
    v_unconverted_cases INT := 0;

    v_usd_rate NUMERIC(12, 6) := 84.070000;
    v_volume_by_currency JSONB := '{}'::jsonb;
    v_risk_tier_dist JSONB := '[]'::jsonb;
    v_channel_dist JSONB := '[]'::jsonb;
    v_rule_dist JSONB := '[]'::jsonb;
    v_cases_by_day JSONB := '[]'::jsonb;
BEGIN
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required to execute fraud surveillance aggregation.'
            USING ERRCODE = '42501';
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
            RAISE EXCEPTION 'Access Denied: Unverified or inactive caller profile.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST') THEN
        RAISE EXCEPTION 'Access Denied: Role "%" is prohibited from fraud surveillance analytics.', v_caller_role
            USING ERRCODE = '42501';
    END IF;

    IF v_caller_role = 'SUPER_ADMIN' THEN
        IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
           AND LOWER(TRIM(COALESCE(v_caller_email, ''))) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Unverified Super Admin identity.'
                USING ERRCODE = '42501';
        END IF;

        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL;
        END IF;
    ELSE
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant fraud analytics violation. Caller belongs to "%", attempted "%".', v_caller_tenant, p_tenant_id
                USING ERRCODE = '42501';
        END IF;
        v_enforced_tenant := v_caller_tenant;
    END IF;

    SELECT COALESCE(
        (SELECT rate FROM public.exchange_rates
         WHERE base_currency = 'INR' AND target_currency = 'USD' AND rate > 0
         ORDER BY effective_date DESC LIMIT 1),
        84.070000
    ) INTO v_usd_rate;

    WITH latest_fx AS MATERIALIZED (
        SELECT DISTINCT ON (target_currency)
            target_currency,
            rate,
            effective_date
        FROM public.exchange_rates
        WHERE base_currency = 'INR'
          AND rate > 0
        ORDER BY target_currency, effective_date DESC
    ),
    base_fraud AS (
        SELECT
            CASE
                WHEN UPPER(COALESCE(fc.status, '')) LIKE '%FROZEN%'
                  OR UPPER(COALESCE(fc.status, '')) LIKE '%PREVENT%'
                  OR UPPER(COALESCE(fc.status, '')) LIKE '%BLOCK%'
                  OR UPPER(COALESCE(fc.status, '')) = 'CONFIRMED' THEN 2::smallint
                WHEN UPPER(COALESCE(fc.status, '')) LIKE '%FLAG%'
                  OR UPPER(COALESCE(fc.status, '')) LIKE '%REVIEW%'
                  OR UPPER(COALESCE(fc.status, '')) = 'OPEN' THEN 1::smallint
                WHEN UPPER(COALESCE(fc.status, '')) LIKE '%CLEAR%'
                  OR UPPER(COALESCE(fc.status, '')) = 'FALSE_POSITIVE' THEN 3::smallint
                ELSE 0::smallint
            END AS status_bucket,
            fc.amount,
            CASE
                WHEN COALESCE(fc.risk_score, 0) >= 80 THEN 1::smallint
                WHEN COALESCE(fc.risk_score, 0) >= 50 THEN 2::smallint
                ELSE 3::smallint
            END AS risk_sort,
            COALESCE(NULLIF(TRIM(fc.payment_channel), ''), 'SWIFT GPI Cross-Border') AS payment_channel,
            COALESCE(NULLIF(TRIM(fc.rule_triggered), ''), 'Surveillance Rule Triggered') AS rule_triggered,
            (fc.timestamp AT TIME ZONE 'UTC')::date AS case_date,
            COALESCE(NULLIF(TRIM(fc.currency), ''), 'UNVERIFIED') AS currency,
            CASE
                WHEN fc.amount_inr IS NOT NULL AND fc.amount_inr >= 0 THEN fc.amount_inr
                WHEN NULLIF(TRIM(fc.currency), '') = 'INR' THEN fc.amount
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN ROUND(fc.amount * fc.exchange_rate, 2)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(fc.amount * fx.rate, 2)
                ELSE NULL
            END AS calc_inr,
            CASE
                WHEN NULLIF(TRIM(fc.currency), '') = 'INR' THEN 1.000000
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN fc.exchange_rate
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                ELSE NULL
            END AS eff_rate,
            fx.effective_date AS eff_date,
            (
                NULLIF(TRIM(fc.currency), '') = 'INR'
                OR (fc.amount_inr IS NOT NULL AND fc.amount_inr >= 0)
                OR (fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0)
                OR (fx.rate IS NOT NULL AND fx.rate > 0)
            ) AS conv_flag
        FROM public.fraud_cases fc
        LEFT JOIN latest_fx fx
          ON NULLIF(TRIM(fc.currency), '') IS NOT NULL
         AND TRIM(fc.currency) <> 'INR'
         AND fx.target_currency = TRIM(fc.currency)
        WHERE (v_enforced_tenant IS NULL OR fc.tenant_id = v_enforced_tenant)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR fc.currency = p_currency)
          AND (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR fc.status = p_status)
          AND (p_customer_id IS NULL OR p_customer_id = '' OR fc.customer_id = p_customer_id)
          AND (p_start_date IS NULL OR fc.timestamp >= (p_start_date::timestamp AT TIME ZONE 'UTC'))
          AND (p_end_date IS NULL OR fc.timestamp < ((p_end_date + 1)::timestamp AT TIME ZONE 'UTC'))
    ),
    grouped_fraud AS MATERIALIZED (
        SELECT
            (GROUPING(currency) = 1 AND GROUPING(risk_sort) = 1 AND GROUPING(payment_channel) = 1 AND GROUPING(rule_triggered) = 1 AND GROUPING(case_date) = 1) AS is_total,
            (GROUPING(currency) = 0) AS is_curr,
            (GROUPING(risk_sort) = 0) AS is_tier,
            (GROUPING(payment_channel) = 0) AS is_chan,
            (GROUPING(rule_triggered) = 0) AS is_rule,
            (GROUPING(case_date) = 0) AS is_day,
            currency,
            risk_sort,
            payment_channel,
            rule_triggered,
            case_date,
            COUNT(*)::int AS cnt,
            COUNT(*) FILTER (WHERE status_bucket = 1)::int AS flagged_cnt,
            COUNT(*) FILTER (WHERE status_bucket = 2)::int AS frozen_cnt,
            COUNT(*) FILTER (WHERE status_bucket = 3)::int AS cleared_cnt,
            COALESCE(SUM(calc_inr) FILTER (WHERE status_bucket = 2 AND conv_flag), 0.00) AS prevented_inr,
            COALESCE(SUM(amount) FILTER (WHERE status_bucket = 2), 0.00) AS prevented_orig,
            COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00) AS monitored_inr,
            ROUND(SUM(amount), 2) AS orig_sum,
            ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00), 2) AS inr_sum,
            ROUND(AVG(eff_rate) FILTER (WHERE conv_flag), 6) AS avg_rate,
            MAX(eff_date) AS max_eff_date,
            COUNT(*) FILTER (WHERE NOT conv_flag)::int AS unconv_cnt
        FROM base_fraud
        GROUP BY GROUPING SETS ((), (currency), (risk_sort), (payment_channel), (rule_triggered), (case_date))
    )
    SELECT
        ct.cnt,
        ct.flagged_cnt,
        ct.frozen_cnt,
        ct.cleared_cnt,
        ct.prevented_inr,
        ct.prevented_orig,
        ct.monitored_inr,
        ct.unconv_cnt,
        COALESCE(
            (SELECT jsonb_object_agg(
                g.currency,
                jsonb_build_object(
                    'original', g.orig_sum,
                    'inr', g.inr_sum,
                    'usd', ROUND(g.inr_sum / v_usd_rate, 2),
                    'rate', COALESCE(g.avg_rate, 0),
                    'effectiveDate', COALESCE(g.max_eff_date::text, CURRENT_DATE::text),
                    'isConverted', (g.unconv_cnt = 0),
                    'unconvertedCount', g.unconv_cnt
                )
            )
            FROM grouped_fraud g
            WHERE g.is_curr),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'tier', CASE g.risk_sort
                        WHEN 1 THEN 'Critical Anomaly (Risk >= 80)'
                        WHEN 2 THEN 'High Threat (Risk 50-79)'
                        ELSE 'Nominal Surveillance (< 50)'
                    END,
                    'count', g.cnt,
                    'volumeInr', ROUND(g.inr_sum, 0)
                )
                ORDER BY g.risk_sort
            )
            FROM grouped_fraud g
            WHERE g.is_tier),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('channel', g.payment_channel, 'count', g.cnt, 'volumeInr', ROUND(g.inr_sum, 0)) ORDER BY g.inr_sum DESC)
             FROM grouped_fraud g
             WHERE g.is_chan),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('rule', r.rule_triggered, 'count', r.cnt) ORDER BY r.cnt DESC)
             FROM (
                 SELECT rule_triggered, cnt
                 FROM grouped_fraud
                 WHERE is_rule
                 ORDER BY cnt DESC
                 LIMIT 10
             ) r),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('date', d.case_date::text, 'count', d.cnt, 'preventedInr', ROUND(d.prevented_inr, 0)) ORDER BY d.case_date ASC)
             FROM (
                 SELECT case_date, cnt, prevented_inr
                 FROM grouped_fraud
                 WHERE is_day AND case_date IS NOT NULL
                 ORDER BY case_date DESC
                 LIMIT 30
             ) d),
            '[]'::jsonb
        )
    INTO
        v_total_cases,
        v_flagged_count,
        v_frozen_count,
        v_cleared_count,
        v_prevented_volume_inr,
        v_prevented_volume_original,
        v_monitored_volume_inr,
        v_unconverted_cases,
        v_volume_by_currency,
        v_risk_tier_dist,
        v_channel_dist,
        v_rule_dist,
        v_cases_by_day
    FROM grouped_fraud ct
    WHERE ct.is_total;

    v_prevented_volume_usd := ROUND(COALESCE(v_prevented_volume_inr, 0.00) / v_usd_rate, 2);
    v_monitored_volume_usd := ROUND(COALESCE(v_monitored_volume_inr, 0.00) / v_usd_rate, 2);

    RETURN jsonb_build_object(
        'totalCases', COALESCE(v_total_cases, 0),
        'flaggedCount', COALESCE(v_flagged_count, 0),
        'frozenCount', COALESCE(v_frozen_count, 0),
        'clearedCount', COALESCE(v_cleared_count, 0),
        'preventedVolumeInr', ROUND(COALESCE(v_prevented_volume_inr, 0.00), 2),
        'preventedVolumeUsd', COALESCE(v_prevented_volume_usd, 0.00),
        'preventedVolumeOriginal', ROUND(COALESCE(v_prevented_volume_original, 0.00), 2),
        'monitoredVolumeInr', ROUND(COALESCE(v_monitored_volume_inr, 0.00), 2),
        'monitoredVolumeUsd', COALESCE(v_monitored_volume_usd, 0.00),
        'volumeByCurrency', COALESCE(v_volume_by_currency, '{}'::jsonb),
        'riskTierDistribution', COALESCE(v_risk_tier_dist, '[]'::jsonb),
        'channelDistribution', COALESCE(v_channel_dist, '[]'::jsonb),
        'ruleDistribution', COALESCE(v_rule_dist, '[]'::jsonb),
        'casesByDay', COALESCE(v_cases_by_day, '[]'::jsonb),
        'unconvertedCases', COALESCE(v_unconverted_cases, 0),
        'hasUnconvertedRecords', (COALESCE(v_unconverted_cases, 0) > 0),
        'tenantScope', COALESCE(v_enforced_tenant, 'GLOBAL_ALL_TENANTS'),
        'callerRole', v_caller_role,
        'reportingBaseCurrency', 'INR',
        'source', 'supabase_rpc_secure'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_fraud_aggregates(TEXT, TEXT, DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fraud_aggregates(TEXT, TEXT, DATE, DATE, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. REFRESH PLANNER STATISTICS ON TARGET TABLES
-- ------------------------------------------------------------------------------
ANALYZE public.support_tickets;
ANALYZE public.fraud_cases;
ANALYZE public.profiles;
ANALYZE public.exchange_rates;
