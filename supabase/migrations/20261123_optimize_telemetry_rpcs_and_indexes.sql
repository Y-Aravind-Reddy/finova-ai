-- ==============================================================================
-- FINOVA AI — TELEMETRY STATEMENT TIMEOUT REMEDIATION & QUERY OPTIMIZATION
-- Migration ID: 20261123_optimize_telemetry_rpcs_and_indexes
-- Target Project Ref: rjudrmnnpwlovpkbwnte
-- Status: Forward-Only, Idempotent, Non-Destructive (Zero DROP TABLE, Zero RLS Disable)
--
-- Root Causes Addressed:
-- 1. Correlated per-row LEFT JOIN LATERAL against public.exchange_rates executed on
--    every row across duplicate CTE scans in get_transaction_aggregates,
--    get_fraud_aggregates, and get_platform_executive_kpis.
-- 2. Repeated multi-pass full/filtered scans of transactions (up to 6x per call),
--    fraud_cases (2x), support_tickets (4x), and kyc_records (2x).
-- 3. Non-sargable timestamp::date predicates in get_fraud_aggregates blocking
--    composite index usage on (tenant_id, timestamp DESC).
-- 4. Per-row RLS helper evaluation without PostgreSQL InitPlan subqueries.
-- 5. Missing composite indexes for bounded date, tenant, user, and status filters.
--
-- Security & Accuracy Guarantees:
-- - Zero RLS disabling, zero USING (true) on private tables, zero anon access.
-- - SECURITY INVOKER preserved across all telemetry aggregate RPCs.
-- - SQLSTATE 42501 standardized for all RBAC & tenant isolation denials.
-- - Single authorized SUPER_ADMIN email (aravindvicky629@gmail.com) enforced.
-- - Exact currency-specific totals preserved (never mixing currencies without FX).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. JUSTIFIED COMPOSITE & PARTIAL INDEXES FOR BOUNDED TELEMETRY QUERIES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_user_date
    ON public.transactions (tenant_id, user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_date_status
    ON public.transactions (date DESC, status);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_currency_date
    ON public.transactions (tenant_id, currency, date DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_status_opened
    ON public.support_tickets (tenant_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_id_status_role_tenant
    ON public.profiles (id, status, role, tenant_id);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_inr_target_date
    ON public.exchange_rates (target_currency, effective_date DESC)
    WHERE base_currency = 'INR' AND rate > 0;

-- ------------------------------------------------------------------------------
-- 2. INITPLAN-OPTIMIZED RLS POLICIES (IDENTICAL SECURITY BOUNDARIES, 1X EVAL)
-- ------------------------------------------------------------------------------

-- 2A. public.transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_transactions" ON public.transactions;
CREATE POLICY "super_admin_all_transactions" ON public.transactions
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

DROP POLICY IF EXISTS "staff_tenant_transactions_select" ON public.transactions;
CREATE POLICY "staff_tenant_transactions_select" ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) IN ('ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE')
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

DROP POLICY IF EXISTS "customer_own_transactions_select" ON public.transactions;
CREATE POLICY "customer_own_transactions_select" ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) = 'CUSTOMER'
        AND user_id = (SELECT auth.uid())
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

-- 2B. public.fraud_cases (Strictly excludes SUPPORT_EXECUTIVE and CUSTOMER)
ALTER TABLE public.fraud_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_fraud" ON public.fraud_cases;
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

DROP POLICY IF EXISTS "staff_tenant_fraud_select" ON public.fraud_cases;
CREATE POLICY "staff_tenant_fraud_select" ON public.fraud_cases
    FOR SELECT
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

DROP POLICY IF EXISTS "staff_tenant_fraud_update" ON public.fraud_cases;
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

-- 2C. public.kyc_records
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_kyc" ON public.kyc_records;
CREATE POLICY "super_admin_all_kyc" ON public.kyc_records
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

DROP POLICY IF EXISTS "staff_tenant_kyc_manage" ON public.kyc_records;
CREATE POLICY "staff_tenant_kyc_manage" ON public.kyc_records
    FOR ALL
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = (SELECT public.get_auth_tenant())
    )
    WITH CHECK (
        (SELECT public.get_auth_role()) IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

DROP POLICY IF EXISTS "support_view_tenant_kyc" ON public.kyc_records;
CREATE POLICY "support_view_tenant_kyc" ON public.kyc_records
    FOR SELECT
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) = 'SUPPORT_EXECUTIVE'
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

DROP POLICY IF EXISTS "customer_read_own_kyc" ON public.kyc_records;
CREATE POLICY "customer_read_own_kyc" ON public.kyc_records
    FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

DROP POLICY IF EXISTS "customer_insert_own_kyc" ON public.kyc_records;
CREATE POLICY "customer_insert_own_kyc" ON public.kyc_records
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND tenant_id = (SELECT public.get_auth_tenant())
        AND status IN ('Pending', 'Under Review')
    );

-- 2D. public.support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_tickets" ON public.support_tickets;
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

DROP POLICY IF EXISTS "staff_manage_tenant_tickets" ON public.support_tickets;
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

DROP POLICY IF EXISTS "customer_own_tickets" ON public.support_tickets;
CREATE POLICY "customer_own_tickets" ON public.support_tickets
    FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- ------------------------------------------------------------------------------
