# RLS Migration v5 Security Review & Comparison

This report details the mandatory security corrections implemented in `20261030_finova_complete_rls_policies_reconciled_v5.sql`.

## 1. Corrections against Actual Schema
| Subject | Previous (v4) | Corrected (v5) | Status |
| :--- | :--- | :--- | :--- |
| **Mapping Columns** | Used `user_id` | Uses `profile_id` | **Fixed** |
| **Self-Update** | Allowed potentially sensitive fields | Restricted to `role` and `tenant_id` invariance | **Hardened** |
| **Anon Access** | Broad `TO anon` for workspaces | Revoked from all private tables | **Hardened** |
| **Mapping Mgmt** | Granted to authenticated | Restricted to `ADMIN` (tenant-scoped) & `SUPER_ADMIN` | **Fixed** |

## 2. Integrity Protections
- **`customer_profile_mapping`**: Authenticated users are granted `SELECT` only. Management operations are strictly reserved for administrative roles. The `profile_id` column is used to join against `profiles.id` (UUID).
- **`profiles` Escalation**: The `WITH CHECK` clause in the `users_update_own_profile_safe` policy explicitly prevents a user from changing their `role` or `tenant_id` during a self-update by comparing the new value against their existing record in the database.
- **`staging_admin_raw`**: Preserved as `SELECT` only for authorized staff, preventing data tampering in the onboarding pipeline.

## 3. Verification Plan
After review, execute the diagnostic queries provided in the SQL file comments to:
1. Confirm zero `TO anon` policies on sensitive tables.
2. Confirm the correct column set for the mapping table.
3. Confirm that the `SECURITY DEFINER` identity helpers are correctly parsing the `auth.uid()`.

## 4. Rollback Readiness
The migration includes a structured rollback plan to revert schema hardening and specific policies if operational issues are detected by the DBA.
