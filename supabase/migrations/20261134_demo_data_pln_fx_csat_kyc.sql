-- ==============================================================================
-- FINOVA AI — DEMO DATA COMPLETION: PLN FX RATE, CSAT RATINGS, KYC RECORDS
-- Migration ID: 20261134_demo_data_pln_fx_csat_kyc
-- Safe to re-run: every step skips rows it already created / filled.
--
--   1. PLN exchange rate  -> converts the 10,360 "unconverted" PLN transactions
--                            and 5,197 PLN fraud cases into INR in all reports
--   2. CSAT ratings       -> 1-5 ratings on resolved / closed support tickets
--   3. KYC records        -> one record per real profile + 600 demo records
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PLN -> INR reference rate (INR per 1 PLN; EUR cross: 91.12 / ~4.30)
-- ------------------------------------------------------------------------------
INSERT INTO public.exchange_rates
    (id, base_currency, target_currency, rate, inverse_rate, effective_date, source, is_stale)
VALUES
    ('FX-PLN-INR', 'INR', 'PLN', 21.190000, 0.047192, DATE '2026-10-27',
     'NBP / RBI EUR Cross Reference (Static Benchmark)', false)
ON CONFLICT (id) DO UPDATE
SET rate = EXCLUDED.rate,
    inverse_rate = EXCLUDED.inverse_rate,
    effective_date = EXCLUDED.effective_date,
    source = EXCLUDED.source,
    is_stale = false;

-- ------------------------------------------------------------------------------
-- 2. CSAT ratings on resolved / closed tickets that have none yet
--    Distribution ~ 5: 45%, 4: 30%, 3: 13%, 2: 7%, 1: 5%  (average about 4.0)
-- ------------------------------------------------------------------------------
UPDATE public.support_tickets
SET csat_rating = CASE
        WHEN r < 0.45 THEN 5
        WHEN r < 0.75 THEN 4
        WHEN r < 0.88 THEN 3
        WHEN r < 0.95 THEN 2
        ELSE 1
    END
FROM (SELECT ticket_id AS tid, random() AS r FROM public.support_tickets) rnd
WHERE support_tickets.ticket_id = rnd.tid
  AND support_tickets.csat_rating IS NULL
  AND UPPER(COALESCE(support_tickets.status::text, '')) IN ('RESOLVED', 'CLOSED');

-- ------------------------------------------------------------------------------
-- 3a. One KYC record per real user profile (so each customer sees their own status)
-- ------------------------------------------------------------------------------
INSERT INTO public.kyc_records
    (id, user_id, tenant_id, tenant_name, title, document_type, file_size, status, verified_by, uploaded_at)
SELECT
    'KYC-USER-' || substr(replace(p.id::text, '-', ''), 1, 12),
    p.id,
    p.tenant_id,
    tw.name,
    CASE WHEN p.role::text = 'CUSTOMER' THEN 'Customer Identity Verification' ELSE 'Staff Identity Verification' END,
    (ARRAY['PAN Card', 'Aadhaar Card', 'Passport'])[1 + (abs(hashtext(p.id::text)) % 3)],
    round(1 + (abs(hashtext(p.id::text)) % 30) / 10.0, 1)::text || ' MB',
    CASE WHEN p.role::text = 'CUSTOMER' AND abs(hashtext(p.id::text)) % 3 = 0 THEN 'Pending' ELSE 'Verified' END,
    CASE WHEN p.role::text = 'CUSTOMER' AND abs(hashtext(p.id::text)) % 3 = 0 THEN NULL ELSE 'Onboarding Desk' END,
    timezone('utc', now()) - make_interval(days => 5 + abs(hashtext(p.id::text)) % 60)
FROM public.profiles p
LEFT JOIN public.tenant_workspaces tw ON tw.id = p.tenant_id
WHERE p.tenant_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3b. 600 demo institutional KYC records for tenant_apex_bank (last 180 days)
--     Status mix ~ Verified 62%, Pending 18%, Under Review 20%
--     (chk_kyc_status allows only Verified, Under Review, Archived, Pending)
-- ------------------------------------------------------------------------------
INSERT INTO public.kyc_records
    (id, user_id, tenant_id, tenant_name, title, document_type, file_size, status, verified_by, uploaded_at)
SELECT
    'KYC-DEMO-' || lpad(g::text, 4, '0'),
    NULL,
    'tenant_apex_bank',
    (SELECT name FROM public.tenant_workspaces WHERE id = 'tenant_apex_bank'),
    (ARRAY['Retail Onboarding', 'Private Wealth Onboarding', 'Corporate Onboarding', 'Periodic Re-KYC'])[1 + g % 4],
    (ARRAY['PAN Card', 'Aadhaar Card', 'Passport', 'Utility Bill', 'Driving Licence',
           'Certificate of Incorporation', 'Board Resolution', 'Beneficial Ownership Declaration'])[1 + (g * 7) % 8],
    round(0.4 + ((g * 13) % 46) / 10.0, 1)::text || ' MB',
    st.status,
    CASE WHEN st.status = 'Verified' THEN (ARRAY['Onboarding Desk', 'Compliance Officer', 'Video-KYC Team'])[1 + g % 3] END,
    timezone('utc', now()) - make_interval(days => (g * 17) % 180, hours => (g * 5) % 24)
FROM generate_series(1, 600) AS g
CROSS JOIN LATERAL (
    SELECT CASE
        WHEN (g * 37) % 100 < 62 THEN 'Verified'
        WHEN (g * 37) % 100 < 80 THEN 'Pending'
        ELSE 'Under Review'
    END AS status
) st
ON CONFLICT (id) DO NOTHING;

ANALYZE public.exchange_rates;
ANALYZE public.support_tickets;
ANALYZE public.kyc_records;

-- ------------------------------------------------------------------------------
-- Result summary
-- ------------------------------------------------------------------------------
SELECT 'PLN rate (INR per PLN)' AS item, rate::text AS value FROM public.exchange_rates WHERE id = 'FX-PLN-INR'
UNION ALL
SELECT 'Tickets with CSAT', count(*)::text FROM public.support_tickets WHERE csat_rating IS NOT NULL
UNION ALL
SELECT 'Average CSAT', round(avg(csat_rating)::numeric, 2)::text FROM public.support_tickets WHERE csat_rating IS NOT NULL
UNION ALL
SELECT 'KYC records: ' || status, count(*)::text FROM public.kyc_records GROUP BY status;
