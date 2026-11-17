-- ==============================================================================
-- FINOVA AI — STAGE 2: P0 DATABASE INTEGRATION & AGGREGATE RPC RECONCILIATION
-- Migration ID: 20261117_stage2_p0_database_integration
-- Target Project Ref: rjudrmnnpwlovpkbwnte
-- Status: Forward-Only, Idempotent, Non-Destructive (Zero DROP TABLE)
--
-- Scope:
-- 1. Create public.ai_configurations (no API secrets, SUPER_ADMIN-only RLS, indexes).
-- 2. Implement / harden missing & broken aggregate RPCs with genuine DB metrics:
--      - public.get_support_aggregates(p_tenant_id TEXT)
--      - public.get_kyc_aggregates(p_tenant_id TEXT)
--      - public.get_platform_executive_kpis()
--      - public.get_transfer_intelligence_aggregates(p_tenant_id TEXT, p_start_date DATE, p_end_date DATE, p_currency TEXT)
-- 3. Reconcile public.get_transaction_aggregates(...) restoring complete INR base,
--    multi-currency, daily/category/type/status/merchant breakdowns and per-role RBAC
--    including strict self-scoped CUSTOMER access and tenant-scoped staff access.
-- 4. Remove unsafe anon table access on public.tenant_workspaces; provide safe
--    public.get_public_tenant_directory() returning only id, name, short_name for
--    active non-platform-root workspaces; restore minimal safe public SELECT on
--    public.exchange_rates.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TASK 1: PUBLIC.AI_CONFIGURATIONS TABLE, INDEXES, TRIGGER, RLS & SEED
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_configurations (
    id TEXT PRIMARY KEY DEFAULT 'default',
    tenant_id TEXT NOT NULL DEFAULT 'platform_root'
        REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT,
    model TEXT NOT NULL DEFAULT 'Finova-Sentinel-Ultra-4.2',
    temperature NUMERIC(4, 2) NOT NULL DEFAULT 0.20,
    latency_sla INT NOT NULL DEFAULT 250,
    guardrail_active BOOLEAN NOT NULL DEFAULT true,
    hallucination_filter BOOLEAN NOT NULL DEFAULT true,
    sentinel_confidence_threshold NUMERIC(5, 2) NOT NULL DEFAULT 92.00,
    auto_freeze_threshold NUMERIC(5, 2) NOT NULL DEFAULT 85.00,
    max_daily_wire_velocity NUMERIC(15, 2) NOT NULL DEFAULT 5000000.00,
    dual_key_signoff_enabled BOOLEAN NOT NULL DEFAULT true,
    real_time_audit_logging BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_by TEXT,
    CONSTRAINT chk_ai_config_temperature CHECK (temperature >= 0.00 AND temperature <= 1.00),
    CONSTRAINT chk_ai_config_latency_sla CHECK (latency_sla >= 50 AND latency_sla <= 10000),
    CONSTRAINT chk_ai_config_sentinel_threshold CHECK (sentinel_confidence_threshold >= 50.00 AND sentinel_confidence_threshold <= 99.99),
    CONSTRAINT chk_ai_config_freeze_threshold CHECK (auto_freeze_threshold >= 50.00 AND auto_freeze_threshold <= 99.99),
    CONSTRAINT chk_ai_config_wire_velocity CHECK (max_daily_wire_velocity > 0),
    CONSTRAINT chk_ai_config_platform_scope CHECK (tenant_id = 'platform_root')
);

