import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rjudrmnnpwlovpkbwnte.supabase.co';
const supabaseKey = 'sb_publishable_3hp2j-QZRSmCZl49MQ6H3A_cvhzv6_R';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogins() {
  const testAccounts = [
    { email: 'aravindvicky629@gmail.com', pass: 'finova2026' },
    { email: 'superadmin@finova.ai', pass: 'finova2026' },
    { email: 'admin@finova.ai', pass: 'finova2026' },
    { email: 'analyst@finova.ai', pass: 'finova2026' },
    { email: 'support@finova.ai', pass: 'finova2026' },
    { email: 'customer@croftcapital.com', pass: 'finova2026' }
  ];

  for (const acc of testAccounts) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: acc.email,
      password: acc.pass,
    });
    if (error) {
      console.log(`Login ${acc.email}: FAILED -> ${error.message}`);
    } else {
      console.log(`Login ${acc.email}: SUCCESS -> uid: ${data.user?.id}`);
      // Now test querying tables with this user's token!
      const userClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${data.session?.access_token}` } }
      });
      const txCount = await userClient.from('transactions').select('*', { count: 'exact', head: true });
      const fcCount = await userClient.from('fraud_cases').select('*', { count: 'exact', head: true });
      const stCount = await userClient.from('support_tickets').select('*', { count: 'exact', head: true });
      console.log(`   Data visible: transactions=${txCount.count}, fraud_cases=${fcCount.count}, support_tickets=${stCount.count}`);
      await supabase.auth.signOut();
    }
  }
}

testLogins().catch(console.error);
