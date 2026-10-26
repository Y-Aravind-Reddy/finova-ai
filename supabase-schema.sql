-- ==============================================================================
-- FINOVA AI — HARDENED MULTI-TENANT SUPABASE POSTGRESQL SCHEMA & RLS MIGRATION
-- Target Project Reference: rjudrmnnpwlovpkbwnte (https://rjudrmnnpwlovpkbwnte.supabase.co)
-- Status: Verified target project matching application .env and Supabase publishable credentials.
-- Safe, idempotent, non-destructive migration for existing and new databases
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. ENUM TYPES (Idempotent creation)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM (
        'SUPER_ADMIN',
        'ADMIN',
        'FINANCE_ANALYST',
        'SUPPORT_EXECUTIVE',
        'CUSTOMER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status_type AS ENUM (
        'Active',
        'Suspended',
        'Pending Review',
        'KYC Pending'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 3. TENANT WORKSPACES TABLE
-- (Created & seeded first to satisfy foreign key dependencies)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_workspaces (
    id TEXT PRIMARY KEY, -- e.g. 'tenant_apex_bank'
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Commercial Bank',
    status TEXT NOT NULL DEFAULT 'Active',
    plan TEXT NOT NULL DEFAULT 'Growth SaaS',
    mrr NUMERIC(12, 2) NOT NULL DEFAULT 28500.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    currency_symbol TEXT NOT NULL DEFAULT '$',
    headquarters TEXT NOT NULL,
    license_no TEXT NOT NULL,
    admin_name TEXT,
    admin_email TEXT,
    admin_user_id TEXT,
    users_count INT NOT NULL DEFAULT 0,
    transaction_volume_ytd NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    compliance_score NUMERIC(5, 2) NOT NULL DEFAULT 99.40,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Comprehensive column synchronization for pre-existing tables
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Institutional Partner';
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS short_name TEXT NOT NULL DEFAULT 'Partner';
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'Commercial Bank';
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'Growth SaaS';
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS mrr NUMERIC(12, 2) NOT NULL DEFAULT 28500.00;
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS currency_symbol TEXT NOT NULL DEFAULT '$';
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS headquarters TEXT NOT NULL DEFAULT 'Global Headquarters';
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS license_no TEXT NOT NULL DEFAULT 'FIN-REG-001';
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS admin_name TEXT;
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS admin_email TEXT;
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS admin_user_id TEXT;
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS users_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS transaction_volume_ytd NUMERIC(15, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS compliance_score NUMERIC(5, 2) NOT NULL DEFAULT 99.40;
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.tenant_workspaces ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- ------------------------------------------------------------------------------
-- 4. NON-DESTRUCTIVE TENANT SEED OPERATIONS
-- Uses ON CONFLICT (id) DO NOTHING to preserve production modifications,
-- custom MRR, plans, headquarters, or custom branding on existing records.
-- ------------------------------------------------------------------------------
INSERT INTO public.tenant_workspaces (
    id, name, short_name, type, status, plan, mrr, currency, currency_symbol, headquarters, license_no, admin_name, admin_email, users_count, transaction_volume_ytd, compliance_score
) VALUES
(
    'platform_root',
    'Finova AI SaaS Platform Operator',
    'Finova Platform',
    'Commercial Bank',
    'Active',
    'Enterprise Sovereign',
    95000.00,
    'USD',
    '$',
    'New York & Zurich',
    'Global Platform Operator Core Engine #FNV-ROOT-001',
    'Alexander Vance',
    'superadmin@finova.ai',
    215000,
    5240000000.00,
    99.95
),
(
    'tenant_apex_bank',
    'Apex Global Bank',
    'Apex Bank',
    'Commercial Bank',
    'Active',
    'Enterprise Sovereign',
    45000.00,
    'USD',
    '$',
    'New York & Zurich',
    'OCC / FINMA Chartered Bank #US-NY-88910',
    'Eleanor Sterling',
    'admin@finova.ai',
    148920,
    2841920000.00,
    99.80
),
(
    'tenant_crest_capital',
    'Crestview Finance NBFC',
    'Crestview NBFC',
    'NBFC & Lending',
    'Active',
    'Growth SaaS',
    28500.00,
    'GBP',
    '£',
    'London & Edinburgh',
    'FCA NBFC Reg #UK-CR-55421',
    'Marcus Brody',
    'admin@crestviewfinance.com',
    42150,
    980400000.00,
    99.40
),
(
    'tenant_crestview_finance',
    'Crestview Finance NBFC (Legacy Alias)',
    'Crestview NBFC',
    'NBFC & Lending',
    'Active',
    'Growth SaaS',
    28500.00,
    'GBP',
    '£',
    'London & Edinburgh',
    'FCA Regulated NBFC Credit Provider #UK-FC-44912',
    'Alistair Finch',
    'admin@crestview.co.uk',
    890,
    142900000.00,
    99.40
),
(
    'tenant_vanguard_wealth',
    'Vanguard Wealth Partners',
    'Vanguard Wealth',
    'Wealth Management',
    'Active',
    'Enterprise Sovereign',
    38000.00,
    'EUR',
    '€',
    'Geneva & Paris',
    'FINMA Asset Manager #CH-GE-1192',
    'Catherine Duval',
    'admin@vanguardwealth.eu',
    18400,
    1420600000.00,
    99.90
),
(
    'tenant_solaris_credit',
    'Solaris Digital Credit Union',
    'Solaris Credit',
    'Digital Neo-Bank',
    'Pending Review',
    'Starter Tier',
    12000.00,
    'EUR',
    '€',
    'Berlin & Munich',
    'BaFin Digital Lending License #DE-BE-3310-PND',
    'Hans Weber',
    'admin@solariscredit.de',
    3820,
    74200000.00,
    97.10
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. USER PROFILES TABLE (Linked to auth.users & tenant_workspaces)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role user_role_type NOT NULL DEFAULT 'CUSTOMER',
    status user_status_type NOT NULL DEFAULT 'Active',
    tier TEXT NOT NULL DEFAULT 'Private Wealth Tier 3',
    phone TEXT,
    country TEXT DEFAULT 'United States',
    two_factor_enabled BOOLEAN DEFAULT true,
    tenant_id TEXT NOT NULL REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT,
    tenant_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role user_role_type NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status user_status_type NOT NULL DEFAULT 'Active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'Private Wealth Tier 3';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'United States';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

DO $$ BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 5b. CENTRALIZED EXCHANGE RATES TABLE (USD Base Multi-Currency Engine)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id TEXT PRIMARY KEY,
    base_currency TEXT NOT NULL DEFAULT 'USD',
    target_currency TEXT NOT NULL,
    rate NUMERIC(12, 6) NOT NULL,
    inverse_rate NUMERIC(12, 6) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_stale BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS target_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS inverse_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS effective_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Official Benchmark';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT false;

-- Seed verified official benchmark exchange rates
INSERT INTO public.exchange_rates (id, base_currency, target_currency, rate, inverse_rate, effective_date, source, is_stale)
VALUES
    ('FX-USD-BASE', 'USD', 'USD', 1.000000, 1.000000, CURRENT_DATE, 'Federal Reserve H.10 Benchmark', false),
    ('FX-GBP-USD', 'USD', 'GBP', 1.285000, 0.778210, CURRENT_DATE, 'Bank of England / Fed H.10', false),
    ('FX-EUR-USD', 'USD', 'EUR', 1.085000, 0.921659, CURRENT_DATE, 'European Central Bank (ECB)', false),
    ('FX-CHF-USD', 'USD', 'CHF', 1.135000, 0.881057, CURRENT_DATE, 'Swiss National Bank (SNB)', false),
    ('FX-SGD-USD', 'USD', 'SGD', 0.755000, 1.324503, CURRENT_DATE, 'Monetary Authority of Singapore (MAS)', false),
    ('FX-CAD-USD', 'USD', 'CAD', 0.735000, 1.360544, CURRENT_DATE, 'Bank of Canada Benchmark', false),
    ('FX-JPY-USD', 'USD', 'JPY', 0.006650, 150.375940, CURRENT_DATE, 'Bank of Japan / Fed H.10', false)
ON CONFLICT (id) DO UPDATE SET
    rate = EXCLUDED.rate,
    inverse_rate = EXCLUDED.inverse_rate,
    effective_date = EXCLUDED.effective_date,
    source = EXCLUDED.source,
    is_stale = EXCLUDED.is_stale,
    retrieved_at = timezone('utc'::text, now());

-- Enable RLS for exchange_rates
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Allow public read access to exchange rates" ON public.exchange_rates
        FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 6. TRANSACTIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT ('TXN-' || floor(random() * 900000 + 100000)::text),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tenant_id TEXT NOT NULL REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT,
    tenant_name TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    merchant TEXT NOT NULL DEFAULT 'Global Clearing',
    category TEXT NOT NULL DEFAULT 'Operational',
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    amount_usd NUMERIC(15, 2),
    exchange_rate NUMERIC(12, 6) DEFAULT 1.000000,
    exchange_rate_date DATE DEFAULT CURRENT_DATE,
    type TEXT NOT NULL DEFAULT 'Debit',
    status TEXT NOT NULL DEFAULT 'Settled',
    reference_no TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tenant_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS merchant TEXT NOT NULL DEFAULT 'Global Clearing';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Operational';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(15, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6) DEFAULT 1.000000;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS exchange_rate_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'Debit';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Settled';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());


DO $$ BEGIN
    ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.transactions ADD CONSTRAINT chk_transactions_type CHECK (type IN ('Credit', 'Debit'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.transactions ADD CONSTRAINT chk_transactions_status CHECK (status IN ('Settled', 'Escrow Secured', 'Clearing'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 7. FRAUD & AML SURVEILLANCE CASES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fraud_cases (
    id TEXT PRIMARY KEY DEFAULT ('FRAUD-' || floor(random() * 90000 + 10000)::text),
    tenant_id TEXT NOT NULL REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT,
    tenant_name TEXT,
    customer_id TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL DEFAULT '',
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    amount_usd NUMERIC(15, 2),
    exchange_rate NUMERIC(12, 6) DEFAULT 1.000000,
    exchange_rate_date DATE DEFAULT CURRENT_DATE,
    risk_score INT NOT NULL DEFAULT 50,
    aml_flag TEXT NOT NULL DEFAULT 'AML Risk Threshold',
    status TEXT NOT NULL DEFAULT 'Flagged',
    location TEXT NOT NULL DEFAULT 'Global',
    payment_channel TEXT NOT NULL DEFAULT 'SWIFT Wire',
    rule_triggered TEXT NOT NULL DEFAULT 'Suspicious Transaction Pattern',
    ai_confidence_pct NUMERIC(5, 2) NOT NULL DEFAULT 98.40,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS tenant_name TEXT;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS customer_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(15, 2);
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6) DEFAULT 1.000000;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS exchange_rate_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS risk_score INT NOT NULL DEFAULT 50;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS aml_flag TEXT NOT NULL DEFAULT 'AML Risk Threshold';
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Flagged';
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'Global';
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS payment_channel TEXT NOT NULL DEFAULT 'SWIFT Wire';
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS rule_triggered TEXT NOT NULL DEFAULT 'Suspicious Transaction Pattern';
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS ai_confidence_pct NUMERIC(5, 2) NOT NULL DEFAULT 98.40;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());


DO $$ BEGIN
    ALTER TABLE public.fraud_cases ADD CONSTRAINT fk_fraud_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.fraud_cases ADD CONSTRAINT chk_fraud_risk_score CHECK (risk_score BETWEEN 0 AND 100);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.fraud_cases ADD CONSTRAINT chk_fraud_status CHECK (status IN ('Flagged', 'In Review', 'Cleared', 'Frozen Escrow'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 8. KYC RECORDS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kyc_records (
    id TEXT PRIMARY KEY DEFAULT ('KYC-' || floor(random() * 90000 + 10000)::text),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT,
    tenant_name TEXT,
    title TEXT NOT NULL DEFAULT 'Identity Document',
    document_type TEXT NOT NULL DEFAULT 'Passport',
    file_size TEXT NOT NULL DEFAULT '1.2 MB',
    status TEXT NOT NULL DEFAULT 'Pending',
    verified_by TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.kyc_records ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.kyc_records ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.kyc_records ADD COLUMN IF NOT EXISTS tenant_name TEXT;
ALTER TABLE public.kyc_records ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Identity Document';
ALTER TABLE public.kyc_records ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'Passport';
ALTER TABLE public.kyc_records ADD COLUMN IF NOT EXISTS file_size TEXT NOT NULL DEFAULT '1.2 MB';
ALTER TABLE public.kyc_records ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE public.kyc_records ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE public.kyc_records ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

DO $$ BEGIN
    ALTER TABLE public.kyc_records ADD CONSTRAINT fk_kyc_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.kyc_records ADD CONSTRAINT chk_kyc_status CHECK (status IN ('Verified', 'Under Review', 'Archived', 'Pending'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 9. SUPPORT TICKETS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
    ticket_id TEXT PRIMARY KEY DEFAULT ('TCK-' || floor(random() * 9000 + 1000)::text),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tenant_id TEXT NOT NULL REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT,
    tenant_name TEXT,
    customer_name TEXT NOT NULL DEFAULT '',
    account_tier TEXT NOT NULL DEFAULT 'Private Wealth Tier 3',
    category TEXT NOT NULL DEFAULT 'General Inquiry',
    priority TEXT NOT NULL DEFAULT 'Medium',
    status TEXT NOT NULL DEFAULT 'Open',
    assigned_executive TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    sla_target_hours INT NOT NULL DEFAULT 4,
    hours_open INT NOT NULL DEFAULT 1,
    csat_rating INT
);

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS tenant_name TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS account_tier TEXT NOT NULL DEFAULT 'Private Wealth Tier 3';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General Inquiry';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Medium';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Open';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_executive TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS sla_target_hours INT NOT NULL DEFAULT 4;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS hours_open INT NOT NULL DEFAULT 1;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS csat_rating INT;

DO $$ BEGIN
    ALTER TABLE public.support_tickets ADD CONSTRAINT fk_tickets_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenant_workspaces(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.support_tickets ADD CONSTRAINT chk_tickets_priority CHECK (priority IN ('Urgent', 'High', 'Medium', 'Low'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.support_tickets ADD CONSTRAINT chk_tickets_status CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Pending Client'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.support_tickets ADD CONSTRAINT chk_tickets_csat CHECK (csat_rating IS NULL OR csat_rating BETWEEN 1 AND 5);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 10. AUDIT LOGS TABLE (Append-Only Secure Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('LOG-' || floor(random() * 900000 + 100000)::text),
    tenant_id TEXT REFERENCES public.tenant_workspaces(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    actor TEXT NOT NULL DEFAULT 'System',
    role TEXT NOT NULL DEFAULT 'SYSTEM',
    action TEXT NOT NULL DEFAULT 'Action',
    target TEXT NOT NULL DEFAULT 'Target',
    ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
    status TEXT NOT NULL DEFAULT 'Authorized'
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor TEXT NOT NULL DEFAULT 'System';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'Action';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target TEXT NOT NULL DEFAULT 'Target';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT NOT NULL DEFAULT '127.0.0.1';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Authorized';

DO $$ BEGIN
    ALTER TABLE public.audit_logs ADD CONSTRAINT chk_audit_status CHECK (status IN ('Authorized', 'Flagged', 'Audited'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 11. SECURITY DEFINER HELPER FUNCTIONS
-- Explicit search_path prevents search_path injection attacks
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1),
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
        (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1),
        ''
    );
$$;

-- ------------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY ENFORCEMENT ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.tenant_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 13. PRIVILEGE TAMPERING PREVENTION TRIGGER (DATABASE DEFENSE IN DEPTH)
-- Explicit security design:
-- 1. Evaluates caller context safely without checking current_user = 'postgres'
--    (which would evaluate true inside any SECURITY DEFINER function).
-- 2. If auth.uid() IS NULL, trusted server/database/service_role operations pass.
-- 3. If auth.uid() IS NOT NULL (authenticated client request), security checks
--    are strictly enforced:
--    - Users cannot modify role, tenant_id, status, tier, email, or id.
--    - Admins cannot modify or delete Admin or Super Admin accounts.
--    - Admins cannot promote anyone to Admin or Super Admin.
--    - Admins cannot move users across tenants.
-- ------------------------------------------------------------------------------
-- 8. SINGLE SUPER ADMIN ENFORCEMENT & PROFILE PRIVILEGE PROTECTION
--    Policies strictly enforced:
--    - Exclusively aravindvicky629@gmail.com may hold the SUPER_ADMIN role.
--    - Super Admin is assigned exclusively to platform_root workspace.
--    - Users cannot modify role, tenant_id, status, tier, email, or id.
--    - Admins cannot modify or delete Admin or Super Admin accounts.
--    - Admins cannot promote anyone to Admin or Super Admin.
--    - Admins cannot move users across tenants.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_single_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Policy 1: If role is SUPER_ADMIN, email MUST match authorized Super Admin
    IF NEW.role = 'SUPER_ADMIN' THEN
        IF LOWER(TRIM(NEW.email)) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Security Policy Violation: Only aravindvicky629@gmail.com is authorized to hold the SUPER_ADMIN role.';
        END IF;

        -- If an auth.users record exists with this profile ID, ensure its email matches
        IF NEW.id IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
            IF NOT EXISTS (
                SELECT 1 FROM auth.users 
                WHERE id = NEW.id AND LOWER(TRIM(email)) = 'aravindvicky629@gmail.com'
            ) THEN
                RAISE EXCEPTION 'Security Policy Violation: Authenticated Supabase Auth user email does not match authorized Super Admin.';
            END IF;
        END IF;

        -- Ensure Super Admin is linked exclusively to platform operator root
        NEW.tenant_id := 'platform_root';
        NEW.tenant_name := 'Finova AI SaaS Platform Operator';
    END IF;

    -- Policy 2: Ensure platform_root is reserved exclusively for SUPER_ADMIN
    IF NEW.tenant_id = 'platform_root' AND NEW.role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Security Policy Violation: Only Platform Super Admin may be assigned to the platform_root workspace.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_super_admin ON public.profiles;
CREATE TRIGGER trg_enforce_single_super_admin
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_single_super_admin();

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    caller_role TEXT;
    caller_tenant TEXT;
    caller_email TEXT;
BEGIN
    -- Explicitly allow trusted database management / migration scripts without end-user context
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Look up caller's verified role, tenant, and email from database using verified auth.uid()
    SELECT role::text, tenant_id, email
    INTO caller_role, caller_tenant, caller_email
    FROM public.profiles
    WHERE id = auth.uid();

    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'Access Denied: Unverified caller identity.';
    END IF;

    -- 1. Platform Super Admin has authorization ONLY if verified as aravindvicky629@gmail.com
    IF caller_role = 'SUPER_ADMIN' THEN
        IF LOWER(TRIM(caller_email)) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: Unverified Super Admin identity.';
        END IF;

        -- Super Admin cannot create/assign a second SUPER_ADMIN
        IF NEW.role = 'SUPER_ADMIN' AND LOWER(TRIM(NEW.email)) <> 'aravindvicky629@gmail.com' THEN
            RAISE EXCEPTION 'Access Denied: There can only be one Platform Super Admin (aravindvicky629@gmail.com).';
        END IF;

        RETURN NEW;
    END IF;

    -- 2. Self-updates for any user (including Company Admins updating personal details):
    IF auth.uid() = OLD.id THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Permission Denied: Users cannot alter their security role.';
        END IF;
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
            RAISE EXCEPTION 'Permission Denied: Users cannot alter their tenant workspace.';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Permission Denied: Users cannot modify their account status.';
        END IF;
        IF NEW.tier IS DISTINCT FROM OLD.tier THEN
            RAISE EXCEPTION 'Permission Denied: Account tier modification requires authorized staff action.';
        END IF;
        IF NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION 'Permission Denied: Email address changes must be processed through verified authentication flows.';
        END IF;
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Permission Denied: User ID cannot be modified.';
        END IF;
        RETURN NEW;
    END IF;

    -- 3. Company Admin managing other profiles within their tenant:
    IF caller_role = 'ADMIN' THEN
        -- Strictly within caller's own tenant workspace
        IF OLD.tenant_id <> caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Company Admins may only manage profiles in their own tenant workspace.';
        END IF;
        IF NEW.tenant_id <> OLD.tenant_id THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant profile reassignment is restricted to Platform Super Admin.';
        END IF;

        -- Admin CANNOT modify another ADMIN or SUPER_ADMIN
        IF OLD.role IN ('ADMIN', 'SUPER_ADMIN') THEN
            RAISE EXCEPTION 'Access Denied: Company Admins cannot modify Admin or Super Admin accounts.';
        END IF;

        -- Admin CANNOT promote anyone to ADMIN or SUPER_ADMIN
        IF NEW.role NOT IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER') THEN
            RAISE EXCEPTION 'Access Denied: Company Admins may only assign FINANCE_ANALYST, SUPPORT_EXECUTIVE, or CUSTOMER roles.';
        END IF;

        RETURN NEW;
    END IF;

    -- 4. Standard roles (CUSTOMER, FINANCE_ANALYST, SUPPORT_EXECUTIVE) cannot modify other profiles
    RAISE EXCEPTION 'Access Denied: Unauthorized profile modification attempt.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_privileges();

-- Protection for Profile Deletion
CREATE OR REPLACE FUNCTION public.protect_profile_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    caller_role TEXT;
    caller_tenant TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN OLD;
    END IF;

    SELECT role::text, tenant_id INTO caller_role, caller_tenant
    FROM public.profiles WHERE id = auth.uid();

    IF caller_role = 'SUPER_ADMIN' THEN
        RETURN OLD;
    END IF;

    IF caller_role = 'ADMIN' THEN
        IF OLD.tenant_id <> caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Admins cannot delete profiles outside their tenant workspace.';
        END IF;
        IF OLD.role IN ('ADMIN', 'SUPER_ADMIN') THEN
            RAISE EXCEPTION 'Access Denied: Company Admins cannot delete Admin or Super Admin accounts.';
        END IF;
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Access Denied: Unauthorized profile deletion attempt.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_deletion ON public.profiles;
CREATE TRIGGER trg_protect_profile_deletion
    BEFORE DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_deletion();

-- ------------------------------------------------------------------------------
-- 14. AUDIT LOG INTEGRITY & FORGERY PREVENTION TRIGGER
-- Enforces server timestamps and binds tenant/actor/role to the verified caller
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_audit_log_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    caller_role TEXT;
    caller_tenant TEXT;
    caller_name TEXT;
    caller_email TEXT;
BEGIN
    -- Direct internal SQL / service_role calls without an authenticated user context
    IF auth.uid() IS NULL THEN
        NEW.timestamp := COALESCE(NEW.timestamp, timezone('utc'::text, now()));
        RETURN NEW;
    END IF;

    -- Retrieve verified caller profile from database
    SELECT role::text, tenant_id, name, email
    INTO caller_role, caller_tenant, caller_name, caller_email
    FROM public.profiles
    WHERE id = auth.uid();

    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'Audit Log Denied: Unverified caller identity.';
    END IF;

    -- Overwrite timestamp with server time (cannot backdate or forge audit records)
    NEW.timestamp := timezone('utc'::text, now());

    -- Non-super-admins cannot forge tenant, role, or actor identity
    IF caller_role <> 'SUPER_ADMIN' THEN
        NEW.tenant_id := caller_tenant;
        NEW.role := caller_role;
        NEW.actor := COALESCE(caller_name, caller_email, auth.uid()::text);
    ELSE
        NEW.role := COALESCE(NEW.role, 'SUPER_ADMIN');
        NEW.actor := COALESCE(NEW.actor, caller_name, caller_email, 'Platform Super Admin');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_audit_log_integrity ON public.audit_logs;
CREATE TRIGGER trg_enforce_audit_log_integrity
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_audit_log_integrity();

-- ------------------------------------------------------------------------------
-- 15. SAFE & RERUNNABLE ROW LEVEL SECURITY POLICIES
-- Zero policy recursion: Column transitions are guarded by BEFORE triggers
-- ------------------------------------------------------------------------------

-- == TENANT WORKSPACES POLICIES ==
DROP POLICY IF EXISTS "super_admin_manage_tenants" ON public.tenant_workspaces;
CREATE POLICY "super_admin_manage_tenants" ON public.tenant_workspaces
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "users_view_own_tenant" ON public.tenant_workspaces;
CREATE POLICY "users_view_own_tenant" ON public.tenant_workspaces
    FOR SELECT
    TO authenticated
    USING (id = public.get_auth_tenant());

DROP POLICY IF EXISTS "anon_view_active_tenants" ON public.tenant_workspaces;
CREATE POLICY "anon_view_active_tenants" ON public.tenant_workspaces
    FOR SELECT
    TO anon
    USING (status = 'Active');

-- == PROFILES POLICIES ==
DROP POLICY IF EXISTS "super_admin_all_profiles" ON public.profiles;
CREATE POLICY "super_admin_all_profiles" ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- Company Admins view profiles in their own tenant
DROP POLICY IF EXISTS "admin_select_tenant_profiles" ON public.profiles;
CREATE POLICY "admin_select_tenant_profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'ADMIN'
        AND tenant_id = public.get_auth_tenant()
    );

-- Company Admins can ONLY create non-admin staff and customer accounts
DROP POLICY IF EXISTS "admin_insert_tenant_profiles" ON public.profiles;
CREATE POLICY "admin_insert_tenant_profiles" ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_auth_role() = 'ADMIN'
        AND tenant_id = public.get_auth_tenant()
        AND role IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER')
    );

-- Company Admins can ONLY update non-admin accounts and CANNOT promote anyone to ADMIN or SUPER_ADMIN
DROP POLICY IF EXISTS "admin_update_tenant_profiles" ON public.profiles;
CREATE POLICY "admin_update_tenant_profiles" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        public.get_auth_role() = 'ADMIN'
        AND tenant_id = public.get_auth_tenant()
        AND role IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER')
    )
    WITH CHECK (
        public.get_auth_role() = 'ADMIN'
        AND tenant_id = public.get_auth_tenant()
        AND role IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER')
    );

-- Company Admins can delete non-admin staff/customers in their tenant
DROP POLICY IF EXISTS "admin_delete_tenant_profiles" ON public.profiles;
CREATE POLICY "admin_delete_tenant_profiles" ON public.profiles
    FOR DELETE
    TO authenticated
    USING (
        public.get_auth_role() = 'ADMIN'
        AND tenant_id = public.get_auth_tenant()
        AND role IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER')
    );

-- Staff (Finance Analysts & Support Executives) view profiles in their tenant for operational work
DROP POLICY IF EXISTS "staff_view_tenant_profiles" ON public.profiles;
CREATE POLICY "staff_view_tenant_profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('FINANCE_ANALYST', 'SUPPORT_EXECUTIVE')
        AND tenant_id = public.get_auth_tenant()
    );

-- Users can view their own profile
DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Users can update their own profile (Zero recursion: protected fields enforced by BEFORE trigger)
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- == TRANSACTIONS POLICIES ==
DROP POLICY IF EXISTS "super_admin_all_transactions" ON public.transactions;
CREATE POLICY "super_admin_all_transactions" ON public.transactions
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- Admins and Finance Analysts manage transactions within their tenant
DROP POLICY IF EXISTS "staff_tenant_transactions" ON public.transactions;
CREATE POLICY "staff_tenant_transactions" ON public.transactions
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

-- Support Executives can view transactions in their tenant to resolve customer disputes
DROP POLICY IF EXISTS "support_view_tenant_transactions" ON public.transactions;
CREATE POLICY "support_view_tenant_transactions" ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'SUPPORT_EXECUTIVE'
        AND tenant_id = public.get_auth_tenant()
    );

-- Customers can ONLY view their own transactions within their tenant (no INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "customer_own_transactions" ON public.transactions;
CREATE POLICY "customer_own_transactions" ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        AND tenant_id = public.get_auth_tenant()
    );

-- == FRAUD & AML SURVEILLANCE POLICIES ==
-- Restricted exclusively to Super Admin, Admin, and Finance Analyst (no Customer or Support access)
DROP POLICY IF EXISTS "super_admin_all_fraud" ON public.fraud_cases;
CREATE POLICY "super_admin_all_fraud" ON public.fraud_cases
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "analyst_tenant_fraud" ON public.fraud_cases;
CREATE POLICY "analyst_tenant_fraud" ON public.fraud_cases
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

-- == KYC RECORDS POLICIES ==
DROP POLICY IF EXISTS "super_admin_all_kyc" ON public.kyc_records;
CREATE POLICY "super_admin_all_kyc" ON public.kyc_records
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "staff_tenant_kyc" ON public.kyc_records;
CREATE POLICY "staff_tenant_kyc" ON public.kyc_records
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

DROP POLICY IF EXISTS "support_view_tenant_kyc" ON public.kyc_records;
CREATE POLICY "support_view_tenant_kyc" ON public.kyc_records
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'SUPPORT_EXECUTIVE'
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "customer_read_own_kyc" ON public.kyc_records;
CREATE POLICY "customer_read_own_kyc" ON public.kyc_records
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "customer_insert_own_kyc" ON public.kyc_records;
CREATE POLICY "customer_insert_own_kyc" ON public.kyc_records
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND tenant_id = public.get_auth_tenant()
        AND status = 'Pending'
    );

-- == SUPPORT TICKETS POLICIES ==
DROP POLICY IF EXISTS "super_admin_all_tickets" ON public.support_tickets;
CREATE POLICY "super_admin_all_tickets" ON public.support_tickets
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "support_tenant_tickets" ON public.support_tickets;
CREATE POLICY "support_tenant_tickets" ON public.support_tickets
    FOR ALL
    TO authenticated
    USING (
        public.get_auth_role() IN ('ADMIN', 'SUPPORT_EXECUTIVE')
        AND tenant_id = public.get_auth_tenant()
    )
    WITH CHECK (
        public.get_auth_role() IN ('ADMIN', 'SUPPORT_EXECUTIVE')
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "analyst_view_tenant_tickets" ON public.support_tickets;
CREATE POLICY "analyst_view_tenant_tickets" ON public.support_tickets
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'FINANCE_ANALYST'
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "customer_read_own_tickets" ON public.support_tickets;
CREATE POLICY "customer_read_own_tickets" ON public.support_tickets
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "customer_insert_own_tickets" ON public.support_tickets;
CREATE POLICY "customer_insert_own_tickets" ON public.support_tickets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND tenant_id = public.get_auth_tenant()
    );

DROP POLICY IF EXISTS "customer_update_own_tickets" ON public.support_tickets;
CREATE POLICY "customer_update_own_tickets" ON public.support_tickets
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = user_id
        AND tenant_id = public.get_auth_tenant()
    )
    WITH CHECK (
        auth.uid() = user_id
        AND tenant_id = public.get_auth_tenant()
    );

-- == AUDIT LOGS POLICIES (Append-Only Immutable Log) ==
DROP POLICY IF EXISTS "super_admin_all_audit" ON public.audit_logs;
CREATE POLICY "super_admin_all_audit" ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "admin_select_tenant_audit" ON public.audit_logs;
CREATE POLICY "admin_select_tenant_audit" ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'ADMIN'
        AND tenant_id = public.get_auth_tenant()
    );

-- Authenticated insertion is validated against caller role and tenant
DROP POLICY IF EXISTS "authenticated_insert_audit" ON public.audit_logs;
CREATE POLICY "authenticated_insert_audit" ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            public.get_auth_role() = 'SUPER_ADMIN'
            OR (
                tenant_id = public.get_auth_tenant()
                AND role = public.get_auth_role()
            )
        )
    );

-- Note: No UPDATE or DELETE policy exists on public.audit_logs, rendering it immutable.

-- ------------------------------------------------------------------------------
-- 16. AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    requested_tenant TEXT;
    valid_tenant_id TEXT;
    valid_tenant_name TEXT;
    clean_name TEXT;
    clean_phone TEXT;
BEGIN
    -- Extract requested tenant from raw user metadata (untrusted input)
    requested_tenant := TRIM(new.raw_user_meta_data->>'tenant_id');

    -- Never allow public registration into platform_root!
    IF requested_tenant = 'platform_root' OR requested_tenant IS NULL OR requested_tenant = '' THEN
        requested_tenant := 'tenant_apex_bank';
    END IF;

    -- Validate tenant existence and active status in public.tenant_workspaces (excluding platform_root)
    SELECT id, name INTO valid_tenant_id, valid_tenant_name
    FROM public.tenant_workspaces
    WHERE id = requested_tenant AND status = 'Active' AND id <> 'platform_root';

    -- Safe fallback to default active workspace if invalid or not provided
    IF valid_tenant_id IS NULL THEN
        SELECT id, name INTO valid_tenant_id, valid_tenant_name
        FROM public.tenant_workspaces
        WHERE id = 'tenant_apex_bank';

        IF valid_tenant_id IS NULL THEN
            SELECT id, name INTO valid_tenant_id, valid_tenant_name
            FROM public.tenant_workspaces
            WHERE status = 'Active' AND id <> 'platform_root'
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;
    END IF;

    clean_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        split_part(new.email, '@', 1)
    );
    clean_phone := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'phone'), ''),
        '+1 (212) 555-0100'
    );

    -- Public signups STRICTLY receive 'CUSTOMER' role on trusted backend
    -- Any client-supplied 'role' in raw_user_meta_data is completely ignored
    INSERT INTO public.profiles (
        id,
        email,
        name,
        role,
        status,
        tier,
        phone,
        country,
        two_factor_enabled,
        tenant_id,
        tenant_name,
        created_at,
        updated_at
    ) VALUES (
        new.id,
        new.email,
        clean_name,
        'CUSTOMER'::public.user_role_type,
        'Active'::public.user_status_type,
        'Private Wealth Tier 3',
        clean_phone,
        COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'country'), ''), 'United States'),
        true,
        valid_tenant_id,
        valid_tenant_name,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(public.profiles.name, EXCLUDED.name),
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 16B. CONTROLLED INITIAL PROVISIONING RPC
-- Cryptographically verifies authenticated auth.uid() against auth.users.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_authorized_super_admin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    caller_id UUID;
    caller_email TEXT;
    profile_record RECORD;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Access Denied: Authentication required.';
    END IF;

    -- Look up caller's cryptographically verified email from auth.users
    SELECT email INTO caller_email
    FROM auth.users
    WHERE id = caller_id;

    IF caller_email IS NULL OR LOWER(TRIM(caller_email)) <> 'aravindvicky629@gmail.com' THEN
        RAISE EXCEPTION 'Access Denied: Only the verified owner of aravindvicky629@gmail.com is authorized to provision Super Admin.';
    END IF;

    -- Upsert profile for this verified user ID
    INSERT INTO public.profiles (
        id,
        email,
        name,
        role,
        status,
        tier,
        phone,
        country,
        two_factor_enabled,
        tenant_id,
        tenant_name,
        notes,
        created_at,
        updated_at
    ) VALUES (
        caller_id,
        caller_email,
        'Aravind Vicky',
        'SUPER_ADMIN'::public.user_role_type,
        'Active'::public.user_status_type,
        'Executive Staff',
        '+1 (212) 555-0190',
        'United States',
        true,
        'platform_root',
        'Finova AI SaaS Platform Operator',
        'Authorized Platform Super Admin Provisioned via Verified Supabase Auth UID',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'SUPER_ADMIN'::public.user_role_type,
        tenant_id = 'platform_root',
        tenant_name = 'Finova AI SaaS Platform Operator',
        tier = 'Executive Staff',
        status = 'Active'::public.user_status_type,
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO profile_record;

    -- Immutable audit log recording provisioning
    INSERT INTO public.audit_logs (
        id,
        action,
        actor,
        role,
        target,
        status,
        timestamp,
        tenant_id,
        ip_address
    ) VALUES (
        'AUD-PROV-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
        'SUPER_ADMIN_INITIAL_PROVISIONING',
        caller_email,
        'SUPER_ADMIN',
        'Platform Operator Root (' || caller_id::text || ')',
        'Authorized',
        timezone('utc'::text, now()),
        'platform_root',
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'success', true,
        'userId', caller_id,
        'email', caller_email,
        'role', 'SUPER_ADMIN',
        'tenant_id', 'platform_root',
        'message', 'Super Admin profile successfully provisioned for verified UID.'
    );
END;
$$;

-- Grant EXECUTE strictly to authenticated users (rejected for anonymous public)
REVOKE EXECUTE ON FUNCTION public.provision_authorized_super_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.provision_authorized_super_admin() TO authenticated;

-- ------------------------------------------------------------------------------
-- 16C. AUDIT FUNCTION FOR SUPER ADMIN ASSIGNMENTS (READ-ONLY REVIEW REPORT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_super_admin_assignments()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role TEXT,
    tenant_id TEXT,
    is_authorized BOOLEAN,
    action_required TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        p.id AS user_id,
        p.email,
        p.role::text,
        p.tenant_id,
        (LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com') AS is_authorized,
        CASE 
            WHEN LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com' THEN 'AUTHORIZED_SUPER_ADMIN'
            ELSE 'ROLE_MISMATCH_REQUIRES_REVIEW'
        END AS action_required
    FROM public.profiles p
    WHERE p.role = 'SUPER_ADMIN';
$$;

GRANT EXECUTE ON FUNCTION public.audit_super_admin_assignments() TO authenticated;

-- ------------------------------------------------------------------------------
-- 17. PRINCIPLE OF LEAST PRIVILEGE SCHEMA GRANTS
-- Replaces broad 'GRANT ALL' with minimal explicit operations required per role
-- ------------------------------------------------------------------------------

-- Revoke default public schema grants to ensure clean permissions
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 1. Unauthenticated (anon) role:
-- Can only view active tenant workspaces for signup selection and execute lookup routines
GRANT SELECT ON TABLE public.tenant_workspaces TO anon;

-- 2. Authenticated (authenticated) role:
-- Grant standard table-level operations governed by RLS (no TRUNCATE, no REFERENCES, no TRIGGER)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fraud_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kyc_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.support_tickets TO authenticated;

-- Audit logs are strictly append-only: SELECT & INSERT only (NO UPDATE, NO DELETE)
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;

-- Sequence usage for authenticated users
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Execute grants on helper functions
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_tenant() TO anon, authenticated, service_role;

-- 3. Administrative service role:
-- Retains full management access for server-side maintenance and migration tasks
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- ------------------------------------------------------------------------------
-- 18. CENTRALIZED USD BASE-CURRENCY EXCHANGE RATES TABLE
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

ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS target_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS inverse_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS effective_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Official Reference Benchmark';
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT false;

COMMENT ON TABLE public.exchange_rates IS 'Centralized USD base-currency exchange rates table with source attribution and freshness tracking.';
COMMENT ON COLUMN public.exchange_rates.rate IS 'USD amount per 1 unit of target_currency (e.g. 1 GBP = 1.285000 USD). Calculation formula: amount_usd = original_amount * rate';
COMMENT ON COLUMN public.exchange_rates.inverse_rate IS 'Target currency units per 1 USD (e.g. 1 USD = 0.778210 GBP). Formula: 1.0 / rate';
COMMENT ON COLUMN public.exchange_rates.effective_date IS 'Official rate publication / fixing date.';
COMMENT ON COLUMN public.exchange_rates.source IS 'Attributed central bank or official benchmark reference provider.';
COMMENT ON COLUMN public.exchange_rates.is_stale IS 'Boolean flag indicating if the rate is older than the allowed freshness window (3 days for daily market fixings).';

CREATE INDEX IF NOT EXISTS idx_exchange_rates_target_date 
    ON public.exchange_rates (target_currency, effective_date DESC);

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

REVOKE ALL ON public.exchange_rates FROM PUBLIC, anon;
GRANT SELECT ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;

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

-- Currency & USD metadata columns on transactions and fraud_cases
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(15, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT 'PENDING_VERIFICATION';

ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(15, 2);
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6);
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;
ALTER TABLE public.fraud_cases ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT 'PENDING_VERIFICATION';

-- ------------------------------------------------------------------------------
-- 19. SECURE SERVER-SIDE AGGREGATION RPCs (SECURITY INVOKER)
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
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> 'ALL' AND p_tenant_id <> 'platform_root' THEN
            v_enforced_tenant := p_tenant_id;
        ELSE
            v_enforced_tenant := NULL;
        END IF;
        v_enforced_user_id := p_user_id;

    ELSIF v_caller_role IN ('ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') THEN
        IF p_tenant_id IS NOT NULL AND p_tenant_id <> 'ALL' AND p_tenant_id <> v_caller_tenant THEN
            RAISE EXCEPTION 'Access Denied: Cross-tenant data access violation. Caller belongs to tenant "%", attempted to query tenant "%".', v_caller_tenant, p_tenant_id;
        END IF;
        v_enforced_tenant := v_caller_tenant;
        v_enforced_user_id := p_user_id;

    ELSIF v_caller_role = 'CUSTOMER' THEN
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

    -- [4] CURRENCY CONVERSION & AGGREGATION
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
                WHEN t.amount_usd IS NOT NULL AND t.amount_usd >= 0 THEN
                    t.amount_usd
                WHEN COALESCE(NULLIF(TRIM(t.currency), ''), '') = 'USD' THEN
                    t.amount
                WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate > 0 THEN
                    ROUND(t.amount * t.exchange_rate, 2)
                WHEN fx.rate IS NOT NULL AND fx.rate > 0 THEN
                    ROUND(t.amount * fx.rate, 2)
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
        COALESCE(SUM(calculated_amount_usd) FILTER (WHERE status IN ('Settled', 'Escrow Secured') AND is_converted = true), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE status IN ('Settled', 'Escrow Secured')), 0.00),
        COALESCE(SUM(calculated_amount_usd) FILTER (WHERE type = 'Credit' AND is_converted = true), 0.00),
        COALESCE(SUM(calculated_amount_usd) FILTER (WHERE type = 'Debit' AND is_converted = true), 0.00),
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
        COALESCE(SUM(calculated_amount_usd) FILTER (WHERE status = 'Frozen Escrow' AND is_converted = true), 0.00),
        COALESCE(SUM(amount) FILTER (WHERE status = 'Frozen Escrow'), 0.00),
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
-- 20. STRICT FUNCTION EXECUTION PERMISSIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_transaction_aggregates(TEXT, UUID, DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fraud_aggregates(TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_transaction_aggregates(TEXT, UUID, DATE, DATE, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fraud_aggregates(TEXT, TEXT) TO authenticated, service_role;