-- Non-destructive column sync in case table was partially created earlier
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'platform_root';
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'Finova-Sentinel-Ultra-4.2';
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS temperature NUMERIC(4, 2) NOT NULL DEFAULT 0.20;
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS latency_sla INT NOT NULL DEFAULT 250;
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS guardrail_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS hallucination_filter BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS sentinel_confidence_threshold NUMERIC(5, 2) NOT NULL DEFAULT 92.00;
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS auto_freeze_threshold NUMERIC(5, 2) NOT NULL DEFAULT 85.00;
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS max_daily_wire_velocity NUMERIC(15, 2) NOT NULL DEFAULT 5000000.00;
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS dual_key_signoff_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS real_time_audit_logging BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.ai_configurations ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_configurations_tenant_active
    ON public.ai_configurations (tenant_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_configurations_single_active_per_tenant
    ON public.ai_configurations (tenant_id)
    WHERE is_active = true;

-- Maintain updated_at automatically on mutations
CREATE OR REPLACE FUNCTION public.touch_ai_configurations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_configurations_updated_at ON public.ai_configurations;
CREATE TRIGGER trg_ai_configurations_updated_at
    BEFORE INSERT OR UPDATE ON public.ai_configurations
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_ai_configurations_updated_at();

ALTER TABLE public.ai_configurations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_configurations FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_configurations TO authenticated;
GRANT ALL ON public.ai_configurations TO service_role;

DROP POLICY IF EXISTS "super_admin_manage_ai_configurations" ON public.ai_configurations;
CREATE POLICY "super_admin_manage_ai_configurations" ON public.ai_configurations
    FOR ALL
    TO authenticated
    USING (
        public.get_auth_role() = 'SUPER_ADMIN'
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role::text = 'SUPER_ADMIN'
              AND p.status::text = 'Active'
              AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
        )
    )
    WITH CHECK (
        public.get_auth_role() = 'SUPER_ADMIN'
        AND tenant_id = 'platform_root'
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role::text = 'SUPER_ADMIN'
              AND p.status::text = 'Active'
              AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
        )
    );

-- Seed default platform configuration row idempotently (only if platform_root workspace exists)
INSERT INTO public.ai_configurations (
    id,
    tenant_id,
    model,
    temperature,
    latency_sla,
    guardrail_active,
    hallucination_filter,
    sentinel_confidence_threshold,
    auto_freeze_threshold,
    max_daily_wire_velocity,
    dual_key_signoff_enabled,
    real_time_audit_logging,
    is_active,
    updated_by
)
SELECT
    'default',
    'platform_root',
    'Finova-Sentinel-Ultra-4.2',
    0.20,
    250,
    true,
    true,
    92.00,
    85.00,
    5000000.00,
    true,
    true,
    true,
    'Platform Root Initialization'
