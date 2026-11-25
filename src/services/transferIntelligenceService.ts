import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  QueryFilterOptions,
  TelemetryDiagnosticMetadata,
  dedupeInFlight,
  isMissingRpcError,
  isStatementTimeoutError,
  isPermissionDeniedError,
  isAbortError,
  getActiveSessionRole,
  createTelemetryCorrelationId,
  computeDateRangeDays,
  extractSafeSqlstate,
  recordTelemetryDiagnostic,
  formatTelemetryDiagnosticError,
  fetchTransactionAggregatesResultFromDb,
} from './finovaDatabase';

export interface TransferOverviewAggregates {
  totalTransfers: number;
  totalVolume: number;
  successCount: number;
  pendingCount: number;
  failedCount: number;
  reversedCount: number;
  avgAmount: number;
  fraudFlaggedCount: number;
  statusDistribution: { label: string; value: number }[];
  categoryMix: { label: string; value: number }[];
  currencyExposure: Record<string, number>;
  channelPerformance: { label: string; value: number }[];
  hourlyVelocity: { hour: string; volume: number }[];
  source: 'supabase';
  isPartial: boolean;
  rejectedRecordsCount: number;
}

export interface TelemetryError extends Error {
  code?: string;
  status?: number;
}

function toTelemetryError(
  err: any,
  fallbackMessage: string,
  diag?: TelemetryDiagnosticMetadata
): TelemetryError {
  const baseMessage = String(err?.message || fallbackMessage);
  const formattedBody = diag ? formatTelemetryDiagnosticError(diag, baseMessage) : baseMessage;
  const formatted = isStatementTimeoutError(err)
    ? `Database statement timeout (57014): ${formattedBody}`
    : isPermissionDeniedError(err)
    ? `Access restricted (${err?.code || err?.status || '42501'}): ${formattedBody}`
    : formattedBody;
  const error = new Error(formatted) as TelemetryError;
  if (err?.code) error.code = String(err.code);
  if (err?.status) error.status = Number(err.status);
  return error;
}

function classifyDiagOutcome(
  err: unknown,
  signal?: AbortSignal
): TelemetryDiagnosticMetadata['outcome'] {
  if (isAbortError(err, signal)) return 'ABORTED';
  if (isStatementTimeoutError(err)) return 'TIMEOUT';
  if (isPermissionDeniedError(err)) return 'RESTRICTED';
  return 'ERROR';
}

function applySignal<T>(query: T, signal?: AbortSignal): T {
  if (signal && query && typeof (query as any).abortSignal === 'function') {
    return (query as any).abortSignal(signal);
  }
  return query;
}

/**
 * Service to handle DATA & TRANSFER INTELLIGENCE analytics
 */
