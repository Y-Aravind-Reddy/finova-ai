import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transferIntelligenceService } from '../../services/transferIntelligenceService';
import { DataTransferFilterBar, DataTransferFilters } from './DataTransferFilterBar';
import { 
  Search, 
  Download, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldAlert,
  X,
  CreditCard,
  User,
  Building2,
  Info
} from 'lucide-react';

export const TransactionRecords: React.FC = () => {
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
  const pageSize = 15;
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  const { data: txData, isLoading, refetch } = useQuery({
    queryKey: ['transaction-records', filters, page],
    queryFn: () => transferIntelligenceService.fetchPaginatedTransactions(filters.tenantId, { ...filters, page, pageSize }),
  });

  const handleExport = () => {
    alert('Exporting filtered records to Excel... Node synchronized.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 relative min-h-[800px]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
            Transaction Surveillance Ledger
          </h1>
          <p className="text-xs text-[#9CA3AF] font-mono mt-1 uppercase tracking-widest">
            Institutional Audit Trail • Verified Forensic Records
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#B87333] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg transition-all"
        >
          <Download size={16} />
          EXPORT LEDGER (XLSX)
        </button>
      </div>

      <DataTransferFilterBar 
        filters={filters} 
        onFilterChange={(f) => { setFilters(f); setPage(1); }} 
        onRefresh={() => refetch()} 
        isLoading={isLoading} 
      />

      <div className="rounded-2xl bg-[#1A1A1A]/95 border border-[#D4A017]/30 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-[#121212] text-[#D4A017] uppercase tracking-wider border-b border-[#3A3A3A]">
              <tr>
                <th className="px-6 py-4 font-bold">TXN ID / Date</th>
                <th className="px-6 py-4 font-bold">Identity Reference</th>
                <th className="px-6 py-4 font-bold">Merchant / Counterparty</th>
                <th className="px-6 py-4 font-bold">Amount (Base)</th>
                <th className="px-6 py-4 font-bold">Rail</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-[#FAF7F0]">
              {isLoading ? (
                [...Array(pageSize)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-4 h-16 bg-[#1A1A1A]/30" />
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
                      <span className="font-semibold">{tx.customer_id}</span>
                      <span className="text-[9px] text-[#6B7280]">{tx.account_id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium">{tx.merchant}</span>
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
                    <button 
                      onClick={() => setSelectedTx(tx)}
                      className="p-2 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#D4A017] hover:border-[#F5C542] hover:text-[#F5C542] transition-all"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-[#121212]/50 border-t border-[#3A3A3A] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[10px] text-[#9CA3AF]">
            Records <span className="text-[#D4A017] font-bold">{(page-1)*pageSize + 1} - {Math.min(page*pageSize, txData?.totalCount || 0)}</span> of <span className="text-[#FAF7F0] font-bold">{txData?.totalCount.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-[#262626] border border-[#3A3A3A] text-[#D4A017] hover:border-[#D4A017] disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-3 py-1 rounded-lg bg-[#121212] border border-[#D4A017]/30 text-[#D4A017] font-bold text-xs">
              {page}
            </div>
            <button 
              onClick={() => setPage(p => Math.min(txData?.totalPages || 1, p + 1))}
              disabled={page >= (txData?.totalPages || 1)}
              className="p-1.5 rounded-lg bg-[#262626] border border-[#3A3A3A] text-[#D4A017] hover:border-[#D4A017] disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Detail Panel (Overlay) */}
      {selectedTx && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            onClick={() => setSelectedTx(null)}
          />
          <div className="fixed right-0 top-0 h-screen w-full max-w-md bg-[#121212] border-l border-[#D4A017]/40 shadow-[-20px_0_50px_rgba(0,0,0,0.8)] z-[70] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-[#3A3A3A] flex items-center justify-between bg-[#1A1A1A]">
              <div>
                <h3 className="font-cinzel text-lg font-bold text-[#E6C78B]">Forensic Detail</h3>
                <p className="text-[10px] text-[#9CA3AF] font-mono">Internal ID: {selectedTx.id}</p>
              </div>
              <button 
                onClick={() => setSelectedTx(null)}
                className="p-2 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[#9CA3AF] hover:text-[#FAF7F0]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Financial Summary */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#D4A017]">
                  <CreditCard size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Financial Payload</span>
                </div>
                <div className="rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] p-5 space-y-4 shadow-inner">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[9px] text-[#9CA3AF] uppercase">Gross Amount</p>
                      <p className="text-3xl font-black text-[#FAF7F0] font-mono">
                        {selectedTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-[#D4A017]/10 border border-[#D4A017]/30 text-[#D4A017] font-bold text-sm">
                      {selectedTx.currency}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#3A3A3A]/50">
                    <div>
                      <p className="text-[9px] text-[#9CA3AF] uppercase">TXN Type</p>
                      <p className={`text-xs font-bold ${selectedTx.type === 'Credit' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {selectedTx.type.toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#9CA3AF] uppercase">Status</p>
                      <p className="text-xs font-bold text-[#E6C78B]">{selectedTx.status.toUpperCase()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reference & Audit */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#D4A017]">
                  <Info size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Reference & Audit</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: 'Reference Number', value: selectedTx.reference_no, icon: <FileText size={12} /> },
                    { label: 'Settlement Rail', value: selectedTx.channel, icon: <Building2 size={12} /> },
                    { label: 'Timestamp', value: selectedTx.date, icon: <Clock size={12} /> },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#121212] border border-[#262626]">
                      <div className="flex items-center gap-2">
                        <span className="text-[#D4A017]">{item.icon}</span>
                        <span className="text-[10px] text-[#9CA3AF]">{item.label}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#FAF7F0]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Intelligence */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#D4A017]">
                  <ShieldAlert size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Risk Intelligence</span>
                </div>
                <div className="rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] p-5 space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[#9CA3AF] uppercase">Anomaly Risk Score</span>
                      <span className={`text-xs font-black ${selectedTx.risk_score > 30 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {selectedTx.risk_score} / 100
                      </span>
                    </div>
                    <div className="h-2 bg-[#121212] rounded-full overflow-hidden border border-[#262626]">
                      <div 
                        className={`h-full ${selectedTx.risk_score > 30 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${selectedTx.risk_score}%` }}
                      />
                    </div>
                  </div>
                  
                  {selectedTx.is_flagged_fraud && (
                    <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/40 flex items-center gap-3">
                      <ShieldAlert className="text-red-500 shrink-0" size={18} />
                      <p className="text-[10px] text-red-200 font-bold leading-tight">
                        SYSTEM ALERT: High-priority surveillance hit. Multi-hop velocity spike detected.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Identity & Origin */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#D4A017]">
                  <User size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Identity & Origin</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: 'Institutional Client', value: selectedTx.customer_id },
                    { label: 'Settlement Account', value: selectedTx.account_id },
                    { label: 'Counterparty', value: selectedTx.merchant },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#121212] border border-[#262626]">
                      <span className="text-[10px] text-[#9CA3AF]">{item.label}</span>
                      <span className="text-xs font-mono font-bold text-[#E6C78B]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#3A3A3A] bg-[#1A1A1A]">
              <button 
                onClick={() => setSelectedTx(null)}
                className="w-full py-3 rounded-xl bg-[#121212] border border-[#D4A017]/40 text-[#D4A017] font-bold text-xs hover:bg-[#D4A017] hover:text-[#111111] transition-all uppercase tracking-widest"
              >
                Close Perspective
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