WHERE EXISTS (SELECT 1 FROM public.tenant_workspaces WHERE id = 'platform_root')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA READINESS FOR TRANSFER INTELLIGENCE COLUMNS (NON-DESTRUCTIVE)
-- ------------------------------------------------------------------------------
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(15, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'Online';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_flagged_fraud BOOLEAN DEFAULT FALSE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(15, 2);

CREATE INDEX IF NOT EXISTS idx_transactions_channel ON public.transactions(channel);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date_status ON public.transactions(tenant_id, date DESC, status);

-- ------------------------------------------------------------------------------
-- 3. TASK 3: RECONCILE PUBLIC.GET_TRANSACTION_AGGREGATES (INR BASE + BREAKDOWNS)
-- Preserves strict per-role & tenant isolation and CUSTOMER self-only access.
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
    -- [1] Mandatory authentication check
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required to execute transaction aggregation.';
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
            RAISE EXCEPTION 'Access Denied: Unverified or inactive caller profile.';
        END IF;
    END IF;

    -- [3] Strict authorization & tenant/user boundary enforcement
    IF v_caller_role = 'SUPER_ADMIN' THEN
        IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
           AND LOWER(TRIM(COALESCE(v_caller_email, ''))) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Unverified Super Admin identity.';
        END IF;

        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL;
        END IF;
        v_enforced_user_id := p_user_id;

    ELSIF v_caller_role IN ('ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') THEN
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant data access violation. Caller belongs to tenant "%", attempted "%".', v_caller_tenant, p_tenant_id;
        END IF;
        v_enforced_tenant := v_caller_tenant;
        v_enforced_user_id := p_user_id;

    ELSIF v_caller_role = 'CUSTOMER' THEN
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Customer tenant boundary violation.';
        END IF;
        IF p_user_id IS NOT NULL AND p_user_id <> v_caller_id THEN
            RAISE EXCEPTION 'Access Denied: Customer cannot query other account records.';
        END IF;
        v_enforced_tenant := v_caller_tenant;
        v_enforced_user_id := v_caller_id;

    ELSE
        RAISE EXCEPTION 'Access Denied: Unauthorized role "%".', v_caller_role;
    END IF;

    -- [4] Lookup USD conversion rate from exchange_rates (INR base)
    SELECT rate INTO v_usd_rate
    FROM public.exchange_rates
    WHERE base_currency = 'INR' AND target_currency = 'USD' AND rate > 0
    ORDER BY effective_date DESC
    LIMIT 1;
    IF v_usd_rate IS NULL OR v_usd_rate <= 0 THEN
        v_usd_rate := 84.070000;
    END IF;

    -- [5] Core totals & multi-dimensional breakdowns in INR base
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

    -- Currency breakdown
    WITH eligible_tx AS (
        SELECT
            t.amount,
            COALESCE(NULLIF(TRIM(t.currency), ''), 'UNVERIFIED') AS currency,
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
    SELECT COALESCE(
        jsonb_object_agg(
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
        ),
        '{}'::jsonb
    )
    INTO v_volume_by_currency
    FROM (
        SELECT
            currency AS curr,
            ROUND(SUM(amount), 2) AS orig_sum,
            ROUND(COALESCE(SUM(calc_inr) FILTER (WHERE conv_flag = true), 0.00), 2) AS inr_sum,
            ROUND(AVG(eff_rate) FILTER (WHERE conv_flag = true), 6) AS avg_rate,
            MAX(eff_date) AS max_eff_date,
            COUNT(*) FILTER (WHERE conv_flag = false)::int AS unconv_rows
        FROM eligible_tx
        GROUP BY currency
    ) c;

    -- Daily settlement series (last 30 days present in filtered slice, ordered chronologically)
    WITH base_filtered AS (
        SELECT
            t.date,
            COALESCE(NULLIF(TRIM(t.category), ''), 'Operational') AS category,
            COALESCE(NULLIF(TRIM(t.merchant), ''), 'Global Clearing') AS merchant,
            CASE WHEN LOWER(COALESCE(NULLIF(TRIM(t.type), ''), 'Debit')) IN ('credit', 'deposit') THEN 'Credit' ELSE 'Debit' END AS tx_type,
            COALESCE(NULLIF(TRIM(t.status), ''), 'Settled') AS status,
            COALESCE(
                CASE
                    WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN t.amount_inr
                    WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN t.amount
                    WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN ROUND(t.amount * t.exchange_rate, 2)
                    WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(t.amount * fx.rate, 2)
                    ELSE 0.00
                END,
                0.00
            ) AS calc_inr
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
          AND (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR t.status = p_status)
          AND (p_type IS NULL OR p_type = '' OR p_type = 'ALL' OR t.type = p_type)
    )
    SELECT
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('date', d_date::text, 'volumeInr', d_vol, 'count', d_cnt) ORDER BY d_date ASC)
             FROM (
                 SELECT date AS d_date, ROUND(SUM(calc_inr), 2) AS d_vol, COUNT(*)::int AS d_cnt
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
                 SELECT category, COUNT(*)::int AS cnt, ROUND(SUM(calc_inr), 2) AS vol
                 FROM base_filtered
                 GROUP BY category
             ) cats),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_object_agg(tx_type, jsonb_build_object('count', cnt, 'volumeInr', vol))
             FROM (
                 SELECT tx_type, COUNT(*)::int AS cnt, ROUND(SUM(calc_inr), 2) AS vol
                 FROM base_filtered
                 GROUP BY tx_type
             ) tys),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_object_agg(status, jsonb_build_object('count', cnt, 'volumeInr', vol))
             FROM (
                 SELECT status, COUNT(*)::int AS cnt, ROUND(SUM(calc_inr), 2) AS vol
                 FROM base_filtered
                 GROUP BY status
             ) sts),
            '{}'::jsonb
        ),
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('merchant', merchant, 'count', cnt, 'volumeInr', vol))
             FROM (
                 SELECT merchant, COUNT(*)::int AS cnt, ROUND(SUM(calc_inr), 2) AS vol
                 FROM base_filtered
                 GROUP BY merchant
                 ORDER BY vol DESC
                 LIMIT 6
             ) merch),
            '[]'::jsonb
        )
    INTO
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

-- ------------------------------------------------------------------------------
-- 4. TASK 2A: GET_SUPPORT_AGGREGATES(p_tenant_id TEXT DEFAULT NULL)
-- Hardened RBAC, tenant enforcement, exact camelCase keys, zero synthetic values.
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
    v_sla_compliance_pct NUMERIC(5, 1) := 0.0;
    v_average_csat NUMERIC(3, 2) := 0.00;
    v_priority_dist JSONB := '[]'::jsonb;
    v_category_dist JSONB := '[]'::jsonb;
    v_executive_workload JSONB := '[]'::jsonb;
