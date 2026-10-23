/**
 * Finova AI — Production Supabase Data Accuracy Probe
 * Read-only inspection of the actual production tables, columns, rows, counts, and tenant values.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rjudrmnnpwlovpkbwnte.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3hp2j-QZRSmCZl49MQ6H3A_cvhzv6_R';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runProbe() {
  console.log('==============================================================================');
  console.log('FINOVA AI — PRODUCTION SUPABASE DATA ACCURACY PROBE (READ-ONLY)');
  console.log('URL: ' + SUPABASE_URL);
  console.log('Time: ' + new Date().toISOString());
  console.log('==============================================================================\n');

  // 1. TENANT WORKSPACES (Publicly accessible via anon policy)
  console.log('--- 1. public.tenant_workspaces ---');
  const { data: tenants, error: tErr } = await sb
    .from('tenant_workspaces')
    .select('id, name, short_name, type, status, plan, mrr, currency, currency_symbol, headquarters, license_no, admin_email, users_count, transaction_volume_ytd, compliance_score');
  
  if (tErr) {
    console.log('Error querying tenant_workspaces:', tErr.message);
  } else {
    console.log(`Found ${tenants.length} tenant workspaces in database:`);
    tenants.forEach((t) => {
      console.log(`  - [${t.id}] ${t.name} (${t.status}) | MRR: $${t.mrr} | Currency: ${t.currency} (${t.currency_symbol}) | UsersCount: ${t.users_count} | VolYTD: $${t.transaction_volume_ytd} | Compliance: ${t.compliance_score}%`);
    });
  }

  // 2. CHECK TABLE METADATA VIA POSTGREST HEAD/EXACT COUNT
  console.log('\n--- 2. Public Tables Exact Counts via Anon Client ---');
  const tables = ['tenant_workspaces', 'profiles', 'transactions', 'fraud_cases', 'support_tickets', 'kyc_records', 'audit_logs'];
  for (const tbl of tables) {
    const { count, error, status } = await sb.from(tbl).select('*', { count: 'exact', head: true });
    console.log(`  Table "${tbl}": Status=${status}, Exact Count (anon)=${count}, Error=${error ? error.message : 'none'}`);
  }

  // 3. CHECK KNOWN TEST CUSTOMER AUTHENTICATION (from previous signup test)
  console.log('\n--- 3. Authenticated Customer Query Check ---');
  // Attempt to sign in with the test user created during the previous turn
  const testEmail = 'verify_test_customer@finova.ai';
  // Let's check auth.getSession
  const { data: sessionData } = await sb.auth.getSession();
  console.log('Current local session in client:', sessionData?.session ? 'Active' : 'Null (Expected for clean Node instance)');

  // 4. TEST RPC / HELPER FUNCTIONS
  console.log('\n--- 4. Helper Function Invocations ---');
  const roleCall = await sb.rpc('get_auth_role');
  console.log('rpc get_auth_role():', roleCall.error ? 'Error: ' + roleCall.error.message : roleCall.data);

  const tenantCall = await sb.rpc('get_auth_tenant');
  console.log('rpc get_auth_tenant():', tenantCall.error ? 'Error: ' + tenantCall.error.message : tenantCall.data);

  console.log('\n==============================================================================');
  console.log('PROBE COMPLETED');
  console.log('==============================================================================');
}

runProbe().catch(console.error);
