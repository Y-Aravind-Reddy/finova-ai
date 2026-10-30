import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rjudrmnnpwlovpkbwnte.supabase.co';
const supabaseKey = 'sb_publishable_3hp2j-QZRSmCZl49MQ6H3A_cvhzv6_R';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- Checking Supabase Tables (Anon / Public Role) ---');
  const tables = ['transactions', 'fraud_cases', 'support_tickets', 'kyc_records', 'tenant_workspaces', 'profiles', 'exchange_rates'];
  
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ ${table}: Error ${error.code} - ${error.message} (${error.details || ''})`);
    } else {
      console.log(`✅ ${table}: count = ${count}`);
    }
  }

  // Check sample records
  console.log('\n--- Checking sample records from transactions ---');
  const txRes = await supabase.from('transactions').select('*').limit(3);
  if (txRes.error) {
    console.log('Error fetching transactions:', txRes.error);
  } else {
    console.log(`Fetched ${txRes.data.length} transactions. Sample columns:`, Object.keys(txRes.data[0] || {}));
    if (txRes.data.length > 0) {
      console.log('Sample record 1:', txRes.data[0]);
    }
  }

  console.log('\n--- Checking distinct tenants in transactions ---');
  const txTenants = await supabase.from('transactions').select('tenant_id, tenant_name').limit(10);
  console.log('Tx tenants sample:', txTenants.data);

  console.log('\n--- Checking sample records from fraud_cases ---');
  const fcRes = await supabase.from('fraud_cases').select('*').limit(3);
  if (fcRes.error) {
    console.log('Error fetching fraud_cases:', fcRes.error);
  } else {
    console.log(`Fetched ${fcRes.data.length} fraud cases. Sample columns:`, Object.keys(fcRes.data[0] || {}));
    if (fcRes.data.length > 0) {
      console.log('Sample fraud case 1:', fcRes.data[0]);
    }
  }

  console.log('\n--- Checking sample records from support_tickets ---');
  const stRes = await supabase.from('support_tickets').select('*').limit(3);
  if (stRes.error) {
    console.log('Error fetching support_tickets:', stRes.error);
  } else {
    console.log(`Fetched ${stRes.data.length} support tickets. Sample columns:`, Object.keys(stRes.data[0] || {}));
    if (stRes.data.length > 0) {
      console.log('Sample support ticket 1:', stRes.data[0]);
    }
  }

  console.log('\n--- Checking tenant_workspaces ---');
  const twRes = await supabase.from('tenant_workspaces').select('*');
  if (twRes.error) {
    console.log('Error fetching tenant_workspaces:', twRes.error);
  } else {
    console.log(`Fetched ${twRes.data.length} workspaces:`, twRes.data.map((w: any) => ({ id: w.id, name: w.name, code: w.code })));
  }

  console.log('\n--- Checking profiles ---');
  const profRes = await supabase.from('profiles').select('*').limit(10);
  if (profRes.error) {
    console.log('Error fetching profiles:', profRes.error);
  } else {
    console.log(`Fetched ${profRes.data.length} profiles:`, profRes.data.map((p: any) => ({ id: p.id, email: p.email, role: p.role, tenant_id: p.tenant_id })));
  }
}

run().catch(console.error);
