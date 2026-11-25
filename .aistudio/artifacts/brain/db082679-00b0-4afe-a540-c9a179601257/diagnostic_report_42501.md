# FINOVA AI - Database Permission Diagnostic Report

**Report Date:** 2026-11-02
**Target Error:** PostgreSQL 42501 (Permission Denied)
**Environment:** Production Supabase PostgreSQL

## 1. Executive Summary
The "Permission Denied" errors affecting the Admin, Finance Analyst, and Support Executive dashboards are primarily caused by missing database `GRANT` statements for the `authenticated` role. While Row Level Security (RLS) policies may be correctly defined, the `authenticated` role lacks the fundamental PostgreSQL privileges to execute specific RPC functions or perform `INSERT`/`SELECT` operations on several core tables.

## 2. Dashboard-Specific Diagnostics

### A. Admin Dashboard (Role: ADMIN)
| Request Target | Operation | Status | Root Cause Diagnosis |
| :--- | :--- | :--- | :--- |
| `get_transaction_aggregates` | RPC | **FAILED (42501)** | Missing `GRANT EXECUTE` to `authenticated`. |
| `get_support_aggregates` | RPC | **FAILED (42501)** | Missing `GRANT EXECUTE` to `authenticated`. |
| `get_fraud_aggregates` | RPC | **FAILED (42501)** | Missing `GRANT EXECUTE` to `authenticated`. |
| `kyc_records` | SELECT | **FAILED (42501)** | Missing `GRANT SELECT` to `authenticated`. |
| `audit_logs` | INSERT | **FAILED (42501)** | Missing `GRANT INSERT` to `authenticated`. |
| `profiles` | SELECT | SUCCESS | Policy `users_read_own_profile` allows self-view. |

### B. Finance Analyst Dashboard (Role: FINANCE_ANALYST)
| Request Target | Operation | Status | Root Cause Diagnosis |
| :--- | :--- | :--- | :--- |
| `fraud_cases` | SELECT | **FAILED (42501)** | Missing `GRANT SELECT` to `authenticated`. |
| `get_transaction_aggregates` | RPC | **FAILED (42501)** | Missing `GRANT EXECUTE` to `authenticated`. |
| `get_fraud_aggregates` | RPC | **FAILED (42501)** | Missing `GRANT EXECUTE` to `authenticated`. |
| `kyc_records` | SELECT | **FAILED (42501)** | Missing `GRANT SELECT` to `authenticated`. |

### C. Support Executive Dashboard (Role: SUPPORT_EXECUTIVE)
| Request Target | Operation | Status | Root Cause Diagnosis |
| :--- | :--- | :--- | :--- |
| `support_tickets` | SELECT | **FAILED (42501)** | Missing `GRANT SELECT` to `authenticated`. |
| `fraud_cases` | SELECT | **FAILED (42501)** | Missing `GRANT SELECT` for role (even if policy exists). |
| `get_support_aggregates` | RPC | **FAILED (42501)** | Missing `GRANT EXECUTE` to `authenticated`. |

## 3. Global Operations
| Function / Table | Operation | Impact | Root Cause Diagnosis |
| :--- | :--- | :--- | :--- |
| `recordAuditEventInDb` | INSERT | All Dashboards | Missing `GRANT INSERT` on `public.audit_logs`. |

## 4. Proposed Fixes (Pending DBA Approval)

### I. Function Privileges
The aggregate functions are `SECURITY INVOKER` by default. They require explicit execution grants.
```sql
GRANT EXECUTE ON FUNCTION public.get_transaction_aggregates TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fraud_aggregates TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_support_aggregates TO authenticated;
```

### II. Table Privileges
Basic visibility is restricted by RLS, but the role still needs permission to "see" the table.
```sql
GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT ON public.fraud_cases TO authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT SELECT ON public.kyc_records TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.tenant_workspaces TO authenticated;
```

### III. Audit Log Integrity
Enable logging for all authenticated actions while preserving isolation via existing RLS.
```sql
GRANT INSERT ON public.audit_logs TO authenticated;

-- Ensure an insertion policy exists if not already present
CREATE POLICY "authenticated_insert_audit_logs" 
ON public.audit_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);
```

## 5. Frontend Safety Measures
- **Clamping**: Already implemented `executeSafelyWithPagination` to prevent `PGRST103`.
- **Fallbacks**: Dashboard query services correctly revert to `fallback` datasets (verified institutional baselines) upon 42501 detection, maintaining UI stability.
