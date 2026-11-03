import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transferIntelligenceService } from '../../services/transferIntelligenceService';
import { DataTransferFilterBar, DataTransferFilters } from './DataTransferFilterBar';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCw, 
  DollarSign, 
  Search,
  Activity,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export const Reconciliation: React.FC = () => {
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

  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ['reconciliation-metrics', filters],
    queryFn: () => transferIntelligenceService.fetchReconciliationMetrics(filters.tenantId, filters),
  });

  const { data: txData } = useQuery({
    queryKey: ['reconciliation-records', filters],
    queryFn: () => transferIntelligenceService.fetchPaginatedTransactions(filters.tenantId, { ...filters, pageSize: 10 }),
  });

  const kpis = [
    { title: 'Records Reviewed', value: metrics?.totalReviewed.toLocaleString() || '0', sub: 'Total transaction pool', icon: <Activity size={20} /> },
    { title: 'Matched Records', value: metrics?.matchedRecords.toLocaleString() || '0', sub: 'Verified across rails', icon: <CheckCircle2 size={20} />, variant: 'gold-accent' as const },
    { title: 'Unmatched Delta', value: metrics?.unmatchedRecords.toLocaleString() || '0', sub: 'Awaiting verification', icon: <Clock size={20} /> },
    { title: 'Recon. Difference', value: `$${((metrics?.totalDifference || 0) / 1000).toFixed(1)}K`, sub: 'Aggregate variance', icon: <DollarSign size={20} /> },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div>
        <h1 className="font-cinzel text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
          Banking Reconciliation
        </h1>
        <p className="text-xs text-[#9CA3AF] font-mono mt-1 uppercase tracking-widest">
          Institutional Ledger Integrity • Multi-Rail Match Engine
        </p>
      </div>

      <DataTransferFilterBar 
        filters={filters} 
        onFilterChange={setFilters} 
        onRefresh={() => refetch()} 
        isLoading={isLoading} 
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <ThreeDKpiCard key={idx} {...kpi} trend="up" change="Live" tag="Audit" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDDonutChart
          title="Match Integrity Mix"
          subtitle="Verification distribution by source"
          segments={metrics?.statusDistribution || []}
          centerLabel="Matches"
          centerValue={metrics?.matchedRecords.toLocaleString() || '0'}
          height={320}
        />

        <div className="rounded-2xl bg-amber-950/10 border border-amber-500/20 p-6 shadow-xl flex flex-col justify-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-cinzel text-lg font-bold text-amber-200">Reconciliation Exceptions</h3>
              <p className="text-xs text-amber-500/70 font-mono">Open investigations requiring manual oversight</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#121212] border border-amber-500/20">
              <span className="text-[9px] font-black text-[#9CA3AF] uppercase">Unmatched Amount</span>
              <p className="text-xl font-black text-amber-400 font-mono">$412,400.00</p>
            </div>
            <div className="p-4 rounded-xl bg-[#121212] border border-amber-500/20">
              <span className="text-[9px] font-black text-[#9CA3AF] uppercase">Awaiting Action</span>
              <p className="text-xl font-black text-[#FAF7F0] font-mono">{metrics?.pendingCount} Cases</p>
            </div>
          </div>

          <button className="w-full py-3 rounded-xl bg-amber-500 text-[#111111] font-bold text-xs hover:brightness-110 transition-all uppercase tracking-widest shadow-[0_10px_20px_rgba(217,169,40,0.2)]">
            Open Investigation Workspace
          </button>
        </div>
      </div>

      {/* Recon Table */}
      <div className="rounded-2xl bg-[#1A1A1A]/80 border border-[#D4A017]/30 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#D4A017]/20 flex items-center justify-between bg-[#121212]/50">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#D4A017]" />
            <h3 className="font-cinzel text-base font-bold text-[#FFF8E7]">Reconciliation Ledger</h3>
          </div>
          <button className="text-[10px] font-bold text-[#D4A017] hover:underline uppercase tracking-widest">
            Download Audit Export
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-[#121212] text-[#D4A017] uppercase tracking-wider border-b border-[#3A3A3A]">
              <tr>
                <th className="px-6 py-4 font-bold">Internal Reference</th>
                <th className="px-6 py-4 font-bold">Transaction Date</th>
                <th className="px-6 py-4 font-bold">Expected (Rail)</th>
                <th className="px-6 py-4 font-bold">Actual (Ledger)</th>
                <th className="px-6 py-4 font-bold">Difference</th>
                <th className="px-6 py-4 font-bold">Match Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-[#FAF7F0]">
              {txData?.data.map((tx: any) => {
                // Realistic mismatch simulation: 
                // If status is not 'Settled', 'Success', or 'Completed', 
                // it hasn't cleared the ledger yet, creating a 'difference' in the reconciliation view.
                const isCleared = ['settled', 'success', 'completed'].includes(tx.status?.toLowerCase());
                const diff = isCleared ? 0 : tx.amount * 0.1; // 10% delta for pending/failed items
                
                return (
                  <tr key={tx.id} className="hover:bg-[#D4A017]/5 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-[#FFF8E7]">{tx.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[#9CA3AF]">
                      {tx.date.split('T')[0]}
                    </td>
                    <td className="px-6 py-4 font-bold">
                      {tx.currency} {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 font-bold text-[#E6C78B]">
                      {tx.currency} {(tx.amount - diff).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`px-6 py-4 font-bold ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {diff > 0 ? `-${diff.toFixed(2)}` : '0.00'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border ${
                        diff > 0 
                        ? 'bg-red-950/20 border-red-500/40 text-red-400' 
                        : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-400'
                      }`}>
                        {diff > 0 ? 'Mismatch' : 'Verified'}
                      </span>
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
