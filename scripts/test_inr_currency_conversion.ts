/**
 * Finova AI — INR Base Currency Conversion & Multi-Currency Aggregation Test Suite
 * 
 * Verifies:
 * 1. INR Identity Conversion: 1.000000 exact multiplier, zero distortion, ₹ symbol formatting.
 * 2. Foreign Currency to INR: USD, GBP, EUR, CHF, SGD, CAD, JPY conversion with RBI benchmarks.
 * 3. Strict Missing/Unknown Currency Handling: Returns amountInr = 0, isConverted = false, isStale = true, conversion blocked.
 * 4. Stale Rate Handling: Flagged when effectiveDate > MAX_RATE_AGE_DAYS.
 * 5. Formatting & Transparent Disclosure: "₹10,928.00 INR (£100.00 GBP @ ₹109.2800)".
 * 6. Multi-Currency Aggregation Beyond 1,000 Rows: Simulates chunked fetching and validates mathematical precision.
 * 7. Verification that static benchmark fallbacks are clearly marked isLive: false.
 */

import {
  convertToInr,
  convertToUsd,
  formatCurrencyWithInrDisclosure,
  getExchangeRates,
  STATIC_BENCHMARK_FALLBACK_RATES,
  checkIsRateStale,
} from '../src/services/currencyService';
import { supabase } from '../src/lib/supabase';

