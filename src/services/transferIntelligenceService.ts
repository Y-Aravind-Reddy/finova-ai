import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  QueryFilterOptions,
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

function isMissingRpcError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
}

/**
 * Service to handle DATA & TRANSFER INTELLIGENCE analytics
 */
export const transferIntelligenceService = {
  /**
   * Fetches aggregated metrics for the Transfer Overview dashboard.
   * Throws explicit errors rather than returning synthetic mock data.
   */
  async fetchOverviewAggregates(
    tenantId: string,
    filters: QueryFilterOptions
  ): Promise<TransferOverviewAggregates> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured. Live transfer telemetry requires an active database connection.');
    }

    const { data, error } = await supabase.rpc('get_transfer_intelligence_aggregates', {
      p_tenant_id: !tenantId || tenantId === 'ALL' || tenantId === 'platform_root' ? null : tenantId,
      p_start_date: filters.startDate || null,
      p_end_date: filters.endDate || null,
      p_currency: !filters.currency || filters.currency === 'ALL' ? null : filters.currency,
    });

    if (!error && data && typeof data === 'object') {
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

    // Do NOT mask RBAC/authentication denials with fallback table scans
    if (error && !isMissingRpcError(error)) {
      throw new Error(error.message || 'Transfer intelligence RPC query rejected.');
    }

    // Bounded fallback query ONLY when the RPC function itself is missing from schema
    let query = supabase.from('transactions').select('*', { count: 'planned' }).limit(500);
    if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') query = query.eq('tenant_id', tenantId);
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);
    if (filters.currency && filters.currency !== 'ALL') query = query.eq('currency', filters.currency);

    const { data: rows, count, error: tableErr } = await query;
    if (tableErr) {
      throw new Error(tableErr.message || 'Failed to query transactions table.');
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
   */
  async fetchSettlementMetrics(tenantId: string, filters: QueryFilterOptions) {
    const overview = await this.fetchOverviewAggregates(tenantId, filters);

    // Derive inbound/outbound and settled volume directly from live transactions aggregates RPC if available
    let settledVolume = overview.totalVolume;
    let inboundVolume = 0;
    let outboundVolume = 0;

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      const { data: txAgg, error: txErr } = await supabase.rpc('get_transaction_aggregates', {
        p_tenant_id: !tenantId || tenantId === 'ALL' || tenantId === 'platform_root' ? null : tenantId,
        p_user_id: null,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_status: null,
        p_type: null,
      });

      if (!txErr && txAgg && typeof txAgg === 'object') {
        settledVolume = Number(txAgg.settledVolumeInr) || overview.totalVolume;
        inboundVolume = Number(txAgg.creditsVolumeInr) || 0;
        outboundVolume = Number(txAgg.debitsVolumeInr) || 0;
      }
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
      throw new Error('Supabase client is not configured. Paginated records require live database access.');
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    let query = supabase.from('transactions').select('*', { count: 'planned' });

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

    const { data, count, error } = await query
      .order('date', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message || 'Failed to load paginated transactions.');
    }

    return {
      data: data || [],
      totalCount: count || 0,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
      source: 'supabase' as const,
    };
  },

  /**
   * Fetches reconciliation-specific metrics from actual database clearing states.
   */
  async fetchReconciliationMetrics(tenantId: string, filters: QueryFilterOptions) {
    const overview = await this.fetchOverviewAggregates(tenantId, filters);

    // Query actual unsettled transactions (Pending, Clearing, Failed, Reversed) for real discrepancy volume
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

    const { data: unresolvedRows } = await unresolvedQuery;
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
  },

  /**
   * Fetches exception-specific metrics strictly from real exception records.
   */
  async fetchExceptionMetrics(tenantId: string, filters: QueryFilterOptions) {
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

    const { data: exRows } = await exQuery;
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
  },
};