BEGIN
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required for support aggregation.';
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
            RAISE EXCEPTION 'Access Denied: Unverified or inactive caller profile.';
        END IF;
    END IF;

    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT_EXECUTIVE') THEN
        RAISE EXCEPTION 'Access Denied: Role "%" is unauthorized for support operational metrics.', v_caller_role;
    END IF;

    IF v_caller_role = 'SUPER_ADMIN' THEN
        IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
           AND LOWER(TRIM(COALESCE(v_caller_email, ''))) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Unverified Super Admin identity.';
        END IF;

        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL;
        END IF;
    ELSE
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant support telemetry access violation.';
        END IF;
        v_enforced_tenant := v_caller_tenant;
    END IF;

    SELECT
        COUNT(*)::int,
        COUNT(*) FILTER (WHERE UPPER(status) NOT IN ('RESOLVED', 'CLOSED'))::int,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('RESOLVED', 'CLOSED'))::int,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('IN PROGRESS', 'IN_PROGRESS'))::int,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('PENDING CLIENT', 'PENDING_CLIENT'))::int,
        COALESCE(ROUND(AVG(CASE WHEN COALESCE(hours_open, 0) <= COALESCE(sla_target_hours, 4) THEN 100.0 ELSE 0.0 END), 1), 0.0),
        COALESCE(ROUND(AVG(csat_rating) FILTER (WHERE csat_rating IS NOT NULL AND csat_rating > 0)::numeric, 2), 0.00)
    INTO
        v_total_tickets,
        v_open_count,
        v_closed_count,
        v_in_progress_count,
        v_pending_client_count,
        v_sla_compliance_pct,
        v_average_csat
    FROM public.support_tickets
    WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant);

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object('priority', priority, 'count', cnt)
            ORDER BY CASE priority
                WHEN 'Urgent' THEN 1
                WHEN 'High' THEN 2
                WHEN 'Medium' THEN 3
                WHEN 'Low' THEN 4
                ELSE 5
            END
        ),
        '[]'::jsonb
    )
    INTO v_priority_dist
    FROM (
        SELECT COALESCE(NULLIF(TRIM(priority), ''), 'Medium') AS priority, COUNT(*)::int AS cnt
        FROM public.support_tickets
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
        GROUP BY COALESCE(NULLIF(TRIM(priority), ''), 'Medium')
    ) p;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'category', category,
                'count', cnt,
                'percentage', CASE WHEN v_total_tickets > 0 THEN ROUND(cnt * 100.0 / v_total_tickets, 1) ELSE 0.0 END
            )
            ORDER BY cnt DESC
        ),
        '[]'::jsonb
    )
    INTO v_category_dist
    FROM (
        SELECT COALESCE(NULLIF(TRIM(category), ''), 'General Inquiry') AS category, COUNT(*)::int AS cnt
        FROM public.support_tickets
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
        GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'General Inquiry')
    ) c;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'executive', executive,
                'activeTickets', active_tickets,
                'resolvedTickets', resolved_tickets
            )
            ORDER BY active_tickets DESC
        ),
        '[]'::jsonb
    )
    INTO v_executive_workload
    FROM (
        SELECT
            COALESCE(NULLIF(TRIM(assigned_executive), ''), 'Unassigned Desk') AS executive,
            COUNT(*) FILTER (WHERE UPPER(status) NOT IN ('RESOLVED', 'CLOSED'))::int AS active_tickets,
            COUNT(*) FILTER (WHERE UPPER(status) IN ('RESOLVED', 'CLOSED'))::int AS resolved_tickets
        FROM public.support_tickets
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
        GROUP BY COALESCE(NULLIF(TRIM(assigned_executive), ''), 'Unassigned Desk')
    ) e;

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
-- 5. TASK 2B: GET_KYC_AGGREGATES(p_tenant_id TEXT DEFAULT NULL)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_kyc_aggregates(TEXT);

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
        RAISE EXCEPTION 'Access Denied: Authentication required for KYC aggregation.';
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
            RAISE EXCEPTION 'Access Denied: Unverified or inactive caller profile.';
        END IF;
    END IF;

    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') THEN
        RAISE EXCEPTION 'Access Denied: Role "%" is unauthorized for institutional KYC aggregates.', v_caller_role;
    END IF;

    IF v_caller_role = 'SUPER_ADMIN' THEN
        IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
           AND LOWER(TRIM(COALESCE(v_caller_email, ''))) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Unverified Super Admin identity.';
        END IF;

        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL;
        END IF;
    ELSE
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant KYC compliance telemetry access violation.';
        END IF;
        v_enforced_tenant := v_caller_tenant;
    END IF;

    SELECT
        COUNT(*)::int,
        COUNT(*) FILTER (WHERE status = 'Verified')::int,
        COUNT(*) FILTER (WHERE status = 'Pending')::int,
        COUNT(*) FILTER (WHERE status = 'Under Review')::int
    INTO
        v_total_records,
        v_verified_count,
        v_pending_count,
        v_review_count
    FROM public.kyc_records
    WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant);

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

    SELECT COALESCE(
        jsonb_agg(jsonb_build_object('label', doc_label, 'value', cnt) ORDER BY cnt DESC),
        '[]'::jsonb
    )
    INTO v_doc_type_dist
    FROM (
        SELECT COALESCE(NULLIF(TRIM(document_type), ''), 'Unspecified') AS doc_label, COUNT(*)::int AS cnt
        FROM public.kyc_records
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
        GROUP BY COALESCE(NULLIF(TRIM(document_type), ''), 'Unspecified')
    ) d;

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
-- 6. TASK 2C: GET_PLATFORM_EXECUTIVE_KPIS() (STRICTLY VERIFIED SUPER_ADMIN)
-- Zero fabricated fallback numbers when tables are empty.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_platform_executive_kpis();

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

    v_settled_volume_ytd NUMERIC(18, 2) := 0.00;
    v_institutional_mrr NUMERIC(15, 2) := 0.00;
    v_prevented_fraud_volume NUMERIC(18, 2) := 0.00;
    v_sla_compliance_pct NUMERIC(5, 1) := 0.0;
    v_compliance_score NUMERIC(5, 1) := 0.0;
    v_active_users INT := 0;
    v_net_liquid_balance NUMERIC(18, 2) := 0.00;
    v_risk_exposure_score INT := 0;
