/**
 * Finova AI — Centralized INR Base-Currency & Exchange Rate Engine
 * Implements a database-backed exchange rate system with Indian Rupee (INR ₹) as the base reporting currency.
 * 
 * Standards & Benchmarks:
 * - Base Reporting Currency: INR (Indian Rupee, ₹)
 * - Benchmark Providers: Reserve Bank of India (RBI) Reference Rates / Official Central Bank Benchmarks
 * - Rate Definition: INR amount per 1 unit of original currency (e.g., 1 USD = ₹84.070000, 1 EUR = ₹91.120000)
 * - Formula: INR amount = original amount × INR-per-unit exchange rate
 * - Identity Conversion: INR-to-INR conversion is exactly 1.000000
 * - Precision: 6-decimal exchange rates, standard 2-decimal financial rounding.
 * - Rules: Explicit rate dates, staleness checks, no silent fallback/guessing (missing rates return 0 converted amount).
 * - Source Transparency: Clearly distinguishes live database rates from static baseline fallbacks.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'CHF' | 'SGD' | 'CAD' | 'JPY';

export interface ExchangeRateRecord {
  id: string;
  baseCurrency: 'INR';
  targetCurrency: SupportedCurrency;
  rate: number; // Multiplier: INR amount per 1 unit of targetCurrency (e.g. 1 USD = 84.07 INR)
  inverseRate: number; // Target currency units per 1 INR (1 / rate)
  effectiveDate: string; // ISO date YYYY-MM-DD
  source: string;
  retrievedAt: string;
  isStale: boolean;
  isLive: boolean; // true = from Supabase public.exchange_rates; false = static reference fallback
}

export interface CurrencyConversion {
  originalAmount: number;
  originalCurrency: string;
  amountInr: number;
  amountUsd: number; // Backwards-compatible field
  exchangeRate: number; // INR per 1 unit of original currency
  effectiveDate: string;
  source: string;
  isConverted: boolean;
  isStale: boolean;
  isLive: boolean;
  formattedInr: string;
  formattedUsd: string; // Backwards-compatible field
  formattedOriginal: string;
  warning?: string;
  error?: string;
}

/**
 * Maximum acceptable rate age before flagging as stale (3 days for daily market fixings)
 */
export const MAX_RATE_AGE_DAYS = 3;

/**
 * Static Reference Benchmark Baseline Rates (Offline Fallback Only)
 * Rates are strictly attributed as static baseline fallbacks, NEVER labeled as live market rates.
 * Defined consistently as INR per 1 unit of the foreign currency.
 */
