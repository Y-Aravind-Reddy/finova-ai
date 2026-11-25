-- ==============================================================================
-- FINOVA AI — CORRECT SUPPORT TICKET DATES PUSHED INTO THE FUTURE
-- Migration ID: 20261129_fix_support_tickets_future_dates
--
-- 20261128 shifted support_tickets by the same offset as transactions, but the
-- tickets already ended later than the transactions did, so they landed in the
-- future (newest opened_at = 2027-08-25). This moves every date / timestamp
-- column in support_tickets BACK so the newest ticket is opened today.
--
-- Safe to re-run: the offset is (newest opened_at - today), so a second run
-- moves by 0 days and changes nothing.
-- ==============================================================================

DO $$
DECLARE
    v_back_days INT;
    v_set_clause TEXT;
BEGIN
    SELECT (MAX(opened_at)::date - CURRENT_DATE)::int INTO v_back_days FROM public.support_tickets;

    IF v_back_days IS NULL OR v_back_days <= 0 THEN
        RAISE NOTICE 'Support tickets are not in the future (offset = % days). Nothing to do.', v_back_days;
        RETURN;
    END IF;

    SELECT string_agg(
               format('%1$I = %1$I - make_interval(days => %2$s)', column_name, v_back_days),
               ', '
           )
    INTO v_set_clause
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
      AND data_type IN ('date', 'timestamp without time zone', 'timestamp with time zone');

    EXECUTE format('UPDATE public.support_tickets SET %s', v_set_clause);
    RAISE NOTICE 'Moved support_tickets back % days.', v_back_days;
END $$;

ANALYZE public.support_tickets;

SELECT 'support_tickets' AS table_name,
       MIN(opened_at)::date::text AS oldest,
       MAX(opened_at)::date::text AS newest
FROM public.support_tickets;
