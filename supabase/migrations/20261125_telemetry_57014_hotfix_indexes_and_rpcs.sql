-- ==============================================================================
-- FINOVA AI — TELEMETRY 57014 HOTFIX: COMPOSITE INDEXES, FULL RLS RECONCILIATION
--             & STREAMING SINGLE-PASS AGGREGATE RPCS
-- Migration ID: 20261125_telemetry_57014_hotfix_indexes_and_rpcs
-- Target Project Ref: rjudrmnnpwlovpkbwnte
-- Status: Forward-Only, Idempotent, Non-Destructive (Zero DROP TABLE, Zero RLS Disable)
--
-- Performance & Root-Cause Fixes Beyond 20261123:
-- 1. Adds missing primary (tenant_id, date DESC) and (date DESC) indexes on
--    public.transactions and (timestamp DESC) on public.fraud_cases for bounded
--    institutional dashboard queries where p_user_id and p_currency are NULL.
-- 2. Adds partial index idx_fraud_cases_active_risk for get_platform_executive_kpis
--    and idx_transactions_unresolved_tenant_date for reconciliation/exceptions,
--    plus idx_profiles_tenant_tier and idx_kyc_records_tenant_status for KYC.
-- 3. Executes dynamic pg_policies cleanup loops across transactions, fraud_cases,
--    kyc_records, and support_tickets so zero legacy per-row RLS policies remain
--    active alongside InitPlan-wrapped policies.
-- 4. Eliminates raw-row MATERIALIZED temp-buffer spills by streaming single-pass
--    scans through GROUPING SETS into tiny (~50-row) summary CTEs.
-- 5. Aligns get_support_aggregates with 20261124 (NUMERIC(10,2) CSAT precision,
--    regex-safe numeric casts, tenant-scoped customer_own_tickets policy).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. JUSTIFIED COMPOSITE & PARTIAL PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date_desc
    ON public.transactions (tenant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_date_desc
    ON public.transactions (date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_user_date
    ON public.transactions (tenant_id, user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_date_status
    ON public.transactions (date DESC, status);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_currency_date
    ON public.transactions (tenant_id, currency, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_unresolved_tenant_date
    ON public.transactions (tenant_id, date DESC)
    WHERE status IN ('Pending', 'Clearing', 'Failed', 'Reversed') OR is_flagged_fraud = TRUE;

CREATE INDEX IF NOT EXISTS idx_fraud_cases_tenant_status
    ON public.fraud_cases (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_tenant_timestamp
    ON public.fraud_cases (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_timestamp_desc
    ON public.fraud_cases (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_active_risk
    ON public.fraud_cases (status, risk_score)
    WHERE status IN ('Frozen Escrow', 'Flagged', 'In Review');

CREATE INDEX IF NOT EXISTS idx_kyc_records_tenant_status
    ON public.kyc_records (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_kyc_records_tenant_user_status
    ON public.kyc_records (tenant_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_status_opened
    ON public.support_tickets (tenant_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_tenant
    ON public.support_tickets (user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_profiles_id_status_role_tenant
    ON public.profiles (id, status, role, tenant_id);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_tier
    ON public.profiles (tenant_id, tier);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_inr_target_date
    ON public.exchange_rates (target_currency, effective_date DESC)
    WHERE base_currency = 'INR' AND rate > 0;

-- ------------------------------------------------------------------------------
-- 2. COMPLETE LEGACY POLICY CLEANUP & INITPLAN RLS RECONCILIATION
--    Uses pg_policies loops to purge any lingering pre-InitPlan policies from
--    earlier migrations so every query evaluates auth helpers once per statement.
-- ------------------------------------------------------------------------------

-- 2A. public.transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.transactions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.transactions TO authenticated;
GRANT ALL ON TABLE public.transactions TO service_role;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'transactions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.transactions', pol.policyname);
    END LOOP;
END $$;

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

CREATE POLICY "staff_tenant_transactions_select" ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) IN ('ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE')
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

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

-- 2C. public.kyc_records
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kyc_records FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.kyc_records TO authenticated;
GRANT ALL ON TABLE public.kyc_records TO service_role;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'kyc_records'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.kyc_records', pol.policyname);
    END LOOP;
END $$;

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

CREATE POLICY "support_view_tenant_kyc" ON public.kyc_records
    FOR SELECT
    TO authenticated
    USING (
        (SELECT public.get_auth_role()) = 'SUPPORT_EXECUTIVE'
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

CREATE POLICY "customer_read_own_kyc" ON public.kyc_records
    FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        AND tenant_id = (SELECT public.get_auth_tenant())
    );

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
-- 3. STREAMING SINGLE-PASS GET_TRANSACTION_AGGREGATES (ZERO TEMP SPILL)
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
    base_tx AS (
        SELECT
            t.date AS tx_date,
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
    grouped_agg AS MATERIALIZED (
        SELECT
            (GROUPING(currency) = 1 AND GROUPING(tx_date) = 1 AND GROUPING(category) = 1 AND GROUPING(tx_type) = 1 AND GROUPING(status) = 1 AND GROUPING(merchant) = 1) AS is_total,
            (GROUPING(currency) = 0) AS is_curr,
            (GROUPING(tx_date) = 0) AS is_day,
            (GROUPING(category) = 0) AS is_cat,
            (GROUPING(tx_type) = 0) AS is_type,
            (GROUPING(status) = 0) AS is_status,
            (GROUPING(merchant) = 0) AS is_merch,
            currency,
            tx_date,
            category,
            tx_type,
            status,
            merchant,
            COUNT(*)::int AS cnt,
            COUNT(*) FILTER (WHERE is_settled)::int AS settled_cnt,
            COALESCE(SUM(calc_inr) FILTER (WHERE is_settled AND conv_flag), 0.00) AS settled_inr,
            COALESCE(SUM(amount) FILTER (WHERE is_settled), 0.00) AS settled_orig,
            COALESCE(SUM(calc_inr) FILTER (WHERE tx_type = 'Credit' AND conv_flag), 0.00) AS credits_inr,
            COALESCE(SUM(calc_inr) FILTER (WHERE tx_type = 'Debit' AND conv_flag), 0.00) AS debits_inr,
            ROUND(SUM(amount), 2) AS orig_sum,
            ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00), 2) AS inr_sum,
            ROUND(AVG(eff_rate) FILTER (WHERE conv_flag), 6) AS avg_rate,
            MAX(eff_date) AS max_eff_date,
            COUNT(*) FILTER (WHERE NOT conv_flag)::int AS unconv_cnt,
            COALESCE(SUM(amount) FILTER (WHERE NOT conv_flag), 0.00) AS unconv_orig
        FROM base_tx
        GROUP BY GROUPING SETS ((), (currency), (tx_date), (category), (tx_type), (status), (merchant))
    )
    SELECT
        ct.cnt,
        ct.settled_cnt,
        ct.settled_inr,
        ct.settled_orig,
        ct.credits_inr,
        ct.debits_inr,
        ct.unconv_cnt,
        ct.unconv_orig,
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
            FROM grouped_agg g
            WHERE g.is_curr),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('date', d.tx_date::text, 'volumeInr', d.inr_sum, 'count', d.cnt) ORDER BY d.tx_date ASC)
             FROM (
                 SELECT tx_date, inr_sum, cnt
                 FROM grouped_agg
                 WHERE is_day AND tx_date IS NOT NULL
                 ORDER BY tx_date DESC
                 LIMIT 30
             ) d),
            '[]'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_object_agg(g.category, jsonb_build_object('count', g.cnt, 'volumeInr', g.inr_sum))
             FROM grouped_agg g
             WHERE g.is_cat),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_object_agg(g.tx_type, jsonb_build_object('count', g.cnt, 'volumeInr', g.inr_sum))
             FROM grouped_agg g
             WHERE g.is_type),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_object_agg(g.status, jsonb_build_object('count', g.cnt, 'volumeInr', g.inr_sum))
             FROM grouped_agg g
             WHERE g.is_status),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('merchant', m.merchant, 'count', m.cnt, 'volumeInr', m.inr_sum))
             FROM (
                 SELECT merchant, cnt, inr_sum
                 FROM grouped_agg
                 WHERE is_merch
                 ORDER BY inr_sum DESC
                 LIMIT 6
             ) m),
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
    FROM grouped_agg ct
    WHERE ct.is_total;

    v_net_liquid_balance_inr := ROUND(v_credits_volume_inr - v_debits_volume_inr, 2);
    v_settled_volume_usd := ROUND(v_settled_volume_inr / v_usd_rate, 2);
    v_credits_volume_usd := ROUND(v_credits_volume_inr / v_usd_rate, 2);
    v_debits_volume_usd := ROUND(v_debits_volume_inr / v_usd_rate, 2);
    v_net_liquid_balance_usd := ROUND(v_net_liquid_balance_inr / v_usd_rate, 2);

    RETURN jsonb_build_object(
        'totalCount', COALESCE(v_total_count, 0),
        'settledCount', COALESCE(v_settled_count, 0),
        'settledVolumeInr', ROUND(COALESCE(v_settled_volume_inr, 0.00), 2),
        'settledVolumeUsd', COALESCE(v_settled_volume_usd, 0.00),
        'settledVolumeOriginal', ROUND(COALESCE(v_settled_volume_original, 0.00), 2),
        'creditsVolumeInr', ROUND(COALESCE(v_credits_volume_inr, 0.00), 2),
        'creditsVolumeUsd', COALESCE(v_credits_volume_usd, 0.00),
        'debitsVolumeInr', ROUND(COALESCE(v_debits_volume_inr, 0.00), 2),
        'debitsVolumeUsd', COALESCE(v_debits_volume_usd, 0.00),
        'netLiquidBalanceInr', COALESCE(v_net_liquid_balance_inr, 0.00),
        'netLiquidBalanceUsd', COALESCE(v_net_liquid_balance_usd, 0.00),
        'volumeByCurrency', COALESCE(v_volume_by_currency, '{}'::jsonb),
        'volumeByDay', COALESCE(v_volume_by_day, '[]'::jsonb),
        'categoryBreakdown', COALESCE(v_category_breakdown, '{}'::jsonb),
        'typeBreakdown', COALESCE(v_type_breakdown, '{}'::jsonb),
        'statusBreakdown', COALESCE(v_status_breakdown, '{}'::jsonb),
        'topMerchants', COALESCE(v_top_merchants, '[]'::jsonb),
        'unconvertedCount', COALESCE(v_unconverted_count, 0),
        'unconvertedVolumeOriginal', ROUND(COALESCE(v_unconverted_volume_original, 0.00), 2),
        'hasUnconvertedRecords', (COALESCE(v_unconverted_count, 0) > 0),
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
-- 4. STREAMING SINGLE-PASS GET_FRAUD_AGGREGATES (SARGABLE TIMESTAMPS + GROUPING SETS)
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
    base_fraud AS (
        SELECT
            UPPER(COALESCE(fc.status, '')) AS status_upper,
            fc.amount,
            CASE
                WHEN COALESCE(fc.risk_score, 0) >= 80 THEN 'Critical Anomaly (Risk >= 80)'
                WHEN COALESCE(fc.risk_score, 0) >= 50 THEN 'High Threat (Risk 50-79)'
                ELSE 'Nominal Surveillance (< 50)'
            END AS risk_tier,
            CASE
                WHEN COALESCE(fc.risk_score, 0) >= 80 THEN 1
                WHEN COALESCE(fc.risk_score, 0) >= 50 THEN 2
                ELSE 3
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
          ON fx.target_currency = NULLIF(TRIM(fc.currency), '')
        WHERE (v_enforced_tenant IS NULL OR fc.tenant_id = v_enforced_tenant)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR fc.currency = p_currency)
          AND (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR fc.status = p_status)
          AND (p_customer_id IS NULL OR p_customer_id = '' OR fc.customer_id = p_customer_id)
          AND (p_start_date IS NULL OR fc.timestamp >= (p_start_date::timestamp AT TIME ZONE 'UTC'))
          AND (p_end_date IS NULL OR fc.timestamp < ((p_end_date + 1)::timestamp AT TIME ZONE 'UTC'))
    ),
    grouped_fraud AS MATERIALIZED (
        SELECT
            (GROUPING(currency) = 1 AND GROUPING(risk_tier) = 1 AND GROUPING(payment_channel) = 1 AND GROUPING(rule_triggered) = 1 AND GROUPING(case_date) = 1) AS is_total,
            (GROUPING(currency) = 0) AS is_curr,
            (GROUPING(risk_tier) = 0) AS is_tier,
            (GROUPING(payment_channel) = 0) AS is_chan,
            (GROUPING(rule_triggered) = 0) AS is_rule,
            (GROUPING(case_date) = 0) AS is_day,
            currency,
            risk_tier,
            risk_sort,
            payment_channel,
            rule_triggered,
            case_date,
            COUNT(*)::int AS cnt,
            COUNT(*) FILTER (WHERE status_upper LIKE '%FLAG%' OR status_upper LIKE '%REVIEW%' OR status_upper = 'OPEN')::int AS flagged_cnt,
            COUNT(*) FILTER (WHERE status_upper LIKE '%FROZEN%' OR status_upper LIKE '%PREVENT%' OR status_upper LIKE '%BLOCK%' OR status_upper = 'CONFIRMED')::int AS frozen_cnt,
            COUNT(*) FILTER (WHERE status_upper LIKE '%CLEAR%' OR status_upper = 'FALSE_POSITIVE')::int AS cleared_cnt,
            COALESCE(SUM(calc_inr) FILTER (WHERE (status_upper LIKE '%FROZEN%' OR status_upper LIKE '%PREVENT%' OR status_upper LIKE '%BLOCK%' OR status_upper = 'CONFIRMED') AND conv_flag), 0.00) AS prevented_inr,
            COALESCE(SUM(amount) FILTER (WHERE status_upper LIKE '%FROZEN%' OR status_upper LIKE '%PREVENT%' OR status_upper LIKE '%BLOCK%' OR status_upper = 'CONFIRMED'), 0.00) AS prevented_orig,
            COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00) AS monitored_inr,
            ROUND(SUM(amount), 2) AS orig_sum,
            ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag), 0.00), 2) AS inr_sum,
            ROUND(AVG(eff_rate) FILTER (WHERE conv_flag), 6) AS avg_rate,
            MAX(eff_date) AS max_eff_date,
            COUNT(*) FILTER (WHERE NOT conv_flag)::int AS unconv_cnt
        FROM base_fraud
        GROUP BY GROUPING SETS ((), (currency), (risk_tier, risk_sort), (payment_channel), (rule_triggered), (case_date))
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
            (SELECT jsonb_agg(jsonb_build_object('tier', g.risk_tier, 'count', g.cnt, 'volumeInr', ROUND(g.inr_sum, 0)) ORDER BY g.risk_sort)
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
-- 5. STREAMING SINGLE-PASS GET_SUPPORT_AGGREGATES (ALIGNED WITH 20261124 HARDENING)
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

REVOKE ALL ON FUNCTION public.get_support_aggregates(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_aggregates(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. STREAMING SINGLE-PASS GET_KYC_AGGREGATES (GROUPING SETS)
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

    WITH grouped_kyc AS MATERIALIZED (
        SELECT
            (GROUPING(COALESCE(NULLIF(TRIM(document_type), ''), 'Unspecified')) = 1) AS is_total,
            COALESCE(NULLIF(TRIM(document_type), ''), 'Unspecified') AS doc_label,
            COUNT(*)::int AS cnt,
            COUNT(*) FILTER (WHERE status = 'Verified')::int AS verified_cnt,
            COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending_cnt,
            COUNT(*) FILTER (WHERE status = 'Under Review')::int AS review_cnt
        FROM public.kyc_records
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
        GROUP BY GROUPING SETS ((), (COALESCE(NULLIF(TRIM(document_type), ''), 'Unspecified')))
    )
    SELECT
        kt.cnt,
        kt.verified_cnt,
        kt.pending_cnt,
        kt.review_cnt,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('label', g.doc_label, 'value', g.cnt) ORDER BY g.cnt DESC)
             FROM grouped_kyc g
             WHERE NOT g.is_total),
            '[]'::jsonb
        )
    INTO
        v_total_records,
        v_verified_count,
        v_pending_count,
        v_review_count,
        v_doc_type_dist
    FROM grouped_kyc kt
    WHERE kt.is_total;

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
        'totalRecords', COALESCE(v_total_records, 0),
        'verifiedCount', COALESCE(v_verified_count, 0),
        'pendingCount', COALESCE(v_pending_count, 0),
        'reviewCount', COALESCE(v_review_count, 0),
        'tierDistribution', COALESCE(v_tier_dist, '[]'::jsonb),
        'docTypeDistribution', COALESCE(v_doc_type_dist, '[]'::jsonb),
        'tenantScope', COALESCE(v_enforced_tenant, 'GLOBAL_ALL_TENANTS'),
        'callerRole', v_caller_role,
        'source', 'supabase_rpc_secure'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_kyc_aggregates(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kyc_aggregates(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. INDEX-ALIGNED GET_PLATFORM_EXECUTIVE_KPIS
--    - Filters fraud_cases to idx_fraud_cases_active_risk partial index
--    - Short-circuits FX joins when amount_inr is pre-populated
--    - Single scan per table
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

    -- Single pass over transactions with short-circuited pre-computed latest_fx
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
          ON t.amount_inr IS NULL
         AND NULLIF(TRIM(t.currency), '') <> 'INR'
         AND (t.exchange_rate IS NULL OR t.exchange_rate <= 0)
         AND fx.target_currency = NULLIF(TRIM(t.currency), '')
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

    -- Partial-index scan over active/frozen fraud_cases only (idx_fraud_cases_active_risk)
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
      ON fc.amount_inr IS NULL
     AND NULLIF(TRIM(fc.currency), '') <> 'INR'
     AND (fc.exchange_rate IS NULL OR fc.exchange_rate <= 0)
     AND fx.target_currency = NULLIF(TRIM(fc.currency), '')
    WHERE fc.status IN ('Frozen Escrow', 'Flagged', 'In Review');

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
        'settledVolumeYtd', ROUND(COALESCE(v_settled_volume_ytd, 0.00), 2),
        'institutionalMrr', ROUND(COALESCE(v_institutional_mrr, 0.00), 2),
        'preventedFraudVolume', ROUND(COALESCE(v_prevented_fraud_volume, 0.00), 2),
        'slaCompliancePct', COALESCE(v_sla_compliance_pct, 0.0),
        'complianceScore', COALESCE(v_compliance_score, 0.0),
        'activeUsers', COALESCE(v_active_users, 0),
        'netLiquidBalance', ROUND(COALESCE(v_net_liquid_balance, 0.00), 2),
        'riskExposureScore', COALESCE(v_risk_exposure_score, 0),
        'source', 'supabase_rpc_secure'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_executive_kpis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_executive_kpis() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. STREAMING SINGLE-PASS GET_TRANSFER_INTELLIGENCE_AGGREGATES (GROUPING SETS)
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

    WITH base_tx AS (
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
    grouped_ti AS MATERIALIZED (
        SELECT
            (GROUPING(status_label) = 1 AND GROUPING(category_label) = 1 AND GROUPING(currency_label) = 1 AND GROUPING(channel_label) = 1 AND GROUPING(hour_bucket) = 1) AS is_total,
            (GROUPING(status_label) = 0) AS is_status,
            (GROUPING(category_label) = 0) AS is_cat,
            (GROUPING(currency_label) = 0) AS is_curr,
            (GROUPING(channel_label) = 0) AS is_chan,
            (GROUPING(hour_bucket) = 0) AS is_hour,
            status_label,
            category_label,
            currency_label,
            channel_label,
            hour_bucket,
            COUNT(*)::int AS cnt,
            ROUND(COALESCE(SUM(amount), 0.00), 2) AS vol,
            COUNT(*) FILTER (WHERE status_lower IN ('settled', 'escrow secured', 'success', 'completed'))::int AS success_cnt,
            COUNT(*) FILTER (WHERE status_lower IN ('pending', 'clearing'))::int AS pending_cnt,
            COUNT(*) FILTER (WHERE status_lower = 'failed')::int AS failed_cnt,
            COUNT(*) FILTER (WHERE status_lower = 'reversed')::int AS reversed_cnt,
            COUNT(*) FILTER (WHERE is_flagged)::int AS fraud_cnt
        FROM base_tx
        GROUP BY GROUPING SETS ((), (status_label), (category_label), (currency_label), (channel_label), (hour_bucket))
    )
    SELECT
        ct.cnt,
        ct.vol,
        ct.success_cnt,
        ct.pending_cnt,
        ct.failed_cnt,
        ct.reversed_cnt,
        ct.fraud_cnt,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('label', g.status_label, 'value', g.cnt)) FROM grouped_ti g WHERE g.is_status), '[]'::jsonb),
        COALESCE((SELECT jsonb_agg(jsonb_build_object('label', g.category_label, 'value', g.cnt)) FROM grouped_ti g WHERE g.is_cat), '[]'::jsonb),
        COALESCE((SELECT jsonb_object_agg(g.currency_label, g.vol) FROM grouped_ti g WHERE g.is_curr), '{}'::jsonb),
        COALESCE((SELECT jsonb_agg(jsonb_build_object('label', g.channel_label, 'value', g.cnt)) FROM grouped_ti g WHERE g.is_chan), '[]'::jsonb),
        COALESCE((SELECT jsonb_agg(jsonb_build_object('hour', g.hour_bucket, 'volume', g.vol) ORDER BY g.hour_bucket ASC) FROM grouped_ti g WHERE g.is_hour), '[]'::jsonb)
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
    FROM grouped_ti ct
    WHERE ct.is_total;

    RETURN jsonb_build_object(
        'totalTransfers', COALESCE(v_total_transfers, 0),
        'totalVolume', ROUND(COALESCE(v_total_volume, 0.00), 2),
        'successCount', COALESCE(v_success_count, 0),
        'pendingCount', COALESCE(v_pending_count, 0),
        'failedCount', COALESCE(v_failed_count, 0),
        'reversedCount', COALESCE(v_reversed_count, 0),
        'avgAmount', CASE WHEN COALESCE(v_total_transfers, 0) > 0 THEN ROUND(v_total_volume / v_total_transfers, 2) ELSE 0.00 END,
        'fraudFlaggedCount', COALESCE(v_fraud_flagged_count, 0),
        'statusDistribution', COALESCE(v_status_dist, '[]'::jsonb),
        'categoryMix', COALESCE(v_category_dist, '[]'::jsonb),
        'currencyExposure', COALESCE(v_currency_exposure, '{}'::jsonb),
        'channelPerformance', COALESCE(v_channel_perf, '[]'::jsonb),
        'hourlyVelocity', COALESCE(v_hourly_velocity, '[]'::jsonb),
        'rejectedRecordsCount', 0,
        'source', 'supabase_rpc_secure'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_transfer_intelligence_aggregates(TEXT, DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_transfer_intelligence_aggregates(TEXT, DATE, DATE, TEXT) TO authenticated, service_role;

-- Refresh planner statistics after index deployment
ANALYZE public.transactions;
ANALYZE public.fraud_cases;
ANALYZE public.kyc_records;
ANALYZE public.support_tickets;
ANALYZE public.profiles;
ANALYZE public.exchange_rates;
