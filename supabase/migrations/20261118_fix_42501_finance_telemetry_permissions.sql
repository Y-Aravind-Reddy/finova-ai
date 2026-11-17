-- ==============================================================================
-- FINOVA AI — POSTGRESQL 42501 PERMISSION & TELEMETRY HARDENING MIGRATION
-- Migration ID: 20261118_fix_42501_finance_telemetry_permissions
-- Target Project Ref: rjudrmnnpwlovpkbwnte
-- Status: Forward-Only, Idempotent, Non-Destructive (Zero DROP TABLE)
--
-- Resolves:
-- 1. 42501: permission denied for table fraud_cases
-- 2. 42501: permission denied for function get_fraud_aggregates
-- 3. 42501: permission denied for function get_transaction_aggregates
-- 4. 42501: permission denied for table kyc_records
--
-- Security Guarantees:
-- - Zero RLS disabling, zero USING (true) on private tables, zero anon table access.
-- - SECURITY INVOKER preserved for aggregate RPCs so table RLS applies.
-- - Canonical roles strictly enforced:
--     SUPER_ADMIN (aravindvicky629@gmail.com): platform-wide authorized access.
--     ADMIN / FINANCE_ANALYST: tenant-scoped fraud, KYC, and transaction telemetry.
--     SUPPORT_EXECUTIVE: tenant-scoped support, transactions, read-only KYC; NO fraud_cases / get_fraud_aggregates.
--     CUSTOMER: self-scoped transactions and KYC only; NO fraud_cases / get_fraud_aggregates / cross-user access.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA USAGE & AUTHORITATIVE DB-FIRST IDENTITY HELPERS
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid() AND p.status::text = 'Active' LIMIT 1),
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
        (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.status::text = 'Active' LIMIT 1),
        ''
    );
$$;

REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_auth_tenant() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_tenant() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA READINESS (NON-DESTRUCTIVE) & PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(15, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'Online';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_flagged_fraud BOOLEAN DEFAULT FALSE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(15, 2);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_tenant_status
    ON public.fraud_cases (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_tenant_timestamp
    ON public.fraud_cases (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_records_tenant_user_status
    ON public.kyc_records (tenant_id, user_id, status);

-- ------------------------------------------------------------------------------
-- 3. TABLE GRANTS FOR SECURITY INVOKER TELEMETRY & SUPPORTING TABLES
--    Revoke anonymous/public access; restore minimum required privileges
--    for authenticated users (enforced by RLS).
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

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
        public.get_auth_role() = 'SUPER_ADMIN'
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role::text = 'SUPER_ADMIN'
              AND p.status::text = 'Active'
              AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
        )
    )
    WITH CHECK (
        public.get_auth_role() = 'SUPER_ADMIN'
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role::text = 'SUPER_ADMIN'
              AND p.status::text = 'Active'
              AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
        )
    );

CREATE POLICY "staff_tenant_transactions_select" ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE')
        AND tenant_id = public.get_auth_tenant()
    );

CREATE POLICY "customer_own_transactions_select" ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'CUSTOMER'
        AND user_id = auth.uid()
        AND tenant_id = public.get_auth_tenant()
    );

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.exchange_rates FROM PUBLIC;
GRANT SELECT ON TABLE public.exchange_rates TO anon, authenticated;
GRANT ALL ON TABLE public.exchange_rates TO service_role;

DROP POLICY IF EXISTS "Allow public read access to exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Allow read access to exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "read_all_rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "public_read_exchange_rates" ON public.exchange_rates;
CREATE POLICY "public_read_exchange_rates" ON public.exchange_rates
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- ------------------------------------------------------------------------------
-- 4. RECONCILE PUBLIC.FRAUD_CASES GRANTS & RLS POLICIES
--    Fixes Error #1: 42501: permission denied for table fraud_cases
--    Explicitly removes any stale SUPPORT_EXECUTIVE policy drift.
-- ------------------------------------------------------------------------------
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

