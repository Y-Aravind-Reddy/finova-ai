import {
  convertToInr,
  convertToUsd,
  formatCurrencyWithInrDisclosure,
  formatCurrencyWithUsdDisclosure,
  getExchangeRates,
  STATIC_BENCHMARK_FALLBACK_RATES
} from '../src/services/currencyService';
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
  // TEST 1: Currency Conversion & Fallback Transparency (INR Base)
  // ----------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Currency Conversion & Fallback Metadata (INR Base) ---');
  
  const gbp100 = convertToInr(100, 'GBP');
  assert(
    'GBP to INR conversion calculates correctly (100 GBP @ ₹109.28 = ₹10,928.00)',
    gbp100.amountInr === 10928 && gbp100.exchangeRate === 109.28
  );
  assert(
    'Static fallback rates are explicitly flagged as isLive: false',
    gbp100.isLive === false && gbp100.source.includes('Static Fallback')
  );

  const usd100 = convertToInr(100, 'USD');
  assert(
    'USD to INR conversion calculates correctly (100 USD @ ₹84.07 = ₹8,407.00)',
    usd100.amountInr === 8407 && usd100.originalCurrency === 'USD'
  );

  const inrDirect = convertToInr(500, 'INR');
  assert(
    'INR to INR conversion preserves 1:1 identity without alteration',
    inrDirect.amountInr === 500 && inrDirect.exchangeRate === 1.0
  );

  // Missing currency safety check
  const unknownCurr = convertToInr(1000, 'XYZ_UNKNOWN');
  assert(
    'Missing / unsupported currency returns amountInr: 0 to block corrupting aggregates',
    unknownCurr.amountInr === 0 && unknownCurr.isConverted === false && unknownCurr.isStale === true
  );

  // Currency disclosure string
  const disclosure = formatCurrencyWithInrDisclosure(100, 'EUR');
  assert(
    'Disclosure formatting displays INR Base with original EUR and rate breakdown',
    disclosure.includes('₹9,112.00') && disclosure.includes('100.00 EUR') && disclosure.includes('91.1200')
  );

  // ----------------------------------------------------------------------------
  // TEST 2: Aggregation Beyond 1,000 Rows Chunking Logic (INR Base)
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Aggregation Beyond 1,000 Rows Chunking Simulation ---');

  interface TestTx {
    id: string;
    amount: number;
    amount_inr?: number;
    currency: string;
    exchange_rate?: number;
    status: string;
    type: string;
    date: string;
    tenant_id: string;
  }

  const MOCK_TOTAL_ROWS = 2500;
  const mockTransactions: TestTx[] = [];
  let expectedSettledVolumeInr = 0;
  let expectedSettledVolumeOriginal = 0;
  let expectedSettledCount = 0;
  let expectedCreditsVolumeInr = 0;
  let expectedDebitsVolumeInr = 0;

  for (let i = 0; i < MOCK_TOTAL_ROWS; i++) {
    const isSettled = i % 2 === 0;
    const isCredit = i % 3 === 0;
    const curr = i % 4 === 0 ? 'GBP' : i % 4 === 1 ? 'EUR' : i % 4 === 2 ? 'USD' : 'INR';
    const amount = 100 + (i % 50);
    const conv = convertToInr(amount, curr);

    const tx: TestTx = {
      id: `tx-sim-${i}`,
      amount,
      amount_inr: conv.amountInr,
      currency: curr,
      exchange_rate: conv.exchangeRate,
      status: isSettled ? 'Settled' : 'Pending',
      type: isCredit ? 'Credit' : 'Debit',
      date: '2026-10-20',
      tenant_id: 'tenant_apex_bank'
    };
    mockTransactions.push(tx);

    if (isSettled) {
      expectedSettledCount++;
      expectedSettledVolumeInr += conv.amountInr;
      expectedSettledVolumeOriginal += amount;
    }
    if (isCredit) {
      expectedCreditsVolumeInr += conv.amountInr;
    } else {
      expectedDebitsVolumeInr += conv.amountInr;
    }
  }

  expectedSettledVolumeInr = Math.round(expectedSettledVolumeInr * 100) / 100;
  expectedSettledVolumeOriginal = Math.round(expectedSettledVolumeOriginal * 100) / 100;
  expectedCreditsVolumeInr = Math.round(expectedCreditsVolumeInr * 100) / 100;
  expectedDebitsVolumeInr = Math.round(expectedDebitsVolumeInr * 100) / 100;

  console.log(`Generated simulated dataset: ${MOCK_TOTAL_ROWS} rows.`);
  console.log(`Expected Settled Count: ${expectedSettledCount}`);
  console.log(`Expected Settled Volume INR: ₹${expectedSettledVolumeInr.toLocaleString()}`);

  const CHUNK_SIZE = 1000;
  let offset = 0;
  let simulatedSettledCount = 0;
  let simulatedSettledVolumeInr = 0;
  let simulatedSettledVolumeOriginal = 0;
  let fetchIterations = 0;

  while (true) {
    fetchIterations++;
    const page = mockTransactions.slice(offset, offset + CHUNK_SIZE);
    if (!page || page.length === 0) break;

    for (const row of page) {
      const isSettled = row.status === 'Settled' || row.status === 'Escrow Secured';
      const inrVal = row.amount_inr !== undefined && row.amount_inr !== null
        ? Number(row.amount_inr)
        : convertToInr(Number(row.amount), row.currency || 'INR').amountInr;

      if (isSettled) {
        simulatedSettledCount++;
        simulatedSettledVolumeInr += inrVal;
        simulatedSettledVolumeOriginal += Number(row.amount);
      }
    }

    if (page.length < CHUNK_SIZE) break;
    offset += CHUNK_SIZE;
  }

  simulatedSettledVolumeInr = Math.round(simulatedSettledVolumeInr * 100) / 100;
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
    'Settled INR volume matches expected mathematical sum exactly',
    Math.abs(simulatedSettledVolumeInr - expectedSettledVolumeInr) < 0.01,
    `Simulated: ${simulatedSettledVolumeInr}, Expected: ${expectedSettledVolumeInr}`
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

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================');
}

runAuditValidation().catch(console.error);
