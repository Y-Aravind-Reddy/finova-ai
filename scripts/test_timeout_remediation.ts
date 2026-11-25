import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  isStatementTimeoutError,
  isPermissionDeniedError,
  isMissingRpcError,
  isNonRetryableTelemetryError,
  classifyErrorState,
  mapResultStateToTelemetryStatus,
  getDefaultBoundedDateRange,
  dedupeInFlight,
  canRoleAccessFraudTelemetry,
  canRoleAccessInstitutionalKyc,
  canRoleAccessSupportTelemetry,
  fetchTransactionAggregatesResultFromDb,
  fetchFraudAggregatesResultFromDb,
  fetchSupportAggregatesResultFromDb,
  fetchKycAggregatesResultFromDb,
  fetchPlatformExecutiveKpis,
  fetchTransactionsResultFromDb,
} from '../src/services/finovaDatabase';
import { transferIntelligenceService } from '../src/services/transferIntelligenceService';

let passed = 0;
let failed = 0;

function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('FINOVA AI — STATEMENT TIMEOUT (57014) REMEDIATION VERIFICATION');
  console.log('================================================================\n');

  // 1. Static SQL Audit of 20261123_optimize_telemetry_rpcs_and_indexes.sql
  console.log('--- 1. Static SQL Optimization Migration Audit ---');
  const sqlPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261123_optimize_telemetry_rpcs_and_indexes.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const sqlNoComments = sql.replace(/--.*$/gm, '');
  const dollarTags = (sqlNoComments.match(/\$\$/g) || []).length;
  const policies = sqlNoComments.match(/CREATE\s+POLICY[\s\S]*?;/gi) || [];
  const usingTruePolicies = policies.filter((p) => /USING\s*\(\s*true\s*\)/i.test(p));

  assert('Optimization migration exists and is substantial', sql.length > 25000, `bytes=${sql.length}`);
  assert('Balanced $$ blocks (even count)', dollarTags > 0 && dollarTags % 2 === 0, `count=${dollarTags}`);
  assert('Zero destructive DROP TABLE statements', !/\bDROP\s+TABLE\b/i.test(sqlNoComments));
  assert('Zero TRUNCATE statements', !/\bTRUNCATE\b/i.test(sqlNoComments));
  assert('Zero DISABLE ROW LEVEL SECURITY statements', !/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sqlNoComments));
  assert('Zero USING (true) policies introduced', usingTruePolicies.length === 0, usingTruePolicies.join('\n'));
  assert('Zero LEFT JOIN LATERAL in optimized RPCs', !/LEFT\s+JOIN\s+LATERAL/i.test(sqlNoComments));
  assert(
    'Single-pass MATERIALIZED CTEs used across aggregate RPCs',
    (sqlNoComments.match(/AS\s+MATERIALIZED\s*\(/gi) || []).length >= 4
  );
  assert(
    '6 composite/partial performance indexes created idempotently',
    (sqlNoComments.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi) || []).length === 6
  );
  assert(
    'InitPlan RLS wrapping uses (SELECT public.get_auth_role()) and (SELECT auth.uid())',
    /\(\s*SELECT\s+public\.get_auth_role\(\)\s*\)/i.test(sqlNoComments) &&
      /\(\s*SELECT\s+auth\.uid\(\)\s*\)/i.test(sqlNoComments)
  );
  assert(
    'Single authorized SUPER_ADMIN email enforced in policies & RPCs',
    sqlNoComments.includes('aravindvicky629@gmail.com')
  );
  assert(
    'All 6 optimized telemetry RPCs retain SECURITY INVOKER and SET search_path = public, pg_temp',
    (sqlNoComments.match(/SECURITY\s+INVOKER[\s\S]*?SET\s+search_path\s*=\s*public,\s*pg_temp/gi) || []).length === 6
  );
  assert(
    'All 6 optimized telemetry RPCs revoke anon access and grant authenticated',
    (sqlNoComments.match(/REVOKE\s+ALL\s+ON\s+FUNCTION[\s\S]*?FROM\s+PUBLIC,\s*anon;/gi) || []).length === 6 &&
      (sqlNoComments.match(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[\s\S]*?TO\s+authenticated,\s*service_role;/gi) || []).length === 6
  );

  // 2. Error Classification & Bounded Date Range Unit Tests
  console.log('\n--- 2. Error Classification, Retry Policy & Bounded Range Tests ---');
  const timeout57014 = { code: '57014', message: 'canceling statement due to statement timeout' };
  const timeoutSocket = { code: 'ETIMEDOUT', message: 'Request timed out' };
  const perm42501 = { code: '42501', message: 'permission denied for function get_fraud_aggregates' };
  const rpc42883 = { code: '42883', message: 'function does not exist' };
  const transient500 = { status: 500, message: 'Temporary connection reset' };

  assert('isStatementTimeoutError detects SQLSTATE 57014', isStatementTimeoutError(timeout57014));
  assert('isStatementTimeoutError detects ETIMEDOUT', isStatementTimeoutError(timeoutSocket));
  assert('isStatementTimeoutError detects message without code', isStatementTimeoutError({ message: 'canceling statement due to statement timeout' }));
  assert('isStatementTimeoutError ignores 42501', !isStatementTimeoutError(perm42501));
  assert('isPermissionDeniedError ignores 57014', !isPermissionDeniedError(timeout57014));
  assert('isMissingRpcError detects 42883', isMissingRpcError(rpc42883));

  assert('isNonRetryableTelemetryError blocks retries for 57014', isNonRetryableTelemetryError(timeout57014));
  assert('isNonRetryableTelemetryError blocks retries for 42501', isNonRetryableTelemetryError(perm42501));
  assert('isNonRetryableTelemetryError blocks retries for 42883', isNonRetryableTelemetryError(rpc42883));
  assert('isNonRetryableTelemetryError allows retry on transient 500', !isNonRetryableTelemetryError(transient500));

  assert(
    'classifyErrorState maps authenticated 57014 -> timeout (never query_error)',
    classifyErrorState(timeout57014, true) === 'timeout'
  );
  assert(
    'classifyErrorState maps unauthenticated 57014 -> timeout',
    classifyErrorState(timeout57014, false) === 'timeout'
  );
  assert(
    'mapResultStateToTelemetryStatus maps timeout -> TIMEOUT',
    mapResultStateToTelemetryStatus('timeout', 'fallback') === 'TIMEOUT'
  );

  const ytdRange = getDefaultBoundedDateRange('YTD');
  const d30Range = getDefaultBoundedDateRange('30D');
  const allRange = getDefaultBoundedDateRange('ALL');
  assert('getDefaultBoundedDateRange("YTD") starts Jan 1 UTC', ytdRange.startDate.endsWith('-01-01') && ytdRange.endDate >= ytdRange.startDate);
  assert('getDefaultBoundedDateRange("30D") has valid bounded dates', Boolean(d30Range.startDate) && d30Range.endDate >= d30Range.startDate);
  assert('getDefaultBoundedDateRange("ALL") returns empty bounds', allRange.startDate === '' && allRange.endDate === '');

  // 3. Concurrent In-Flight Request Deduplication & AbortSignal Tests
  console.log('\n--- 3. Concurrent Request Deduplication & Timeout Propagation Tests ---');
  let rpcCount = 0;
  let capturedAbortSignal: AbortSignal | undefined;
  let capturedCountMode: string | undefined;

  const mockBuilder = (rows: any[] = []) => {
    const b: any = {
      select: (_cols: string, opts?: { count?: string }) => {
        if (opts?.count) capturedCountMode = opts.count;
        return b;
      },
      order: () => b,
      eq: () => b,
      gte: () => b,
      lte: () => b,
      or: () => b,
      abortSignal: (sig: AbortSignal) => {
        capturedAbortSignal = sig;
        return b;
      },
      range: async () => {
        rpcCount++;
        return { data: rows, error: null, count: rows.length };
      },
    };
    return b;
  };

  const spyClient: any = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: '00000000-0000-0000-0000-000000000001' } } },
        error: null,
      }),
    },
    from: () => mockBuilder([]),
    rpc: async (_fn: string) => {
      rpcCount++;
      await new Promise((r) => setTimeout(r, 15));
      return {
        data: {
          totalCount: 100,
          settledCount: 90,
          settledVolumeInr: 1000000,
          settledVolumeUsd: 11894.85,
          netLiquidBalanceInr: 500000,
          netLiquidBalanceUsd: 5947.42,
        },
        error: null,
      };
    },
  };

  rpcCount = 0;
  await Promise.all([
    fetchTransactionAggregatesResultFromDb('tenant_apex_bank', { startDate: '2026-01-01', endDate: '2026-11-22' }, spyClient),
    fetchTransactionAggregatesResultFromDb('tenant_apex_bank', { startDate: '2026-01-01', endDate: '2026-11-22' }, spyClient),
  ]);
  assert('Concurrent identical tx aggregate calls share 1 in-flight RPC', rpcCount === 1, `rpcCount=${rpcCount}`);

  rpcCount = 0;
  await Promise.all([
    fetchTransactionAggregatesResultFromDb('tenant_apex_bank', { startDate: '2026-01-01' }, spyClient),
    fetchTransactionAggregatesResultFromDb('tenant_euro_corp', { startDate: '2026-01-01' }, spyClient),
  ]);
  assert('Concurrent different-tenant tx aggregate calls execute separately', rpcCount === 2, `rpcCount=${rpcCount}`);

  rpcCount = 0;
  await fetchTransactionAggregatesResultFromDb('tenant_apex_bank', { startDate: '2026-01-01' }, spyClient);
  await fetchTransactionAggregatesResultFromDb('tenant_apex_bank', { startDate: '2026-01-01' }, spyClient);
  assert('Sequential identical tx aggregate calls execute fresh (no stale in-flight cache)', rpcCount === 2, `rpcCount=${rpcCount}`);

  // Default estimated count mode & AbortSignal attachment check
  const ac = new AbortController();
  await fetchTransactionsResultFromDb('tenant_apex_bank', { signal: ac.signal }, spyClient);
  assert('Transactions pagination defaults to estimated countMode', capturedCountMode === 'estimated', `got=${capturedCountMode}`);
  assert('Transactions query attaches AbortSignal via .abortSignal()', capturedAbortSignal === ac.signal);

  // Timeout propagation across all 5 aggregate fetchers
  const timeoutClient: any = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: '00000000-0000-0000-0000-000000000001' } } },
        error: null,
      }),
    },
    from: () => mockBuilder(),
    rpc: async () => ({
      data: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    }),
  };

  const [txT, frT, spT, kyT, kpT] = await Promise.all([
    fetchTransactionAggregatesResultFromDb('tenant_apex_bank', { startDate: '2026-01-01' }, timeoutClient),
    fetchFraudAggregatesResultFromDb('tenant_apex_bank', { startDate: '2026-01-01' }, timeoutClient),
    fetchSupportAggregatesResultFromDb('tenant_apex_bank', undefined, timeoutClient),
    fetchKycAggregatesResultFromDb('tenant_apex_bank', timeoutClient),
    fetchPlatformExecutiveKpis(timeoutClient),
  ]);
  assert(
    'All telemetry aggregate services classify SQLSTATE 57014 as timeout cleanly',
    txT.state === 'timeout' &&
      frT.state === 'timeout' &&
      spT.state === 'timeout' &&
      kyT.state === 'timeout' &&
      kpT.state === 'timeout',
    JSON.stringify({ tx: txT.state, fr: frT.state, sp: spT.state, ky: kyT.state, kp: kpT.state })
  );

  // Check dedupeInFlight helper directly
  let directRuns = 0;
  await Promise.all([
    dedupeInFlight('test:k1', async () => {
      directRuns++;
      await new Promise((r) => setTimeout(r, 10));
      return 'ok';
    }),
    dedupeInFlight('test:k1', async () => {
      directRuns++;
      return 'ok';
    }),
  ]);
  assert('dedupeInFlight shares promise while pending', directRuns === 1, `directRuns=${directRuns}`);

  // TransferIntelligenceService timeout propagation test
  let throwPreservedCode = false;
  try {
    await transferIntelligenceService.fetchOverviewAggregates('tenant_apex_bank', { startDate: '2026-01-01' }, timeoutClient);
  } catch (err: any) {
    throwPreservedCode = isStatementTimeoutError(err) && isNonRetryableTelemetryError(err);
  }
  assert('transferIntelligenceService preserves SQLSTATE 57014 on thrown error for React Query non-retry', throwPreservedCode);

  // 4. Role Authorization Regression Matrix
  console.log('\n--- 4. RBAC Gatekeeper Regression Checks ---');
  const fraudDeniedCustomer = await fetchFraudAggregatesResultFromDb('tenant_apex_bank', undefined, {
    ...spyClient,
    mockRole: 'CUSTOMER',
  });
  const fraudDeniedSupport = await fetchFraudAggregatesResultFromDb('tenant_apex_bank', undefined, {
    ...spyClient,
    mockRole: 'SUPPORT_EXECUTIVE',
  });
  const kpiDeniedAdmin = await fetchPlatformExecutiveKpis({
    ...spyClient,
    mockRole: 'ADMIN',
  });

  assert('CUSTOMER & SUPPORT_EXECUTIVE remain restricted from fraud telemetry', fraudDeniedCustomer.state === 'restricted' && fraudDeniedSupport.state === 'restricted');
  assert('ADMIN remains restricted from platform executive KPIs', kpiDeniedAdmin.state === 'restricted');
  assert(
    'RBAC capability matrix intact across all 5 roles',
    canRoleAccessFraudTelemetry('SUPER_ADMIN') &&
      canRoleAccessFraudTelemetry('ADMIN') &&
      canRoleAccessFraudTelemetry('FINANCE_ANALYST') &&
      !canRoleAccessFraudTelemetry('SUPPORT_EXECUTIVE') &&
      !canRoleAccessFraudTelemetry('CUSTOMER') &&
      canRoleAccessInstitutionalKyc('SUPPORT_EXECUTIVE') &&
      !canRoleAccessInstitutionalKyc('CUSTOMER') &&
      canRoleAccessSupportTelemetry('SUPPORT_EXECUTIVE') &&
      !canRoleAccessSupportTelemetry('FINANCE_ANALYST')
  );

  console.log('\n================================================================');
  console.log(`TIMEOUT REMEDIATION TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('================================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