-- Super Admin: platform-wide access (verified active single Super Admin email)
CREATE POLICY "super_admin_all_fraud" ON public.fraud_cases
    FOR ALL
    TO authenticated
    USING (
        public.get_auth_role() = 'SUPER_ADMIN'
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role::text = 'SUPER_ADMIN'
              AND p.status::text = 'Active'
              AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
        )
    )
    WITH CHECK (
        public.get_auth_role() = 'SUPER_ADMIN'
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role::text = 'SUPER_ADMIN'
              AND p.status::text = 'Active'
              AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
        )
    );

-- Admin & Finance Analyst: tenant-scoped surveillance read access
CREATE POLICY "staff_tenant_fraud_select" ON public.fraud_cases
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    );

-- Admin & Finance Analyst: tenant-scoped case disposition updates
CREATE POLICY "staff_tenant_fraud_update" ON public.fraud_cases
    FOR UPDATE
    TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    )
    WITH CHECK (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    );

-- ------------------------------------------------------------------------------
-- 5. RECONCILE PUBLIC.KYC_RECORDS GRANTS & RLS POLICIES
--    Fixes Error #4: permission denied for table kyc_records
-- ------------------------------------------------------------------------------
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

-- Super Admin: platform-wide KYC access (verified active single Super Admin email)
CREATE POLICY "super_admin_all_kyc" ON public.kyc_records
    FOR ALL
    TO authenticated
    USING (
        public.get_auth_role() = 'SUPER_ADMIN'
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role::text = 'SUPER_ADMIN'
              AND p.status::text = 'Active'
              AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
        )
    )
    WITH CHECK (
        public.get_auth_role() = 'SUPER_ADMIN'
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role::text = 'SUPER_ADMIN'
              AND p.status::text = 'Active'
              AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
        )
    );

-- Admin & Finance Analyst: tenant-scoped KYC management
CREATE POLICY "staff_tenant_kyc_manage" ON public.kyc_records
    FOR ALL
    TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    )
    WITH CHECK (
        public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST')
        AND tenant_id = public.get_auth_tenant()
    );

-- Support Executive: tenant-scoped read-only KYC lookup for customer dispute verification
CREATE POLICY "support_view_tenant_kyc" ON public.kyc_records
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'SUPPORT_EXECUTIVE'
        AND tenant_id = public.get_auth_tenant()
    );

-- Customer: read strictly own KYC records within own tenant
CREATE POLICY "customer_read_own_kyc" ON public.kyc_records
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        AND tenant_id = public.get_auth_tenant()
    );

-- Customer: submit own KYC records in pending/review state only (cannot self-verify)
CREATE POLICY "customer_insert_own_kyc" ON public.kyc_records
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND tenant_id = public.get_auth_tenant()
        AND status IN ('Pending', 'Under Review')
    );