BEGIN
    IF v_caller_id IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Authentication required for Global Executive KPIs.';
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
            RAISE EXCEPTION 'Access Denied: Global Executive KPIs are restricted exclusively to the verified Platform Super Admin.';
        END IF;
    END IF;

    -- 1. Settled volume YTD (INR converted safely)
    SELECT COALESCE(SUM(
        CASE
            WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN t.amount_inr
            WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN t.amount
            WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN ROUND(t.amount * t.exchange_rate, 2)
            WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(t.amount * fx.rate, 2)
            ELSE 0.00
        END
    ), 0.00)
    INTO v_settled_volume_ytd
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
    WHERE LOWER(t.status) IN ('settled', 'escrow secured', 'completed', 'success')
      AND t.date >= date_trunc('year', timezone('utc', now()))::date;

    -- 2. Institutional MRR from active tenant workspaces (excluding platform_root operator row)
    SELECT COALESCE(SUM(mrr), 0.00)
    INTO v_institutional_mrr
    FROM public.tenant_workspaces
    WHERE status = 'Active' AND id <> 'platform_root';

    -- 3. Prevented fraud volume (INR converted safely for Frozen Escrow)
    SELECT COALESCE(SUM(
        CASE
            WHEN fc.amount_inr IS NOT NULL AND fc.amount_inr >= 0 THEN fc.amount_inr
            WHEN COALESCE(NULLIF(TRIM(fc.currency), ''), '') = 'INR' THEN fc.amount
            WHEN fc.exchange_rate IS NOT NULL AND fc.exchange_rate > 0 THEN ROUND(fc.amount * fc.exchange_rate, 2)
            WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(fc.amount * fx.rate, 2)
            ELSE 0.00
        END
    ), 0.00)
    INTO v_prevented_fraud_volume
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
    WHERE fc.status = 'Frozen Escrow';

    -- 4. Operational SLA Compliance from actual support tickets (0.0 if empty)
    SELECT COALESCE(ROUND(AVG(CASE WHEN COALESCE(hours_open, 0) <= COALESCE(sla_target_hours, 4) THEN 100.0 ELSE 0.0 END), 1), 0.0)
    INTO v_sla_compliance_pct
    FROM public.support_tickets;

    -- 5. Global compliance score across active tenants (0.0 if empty)
    SELECT COALESCE(ROUND(AVG(compliance_score), 1), 0.0)
    INTO v_compliance_score
    FROM public.tenant_workspaces
    WHERE status = 'Active';

    -- 6. Total active users across tenant workspaces (fallback to active profile count if tenant counters are 0)
    SELECT COALESCE(
        NULLIF((SELECT SUM(users_count)::int FROM public.tenant_workspaces WHERE status = 'Active' AND id <> 'platform_root'), 0),
        (SELECT COUNT(*)::int FROM public.profiles WHERE status::text = 'Active'),
        0
    )
    INTO v_active_users;

    -- 7. Net liquid balance (INR base Credits - Debits)
    SELECT COALESCE(SUM(
        CASE
            WHEN LOWER(COALESCE(t.type, 'Debit')) IN ('credit', 'deposit') THEN 1
            ELSE -1
        END * CASE
            WHEN t.amount_inr IS NOT NULL AND t.amount_inr >= 0 THEN t.amount_inr
            WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'INR' THEN t.amount
            WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN ROUND(t.amount * t.exchange_rate, 2)
            WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN ROUND(t.amount * fx.rate, 2)
            ELSE 0.00
        END
    ), 0.00)
    INTO v_net_liquid_balance
    FROM public.transactions t
    LEFT JOIN LATERAL (
        SELECT rate
        FROM public.exchange_rates
        WHERE base_currency = 'INR'
          AND target_currency = COALESCE(NULLIF(TRIM(t.currency), ''), '')
          AND rate > 0
        ORDER BY effective_date DESC
        LIMIT 1
    ) fx ON true;

    -- 8. Composite risk exposure score from active Flagged / In Review fraud cases (0 if empty)
    SELECT COALESCE(ROUND(AVG(risk_score), 0), 0)::int
    INTO v_risk_exposure_score
    FROM public.fraud_cases
    WHERE status IN ('Flagged', 'In Review');

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
-- 7. TASK 2D: GET_TRANSFER_INTELLIGENCE_AGGREGATES(...)
-- Replaces prior TIMESTAMPTZ signature cleanly (zero duplicate overload), adds strict
-- caller authentication, RBAC & tenant isolation, and real hourly velocity on created_at.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_transfer_intelligence_aggregates(TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT);
DROP FUNCTION IF EXISTS public.get_transfer_intelligence_aggregates(TEXT, DATE, DATE, TEXT);

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
        RAISE EXCEPTION 'Access Denied: Authentication required for transfer intelligence aggregation.';
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
            RAISE EXCEPTION 'Access Denied: Unverified or inactive caller profile.';
        END IF;
    END IF;

    IF v_caller_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') THEN
        RAISE EXCEPTION 'Access Denied: Role "%" is unauthorized for institutional transfer intelligence.', v_caller_role;
    END IF;

    IF v_caller_role = 'SUPER_ADMIN' THEN
        IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
           AND LOWER(TRIM(COALESCE(v_caller_email, ''))) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Unverified Super Admin identity.';
        END IF;

        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL;
        END IF;
    ELSE
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant transfer intelligence access violation.';
        END IF;
        v_enforced_tenant := v_caller_tenant;
    END IF;

    SELECT
        COUNT(*)::int,
        COALESCE(SUM(amount), 0.00),
        COUNT(*) FILTER (WHERE LOWER(status) IN ('settled', 'escrow secured', 'success', 'completed'))::int,
        COUNT(*) FILTER (WHERE LOWER(status) IN ('pending', 'clearing'))::int,
        COUNT(*) FILTER (WHERE LOWER(status) = 'failed')::int,
        COUNT(*) FILTER (WHERE LOWER(status) = 'reversed')::int,
        COUNT(*) FILTER (WHERE COALESCE(is_flagged_fraud, FALSE) = TRUE)::int
    INTO
        v_total_transfers,
        v_total_volume,
        v_success_count,
        v_pending_count,
        v_failed_count,
        v_reversed_count,
        v_fraud_flagged_count
    FROM public.transactions
    WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
      AND (p_start_date IS NULL OR date >= p_start_date)
      AND (p_end_date IS NULL OR date <= p_end_date)
      AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR currency = p_currency);

    SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'value', value)), '[]'::jsonb)
    INTO v_status_dist
    FROM (
        SELECT COALESCE(NULLIF(TRIM(status), ''), 'Settled') AS label, COUNT(*)::int AS value
        FROM public.transactions
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR currency = p_currency)
        GROUP BY COALESCE(NULLIF(TRIM(status), ''), 'Settled')
    ) d;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'value', value)), '[]'::jsonb)
    INTO v_category_dist
    FROM (
        SELECT COALESCE(NULLIF(TRIM(category), ''), 'Operational') AS label, COUNT(*)::int AS value
        FROM public.transactions
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR currency = p_currency)
        GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'Operational')
    ) d;

    SELECT COALESCE(jsonb_object_agg(curr, total_amt), '{}'::jsonb)
    INTO v_currency_exposure
    FROM (
        SELECT COALESCE(NULLIF(TRIM(currency), ''), 'INR') AS curr, ROUND(COALESCE(SUM(amount), 0.00), 2) AS total_amt
        FROM public.transactions
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR currency = p_currency)
        GROUP BY COALESCE(NULLIF(TRIM(currency), ''), 'INR')
    ) d;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'value', value)), '[]'::jsonb)
    INTO v_channel_perf
    FROM (
        SELECT COALESCE(NULLIF(TRIM(channel), ''), 'Online') AS label, COUNT(*)::int AS value
        FROM public.transactions
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR currency = p_currency)
        GROUP BY COALESCE(NULLIF(TRIM(channel), ''), 'Online')
    ) d;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', hour_bucket, 'volume', vol) ORDER BY hour_bucket ASC), '[]'::jsonb)
    INTO v_hourly_velocity
    FROM (
        SELECT
            TO_CHAR(COALESCE(created_at, date::timestamptz) AT TIME ZONE 'UTC', 'HH24:00') AS hour_bucket,
            ROUND(COALESCE(SUM(amount), 0.00), 2) AS vol
        FROM public.transactions
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = '' OR p_currency = 'ALL' OR currency = p_currency)
        GROUP BY 1
    ) d;

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

