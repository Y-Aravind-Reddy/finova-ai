# FINOVA AI — REVISED RLS RECONCILIATION & PRESERVATION PLAN

This revised plan ensures that the production security posture is hardened without disrupting existing valid configurations. It adheres to strict tenant isolation and role-based access control (RBAC) while specifically addressing customer mapping security.

## 1. Core Security Principles
- **Preservation First**: Do not drop or replace existing policies unless they are demonstrably incorrect or conflict with core isolation requirements.
- **Tenant Isolation**: Every query must be scoped by `tenant_id` or `user_id` as resolved by `SECURITY DEFINER` helpers.
- **Mapping Integrity**: Use `customer_profile_mapping` to bridge legacy customer identifiers to authenticated `user_id`. Customers are strictly prohibited from self-modifying these mappings.
- **Zero Anonymous Access**: Remove all `TO anon` policies on private tables (`profiles`, `transactions`, `fraud_cases`, etc.).
- **Restricted Authenticated Privileges**: Ensure `TO authenticated` roles have minimal necessary permissions (e.g., Customers can SELECT but not DELETE).

## 2. Diagnostic SQL (State Verification)
Execute this to audit the current production state before applying the migration.

```sql
-- Comprehensive Policy Audit
SELECT 
    schemaname, tablename, policyname, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- Verify Anonymous Access (Should be minimal)
SELECT tablename, policyname, roles 
FROM pg_policies 
WHERE 'anon' = ANY(roles) AND schemaname = 'public';
```

## 3. Idempotent Migration Strategy
Every policy block in the migration will follow the **"Check-and-Retain"** pattern:
1. **Existence Check**: Query `pg_policies` for the policy name.
2. **Logic Validation**: Compare existing `USING` expression against the intended secure expression.
3. **Selective Replacement**: Only `DROP` and `CREATE` if the policy is missing or inconsistent. Otherwise, skip to preserve the established state.
4. **Grant Hardening**: Ensure `REVOKE ALL ON ALL TABLES ... FROM PUBLIC` is maintained.

## 4. Specific Logic for customer_profile_mapping
- **Operation**: SELECT
  - **Logic**: `(user_id = auth.uid()) OR (public.get_auth_role() IN ('ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE') AND tenant_id = public.get_auth_tenant())`
- **Operation**: INSERT/UPDATE/DELETE
  - **Logic**: `public.get_auth_role() IN ('SUPER_ADMIN', 'ADMIN')`

## 5. Post-Migration Verification
After deployment, run the following to verify compliance:

```sql
-- Count policies per table to ensure no duplicates
SELECT tablename, count(*) 
FROM pg_policies 
WHERE schemaname = 'public' 
GROUP BY tablename;

-- Verify Customer Ownership Constraint
-- This should return 0 if policies are correct (testing logic only)
SELECT * FROM transactions WHERE user_id <> auth.uid() AND public.get_auth_role() = 'CUSTOMER';
```