-- 3. SINGLE-PASS OPTIMIZED GET_TRANSACTION_AGGREGATES
--    Eliminates duplicate scans & per-row LEFT JOIN LATERAL FX lookups.
-- ------------------------------------------------------------------------------
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
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_tenant TEXT;
    v_caller_email TEXT;
    v_caller_status TEXT;
    v_enforced_tenant TEXT;
    v_enforced_user_id UUID;

    v_total_count INT := 0;
    v_settled_count INT := 0;
    v_settled_volume_inr NUMERIC(18, 2) := 0.00;
    v_settled_volume_usd NUMERIC(18, 2) := 0.00;
    v_settled_volume_original NUMERIC(18, 2) := 0.00;
    v_credits_volume_inr NUMERIC(18, 2) := 0.00;
    v_credits_volume_usd NUMERIC(18, 2) := 0.00;
    v_debits_volume_inr NUMERIC(18, 2) := 0.00;
    v_debits_volume_usd NUMERIC(18, 2) := 0.00;
    v_net_liquid_balance_inr NUMERIC(18, 2) := 0.00;
    v_net_liquid_balance_usd NUMERIC(18, 2) := 0.00;
    v_unconverted_count INT := 0;
    v_unconverted_volume_original NUMERIC(18, 2) := 0.00;

    v_usd_rate NUMERIC(12, 6) := 84.070000;
    v_volume_by_currency JSONB := '{}'::jsonb;
    v_volume_by_day JSONB := '[]'::jsonb;
    v_category_breakdown JSONB := '{}'::jsonb;
    v_type_breakdown JSONB := '{}'::jsonb;
    v_status_breakdown JSONB := '{}'::jsonb;
    v_top_merchants JSONB := '[]'::jsonb;
