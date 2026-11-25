-- ==============================================================================
-- FINOVA AI — SHIFT DEMO DATA FORWARD SO DASHBOARDS SHOW CURRENT ACTIVITY
-- Migration ID: 20261128_shift_demo_data_to_current_date
--
-- Problem: every dashboard opens on a YTD / 90D / 30D window, but all seeded
-- transactions, fraud cases and support tickets end on 2025-12-31, so the
-- default windows are empty and widgets show 0.
--
-- Fix: move EVERY date / timestamp column in each table forward so that
-- table's newest record lands on today. Relative order and gaps between
-- records within a table are preserved.
--
-- Safe to re-run: each shift is (today - that table's newest date), so a
-- second run shifts by 0 days and changes nothing.
-- ==============================================================================

DO $$
DECLARE
    v_shift_days INT;
    v_table TEXT;
    v_anchor TEXT;
    v_set_clause TEXT;
BEGIN
    -- Each table is shifted by its OWN offset (today - its newest record), so a
    -- table whose data already ends later is never pushed into the future.
    FOREACH v_table IN ARRAY ARRAY['transactions', 'fraud_cases', 'support_tickets']
    LOOP
        v_anchor := CASE v_table
            WHEN 'transactions' THEN 'date'
            WHEN 'fraud_cases' THEN 'timestamp'
            ELSE 'opened_at'
        END;

        EXECUTE format('SELECT (CURRENT_DATE - MAX(%I)::date)::int FROM public.%I', v_anchor, v_table)
        INTO v_shift_days;

        IF v_shift_days IS NULL OR v_shift_days <= 0 THEN
            RAISE NOTICE '% is already current (shift = % days). Skipping.', v_table, v_shift_days;
            CONTINUE;
        END IF;

        SELECT string_agg(
                   format('%1$I = %1$I + make_interval(days => %2$s)', column_name, v_shift_days),
                   ', '
               )
        INTO v_set_clause
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = v_table
          AND data_type IN ('date', 'timestamp without time zone', 'timestamp with time zone');

        IF v_set_clause IS NOT NULL THEN
            EXECUTE format('UPDATE public.%I SET %s', v_table, v_set_clause);
            RAISE NOTICE 'Shifted %: %', v_table, v_set_clause;
        END IF;
    END LOOP;
END $$;

ANALYZE public.transactions;
ANALYZE public.fraud_cases;
ANALYZE public.support_tickets;

-- Result: new date range per table
SELECT 'transactions' AS table_name, MIN(date)::text AS oldest, MAX(date)::text AS newest FROM public.transactions
UNION ALL
SELECT 'fraud_cases', MIN(timestamp)::date::text, MAX(timestamp)::date::text FROM public.fraud_cases
UNION ALL
SELECT 'support_tickets', MIN(opened_at)::date::text, MAX(opened_at)::date::text FROM public.support_tickets;
