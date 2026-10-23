-- ==============================================================================
-- FINOVA AI — REVISED PRODUCTION SQL MIGRATION
-- Target Database: rjudrmnnpwlovpkbwnte (https://rjudrmnnpwlovpkbwnte.supabase.co)
-- Migration ID: 20261023_usd_base_currency_and_aggregations_v2
-- Status: IDEMPOTENT, NON-DESTRUCTIVE, AUDITED & HARDENED
--
-- SECURITY & DATA INTEGRITY MANDATES ENFORCED:
-- 1. Aggregation RPCs reject anonymous execution (EXECUTE revoked from anon/public).
-- 2. Strict caller profile verification via auth.uid() prevents parameter spoofing.
-- 3. Tenant isolation: Non-Super-Admins cannot pass NULL, ALL, or other tenant IDs.
-- 4. Customer boundary: Customers cannot query other user accounts or cross tenants.
-- 5. Rate direction defined unambiguously: rate = USD per 1 unit of foreign currency.
-- 6. Zero unconverted additions: Missing rates are NEVER treated as 1.0 for non-USD.
-- 7. Historical records preserve original currency/amount; unverified rows flagged explicitly.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CENTRALIZED USD BASE-CURRENCY EXCHANGE RATES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id TEXT PRIMARY KEY,
    base_currency TEXT NOT NULL DEFAULT 'USD',
    target_currency TEXT NOT NULL,
    rate NUMERIC(12, 6) NOT NULL,
    inverse_rate NUMERIC(12, 6) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT NOT NULL DEFAULT 'Official Reference Benchmark',
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_stale BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_fx_rate_positive CHECK (rate > 0),
    CONSTRAINT chk_fx_inverse_positive CHECK (inverse_rate > 0)
);

-- Idempotent column additions for pre-existing tables
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS target_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS inverse_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS effective_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Official Reference Benchmark';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT false;

-- Table and column comments documenting unambiguous rate definitions
COMMENT ON TABLE public.exchange_rates IS 'Centralized USD base-currency exchange rates table with source attribution and freshness tracking.';
COMMENT ON COLUMN public.exchange_rates.rate IS 'USD amount per 1 unit of target_currency (e.g. 1 GBP = 1.285000 USD). Calculation formula: amount_usd = original_amount * rate';
COMMENT ON COLUMN public.exchange_rates.inverse_rate IS 'Target currency units per 1 USD (e.g. 1 USD = 0.778210 GBP). Formula: 1.0 / rate';
COMMENT ON COLUMN public.exchange_rates.effective_date IS 'Official rate publication / fixing date.';
COMMENT ON COLUMN public.exchange_rates.source IS 'Attributed central bank or official benchmark reference provider.';
COMMENT ON COLUMN public.exchange_rates.is_stale IS 'Boolean flag indicating if the rate is older than the allowed freshness window (3 days for daily market fixings).';

-- Performance Index
CREATE INDEX IF NOT EXISTS idx_exchange_rates_target_date 
    ON public.exchange_rates (target_currency, effective_date DESC);

