const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rjudrmnnpwlovpkbwnte.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3hp2j-QZRSmCZl49MQ6H3A_cvhzv6_R';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function probe() {
  const { data, error } = await sb.from('exchange_rates').select('*');
  console.log('exchange_rates table probe:', error ? error.message : data);

  const { data: txSample, error: txErr } = await sb.from('transactions').select('*').limit(1);
  console.log('transactions sample probe:', txErr ? txErr.message : txSample);
}

probe().catch(console.error);