-- ------------------------------------------------------------------------------
-- 6. RECONCILE PUBLIC.GET_FRAUD_AGGREGATES (SECURITY INVOKER, COMPLETE JSONB)
--    Fixes Error #2: permission denied for function get_fraud_aggregates
--    Eliminates conflicting 2-arg & stubbed overloads; restores full INR base
--    volumes + riskTierDistribution + channelDistribution + ruleDistribution + casesByDay.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_fraud_aggregates(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_fraud_aggregates(TEXT, TEXT, DATE, DATE, TEXT, TEXT);

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
    -- [1] Mandatory authentication check
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required to execute fraud surveillance aggregation.'
            USING ERRCODE = '42501';
    END IF;

    -- [2] Resolve caller identity authoritatively from public.profiles
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

    -- [3] Role authorization: strictly SUPER_ADMIN, ADMIN, FINANCE_ANALYST
    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST') THEN
        RAISE EXCEPTION 'Access Denied: Role "%" is prohibited from fraud surveillance analytics.', v_caller_role
            USING ERRCODE = '42501';
    END IF;

    -- [4] Strict tenant boundary enforcement
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

    -- [5] Lookup USD benchmark rate (INR base)
    SELECT rate INTO v_usd_rate
    FROM public.exchange_rates
    WHERE base_currency = 'INR' AND target_currency = 'USD' AND rate > 0
    ORDER BY effective_date DESC
    LIMIT 1;
    IF v_usd_rate IS NULL OR v_usd_rate <= 0 THEN
        v_usd_rate := 84.070000;
    END IF;

    -- [6] Core fraud totals & currency conversion
    WITH eligible_fraud AS (
        SELECT
            fc.id,
            fc.status,
            fc.amount,
            COALESCE(NULLIF(TRIM(fc.currency), ''), 'UNVERIFIED') AS currency,
            CASE
                WHEN fc.amount_inr IS NOT NULL AND fc.amount_inr >= 0 THEN fc.amount_inr
                WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'INR' THEN fc.amount
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN ROUND(fc.amount * fc.exchange_rate, 2)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(fc.amount * fx.rate, 2)
                ELSE NULL
            END AS calculated_amount_inr,
            CASE
                WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'INR' THEN TRUE
                WHEN fc.amount_inr IS NOT NULL AND fc.amount_inr >= 0 THEN TRUE
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN TRUE
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN TRUE
                ELSE FALSE
            END AS is_converted
        FROM public.fraud_cases fc
        LEFT JOIN LATERAL (
            SELECT rate
            FROM public.exchange_rates
            WHERE base_currency = 'INR'
              AND target_currency = COALESCE(NULLIF(TRIM(fc.currency), ''), '')
              AND rate > 0
            ORDER BY effective_date DESC
            LIMIT 1
        ) fx ON true
        WHERE (v_enforced_tenant IS NULL OR fc.tenant_id = v_enforced_tenant)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR fc.currency = p_currency)
          AND (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR fc.status = p_status)
          AND (p_customer_id IS NULL OR p_customer_id = '' OR fc.customer_id = p_customer_id)
          AND (p_start_date IS NULL OR fc.timestamp::date >= p_start_date)
          AND (p_end_date IS NULL OR fc.timestamp::date <= p_end_date)
    )
    SELECT
        COUNT(*)::int,
        COUNT(*) FILTER (WHERE UPPER(status) LIKE '%FLAG%' OR UPPER(status) LIKE '%REVIEW%' OR UPPER(status) = 'OPEN')::int,
        COUNT(*) FILTER (WHERE UPPER(status) LIKE '%FROZEN%' OR UPPER(status) LIKE '%PREVENT%' OR UPPER(status) LIKE '%BLOCK%' OR UPPER(status) = 'CONFIRMED')::int,
        COUNT(*) FILTER (WHERE UPPER(status) LIKE '%CLEAR%' OR UPPER(status) = 'FALSE_POSITIVE')::int,
        COALESCE(SUM(calculated_amount_inr) FILTER (WHERE (UPPER(status) LIKE '%FROZEN%' OR UPPER(status) LIKE '%PREVENT%' OR UPPER(status) LIKE '%BLOCK%' OR UPPER(status) = 'CONFIRMED') AND is_converted = true), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE UPPER(status) LIKE '%FROZEN%' OR UPPER(status) LIKE '%PREVENT%' OR UPPER(status) LIKE '%BLOCK%' OR UPPER(status) = 'CONFIRMED'), 0.00),
        COALESCE(SUM(calculated_amount_inr) FILTER (WHERE is_converted = true), 0.00),
        COUNT(*) FILTER (WHERE is_converted = false)::int
    INTO
        v_total_cases,
        v_flagged_count,
        v_frozen_count,
        v_cleared_count,
        v_prevented_volume_inr,
        v_prevented_volume_original,
        v_monitored_volume_inr,
        v_unconverted_cases
    FROM eligible_fraud;

    v_prevented_volume_usd := ROUND(v_prevented_volume_inr / v_usd_rate, 2);
    v_monitored_volume_usd := ROUND(v_monitored_volume_inr / v_usd_rate, 2);

    -- [7] Multi-dimensional distributions & currency breakdown
    WITH base_fraud AS (
        SELECT
            fc.status,
            fc.amount,
            COALESCE(fc.risk_score, 0) AS risk_score,
            COALESCE(NULLIF(TRIM(fc.payment_channel), ''), 'SWIFT GPI Cross-Border') AS payment_channel,
            COALESCE(NULLIF(TRIM(fc.rule_triggered), ''), 'Surveillance Rule Triggered') AS rule_triggered,
            fc.timestamp::date AS case_date,
            COALESCE(NULLIF(TRIM(fc.currency), ''), 'UNVERIFIED') AS currency,
            CASE
                WHEN fc.amount_inr IS NOT NULL AND fc.amount_inr >= 0 THEN fc.amount_inr
                WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'INR' THEN fc.amount
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN ROUND(fc.amount * fc.exchange_rate, 2)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(fc.amount * fx.rate, 2)
                ELSE NULL
            END AS calc_inr,
            CASE
                WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'INR' THEN 1.000000
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN fc.exchange_rate
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                ELSE NULL
            END AS eff_rate,
            fx.effective_date AS eff_date,
            CASE
                WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'INR' THEN TRUE
                WHEN fc.amount_inr IS NOT NULL AND fc.amount_inr >= 0 THEN TRUE
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN TRUE
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN TRUE
                ELSE FALSE
            END AS conv_flag
        FROM public.fraud_cases fc
        LEFT JOIN LATERAL (
            SELECT rate, effective_date
            FROM public.exchange_rates
            WHERE base_currency = 'INR'
              AND target_currency = COALESCE(NULLIF(TRIM(fc.currency), ''), '')
              AND rate > 0
            ORDER BY effective_date DESC
            LIMIT 1
        ) fx ON true
        WHERE (v_enforced_tenant IS NULL OR fc.tenant_id = v_enforced_tenant)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR fc.currency = p_currency)
          AND (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR fc.status = p_status)
          AND (p_customer_id IS NULL OR p_customer_id = '' OR fc.customer_id = p_customer_id)
          AND (p_start_date IS NULL OR fc.timestamp::date >= p_start_date)
          AND (p_end_date IS NULL OR fc.timestamp::date <= p_end_date)
    )
    SELECT
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
                    ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00), 2) AS inr_sum,
                    ROUND(AVG(eff_rate) FILTER (WHERE conv_flag = true), 6) AS avg_rate,
                    MAX(eff_date) AS max_eff_date,
                    COUNT(*) FILTER (WHERE conv_flag = false)::int AS unconv_rows
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
                    ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00)) AS vol
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
                    ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00)) AS vol
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
                    ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE (UPPER(status) LIKE '%FROZEN%' OR UPPER(status) LIKE '%PREVENT%' OR UPPER(status) LIKE '%BLOCK%' OR UPPER(status) = 'CONFIRMED') AND conv_flag = true), 0.00)) AS prev_vol
                FROM base_fraud
                WHERE case_date IS NOT NULL
                GROUP BY case_date
                ORDER BY case_date DESC
                LIMIT 30
            ) days),
            '[]'::jsonb
        )
    INTO
        v_volume_by_currency,
        v_risk_tier_dist,
        v_channel_dist,
        v_rule_dist,
        v_cases_by_day;

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
-- 7. RECONCILE PUBLIC.GET_TRANSACTION_AGGREGATES (SECURITY INVOKER, ERRCODE 42501)
--    Fixes Error #3: permission denied for function get_transaction_aggregates
--    Ensures full INR breakdowns + customer self-scoped access + proper EXECUTE grants.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_transaction_aggregates(TEXT, UUID, DATE, DATE, TEXT, TEXT);

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

    SELECT rate INTO v_usd_rate
    FROM public.exchange_rates
    WHERE base_currency = 'INR' AND target_currency = 'USD' AND rate > 0
    ORDER BY effective_date DESC
    LIMIT 1;
    IF v_usd_rate IS NULL OR v_usd_rate <= 0 THEN
        v_usd_rate := 84.070000;
    END IF;

    WITH eligible_tx AS (
        SELECT
            t.id,
            t.date,
            COALESCE(NULLIF(TRIM(t.category), ''), 'Operational') AS category,
            COALESCE(NULLIF(TRIM(t.merchant), ''), 'Global Clearing') AS merchant,
            COALESCE(NULLIF(TRIM(t.type), ''), 'Debit') AS type,
            COALESCE(NULLIF(TRIM(t.status), ''), 'Settled') AS status,
            t.amount,
            COALESCE(NULLIF(TRIM(t.currency), ''), 'UNVERIFIED') AS currency,
            CASE
                WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN t.amount_inr
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN t.amount
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN ROUND(t.amount * t.exchange_rate, 2)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(t.amount * fx.rate, 2)
                ELSE NULL
            END AS calculated_amount_inr,
            CASE
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN 1.000000
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN t.exchange_rate
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                ELSE NULL
            END AS applied_rate,
            fx.effective_date AS fx_effective_date,
            CASE
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN TRUE
                WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN TRUE
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN TRUE
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN TRUE
                ELSE FALSE
            END AS is_converted
        FROM public.transactions t
        LEFT JOIN LATERAL (
            SELECT rate, effective_date
            FROM public.exchange_rates
            WHERE base_currency = 'INR'
              AND target_currency = COALESCE(NULLIF(TRIM(t.currency), ''), '')
              AND rate > 0
            ORDER BY effective_date DESC
            LIMIT 1
        ) fx ON true
        WHERE (v_enforced_tenant IS NULL OR t.tenant_id = v_enforced_tenant)
          AND (v_enforced_user_id IS NULL OR t.user_id = v_enforced_user_id)
          AND (p_start_date IS NULL OR t.date >= p_start_date)
          AND (p_end_date IS NULL OR t.date <= p_end_date)
          AND (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR t.status = p_status)
          AND (p_type IS NULL OR p_type = '' OR p_type = 'ALL' OR t.type = p_type)
    )
    SELECT
        COUNT(*)::int,
        COUNT(*) FILTER (WHERE LOWER(status) IN ('settled', 'escrow secured', 'completed', 'success'))::int,
        COALESCE(SUM(calculated_amount_inr) FILTER (WHERE LOWER(status) IN ('settled', 'escrow secured', 'completed', 'success') AND is_converted = true), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE LOWER(status) IN ('settled', 'escrow secured', 'completed', 'success')), 0.00),
        COALESCE(SUM(calculated_amount_inr) FILTER (WHERE LOWER(type) IN ('credit', 'deposit') AND is_converted = true), 0.00),
        COALESCE(SUM(calculated_amount_inr) FILTER (WHERE LOWER(type) NOT IN ('credit', 'deposit') AND is_converted = true), 0.00),
        COUNT(*) FILTER (WHERE is_converted = false)::int,
        COALESCE(SUM(amount) FILTER (WHERE is_converted = false), 0.00)
    INTO
        v_total_count,
        v_settled_count,
        v_settled_volume_inr,
        v_settled_volume_original,
        v_credits_volume_inr,
        v_debits_volume_inr,
        v_unconverted_count,
        v_unconverted_volume_original
    FROM eligible_tx;

    v_net_liquid_balance_inr := ROUND(v_credits_volume_inr - v_debits_volume_inr, 2);
    v_settled_volume_usd := ROUND(v_settled_volume_inr / v_usd_rate, 2);
    v_credits_volume_usd := ROUND(v_credits_volume_inr / v_usd_rate, 2);
    v_debits_volume_usd := ROUND(v_debits_volume_inr / v_usd_rate, 2);
    v_net_liquid_balance_usd := ROUND(v_net_liquid_balance_inr / v_usd_rate, 2);

    WITH base_filtered AS (
        SELECT
            t.date,
            t.amount,
            COALESCE(NULLIF(TRIM(t.currency), ''), 'UNVERIFIED') AS currency,
            COALESCE(NULLIF(TRIM(t.category), ''), 'Operational') AS category,
            COALESCE(NULLIF(TRIM(t.merchant), ''), 'Global Clearing') AS merchant,
            CASE WHEN LOWER(COALESCE(NULLIF(TRIM(t.type), ''), 'Debit')) IN ('credit', 'deposit') THEN 'Credit' ELSE 'Debit' END AS tx_type,
            COALESCE(NULLIF(TRIM(t.status), ''), 'Settled') AS status,
            CASE
                WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN t.amount_inr
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN t.amount
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN ROUND(t.amount * t.exchange_rate, 2)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(t.amount * fx.rate, 2)
                ELSE NULL
            END AS calc_inr,
            CASE
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN 1.000000
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN t.exchange_rate
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                ELSE NULL
            END AS eff_rate,
            fx.effective_date AS eff_date,
            CASE
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN TRUE
                WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN TRUE
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN TRUE
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN TRUE
                ELSE FALSE
            END AS conv_flag
        FROM public.transactions t
        LEFT JOIN LATERAL (
            SELECT rate, effective_date
            FROM public.exchange_rates
            WHERE base_currency = 'INR'
              AND target_currency = COALESCE(NULLIF(TRIM(t.currency), ''), '')
              AND rate > 0
            ORDER BY effective_date DESC
            LIMIT 1
        ) fx ON true
        WHERE (v_enforced_tenant IS NULL OR t.tenant_id = v_enforced_tenant)
          AND (v_enforced_user_id IS NULL OR t.user_id = v_enforced_user_id)
          AND (p_start_date IS NULL OR t.date >= p_start_date)
          AND (p_end_date IS NULL OR t.date <= p_end_date)
          AND (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR t.status = p_status)
          AND (p_type IS NULL OR p_type = '' OR p_type = 'ALL' OR t.type = p_type)
    )
    SELECT
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
                    ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00), 2) AS inr_sum,
                    ROUND(AVG(eff_rate) FILTER (WHERE conv_flag = true), 6) AS avg_rate,
                    MAX(eff_date) AS max_eff_date,
                    COUNT(*) FILTER (WHERE conv_flag = false)::int AS unconv_rows
                FROM base_filtered
                GROUP BY currency
            ) c),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('date', d_date::text, 'volumeInr', d_vol, 'count', d_cnt) ORDER BY d_date ASC)
             FROM (
                 SELECT date AS d_date, ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00), 2) AS d_vol, COUNT(*)::int AS d_cnt
                 FROM base_filtered
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
                 SELECT category, COUNT(*)::int AS cnt, ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00), 2) AS vol
                 FROM base_filtered
                 GROUP BY category
             ) cats),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_object_agg(tx_type, jsonb_build_object('count', cnt, 'volumeInr', vol))
             FROM (
                 SELECT tx_type, COUNT(*)::int AS cnt, ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00), 2) AS vol
                 FROM base_filtered
                 GROUP BY tx_type
             ) tys),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_object_agg(status, jsonb_build_object('count', cnt, 'volumeInr', vol))
             FROM (
                 SELECT status, COUNT(*)::int AS cnt, ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00), 2) AS vol
                 FROM base_filtered
                 GROUP BY status
             ) sts),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('merchant', merchant, 'count', cnt, 'volumeInr', vol))
             FROM (
                 SELECT merchant, COUNT(*)::int AS cnt, ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00), 2) AS vol
                 FROM base_filtered
                 GROUP BY merchant
                 ORDER BY vol DESC
                 LIMIT 6
             ) merch),
            '[]'::jsonb
        )
    INTO
        v_volume_by_currency,
        v_volume_by_day,
        v_category_breakdown,
        v_type_breakdown,
        v_status_breakdown,
        v_top_merchants;

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
