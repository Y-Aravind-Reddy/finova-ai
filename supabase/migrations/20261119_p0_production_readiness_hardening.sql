-- ==============================================================================
-- FINOVA AI — STAGE 3: P0 PRODUCTION READINESS HARDENING MIGRATION
-- Forward-only, idempotent SQL migration (zero destructive drops / zero RLS disable)
-- Target:
--   1. Standardize SQLSTATE 42501 on Stage 2 aggregate RPC authorization denials
--   2. Harden Knowledge Base (ai_knowledge_documents / ai_document_chunks) for
--      controlled ingestion, checksum deduplication, error/retry tracking, and
--      role-scoped management (SUPER_ADMIN global OR ADMIN single-tenant only)
--   3. Harden ai_chat_threads / ai_chat_messages grants and check_ai_rate_limit_v218
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. KNOWLEDGE BASE SCHEMA EXTENSIONS FOR CONTROLLED INGESTION & DEDUPLICATION
-- ------------------------------------------------------------------------------
ALTER TABLE public.ai_knowledge_documents
    ADD COLUMN IF NOT EXISTS content_hash TEXT,
    ADD COLUMN IF NOT EXISTS file_type TEXT NOT NULL DEFAULT 'text/plain',
    ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS chunk_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Expand allowed lifecycle statuses idempotently to include 'FAILED'
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT c.conname
    INTO v_constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'ai_knowledge_documents'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.ai_knowledge_documents DROP CONSTRAINT %I', v_constraint_name);
    END IF;

    ALTER TABLE public.ai_knowledge_documents
        ADD CONSTRAINT ai_knowledge_documents_status_check
        CHECK (status IN ('ACTIVE', 'ARCHIVED', 'PROCESSING', 'FAILED'));
END $$;

-- Expand allowed source_type idempotently to include 'MANUAL' and 'CSV_EXPORT'
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT c.conname
    INTO v_constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'ai_knowledge_documents'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%source_type%';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.ai_knowledge_documents DROP CONSTRAINT %I', v_constraint_name);
    END IF;

    ALTER TABLE public.ai_knowledge_documents
        ADD CONSTRAINT ai_knowledge_documents_source_type_check
        CHECK (source_type IN ('POLICY', 'PROCEDURE', 'REGULATION', 'GUIDE', 'DB_EXPORT', 'MANUAL', 'CSV_EXPORT'));
END $$;

-- Atomic per-tenant duplicate content protection for non-archived KB documents
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_kb_docs_tenant_hash_active
    ON public.ai_knowledge_documents(tenant_id, content_hash)
    WHERE content_hash IS NOT NULL AND status <> 'ARCHIVED';

CREATE INDEX IF NOT EXISTS idx_ai_kb_docs_tenant_status
    ON public.ai_knowledge_documents(tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chunks_document_id
    ON public.ai_document_chunks(document_id);

-- Enforce non-empty chunks & valid chunk_index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.relname = 'ai_document_chunks'
          AND c.conname = 'ai_document_chunks_nonempty_content_check'
    ) THEN
        ALTER TABLE public.ai_document_chunks
            ADD CONSTRAINT ai_document_chunks_nonempty_content_check
            CHECK (length(trim(content)) > 0);
    END IF;
END $$;

-- Harden chunk-document tenant consistency trigger with search_path
CREATE OR REPLACE FUNCTION public.check_ai_chunk_tenant_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.ai_knowledge_documents
        WHERE id = NEW.document_id AND tenant_id = NEW.tenant_id
    ) THEN
        RAISE EXCEPTION 'Tenant Mismatch: Document and Chunk must belong to the same tenant.'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. LEAST-PRIVILEGE RLS & GRANTS FOR KNOWLEDGE BASE TABLES
--    - SELECT: authenticated within caller's active tenant OR verified SUPER_ADMIN
--    - INSERT/UPDATE/DELETE: verified SUPER_ADMIN (any tenant) OR active ADMIN (own tenant)
--    - Anon: zero privileges
-- ------------------------------------------------------------------------------
ALTER TABLE public.ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_document_chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_knowledge_documents FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_document_chunks FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_knowledge_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_document_chunks TO authenticated;
GRANT ALL ON TABLE public.ai_knowledge_documents TO service_role;
GRANT ALL ON TABLE public.ai_document_chunks TO service_role;

DROP POLICY IF EXISTS "kb_select_policy" ON public.ai_knowledge_documents;
DROP POLICY IF EXISTS "kb_admin_policy" ON public.ai_knowledge_documents;
DROP POLICY IF EXISTS "kb_super_admin_or_tenant_select" ON public.ai_knowledge_documents;
DROP POLICY IF EXISTS "kb_super_admin_or_tenant_admin_write" ON public.ai_knowledge_documents;

CREATE POLICY "kb_super_admin_or_tenant_select" ON public.ai_knowledge_documents
    FOR SELECT
    TO authenticated
    USING (
        (
            public.get_auth_role() = 'SUPER_ADMIN'
            AND EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role::text = 'SUPER_ADMIN'
                  AND p.status::text = 'Active'
                  AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
            )
        )
        OR tenant_id = public.get_auth_tenant()
    );

