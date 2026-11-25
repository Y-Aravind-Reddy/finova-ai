import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { randomBytes } from 'node:crypto';
import {
  fetchSupportAggregatesResultFromDb,
  mapResultStateToTelemetryStatus,
  canRoleAccessSupportTelemetry,
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
  console.log('FINOVA AI — SUPPORT AGGREGATES 500 & VITE HMR FIX VERIFICATION');
  console.log('================================================================\n');

  // 1. SQL Static & Security Audit of 20261124_fix_support_aggregates_500.sql
  console.log('--- 1. SQL Hotfix Migration Static & Security Audit ---');
  const sqlPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261124_fix_support_aggregates_500.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const sqlNoComments = sql.replace(/--.*$/gm, '');
  const dollarTags = (sqlNoComments.match(/\$\$/g) || []).length;
  const policies = sqlNoComments.match(/CREATE\s+POLICY[\s\S]*?;/gi) || [];
  const usingTruePolicies = policies.filter((p) => /USING\s*\(\s*true\s*\)/i.test(p));
  const raiseExceptions = sqlNoComments.match(/RAISE\s+EXCEPTION[\s\S]*?;/gi) || [];
  const raiseWith42501 = raiseExceptions.filter((r) => /ERRCODE\s*=\s*'42501'/i.test(r));

  assert('Migration file exists', fs.existsSync(sqlPath));
  assert('Balanced $$ blocks', dollarTags > 0 && dollarTags % 2 === 0, `count=${dollarTags}`);
  assert('Zero destructive DROP TABLE / TRUNCATE / DISABLE RLS',
    !/\bDROP\s+TABLE\b/i.test(sqlNoComments) &&
      !/\bTRUNCATE\b/i.test(sqlNoComments) &&
      !/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sqlNoComments)
  );
  assert('Zero USING (true) policies', usingTruePolicies.length === 0);
  assert('All RAISE EXCEPTION blocks explicitly emit ERRCODE = 42501',
    raiseExceptions.length >= 5 && raiseExceptions.length === raiseWith42501.length,
    `${raiseWith42501.length}/${raiseExceptions.length}`
  );
  assert('Dynamic pg_policies cleanup loop reconciles legacy policies',
    /FOR\s+pol\s+IN[\s\S]*?FROM\s+pg_policies[\s\S]*?tablename\s*=\s*'support_tickets'/i.test(sqlNoComments)
  );
  assert('Authenticated table grants restored & anon revoked on support_tickets',
    /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.support_tickets\s+FROM\s+PUBLIC,\s*anon;/i.test(sqlNoComments) &&
      /GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+TABLE\s+public\.support_tickets\s+TO\s+authenticated;/i.test(sqlNoComments)
  );
  assert('Customer RLS enforces both auth.uid() and tenant_id isolation',
    /CREATE\s+POLICY\s+"customer_own_tickets"[\s\S]*?user_id\s*=\s*\(\s*SELECT\s+auth\.uid\(\)\s*\)\s*AND\s*tenant_id\s*=\s*\(\s*SELECT\s+public\.get_auth_tenant\(\)\s*\)/i.test(sqlNoComments)
  );
  assert('Single-pass MATERIALIZED CTE & window grand_total replaces correlated ct.total_cnt in categoryDistribution',
    /WITH\s+base_tickets\s+AS\s+MATERIALIZED\s*\(/i.test(sqlNoComments) &&
      /SUM\(COUNT\(\*\)\)\s+OVER\s*\(\)\s+AS\s+grand_total/i.test(sqlNoComments)
  );
  assert('Numeric precision widened (NUMERIC(10, 2)) & defensive text/numeric casts used',
    /NUMERIC\(10,\s*2\)/i.test(sqlNoComments) &&
      /status::text/i.test(sqlNoComments) &&
      /hours_open::text\s*~/i.test(sqlNoComments)
  );
  assert('SECURITY INVOKER + SET search_path = public, pg_temp + EXECUTE grants',
    /SECURITY\s+INVOKER[\s\S]*?SET\s+search_path\s*=\s*public,\s*pg_temp/i.test(sqlNoComments) &&
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.get_support_aggregates\(TEXT\)\s+FROM\s+PUBLIC,\s*anon;/i.test(sqlNoComments) &&
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_support_aggregates\(TEXT\)\s+TO\s+authenticated,\s*service_role;/i.test(sqlNoComments)
  );

  // Verify JSONB contract keys match frontend expectations
  const expectedKeys = [
    'totalTickets',
    'openCount',
    'closedCount',
    'inProgressCount',
    'pendingClientCount',
    'priorityDistribution',
    'categoryDistribution',
    'executiveWorkload',
    'slaCompliancePct',
    'averageCsat',
    'tenantScope',
    'callerRole',
    'source',
  ];
  assert(
    'SQL JSONB output contains all 13 canonical keys',
    expectedKeys.every((k) => sqlNoComments.includes(`'${k}'`))
  );

  // 2. Frontend Support Aggregates Service Contract & Error State Tests
  console.log('\n--- 2. Frontend Service Contract & HTTP 500 / RBAC Tests ---');
  const authSessionMock = {
    getSession: async () => ({
      data: { session: { user: { id: '00000000-0000-0000-0000-000000000001' } } },
      error: null,
    }),
  };

  let chunkFallbackCalled = false;
  const http500Client: any = {
    auth: authSessionMock,
    from: () => {
      chunkFallbackCalled = true;
      return { select: () => ({ range: async () => ({ data: [], error: null }) }) };
    },
    rpc: async () => ({
      data: null,
      error: { status: 500, message: 'Internal server error' },
    }),
  };
  const res500 = await fetchSupportAggregatesResultFromDb('tenant_apex_bank', undefined, http500Client);
  assert('HTTP 500 classifies cleanly as query_error -> DEGRADED',
    res500.state === 'query_error' &&
      mapResultStateToTelemetryStatus(res500.state, res500.source) === 'DEGRADED' &&
      res500.source === 'fallback' &&
      !chunkFallbackCalled,
    JSON.stringify(res500)
  );

  const res42501 = await fetchSupportAggregatesResultFromDb('tenant_apex_bank', undefined, {
    auth: authSessionMock,
    rpc: async () => ({
      data: null,
      error: { code: '42501', message: 'Access Denied: Role unauthorized' },
    }),
  });
  assert('SQLSTATE 42501 classifies as restricted -> RESTRICTED',
    res42501.state === 'restricted' &&
      mapResultStateToTelemetryStatus(res42501.state, res42501.source) === 'RESTRICTED'
  );

  const deniedCustomer = await fetchSupportAggregatesResultFromDb('tenant_apex_bank', undefined, {
    auth: authSessionMock,
    mockRole: 'CUSTOMER',
    rpc: async () => {
      throw new Error('Should not execute RPC for CUSTOMER');
    },
  });
  assert('CUSTOMER role gated before RPC call',
    deniedCustomer.state === 'restricted' && !canRoleAccessSupportTelemetry('CUSTOMER')
  );

  const okClient: any = {
    auth: authSessionMock,
    mockRole: 'SUPPORT_EXECUTIVE',
    rpc: async (fn: string, params: any) => {
      assert('RPC called with exact function name & p_tenant_id', fn === 'get_support_aggregates' && params?.p_tenant_id === 'tenant_apex_bank');
      return {
        data: {
          totalTickets: 42,
          openCount: 15,
          closedCount: 27,
          inProgressCount: 8,
          pendingClientCount: 3,
          priorityDistribution: [{ priority: 'High', count: 10 }],
          categoryDistribution: [{ category: 'Wire Delay', count: 21, percentage: 50.0 }],
          executiveWorkload: [{ executive: 'Alex Mercer', activeTickets: 5, resolvedTickets: 12 }],
          slaCompliancePct: 92.5,
          averageCsat: 4.85,
          tenantScope: 'tenant_apex_bank',
          callerRole: 'SUPPORT_EXECUTIVE',
          source: 'supabase_rpc_secure',
        },
        error: null,
      };
    },
  };
  const okRes = await fetchSupportAggregatesResultFromDb('tenant_apex_bank', undefined, okClient);
  assert('Valid RPC payload returns OPERATIONAL live_records',
    okRes.state === 'live_records' &&
      okRes.source === 'supabase' &&
      okRes.totalTickets === 42 &&
      okRes.averageCsat === 4.85 &&
      mapResultStateToTelemetryStatus(okRes.state, okRes.source) === 'OPERATIONAL'
  );

  // 3. Live Vite HMR Same-Origin WebSocket Verification
  console.log('\n--- 3. Vite HMR Same-Origin WebSocket Verification ---');
  const clientRes = await fetch('http://127.0.0.1:3000/@vite/client');
  const clientCode = await clientRes.text();
  const hmrPortNull = /const hmrPort = null;/.test(clientCode);
  const wsToken = clientCode.match(/const wsToken = "([^"]+)"/)?.[1];
  assert('/@vite/client sets hmrPort = null (no port 24678)', clientRes.ok && hmrPortNull && Boolean(wsToken));

  let upgradeStatus = 0;
  let upgradeProto = '';
  let firstMsg = '';
  await new Promise<void>((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: '/?token=' + wsToken,
      headers: {
        Host: 'localhost:3000',
        Origin: 'https://ais-dev-dvm7cp37tu7ipktvhb6bmt-971598154639.asia-southeast1.run.app',
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
        'Sec-WebSocket-Protocol': 'vite-hmr',
      },
    });
    req.on('upgrade', (res, socket) => {
      upgradeStatus = res.statusCode || 0;
      upgradeProto = String(res.headers['sec-websocket-protocol'] || '');
      socket.once('data', (buf) => {
        firstMsg = buf.toString('utf8').replace(/[^\x20-\x7e]/g, '');
        socket.destroy();
        resolve();
      });
      setTimeout(() => {
        socket.destroy();
        resolve();
      }, 1500);
    });
    req.on('response', (res) => reject(new Error(`Unexpected HTTP ${res.statusCode}`)));
    req.on('error', reject);
    req.end();
  });

  assert('Vite HMR WebSocket upgrades cleanly on port 3000 (101 Switching Protocols)',
    upgradeStatus === 101 && upgradeProto === 'vite-hmr' && firstMsg.includes('"type":"connected"'),
    `status=${upgradeStatus}, proto=${upgradeProto}, msg=${firstMsg}`
  );

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('================================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
