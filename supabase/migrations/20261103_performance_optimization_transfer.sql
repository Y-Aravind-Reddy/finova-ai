-- ==============================================================================
-- FINOVA AI — PERFORMANCE OPTIMIZATION & TRANSFER ANALYTICS RPC
-- Migration ID: 20261103_performance_optimization_transfer
-- Status: IDEMPOTENT, NON-DESTRUCTIVE
-- ==============================================================================

-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. PERFORMANCE INDEXES FOR TRANSACTIONS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date_desc ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON public.transactions(currency);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_channel ON public.transactions(channel);

-- Trigram indexes for fast search (ilike %...%)
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_trgm ON public.transactions USING gin (merchant gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_trgm ON public.transactions USING gin (reference_no gin_trgm_ops);

-- 3. ANALYTICAL RPC: get_transfer_intelligence_aggregates
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_transfer_intelligence_aggregates(
    p_tenant_id TEXT DEFAULT NULL,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
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
    
    v_total_transfers INT := 0;
    v_total_volume NUMERIC(18, 2) := 0;
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
    -- [1] Resolve Identity
    SELECT role::text, tenant_id INTO v_caller_role, v_caller_tenant FROM public.profiles WHERE id = v_caller_id;
    
    -- [2] Tenant Boundary
    IF v_caller_role = 'SUPER_ADMIN' THEN
        v_enforced_tenant := CASE WHEN p_tenant_id IS NOT NULL AND p_tenant_id <> 'ALL' THEN p_tenant_id ELSE NULL END;
    ELSE
        v_enforced_tenant := v_caller_tenant;
    END IF;

    -- [3] Core Aggregates
    SELECT 
        COUNT(*),
        COALESCE(SUM(amount), 0),
        COUNT(*) FILTER (WHERE LOWER(status) IN ('settled', 'success', 'completed')),
        COUNT(*) FILTER (WHERE LOWER(status) IN ('pending', 'clearing')),
        COUNT(*) FILTER (WHERE LOWER(status) = 'failed'),
        COUNT(*) FILTER (WHERE LOWER(status) = 'reversed'),
        COUNT(*) FILTER (WHERE is_flagged_fraud = TRUE)
    INTO 
        v_total_transfers, v_total_volume, v_success_count, v_pending_count, v_failed_count, v_reversed_count, v_fraud_flagged_count
    FROM public.transactions
    WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
      AND (p_start_date IS NULL OR date >= p_start_date)
      AND (p_end_date IS NULL OR date <= p_end_date)
      AND (p_currency IS NULL OR p_currency = 'ALL' OR currency = p_currency);

    -- [4] Status Distribution
    SELECT jsonb_agg(d) INTO v_status_dist FROM (
        SELECT status as label, COUNT(*) as value 
        FROM public.transactions 
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = 'ALL' OR currency = p_currency)
        GROUP BY status
    ) d;

    -- [5] Category Mix
    SELECT jsonb_agg(d) INTO v_category_dist FROM (
        SELECT category as label, COUNT(*) as value 
        FROM public.transactions 
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = 'ALL' OR currency = p_currency)
        GROUP BY category
    ) d;

    -- [6] Currency Exposure
    SELECT jsonb_object_agg(currency, total_amt) INTO v_currency_exposure FROM (
        SELECT currency, SUM(amount) as total_amt 
        FROM public.transactions 
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = 'ALL' OR currency = p_currency)
        GROUP BY currency
    ) d;

    -- [7] Channel Performance
    SELECT jsonb_agg(d) INTO v_channel_perf FROM (
        SELECT COALESCE(channel, 'Online') as label, COUNT(*) as value 
        FROM public.transactions 
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = 'ALL' OR currency = p_currency)
        GROUP BY COALESCE(channel, 'Online')
    ) d;

    -- [8] Hourly Velocity (Aggregated by hour)
    SELECT jsonb_agg(d) INTO v_hourly_velocity FROM (
        SELECT 
            TO_CHAR(date, 'HH24:00') as hour, 
            SUM(amount) as volume 
        FROM public.transactions 
        WHERE (v_enforced_tenant IS NULL OR tenant_id = v_enforced_tenant)
          AND (p_start_date IS NULL OR date >= p_start_date)
          AND (p_end_date IS NULL OR date <= p_end_date)
          AND (p_currency IS NULL OR p_currency = 'ALL' OR currency = p_currency)
        GROUP BY 1
        ORDER BY 1
    ) d;

    RETURN jsonb_build_object(
        'totalTransfers', v_total_transfers,
        'totalVolume', v_total_volume,
        'successCount', v_success_count,
        'pendingCount', v_pending_count,
        'failedCount', v_failed_count,
        'reversedCount', v_reversed_count,
        'avgAmount', CASE WHEN v_total_transfers > 0 THEN ROUND(v_total_volume / v_total_transfers, 2) ELSE 0 END,
        'fraudFlaggedCount', v_fraud_flagged_count,
        'statusDistribution', COALESCE(v_status_dist, '[]'::jsonb),
        'categoryMix', COALESCE(v_category_dist, '[]'::jsonb),
        'currencyExposure', COALESCE(v_currency_exposure, '{}'::jsonb),
        'channelPerformance', COALESCE(v_channel_perf, '[]'::jsonb),
        'hourlyVelocity', COALESCE(v_hourly_velocity, '[]'::jsonb)
    );
END;
$$;

-- 4. PERMISSIONS
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_transfer_intelligence_aggregates(TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated, service_role;
