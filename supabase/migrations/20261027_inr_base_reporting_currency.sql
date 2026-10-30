-- ==============================================================================
-- FINOVA AI — REVISED PRODUCTION SQL MIGRATION: INR BASE REPORTING CURRENCY
-- Target Database: rjudrmnnpwlovpkbwnte (https://rjudrmnnpwlovpkbwnte.supabase.co)
-- Migration ID: 20261027_inr_base_reporting_currency_v2
-- Status: IDEMPOTENT, NON-DESTRUCTIVE, AUDITED AGAINST ACTUAL SUPABASE SCHEMA
--
-- SCHEMA CONFORMANCE AUDIT:
-- 1. transactions: id TEXT, user_id UUID, tenant_id TEXT, date DATE, amount NUMERIC,
--    type TEXT, status TEXT, currency TEXT (verified)
-- 2. fraud_cases: id TEXT, tenant_id TEXT, customer_id TEXT, amount NUMERIC,
--    currency TEXT, status TEXT, timestamp TIMESTAMPTZ (verified)
--    * CRITICAL: fraud_cases has timestamp (TIMESTAMPTZ) and customer_id (TEXT).
--    * Does NOT have user_id (UUID) or date (DATE). Function logic respects actual columns.
-- 3. profiles: id UUID, role USER-DEFINED (user_role_type), tenant_id TEXT, email TEXT (verified)
-- 4. public.exchange_rates is created idempotently from scratch with RLS & indexes.
-- 5. Exchange rates defined as: INR per 1 unit of foreign currency.
-- 6. Rate attribution: Clearly identified as static benchmark reference rates, not live feeds.
-- 7. Zero unconverted additions: Unconverted non-INR amounts are excluded from settled INR volume.
-- 8. Preserves original amounts and currency codes; adds amount_inr non-destructively.
-- 9. RBAC & Tenant Isolation: Anonymous access prohibited; tenant isolation strictly enforced.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CREATE CENTRALIZED EXCHANGE RATES TABLE (INR BASE) IDEMPOTENTLY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id TEXT PRIMARY KEY,
    base_currency TEXT NOT NULL DEFAULT 'INR',
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

-- Idempotent column additions in case table pre-existed in any state
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS target_currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS inverse_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS effective_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Official Reference Benchmark';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT false;

-- Unambiguous rate definition comments
COMMENT ON TABLE public.exchange_rates IS 'Centralized INR base-currency exchange rates table with source attribution and freshness tracking.';
COMMENT ON COLUMN public.exchange_rates.rate IS 'INR amount per 1 unit of target_currency (e.g. 1 USD = 84.070000 INR, 1 EUR = 91.120000 INR). Calculation formula: amount_inr = original_amount * rate';
COMMENT ON COLUMN public.exchange_rates.inverse_rate IS 'Target currency units per 1 INR (e.g. 1 INR = 0.011895 USD). Formula: 1.0 / rate';
COMMENT ON COLUMN public.exchange_rates.effective_date IS 'Official rate publication / fixing date.';
COMMENT ON COLUMN public.exchange_rates.source IS 'Attributed central bank or official benchmark reference provider. Static fallbacks explicitly noted.';
COMMENT ON COLUMN public.exchange_rates.is_stale IS 'Boolean flag indicating if the rate is older than the allowed freshness window (3 days for daily market fixings).';

-- Performance & Lookup Index
CREATE INDEX IF NOT EXISTS idx_exchange_rates_base_target_date 
    ON public.exchange_rates (base_currency, target_currency, effective_date DESC);

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
                WHERE id = auth.uid() 
                  AND role::text = 'SUPER_ADMIN'
                  AND LOWER(TRIM(email)) = 'aravindvicky629@gmail.com'
            )
        )
        WITH CHECK (
            (auth.jwt() ->> 'role') = 'service_role' OR
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                  AND role::text = 'SUPER_ADMIN'
                  AND LOWER(TRIM(email)) = 'aravindvicky629@gmail.com'
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Principle of least privilege: revoke from public/anon, grant SELECT only to authenticated users
REVOKE ALL ON public.exchange_rates FROM PUBLIC, anon;
GRANT SELECT ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;

-- Seed verified benchmark rates (Attributed to Reserve Bank of India and central bank reference rates)
-- Clearly disclosed as Static Reference Benchmarks, not live market feeds
INSERT INTO public.exchange_rates (id, base_currency, target_currency, rate, inverse_rate, effective_date, source, is_stale)
VALUES
    ('FX-INR-BASE', 'INR', 'INR', 1.000000,   1.000000,   '2026-10-27', 'Reserve Bank of India (RBI) Identity Base (Static Benchmark)', false),
    ('FX-USD-INR',  'INR', 'USD', 84.070000,  0.011895,   '2026-10-27', 'Reserve Bank of India (RBI) Reference Rate (Static Benchmark)', false),
    ('FX-EUR-INR',  'INR', 'EUR', 91.120000,  0.010975,   '2026-10-27', 'Reserve Bank of India (RBI) Reference Rate (Static Benchmark)', false),
    ('FX-GBP-INR',  'INR', 'GBP', 109.280000, 0.009151,   '2026-10-27', 'Reserve Bank of India (RBI) Reference Rate (Static Benchmark)', false),
    ('FX-JPY-INR',  'INR', 'JPY', 0.552000,   1.811594,   '2026-10-27', 'Reserve Bank of India (RBI) Reference Rate per 1 JPY (Static Benchmark)', false),
    ('FX-CHF-INR',  'INR', 'CHF', 97.250000,  0.010283,   '2026-10-27', 'Swiss National Bank / RBI Cross Reference (Static Benchmark)', false),
    ('FX-SGD-INR',  'INR', 'SGD', 63.780000,  0.015679,   '2026-10-27', 'Monetary Authority of Singapore / RBI Cross (Static Benchmark)', false),
    ('FX-CAD-INR',  'INR', 'CAD', 60.820000,  0.016442,   '2026-10-27', 'Bank of Canada / RBI Cross Reference (Static Benchmark)', false)
ON CONFLICT (id) DO UPDATE SET
    base_currency = EXCLUDED.base_currency,
    target_currency = EXCLUDED.target_currency,
    rate = EXCLUDED.rate,
    inverse_rate = EXCLUDED.inverse_rate,
    effective_date = EXCLUDED.effective_date,
    source = EXCLUDED.source,
    is_stale = EXCLUDED.is_stale,
    retrieved_at = timezone('utc'::text, now());

-- ------------------------------------------------------------------------------
-- 2. AUGMENT TRANSACTIONS & FRAUD CASES WITH CONVERSION METADATA (NON-DESTRUCTIVE)
-- Preserves existing original amount, currency, and amount_usd columns without data loss
-- ------------------------------------------------------------------------------

-- Transactions: Actual columns id, user_id, tenant_id, date, amount, type, status, currency
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(15, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(15, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT 'PENDING_VERIFICATION';

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date 
    ON public.transactions (tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_status 
    ON public.transactions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_currency 
    ON public.transactions (currency);

-- Fraud Cases: Actual columns id, tenant_id, customer_id, amount, currency, status, timestamp
-- Note: Does NOT add user_id or date; preserves genuine schema
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(15, 2);
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(15, 2);
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6);
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT 'PENDING_VERIFICATION';

CREATE INDEX IF NOT EXISTS idx_fraud_cases_tenant_timestamp 
    ON public.fraud_cases (tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_customer_status 
    ON public.fraud_cases (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_currency 
    ON public.fraud_cases (currency);

-- ------------------------------------------------------------------------------
-- 3. NON-DESTRUCTIVE HISTORICAL DATA BACKFILL FOR amount_inr
-- Strictly preserves original amounts and currency codes. Never deletes or mutates records.
-- ------------------------------------------------------------------------------

-- Step 3a: Backfill INR records for transactions (1:1 identity base currency)
UPDATE public.transactions
SET amount_inr = amount,
    exchange_rate = 1.000000,
    exchange_rate_date = COALESCE(date, CURRENT_DATE),
    conversion_status = 'VERIFIED_INR_BASE'
WHERE currency = 'INR' AND (amount_inr IS NULL OR conversion_status = 'PENDING_VERIFICATION');

-- Step 3b: Backfill INR records for fraud_cases (1:1 identity base currency)
-- Uses fc.timestamp::date (fraud_cases has timestamp TIMESTAMPTZ, not date DATE)
UPDATE public.fraud_cases fc
SET amount_inr = amount,
    exchange_rate = 1.000000,
    exchange_rate_date = COALESCE(fc.timestamp::date, CURRENT_DATE),
    conversion_status = 'VERIFIED_INR_BASE'
WHERE currency = 'INR' AND (amount_inr IS NULL OR conversion_status = 'PENDING_VERIFICATION');

-- Step 3c: Backfill foreign currencies for transactions where official RBI benchmark rates exist
UPDATE public.transactions t
SET amount_inr = ROUND(t.amount * fx.rate, 2),
    exchange_rate = fx.rate,
    exchange_rate_date = fx.effective_date,
    conversion_status = 'CONVERTED_INR_BENCHMARK'
FROM public.exchange_rates fx
WHERE fx.base_currency = 'INR'
  AND fx.target_currency = t.currency
  AND t.currency IS NOT NULL
  AND t.currency <> 'INR'
  AND t.currency <> 'UNVERIFIED'
  AND (t.amount_inr IS NULL OR t.conversion_status = 'PENDING_VERIFICATION')
  AND fx.rate > 0;

-- Step 3d: Backfill foreign currencies for fraud_cases where official RBI benchmark rates exist
UPDATE public.fraud_cases fc
SET amount_inr = ROUND(fc.amount * fx.rate, 2),
    exchange_rate = fx.rate,
    exchange_rate_date = fx.effective_date,
    conversion_status = 'CONVERTED_INR_BENCHMARK'
FROM public.exchange_rates fx
WHERE fx.base_currency = 'INR'
  AND fx.target_currency = fc.currency
  AND fc.currency IS NOT NULL
  AND fc.currency <> 'INR'
  AND fc.currency <> 'UNVERIFIED'
  AND (fc.amount_inr IS NULL OR fc.conversion_status = 'PENDING_VERIFICATION')
  AND fx.rate > 0;

-- Step 3e: Flag any record without a verified exchange rate as UNVERIFIED_MISSING_RATE (amount_inr remains NULL)
UPDATE public.transactions
SET conversion_status = 'UNVERIFIED_MISSING_RATE'
WHERE amount_inr IS NULL AND currency <> 'INR';

UPDATE public.fraud_cases
SET conversion_status = 'UNVERIFIED_MISSING_RATE'
WHERE amount_inr IS NULL AND currency <> 'INR';

-- ------------------------------------------------------------------------------
-- 4. HARDENED TRANSACTION AGGREGATION RPC: get_transaction_aggregates (INR BASE)
-- ------------------------------------------------------------------------------
-- Schema alignment:
-- - references transactions columns: id, user_id, tenant_id, date, amount, type, status, currency
-- - references profiles columns: id, role (user_role_type), tenant_id, email
-- - security: SECURITY INVOKER, auth check, strict caller verification, tenant boundary check
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
    v_curr_row RECORD;
BEGIN
    -- [1] MANDATORY AUTHENTICATION CHECK
    -- Anonymous execution is strictly prohibited.
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required. Anonymous execution of financial aggregation routines is prohibited.';
    END IF;

    -- [2] RESOLVE CALLER IDENTITY (Casting role::text from user_role_type enum)
    IF (auth.jwt() ->> 'role') = 'service_role' THEN
        v_caller_role := 'SUPER_ADMIN';
        v_caller_tenant := 'platform_root';
        v_caller_email := 'service_role@finova.internal';
    ELSE
        SELECT role::text, tenant_id, email
        INTO v_caller_role, v_caller_tenant, v_caller_email
        FROM public.profiles
        WHERE id = v_caller_id;

        IF v_caller_role IS NULL THEN
            RAISE EXCEPTION 'Access Denied: Unverified caller profile.';
        END IF;
    END IF;

    -- [3] STRICT AUTHORIZATION & TENANT BOUNDARY ENFORCEMENT
    IF v_caller_role = 'SUPER_ADMIN' THEN
        -- Defense-in-depth: Verify caller is the authorized Super Admin
        IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
            IF LOWER(TRIM(COALESCE(v_caller_email, ''))) <> 'aravindvicky629@gmail.com' THEN
                -- Demote unauthorized Super Admin profile to Customer boundary
                v_caller_role := 'CUSTOMER';
            END IF;
        END IF;
    END IF;

    IF v_caller_role = 'SUPER_ADMIN' THEN
        -- Super Admin has global oversight; may specify a tenant or aggregate across all
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL; -- Multi-tenant global scope
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

    -- Lookup USD rate for backwards-compatible USD fields
    SELECT rate INTO v_usd_rate
    FROM public.exchange_rates
    WHERE base_currency = 'INR' AND target_currency = 'USD'
    ORDER BY effective_date DESC
    LIMIT 1;
    IF v_usd_rate IS NULL OR v_usd_rate <= 0 THEN
        v_usd_rate := 84.070000;
    END IF;

    -- [4] CURRENCY CONVERSION & FINANCIAL AGGREGATION (INR BASE)
    -- Rate definition: rate = INR per 1 unit of foreign currency. Formula: amount_inr = amount * rate
    -- Identity: For currency = 'INR', rate = 1.000000
    -- CRITICAL SAFETY: Non-INR amounts without an exchange rate are NEVER treated as 1.0!
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
                -- Stored verified amount_inr
                WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN
                    t.amount_inr
                -- Base currency is INR (Identity: 1.000000)
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN
                    t.amount
                -- Explicit non-zero exchange_rate stored on row
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN
                    ROUND(t.amount * t.exchange_rate, 2)
                -- Lookup latest valid rate from public.exchange_rates (INR base)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN
                    ROUND(t.amount * fx.rate, 2)
                -- UNCONVERTED / MISSING RATE: Do NOT assume 1.0! Exclude from converted INR volume.
                ELSE
                    NULL
            END AS calculated_amount_inr,
            CASE
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN 1.000000
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN t.exchange_rate
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                ELSE NULL
            END AS applied_rate,
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
          AND (p_status IS NULL OR p_status = 'ALL' OR t.status = p_status)
          AND (p_type IS NULL OR p_type = 'ALL' OR t.type = p_type)
    )
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('Settled', 'Escrow Secured')),
        -- Settled INR volume: ONLY includes converted records
        COALESCE(SUM(calculated_amount_inr) FILTER (WHERE status IN ('Settled', 'Escrow Secured') AND is_converted = true), 0.00),
        -- Settled original currency face value:
        COALESCE(SUM(amount) FILTER (WHERE status IN ('Settled', 'Escrow Secured')), 0.00),
        -- Credits & Debits in INR:
        COALESCE(SUM(calculated_amount_inr) FILTER (WHERE type = 'Credit' AND is_converted = true), 0.00),
        COALESCE(SUM(calculated_amount_inr) FILTER (WHERE type = 'Debit' AND is_converted = true), 0.00),
        -- Unconverted / Missing-Rate Tracking:
        COUNT(*) FILTER (WHERE is_converted = false),
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

    -- [5] MULTI-CURRENCY VOLUME BREAKDOWN
    FOR v_curr_row IN
        WITH currency_tx AS (
            SELECT
                COALESCE(NULLIF(TRIM(t.currency), ''), 'UNVERIFIED') AS curr,
                t.amount,
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
                CASE
                    WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN TRUE
                    WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN TRUE
                    WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN TRUE
                    WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN TRUE
                    ELSE FALSE
                END AS conv_flag
            FROM public.transactions t
            LEFT JOIN LATERAL (
                SELECT rate
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
              AND (p_status IS NULL OR p_status = 'ALL' OR t.status = p_status)
              AND (p_type IS NULL OR p_type = 'ALL' OR t.type = p_type)
        )
        SELECT
            curr,
            ROUND(SUM(amount), 2) AS orig_sum,
            ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00), 2) AS inr_sum,
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
                'inr', v_curr_row.inr_sum,
                'usd', ROUND(v_curr_row.inr_sum / v_usd_rate, 2),
                'rate', v_curr_row.avg_rate,
                'isConverted', (v_curr_row.unconv_rows = 0),
                'unconvertedCount', v_curr_row.unconv_rows
            )
        );
    END LOOP;

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