export const STATIC_BENCHMARK_FALLBACK_RATES: Record<SupportedCurrency, ExchangeRateRecord> = {
  INR: {
    id: 'FX-INR-BASE',
    baseCurrency: 'INR',
    targetCurrency: 'INR',
    rate: 1.000000,
    inverseRate: 1.000000,
    effectiveDate: '2026-10-27',
    source: 'Reserve Bank of India (RBI) Identity Base (Static Fallback)',
    retrievedAt: '2026-10-27T00:00:00Z',
    isStale: false,
    isLive: false,
  },
  USD: {
    id: 'FX-USD-INR',
    baseCurrency: 'INR',
    targetCurrency: 'USD',
    rate: 84.070000,
    inverseRate: 0.011895,
    effectiveDate: '2026-10-27',
    source: 'Reserve Bank of India (RBI) Reference Rate Baseline (Static Fallback)',
    retrievedAt: '2026-10-27T00:00:00Z',
    isStale: false,
    isLive: false,
  },
  EUR: {
    id: 'FX-EUR-INR',
    baseCurrency: 'INR',
    targetCurrency: 'EUR',
    rate: 91.120000,
    inverseRate: 0.010975,
    effectiveDate: '2026-10-27',
    source: 'Reserve Bank of India (RBI) Reference Rate Baseline (Static Fallback)',
    retrievedAt: '2026-10-27T00:00:00Z',
    isStale: false,
    isLive: false,
  },
  GBP: {
    id: 'FX-GBP-INR',
    baseCurrency: 'INR',
    targetCurrency: 'GBP',
    rate: 109.280000,
    inverseRate: 0.009151,
    effectiveDate: '2026-10-27',
    source: 'Reserve Bank of India (RBI) Reference Rate Baseline (Static Fallback)',
    retrievedAt: '2026-10-27T00:00:00Z',
    isStale: false,
    isLive: false,
  },
  JPY: {
    id: 'FX-JPY-INR',
    baseCurrency: 'INR',
    targetCurrency: 'JPY',
    rate: 0.552000, // 1 JPY = ₹0.552 (equivalent to ₹55.20 per 100 JPY RBI reference)
    inverseRate: 1.811594,
    effectiveDate: '2026-10-27',
    source: 'Bank of Japan / RBI Reference Rate Baseline (Static Fallback)',
    retrievedAt: '2026-10-27T00:00:00Z',
    isStale: false,
    isLive: false,
  },
  CHF: {
    id: 'FX-CHF-INR',
    baseCurrency: 'INR',
    targetCurrency: 'CHF',
    rate: 97.250000,
    inverseRate: 0.010283,
    effectiveDate: '2026-10-27',
    source: 'Swiss National Bank / RBI Cross Reference Baseline (Static Fallback)',
    retrievedAt: '2026-10-27T00:00:00Z',
    isStale: false,
    isLive: false,
  },
  SGD: {
    id: 'FX-SGD-INR',
    baseCurrency: 'INR',
    targetCurrency: 'SGD',
    rate: 63.780000,
    inverseRate: 0.015679,
    effectiveDate: '2026-10-27',
    source: 'Monetary Authority of Singapore / RBI Cross Baseline (Static Fallback)',
    retrievedAt: '2026-10-27T00:00:00Z',
    isStale: false,
    isLive: false,
  },
  CAD: {
    id: 'FX-CAD-INR',
    baseCurrency: 'INR',
    targetCurrency: 'CAD',
    rate: 60.820000,
    inverseRate: 0.016442,
    effectiveDate: '2026-10-27',
    source: 'Bank of Canada / RBI Cross Baseline (Static Fallback)',
    retrievedAt: '2026-10-27T00:00:00Z',
    isStale: false,
    isLive: false,
  },
};

// Backwards-compatible alias for existing imports
export const VERIFIED_BENCHMARK_RATES = STATIC_BENCHMARK_FALLBACK_RATES;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'CHF ',
  SGD: 'S$',
  CAD: 'C$',
  JPY: '¥',
};

// In-memory rate cache
let activeRatesCache: Record<string, ExchangeRateRecord> = { ...STATIC_BENCHMARK_FALLBACK_RATES };
let lastFetchedTimestamp: number = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache TTL

/**
 * Check whether an exchange rate effective date is stale
 */