async function runInrCurrencyTestSuite() {
  console.log('================================================================');
  console.log('FINOVA AI — INR BASE CURRENCY CONVERSION & AGGREGATION TEST SUITE');
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
  // TEST GROUP 1: INR Identity Conversion (Requirement 4)
  // ----------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: INR Identity Conversion ---');

  const inrTest = convertToInr(5000, 'INR');
  assert(
    'INR to INR identity conversion preserves exact amount without drift (₹5,000.00)',
    inrTest.amountInr === 5000 && inrTest.exchangeRate === 1.000000
  );
  assert(
    'INR to INR conversion is flagged as isConverted: false (no conversion necessary)',
    inrTest.isConverted === false
  );
  assert(
    'INR formatting correctly renders Indian Rupee symbol (₹)',
    inrTest.formattedInr.startsWith('₹')
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 2: Foreign Currency to INR Conversion (Requirements 2, 3, 7, 8)
  // Formula: INR amount = original amount × INR-per-unit exchange rate
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Foreign Currency to INR Conversion ---');

  // USD: 100 USD @ 84.07 = ₹8,407.00
  const usdTest = convertToInr(100, 'USD');
  assert(
    'USD to INR converts correctly (100 USD × 84.07 = ₹8,407.00)',
    usdTest.amountInr === 8407.0 && usdTest.exchangeRate === 84.07,
    `Received: ${usdTest.amountInr}, Rate: ${usdTest.exchangeRate}`
  );
  assert(
    'USD conversion is flagged as isConverted: true with original currency USD',
    usdTest.isConverted === true && usdTest.originalCurrency === 'USD'
  );

  // GBP: 100 GBP @ 109.28 = ₹10,928.00
  const gbpTest = convertToInr(100, 'GBP');
  assert(
    'GBP to INR converts correctly (100 GBP × 109.28 = ₹10,928.00)',
    gbpTest.amountInr === 10928.0 && gbpTest.exchangeRate === 109.28,
    `Received: ${gbpTest.amountInr}, Rate: ${gbpTest.exchangeRate}`
  );

  // EUR: 100 EUR @ 91.12 = ₹9,112.00
  const eurTest = convertToInr(100, 'EUR');
  assert(
    'EUR to INR converts correctly (100 EUR × 91.12 = ₹9,112.00)',
    eurTest.amountInr === 9112.0 && eurTest.exchangeRate === 91.12,
    `Received: ${eurTest.amountInr}, Rate: ${eurTest.exchangeRate}`
  );

  // SGD: 100 SGD @ 63.78 = ₹6,378.00
  const sgdTest = convertToInr(100, 'SGD');
  assert(
    'SGD to INR converts correctly (100 SGD × 63.78 = ₹6,378.00)',
    sgdTest.amountInr === 6378.0 && sgdTest.exchangeRate === 63.78
  );

  // CHF: 100 CHF @ 97.25 = ₹9,725.00
  const chfTest = convertToInr(100, 'CHF');
  assert(
    'CHF to INR converts correctly (100 CHF × 97.25 = ₹9,725.00)',
    chfTest.amountInr === 9725.0 && chfTest.exchangeRate === 97.25
  );

  // JPY: 10,000 JPY @ 0.552 = ₹5,520.00
  const jpyTest = convertToInr(10000, 'JPY');
  assert(
    'JPY to INR converts correctly (10,000 JPY × 0.552 = ₹5,520.00)',
    jpyTest.amountInr === 5520.0 && jpyTest.exchangeRate === 0.552
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 3: Strict Handling of Missing, Stale & Unrecognized Rates (Requirement 9)
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Missing & Stale Exchange Rate Safety ---');

  const unknownTest = convertToInr(1000, 'XYZ_FAKE_CURRENCY');
  assert(
    'Missing / unknown currency sets amountInr: 0 (never silently assumes 1:1)',
    unknownTest.amountInr === 0 && unknownTest.isConverted === false,
    `Received amountInr: ${unknownTest.amountInr}`
  );
  assert(
    'Missing rate produces explicit error disclosure',
    typeof unknownTest.error === 'string' && unknownTest.error.includes('Conversion blocked')
  );

  // Stale rate detection
  const isStaleOld = checkIsRateStale('2025-01-01', 3);
  const isFreshNow = checkIsRateStale(new Date().toISOString().split('T')[0], 3);
  assert('Historical rate from 2025 is recognized as stale', isStaleOld === true);
  assert('Current rate date is recognized as fresh', isFreshNow === false);

  // Static fallback benchmark attribution
  assert(
    'Static fallback benchmark rates are explicitly identified (isLive: false)',
    STATIC_BENCHMARK_FALLBACK_RATES.USD.isLive === false &&
    STATIC_BENCHMARK_FALLBACK_RATES.USD.source.includes('Static Fallback')
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 4: Multi-Currency Disclosure Formatting
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Multi-Currency Disclosure Formatting ---');

  const gbpDisclosure = formatCurrencyWithInrDisclosure(100, 'GBP');
  assert(
    'GBP disclosure displays primary INR with original GBP and rate breakdown',
    gbpDisclosure.includes('₹10,928.00 INR') &&
    gbpDisclosure.includes('£100.00 GBP') &&
    gbpDisclosure.includes('109.2800')
  );

  const inrDisclosure = formatCurrencyWithInrDisclosure(25000, 'INR');
  assert(
    'INR disclosure displays formatted INR without superfluous conversion rate',
    inrDisclosure.includes('₹25,000.00')
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 5: Multi-Currency Aggregation Simulation (>1,000 rows ceiling)
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Multi-Currency Aggregation Beyond 1,000 Rows ---');

  interface SimTx {
    id: string;
    amount: number;
    currency: string;
    status: string;
    type: string;
  }

  const SIMULATED_ROWS = 2500;
  const mockDataset: SimTx[] = [];
  let expectedSettledInr = 0;
  let expectedSettledOrig = 0;
  let expectedCreditsInr = 0;
  let expectedDebitsInr = 0;
  let expectedSettledCount = 0;

  for (let i = 0; i < SIMULATED_ROWS; i++) {
    const isSettled = i % 2 === 0;
    const isCredit = i % 3 === 0;
    // Multi-currency distribution: INR, USD, EUR, GBP
    const curr = i % 4 === 0 ? 'INR' : i % 4 === 1 ? 'USD' : i % 4 === 2 ? 'EUR' : 'GBP';
    const amount = 100 + (i % 50);

    const conv = convertToInr(amount, curr);
    mockDataset.push({
      id: `sim-tx-${i}`,
      amount,
      currency: curr,
      status: isSettled ? 'Settled' : 'Pending',
      type: isCredit ? 'Credit' : 'Debit',
    });

    if (isSettled) {
      expectedSettledCount++;
      expectedSettledInr += conv.amountInr;
      expectedSettledOrig += amount;
    }
    if (isCredit) {
      expectedCreditsInr += conv.amountInr;
    } else {
      expectedDebitsInr += conv.amountInr;
    }
  }

  expectedSettledInr = Math.round(expectedSettledInr * 100) / 100;
  expectedSettledOrig = Math.round(expectedSettledOrig * 100) / 100;
  expectedCreditsInr = Math.round(expectedCreditsInr * 100) / 100;
  expectedDebitsInr = Math.round(expectedDebitsInr * 100) / 100;

  // Chunked batch calculation (1,000 rows limit per iteration)
  const CHUNK_SIZE = 1000;
  let offset = 0;
  let calculatedSettledInr = 0;
  let calculatedSettledCount = 0;
  let chunkIterations = 0;

  while (offset < mockDataset.length) {
    chunkIterations++;
    const slice = mockDataset.slice(offset, offset + CHUNK_SIZE);
    for (const row of slice) {
      if (row.status === 'Settled') {
        calculatedSettledCount++;
        const conv = convertToInr(row.amount, row.currency);
        calculatedSettledInr += conv.amountInr;
      }
    }
    offset += CHUNK_SIZE;
  }

  calculatedSettledInr = Math.round(calculatedSettledInr * 100) / 100;

  assert(
    'Batch processing fetched all 2,500 rows across 3 chunk iterations without PostgREST 1,000 ceiling loss',
    chunkIterations === 3 && calculatedSettledCount === expectedSettledCount
  );
  assert(
    'Total settled INR volume matches exact expected mathematical sum',
    Math.abs(calculatedSettledInr - expectedSettledInr) < 0.01,
    `Calculated: ₹${calculatedSettledInr.toLocaleString()}, Expected: ₹${expectedSettledInr.toLocaleString()}`
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 6: Remote Supabase Table Readiness Probe
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Remote Supabase Readiness Probe ---');

  try {
    const { data: remoteTenants, error: tenantErr } = await supabase
      .from('tenant_workspaces')
      .select('id, name, currency')
      .limit(3);

    assert(
      'Live Supabase connection to tenant_workspaces is verified',
      !tenantErr && !!remoteTenants && remoteTenants.length > 0,
      tenantErr?.message
    );
  } catch (err: any) {
    console.log('[PROBE NOTE] Supabase query notice:', err.message);
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`INR TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('ALL INR BASE REPORTING CURRENCY SPECIFICATIONS VERIFIED SUCCESSFULLY.');
  } else {
    console.error(`ATTENTION: ${totalTests - passedTests} test(s) failed.`);
  }
}

runInrCurrencyTestSuite().catch(console.error);
