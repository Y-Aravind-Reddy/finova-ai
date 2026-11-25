import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  isPermissionDeniedError,
  classifyErrorState,
  mapResultStateToTelemetryStatus,
  canRoleAccessFraudTelemetry,
  canRoleAccessInstitutionalKyc,
  canRoleAccessSupportTelemetry,
  fetchFraudCasesResultFromDb,
  fetchFraudAggregatesResultFromDb,
  fetchTransactionAggregatesResultFromDb,
  fetchSupportAggregatesResultFromDb,
  fetchPlatformExecutiveKpis,
} from '../src/services/finovaDatabase';
import { checkSupabaseConnection, supabase, isSupabaseConfigured } from '../src/lib/supabase';

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

function createMockSupabaseClient(options: {
  hasSession: boolean;
  errorCode?: string;
  errorMessage?: string;
}) {
  const errObj = options.errorCode
    ? { code: options.errorCode, message: options.errorMessage || 'permission denied' }
    : null;

  const queryBuilder: any = {
    select: () => queryBuilder,
    order: () => queryBuilder,
    eq: () => queryBuilder,
    or: () => queryBuilder,
    range: async () => ({ data: null, error: errObj, count: null }),
  };

  return {
    auth: {
      getSession: async () => ({
        data: {
          session: options.hasSession
            ? { user: { id: '00000000-0000-0000-0000-000000000001' } }
            : null,
        },
        error: null,
      }),
    },
    from: () => queryBuilder,
    rpc: async () => ({ data: null, error: errObj }),
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('FINOVA AI — 42501 PERMISSION & TELEMETRY VERIFICATION SUITE');
  console.log('================================================================\n');

  // 1. Static SQL Audit
  console.log('--- 1. Static SQL Migration Audit ---');
  const sqlPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261118_fix_42501_finance_telemetry_permissions.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const sqlNoComments = sql.replace(/--.*$/gm, '');
  const dollarTags = (sqlNoComments.match(/\$\$/g) || []).length;
  const fraudSectionMatch = sqlNoComments.match(/REVOKE ALL ON TABLE public\.fraud_cases[\s\S]*?(?=ALTER TABLE public\.kyc_records)/i);
  const fraudSection = fraudSectionMatch ? fraudSectionMatch[0] : '';
  const policies = sqlNoComments.match(/CREATE\s+POLICY[\s\S]*?;/gi) || [];
  const unsafeUsingTruePolicies = policies.filter(
    (p) => !/ON\s+public\.exchange_rates/i.test(p) && /USING\s*\(\s*true\s*\)/i.test(p)
  );

  assert('SQL migration file exists and is non-empty', sql.length > 5000);
  assert('Balanced $$ blocks (even count)', dollarTags > 0 && dollarTags % 2 === 0, `count=${dollarTags}`);
  assert('Zero destructive DROP TABLE statements', !/\bDROP\s+TABLE\b/i.test(sqlNoComments));
  assert('Zero TRUNCATE statements', !/\bTRUNCATE\b/i.test(sqlNoComments));
  assert('Zero DISABLE ROW LEVEL SECURITY statements', !/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sqlNoComments));
  assert(
    'Zero USING (true) outside exchange_rates',
    unsafeUsingTruePolicies.length === 0,
    unsafeUsingTruePolicies.join('\n')
  );
  assert(
    'get_fraud_aggregates uses SECURITY INVOKER and SET search_path',
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_fraud_aggregates[\s\S]*?SECURITY\s+INVOKER[\s\S]*?SET\s+search_path\s*=\s*public,\s*pg_temp/i.test(sqlNoComments)
  );
  assert(
    'get_transaction_aggregates uses SECURITY INVOKER and SET search_path',
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_transaction_aggregates[\s\S]*?SECURITY\s+INVOKER[\s\S]*?SET\s+search_path\s*=\s*public,\s*pg_temp/i.test(sqlNoComments)
  );
  assert(
    'Single authorized SUPER_ADMIN email enforced',
    sqlNoComments.includes('aravindvicky629@gmail.com')
  );
  assert(
    'fraud_cases RLS excludes SUPPORT_EXECUTIVE and CUSTOMER',
    fraudSection.length > 100 &&
      !/SUPPORT_EXECUTIVE/i.test(fraudSection) &&
      !/\bCUSTOMER\b/i.test(fraudSection)
  );
  assert(
    'kyc_records customer insert restricted to Pending or Under Review',
    /CREATE\s+POLICY\s+"customer_insert_own_kyc"[\s\S]*?status\s+IN\s*\(\s*'Pending'\s*,\s*'Under Review'\s*\)/i.test(sqlNoComments)
  );

  // 2. Helper & RBAC Unit Tests
  console.log('\n--- 2. Error Classification & Role Matrix Tests ---');
  assert('isPermissionDeniedError detects SQLSTATE 42501', isPermissionDeniedError({ code: '42501', message: 'permission denied for table fraud_cases' }));
  assert('isPermissionDeniedError detects PGRST301', isPermissionDeniedError({ code: 'PGRST301', message: 'JWT expired' }));
  assert('isPermissionDeniedError detects HTTP 403', isPermissionDeniedError({ status: 403, message: 'Forbidden' }));
  assert('isPermissionDeniedError ignores network timeout', !isPermissionDeniedError({ code: 'ETIMEDOUT', message: 'network timeout' }));

  assert(
    'classifyErrorState maps authenticated 42501 -> restricted',
    classifyErrorState({ code: '42501', message: 'permission denied' }, true) === 'restricted'
  );
  assert(
    'classifyErrorState maps unauthenticated 42501 -> demo_session_rls',
    classifyErrorState({ code: '42501', message: 'permission denied' }, false) === 'demo_session_rls'
  );
  assert(
    'classifyErrorState maps generic DB error -> query_error',
    classifyErrorState({ code: '500', message: 'connection reset' }, true) === 'query_error'
  );

  assert('Telemetry status maps restricted -> RESTRICTED', mapResultStateToTelemetryStatus('restricted', 'fallback') === 'RESTRICTED');
  assert('Telemetry status maps demo_session_rls -> RESTRICTED', mapResultStateToTelemetryStatus('demo_session_rls', 'fallback') === 'RESTRICTED');
  assert('Telemetry status maps unconfigured -> UNAVAILABLE', mapResultStateToTelemetryStatus('unconfigured', 'unconfigured') === 'UNAVAILABLE');
  assert('Telemetry status maps query_error -> DEGRADED', mapResultStateToTelemetryStatus('query_error', 'fallback') === 'DEGRADED');
  assert('Telemetry status maps live_records/supabase -> OPERATIONAL', mapResultStateToTelemetryStatus('live_records', 'supabase') === 'OPERATIONAL');

  assert('Fraud telemetry authorized: SUPER_ADMIN, ADMIN, FINANCE_ANALYST',
    canRoleAccessFraudTelemetry('SUPER_ADMIN') &&
    canRoleAccessFraudTelemetry('ADMIN') &&
    canRoleAccessFraudTelemetry('FINANCE_ANALYST')
  );
  assert('Fraud telemetry denied: SUPPORT_EXECUTIVE, CUSTOMER',
    !canRoleAccessFraudTelemetry('SUPPORT_EXECUTIVE') &&
    !canRoleAccessFraudTelemetry('CUSTOMER')
  );
  assert('Institutional KYC authorized: staff roles, denied for CUSTOMER',
    canRoleAccessInstitutionalKyc('SUPPORT_EXECUTIVE') && !canRoleAccessInstitutionalKyc('CUSTOMER')
  );
  assert('Support telemetry authorized: SUPER_ADMIN, ADMIN, SUPPORT_EXECUTIVE',
    canRoleAccessSupportTelemetry('SUPER_ADMIN') &&
    canRoleAccessSupportTelemetry('ADMIN') &&
    canRoleAccessSupportTelemetry('SUPPORT_EXECUTIVE') &&
    !canRoleAccessSupportTelemetry('CUSTOMER')
  );

  // 3. Service Pre-Flight & 42501 Handling Tests (Mocked Supabase Client)
  console.log('\n--- 3. Service Pre-Flight & 42501 Handling Tests ---');

  let anonQueriedTable = false;
  const anonTrackingClient: any = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: () => {
      anonQueriedTable = true;
      return createMockSupabaseClient({ hasSession: false }).from();
    },
    rpc: async () => {
      anonQueriedTable = true;
      return { data: null, error: { code: '42501', message: 'permission denied' } };
    },
  };

  const { fetchKycRecordsResultFromDb, fetchKycAggregatesResultFromDb } = await import('../src/services/finovaDatabase');
  const anonFraud = await fetchFraudCasesResultFromDb('tenant_apex_bank', undefined, anonTrackingClient);
  const anonFraudAgg = await fetchFraudAggregatesResultFromDb('tenant_apex_bank', undefined, anonTrackingClient);
  const anonTxAgg = await fetchTransactionAggregatesResultFromDb('tenant_apex_bank', undefined, anonTrackingClient);
  const anonSupAgg = await fetchSupportAggregatesResultFromDb('tenant_apex_bank', undefined, anonTrackingClient);
  const anonKyc = await fetchKycRecordsResultFromDb('tenant_apex_bank', undefined, anonTrackingClient);
  const anonKycAgg = await fetchKycAggregatesResultFromDb('tenant_apex_bank', anonTrackingClient);
  const anonKpis = await fetchPlatformExecutiveKpis(anonTrackingClient);

  assert('Unauthenticated services skip table/RPC queries completely', !anonQueriedTable);
  assert(
    'Unauthenticated services return demo_session_rls cleanly',
    anonFraud.state === 'demo_session_rls' &&
      anonFraudAgg.state === 'demo_session_rls' &&
      anonTxAgg.state === 'demo_session_rls' &&
      anonSupAgg.state === 'demo_session_rls' &&
      anonKyc.state === 'demo_session_rls' &&
      anonKycAgg.state === 'demo_session_rls' &&
      anonKpis.state === 'demo_session_rls',
    `states=${JSON.stringify({ fraud: anonFraud.state, fraudAgg: anonFraudAgg.state, txAgg: anonTxAgg.state, supAgg: anonSupAgg.state, kyc: anonKyc.state, kycAgg: anonKycAgg.state, kpis: anonKpis.state })}`
  );

  const auth42501Client = createMockSupabaseClient({
    hasSession: true,
    errorCode: '42501',
    errorMessage: 'permission denied for table fraud_cases',
  });

  const authFraud = await fetchFraudCasesResultFromDb('tenant_apex_bank', undefined, auth42501Client);
  const authFraudAgg = await fetchFraudAggregatesResultFromDb('tenant_apex_bank', undefined, auth42501Client);
  const authTxAgg = await fetchTransactionAggregatesResultFromDb('tenant_apex_bank', undefined, auth42501Client);
  const authSupAgg = await fetchSupportAggregatesResultFromDb('tenant_apex_bank', undefined, auth42501Client);
  const authKyc = await fetchKycRecordsResultFromDb('tenant_apex_bank', undefined, auth42501Client);
  const authKycAgg = await fetchKycAggregatesResultFromDb('tenant_apex_bank', auth42501Client);
  const authKpis = await fetchPlatformExecutiveKpis(auth42501Client);

  assert(
    'Authenticated 42501 classifies as restricted (never query_error)',
    authFraud.state === 'restricted' &&
      authFraudAgg.state === 'restricted' &&
      authTxAgg.state === 'restricted' &&
      authSupAgg.state === 'restricted' &&
      authKyc.state === 'restricted' &&
      authKycAgg.state === 'restricted' &&
      authKpis.state === 'restricted',
    `states=${JSON.stringify({ fraud: authFraud.state, fraudAgg: authFraudAgg.state, txAgg: authTxAgg.state, supAgg: authSupAgg.state, kyc: authKyc.state, kycAgg: authKycAgg.state, kpis: authKpis.state })}`
  );

  // 4. Live Anon Connectivity & Boundary Probe (No private credentials required)
  console.log('\n--- 4. Live Anon Connectivity & Boundary Probe ---');
  if (isSupabaseConfigured()) {
    const conn = await checkSupabaseConnection();
    assert(
      'checkSupabaseConnection() succeeds cleanly as anon without querying restricted tables',
      conn.connected === true && conn.configured === true,
      `connected=${conn.connected}, msg=${conn.message}`
    );

    const { data: anonFraudRows, error: anonFraudErr } = await supabase
      .from('fraud_cases')
      .select('id')
      .limit(1);
    assert(
      'Live anon direct query on fraud_cases yields 0 rows or 42501 denial',
      Boolean(anonFraudErr) || (Array.isArray(anonFraudRows) && anonFraudRows.length === 0)
    );

    const { data: anonKycRows, error: anonKycErr } = await supabase
      .from('kyc_records')
      .select('id')
      .limit(1);
    assert(
      'Live anon direct query on kyc_records yields 0 rows or 42501 denial',
      Boolean(anonKycErr) || (Array.isArray(anonKycRows) && anonKycRows.length === 0)
    );

    const { error: anonRpcErr } = await supabase.rpc('get_fraud_aggregates', {
      p_tenant_id: 'tenant_apex_bank',
    });
    assert(
      'Live anon call to get_fraud_aggregates is rejected by DB',
      Boolean(anonRpcErr),
      anonRpcErr ? `${anonRpcErr.code}: ${anonRpcErr.message}` : 'unexpectedly succeeded'
    );
  } else {
    console.log('[INFO] Supabase env vars not configured in shell; skipped live anon probe.');
  }

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('================================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