BEGIN
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required to execute transaction aggregation.'
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
        v_enforced_user_id := p_user_id;

    ELSIF v_caller_role IN ('ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') THEN
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant transaction analytics violation. Caller belongs to "%", attempted "%".', v_caller_tenant, p_tenant_id
                USING ERRCODE = '42501';
        END IF;
        v_enforced_tenant := v_caller_tenant;
        v_enforced_user_id := p_user_id;

    ELSIF v_caller_role = 'CUSTOMER' THEN
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Customer tenant boundary violation.'
                USING ERRCODE = '42501';
        END IF;
        IF p_user_id IS NOT NULL AND p_user_id <> v_caller_id THEN
            RAISE EXCEPTION 'Access Denied: Customer cannot query other account records.'
                USING ERRCODE = '42501';
        END IF;
        v_enforced_tenant := v_caller_tenant;
        v_enforced_user_id := v_caller_id;

    ELSE
        RAISE EXCEPTION 'Access Denied: Unauthorized role "%".', v_caller_role
            USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(
        (SELECT rate FROM public.exchange_rates
         WHERE base_currency = 'INR' AND target_currency = 'USD' AND rate > 0
         ORDER BY effective_date DESC LIMIT 1),
        84.070000
    ) INTO v_usd_rate;

    -- Single materialized scan over public.transactions with pre-computed latest_fx hash join
    WITH latest_fx AS (
        SELECT DISTINCT ON (target_currency)
            target_currency,
            rate,
            effective_date
        FROM public.exchange_rates
        WHERE base_currency = 'INR'
          AND rate > 0
        ORDER BY target_currency, effective_date DESC
    ),
    base_tx AS MATERIALIZED (
        SELECT
            t.date,
            t.amount,
            COALESCE(NULLIF(TRIM(t.currency), ''), 'UNVERIFIED') AS currency,
            COALESCE(NULLIF(TRIM(t.category), ''), 'Operational') AS category,
            COALESCE(NULLIF(TRIM(t.merchant), ''), 'Global Clearing') AS merchant,
            CASE WHEN LOWER(COALESCE(NULLIF(TRIM(t.type), ''), 'Debit')) IN ('credit', 'deposit') THEN 'Credit' ELSE 'Debit' END AS tx_type,
            COALESCE(NULLIF(TRIM(t.status), ''), 'Settled') AS status,
            (LOWER(COALESCE(NULLIF(TRIM(t.status), ''), 'Settled')) IN ('settled', 'escrow secured', 'completed', 'success')) AS is_settled,
            CASE
                WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN t.amount_inr
                WHEN NULLIF(TRIM(t.currency), '') = 'INR' THEN t.amount
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN ROUND(t.amount * t.exchange_rate, 2)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(t.amount * fx.rate, 2)
                ELSE NULL
            END AS calc_inr,
            CASE
                WHEN NULLIF(TRIM(t.currency), '') = 'INR' THEN 1.000000
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN t.exchange_rate
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                ELSE NULL
            END AS eff_rate,
            fx.effective_date AS eff_date,
            (
                NULLIF(TRIM(t.currency), '') = 'INR'
                OR (t.amount_inr IS NOT NULL AND t.amount_inr >= 0)
                OR (t.exchange_rate IS NOT NULL AND t.exchange_rate > 0)
                OR (fx.rate IS NOT NULL AND fx.rate > 0)
            ) AS conv_flag
        FROM public.transactions t
        LEFT JOIN latest_fx fx
          ON fx.target_currency = NULLIF(TRIM(t.currency), '')
        WHERE (v_enforced_tenant IS NULL OR t.tenant_id = v_enforced_tenant)
          AND (v_enforced_user_id IS NULL OR t.user_id = v_enforced_user_id)
          AND (p_start_date IS NULL OR t.date >= p_start_date)
          AND (p_end_date IS NULL OR t.date <= p_end_date)
          AND (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR t.status = p_status)
          AND (p_type IS NULL OR p_type = '' OR p_type = 'ALL' OR t.type = p_type)
    ),
    core_totals AS (
        SELECT
            COUNT(*)::int AS total_cnt,
            COUNT(*) FILTER (WHERE is_settled)::int AS settled_cnt,
            COALESCE(SUM(calc_inr) FILTER (WHERE is_settled AND conv_flag), 0.00) AS settled_inr,
            COALESCE(SUM(amount) FILTER (WHERE is_settled), 0.00) AS settled_orig,
            COALESCE(SUM(calc_inr) FILTER (WHERE tx_type = 'Credit' AND conv_flag), 0.00) AS credits_inr,
            COALESCE(SUM(calc_inr) FILTER (WHERE tx_type = 'Debit' AND conv_flag), 0.00) AS debits_inr,
            COUNT(*) FILTER (WHERE NOT conv_flag)::int AS unconv_cnt,
            COALESCE(SUM(amount) FILTER (WHERE NOT conv_flag), 0.00) AS unconv_orig
        FROM base_tx
    )
    SELECT
        ct.total_cnt,
        ct.settled_cnt,
        ct.settled_inr,
        ct.settled_orig,
        ct.credits_inr,
        ct.debits_inr,
        ct.unconv_cnt,
        ct.unconv_orig,
        COALESCE(
            (SELECT jsonb_object_agg(
                curr,
                jsonb_build_object(
                    'original', orig_sum,
                    'inr', inr_sum,
                    'usd', ROUND(inr_sum / v_usd_rate, 2),
                    'rate', COALESCE(avg_rate, 0),
                    'effectiveDate', COALESCE(max_eff_date::text, CURRENT_DATE::text),
                    'isConverted', (unconv_rows = 0),
                    'unconvertedCount', unconv_rows
                )
            )
            FROM (
                SELECT
                    currency AS curr,
                    ROUND(SUM(amount), 2) AS orig_sum,
                    ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00), 2) AS inr_sum,
                    ROUND(AVG(eff_rate) FILTER (WHERE conv_flag), 6) AS avg_rate,
                    MAX(eff_date) AS max_eff_date,
                    COUNT(*) FILTER (WHERE NOT conv_flag)::int AS unconv_rows
                FROM base_tx
                GROUP BY currency
            ) c),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('date', d_date::text, 'volumeInr', d_vol, 'count', d_cnt) ORDER BY d_date ASC)
             FROM (
                 SELECT date AS d_date, ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00), 2) AS d_vol, COUNT(*)::int AS d_cnt
                 FROM base_tx
                 WHERE date IS NOT NULL
                 GROUP BY date
                 ORDER BY date DESC
                 LIMIT 30
             ) days),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_object_agg(category, jsonb_build_object('count', cnt, 'volumeInr', vol))
             FROM (
                 SELECT category, COUNT(*)::int AS cnt, ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00), 2) AS vol
                 FROM base_tx
                 GROUP BY category
             ) cats),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_object_agg(tx_type, jsonb_build_object('count', cnt, 'volumeInr', vol))
             FROM (
                 SELECT tx_type, COUNT(*)::int AS cnt, ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00), 2) AS vol
                 FROM base_tx
                 GROUP BY tx_type
             ) tys),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_object_agg(status, jsonb_build_object('count', cnt, 'volumeInr', vol))
             FROM (
                 SELECT status, COUNT(*)::int AS cnt, ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00), 2) AS vol
                 FROM base_tx
                 GROUP BY status
             ) sts),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('merchant', merchant, 'count', cnt, 'volumeInr', vol))
             FROM (
                 SELECT merchant, COUNT(*)::int AS cnt, ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00), 2) AS vol
                 FROM base_tx
                 GROUP BY merchant
                 ORDER BY vol DESC
                 LIMIT 6
             ) merch),
            '[]'::jsonb
        )
    INTO
        v_total_count,
        v_settled_count,
        v_settled_volume_inr,
        v_settled_volume_original,
        v_credits_volume_inr,
        v_debits_volume_inr,
        v_unconverted_count,
        v_unconverted_volume_original,
        v_volume_by_currency,
        v_volume_by_day,
        v_category_breakdown,
        v_type_breakdown,
        v_status_breakdown,
        v_top_merchants
    FROM core_totals ct;

    v_net_liquid_balance_inr := ROUND(v_credits_volume_inr - v_debits_volume_inr, 2);
    v_settled_volume_usd := ROUND(v_settled_volume_inr / v_usd_rate, 2);
    v_credits_volume_usd := ROUND(v_credits_volume_inr / v_usd_rate, 2);
    v_debits_volume_usd := ROUND(v_debits_volume_inr / v_usd_rate, 2);
    v_net_liquid_balance_usd := ROUND(v_net_liquid_balance_inr / v_usd_rate, 2);

    RETURN jsonb_build_object(
        'totalCount', v_total_count,
        'settledCount', v_settled_count,
        'settledVolumeInr', ROUND(v_settled_volume_inr, 2),
        'settledVolumeUsd', v_settled_volume_usd,
        'settledVolumeOriginal', ROUND(v_settled_volume_original, 2),
        'creditsVolumeInr', ROUND(v_credits_volume_inr, 2),
        'creditsVolumeUsd', v_credits_volume_usd,
        'debitsVolumeInr', ROUND(v_debits_volume_inr, 2),
        'debitsVolumeUsd', v_debits_volume_usd,
        'netLiquidBalanceInr', v_net_liquid_balance_inr,
        'netLiquidBalanceUsd', v_net_liquid_balance_usd,
        'volumeByCurrency', v_volume_by_currency,
        'volumeByDay', v_volume_by_day,
        'categoryBreakdown', v_category_breakdown,
        'typeBreakdown', v_type_breakdown,
        'statusBreakdown', v_status_breakdown,
        'topMerchants', v_top_merchants,
        'unconvertedCount', v_unconverted_count,
        'unconvertedVolumeOriginal', ROUND(v_unconverted_volume_original, 2),
        'hasUnconvertedRecords', (v_unconverted_count > 0),
        'tenantScope', COALESCE(v_enforced_tenant, 'GLOBAL_ALL_TENANTS'),
        'userScope', COALESCE(v_enforced_user_id::text, 'ALL_AUTHORIZED_USERS'),
        'callerRole', v_caller_role,
        'reportingBaseCurrency', 'INR',
        'source', 'supabase_rpc_secure'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_transaction_aggregates(TEXT, UUID, DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_transaction_aggregates(TEXT, UUID, DATE, DATE, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. SINGLE-PASS OPTIMIZED GET_FRAUD_AGGREGATES
--    Replaces timestamp::date with sargable TIMESTAMPTZ range predicates,
--    replaces duplicate scans & per-row LATERAL joins with 1 materialized CTE.
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

    WITH latest_fx AS (
        SELECT DISTINCT ON (target_currency)
            target_currency,
            rate,
            effective_date
        FROM public.exchange_rates
        WHERE base_currency = 'INR'
          AND rate > 0
        ORDER BY target_currency, effective_date DESC
    ),
    base_fraud AS MATERIALIZED (
        SELECT
            fc.status,
            UPPER(COALESCE(fc.status, '')) AS status_upper,
            fc.amount,
            COALESCE(fc.risk_score, 0) AS risk_score,
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
          ON fx.target_currency = NULLIF(TRIM(fc.currency), '')
        WHERE (v_enforced_tenant IS NULL OR fc.tenant_id = v_enforced_tenant)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR fc.currency = p_currency)
          AND (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR fc.status = p_status)
          AND (p_customer_id IS NULL OR p_customer_id = '' OR fc.customer_id = p_customer_id)
          AND (p_start_date IS NULL OR fc.timestamp >= (p_start_date::timestamp AT TIME ZONE 'UTC'))
          AND (p_end_date IS NULL OR fc.timestamp < ((p_end_date + 1)::timestamp AT TIME ZONE 'UTC'))
    ),
    core_totals AS (
        SELECT
            COUNT(*)::int AS total_cnt,
            COUNT(*) FILTER (WHERE status_upper LIKE '%FLAG%' OR status_upper LIKE '%REVIEW%' OR status_upper = 'OPEN')::int AS flagged_cnt,
            COUNT(*) FILTER (WHERE status_upper LIKE '%FROZEN%' OR status_upper LIKE '%PREVENT%' OR status_upper LIKE '%BLOCK%' OR status_upper = 'CONFIRMED')::int AS frozen_cnt,
            COUNT(*) FILTER (WHERE status_upper LIKE '%CLEAR%' OR status_upper = 'FALSE_POSITIVE')::int AS cleared_cnt,
            COALESCE(SUM(calc_inr) FILTER (WHERE (status_upper LIKE '%FROZEN%' OR status_upper LIKE '%PREVENT%' OR status_upper LIKE '%BLOCK%' OR status_upper = 'CONFIRMED') AND conv_flag), 0.00) AS prevented_inr,
            COALESCE(SUM(amount) FILTER (WHERE status_upper LIKE '%FROZEN%' OR status_upper LIKE '%PREVENT%' OR status_upper LIKE '%BLOCK%' OR status_upper = 'CONFIRMED'), 0.00) AS prevented_orig,
            COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00) AS monitored_inr,
            COUNT(*) FILTER (WHERE NOT conv_flag)::int AS unconv_cnt
        FROM base_fraud
    )
    SELECT
        ct.total_cnt,
        ct.flagged_cnt,
        ct.frozen_cnt,
        ct.cleared_cnt,
        ct.prevented_inr,
        ct.prevented_orig,
        ct.monitored_inr,
        ct.unconv_cnt,
        COALESCE(
            (SELECT jsonb_object_agg(
                curr,
                jsonb_build_object(
                    'original', orig_sum,
                    'inr', inr_sum,
                    'usd', ROUND(inr_sum / v_usd_rate, 2),
                    'rate', COALESCE(avg_rate, 0),
                    'effectiveDate', COALESCE(max_eff_date::text, CURRENT_DATE::text),
                    'isConverted', (unconv_rows = 0),
                    'unconvertedCount', unconv_rows
                )
            )
            FROM (
                SELECT
                    currency AS curr,
                    ROUND(SUM(amount), 2) AS orig_sum,
                    ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00), 2) AS inr_sum,
                    ROUND(AVG(eff_rate) FILTER (WHERE conv_flag), 6) AS avg_rate,
                    MAX(eff_date) AS max_eff_date,
                    COUNT(*) FILTER (WHERE NOT conv_flag)::int AS unconv_rows
                FROM base_fraud
                GROUP BY currency
            ) c),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('tier', tier_label, 'count', cnt, 'volumeInr', vol) ORDER BY sort_ord)
            FROM (
                SELECT
                    CASE
                        WHEN risk_score >= 80 THEN 'Critical Anomaly (Risk >= 80)'
                        WHEN risk_score >= 50 THEN 'High Threat (Risk 50-79)'
                        ELSE 'Nominal Surveillance (< 50)'
                    END AS tier_label,
                    CASE
                        WHEN risk_score >= 80 THEN 1
                        WHEN risk_score >= 50 THEN 2
                        ELSE 3
                    END AS sort_ord,
                    COUNT(*)::int AS cnt,
                    ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00)) AS vol
                FROM base_fraud
                GROUP BY 1, 2
            ) tiers),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('channel', payment_channel, 'count', cnt, 'volumeInr', vol) ORDER BY vol DESC)
            FROM (
                SELECT
                    payment_channel,
                    COUNT(*)::int AS cnt,
                    ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00)) AS vol
                FROM base_fraud
                GROUP BY payment_channel
            ) chans),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('rule', rule_triggered, 'count', cnt) ORDER BY cnt DESC)
            FROM (
                SELECT rule_triggered, COUNT(*)::int AS cnt
                FROM base_fraud
                GROUP BY rule_triggered
                ORDER BY cnt DESC
                LIMIT 10
            ) rules),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('date', case_date::text, 'count', cnt, 'preventedInr', prev_vol) ORDER BY case_date ASC)
            FROM (
                SELECT
                    case_date,
                    COUNT(*)::int AS cnt,
                    ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE (status_upper LIKE '%FROZEN%' OR status_upper LIKE '%PREVENT%' OR status_upper LIKE '%BLOCK%' OR status_upper = 'CONFIRMED') AND conv_flag), 0.00)) AS prev_vol
                FROM base_fraud
                WHERE case_date IS NOT NULL
                GROUP BY case_date
                ORDER BY case_date DESC
                LIMIT 30
            ) days),
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
    FROM core_totals ct;

    v_prevented_volume_usd := ROUND(v_prevented_volume_inr / v_usd_rate, 2);
    v_monitored_volume_usd := ROUND(v_monitored_volume_inr / v_usd_rate, 2);

    RETURN jsonb_build_object(
        'totalCases', v_total_cases,
        'flaggedCount', v_flagged_count,
        'frozenCount', v_frozen_count,
        'clearedCount', v_cleared_count,
        'preventedVolumeInr', ROUND(v_prevented_volume_inr, 2),
        'preventedVolumeUsd', v_prevented_volume_usd,
        'preventedVolumeOriginal', ROUND(v_prevented_volume_original, 2),
        'monitoredVolumeInr', ROUND(v_monitored_volume_inr, 2),
        'monitoredVolumeUsd', v_monitored_volume_usd,
        'volumeByCurrency', v_volume_by_currency,
        'riskTierDistribution', v_risk_tier_dist,
        'channelDistribution', v_channel_dist,
        'ruleDistribution', v_rule_dist,
        'casesByDay', v_cases_by_day,
        'unconvertedCases', v_unconverted_cases,
        'hasUnconvertedRecords', (v_unconverted_cases > 0),
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
-- 5. SINGLE-PASS OPTIMIZED GET_SUPPORT_AGGREGATES (1 SCAN VS 4 SCANS)
-- ------------------------------------------------------------------------------
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
    v_sla_compliance_pct NUMERIC(5, 1) := 0.0;
    v_average_csat NUMERIC(4, 2) := 0.00;
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
            UPPER(COALESCE(status, 'OPEN')) AS status_upper,
            COALESCE(NULLIF(TRIM(priority), ''), 'Medium') AS priority,
            COALESCE(NULLIF(TRIM(category), ''), 'General Inquiry') AS category,
            COALESCE(NULLIF(TRIM(assigned_executive), ''), 'Unassigned Desk') AS executive,
            (COALESCE(hours_open, 0) <= COALESCE(sla_target_hours, 4)) AS is_sla_compliant,
            csat_rating
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
            COALESCE(ROUND(AVG(csat_rating) FILTER (WHERE csat_rating IS NOT NULL AND csat_rating > 0)::numeric, 2), 0.00) AS avg_csat
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
                jsonb_build_object('priority', priority, 'count', cnt)
                ORDER BY CASE priority
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
                    'category', category,
                    'count', cnt,
                    'percentage', CASE WHEN ct.total_cnt > 0 THEN ROUND(cnt * 100.0 / ct.total_cnt, 1) ELSE 0.0 END
                )
                ORDER BY cnt DESC
            )
            FROM (
                SELECT category, COUNT(*)::int AS cnt
                FROM base_tickets
                GROUP BY category
            ) c),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'executive', executive,
                    'activeTickets', active_tickets,
                    'resolvedTickets', resolved_tickets
                )
                ORDER BY active_tickets DESC
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
        'totalTickets', v_total_tickets,
        'openCount', v_open_count,
        'closedCount', v_closed_count,
        'inProgressCount', v_in_progress_count,
        'pendingClientCount', v_pending_client_count,
        'priorityDistribution', v_priority_dist,
        'categoryDistribution', v_category_dist,
        'executiveWorkload', v_executive_workload,
        'slaCompliancePct', v_sla_compliance_pct,
        'averageCsat', v_average_csat,
        'tenantScope', COALESCE(v_enforced_tenant, 'GLOBAL_ALL_TENANTS'),
        'callerRole', v_caller_role,
        'source', 'supabase_rpc_secure'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_aggregates(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_aggregates(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. SINGLE-PASS OPTIMIZED GET_KYC_AGGREGATES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_kyc_aggregates(
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

    v_total_records INT := 0;
    v_verified_count INT := 0;
    v_pending_count INT := 0;
    v_review_count INT := 0;
    v_tier_dist JSONB := '[]'::jsonb;
    v_doc_type_dist JSONB := '[]'::jsonb;
BEGIN
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required for KYC aggregation.' USING ERRCODE = '42501';
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

    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') THEN
        RAISE EXCEPTION 'Access Denied: Role "%" is unauthorized for institutional KYC aggregates.', v_caller_role USING ERRCODE = '42501';
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
            RAISE EXCEPTION 'Access Denied: Cross-tenant KYC compliance telemetry access violation.' USING ERRCODE = '42501';
        END IF;
        v_enforced_tenant := v_caller_tenant;
    END IF;

    WITH base_kyc AS MATERIALIZED (
        SELECT
            status,
            COALESCE(NULLIF(TRIM(document_type), ''), 'Unspecified') AS doc_label
        FROM public.kyc_records
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
    ),
    kyc_totals AS (
        SELECT
            COUNT(*)::int AS total_cnt,
            COUNT(*) FILTER (WHERE status = 'Verified')::int AS verified_cnt,
            COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending_cnt,
            COUNT(*) FILTER (WHERE status = 'Under Review')::int AS review_cnt
        FROM base_kyc
    )
    SELECT
        kt.total_cnt,
        kt.verified_cnt,
        kt.pending_cnt,
        kt.review_cnt,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('label', doc_label, 'value', cnt) ORDER BY cnt DESC)
             FROM (
                 SELECT doc_label, COUNT(*)::int AS cnt
                 FROM base_kyc
                 GROUP BY doc_label
             ) d),
            '[]'::jsonb
        )
    INTO
        v_total_records,
        v_verified_count,
        v_pending_count,
        v_review_count,
        v_doc_type_dist
    FROM kyc_totals kt;

    SELECT COALESCE(
        jsonb_agg(jsonb_build_object('label', tier_label, 'value', cnt) ORDER BY cnt DESC),
        '[]'::jsonb
    )
    INTO v_tier_dist
    FROM (
        SELECT COALESCE(NULLIF(TRIM(tier), ''), 'Standard') AS tier_label, COUNT(*)::int AS cnt
        FROM public.profiles
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
        GROUP BY COALESCE(NULLIF(TRIM(tier), ''), 'Standard')
    ) t;

    RETURN jsonb_build_object(
        'totalRecords', v_total_records,
        'verifiedCount', v_verified_count,
        'pendingCount', v_pending_count,
        'reviewCount', v_review_count,
        'tierDistribution', v_tier_dist,
        'docTypeDistribution', v_doc_type_dist,
        'tenantScope', COALESCE(v_enforced_tenant, 'GLOBAL_ALL_TENANTS'),
        'callerRole', v_caller_role,
        'source', 'supabase_rpc_secure'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_kyc_aggregates(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kyc_aggregates(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. SINGLE-PASS OPTIMIZED GET_PLATFORM_EXECUTIVE_KPIS
--    Consolidates 2 transaction scans + 2 fraud scans + 3 LATERAL joins -> 1 pass each.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_platform_executive_kpis()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_email TEXT;
    v_caller_status TEXT;
    v_ytd_start DATE := date_trunc('year', timezone('utc', now()))::date;

    v_settled_volume_ytd NUMERIC(18, 2) := 0.00;
    v_institutional_mrr NUMERIC(15, 2) := 0.00;
    v_prevented_fraud_volume NUMERIC(18, 2) := 0.00;
    v_sla_compliance_pct NUMERIC(5, 1) := 0.0;
    v_compliance_score NUMERIC(5, 1) := 0.0;
    v_active_users INT := 0;
    v_tenant_active_users INT := 0;
    v_net_liquid_balance NUMERIC(18, 2) := 0.00;
    v_risk_exposure_score INT := 0;
BEGIN
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required for Global Executive KPIs.' USING ERRCODE = '42501';
    END IF;

    IF (auth.jwt() ->> 'role') <> 'service_role' THEN
        SELECT role::text, email, status::text
        INTO v_caller_role, v_caller_email, v_caller_status
        FROM public.profiles
        WHERE id = v_caller_id;

        IF v_caller_role IS NULL
           OR v_caller_status <> 'Active'
           OR v_caller_role <> 'SUPER_ADMIN'
           OR LOWER(TRIM(COALESCE(v_caller_email, ''))) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Global Executive KPIs are restricted exclusively to the verified Platform Super Admin.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Single pass over transactions + pre-computed latest_fx
    WITH latest_fx AS (
        SELECT DISTINCT ON (target_currency)
            target_currency,
            rate
        FROM public.exchange_rates
        WHERE base_currency = 'INR'
          AND rate > 0
        ORDER BY target_currency, effective_date DESC
    ),
    tx_converted AS (
        SELECT
            t.date,
            LOWER(COALESCE(t.status, '')) AS status_lower,
            LOWER(COALESCE(t.type, 'Debit')) AS type_lower,
            CASE
                WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN t.amount_inr
                WHEN NULLIF(TRIM(t.currency), '') = 'INR' THEN t.amount
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN ROUND(t.amount * t.exchange_rate, 2)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(t.amount * fx.rate, 2)
                ELSE 0.00
            END AS calc_inr
        FROM public.transactions t
        LEFT JOIN latest_fx fx
          ON fx.target_currency = NULLIF(TRIM(t.currency), '')
    )
    SELECT
        COALESCE(SUM(calc_inr) FILTER (
            WHERE date >= v_ytd_start
              AND status_lower IN ('settled', 'escrow secured', 'completed', 'success')
        ), 0.00),
        COALESCE(SUM(
            CASE
                WHEN type_lower IN ('credit', 'deposit') THEN calc_inr
                ELSE -calc_inr
            END
        ), 0.00)
    INTO v_settled_volume_ytd, v_net_liquid_balance
    FROM tx_converted;

    -- Single pass over fraud_cases + pre-computed latest_fx
    WITH latest_fx AS (
        SELECT DISTINCT ON (target_currency)
            target_currency,
            rate
        FROM public.exchange_rates
        WHERE base_currency = 'INR'
          AND rate > 0
        ORDER BY target_currency, effective_date DESC
    )
    SELECT
        COALESCE(SUM(
            CASE
                WHEN fc.amount_inr IS NOT NULL AND fc.amount_inr >= 0 THEN fc.amount_inr
                WHEN NULLIF(TRIM(fc.currency), '') = 'INR' THEN fc.amount
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN ROUND(fc.amount * fc.exchange_rate, 2)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(fc.amount * fx.rate, 2)
                ELSE 0.00
            END
        ) FILTER (WHERE fc.status = 'Frozen Escrow'), 0.00),
        COALESCE(ROUND(AVG(fc.risk_score) FILTER (WHERE fc.status IN ('Flagged', 'In Review')), 0), 0)::int
    INTO v_prevented_fraud_volume, v_risk_exposure_score
    FROM public.fraud_cases fc
    LEFT JOIN latest_fx fx
      ON fx.target_currency = NULLIF(TRIM(fc.currency), '');

    -- Single pass over tenant_workspaces
    SELECT
        COALESCE(SUM(mrr) FILTER (WHERE id <> 'platform_root'), 0.00),
        COALESCE(ROUND(AVG(compliance_score), 1), 0.0),
        COALESCE(SUM(users_count) FILTER (WHERE id <> 'platform_root'), 0)::int
    INTO v_institutional_mrr, v_compliance_score, v_tenant_active_users
    FROM public.tenant_workspaces
    WHERE status = 'Active';

    IF v_tenant_active_users > 0 THEN
        v_active_users := v_tenant_active_users;
    ELSE
        SELECT COUNT(*)::int
        INTO v_active_users
        FROM public.profiles
        WHERE status::text = 'Active';
    END IF;

    SELECT COALESCE(ROUND(AVG(CASE WHEN COALESCE(hours_open, 0) <= COALESCE(sla_target_hours, 4) THEN 100.0 ELSE 0.0 END), 1), 0.0)
    INTO v_sla_compliance_pct
    FROM public.support_tickets;

    RETURN jsonb_build_object(
        'settledVolumeYtd', ROUND(v_settled_volume_ytd, 2),
        'institutionalMrr', ROUND(v_institutional_mrr, 2),
        'preventedFraudVolume', ROUND(v_prevented_fraud_volume, 2),
        'slaCompliancePct', v_sla_compliance_pct,
        'complianceScore', v_compliance_score,
        'activeUsers', v_active_users,
        'netLiquidBalance', ROUND(v_net_liquid_balance, 2),
        'riskExposureScore', v_risk_exposure_score,
        'source', 'supabase_rpc_secure'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_executive_kpis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_executive_kpis() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. SINGLE-PASS OPTIMIZED GET_TRANSFER_INTELLIGENCE_AGGREGATES (1 SCAN VS 6 SCANS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_transfer_intelligence_aggregates(
    p_tenant_id TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_currency TEXT DEFAULT NULL
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

    v_total_transfers INT := 0;
    v_total_volume NUMERIC(18, 2) := 0.00;
    v_success_count INT := 0;
    v_pending_count INT := 0;
    v_failed_count INT := 0;
    v_reversed_count INT := 0;
    v_fraud_flagged_count INT := 0;

    v_status_dist JSONB := '[]'::jsonb;
    v_category_dist JSONB := '[]'::jsonb;
    v_currency_exposure JSONB := '{}'::jsonb;
    v_channel_perf JSONB := '[]'::jsonb;
    v_hourly_velocity JSONB := '[]'::jsonb;
BEGIN
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required for transfer intelligence aggregation.' USING ERRCODE = '42501';
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

    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') THEN
        RAISE EXCEPTION 'Access Denied: Role "%" is unauthorized for institutional transfer intelligence.', v_caller_role USING ERRCODE = '42501';
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
            RAISE EXCEPTION 'Access Denied: Cross-tenant transfer intelligence access violation.' USING ERRCODE = '42501';
        END IF;
        v_enforced_tenant := v_caller_tenant;
    END IF;

    WITH base_tx AS MATERIALIZED (
        SELECT
            amount,
            COALESCE(NULLIF(TRIM(status), ''), 'Settled') AS status_label,
            LOWER(COALESCE(status, 'settled')) AS status_lower,
            COALESCE(NULLIF(TRIM(category), ''), 'Operational') AS category_label,
            COALESCE(NULLIF(TRIM(currency), ''), 'INR') AS currency_label,
            COALESCE(NULLIF(TRIM(channel), ''), 'Online') AS channel_label,
            COALESCE(is_flagged_fraud, FALSE) AS is_flagged,
            TO_CHAR(COALESCE(created_at, date::timestamptz) AT TIME ZONE 'UTC', 'HH24:00') AS hour_bucket
        FROM public.transactions
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR currency = p_currency)
    ),
    core_totals AS (
        SELECT
            COUNT(*)::int AS total_cnt,
            COALESCE(SUM(amount), 0.00) AS total_vol,
            COUNT(*) FILTER (WHERE status_lower IN ('settled', 'escrow secured', 'success', 'completed'))::int AS success_cnt,
            COUNT(*) FILTER (WHERE status_lower IN ('pending', 'clearing'))::int AS pending_cnt,
            COUNT(*) FILTER (WHERE status_lower = 'failed')::int AS failed_cnt,
            COUNT(*) FILTER (WHERE status_lower = 'reversed')::int AS reversed_cnt,
            COUNT(*) FILTER (WHERE is_flagged)::int AS fraud_cnt
        FROM base_tx
    )
    SELECT
        ct.total_cnt,
        ct.total_vol,
        ct.success_cnt,
        ct.pending_cnt,
        ct.failed_cnt,
        ct.reversed_cnt,
        ct.fraud_cnt,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('label', status_label, 'value', cnt)) FROM (SELECT status_label, COUNT(*)::int AS cnt FROM base_tx GROUP BY status_label) s), '[]'::jsonb),
        COALESCE((SELECT jsonb_agg(jsonb_build_object('label', category_label, 'value', cnt)) FROM (SELECT category_label, COUNT(*)::int AS cnt FROM base_tx GROUP BY category_label) c), '[]'::jsonb),
        COALESCE((SELECT jsonb_object_agg(currency_label, total_amt) FROM (SELECT currency_label, ROUND(COALESCE(SUM(amount), 0.00), 2) AS total_amt FROM base_tx GROUP BY currency_label) cu), '{}'::jsonb),
        COALESCE((SELECT jsonb_agg(jsonb_build_object('label', channel_label, 'value', cnt)) FROM (SELECT channel_label, COUNT(*)::int AS cnt FROM base_tx GROUP BY channel_label) ch), '[]'::jsonb),
        COALESCE((SELECT jsonb_agg(jsonb_build_object('hour', hour_bucket, 'volume', vol) ORDER BY hour_bucket ASC) FROM (SELECT hour_bucket, ROUND(COALESCE(SUM(amount), 0.00), 2) AS vol FROM base_tx GROUP BY hour_bucket) h), '[]'::jsonb)
    INTO
        v_total_transfers,
        v_total_volume,
        v_success_count,
        v_pending_count,
        v_failed_count,
        v_reversed_count,
        v_fraud_flagged_count,
        v_status_dist,
        v_category_dist,
        v_currency_exposure,
        v_channel_perf,
        v_hourly_velocity
    FROM core_totals ct;

    RETURN jsonb_build_object(
        'totalTransfers', v_total_transfers,
        'totalVolume', ROUND(v_total_volume, 2),
        'successCount', v_success_count,
        'pendingCount', v_pending_count,
        'failedCount', v_failed_count,
        'reversedCount', v_reversed_count,
        'avgAmount', CASE WHEN v_total_transfers > 0 THEN ROUND(v_total_volume / v_total_transfers, 2) ELSE 0.00 END,
        'fraudFlaggedCount', v_fraud_flagged_count,
        'statusDistribution', v_status_dist,
        'categoryMix', v_category_dist,
        'currencyExposure', v_currency_exposure,
        'channelPerformance', v_channel_perf,
        'hourlyVelocity', v_hourly_velocity,
        'rejectedRecordsCount', 0,
        'source', 'supabase_rpc_secure'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_transfer_intelligence_aggregates(TEXT, DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_transfer_intelligence_aggregates(TEXT, DATE, DATE, TEXT) TO authenticated, service_role;