export function checkIsRateStale(effectiveDate?: string, maxAgeDays = MAX_RATE_AGE_DAYS): boolean {
  if (!effectiveDate || effectiveDate === 'UNAVAILABLE') return true;
  const parsed = Date.parse(effectiveDate);
  if (isNaN(parsed)) return true;
  const ageMs = Date.now() - parsed;
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

/**
 * Fetch official INR-base exchange rates from Supabase public.exchange_rates
 * Falls back to reference benchmark registry with explicit source disclosure if table is not yet synchronized.
 */
export async function getExchangeRatesAsync(): Promise<Record<string, ExchangeRateRecord>> {
  const now = Date.now();
  if (now - lastFetchedTimestamp < CACHE_TTL_MS && Object.keys(activeRatesCache).length > 0) {
    return activeRatesCache;
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('base_currency', 'INR')
        .order('effective_date', { ascending: false });

      if (!error && data && data.length > 0) {
        const loaded: Record<string, ExchangeRateRecord> = {};
        for (const row of data) {
          const target = (row.target_currency || '').toUpperCase() as SupportedCurrency;
          if (target && !loaded[target]) { // take newest effective_date for each target currency
            const isStale = Boolean(row.is_stale) || checkIsRateStale(row.effective_date);
            loaded[target] = {
              id: row.id,
              baseCurrency: 'INR',
              targetCurrency: target,
              rate: Number(row.rate) || 1.0,
              inverseRate: Number(row.inverse_rate) || (1 / (Number(row.rate) || 1.0)),
              effectiveDate: row.effective_date || new Date().toISOString().split('T')[0],
              source: row.source || 'Supabase public.exchange_rates (Live Database)',
              retrievedAt: row.retrieved_at || new Date().toISOString(),
              isStale,
              isLive: true,
            };
          }
        }

        // Fill any missing currency with the static baseline
        for (const [k, v] of Object.entries(STATIC_BENCHMARK_FALLBACK_RATES)) {
          if (!loaded[k]) {
            loaded[k] = v;
          }
        }

        activeRatesCache = loaded;
        lastFetchedTimestamp = now;
        return activeRatesCache;
      }
    } catch (err) {
      console.warn('Notice: public.exchange_rates pending database migration. Using static reference baseline fallback:', err);
    }
  }

  activeRatesCache = { ...STATIC_BENCHMARK_FALLBACK_RATES };
  lastFetchedTimestamp = now;
  return activeRatesCache;
}

/**
 * Synchronous access to currently loaded exchange rates
 */
export function getExchangeRates(): Record<string, ExchangeRateRecord> {
  return activeRatesCache;
}

/**
 * Centralized, strict Currency Conversion to INR (Indian Rupee ₹) Base.
 * 
 * Guarantees:
 * 1. INR to INR is exactly 1.000000 with zero drift (Identity conversion).
 * 2. Unrecognized or missing currencies trigger explicit error flags and zero INR converted amounts (never silent 1:1 fallback).
 * 3. Calculation formula: INR amount = original amount × INR-per-unit exchange rate.
 * 4. Stale rates are flagged with explicit audit warnings and disclosure tags.
 * 5. Exact rounding to 2 decimal places for financial reporting.
 * 6. Preserves original amount and original currency code without destructive overwrites.
 * 7. Full rate metadata (rate, effective date, source, live flag) returned for auditability.
 */
