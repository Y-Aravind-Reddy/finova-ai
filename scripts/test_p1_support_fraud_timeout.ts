import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  clearTelemetryDiagnosticsForTest,
  getRecentTelemetryDiagnostics,
  getDefaultBoundedDateRange,
  fetchSupportAggregatesResultFromDb,
  fetchFraudAggregatesResultFromDb,
  fetchSupportTicketsResultFromDb,
  canRoleAccessFraudTelemetry,
  canRoleAccessSupportTelemetry,
  mapResultStateToTelemetryStatus,
} from '../src/services/finovaDatabase';

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
  console.log('FINOVA AI — P1 SUPPORT & FRAUD 57014 TIMEOUT REMEDIATION AUDIT');
  console.log('================================================================\n');

  // 1. Static SQL Audit of 20261126_p1_support_fraud_timeout_remediation.sql
  console.log('--- 1. Static SQL Audit of 20261126 Remediation Migration ---');
  const sqlPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261126_p1_support_fraud_timeout_remediation.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const sqlNoComments = sql.replace(/--.*$/gm, '');
  const dollarTags = (sqlNoComments.match(/\$\$/g) || []).length;
  const policies = sqlNoComments.match(/CREATE\s+POLICY[\s\S]*?;/gi) || [];
  const usingTruePolicies = policies.filter((p) => /USING\s*\(\s*true\s*\)/i.test(p));
  const raiseExceptions = sqlNoComments.match(/RAISE\s+EXCEPTION[\s\S]*?;/gi) || [];
  const raiseWith42501 = raiseExceptions.filter((r) => /ERRCODE\s*=\s*'42501'/i.test(r));

  assert('20261126 P1 remediation migration exists', fs.existsSync(sqlPath));
  assert('Balanced $$ blocks', dollarTags > 0 && dollarTags % 2 === 0, `count=${dollarTags}`);
  assert(
    'Zero destructive DDL, RLS disable, USING (true), or LATERAL joins',
    !/\bDROP\s+TABLE\b/i.test(sqlNoComments) &&
      !/\bTRUNCATE\b/i.test(sqlNoComments) &&
      !/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sqlNoComments) &&
      usingTruePolicies.length === 0 &&
      !/LEFT\s+JOIN\s+LATERAL/i.test(sqlNoComments)
  );
  assert(
    'All RAISE EXCEPTION guards emit SQLSTATE 42501',
    raiseExceptions.length >= 10 && raiseExceptions.length === raiseWith42501.length,
    `${raiseWith42501.length}/${raiseExceptions.length}`
  );
  assert(
    'Drops legacy 1-arg get_support_aggregates(TEXT) and creates 3-arg bounded signature',
    /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.get_support_aggregates\(TEXT\);/i.test(sqlNoComments) &&
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_support_aggregates\(\s*p_tenant_id\s+TEXT\s+DEFAULT\s+NULL,\s*p_start_date\s+DATE\s+DEFAULT\s+NULL,\s*p_end_date\s+DATE\s+DEFAULT\s+NULL\s*\)/i.test(
        sqlNoComments
      ) &&
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.get_support_aggregates\(TEXT,\s*DATE,\s*DATE\)\s+FROM\s+PUBLIC,\s*anon;/i.test(
        sqlNoComments
      ) &&
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_support_aggregates\(TEXT,\s*DATE,\s*DATE\)\s+TO\s+authenticated,\s*service_role;/i.test(
        sqlNoComments
      )
  );
  assert(
    'Support & Fraud covering composite indexes match query filters and projections',
    sqlNoComments.includes('idx_support_tickets_tenant_opened_cover') &&
      sqlNoComments.includes('idx_support_tickets_opened_cover') &&
      sqlNoComments.includes('idx_fraud_cases_tenant_ts_cover') &&
      sqlNoComments.includes('idx_fraud_cases_ts_cover') &&
      /ON\s+public\.support_tickets\s*\(tenant_id,\s*opened_at\s+DESC\)\s*INCLUDE/i.test(sqlNoComments) &&
      /ON\s+public\.fraud_cases\s*\(tenant_id,\s*timestamp\s+DESC\)\s*INCLUDE/i.test(sqlNoComments)
  );
  assert(
    'Support RPC uses sargable UTC opened_at predicates & single-pass GROUPING SETS',
    /opened_at\s*>=\s*\(p_start_date::timestamp\s+AT\s+TIME\s+ZONE\s+'UTC'\)/i.test(sqlNoComments) &&
      /opened_at\s*<\s*\(\(p_end_date\s*\+\s*1\)::timestamp\s+AT\s+TIME\s+ZONE\s+'UTC'\)/i.test(sqlNoComments) &&
      /GROUP\s+BY\s+GROUPING\s+SETS\s*\(\(\),\s*\(priority\),\s*\(category\),\s*\(executive\)\)/i.test(sqlNoComments)
  );
  assert(
    'Fraud RPC uses MATERIALIZED FX CTE (skipped for INR), status_bucket/risk_sort, and GROUPING SETS',
    /latest_fx\s+AS\s+MATERIALIZED/i.test(sqlNoComments) &&
      /TRIM\(fc\.currency\)\s*<>\s*'INR'/i.test(sqlNoComments) &&
      /status_bucket/i.test(sqlNoComments) &&
      /GROUP\s+BY\s+GROUPING\s+SETS\s*\(\(\),\s*\(currency\),\s*\(risk_sort\),\s*\(payment_channel\),\s*\(rule_triggered\),\s*\(case_date\)\)/i.test(
        sqlNoComments
      )
  );
  assert(
    'Both RPCs preserve SECURITY INVOKER and pg_policies InitPlan cleanup runs on both tables',
    (sqlNoComments.match(/SECURITY\s+INVOKER[\s\S]*?SET\s+search_path\s*=\s*public,\s*pg_temp/gi) || []).length === 2 &&
      /tablename\s*=\s*'support_tickets'/i.test(sqlNoComments) &&
      /tablename\s*=\s*'fraud_cases'/i.test(sqlNoComments)
  );

  // 2. Frontend Support Bounded Date Window, Explicit ALL & Legacy PGRST202 Compatibility Tests
  console.log('\n--- 2. Support Bounded Date Window, Explicit ALL & PGRST202 Tests ---');
  clearTelemetryDiagnosticsForTest();

  const authSessionMock = {
    getSession: async () => ({
      data: { session: { user: { id: '00000000-0000-0000-0000-000000000001' } } },
      error: null,
    }),
  };

  const supportCalls: { fn: string; params: any }[] = [];
  let supportSignalCaptured: AbortSignal | undefined;

  const makeRpcBuilder = (payload: any, onSignal?: (sig: AbortSignal) => void) => {
    const p = Promise.resolve(payload);
    const b: any = {
      abortSignal: (sig: AbortSignal) => {
        if (onSignal) onSignal(sig);
        return b;
      },
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return b;
  };

  const supportPayload = (tenant: string) => ({
    totalTickets: 25,
    openCount: 7,
    closedCount: 18,
    inProgressCount: 4,
    pendingClientCount: 1,
    priorityDistribution: [{ priority: 'High', count: 5 }],
    categoryDistribution: [{ category: 'Wire Delay', count: 25, percentage: 100 }],
    executiveWorkload: [{ executive: 'Elena Vance', activeTickets: 7, resolvedTickets: 18 }],
    slaCompliancePct: 96.0,
    averageCsat: 4.88,
    tenantScope: tenant,
    callerRole: 'ADMIN',
    source: 'supabase_rpc_secure',
  });

  const supportClient: any = {
    auth: authSessionMock,
    mockRole: 'ADMIN',
    rpc: (fn: string, params: any) => {
      supportCalls.push({ fn, params });
      return makeRpcBuilder({ data: supportPayload(params?.p_tenant_id || 'ALL'), error: null }, (sig) => {
        supportSignalCaptured = sig;
      });
    },
  };

  // Omitted options -> bounded 90D default (NOT ALL)
  const expected90d = getDefaultBoundedDateRange('90D');
  const supDefault = await fetchSupportAggregatesResultFromDb('tenant_apex_bank', undefined, supportClient);
  const lastDefaultParams = supportCalls[supportCalls.length - 1]?.params;
  assert(
    'Omitted Support options default to bounded 90D dates (never accidental ALL)',
    supDefault.state === 'live_records' &&
      lastDefaultParams?.p_tenant_id === 'tenant_apex_bank' &&
      lastDefaultParams?.p_start_date === expected90d.startDate &&
      lastDefaultParams?.p_end_date === expected90d.endDate
  );

  // Explicit 30D, 90D, YTD, ALL
  for (const preset of ['30D', '90D', 'YTD', 'ALL'] as const) {
    const r = getDefaultBoundedDateRange(preset);
    await fetchSupportAggregatesResultFromDb(
      'tenant_crest_capital',
      { startDate: r.startDate, endDate: r.endDate },
      supportClient
    );
    const p = supportCalls[supportCalls.length - 1]?.params;
    assert(
      `Support preset ${preset} passes exact RPC bounds (${r.startDate || 'NULL'}..${r.endDate || 'NULL'})`,
      p?.p_tenant_id === 'tenant_crest_capital' &&
        p?.p_start_date === (r.startDate || null) &&
        p?.p_end_date === (r.endDate || null)
    );
  }

  // AbortSignal & Dedupe checks
  const acSup = new AbortController();
  await fetchSupportAggregatesResultFromDb(
    'tenant_apex_bank',
    { startDate: '2026-01-01', endDate: '2026-11-24', signal: acSup.signal },
    supportClient
  );
  assert('Support RPC forwards AbortSignal', supportSignalCaptured === acSup.signal);

  const countBeforeDedupe = supportCalls.length;
  await Promise.all([
    fetchSupportAggregatesResultFromDb('tenant_apex_bank', { startDate: '2026-09-01', endDate: '2026-11-24' }, supportClient),
    fetchSupportAggregatesResultFromDb('tenant_apex_bank', { startDate: '2026-09-01', endDate: '2026-11-24' }, supportClient),
    fetchSupportAggregatesResultFromDb('tenant_apex_bank', { startDate: '2026-01-01', endDate: '2026-11-24' }, supportClient),
  ]);
  assert(
    'Support dedupeInFlight shares identical bounded range and isolates different date ranges',
    supportCalls.length - countBeforeDedupe === 2,
    `calls=${supportCalls.length - countBeforeDedupe}`
  );

  // Telemetry diagnostic should reflect numeric days for bounded calls and ALL only when explicit
  const supDiags = getRecentTelemetryDiagnostics().filter((d) => d.rpcName === 'get_support_aggregates');
  assert(
    'Support telemetry records bounded numeric days for default/preset calls and ALL only for explicit ALL',
    typeof supDiags[0]?.dateRangeDays === 'number' &&
      supDiags.some((d) => d.dateRangeDays === 'ALL') &&
      supDiags.some((d) => d.tenantScope === 'tenant_crest_capital')
  );

  // Backward-compat fallback test when remote DB has not deployed 3-arg signature yet (PGRST202)
  clearTelemetryDiagnosticsForTest();
  const compatCalls: any[] = [];
  const legacyCompatClient: any = {
    auth: authSessionMock,
    mockRole: 'SUPPORT_EXECUTIVE',
    rpc: (_fn: string, params: any) => {
      compatCalls.push(params);
      if ('p_start_date' in (params || {})) {
        return makeRpcBuilder({
          data: null,
          error: { code: 'PGRST202', message: 'Could not find function public.get_support_aggregates(p_end_date, p_start_date, p_tenant_id)' },
        });
      }
      return makeRpcBuilder({ data: supportPayload('tenant_apex_bank'), error: null });
    },
  };
  const compatRes = await fetchSupportAggregatesResultFromDb('tenant_apex_bank', undefined, legacyCompatClient);
  const compatDiags = getRecentTelemetryDiagnostics();
  assert(
    'Pre-migration PGRST202 cleanly retries legacy 1-arg RPC and logs ALL accurately',
    compatRes.state === 'live_records' &&
      compatCalls.length === 2 &&
      'p_start_date' in compatCalls[0] &&
      !('p_start_date' in compatCalls[1]) &&
      compatDiags[compatDiags.length - 1]?.dateRangeDays === 'ALL'
  );

  // Support ticket queue opened_at bounds
  let capturedGte: any = null;
  let capturedLte: any = null;
  const ticketListClient: any = {
    auth: authSessionMock,
    from: () => {
      const chain: any = {
        select: () => chain,
        order: () => chain,
        eq: () => chain,
        gte: (col: string, val: string) => {
          if (col === 'opened_at') capturedGte = val;
          return chain;
        },
        lte: (col: string, val: string) => {
          if (col === 'opened_at') capturedLte = val;
          return chain;
        },
        range: async () => ({ data: [], error: null, count: 0 }),
      };
      return chain;
    },
  };
  await fetchSupportTicketsResultFromDb(
    'tenant_apex_bank',
    { startDate: '2026-08-26', endDate: '2026-11-24' },
    ticketListClient
  );
  assert(
    'Support ticket queue forwards opened_at bounded timestamps',
    capturedGte === '2026-08-26T00:00:00.000Z' && capturedLte === '2026-11-24T23:59:59.999Z'
  );

  // 3. Fraud 30D / 90D / 328-day YTD / ALL + Multi-Tenant + RBAC Tests
  console.log('\n--- 3. Fraud 328-Day YTD, Multi-Tenant & RBAC Tests ---');
  clearTelemetryDiagnosticsForTest();
  const fraudCalls: { fn: string; params: any }[] = [];
  let fraudSignalCaptured: AbortSignal | undefined;

  const fraudClientForRole = (role: string): any => ({
    auth: authSessionMock,
    mockRole: role,
    rpc: (fn: string, params: any) => {
      fraudCalls.push({ fn, params });
      return makeRpcBuilder(
        {
          data: {
            totalCases: 412,
            flaggedCount: 120,
            frozenCount: 180,
            clearedCount: 112,
            preventedVolumeInr: 45800000,
            preventedVolumeUsd: 544784.11,
            preventedVolumeOriginal: 45800000,
            monitoredVolumeInr: 92400000,
            monitoredVolumeUsd: 1099084.1,
            volumeByCurrency: {},
            riskTierDistribution: [],
            channelDistribution: [],
            ruleDistribution: [],
            casesByDay: [],
            tenantScope: params?.p_tenant_id || 'GLOBAL_ALL_TENANTS',
            callerRole: role,
            source: 'supabase_rpc_secure',
          },
          error: null,
        },
        (sig) => {
          fraudSignalCaptured = sig;
        }
      );
    },
  });

  // Failing 328-day window reproduction: 2026-01-01..2026-11-24
  const acFraud = new AbortController();
  const fraud328 = await fetchFraudAggregatesResultFromDb(
    'tenant_apex_bank',
    { startDate: '2026-01-01', endDate: '2026-11-24', currency: 'ALL', signal: acFraud.signal },
    fraudClientForRole('FINANCE_ANALYST')
  );
  const p328 = fraudCalls[fraudCalls.length - 1]?.params;
  const f328Diag = getRecentTelemetryDiagnostics().slice(-1)[0];
  assert(
    'Fraud 328-day YTD call passes exact parameters and AbortSignal for FINANCE_ANALYST',
    fraud328.state === 'live_records' &&
      p328?.p_tenant_id === 'tenant_apex_bank' &&
      p328?.p_start_date === '2026-01-01' &&
      p328?.p_end_date === '2026-11-24' &&
      p328?.p_currency === null &&
      fraudSignalCaptured === acFraud.signal &&
      f328Diag?.dateRangeDays === 328
  );

  // Fraud 30D, 90D, ALL across two tenants (ADMIN)
  for (const tenant of ['tenant_apex_bank', 'tenant_crest_capital'] as const) {
    for (const preset of ['30D', '90D', 'ALL'] as const) {
      const r = getDefaultBoundedDateRange(preset);
      const res = await fetchFraudAggregatesResultFromDb(
        tenant,
        { startDate: r.startDate, endDate: r.endDate },
        fraudClientForRole('ADMIN')
      );
      const fp = fraudCalls[fraudCalls.length - 1]?.params;
      assert(
        `Fraud ADMIN ${tenant} preset ${preset} succeeds with accurate tenant & dates`,
        res.state === 'live_records' &&
          fp?.p_tenant_id === tenant &&
          fp?.p_start_date === (r.startDate || null) &&
          fp?.p_end_date === (r.endDate || null)
      );
    }
  }

  // RBAC isolation checks
  const deniedFraudSupport = await fetchFraudAggregatesResultFromDb(
    'tenant_apex_bank',
    { startDate: '2026-01-01', endDate: '2026-11-24' },
    fraudClientForRole('SUPPORT_EXECUTIVE')
  );
  const deniedSupportFinance = await fetchSupportAggregatesResultFromDb(
    'tenant_apex_bank',
    { startDate: '2026-01-01', endDate: '2026-11-24' },
    { auth: authSessionMock, mockRole: 'FINANCE_ANALYST', rpc: async () => ({ data: null, error: null }) }
  );
  assert(
    'RBAC blocks SUPPORT_EXECUTIVE from Fraud & FINANCE_ANALYST from Support cleanly',
    deniedFraudSupport.state === 'restricted' &&
      deniedSupportFinance.state === 'restricted' &&
      !canRoleAccessFraudTelemetry('SUPPORT_EXECUTIVE') &&
      !canRoleAccessSupportTelemetry('FINANCE_ANALYST')
  );

  const timeout57014Client: any = {
    auth: authSessionMock,
    mockRole: 'ADMIN',
    rpc: async () => ({
      data: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    }),
  };
  const timeoutRes = await fetchSupportAggregatesResultFromDb(
    'tenant_apex_bank',
    { startDate: '2026-09-01', endDate: '2026-11-24' },
    timeout57014Client
  );
  assert(
    'Support 57014 timeout preserves bounded day diagnostics and TIMEOUT status',
    timeoutRes.state === 'timeout' &&
      mapResultStateToTelemetryStatus(timeoutRes.state, timeoutRes.source) === 'TIMEOUT' &&
      String(timeoutRes.error).includes('85d')
  );

  // 4. Dashboard Static Integration Audit
  console.log('\n--- 4. Dashboard Support & Fraud Date Propagation Audit ---');
  const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf-8');
  const supDash = readSrc('src/components/dashboards/SupportExecutiveDashboard.tsx');
  const admDash = readSrc('src/components/dashboards/AdminDashboard.tsx');
  const saDash = readSrc('src/components/dashboards/SuperAdminDashboard.tsx');

  assert(
    'SupportExecutiveDashboard defaults to 90D bounded range and forwards dates to both queries',
    supDash.includes("useState<DateRangePreset>('90D')") &&
      supDash.includes("queryKey: ['support-agg', tenantId, dateRange]") &&
      supDash.includes("queryKey: ['support-tickets', tenantId, dateRange]") &&
      supDash.includes('startDate: dateRange.startDate')
  );
  assert(
    'AdminDashboard forwards filters.startDate & filters.endDate to get_support_aggregates and get_fraud_aggregates',
    admDash.includes("queryKey: ['support-aggregates', currentUser?.id, currentRole, tenantId, filters.startDate, filters.endDate]") &&
      admDash.includes('fetchSupportAggregatesResultFromDb(tenantId, {') &&
      admDash.includes('startDate: filters.startDate')
  );
  assert(
    'SuperAdminDashboard forwards dateRange to get_support_aggregates and get_fraud_aggregates',
    saDash.includes("queryKey: ['super-admin-support-agg', activeTenantId, dateRange]") &&
      saDash.includes('fetchSupportAggregatesResultFromDb(activeTenantId, {')
  );

  console.log('\n================================================================');
  console.log(`P1 VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('================================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
