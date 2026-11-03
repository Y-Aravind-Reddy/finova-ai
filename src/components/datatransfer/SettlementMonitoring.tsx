import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transferIntelligenceService } from '../../services/transferIntelligenceService';
import { DataTransferFilterBar, DataTransferFilters } from './DataTransferFilterBar';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { 
  ShieldCheck, 
  Activity, 
  Clock, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export const SettlementMonitoring: React.FC = () => {
  const [filters, setFilters] = useState<DataTransferFilters>({
    startDate: '',
    endDate: '',
    currency: 'ALL',
    type: 'ALL',
    channel: 'ALL',
    status: 'ALL',
    search: '',
    tenantId: 'ALL'
  });

  const [page, setPage] = useState(1);
  const pageSize = 12;

  // 1. Fetch Metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['settlement-metrics', filters],
    queryFn: () => transferIntelligenceService.fetchSettlementMetrics(filters.tenantId, filters),
  });

  // 2. Fetch Aggregates for Velocity Chart
  const { data: aggregates } = useQuery({
    queryKey: ['transfer-overview', filters],
    queryFn: () => transferIntelligenceService.fetchOverviewAggregates(filters.tenantId, filters),
  });

  // 3. Fetch Transactions for the table
  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['paginated-transactions', filters, page],
    queryFn: () => transferIntelligenceService.fetchPaginatedTransactions(filters.tenantId, { ...filters, page, pageSize }),
  });

  const kpis = [
    { title: 'Confirmed Settlements', value: `$${((metrics?.totalSettlementVolume || 0) / 1000000).toFixed(1)}M`, sub: 'Liquidity confirmed', icon: <ShieldCheck size={20} />, variant: 'gold-accent' as const },
    { title: 'Successful Clearing', value: metrics?.successfulSettlements.toLocaleString() || '0', sub: 'SLA Compliant', icon: <CheckCircle2 size={20} /> },
    { title: 'Pending Settlement', value: metrics?.pendingSettlements.toLocaleString() || '0', sub: 'In-flight volume', icon: <Clock size={20} /> },
    { title: 'Settlement Exceptions', value: metrics?.exceptionsCount.toLocaleString() || '0', sub: 'Action required', icon: <AlertTriangle size={20} /> },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div>
        <h1 className="font-cinzel text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
          Settlement Monitoring
        </h1>
        <p className="text-xs text-[#9CA3AF] font-mono mt-1 uppercase tracking-widest">
          Institutional Clearing Workspace • Real-time SLA Surveillance
        </p>
      </div>

      <DataTransferFilterBar 
        filters={filters} 
        onFilterChange={setFilters} 
        onRefresh={() => {}} 
        isLoading={metricsLoading} 
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <ThreeDKpiCard key={idx} {...kpi} trend="up" change="Live" tag="Settlement" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDAreaChart
          title="Hourly Settlement Velocity"
          subtitle="Cleared volume per hour (USD)"
          data={aggregates?.hourlyVelocity.map(v => ({ label: v.hour, value: v.volume })) || []}
          valuePrefix="$"
          height={300}
        />

        <ThreeDDonutChart
          title="Flow Distribution"
          subtitle="Incoming vs Outgoing Settlement"
          segments={metrics?.incomingVsOutgoing || []}
          centerLabel="Total Vol"
          centerValue={`$${((metrics?.totalSettlementVolume || 0) / 1000000).toFixed(1)}M`}
          height={300}
        />
      </div>

      {/* Monitoring Table */}
      <div className="rounded-2xl bg-[#1A1A1A]/80 border border-[#D4A017]/30 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#D4A017]/20 flex items-center justify-between bg-[#121212]/50">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-[#D4A017]" />
            <h3 className="font-cinzel text-base font-bold text-[#FFF8E7]">Settlement Ledger</h3>
          </div>
          <div className="text-[10px] font-mono text-[#9CA3AF]">
            Node State: <span className="text-emerald-400 font-bold uppercase">{metrics?.source === 'supabase' ? 'Live' : 'Fallback'}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-[#121212] text-[#D4A017] uppercase tracking-wider border-b border-[#3A3A3A]">
              <tr>
                <th className="px-6 py-4 font-bold">Transaction ID</th>
                <th className="px-6 py-4 font-bold">Counterparty</th>
                <th className="px-6 py-4 font-bold">Amount</th>
                <th className="px-6 py-4 font-bold">Rail</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Risk Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-[#FAF7F0]">
              {txLoading ? (
                [...Array(pageSize)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4 h-12 bg-[#1A1A1A]/30" />
                  </tr>
                ))
              ) : txData?.data.map((tx: any) => (
                <tr key={tx.id} className="hover:bg-[#D4A017]/5 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-bold text-[#FFF8E7]">{tx.id}</span>
                      <span className="text-[9px] text-[#6B7280]">{tx.date}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold">{tx.merchant}</span>
                      <span className="text-[9px] text-[#6B7280]">{tx.reference_no}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={tx.type === 'Credit' ? 'text-emerald-400' : 'text-amber-400'}>
                        {tx.type === 'Credit' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                      </span>
                      <span className="font-bold">
                        {tx.currency} {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded bg-[#262626] border border-[#3A3A3A] text-[#9CA3AF] font-bold">
                      {tx.channel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 font-bold ${
                      tx.status === 'Settled' ? 'text-emerald-400' :
                      tx.status === 'Pending' ? 'text-blue-400' : 'text-red-400'
                    }`}>
                      {tx.status === 'Settled' ? <CheckCircle2 size={12} /> :
                       tx.status === 'Pending' ? <Clock size={12} /> : <XCircle size={12} />}
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 h-1.5 bg-[#121212] rounded-full overflow-hidden border border-[#262626]">
                        <div 
                          className={`h-full ${tx.risk_score > 30 ? 'bg-red-500' : tx.risk_score > 15 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${tx.risk_score}%` }}
                        />
                      </div>
                      <span className="font-bold">{tx.risk_score}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-[#121212]/50 border-t border-[#3A3A3A] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[10px] text-[#9CA3AF]">
            Showing <span className="text-[#D4A017] font-bold">{txData?.data.length || 0}</span> records of <span className="text-[#FAF7F0] font-bold">{txData?.totalCount.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-[#262626] border border-[#3A3A3A] text-[#D4A017] hover:border-[#D4A017] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-3 py-1 rounded-lg bg-[#121212] border border-[#D4A017]/30 text-[#D4A017] font-bold text-xs">
              {page}
            </div>
            <button 
              onClick={() => setPage(p => Math.min(txData?.totalPages || 1, p + 1))}
              disabled={page >= (txData?.totalPages || 1)}
              className="p-1.5 rounded-lg bg-[#262626] border border-[#3A3A3A] text-[#D4A017] hover:border-[#D4A017] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