export const transferIntelligenceService = {
  /**
   * Fetches aggregated metrics for the Transfer Overview dashboard.
   * Deduplicates concurrent identical calls and preserves SQLSTATE codes on errors.
   */
  async fetchOverviewAggregates(
    tenantId: string,
    filters: QueryFilterOptions,
    clientOverride?: any
  ): Promise<TransferOverviewAggregates> {
    const client = clientOverride || supabase;
    if (!clientOverride && !isSupabaseConfigured()) {
      throw toTelemetryError(
        { code: 'UNCONFIGURED' },
        'Supabase client is not configured. Live transfer telemetry requires an active database connection.'
      );
    }

    const execute = async (): Promise<TransferOverviewAggregates> => {
      const correlationId = createTelemetryCorrelationId();
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsedMs = () =>
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      const dateRangeDays = computeDateRangeDays(filters.startDate, filters.endDate);
      const callerRole = getActiveSessionRole(clientOverride) || 'AUTHENTICATED';

      const { data, error } = await applySignal(
        client.rpc('get_transfer_intelligence_aggregates', {
          p_tenant_id: !tenantId || tenantId === 'ALL' || tenantId === 'platform_root' ? null : tenantId,
          p_start_date: filters.startDate || null,
          p_end_date: filters.endDate || null,
          p_currency: !filters.currency || filters.currency === 'ALL' ? null : filters.currency,
        }),
        filters.signal
      );

      if (!error && data && typeof data === 'object') {
        recordTelemetryDiagnostic({
          correlationId,
          widgetName: 'Transfer Intelligence Overview',
          rpcName: 'get_transfer_intelligence_aggregates',
          sqlstate: '00000',
          durationMs: elapsedMs(),
          dateRangeDays,
          role: callerRole,
          tenantScope: tenantId,
          outcome: 'SUCCESS',
        });
        return {
          totalTransfers: Number(data.totalTransfers) || 0,
          totalVolume: Number(data.totalVolume) || 0,
          successCount: Number(data.successCount) || 0,
          pendingCount: Number(data.pendingCount) || 0,
          failedCount: Number(data.failedCount) || 0,
          reversedCount: Number(data.reversedCount) || 0,
          avgAmount: Number(data.avgAmount) || 0,
          fraudFlaggedCount: Number(data.fraudFlaggedCount) || 0,
          statusDistribution: Array.isArray(data.statusDistribution) ? data.statusDistribution : [],
          categoryMix: Array.isArray(data.categoryMix) ? data.categoryMix : [],
          currencyExposure: data.currencyExposure && typeof data.currencyExposure === 'object' ? data.currencyExposure : {},
          channelPerformance: Array.isArray(data.channelPerformance) ? data.channelPerformance : [],
          hourlyVelocity: Array.isArray(data.hourlyVelocity) ? data.hourlyVelocity : [],
          source: 'supabase',
          isPartial: false,
          rejectedRecordsCount: Number(data.rejectedRecordsCount) || 0,
        };
      }

      // Do NOT mask RBAC, authentication denials, or statement timeouts with fallback table scans
      if (error && !isMissingRpcError(error)) {
        const diag = recordTelemetryDiagnostic({
          correlationId,
          widgetName: 'Transfer Intelligence Overview',
          rpcName: 'get_transfer_intelligence_aggregates',
          sqlstate: extractSafeSqlstate(error),
          durationMs: elapsedMs(),
          dateRangeDays,
          role: callerRole,
          tenantScope: tenantId,
          outcome: classifyDiagOutcome(error, filters.signal),
        });
        throw toTelemetryError(error, 'Transfer intelligence RPC query rejected.', diag);
      }

      // Bounded fallback query ONLY when the RPC function itself is missing from schema
      let query = client.from('transactions').select('*', { count: 'estimated' }).limit(500);
      if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') query = query.eq('tenant_id', tenantId);
      if (filters.startDate) query = query.gte('date', filters.startDate);
      if (filters.endDate) query = query.lte('date', filters.endDate);
      if (filters.currency && filters.currency !== 'ALL') query = query.eq('currency', filters.currency);

      const { data: rows, count, error: tableErr } = await applySignal(query, filters.signal);
      if (tableErr) {
        const diag = recordTelemetryDiagnostic({
          correlationId,
          widgetName: 'Transfer Intelligence Overview',
          rpcName: 'transactions.select.fallback',
          sqlstate: extractSafeSqlstate(tableErr),
          durationMs: elapsedMs(),
          dateRangeDays,
          role: callerRole,
          tenantScope: tenantId,
          outcome: classifyDiagOutcome(tableErr, filters.signal),
        });
        throw toTelemetryError(tableErr, 'Failed to query transactions table.', diag);
      }

      const finalData = rows || [];
      const stats = this.processTransactionData(finalData);
      const isPartial = finalData.length >= 500;

      return {
        ...stats,
        totalTransfers: Number(count) || finalData.length,
        source: 'supabase',
        isPartial,
      };
    };

    if (filters.signal || clientOverride) {
      return execute();
    }
    const key = `ti_overview:${tenantId}:${filters.startDate || ''}:${filters.endDate || ''}:${filters.currency || 'ALL'}`;
    return dedupeInFlight(key, execute);
  },

  processTransactionData(
    data: any[]
  ): Omit<TransferOverviewAggregates, 'totalTransfers' | 'source' | 'isPartial'> {
    let volume = 0;
    let success = 0;
    let pending = 0;
    let failed = 0;
    let reversed = 0;
    let fraud = 0;
    let rejected = 0;

    const statusMap: Record<string, number> = {};
    const categoryMap: Record<string, number> = {};
    const currencyMap: Record<string, number> = {};
    const channelMap: Record<string, number> = {};
    const hourMap: Record<string, number> = {};

    data.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (isNaN(amt)) {
        rejected++;
        return;
      }

      volume += amt;

      const statusLabel = String(t.status || 'Settled').trim();
      const statusLower = statusLabel.toLowerCase();
      if (['settled', 'escrow secured', 'success', 'completed'].includes(statusLower)) {
        success++;
      } else if (['pending', 'clearing'].includes(statusLower)) {
        pending++;
      } else if (statusLower === 'failed') {
        failed++;
      } else if (statusLower === 'reversed') {
        reversed++;
      }

      if (t.is_flagged_fraud) {
        fraud++;
      }

      statusMap[statusLabel] = (statusMap[statusLabel] || 0) + 1;

      const categoryLabel = String(t.category || 'Operational').trim();
      categoryMap[categoryLabel] = (categoryMap[categoryLabel] || 0) + 1;

      const currencyLabel = String(t.currency || 'INR').trim().toUpperCase();
      currencyMap[currencyLabel] = Math.round(((currencyMap[currencyLabel] || 0) + amt) * 100) / 100;

      const channelLabel = String(t.channel || 'Online').trim();
      channelMap[channelLabel] = (channelMap[channelLabel] || 0) + 1;

      const tsSource = t.created_at || t.date;
      let validDate = false;
      if (tsSource) {
        const parsed = new Date(tsSource);
        if (!isNaN(parsed.getTime())) {
          validDate = true;
          const hour = parsed.getUTCHours().toString().padStart(2, '0') + ':00';
          hourMap[hour] = Math.round(((hourMap[hour] || 0) + amt) * 100) / 100;
        }
      }

      if (!validDate) {
        rejected++;
      }
    });

    return {
      totalVolume: Math.round(volume * 100) / 100,
      successCount: success,
      pendingCount: pending,
      failedCount: failed,
      reversedCount: reversed,
      avgAmount: data.length > 0 ? Math.round((volume / data.length) * 100) / 100 : 0,
      fraudFlaggedCount: fraud,
      statusDistribution: Object.entries(statusMap).map(([label, value]) => ({ label, value })),
      categoryMix: Object.entries(categoryMap).map(([label, value]) => ({ label, value })),
      currencyExposure: currencyMap,
      channelPerformance: Object.entries(channelMap).map(([label, value]) => ({ label, value })),
      hourlyVelocity: Object.entries(hourMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, vol]) => ({ hour, volume: vol })),
      rejectedRecordsCount: rejected,
    };
  },

  /**
   * Fetches settlement-specific metrics derived from verified database aggregates.
   * Reuses deduplicated overview & transaction aggregate helpers.
   */
  async fetchSettlementMetrics(tenantId: string, filters: QueryFilterOptions, clientOverride?: any) {
    const run = async () => {
      const [overview, txAgg] = await Promise.all([
        this.fetchOverviewAggregates(tenantId, filters, clientOverride),
        fetchTransactionAggregatesResultFromDb(
          tenantId,
          {
            startDate: filters.startDate,
            endDate: filters.endDate,
            signal: filters.signal,
          },
          clientOverride
        ),
      ]);

      let settledVolume = overview.totalVolume;
      let inboundVolume = 0;
      let outboundVolume = 0;

      if (txAgg.source === 'supabase' && !txAgg.error) {
        settledVolume = Number(txAgg.settledVolumeInr) || overview.totalVolume;
        inboundVolume = Number(txAgg.creditsVolumeInr) || 0;
        outboundVolume = Number(txAgg.debitsVolumeInr) || 0;
      }

      return {
        totalSettlementVolume: settledVolume,
        successfulSettlements: overview.successCount,
        pendingSettlements: overview.pendingCount,
        failedSettlements: overview.failedCount,
        exceptionsCount: overview.failedCount + overview.reversedCount,
        avgProcessingTime: 'Unavailable (not in schema)',
        incomingVsOutgoing:
          inboundVolume > 0 || outboundVolume > 0
            ? [
                { label: 'Inbound (Credits)', value: inboundVolume },
                { label: 'Outbound (Debits)', value: outboundVolume },
              ]
            : [],
        source: overview.source,
      };
    };

    if (filters.signal || clientOverride) return run();
    const key = `ti_settlement:${tenantId}:${filters.startDate || ''}:${filters.endDate || ''}:${filters.currency || 'ALL'}`;
    return dedupeInFlight(key, run);
  },

  /**
   * Fetches paginated transaction records with deep filtering.
   * Throws explicit errors when database queries fail or client is unconfigured.
   */
  async fetchPaginatedTransactions(
    tenantId: string,
    filters: QueryFilterOptions & { search?: string }
  ) {
    if (!isSupabaseConfigured()) {
      throw toTelemetryError(
        { code: 'UNCONFIGURED' },
        'Supabase client is not configured. Paginated records require live database access.'
      );
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    const run = async () => {
      const correlationId = createTelemetryCorrelationId();
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsedMs = () =>
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      const dateRangeDays = computeDateRangeDays(filters.startDate, filters.endDate);
      const callerRole = getActiveSessionRole() || 'AUTHENTICATED';

      let query = supabase.from('transactions').select('*', { count: filters.countMode || 'estimated' });

      if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') query = query.eq('tenant_id', tenantId);
      if (filters.status && filters.status !== 'ALL') query = query.eq('status', filters.status);
      if (filters.currency && filters.currency !== 'ALL') query = query.eq('currency', filters.currency);
      if (filters.type && filters.type !== 'ALL') query = query.eq('type', filters.type);
      if (filters.channel && filters.channel !== 'ALL') query = query.eq('channel', filters.channel);
      if (filters.startDate) query = query.gte('date', filters.startDate);
      if (filters.endDate) query = query.lte('date', filters.endDate);

      if (filters.search) {
        const s = filters.search.trim();
        query = query.or(`id.ilike.%${s}%,merchant.ilike.%${s}%,reference_no.ilike.%${s}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await applySignal(
        query.order('date', { ascending: false }).range(from, to),
        filters.signal
      );

      if (error) {
        const diag = recordTelemetryDiagnostic({
          correlationId,
          widgetName: 'Transaction Records Ledger',
          rpcName: 'transactions.select.paginated',
          sqlstate: extractSafeSqlstate(error),
          durationMs: elapsedMs(),
          dateRangeDays,
          role: callerRole,
          tenantScope: tenantId,
          outcome: classifyDiagOutcome(error, filters.signal),
        });
        throw toTelemetryError(error, 'Failed to load paginated transactions.', diag);
      }

      recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'Transaction Records Ledger',
        rpcName: 'transactions.select.paginated',
        sqlstate: '00000',
        durationMs: elapsedMs(),
        dateRangeDays,
        role: callerRole,
        tenantScope: tenantId,
        outcome: 'SUCCESS',
      });

      return {
        data: data || [],
        totalCount: count ?? (data?.length || 0),
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil((count ?? (data?.length || 0)) / pageSize)),
        source: 'supabase' as const,
      };
    };

    if (filters.signal) return run();
    const key = `ti_paginated:${tenantId}:${page}:${pageSize}:${filters.status || ''}:${filters.currency || ''}:${filters.type || ''}:${filters.channel || ''}:${filters.startDate || ''}:${filters.endDate || ''}:${filters.search || ''}`;
    return dedupeInFlight(key, run);
  },

  /**
   * Fetches reconciliation-specific metrics from actual database clearing states.
   */
  async fetchReconciliationMetrics(tenantId: string, filters: QueryFilterOptions) {
    const run = async () => {
      const overview = await this.fetchOverviewAggregates(tenantId, filters);

      let unresolvedQuery = supabase
        .from('transactions')
        .select('amount, status')
        .in('status', ['Pending', 'Clearing', 'Failed', 'Reversed'])
        .limit(500);

      if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
        unresolvedQuery = unresolvedQuery.eq('tenant_id', tenantId);
      }
      if (filters.startDate) unresolvedQuery = unresolvedQuery.gte('date', filters.startDate);
      if (filters.endDate) unresolvedQuery = unresolvedQuery.lte('date', filters.endDate);
      if (filters.currency && filters.currency !== 'ALL') unresolvedQuery = unresolvedQuery.eq('currency', filters.currency);

      const correlationId = createTelemetryCorrelationId();
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsedMs = () =>
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      const dateRangeDays = computeDateRangeDays(filters.startDate, filters.endDate);
      const callerRole = getActiveSessionRole() || 'AUTHENTICATED';

      const { data: unresolvedRows, error: unresolvedErr } = await applySignal(unresolvedQuery, filters.signal);
      if (unresolvedErr) {
        const diag = recordTelemetryDiagnostic({
          correlationId,
          widgetName: 'Banking Reconciliation Unresolved Queue',
          rpcName: 'transactions.select.unresolved',
          sqlstate: extractSafeSqlstate(unresolvedErr),
          durationMs: elapsedMs(),
          dateRangeDays,
          role: callerRole,
          tenantScope: tenantId,
          outcome: classifyDiagOutcome(unresolvedErr, filters.signal),
        });
        throw toTelemetryError(unresolvedErr, 'Failed loading unresolved reconciliation queue.', diag);
      }

      const discrepancyVolume = (unresolvedRows || []).reduce(
        (sum: number, row: any) => sum + (Number(row.amount) || 0),
        0
      );

      const matched = overview.successCount;
      const exceptionsCount = overview.failedCount + overview.reversedCount;
      const pendingCount = overview.pendingCount;
      const unmatched = exceptionsCount + pendingCount;

      return {
        totalReviewed: overview.totalTransfers,
        matchedRecords: matched,
        unmatchedRecords: unmatched,
        exceptionsCount,
        totalDifference: Math.round(discrepancyVolume * 100) / 100,
        pendingCount,
        statusDistribution: [
          { label: 'Settled / Matched', value: matched },
          { label: 'Pending / Clearing', value: pendingCount },
          { label: 'Exceptions / Failed', value: exceptionsCount },
        ].filter((s) => s.value > 0),
        source: overview.source,
      };
    };

    if (filters.signal) return run();
    const key = `ti_recon:${tenantId}:${filters.startDate || ''}:${filters.endDate || ''}:${filters.currency || 'ALL'}`;
    return dedupeInFlight(key, run);
  },

  /**
   * Fetches exception-specific metrics strictly from real exception records.
   */
  async fetchExceptionMetrics(tenantId: string, filters: QueryFilterOptions) {
    const run = async () => {
      const overview = await this.fetchOverviewAggregates(tenantId, filters);

      let exQuery = supabase
        .from('transactions')
        .select('status, channel, category, date, is_flagged_fraud')
        .or('status.in.(Failed,Reversed),is_flagged_fraud.eq.true')
        .order('date', { ascending: false })
        .limit(500);

      if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
        exQuery = exQuery.eq('tenant_id', tenantId);
      }
      if (filters.startDate) exQuery = exQuery.gte('date', filters.startDate);
      if (filters.endDate) exQuery = exQuery.lte('date', filters.endDate);
      if (filters.currency && filters.currency !== 'ALL') exQuery = exQuery.eq('currency', filters.currency);

      const correlationId = createTelemetryCorrelationId();
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsedMs = () =>
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      const dateRangeDays = computeDateRangeDays(filters.startDate, filters.endDate);
      const callerRole = getActiveSessionRole() || 'AUTHENTICATED';

      const { data: exRows, error: exErr } = await applySignal(exQuery, filters.signal);
      if (exErr) {
        const diag = recordTelemetryDiagnostic({
          correlationId,
          widgetName: 'Transfer Exceptions Queue',
          rpcName: 'transactions.select.exceptions',
          sqlstate: extractSafeSqlstate(exErr),
          durationMs: elapsedMs(),
          dateRangeDays,
          role: callerRole,
          tenantScope: tenantId,
          outcome: classifyDiagOutcome(exErr, filters.signal),
        });
        throw toTelemetryError(exErr, 'Failed loading exception telemetry.', diag);
      }

      const taxonomyMap: Record<string, number> = {};
      const trendMap: Record<string, number> = {};

      (exRows || []).forEach((row: any) => {
        const bucket = `${row.status || 'Exception'} (${row.channel || 'Online'})`;
        taxonomyMap[bucket] = (taxonomyMap[bucket] || 0) + 1;
        const d = row.date ? String(row.date).split('T')[0] : 'Unknown';
        trendMap[d] = (trendMap[d] || 0) + 1;
      });

      const errorCodeDistribution = Object.entries(taxonomyMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      const failureTrend = Object.entries(trendMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-7)
        .map(([label, value]) => ({ label, value }));

      return {
        failedCount: overview.failedCount,
        pendingCount: overview.pendingCount,
        fraudCount: overview.fraudFlaggedCount,
        errorRecords: overview.failedCount + overview.reversedCount,
        chargebacks: overview.reversedCount,
        openInvestigations: overview.failedCount + overview.fraudFlaggedCount,
        errorCodeDistribution,
        failureTrend,
        source: overview.source,
      };
    };

    if (filters.signal) return run();
    const key = `ti_ex:${tenantId}:${filters.startDate || ''}:${filters.endDate || ''}:${filters.currency || 'ALL'}`;
    return dedupeInFlight(key, run);
  },
};