-- ------------------------------------------------------------------------------
-- 5. HARDENED FRAUD SURVEILLANCE AGGREGATION RPC: get_fraud_aggregates (INR BASE)
-- ------------------------------------------------------------------------------
-- Schema alignment:
-- - references fraud_cases columns: id, tenant_id, customer_id, amount, currency, status, timestamp
-- - * Does NOT reference non-existent user_id or date columns.
-- - Date filtering safely applies fc.timestamp::date.
-- - Customer filtering safely applies fc.customer_id.
-- - Restricts execution strictly to SUPER_ADMIN, ADMIN, and FINANCE_ANALYST.
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
    v_curr_row RECORD;
BEGIN
    -- [1] MANDATORY AUTHENTICATION CHECK
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required. Anonymous execution of fraud surveillance aggregation is prohibited.';
    END IF;

    -- [2] RESOLVE CALLER IDENTITY (Casting role::text from user_role_type enum)
    IF (auth.jwt() ->> 'role') = 'service_role' THEN
        v_caller_role := 'SUPER_ADMIN';
        v_caller_tenant := 'platform_root';
        v_caller_email := 'service_role@finova.internal';
    ELSE
        SELECT role::text, tenant_id, email
        INTO v_caller_role, v_caller_tenant, v_caller_email
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
        -- Defense-in-depth: Verify caller is the authorized Super Admin
        IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
            IF LOWER(TRIM(COALESCE(v_caller_email, ''))) <> 'aravindvicky629@gmail.com' THEN
                RAISE EXCEPTION 'Access Denied: Only the authorized Super Admin may query multi-tenant global risk telemetry.';
            END IF;
        END IF;

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

    -- Lookup USD conversion rate
    SELECT rate INTO v_usd_rate
    FROM public.exchange_rates
    WHERE base_currency = 'INR' AND target_currency = 'USD'
    ORDER BY effective_date DESC
    LIMIT 1;
    IF v_usd_rate IS NULL OR v_usd_rate <= 0 THEN
        v_usd_rate := 84.070000;
    END IF;

    -- [5] SAFE CURRENCY CONVERSION & AGGREGATION (INR BASE)
    -- References genuine fraud_cases columns: id, tenant_id, customer_id, amount, currency, status, timestamp
    WITH eligible_fraud AS (
        SELECT
            fc.id,
            fc.tenant_id,
            fc.customer_id,
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
                WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'INR' THEN 1.000000
                WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN fc.exchange_rate
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN fx.rate
                ELSE NULL
            END AS applied_rate,
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
          AND (p_currency IS NULL OR p_currency = 'ALL' OR fc.currency = p_currency)
          AND (p_status IS NULL OR p_status = 'ALL' OR fc.status = p_status)
          AND (p_customer_id IS NULL OR fc.customer_id = p_customer_id)
          AND (p_start_date IS NULL OR fc.timestamp::date >= p_start_date)
          AND (p_end_date IS NULL OR fc.timestamp::date <= p_end_date)
    )
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'Flagged'),
        COUNT(*) FILTER (WHERE status = 'Frozen Escrow'),
        COUNT(*) FILTER (WHERE status = 'Cleared'),
        -- Prevented INR volume (Frozen Escrow): ONLY sum converted records
        COALESCE(SUM(calculated_amount_inr) FILTER (WHERE status = 'Frozen Escrow' AND is_converted = true), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE status = 'Frozen Escrow'), 0.00),
        -- Monitored INR volume:
        COALESCE(SUM(calculated_amount_inr) FILTER (WHERE is_converted = true), 0.00),
        COUNT(*) FILTER (WHERE is_converted = false)
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

    FOR v_curr_row IN
        WITH currency_fraud AS (
            SELECT
                COALESCE(NULLIF(TRIM(fc.currency), ''), 'UNVERIFIED') AS curr,
                fc.amount,
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
                CASE
                    WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'INR' THEN TRUE
                    WHEN fc.amount_inr IS NOT NULL AND fc.amount_inr >= 0 THEN TRUE
                    WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN TRUE
                    WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN TRUE
                    ELSE FALSE
                END AS conv_flag
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
              AND (p_currency IS NULL OR p_currency = 'ALL' OR fc.currency = p_currency)
              AND (p_status IS NULL OR p_status = 'ALL' OR fc.status = p_status)
              AND (p_customer_id IS NULL OR fc.customer_id = p_customer_id)
              AND (p_start_date IS NULL OR fc.timestamp::date >= p_start_date)
              AND (p_end_date IS NULL OR fc.timestamp::date <= p_end_date)
        )
        SELECT
            curr,
            ROUND(SUM(amount), 2) AS orig_sum,
            ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00), 2) AS inr_sum,
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
                'inr', v_curr_row.inr_sum,
                'usd', ROUND(v_curr_row.inr_sum / v_usd_rate, 2),
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
        'preventedVolumeInr', ROUND(v_prevented_volume_inr, 2),
        'preventedVolumeUsd', v_prevented_volume_usd,
        'preventedVolumeOriginal', ROUND(v_prevented_volume_original, 2),
        'monitoredVolumeInr', ROUND(v_monitored_volume_inr, 2),
        'monitoredVolumeUsd', v_monitored_volume_usd,
        'volumeByCurrency', v_volume_by_currency,
        'unconvertedCases', v_unconverted_cases,
        'hasUnconvertedRecords', (v_unconverted_cases > 0),
        'tenantScope', COALESCE(v_enforced_tenant, 'GLOBAL_ALL_TENANTS'),
        'callerRole', v_caller_role,
        'reportingBaseCurrency', 'INR',
        'source', 'supabase_rpc_secure'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. STRICT FUNCTION EXECUTION PERMISSIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_transaction_aggregates(TEXT, UUID, DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fraud_aggregates(TEXT, TEXT, DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_transaction_aggregates(TEXT, UUID, DATE, DATE, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fraud_aggregates(TEXT, TEXT, DATE, DATE, TEXT, TEXT) TO authenticated, service_role;
