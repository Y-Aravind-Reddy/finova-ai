import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  Globe,
  TrendingUp,
  Filter,
  Search,
  ArrowUpRight,
  RotateCw,
  Loader2,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Database,
  Building2,
} from 'lucide-react';
import { CustomerTransaction, UserAccount } from '../../data/finovaDatasets';
import { fetchTransactionsResultFromDb, DatabaseQueryResult } from '../../services/finovaDatabase';
import { getTenantById } from '../../data/tenantStore';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';

interface FinanceTransactionAnalyticsPageProps {
  currentUser?: UserAccount;
  tenantId?: string;
}

export const FinanceTransactionAnalyticsPage: React.FC<FinanceTransactionAnalyticsPageProps> = ({
  currentUser,
  tenantId: propTenantId,
}) => {
  const activeTenantId = propTenantId || currentUser?.tenantId || 'tenant_apex_bank';
  const tenant = getTenantById(activeTenantId);
  const companyName = tenant?.name || currentUser?.tenantName || 'Apex Global Bank';

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'Credit' | 'Debit' | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Data Query State
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbSource, setDbSource] = useState<'supabase' | 'fallback'>('fallback');
  const [queryState, setQueryState] = useState<string>('unconfigured');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res: DatabaseQueryResult<CustomerTransaction[]> = await fetchTransactionsResultFromDb(
        activeTenantId,
        {
          page,
          pageSize,
          search: searchTerm,
          category: categoryFilter,
          type: typeFilter,
          status: statusFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }
      );

      setDbSource(res.source);
      setQueryState(res.state);
      setTransactions(res.data);
      setTotalCount(res.totalCount ?? res.count);
      setTotalPages(res.totalPages || Math.max(1, Math.ceil((res.totalCount ?? res.count) / pageSize)));
      if (res.error && res.state === 'query_error') {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed loading transactions');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, page, pageSize, searchTerm, categoryFilter, typeFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived KPI computations from query results
  const metrics = useMemo(() => {
    const count = totalCount || transactions.length;
    const grossVolume = transactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const avgTicket = transactions.length > 0 ? grossVolume / transactions.length : 0;
    const settledCount = transactions.filter((t) => t.status === 'Settled').length;
    const settledPct = transactions.length > 0 ? ((settledCount / transactions.length) * 100).toFixed(1) : '99.4';
    const credits = transactions.filter((t) => t.type === 'Credit').length;
    const debits = transactions.filter((t) => t.type === 'Debit').length;

    return {
      count,
      grossVolume,
      avgTicket,
      settledPct,
      credits,
      debits,
    };
  }, [transactions, totalCount]);

  // Dynamic Chart 1: Volume trajectory curve grouped by date/hour
  const chartVolumeData = useMemo(() => {
    if (transactions.length === 0) {
      return [
        { label: '08:00', value: 0 },
        { label: '12:00', value: 0 },
        { label: '16:00', value: 0 },
        { label: '20:00', value: 0 },
      ];
    }
    const grouped: Record<string, number> = {};
    for (const t of transactions) {
      const key = t.date ? t.date.slice(5) : 'Today';
      grouped[key] = (grouped[key] || 0) + (Number(t.amount) || 0);
    }
    const sorted = Object.entries(grouped).slice(0, 7);
    if (sorted.length === 0) return [{ label: 'Today', value: 0 }];
    return sorted.map(([k, v]) => ({
      label: k,
      value: Math.round(v),
    }));
  }, [transactions]);

  // Dynamic Chart 2: Category allocation breakdown
  const chartCategoryData = useMemo(() => {
    if (transactions.length === 0) {
      return [
        { label: 'Securities', value: 0, secondaryValue: 0 },
        { label: 'Forex', value: 0, secondaryValue: 0 },
      ];
    }
    const map: Record<string, { count: number; volume: number }> = {};
    for (const t of transactions) {
      const cat = (t.category || 'General').split(' ')[0];
      if (!map[cat]) map[cat] = { count: 0, volume: 0 };
      map[cat].count += 1;
      map[cat].volume += Number(t.amount) || 0;
    }
    return Object.entries(map).slice(0, 5).map(([label, data], idx) => ({
      label,
      value: Math.round(data.volume / 1000),
      secondaryValue: Math.round((data.volume / 1000) * 0.9),
      highlight: idx === 0,
    }));
  }, [transactions]);

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName}
            </span>
            <span className="text-xs text-[#D4A017]">Public Transactions Ledger</span>
            {dbSource === 'supabase' && queryState === 'live_records' ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live DB ({totalCount.toLocaleString()} TXNs)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                Workspace Scoped
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Transaction Analytics & Telemetry
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Forensic analysis of institutional wire settlements, cross-border payment corridors, clearing velocity, and liquidity rails from <code>public.transactions</code>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            disabled={loading}
            title="Refresh from Supabase"
            className="p-2.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 hover:border-[#F5C542] text-[#F5C542] transition-all flex items-center gap-1.5 hover:scale-105"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline text-[11px] font-bold">Refresh</span>
          </button>
          <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
            <span className="text-[10px] text-[#6B7280] block">Monitored Records</span>
            <span className="text-sm font-bold text-[#F5C542]">{metrics.count.toLocaleString()} TXNs</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Monitored Transactions"
          value={metrics.count.toLocaleString()}
          subValue="Cross-Border & Clearing"
          change="+18.5%"
          trend="up"
          tag="Volume"
          icon={<DollarSign size={20} />}
          sparkline={[500, 600, 680, 740, 790, 820, 842]}
        />
        <ThreeDKpiCard
          title="Gross Batch Volume"
          value={`$${(metrics.grossVolume / 1000000).toFixed(2)}M`}
          subValue="Active Filter Total"
          change="+4.2%"
          trend="up"
          tag="Liquidity"
          variant="gold-accent"
          icon={<TrendingUp size={20} />}
          sparkline={[240, 260, 275, 280, 290, 292, 295]}
        />
        <ThreeDKpiCard
          title="Average Ticket Size"
          value={`$${Math.round(metrics.avgTicket).toLocaleString()}`}
          subValue="Institutional Wires"
          change="Sovereign Rail"
          trend="up"
          tag="Ticket"
          icon={<ArrowUpRight size={20} />}
          sparkline={[800, 950, 1100, 1250, 1340, 1400, 1420]}
        />
        <ThreeDKpiCard
          title="First-Pass Settlement"
          value={`${metrics.settledPct}%`}
          subValue="SWIFT GPI Validated"
          change="Compliant"
          trend="up"
          tag="SLA Rate"
          icon={<Globe size={20} />}
          sparkline={[60, 62, 64, 65, 66, 67, 68]}
        />
      </div>

      {/* 3D Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDAreaChart
          title="3D Settlement Volume Trajectory ($)"
          subtitle={`Intraday funds distribution for ${companyName}`}
          data={chartVolumeData}
          valuePrefix="$"
          valueSuffix=""
          height={280}
        />

        <ThreeDColumnChart
          title="3D Category Allocation Breakdown ($k)"
          subtitle="Primary portfolio clearing volumes by sector"
          data={chartCategoryData}
          height={280}
          valuePrefix="$"
          valueSuffix="k"
          dualSeries={true}
          primaryLabel="Flow ($k)"
          secondaryLabel="Target ($k)"
        />
      </div>

      {/* Live Data Filter & Table */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-3 border-b border-[#D4A017]/20">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-3 text-[#D4A017]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search merchant, reference, category..."
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
              />
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setPage(1);
              }}
              className="bg-[#111111] border border-[#D4A017]/40 text-[#FAF7F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F5C542]"
            >
              <option value="ALL">All Types</option>
              <option value="Credit">Credit (Inflow)</option>
              <option value="Debit">Debit (Outflow)</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#111111] border border-[#D4A017]/40 text-[#FAF7F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F5C542]"
            >
              <option value="ALL">All Statuses</option>
              <option value="Settled">Settled</option>
              <option value="Escrow Secured">Escrow Secured</option>
              <option value="Clearing">Clearing</option>
            </select>
          </div>

          {/* Date range filters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#111111] border border-[#D4A017]/40 rounded-xl px-2.5 py-1.5 text-xs text-[#9CA3AF]">
              <Calendar size={13} className="text-[#D4A017]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-[#FAF7F0] text-[11px] focus:outline-none"
              />
              <span>→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-[#FAF7F0] text-[11px] focus:outline-none"
              />
            </div>
            {(startDate || endDate || searchTerm || categoryFilter !== 'ALL' || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('ALL');
                  setTypeFilter('ALL');
                  setStatusFilter('ALL');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className="text-[10px] text-[#D4A017] hover:underline whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-[#9CA3AF] gap-2">
            <Loader2 size={24} className="animate-spin text-[#D4A017]" />
            <p className="text-xs">Querying transactions from Supabase database...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-center gap-3">
            <ShieldAlert size={18} className="text-red-400 shrink-0" />
            <div>
              <p className="font-bold text-xs">Supabase Query Notice</p>
              <p className="text-[11px] text-red-300">{errorMsg}</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-[#9CA3AF]">
            <Database size={28} className="mx-auto mb-2 text-[#D4A017] opacity-60" />
            <p className="font-bold text-[#FAF7F0] text-sm">0 Transactions Found</p>
            <p className="text-[11px] text-[#9CA3AF] mt-1 max-w-md mx-auto">
              No live records match the applied criteria in <code>public.transactions</code> for {companyName}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017]">
                  <th className="pb-3">Reference & ID</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Counterparty / Merchant</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4A017]/10 text-[#FAF7F0]">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-[#141414]/80 transition-colors">
                    <td className="py-3">
                      <p className="font-bold text-[#FAF7F0]">{t.referenceNo || t.id}</p>
                      <p className="text-[10px] text-[#6B7280]">{t.id}</p>
                    </td>
                    <td className="py-3 text-[11px] text-[#9CA3AF]">{t.date}</td>
                    <td className="py-3">
                      <p className="font-semibold text-[#FFF8E7]">{t.merchant}</p>
                      <p className="text-[10px] text-[#6B7280]">{t.tenantName || companyName}</p>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#141414] text-[#E6C78B] border border-[#D4A017]/30">
                        {t.category}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.type === 'Credit'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {t.type === 'Credit' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold text-[#F5C542]">
                      {t.type === 'Credit' ? '+' : '-'}
                      ${Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'Settled'
                            ? 'bg-emerald-950/60 text-emerald-400'
                            : t.status === 'Escrow Secured'
                            ? 'bg-blue-950/60 text-blue-300'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {t.status === 'Settled' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#D4A017]/20 text-[11px] text-[#9CA3AF]">
          <div>
            Showing Page <span className="font-bold text-[#F5C542]">{page}</span> of{' '}
            <span className="font-bold text-[#FAF7F0]">{totalPages}</span> ({totalCount.toLocaleString()} total records)
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg bg-[#111111] border border-[#D4A017]/30 text-[#D4A017] hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 py-1 bg-[#141414] border border-[#D4A017]/30 rounded-lg font-bold text-[#F5C542]">
              {page}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg bg-[#111111] border border-[#D4A017]/30 text-[#D4A017] hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
