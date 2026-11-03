# FINOVA AI — RECONCILIATION & SECURITY PLAN (V5 - REVISED)

This document outlines the corrected security architecture to resolve PostgreSQL 42501 errors and harden the multi-tenant RLS posture, following the strict security requirements of Turn 7.

## 1. Root Cause Analysis (PostgreSQL 42501)
The "Permission Denied" errors are caused by three specific gaps in the current database state:
- **Gap A (Function Execution)**: RPC functions like `get_transaction_aggregates` require explicit `GRANT EXECUTE TO authenticated`.
- **Gap B (Table Visibility)**: While RLS policies may exist, the `authenticated` role lacks basic `GRANT SELECT` on core tables (`transactions`, `fraud_cases`, `kyc_records`).
- **Gap C (Audit Insertion)**: All dashboards attempt to `INSERT` into `audit_logs` via the `recordAuditEventInDb` service, which fails if `GRANT INSERT TO authenticated` is missing.

## 2. Security Shielding Strategy

### A. Audit Integrity (Forgery Protection)
- **Problem**: Ordinary users could pass a fake `actor` name or `tenant_id` to the audit log insertion RPC.
- **Solution**: A `BEFORE INSERT` trigger on `public.audit_logs` will overwrite the actor, role, and tenant ID using the secure session context (`auth.uid()` and JWT claims), making logs immutable and authentic.

### B. Profile Protection (Self-Promotion Prevention)
- **Problem**: Users could potentially update their own `role` to `SUPER_ADMIN` via the `profiles` table.
- **Solution**: The `profiles` self-update policy will include a `WITH CHECK` constraint that validates `NEW.role = OLD.role`, `NEW.tenant_id = OLD.tenant_id`, and `NEW.status = OLD.status`.

### C. Identity Helpers (Performance & Security)
- **Improvement**: Upgrade `get_auth_role()` and `get_auth_tenant()` to check JWT claims (`auth.jwt()`) first. This prevents unnecessary recursive queries to the `profiles` table and speeds up RLS evaluation.

## 3. Mandatory Preservation & Cleaning
- **Customer Mappings**: Preserve the `profile_id` based relationship in `customer_profile_mapping`. No deletion or recreation.
- **Staging Quarantine**: Keep `staging_admin_raw` strictly `SELECT-only` for `ADMIN` and `SUPER_ADMIN`.
- **Anon Access**: Drop all `anon` policies on private tables. Maintain public `SELECT` strictly on `exchange_rates`.
- **Tenant Isolation**: Maintain the `get_auth_tenant()` scope on all SELECT/UPDATE/DELETE policies.

## 4. Technical Implementation Path

### Phase 1: Pre-Migration Validation
```sql
-- Audit existing grants
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' AND grantee IN ('authenticated', 'anon');

-- Audit existing policies
SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public';
```

### Phase 2: Secure Migration (V5 Revised)
- Implement JWT-based helpers.
- Implement Audit Log trigger.
- Apply targeted GRANTS (Functions & Tables).
- Apply column-shielded RLS policies.

### Phase 3: Post-Migration Verification
```sql
-- Verify 42501 Resolution
-- (Test RPC execution and table SELECT as authenticated)

-- Verify Shielding
-- (Attempt to update profiles.role as a regular user - should fail)

-- Verify Forgery Protection
-- (Insert audit log with wrong tenant - trigger should correct it)
```

## 5. Rollback Instructions
A specific rollback SQL block is provided to revert policies to the V2 state and drop the audit trigger if instability occurs.