-- ------------------------------------------------------------------------------
-- 8. TASK 4: SECURE PUBLIC SIGNUP TENANT DIRECTORY & SAFE EXCHANGE_RATES ACCESS
-- ------------------------------------------------------------------------------

-- 8a. Remove unsafe anon direct SELECT policy & privilege on public.tenant_workspaces
DROP POLICY IF EXISTS "anon_view_active_tenants" ON public.tenant_workspaces;
REVOKE ALL ON public.tenant_workspaces FROM PUBLIC, anon;
GRANT SELECT ON public.tenant_workspaces TO authenticated;
GRANT ALL ON public.tenant_workspaces TO service_role;

-- Safe public tenant directory returning ONLY id, name, short_name for active non-platform-root workspaces
DROP FUNCTION IF EXISTS public.get_public_tenant_directory();

CREATE OR REPLACE FUNCTION public.get_public_tenant_directory()
RETURNS TABLE (
    id TEXT,
    name TEXT,
    short_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        tw.id,
        tw.name,
        tw.short_name
    FROM public.tenant_workspaces tw
    WHERE tw.status = 'Active'
      AND tw.id <> 'platform_root'
    ORDER BY tw.name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_public_tenant_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_directory() TO anon, authenticated, service_role;

-- 8b. Restore minimum safe public read-only SELECT access on public.exchange_rates
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Allow read access to exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "read_all_rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "public_read_exchange_rates" ON public.exchange_rates;

CREATE POLICY "public_read_exchange_rates" ON public.exchange_rates
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "super_admin_manage_rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Restrict exchange rate modifications" ON public.exchange_rates;
DROP POLICY IF EXISTS "super_admin_write_exchange_rates" ON public.exchange_rates;

CREATE POLICY "super_admin_write_exchange_rates" ON public.exchange_rates
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

REVOKE ALL ON public.exchange_rates FROM PUBLIC, anon;
GRANT SELECT ON public.exchange_rates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