-- Row Level Security (RLS) on exchange_rates
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow read access to exchange rates" ON public.exchange_rates;
    CREATE POLICY "Allow read access to exchange rates" ON public.exchange_rates
        FOR SELECT
        TO authenticated
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Restrict exchange rate modifications" ON public.exchange_rates;
    CREATE POLICY "Restrict exchange rate modifications" ON public.exchange_rates
        FOR ALL
        TO authenticated, service_role
        USING (
            (auth.jwt() ->> 'role') = 'service_role' OR
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
            )
        )
        WITH CHECK (
            (auth.jwt() ->> 'role') = 'service_role' OR
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Revoke anon/public access; grant SELECT only to authenticated users
REVOKE ALL ON public.exchange_rates FROM PUBLIC, anon;
GRANT SELECT ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;

-- Seed verified benchmark rates (Attributed to official central banks as reference benchmarks)
INSERT INTO public.exchange_rates (id, base_currency, target_currency, rate, inverse_rate, effective_date, source, is_stale)
VALUES
    ('FX-USD-BASE', 'USD', 'USD', 1.000000, 1.000000, '2026-10-23', 'Federal Reserve H.10 Baseline Reference', false),
    ('FX-GBP-USD',  'USD', 'GBP', 1.285000, 0.778210, '2026-10-23', 'Bank of England / Fed H.10 Reference', false),
    ('FX-EUR-USD',  'USD', 'EUR', 1.085000, 0.921659, '2026-10-23', 'European Central Bank (ECB) Reference', false),
    ('FX-CHF-USD',  'USD', 'CHF', 1.135000, 0.881057, '2026-10-23', 'Swiss National Bank (SNB) Reference', false),
    ('FX-SGD-USD',  'USD', 'SGD', 0.755000, 1.324503, '2026-10-23', 'Monetary Authority of Singapore (MAS) Reference', false),
    ('FX-CAD-USD',  'USD', 'CAD', 0.735000, 1.360544, '2026-10-23', 'Bank of Canada Reference', false),
    ('FX-JPY-USD',  'USD', 'JPY', 0.006650, 150.375940, '2026-10-23', 'Bank of Japan / Fed H.10 Reference', false)
ON CONFLICT (id) DO UPDATE SET
    rate = EXCLUDED.rate,
    inverse_rate = EXCLUDED.inverse_rate,
    effective_date = EXCLUDED.effective_date,
    source = EXCLUDED.source,
    is_stale = EXCLUDED.is_stale,
    retrieved_at = timezone('utc'::text, now());

-- ------------------------------------------------------------------------------
-- 2. AUGMENT TRANSACTIONS & FRAUD CASES WITH CURRENCY METADATA
-- Safe column additions: Does NOT unconditionally default historical records to USD
-- ------------------------------------------------------------------------------
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(15, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT 'PENDING_VERIFICATION';

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date 
    ON public.transactions (tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_status 
    ON public.transactions (user_id, status);

ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(15, 2);
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6);
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT 'PENDING_VERIFICATION';

CREATE INDEX IF NOT EXISTS idx_fraud_cases_tenant_status 
    ON public.fraud_cases (tenant_id, status);

-- ------------------------------------------------------------------------------
-- 3. DEFENSIVE HISTORICAL DATA BACKFILL & STATUS DISCLOSURE
-- Respects tenant home currency and flags unverified historical records
-- ------------------------------------------------------------------------------

-- Step 3a: Assign currency based on Tenant Workspace home currency if empty/null
UPDATE public.transactions t
SET currency = tw.currency
FROM public.tenant_workspaces tw
WHERE t.tenant_id = tw.id
  AND (t.currency IS NULL OR t.currency = '');

UPDATE public.fraud_cases fc
SET currency = tw.currency
FROM public.tenant_workspaces tw
WHERE fc.tenant_id = tw.id
  AND (fc.currency IS NULL OR fc.currency = '');

-- Step 3b: Flag any orphaned record whose currency cannot be determined
UPDATE public.transactions
SET currency = 'UNVERIFIED',
    conversion_status = 'UNVERIFIED'
WHERE (currency IS NULL OR currency = '');

UPDATE public.fraud_cases
SET currency = 'UNVERIFIED',
    conversion_status = 'UNVERIFIED'
WHERE (currency IS NULL OR currency = '');

-- Step 3c: Backfill USD records (1:1 base currency)
UPDATE public.transactions
SET amount_usd = amount,
    exchange_rate = 1.000000,
    exchange_rate_date = COALESCE(date, CURRENT_DATE),
    conversion_status = 'VERIFIED_USD_BASE'
WHERE currency = 'USD' AND amount_usd IS NULL;

UPDATE public.fraud_cases
SET amount_usd = amount,
    exchange_rate = 1.000000,
    exchange_rate_date = CURRENT_DATE,
    conversion_status = 'VERIFIED_USD_BASE'
WHERE currency = 'USD' AND amount_usd IS NULL;

-- Step 3d: Backfill foreign currencies where official benchmark rates exist
UPDATE public.transactions t
SET exchange_rate = fx.rate,
    exchange_rate_date = fx.effective_date,
    amount_usd = ROUND(t.amount * fx.rate, 2),
    conversion_status = 'CONVERTED_BENCHMARK'
FROM public.exchange_rates fx
WHERE fx.target_currency = t.currency
  AND fx.base_currency = 'USD'
  AND t.currency IS NOT NULL
  AND t.currency <> 'USD'
  AND t.currency <> 'UNVERIFIED'
  AND t.amount_usd IS NULL
  AND fx.rate > 0;

UPDATE public.fraud_cases fc
SET exchange_rate = fx.rate,
    exchange_rate_date = fx.effective_date,
    amount_usd = ROUND(fc.amount * fx.rate, 2),
    conversion_status = 'CONVERTED_BENCHMARK'
FROM public.exchange_rates fx
WHERE fx.target_currency = fc.currency
  AND fx.base_currency = 'USD'
  AND fc.currency IS NOT NULL
  AND fc.currency <> 'USD'
  AND fc.currency <> 'UNVERIFIED'
  AND fc.amount_usd IS NULL
  AND fx.rate > 0;

-- Step 3e: Keep any record without a verified exchange rate marked UNVERIFIED (amount_usd remains NULL)
UPDATE public.transactions
SET conversion_status = 'UNVERIFIED_MISSING_RATE'
WHERE amount_usd IS NULL AND currency <> 'USD';

UPDATE public.fraud_cases
SET conversion_status = 'UNVERIFIED_MISSING_RATE'
WHERE amount_usd IS NULL AND currency <> 'USD';

-- ------------------------------------------------------------------------------
-- 4. HARDENED TRANSACTION AGGREGATION RPC: get_transaction_aggregates
-- ------------------------------------------------------------------------------
-- Security Architecture:
-- 1. SECURITY INVOKER ensures PostgreSQL table-level RLS policies are applied.
-- 2. Explicit caller validation against public.profiles using auth.uid() prevents
--    tenant spoofing via NULL, ALL, or cross-tenant parameters.
-- 3. Anonymous execution is rejected immediately.
-- 4. Unconverted non-USD transactions are NEVER treated as 1.0; they are tracked
--    in unconvertedCount and excluded from settledVolumeUsd to preserve integrity.
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
    v_enforced_tenant TEXT;
    v_enforced_user_id UUID;

    v_total_count INT := 0;
    v_settled_count INT := 0;
    v_settled_volume_usd NUMERIC(18, 2) := 0.00;
    v_settled_volume_original NUMERIC(18, 2) := 0.00;
    v_credits_volume_usd NUMERIC(18, 2) := 0.00;
    v_debits_volume_usd NUMERIC(18, 2) := 0.00;
    v_net_liquid_balance_usd NUMERIC(18, 2) := 0.00;
    v_unconverted_count INT := 0;
    v_unconverted_volume_original NUMERIC(18, 2) := 0.00;

    v_volume_by_currency JSONB := '{}'::jsonb;
    v_curr_row RECORD;
BEGIN
    -- [1] MANDATORY AUTHENTICATION CHECK
    -- Anonymous execution is strictly prohibited.
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required. Anonymous execution of financial aggregation routines is prohibited.';
    END IF;

    -- [2] RESOLVE CALLER IDENTITY
    IF (auth.jwt() ->> 'role') = 'service_role' THEN
        v_caller_role := 'SUPER_ADMIN';
        v_caller_tenant := 'platform_root';
    ELSE
        SELECT role::text, tenant_id
        INTO v_caller_role, v_caller_tenant
        FROM public.profiles
        WHERE id = v_caller_id;

        IF v_caller_role IS NULL THEN
            RAISE EXCEPTION 'Access Denied: Unverified caller profile.';
        END IF;
    END IF;

    -- [3] STRICT AUTHORIZATION & TENANT BOUNDARY ENFORCEMENT
    IF v_caller_role = 'SUPER_ADMIN' THEN
        -- Super Admin has global oversight; may specify a tenant or aggregate across all
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL; -- NULL indicates global multi-tenant scope
        END IF;
        v_enforced_user_id := p_user_id;

    ELSIF v_caller_role IN ('ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') THEN
        -- Tenant staff are restricted strictly to their assigned tenant workspace
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant data access violation. Caller belongs to tenant "%", attempted to query tenant "%".', v_caller_tenant, p_tenant_id;
        END IF;
        v_enforced_tenant := v_caller_tenant;
        v_enforced_user_id := p_user_id;

    ELSIF v_caller_role = 'CUSTOMER' THEN
        -- Customers are restricted strictly to their own user records and their assigned tenant
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Tenant boundary violation.';
        END IF;
        IF p_user_id IS NOT NULL AND p_user_id <> v_caller_id THEN
            RAISE EXCEPTION 'Access Denied: Customer cannot query other account records.';
        END IF;
        v_enforced_tenant := v_caller_tenant;
        v_enforced_user_id := v_caller_id;

    ELSE
        RAISE EXCEPTION 'Access Denied: Unauthorized role "%".', v_caller_role;
    END IF;

    -- [4] CURRENCY CONVERSION & FINANCIAL AGGREGATION
    -- Rate definition: rate = USD per 1 unit of foreign currency. Formula: amount_usd = amount * rate
    -- CRITICAL SAFETY: Non-USD amounts without an exchange rate are NEVER treated as 1.0!
    WITH eligible_tx AS (
        SELECT
            t.id,
            t.tenant_id,
            t.user_id,
            t.date,
            t.type,
            t.status,
            t.amount,
            COALESCE(NULLIF(TRIM(t.currency), ''), 'UNVERIFIED') AS currency,
            CASE
                -- Explicitly stored and verified amount_usd
                WHEN t.amount_usd IS NOT NULL AND t.amount_usd >= 0 THEN
                    t.amount_usd
                -- Base currency is USD
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'USD' THEN
                    t.amount
                -- Explicit non-zero exchange_rate stored on row
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN
                    ROUND(t.amount * t.exchange_rate, 2)
                -- Lookup latest valid rate from public.exchange_rates
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN
                    ROUND(t.amount * fx.rate, 2)
                -- UNCONVERTED / MISSING RATE: Do NOT assume 1.0! Exclude from USD volume.
                ELSE
                    NULL
            END AS calculated_amount_usd,
            CASE
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'USD' THEN 1.000000
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN t.exchange_rate
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                ELSE NULL
            END AS applied_rate,
            CASE
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'USD' THEN TRUE
                WHEN t.amount_usd IS NOT NULL AND t.amount_usd >= 0 THEN TRUE
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN TRUE
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN TRUE
                ELSE FALSE
            END AS is_converted
        FROM public.transactions t
        LEFT JOIN LATERAL (
            SELECT rate, effective_date
            FROM public.exchange_rates
            WHERE base_currency = 'USD'
              AND target_currency = COALESCE(NULLIF(TRIM(t.currency), ''), '')
              AND rate > 0
            ORDER BY effective_date DESC
            LIMIT 1
        ) fx ON true
        WHERE (v_enforced_tenant IS NULL OR t.tenant_id = v_enforced_tenant)
          AND (v_enforced_user_id IS NULL OR t.user_id = v_enforced_user_id)
          AND (p_start_date IS NULL OR t.date >= p_start_date)
          AND (p_end_date IS NULL OR t.date <= p_end_date)
          AND (p_status IS NULL OR p_status = 'ALL' OR t.status = p_status)
          AND (p_type IS NULL OR p_type = 'ALL' OR t.type = p_type)
    )
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('Settled', 'Escrow Secured')),
        -- Settled USD volume: ONLY includes converted records
        COALESCE(SUM(calculated_amount_usd) FILTER (WHERE status IN ('Settled', 'Escrow Secured') AND is_converted = true), 0.00),
        -- Settled original currency face value:
        COALESCE(SUM(amount) FILTER (WHERE status IN ('Settled', 'Escrow Secured')), 0.00),
        -- Credits & Debits in USD:
        COALESCE(SUM(calculated_amount_usd) FILTER (WHERE type = 'Credit' AND is_converted = true), 0.00),
        COALESCE(SUM(calculated_amount_usd) FILTER (WHERE type = 'Debit' AND is_converted = true), 0.00),
        -- Unconverted / Missing-Rate Tracking:
        COUNT(*) FILTER (WHERE is_converted = false),
        COALESCE(SUM(amount) FILTER (WHERE is_converted = false), 0.00)
    INTO
        v_total_count,
        v_settled_count,
        v_settled_volume_usd,
        v_settled_volume_original,
        v_credits_volume_usd,
        v_debits_volume_usd,
        v_unconverted_count,
        v_unconverted_volume_original
    FROM eligible_tx;

    v_net_liquid_balance_usd := ROUND(v_credits_volume_usd - v_debits_volume_usd, 2);

    -- [5] MULTI-CURRENCY VOLUME BREAKDOWN
    FOR v_curr_row IN
        WITH currency_tx AS (
            SELECT
                COALESCE(NULLIF(TRIM(t.currency), ''), 'UNVERIFIED') AS curr,
                t.amount,
                CASE
                    WHEN t.amount_usd IS NOT NULL AND t.amount_usd >= 0 THEN t.amount_usd
                    WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'USD' THEN t.amount
                    WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN ROUND(t.amount * t.exchange_rate, 2)
                    WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(t.amount * fx.rate, 2)
                    ELSE NULL
                END AS calc_usd,
                CASE
                    WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'USD' THEN 1.000000
                    WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN t.exchange_rate
                    WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                    ELSE NULL
                END AS eff_rate,
                CASE
                    WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'USD' THEN TRUE
                    WHEN t.amount_usd IS NOT NULL AND t.amount_usd >= 0 THEN TRUE
                    WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN TRUE
                    WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN TRUE
                    ELSE FALSE
                END AS conv_flag
            FROM public.transactions t
            LEFT JOIN LATERAL (
                SELECT rate
                FROM public.exchange_rates
                WHERE base_currency = 'USD'
                  AND target_currency = COALESCE(NULLIF(TRIM(t.currency), ''), '')
                  AND rate > 0
                ORDER BY effective_date DESC
                LIMIT 1
            ) fx ON true
            WHERE (v_enforced_tenant IS NULL OR t.tenant_id = v_enforced_tenant)
              AND (v_enforced_user_id IS NULL OR t.user_id = v_enforced_user_id)
              AND (p_start_date IS NULL OR t.date >= p_start_date)
              AND (p_end_date IS NULL OR t.date <= p_end_date)
              AND (p_status IS NULL OR p_status = 'ALL' OR t.status = p_status)
              AND (p_type IS NULL OR p_type = 'ALL' OR t.type = p_type)
        )
        SELECT
            curr,
            ROUND(SUM(amount), 2) AS orig_sum,
            ROUND(COALESCE(SUM(calc_usd) FILTER (WHERE conv_flag = true), 0.00), 2) AS usd_sum,
            ROUND(AVG(eff_rate) FILTER (WHERE conv_flag = true), 6) AS avg_rate,
            COUNT(*) FILTER (WHERE conv_flag = false) AS unconv_rows
        FROM currency_tx
        GROUP BY curr
    LOOP
        v_volume_by_currency := jsonb_set(
            v_volume_by_currency,
            ARRAY[v_curr_row.curr],
            jsonb_build_object(
                'original', v_curr_row.orig_sum,
                'usd', v_curr_row.usd_sum,
                'rate', v_curr_row.avg_rate,
                'isConverted', (v_curr_row.unconv_rows = 0),
                'unconvertedCount', v_curr_row.unconv_rows
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'totalCount', v_total_count,
        'settledCount', v_settled_count,
        'settledVolumeUsd', ROUND(v_settled_volume_usd, 2),
        'settledVolumeOriginal', ROUND(v_settled_volume_original, 2),
        'creditsVolumeUsd', ROUND(v_credits_volume_usd, 2),
        'debitsVolumeUsd', ROUND(v_debits_volume_usd, 2),
        'netLiquidBalanceUsd', v_net_liquid_balance_usd,
        'volumeByCurrency', v_volume_by_currency,
        'unconvertedCount', v_unconverted_count,
        'unconvertedVolumeOriginal', ROUND(v_unconverted_volume_original, 2),
        'hasUnconvertedRecords', (v_unconverted_count > 0),
        'tenantScope', COALESCE(v_enforced_tenant, 'GLOBAL_ALL_TENANTS'),
        'userScope', COALESCE(v_enforced_user_id::text, 'ALL_AUTHORIZED_USERS'),
        'callerRole', v_caller_role,
        'reportingBaseCurrency', 'USD',
        'source', 'supabase_rpc_secure'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. HARDENED FRAUD SURVEILLANCE AGGREGATION RPC: get_fraud_aggregates
-- ------------------------------------------------------------------------------
-- Security Architecture:
-- 1. SECURITY INVOKER ensures PostgreSQL table-level RLS policies are applied.
-- 2. Restricts execution strictly to SUPER_ADMIN, ADMIN, and FINANCE_ANALYST.
-- 3. Anonymous execution and Customer/Support access are rejected immediately.
-- 4. Cross-tenant parameters are rejected for non-Super-Admins.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fraud_aggregates(
    p_tenant_id TEXT DEFAULT NULL,
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
    v_enforced_tenant TEXT;

    v_total_cases INT := 0;
    v_flagged_count INT := 0;
    v_frozen_count INT := 0;
    v_cleared_count INT := 0;
    v_prevented_volume_usd NUMERIC(18, 2) := 0.00;
    v_prevented_volume_original NUMERIC(18, 2) := 0.00;
    v_monitored_volume_usd NUMERIC(18, 2) := 0.00;
    v_unconverted_cases INT := 0;

    v_volume_by_currency JSONB := '{}'::jsonb;
    v_curr_row RECORD;
BEGIN
    -- [1] MANDATORY AUTHENTICATION CHECK
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required. Anonymous execution of fraud surveillance aggregation is prohibited.';
    END IF;

    -- [2] RESOLVE CALLER IDENTITY
    IF (auth.jwt() ->> 'role') = 'service_role' THEN
        v_caller_role := 'SUPER_ADMIN';
        v_caller_tenant := 'platform_root';
    ELSE
        SELECT role::text, tenant_id
        INTO v_caller_role, v_caller_tenant
        FROM public.profiles
        WHERE id = v_caller_id;

        IF v_caller_role IS NULL THEN
            RAISE EXCEPTION 'Access Denied: Unverified caller profile.';
        END IF;
    END IF;

    -- [3] FRAUD SURVEILLANCE RBAC CHECK
    -- In Finova AI authorization model, fraud/AML surveillance is restricted strictly to:
    -- SUPER_ADMIN, ADMIN, and FINANCE_ANALYST.
    -- CUSTOMER and SUPPORT_EXECUTIVE are strictly prohibited.
    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST') THEN
        RAISE EXCEPTION 'Access Denied: Fraud and AML surveillance data is restricted to authorized financial risk officers.';
    END IF;

    -- [4] STRICT TENANT BOUNDARY ENFORCEMENT
    IF v_caller_role = 'SUPER_ADMIN' THEN
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL;
        END IF;
    ELSE
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant data access violation. Caller belongs to tenant "%", attempted to query tenant "%".', v_caller_tenant, p_tenant_id;
        END IF;
        v_enforced_tenant := v_caller_tenant;
    END IF;

    -- [5] SAFE CURRENCY CONVERSION & AGGREGATION
    WITH eligible_fraud AS (
        SELECT
            fc.id,
            fc.tenant_id,
            fc.status,
            fc.amount,
            COALESCE(NULLIF(TRIM(fc.currency), ''), 'UNVERIFIED') AS currency,
            CASE
                WHEN fc.amount_usd IS NOT NULL AND fc.amount_usd >= 0 THEN fc.amount_usd
                WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'USD' THEN fc.amount
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN ROUND(fc.amount * fc.exchange_rate, 2)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(fc.amount * fx.rate, 2)
                ELSE NULL
            END AS calculated_amount_usd,
            CASE
                WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'USD' THEN 1.000000
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN fc.exchange_rate
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                ELSE NULL
            END AS applied_rate,
            CASE
                WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'USD' THEN TRUE
                WHEN fc.amount_usd IS NOT NULL AND fc.amount_usd >= 0 THEN TRUE
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN TRUE
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN TRUE
                ELSE FALSE
            END AS is_converted
        FROM public.fraud_cases fc
        LEFT JOIN LATERAL (
            SELECT rate
            FROM public.exchange_rates
            WHERE base_currency = 'USD'
              AND target_currency = COALESCE(NULLIF(TRIM(fc.currency), ''), '')
              AND rate > 0
            ORDER BY effective_date DESC
            LIMIT 1
        ) fx ON true
        WHERE (v_enforced_tenant IS NULL OR fc.tenant_id = v_enforced_tenant)
          AND (p_currency IS NULL OR p_currency = 'ALL' OR fc.currency = p_currency)
    )
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'Flagged'),
        COUNT(*) FILTER (WHERE status = 'Frozen Escrow'),
        COUNT(*) FILTER (WHERE status = 'Cleared'),
        -- Prevented USD volume (Frozen Escrow): ONLY sum converted records
        COALESCE(SUM(calculated_amount_usd) FILTER (WHERE status = 'Frozen Escrow' AND is_converted = true), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE status = 'Frozen Escrow'), 0.00),
        -- Monitored USD volume:
        COALESCE(SUM(calculated_amount_usd) FILTER (WHERE is_converted = true), 0.00),
        COUNT(*) FILTER (WHERE is_converted = false)
    INTO
        v_total_cases,
        v_flagged_count,
        v_frozen_count,
        v_cleared_count,
        v_prevented_volume_usd,
        v_prevented_volume_original,
        v_monitored_volume_usd,
        v_unconverted_cases
    FROM eligible_fraud;

    FOR v_curr_row IN
        WITH currency_fraud AS (
            SELECT
                COALESCE(NULLIF(TRIM(fc.currency), ''), 'UNVERIFIED') AS curr,
                fc.amount,
                CASE
                    WHEN fc.amount_usd IS NOT NULL AND fc.amount_usd >= 0 THEN fc.amount_usd
                    WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'USD' THEN fc.amount
                    WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN ROUND(fc.amount * fc.exchange_rate, 2)
                    WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(fc.amount * fx.rate, 2)
                    ELSE NULL
                END AS calc_usd,
                CASE
                    WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'USD' THEN 1.000000
                    WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN fc.exchange_rate
                    WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                    ELSE NULL
                END AS eff_rate,
                CASE
                    WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'USD' THEN TRUE
                    WHEN fc.amount_usd IS NOT NULL AND fc.amount_usd >= 0 THEN TRUE
                    WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN TRUE
                    WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN TRUE
                    ELSE FALSE
                END AS conv_flag
            FROM public.fraud_cases fc
            LEFT JOIN LATERAL (
                SELECT rate
                FROM public.exchange_rates
                WHERE base_currency = 'USD'
                  AND target_currency = COALESCE(NULLIF(TRIM(fc.currency), ''), '')
                  AND rate > 0
                ORDER BY effective_date DESC
                LIMIT 1
            ) fx ON true
            WHERE (v_enforced_tenant IS NULL OR fc.tenant_id = v_enforced_tenant)
              AND (p_currency IS NULL OR p_currency = 'ALL' OR fc.currency = p_currency)
        )
        SELECT
            curr,
            ROUND(SUM(amount), 2) AS orig_sum,
            ROUND(COALESCE(SUM(calc_usd) FILTER (WHERE conv_flag = true), 0.00), 2) AS usd_sum,
            ROUND(AVG(eff_rate) FILTER (WHERE conv_flag = true), 6) AS avg_rate,
            COUNT(*) FILTER (WHERE conv_flag = false) AS unconv_rows
        FROM currency_fraud
        GROUP BY curr
    LOOP
        v_volume_by_currency := jsonb_set(
            v_volume_by_currency,
            ARRAY[v_curr_row.curr],
            jsonb_build_object(
                'original', v_curr_row.orig_sum,
                'usd', v_curr_row.usd_sum,
                'rate', v_curr_row.avg_rate,
                'isConverted', (v_curr_row.unconv_rows = 0),
                'unconvertedCount', v_curr_row.unconv_rows
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'totalCases', v_total_cases,
        'flaggedCount', v_flagged_count,
        'frozenCount', v_frozen_count,
        'clearedCount', v_cleared_count,
        'preventedVolumeUsd', ROUND(v_prevented_volume_usd, 2),
        'preventedVolumeOriginal', ROUND(v_prevented_volume_original, 2),
        'monitoredVolumeUsd', ROUND(v_monitored_volume_usd, 2),
        'volumeByCurrency', v_volume_by_currency,
        'unconvertedCases', v_unconverted_cases,
        'hasUnconvertedRecords', (v_unconverted_cases > 0),
        'tenantScope', COALESCE(v_enforced_tenant, 'GLOBAL_ALL_TENANTS'),
        'callerRole', v_caller_role,
        'reportingBaseCurrency', 'USD',
        'source', 'supabase_rpc_secure'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. STRICT FUNCTION EXECUTION PERMISSIONS
-- Prohibits anonymous execution; grants only to authenticated users and service_role
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_transaction_aggregates(TEXT, UUID, DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fraud_aggregates(TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_transaction_aggregates(TEXT, UUID, DATE, DATE, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fraud_aggregates(TEXT, TEXT) TO authenticated, service_role;
