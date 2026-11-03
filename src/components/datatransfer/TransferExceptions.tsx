import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transferIntelligenceService } from '../../services/transferIntelligenceService';
import { DataTransferFilterBar, DataTransferFilters } from './DataTransferFilterBar';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  RotateCw, 
  FileWarning, 
  Activity,
  XCircle,
  ExternalLink
} from 'lucide-react';

export const TransferExceptions: React.FC = () => {
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
    queryKey: ['exception-metrics', filters],
    queryFn: () => transferIntelligenceService.fetchExceptionMetrics(filters.tenantId, filters),
  });

  const { data: txData } = useQuery({
    queryKey: ['exception-records', filters],
    queryFn: () => transferIntelligenceService.fetchPaginatedTransactions(filters.tenantId, { ...filters, status: 'Failed', pageSize: 10 }),
  });

  const kpis = [
    { title: 'Failed Transfers', value: metrics?.failedCount.toLocaleString() || '0', sub: 'Clearing rejections', icon: <XCircle size={20} />, variant: 'gold-accent' as const },
    { title: 'Open Investigations', value: metrics?.openInvestigations.toLocaleString() || '0', sub: 'Active forensic cases', icon: <Activity size={20} /> },
    { title: 'High-Risk Hits', value: metrics?.fraudCount.toLocaleString() || '0', sub: 'Surveillance matches', icon: <ShieldAlert size={20} /> },
    { title: 'Error Records', value: metrics?.errorRecords.toLocaleString() || '0', sub: 'System log exceptions', icon: <FileWarning size={20} /> },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
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

      <DataTransferFilterBar 
        filters={filters} 
        onFilterChange={setFilters} 
        onRefresh={() => refetch()} 
        isLoading={isLoading} 
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <ThreeDKpiCard key={idx} {...kpi} trend="down" change="Critical" tag="Alert" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDDonutChart
          title="Error Code Taxonomy"
          subtitle="Top rejection reasons across rails"
          segments={metrics?.errorCodeDistribution || []}
          centerLabel="Errors"
          centerValue={metrics?.failedCount.toString() || '0'}
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
            Investigations Required: {metrics?.openInvestigations}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-[#121212] text-[#D4A017] uppercase tracking-wider border-b border-[#3A3A3A]">
              <tr>
                <th className="px-6 py-4 font-bold">TXN ID / Reference</th>
                <th className="px-6 py-4 font-bold">Error Payload</th>
                <th className="px-6 py-4 font-bold">Amount</th>
                <th className="px-6 py-4 font-bold text-center">Risk</th>
                <th className="px-6 py-4 font-bold">Inv. Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-[#FAF7F0]">
              {txData?.data.map((tx: any, idx: number) => {
                const errorCode = ['ERR_RAIL_TIMEOUT', 'ERR_INSUFFICIENT_FUNDS', 'ERR_AML_BLOCK'][idx % 3];
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
                        <span className="text-red-400 font-bold">{errorCode}</span>
                        <span className="text-[9px] text-[#9CA3AF]">Rail rejection at gateway node</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#9CA3AF]">
                      {tx.currency} {tx.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black ${tx.risk_score > 25 ? 'bg-red-950/40 text-red-400 border border-red-500/40' : 'bg-amber-950/40 text-amber-400 border border-amber-500/40'}`}>
                        {tx.risk_score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#9CA3AF]">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Pending Review
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
