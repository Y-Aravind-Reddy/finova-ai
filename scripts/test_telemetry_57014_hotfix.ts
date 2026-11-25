import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  clearTelemetryDiagnosticsForTest,
  getRecentTelemetryDiagnostics,
  isStatementTimeoutError,
  isNonRetryableTelemetryError,
  fetchTransactionAggregatesResultFromDb,
  fetchFraudAggregatesResultFromDb,
  fetchSupportAggregatesResultFromDb,
  fetchKycAggregatesResultFromDb,
  fetchPlatformExecutiveKpis,
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
  console.log('FINOVA AI — 57014 HOTFIX MIGRATION, DIAGNOSTICS & SIGNAL AUDIT');
  console.log('================================================================\n');

  // 1. Static SQL Audit of 20261125_telemetry_57014_hotfix_indexes_and_rpcs.sql
  console.log('--- 1. Static SQL Audit of 20261125 Hotfix Migration ---');
  const sqlPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261125_telemetry_57014_hotfix_indexes_and_rpcs.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const sqlNoComments = sql.replace(/--.*$/gm, '');
  const dollarTags = (sqlNoComments.match(/\$\$/g) || []).length;
  const policies = sqlNoComments.match(/CREATE\s+POLICY[\s\S]*?;/gi) || [];
  const usingTruePolicies = policies.filter((p) => /USING\s*\(\s*true\s*\)/i.test(p));

  assert('20261125 hotfix migration exists', fs.existsSync(sqlPath));
  assert('Balanced $$ blocks', dollarTags > 0 && dollarTags % 2 === 0, `count=${dollarTags}`);
  assert(
    'Zero destructive DDL/RLS disable/USING(true)/LATERAL',
    !/\bDROP\s+TABLE\b/i.test(sqlNoComments) &&
      !/\bTRUNCATE\b/i.test(sqlNoComments) &&
      !/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sqlNoComments) &&
      usingTruePolicies.length === 0 &&
      !/LEFT\s+JOIN\s+LATERAL/i.test(sqlNoComments)
  );

  const indexCount = (sqlNoComments.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi) || []).length;
  assert(
    '17 composite/partial performance indexes created idempotently',
    indexCount === 17 &&
      sqlNoComments.includes('idx_transactions_tenant_date_desc') &&
      sqlNoComments.includes('idx_fraud_cases_active_risk') &&
      sqlNoComments.includes('idx_transactions_unresolved_tenant_date') &&
      sqlNoComments.includes('idx_kyc_records_tenant_status') &&
      sqlNoComments.includes('idx_profiles_tenant_tier'),
    `count=${indexCount}`
  );

  assert(
    'ANALYZE executed on all 6 telemetry tables',
    ['transactions', 'fraud_cases', 'kyc_records', 'support_tickets', 'profiles', 'exchange_rates'].every((tbl) =>
      new RegExp(`ANALYZE\\s+public\\.${tbl};`, 'i').test(sqlNoComments)
    )
  );

  assert(
    'Dynamic pg_policies cleanup loops cover transactions, fraud_cases, kyc_records, support_tickets',
    ['transactions', 'fraud_cases', 'kyc_records', 'support_tickets'].every((tbl) =>
      new RegExp(`FROM\\s+pg_policies[\\s\\S]*?tablename\\s*=\\s*'${tbl}'`, 'i').test(sqlNoComments)
    )
  );

  assert(
    'Zero raw base CTE MATERIALIZED spills (GROUPING SETS stream used instead)',
    !/base_(tx|fraud|tickets|kyc)\s+AS\s+MATERIALIZED/i.test(sqlNoComments) &&
      (sqlNoComments.match(/GROUP\s+BY\s+GROUPING\s+SETS/gi) || []).length === 5
  );

  assert(
    'All 6 RPCs retain SECURITY INVOKER, search_path, anon revoke, and authenticated grant',
    (sqlNoComments.match(/SECURITY\s+INVOKER[\s\S]*?SET\s+search_path\s*=\s*public,\s*pg_temp/gi) || []).length === 6 &&
      (sqlNoComments.match(/REVOKE\s+ALL\s+ON\s+FUNCTION[\s\S]*?FROM\s+PUBLIC,\s*anon;/gi) || []).length === 6 &&
      (sqlNoComments.match(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[\s\S]*?TO\s+authenticated,\s*service_role;/gi) || []).length === 6
  );

  assert(
    'Sole SUPER_ADMIN email enforced across policies and RPCs',
    (sqlNoComments.match(/aravindvicky629@gmail\.com/g) || []).length >= 10
  );

  // 2. Runtime Telemetry Diagnostic Capture & Secret/PII Redaction Tests
  console.log('\n--- 2. Safe Telemetry Diagnostics, PII Redaction & AbortSignal Tests ---');
  clearTelemetryDiagnosticsForTest();

  let capturedSignalKyc: AbortSignal | undefined;
  let capturedSignalKpi: AbortSignal | undefined;

  const authSessionMock = {
    getSession: async () => ({
      data: { session: { user: { id: '00000000-0000-0000-0000-000000000001' } } },
      error: null,
    }),
  };

  const makeRpcResultBuilder = (
    rpcFn: string,
    payload: { data: any; error: any },
    onSignal: (sig: AbortSignal) => void
  ) => {
    const promise = Promise.resolve(payload);
    const builder: any = {
      abortSignal: (sig: AbortSignal) => {
        onSignal(sig);
        return builder;
      },
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    };
    return builder;
  };

  const spySignalClient: any = {
    auth: authSessionMock,
    mockRole: 'SUPER_ADMIN',
    rpc: (fn: string) => {
      if (fn === 'get_kyc_aggregates') {
        return makeRpcResultBuilder(
          fn,
          { data: { totalRecords: 5, verifiedCount: 3, pendingCount: 1, reviewCount: 1 }, error: null },
          (sig) => {
            capturedSignalKyc = sig;
          }
        );
      }
      if (fn === 'get_platform_executive_kpis') {
        return makeRpcResultBuilder(
          fn,
          {
            data: {
              settledVolumeYtd: 1000,
              institutionalMrr: 500,
              preventedFraudVolume: 200,
              slaCompliancePct: 99,
              complianceScore: 95,
              activeUsers: 12,
              netLiquidBalance: 800,
              riskExposureScore: 10,
            },
            error: null,
          },
          (sig) => {
            capturedSignalKpi = sig;
          }
        );
      }
      return makeRpcResultBuilder(fn, { data: null, error: { code: '57014', message: 'statement timeout' } }, () => {});
    },
  };

  const acKyc = new AbortController();
  const acKpi = new AbortController();
  const kycOk = await fetchKycAggregatesResultFromDb('tenant_apex_bank', { signal: acKyc.signal }, spySignalClient);
  const kpiOk = await fetchPlatformExecutiveKpis(spySignalClient, { signal: acKpi.signal });
  const kpiOkOptOnly = await fetchPlatformExecutiveKpis({ signal: acKpi.signal }); // checks options-only signature works safely

  assert('fetchKycAggregatesResultFromDb attaches AbortSignal', capturedSignalKyc === acKyc.signal && kycOk.source === 'supabase');
  assert('fetchPlatformExecutiveKpis attaches AbortSignal', capturedSignalKpi === acKpi.signal && kpiOk.source === 'supabase');
  assert('fetchPlatformExecutiveKpis handles options-only signature without crashing', typeof kpiOkOptOnly.state === 'string');

  clearTelemetryDiagnosticsForTest();

  const leakyTimeoutClient: any = {
    auth: authSessionMock,
    mockRole: 'ADMIN',
    rpc: async (_fn: string) => ({
      data: null,
      error: {
        code: '57014',
        message:
          'canceling statement due to statement timeout for Bearer secretToken12345 user aravindvicky629@gmail.com jwt eyJhbGciOiJIUzI1NiJ9.payload123.sig456',
      },
    }),
  };

  const txDiagRes = await fetchTransactionAggregatesResultFromDb(
    'aravindvicky629@gmail.com',
    { startDate: '2026-01-01', endDate: '2026-01-31' },
    leakyTimeoutClient
  );
  const frDiagRes = await fetchFraudAggregatesResultFromDb(
    'tenant_apex_bank',
    { startDate: '2026-01-01', endDate: '2026-01-31' },
    leakyTimeoutClient
  );
  const spDiagRes = await fetchSupportAggregatesResultFromDb('tenant_apex_bank', undefined, leakyTimeoutClient);
  const kyDiagRes = await fetchKycAggregatesResultFromDb('tenant_apex_bank', leakyTimeoutClient);

  let tiErrorMsg = '';
  let tiIsTimeout = false;
  let tiNonRetryable = false;
  try {
    await transferIntelligenceService.fetchOverviewAggregates(
      'tenant_apex_bank',
      { startDate: '2026-01-01', endDate: '2026-01-10' },
      leakyTimeoutClient
    );
  } catch (err: any) {
    tiErrorMsg = err?.message || '';
    tiIsTimeout = isStatementTimeoutError(err);
    tiNonRetryable = isNonRetryableTelemetryError(err);
  }

  const diags = getRecentTelemetryDiagnostics();
  assert('Diagnostic buffer captures timeout telemetry for all 5 queried RPCs', diags.length === 5, `count=${diags.length}`);
  assert(
    'Diagnostic metadata preserves required safe attributes (rpcName, sqlstate, durationMs, dateRangeDays, role, tenantScope, outcome)',
    diags.every(
      (d) =>
        Boolean(d.correlationId) &&
        Boolean(d.widgetName) &&
        Boolean(d.rpcName) &&
        d.sqlstate === '57014' &&
        typeof d.durationMs === 'number' &&
        d.outcome === 'TIMEOUT'
    )
  );
  assert(
    'Diagnostic buffer and formatted errors redact emails, JWTs, and Bearer tokens',
    !String(txDiagRes.error).includes('secretToken12345') &&
      !String(txDiagRes.error).includes('aravindvicky629@gmail.com') &&
      !String(txDiagRes.error).includes('eyJhbGciOiJIUzI1NiJ9') &&
      String(txDiagRes.error).includes('[EMAIL_REDACTED]') &&
      String(txDiagRes.error).includes('[JWT_REDACTED]') &&
      String(txDiagRes.error).includes('Bearer [REDACTED]') &&
      diags.some((d) => d.tenantScope === 'REDACTED_SCOPE')
  );
  assert(
    'Formatted errors expose exact RPC name, SQLSTATE, scope, and correlation ID',
    String(txDiagRes.error).includes('get_transaction_aggregates') &&
      String(frDiagRes.error).includes('get_fraud_aggregates') &&
      String(spDiagRes.error).includes('get_support_aggregates') &&
      String(kyDiagRes.error).includes('get_kyc_aggregates') &&
      tiErrorMsg.includes('get_transfer_intelligence_aggregates') &&
      tiIsTimeout &&
      tiNonRetryable
  );

  // 3. UI & Component Static Remediation Checks
  console.log('\n--- 3. UI Attribution, Bounded Defaults & Cancellation Static Audit ---');
  const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf-8');

  const widgetStatusSrc = readSrc('src/components/common/WidgetTelemetryStatus.tsx');
  const adminDashSrc = readSrc('src/components/dashboards/AdminDashboard.tsx');
  const finDashSrc = readSrc('src/components/dashboards/FinanceAnalystDashboard.tsx');
  const fraudPageSrc = readSrc('src/components/finance/FinanceFraudDetectionPage.tsx');
  const txPageSrc = readSrc('src/components/finance/FinanceTransactionAnalyticsPage.tsx');
  const reconSrc = readSrc('src/components/datatransfer/Reconciliation.tsx');
  const exceptionsSrc = readSrc('src/components/datatransfer/TransferExceptions.tsx');
  const recordsSrc = readSrc('src/components/datatransfer/TransactionRecords.tsx');

  assert(
    'WidgetFailureNotice preserves diagnostic error detail on TIMEOUT',
    widgetStatusSrc.includes('{isTimeout && error && (')
  );
  assert(
    'AdminDashboard passes AbortSignal to KPI & KYC queries and uses specific failingWidgetLabel',
    adminDashSrc.includes('fetchPlatformExecutiveKpis({ signal })') &&
      adminDashSrc.includes('fetchKycAggregatesResultFromDb(tenantId, { signal })') &&
      adminDashSrc.includes('widgetName={failingWidgetLabel}') &&
      !adminDashSrc.includes("'Database Telemetry Timeout'")
  );
  assert(
    'FinanceAnalystDashboard passes AbortSignal to KYC query',
    finDashSrc.includes('fetchKycAggregatesResultFromDb(tenantId, { signal })')
  );
  assert(
    'Finance pages use AbortController in useEffect',
    fraudPageSrc.includes('new AbortController()') &&
      fraudPageSrc.includes('controller.abort()') &&
      txPageSrc.includes('new AbortController()') &&
      txPageSrc.includes('controller.abort()')
  );
  assert(
    'Reconciliation, TransferExceptions, and TransactionRecords default to YTD, forward signal, and use WidgetFailureNotice',
    [reconSrc, exceptionsSrc, recordsSrc].every(
      (s) =>
        s.includes("getDefaultBoundedDateRange('YTD')") &&
        s.includes('{ signal }') &&
        s.includes('<WidgetFailureNotice') &&
        !s.includes("startDate: ''")
    )
  );

  console.log('\n================================================================');
  console.log(`HOTFIX VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('================================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
