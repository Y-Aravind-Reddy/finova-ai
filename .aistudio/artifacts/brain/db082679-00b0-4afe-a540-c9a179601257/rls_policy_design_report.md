# FINOVA AI — RLS Policy Design & Security Review

## 1. Verified Schema Facts
- **Environment:** PostgreSQL 17.11 on Supabase.
- **Roles:** The `user_role_type` enum exists with values `SUPER_ADMIN`, `ADMIN`, `FINANCE_ANALYST`, `SUPPORT_EXECUTIVE`, and `CUSTOMER`.
- **Identity Helpers:** `public.get_auth_role()` and `public.get_auth_tenant()` are implemented as `SECURITY DEFINER` functions, which is the correct pattern to avoid recursive RLS.
- **Master User:** `aravindvicky629@gmail.com` is verified as the sole authorized `SUPER_ADMIN` via database triggers (`trg_enforce_single_super_admin`).
- **Isolation Keys:** Tables `transactions`, `fraud_cases`, `kyc_records`, and `support_tickets` all contain `tenant_id` (TEXT) and `user_id` (UUID) or `customer_id` (TEXT) for isolation.
- **Audit Logs:** `public.audit_logs` is protected by `trg_enforce_audit_log_integrity`, ensuring append-only integrity.

## 2. Design Assumptions
- **`staging_admin_raw`:** This table is assumed to exist in the production database as per the user brief, even though it is not present in the current local codebase. It is assumed to use `tenant_id` for multi-tenant isolation.
- **`customer_profile_mapping`:** Assumed to be a resolution table for customer ownership if `user_id` is not direct.
- **`exchange_rates`:** Assumed to be globally readable by all authenticated users to support multi-currency calculations on the frontend.

## 3. Security Design Decisions
- **Recursion Mitigation:** All role and tenant lookups in policies utilize the `SECURITY DEFINER` helper functions. This prevents the "infinite loop" that occurs when a policy for a table queries the same table to verify the user's role.
- **Syntax Hardening:** Every policy is provided as a complete, executable `CREATE POLICY` statement to prevent interpretation errors in the SQL Editor.
- **Dynamic Existence Checks:** Optional tables like `staging_admin_raw` are wrapped in `IF EXISTS` blocks to ensure migration stability across environments.
- **Principle of Least Privilege:**
    - `CUSTOMER` role is restricted to own records only (`user_id = auth.uid()`).
    - `SUPPORT_EXECUTIVE` has `SELECT` access to transactions and KYC for dispute resolution but cannot modify financial data or fraud cases.
    - `FINANCE_ANALYST` and `ADMIN` have tenant-scoped management rights.
    - `SUPER_ADMIN` has global platform oversight.
- **Defense in Depth:** Triggers (`trg_protect_profile_privileges`) provide a secondary layer of security, rejecting unauthorized role/tenant updates even if a policy is misconfigured.

## 4. Test Matrix (Verification Plan)
The proposed migration includes a comprehensive test matrix mapping all 5 roles against the 10 tables. Verification should be performed using the `anon` and `authenticated` roles with JWTs containing the respective role claims.

## 5. Next Steps
1. **Review:** The proposed migration `supabase/migrations/20261030_finova_complete_rls_policies.sql` should be reviewed by a DBA.
2. **Staging Test:** Apply to a staging branch to verify no breakages in the Admin Dashboard modules.
3. **Audit:** Run `pg_policies` after application to ensure zero "None" results for sensitive tables.