CREATE POLICY "kb_super_admin_or_tenant_admin_write" ON public.ai_knowledge_documents
    FOR ALL
    TO authenticated
    USING (
        (
            public.get_auth_role() = 'SUPER_ADMIN'
            AND EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role::text = 'SUPER_ADMIN'
                  AND p.status::text = 'Active'
                  AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
            )
        )
        OR (
            public.get_auth_role() = 'ADMIN'
            AND tenant_id = public.get_auth_tenant()
        )
    )
    WITH CHECK (
        (
            public.get_auth_role() = 'SUPER_ADMIN'
            AND EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role::text = 'SUPER_ADMIN'
                  AND p.status::text = 'Active'
                  AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
            )
        )
        OR (
            public.get_auth_role() = 'ADMIN'
            AND tenant_id = public.get_auth_tenant()
        )
    );

DROP POLICY IF EXISTS "chunk_select_policy" ON public.ai_document_chunks;
DROP POLICY IF EXISTS "chunk_admin_policy" ON public.ai_document_chunks;
DROP POLICY IF EXISTS "chunk_super_admin_or_tenant_select" ON public.ai_document_chunks;
DROP POLICY IF EXISTS "chunk_super_admin_or_tenant_admin_write" ON public.ai_document_chunks;

CREATE POLICY "chunk_super_admin_or_tenant_select" ON public.ai_document_chunks
    FOR SELECT
    TO authenticated
    USING (
        (
            public.get_auth_role() = 'SUPER_ADMIN'
            AND EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role::text = 'SUPER_ADMIN'
                  AND p.status::text = 'Active'
                  AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
            )
        )
        OR tenant_id = public.get_auth_tenant()
    );

CREATE POLICY "chunk_super_admin_or_tenant_admin_write" ON public.ai_document_chunks
    FOR ALL
    TO authenticated
    USING (
        (
            public.get_auth_role() = 'SUPER_ADMIN'
            AND EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role::text = 'SUPER_ADMIN'
                  AND p.status::text = 'Active'
                  AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
            )
        )
        OR (
            public.get_auth_role() = 'ADMIN'
            AND tenant_id = public.get_auth_tenant()
        )
    )
    WITH CHECK (
        (
            public.get_auth_role() = 'SUPER_ADMIN'
            AND EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role::text = 'SUPER_ADMIN'
                  AND p.status::text = 'Active'
                  AND LOWER(TRIM(p.email)) = 'aravindvicky629@gmail.com'
            )
        )
        OR (
            public.get_auth_role() = 'ADMIN'
            AND tenant_id = public.get_auth_tenant()
        )
    );

-- ------------------------------------------------------------------------------
-- 3. STANDARDIZE MATCH_AI_CHUNKS & CHECK_AI_RATE_LIMIT_V218 WITH SQLSTATE 42501
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_ai_chunks (
  query_embedding extensions.vector(768),
  match_threshold float DEFAULT 0.45,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_tenant_id TEXT;
  v_user_id UUID;
  v_is_active BOOLEAN;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: RAG access denied (401).' USING ERRCODE = '42501';
  END IF;

  IF match_count < 1 OR match_count > 20 THEN
    RAISE EXCEPTION 'Invalid Argument: match_count must be between 1 and 20.';
  END IF;

  SELECT (status = 'Active'), tenant_id, role::text
  INTO v_is_active, v_tenant_id, v_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Forbidden: AI data access restricted (403).' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RAISE EXCEPTION 'Forbidden: Organizational context missing (403).' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM public.ai_document_chunks c
  INNER JOIN public.ai_knowledge_documents d ON c.document_id = d.id
  WHERE c.tenant_id = v_tenant_id
    AND d.tenant_id = v_tenant_id
    AND d.status = 'ACTIVE'
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_ai_chunks(extensions.vector(768), float, int) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. STANDARDIZE SQLSTATE 42501 ACROSS REMAINING STAGE 2 AGGREGATE RPCS
--    (get_support_aggregates, get_kyc_aggregates, get_platform_executive_kpis,
--     get_transfer_intelligence_aggregates)
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
    v_sla_compliance_pct NUMERIC(5, 1) := 0.0;
    v_average_csat NUMERIC(4, 2) := 0.00;
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

    SELECT COALESCE(SUM(mrr), 0.00)
    INTO v_institutional_mrr
    FROM public.tenant_workspaces
    WHERE status = 'Active' AND id <> 'platform_root';

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

    SELECT COALESCE(ROUND(AVG(CASE WHEN COALESCE(hours_open, 0) <= COALESCE(sla_target_hours, 4) THEN 100.0 ELSE 0.0 END), 1), 0.0)
    INTO v_sla_compliance_pct
    FROM public.support_tickets;

    SELECT COALESCE(ROUND(AVG(compliance_score), 1), 0.0)
    INTO v_compliance_score
    FROM public.tenant_workspaces
    WHERE status = 'Active';

    SELECT COALESCE(
        NULLIF((SELECT SUM(users_count)::int FROM public.tenant_workspaces WHERE status = 'Active' AND id <> 'platform_root'), 0),
        (SELECT COUNT(*)::int FROM public.profiles WHERE status::text = 'Active'),
        0
    )
    INTO v_active_users;

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
