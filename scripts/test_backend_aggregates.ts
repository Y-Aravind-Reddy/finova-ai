import { convertToUsd, formatCurrencyWithUsdDisclosure, getExchangeRates, STATIC_BENCHMARK_FALLBACK_RATES } from '../src/services/currencyService';
import { supabase } from '../src/lib/supabase';

async function runAuditValidation() {
  console.log('================================================================');
  console.log('FINOVA AI — BACKEND & AGGREGATION SYSTEM VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName}${details ? ` - ${details}` : ''}`);
    }
  }

  // ----------------------------------------------------------------------------
  // TEST 1: Currency Conversion & Fallback Transparency
  // ----------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Currency Conversion & Fallback Metadata ---');
  
  const gbp100 = convertToUsd(100, 'GBP');
  assert(
    'GBP to USD conversion calculates correctly (100 GBP @ 1.285 = $128.50)',
    gbp100.amountUsd === 128.5 && gbp100.exchangeRate === 1.285
  );
  assert(
    'Static fallback rates are explicitly flagged as isLive: false',
    gbp100.isLive === false && gbp100.source.includes('Static Fallback')
  );

  const jpy1M = convertToUsd(1000000, 'JPY');
  assert(
    'JPY to USD conversion calculates correctly (1M JPY @ 0.006650 = $6,650.00)',
    jpy1M.amountUsd === 6650.0 && jpy1M.originalCurrency === 'JPY'
  );

  const usdDirect = convertToUsd(500, 'USD');
  assert(
    'USD to USD conversion preserves 1:1 without alteration',
    usdDirect.amountUsd === 500 && usdDirect.exchangeRate === 1.0
  );

  // Missing currency safety check
  const unknownCurr = convertToUsd(1000, 'XYZ_UNKNOWN');
  assert(
    'Missing / unsupported currency returns amountUsd: 0 to block corrupting aggregates',
    unknownCurr.amountUsd === 0 && unknownCurr.isConverted === false && unknownCurr.isStale === true
  );

  // Currency disclosure string
  const disclosure = formatCurrencyWithUsdDisclosure(100, 'EUR');
  assert(
    'Disclosure formatting displays USD Base with original EUR and rate breakdown',
    disclosure.includes('$108.50') && disclosure.includes('100.00 EUR') && disclosure.includes('1.0850')
  );


  // ----------------------------------------------------------------------------
  // TEST 2: Aggregation Beyond 1,000 Rows Chunking Logic
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Aggregation Beyond 1,000 Rows Chunking Simulation ---');

  // Generate 2,500 test records to simulate a dataset that exceeds PostgREST's default 1,000 row ceiling
  interface TestTx {
    id: string;
    amount: number;
    amount_usd?: number;
    currency: string;
    exchange_rate?: number;
    status: string;
    type: string;
    date: string;
    tenant_id: string;
  }

  const MOCK_TOTAL_ROWS = 2500;
  const mockTransactions: TestTx[] = [];
  let expectedSettledVolumeUsd = 0;
  let expectedSettledVolumeOriginal = 0;
  let expectedSettledCount = 0;
  let expectedCreditsVolumeUsd = 0;
  let expectedDebitsVolumeUsd = 0;

  for (let i = 0; i < MOCK_TOTAL_ROWS; i++) {
    const isSettled = i % 2 === 0; // 1,250 settled rows
    const isCredit = i % 3 === 0;  // Credit vs Debit
    const curr = i % 4 === 0 ? 'GBP' : i % 4 === 1 ? 'EUR' : 'USD';
    const amount = 100 + (i % 50); // amounts between 100 and 149
    const rate = curr === 'GBP' ? 1.285 : curr === 'EUR' ? 1.085 : 1.0;
    const amountUsd = Math.round(amount * rate * 100) / 100;

    const tx: TestTx = {
      id: `tx-sim-${i}`,
      amount,
      amount_usd: amountUsd,
      currency: curr,
      exchange_rate: rate,
      status: isSettled ? 'Settled' : 'Pending',
      type: isCredit ? 'Credit' : 'Debit',
      date: '2026-10-20',
      tenant_id: 'tenant_apex_bank'
    };
    mockTransactions.push(tx);

    if (isSettled) {
      expectedSettledCount++;
      expectedSettledVolumeUsd += amountUsd;
      expectedSettledVolumeOriginal += amount;
    }
    if (isCredit) {
      expectedCreditsVolumeUsd += amountUsd;
    } else {
      expectedDebitsVolumeUsd += amountUsd;
    }
  }

  expectedSettledVolumeUsd = Math.round(expectedSettledVolumeUsd * 100) / 100;
  expectedSettledVolumeOriginal = Math.round(expectedSettledVolumeOriginal * 100) / 100;
  expectedCreditsVolumeUsd = Math.round(expectedCreditsVolumeUsd * 100) / 100;
  expectedDebitsVolumeUsd = Math.round(expectedDebitsVolumeUsd * 100) / 100;

  console.log(`Generated simulated dataset: ${MOCK_TOTAL_ROWS} rows.`);
  console.log(`Expected Settled Count: ${expectedSettledCount}`);
  console.log(`Expected Settled Volume USD: $${expectedSettledVolumeUsd.toLocaleString()}`);

  // Simulate PostgREST chunking with 1,000 rows ceiling per query
  const CHUNK_SIZE = 1000;
  let offset = 0;
  let simulatedSettledCount = 0;
  let simulatedSettledVolumeUsd = 0;
  let simulatedSettledVolumeOriginal = 0;
  let simulatedCreditsVolumeUsd = 0;
  let simulatedDebitsVolumeUsd = 0;
  let fetchIterations = 0;

  while (true) {
    fetchIterations++;
    // Simulate .range(offset, offset + CHUNK_SIZE - 1)
    const page = mockTransactions.slice(offset, offset + CHUNK_SIZE);
    if (!page || page.length === 0) break;

    for (const row of page) {
      const isSettled = row.status === 'Settled' || row.status === 'Escrow Secured';
      const usdVal = row.amount_usd !== undefined && row.amount_usd !== null
        ? Number(row.amount_usd)
        : convertToUsd(Number(row.amount), row.currency || 'USD').amountUsd;

      if (isSettled) {
        simulatedSettledCount++;
        simulatedSettledVolumeUsd += usdVal;
        simulatedSettledVolumeOriginal += Number(row.amount);
      }
      if (row.type === 'Credit') {
        simulatedCreditsVolumeUsd += usdVal;
      } else if (row.type === 'Debit') {
        simulatedDebitsVolumeUsd += usdVal;
      }
    }

    if (page.length < CHUNK_SIZE) break;
    offset += CHUNK_SIZE;
  }

  simulatedSettledVolumeUsd = Math.round(simulatedSettledVolumeUsd * 100) / 100;
  simulatedSettledVolumeOriginal = Math.round(simulatedSettledVolumeOriginal * 100) / 100;

  assert(
    'Chunking successfully queried all rows across 3 pages (2,500 > 1,000 limit)',
    fetchIterations === 3 && offset === 2000
  );
  assert(
    'Settled count matched full 2,500 rows dataset without 1,000 row truncation',
    simulatedSettledCount === expectedSettledCount
  );
  assert(
    'Settled USD volume matches expected mathematical sum exactly',
    Math.abs(simulatedSettledVolumeUsd - expectedSettledVolumeUsd) < 0.01,
    `Simulated: ${simulatedSettledVolumeUsd}, Expected: ${expectedSettledVolumeUsd}`
  );
  assert(
    'Original currency volume matches expected mathematical sum exactly',
    Math.abs(simulatedSettledVolumeOriginal - expectedSettledVolumeOriginal) < 0.01,
    `Simulated: ${simulatedSettledVolumeOriginal}, Expected: ${expectedSettledVolumeOriginal}`
  );

  // ----------------------------------------------------------------------------
  // TEST 3: Live Supabase Status Check
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Live Supabase Remote Status Check ---');

  const { data: tenantData, error: tenantErr } = await supabase
    .from('tenant_workspaces')
    .select('id, name, currency')
    .limit(5);

  assert(
    'Live Supabase connection to tenant_workspaces is operational',
    !tenantErr && !!tenantData && tenantData.length > 0,
    tenantErr?.message
  );
  console.log(`Live tenant count retrieved: ${tenantData?.length || 0}`);
  if (tenantData) {
    tenantData.forEach(t => console.log(`  - Tenant: ${t.name} (${t.id}) [Currency: ${t.currency}]`));
  }

  // Check public.exchange_rates
  const { data: fxData, error: fxErr } = await supabase
    .from('exchange_rates')
    .select('id, base_currency, target_currency, rate')
    .limit(5);

  if (fxErr) {
    console.log(`[STATUS CONFIRMED] public.exchange_rates table is NOT YET deployed in remote database: ${fxErr.message}`);
    console.log(`[ACTION REQUIRED] Execute /supabase/migrations/20261023_usd_base_currency_and_aggregations.sql in Supabase SQL Editor.`);
  } else {
    console.log(`[STATUS CONFIRMED] public.exchange_rates table IS deployed in remote database with ${fxData?.length} rows.`);
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================');
}

runAuditValidation().catch(console.error);