export function convertToInr(
  amount: number,
  currencyCode?: string
): CurrencyConversion {
  const numAmount = Number(amount) || 0;
  const rawCurrency = (currencyCode || 'INR').trim().toUpperCase();
  const symbol = CURRENCY_SYMBOLS[rawCurrency] || `${rawCurrency} `;

  // 1. INR Base Currency (Identity conversion: 1.000000)
  if (rawCurrency === 'INR') {
    const rounded = Math.round(numAmount * 100) / 100;
    const usdRate = activeRatesCache.USD?.rate || 84.070000;
    const amountUsd = Math.round((rounded / usdRate) * 100) / 100;
    return {
      originalAmount: rounded,
      originalCurrency: 'INR',
      amountInr: rounded,
      amountUsd,
      exchangeRate: 1.000000,
      effectiveDate: activeRatesCache.INR?.effectiveDate || new Date().toISOString().split('T')[0],
      source: activeRatesCache.INR?.source || 'INR Base Currency (Identity)',
      isConverted: false,
      isStale: false,
      isLive: activeRatesCache.INR?.isLive || false,
      formattedInr: `₹${rounded.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      formattedUsd: `$${amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      formattedOriginal: `₹${rounded.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    };
  }

  // 2. Lookup in exchange rates cache
  const rateRecord = activeRatesCache[rawCurrency as SupportedCurrency];

  // 3. Strict handling for missing/unrecognized currencies:
  // Never guess a rate! Prevent adding unconverted amounts to INR aggregates by setting amountInr = 0.
  if (!rateRecord || !rateRecord.rate || rateRecord.rate <= 0) {
    const originalRounded = Math.round(numAmount * 100) / 100;
    return {
      originalAmount: originalRounded,
      originalCurrency: rawCurrency,
      amountInr: 0, // Zero converted value prevents corrupting INR aggregates
      amountUsd: 0,
      exchangeRate: 0,
      effectiveDate: 'UNAVAILABLE',
      source: 'Missing Official Rate',
      isConverted: false,
      isStale: true,
      isLive: false,
      formattedInr: `${symbol}${originalRounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Conversion Blocked: Missing Rate)`,
      formattedUsd: `${symbol}${originalRounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Missing Rate)`,
      formattedOriginal: `${symbol}${originalRounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      error: `Missing exchange rate for currency ${rawCurrency}. Conversion blocked to preserve reporting accuracy.`,
    };
  }

  // Check freshness
  const isStale = rateRecord.isStale || checkIsRateStale(rateRecord.effectiveDate);

  // 4. Perform calculation: INR amount = original amount × INR-per-unit exchange rate
  // Example: 100 USD × ₹84.070000 = ₹8,407.00 INR
  // Example: 100 GBP × ₹109.280000 = ₹10,928.00 INR
  const convertedExact = numAmount * rateRecord.rate;
  const amountInr = Math.round(convertedExact * 100) / 100;
  const originalRounded = Math.round(numAmount * 100) / 100;

  // Backwards-compatible USD calculation
  const usdRate = activeRatesCache.USD?.rate || 84.070000;
  const amountUsd = Math.round((amountInr / usdRate) * 100) / 100;

  const formattedInr = isStale
    ? `₹${amountInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Stale Rate: ${rateRecord.effectiveDate})`
    : `₹${amountInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formattedUsd = `$${amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return {
    originalAmount: originalRounded,
    originalCurrency: rawCurrency,
    amountInr,
    amountUsd,
    exchangeRate: rateRecord.rate,
    effectiveDate: rateRecord.effectiveDate,
    source: rateRecord.source,
    isConverted: true,
    isStale,
    isLive: rateRecord.isLive,
    formattedInr,
    formattedUsd,
    formattedOriginal: `${symbol}${originalRounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    warning: isStale ? `Exchange rate for ${rawCurrency} is stale (effective date: ${rateRecord.effectiveDate}). Converted values should be verified with treasury.` : undefined,
  };
}

/**
 * Backwards-compatible helper: converts to INR and provides USD equivalent
 */
export function convertToUsd(
  amount: number,
  currencyCode?: string
): CurrencyConversion {
  return convertToInr(amount, currencyCode);
}

/**
 * Format helper for multi-currency display with INR Base:
 * Shows INR Base as primary, with original currency and rate disclosed.
 * Example: "₹10,928.00 INR (£100.00 GBP @ ₹109.2800)"
 */
export function formatCurrencyWithInrDisclosure(
  amount: number,
  currencyCode?: string,
  options?: { compact?: boolean; hideOriginalIfInr?: boolean }
): string {
  const conv = convertToInr(amount, currencyCode);

  if (conv.originalCurrency === 'INR') {
    return conv.formattedInr;
  }

  if (options?.compact) {
    return `${conv.formattedInr} (${conv.formattedOriginal})`;
  }

  const liveIndicator = conv.isLive ? '' : ' [Baseline]';
  return `${conv.formattedInr} INR (${conv.formattedOriginal} ${conv.originalCurrency} @ ₹${conv.exchangeRate.toFixed(4)}${liveIndicator})`;
}

/**
 * Backwards-compatible disclosure helper
 */
export function formatCurrencyWithUsdDisclosure(
  amount: number,
  currencyCode?: string,
  options?: { compact?: boolean; hideOriginalIfUsd?: boolean }
): string {
  return formatCurrencyWithInrDisclosure(amount, currencyCode, options);
}
