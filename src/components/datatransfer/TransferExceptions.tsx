import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transferIntelligenceService } from '../../services/transferIntelligenceService';
import {
  getDefaultBoundedDateRange,
  isPermissionDeniedError,
  isStatementTimeoutError,
} from '../../services/finovaDatabase';
import { DataTransferFilterBar, DataTransferFilters } from './DataTransferFilterBar';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { WidgetFailureNotice, WidgetStatusBadge } from '../common/WidgetTelemetryStatus';
import { 
  AlertTriangle, 
  ShieldAlert, 
  RotateCw, 
  FileWarning, 
  Activity,
  XCircle,
  ExternalLink
} from 'lucide-react';

const TransferExceptions: React.FC = () => {
  const [filters, setFilters] = useState<DataTransferFilters>(() => ({
    ...getDefaultBoundedDateRange('YTD'),
    currency: 'ALL',
    type: 'ALL',
    channel: 'ALL',
    status: 'ALL',
    search: '',
    tenantId: 'ALL'
  }));

  const { data: metrics, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['exception-metrics', filters],
    queryFn: ({ signal }) => transferIntelligenceService.fetchExceptionMetrics(filters.tenantId, { ...filters, signal }),
  });

  const { data: txData, isFetching: txFetching, isError: txIsError, error: txErrObj, refetch: refetchTx } = useQuery({
    queryKey: ['exception-records', filters],
    queryFn: ({ signal }) => transferIntelligenceService.fetchPaginatedTransactions(filters.tenantId, { ...filters, status: 'Failed', pageSize: 10, signal }),
  });

  const kpis = [
    { title: 'Failed Transfers', value: (metrics?.failedCount ?? 0).toLocaleString(), sub: 'Clearing rejections', icon: <XCircle size={20} />, variant: 'gold-accent' as const },
    { title: 'Open Investigations', value: (metrics?.openInvestigations ?? 0).toLocaleString(), sub: 'Active forensic cases', icon: <Activity size={20} /> },
    { title: 'High-Risk Hits', value: (metrics?.fraudCount ?? 0).toLocaleString(), sub: 'Surveillance matches', icon: <ShieldAlert size={20} /> },
    { title: 'Error Records', value: (metrics?.errorRecords ?? 0).toLocaleString(), sub: 'System log exceptions', icon: <FileWarning size={20} /> },
  ];

  const activeErrorObj = isError ? error : txIsError ? txErrObj : null;
  const combinedErr = activeErrorObj ? (activeErrorObj as Error)?.message : null;
  const exceptionsStatus = isLoading
    ? 'LOADING'
    : activeErrorObj
    ? isStatementTimeoutError(activeErrorObj)
      ? 'TIMEOUT'
      : isPermissionDeniedError(activeErrorObj)
      ? 'RESTRICTED'
      : 'DEGRADED'
    : metrics?.source === 'supabase'
    ? 'OPERATIONAL'
    : 'UNAVAILABLE';

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-cinzel text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
            Exceptions & Failed Transfers
            <span className="ml-3 px-2 py-0.5 rounded bg-red-950/40 border border-red-500/40 text-red-500 text-xs font-mono uppercase tracking-tighter align-middle">
              High Priority
            </span>
          </h1>
          <p className="text-xs text-[#9CA3AF] font-mono mt-1 uppercase tracking-widest">
            Institutional Exception Desk • Forensic Failure Analysis
          </p>
        </div>
        <WidgetStatusBadge label="Exceptions" status={exceptionsStatus} />
      </div>

      <DataTransferFilterBar 
        filters={filters} 
        onFilterChange={setFilters} 
        onRefresh={() => { refetch(); refetchTx(); }} 
        isLoading={isLoading || isFetching || txFetching} 
      />

      {combinedErr && exceptionsStatus !== 'LOADING' && (
        <WidgetFailureNotice
          widgetName={isError ? 'Transfer Exceptions Metrics' : 'Failed Transfers Ledger'}
          status={exceptionsStatus === 'OPERATIONAL' ? 'DEGRADED' : exceptionsStatus}
          error={combinedErr}
          onRetry={() => { refetch(); refetchTx(); }}
          isRetrying={isFetching || txFetching}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <ThreeDKpiCard key={idx} {...kpi} trend="down" change={metrics?.source === 'supabase' ? 'Live' : 'Unavailable'} tag="Alert" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDDonutChart
          title="Exception Taxonomy"
          subtitle="Rejection and exception breakdown across rails"
          segments={metrics?.errorCodeDistribution || []}
          centerLabel="Errors"
          centerValue={String(metrics?.failedCount ?? 0)}
          height={320}
        />

        <div className="rounded-2xl bg-[#1A1A1A]/80 border border-[#3A3A3A] p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-cinzel text-base font-bold text-[#E6C78B]">Failure Trajectory</h3>
              <p className="text-[10px] text-[#9CA3AF] font-mono">Rejection volume trend (7D)</p>
            </div>
            <RotateCw size={18} className="text-red-500" />
          </div>
          
          <div className="flex-1">
            <ThreeDColumnChart
              data={metrics?.failureTrend || []}
              height={220}
              primaryLabel="Failure Count"
            />
          </div>
        </div>
      </div>

      {/* Exception Table */}
      <div className="rounded-2xl bg-[#1A1A1A]/80 border border-[#D4A017]/30 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#D4A017]/20 flex items-center justify-between bg-[#121212]/50">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <h3 className="font-cinzel text-base font-bold text-[#FFF8E7]">Exception Ledger</h3>
          </div>
          <div className="text-[10px] font-mono text-red-400 font-bold uppercase animate-pulse">
            Investigations Required: {metrics?.openInvestigations ?? 0}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-[#121212] text-[#D4A017] uppercase tracking-wider border-b border-[#3A3A3A]">
              <tr>
                <th className="px-6 py-4 font-bold">TXN ID / Reference</th>
                <th className="px-6 py-4 font-bold">Exception Payload</th>
                <th className="px-6 py-4 font-bold">Amount</th>
                <th className="px-6 py-4 font-bold text-center">Risk</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-[#FAF7F0]">
              {(txData?.data || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#9CA3AF]">
                    No failed transfer exceptions matched the current filters.
                  </td>
                </tr>
              ) : txData!.data.map((tx: any) => {
                const statusLabel = tx.is_flagged_fraud
                  ? 'AML / FRAUD FLAG'
                  : `STATUS: ${String(tx.status || 'EXCEPTION').toUpperCase()}`;
                return (
                  <tr key={tx.id} className="hover:bg-red-500/5 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#FFF8E7]">{tx.id}</span>
                        <span className="text-[9px] text-[#6B7280]">{tx.reference_no}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-red-400 font-bold">{statusLabel}</span>
                        <span className="text-[9px] text-[#9CA3AF]">
                          {tx.channel || 'Gateway'} • {tx.category || 'Transfer'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#9CA3AF]">
                      {tx.currency} {Number(tx.amount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black ${tx.risk_score > 25 ? 'bg-red-950/40 text-red-400 border border-red-500/40' : 'bg-amber-950/40 text-amber-400 border border-amber-500/40'}`}>
                        {tx.risk_score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#9CA3AF]">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {tx.status || 'Failed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#D4A017] hover:border-[#F5C542] transition-all">
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransferExceptions;
