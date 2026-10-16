import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  Search,
  DollarSign,
  RotateCw,
  Loader2,
  Building2,
  Database,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { FinanceFraudTransaction, UserAccount } from '../../data/finovaDatasets';
import { fetchFraudCasesResultFromDb, updateFraudCaseStatusInDb, DatabaseQueryResult } from '../../services/finovaDatabase';
import { getTenantById } from '../../data/tenantStore';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';

interface FinanceFraudDetectionPageProps {
  currentUser?: UserAccount;
  tenantId?: string;
}

export const FinanceFraudDetectionPage: React.FC<FinanceFraudDetectionPageProps> = ({
  currentUser,
  tenantId: propTenantId,
}) => {
  const activeTenantId = propTenantId || currentUser?.tenantId || 'tenant_apex_bank';
  const tenant = getTenantById(activeTenantId);
  const companyName = tenant?.name || currentUser?.tenantName || 'Apex Global Bank';

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Data State
  const [cases, setCases] = useState<FinanceFraudTransaction[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbSource, setDbSource] = useState<'supabase' | 'fallback'>('fallback');
  const [queryState, setQueryState] = useState<string>('unconfigured');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadFraudCases = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res: DatabaseQueryResult<FinanceFraudTransaction[]> = await fetchFraudCasesResultFromDb(
        activeTenantId,
        {
          page,
          pageSize,
          search: searchTerm,
          status: statusFilter,
          currency: currencyFilter,
        }
      );

      setDbSource(res.source);
      setQueryState(res.state);
      setCases(res.data);
      setTotalCount(res.totalCount ?? res.count);
      setTotalPages(res.totalPages || Math.max(1, Math.ceil((res.totalCount ?? res.count) / pageSize)));

      if (res.error && res.state === 'query_error') {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed querying fraud surveillance cases');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, page, pageSize, searchTerm, statusFilter, currencyFilter]);

  useEffect(() => {
    loadFraudCases();
  }, [loadFraudCases]);

  // Handle case status update
  const handleUpdateStatus = async (caseId: string, newStatus: string) => {
    const res = await updateFraudCaseStatusInDb(caseId, newStatus);
    if (res.success) {
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, status: newStatus as any } : c)));
      setActionSuccess(`Case ${caseId} updated to ${newStatus}.`);
      setTimeout(() => setActionSuccess(null), 3500);
    } else {
      alert(`Status update failed: ${res.error}`);
    }
  };

  // Dynamic KPI Metrics
  const metrics = useMemo(() => {
    const count = totalCount || cases.length;
    const prevented = cases.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
    const avgScore = cases.length > 0 ? cases.reduce((acc, c) => acc + (c.riskScore || 50), 0) / cases.length : 0;
    const frozenCount = cases.filter((c) => c.status === 'Frozen Escrow').length;
    const avgConfidence = cases.length > 0 ? (cases.reduce((acc, c) => acc + (c.aiConfidencePct || 98.4), 0) / cases.length).toFixed(2) : '99.40';

    return {
      count,
      prevented,
      avgScore: Math.round(avgScore),
      frozenCount,
      avgConfidence,
    };
  }, [cases, totalCount]);

  // Dynamic 3D chart from cases data
  const chartTrend = useMemo(() => {
    if (cases.length === 0) {
      return [
        { label: 'Q1', value: 0, secondaryValue: 0 },
        { label: 'Q2', value: 0, secondaryValue: 0 },
      ];
    }
    const grouped: Record<string, { volume: number; threats: number }> = {};
    for (const c of cases) {
      const key = (c.timestamp || 'Today').slice(0, 7) || 'Current';
      if (!grouped[key]) grouped[key] = { volume: 0, threats: 0 };
      grouped[key].volume += Number(c.amount) || 0;
      grouped[key].threats += 1;
    }
    const entries = Object.entries(grouped).slice(0, 6);
    if (entries.length === 0) return [{ label: 'Today', value: 0, secondaryValue: 0 }];
    return entries.map(([label, d], idx) => ({
      label,
      value: Math.round(d.volume / 1000),
      secondaryValue: Math.round(d.threats * 10),
      highlight: idx === entries.length - 1,
    }));
  }, [cases]);

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header Banner */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName}
            </span>
            <span className="text-xs text-[#D4A017]">Forensic AML Surveillance</span>
            {dbSource === 'supabase' && queryState === 'live_records' ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live DB ({totalCount.toLocaleString()} Cases)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                Workspace Scoped
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Fraud Detection & AML Surveillance
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Predictive machine learning models intercepting suspicious wire transfers, credential theft, and transaction layering from <code>public.fraud_cases</code>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadFraudCases()}
            disabled={loading}
            title="Refresh fraud cases from Supabase"
            className="p-2.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 hover:border-[#F5C542] text-[#F5C542] transition-all flex items-center gap-1.5 hover:scale-105"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline text-[11px] font-bold">Refresh</span>
          </button>
          <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
            <span className="text-[10px] text-[#6B7280] block">Monitored Cases</span>
            <span className="text-sm font-bold text-[#F5C542]">{metrics.count.toLocaleString()} Flagged</span>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Prevented / Flagged Volume"
          value={`$${(metrics.prevented / 1000000).toFixed(2)}M`}
          subValue={`${metrics.count.toLocaleString()} Total Inquiries`}
          change="+32.1%"
          trend="up"
          tag="Interception"
          icon={<DollarSign size={20} />}
          sparkline={[120, 180, 240, 310, 390, 440, 482]}
        />
        <ThreeDKpiCard
          title="Average Risk Score"
          value={`${metrics.avgScore}/100`}
          subValue="Threshold: &gt;75 Critical"
          change="Inline Scored"
          trend="up"
          tag="ML Scoring"
          variant="gold-accent"
          icon={<ShieldAlert size={20} />}
          sparkline={[22, 20, 18, 17, 16, 15, 14]}
        />
        <ThreeDKpiCard
          title="Active Fraud Locks"
          value={`${metrics.frozenCount} Cases`}
          subValue="Collateral Secured in Escrow"
          change="Regulated"
          trend="down"
          tag="Locked"
          icon={<Lock size={20} />}
          sparkline={[5, 6, 6, 7, 7, 7, 7]}
        />
        <ThreeDKpiCard
          title="Ensemble Confidence"
          value={`${metrics.avgConfidence}%`}
          subValue="Random Forest & XGBoost"
          change="Calibrated"
          trend="up"
          tag="Model SLA"
          icon={<CheckCircle2 size={20} />}
          sparkline={[99.4, 99.5, 99.6, 99.7, 99.8, 99.8, 99.88]}
        />
      </div>

      {/* 3D Column Chart */}
      <ThreeDColumnChart
        title="3D Prevented Fraud Volumes vs Threat Vectors ($k)"
        subtitle={`Historical telemetry from public.fraud_cases for ${companyName}`}
        data={chartTrend}
        height={280}
        valuePrefix="$"
        valueSuffix="k"
        dualSeries={true}
        primaryLabel="Volume ($k)"
        secondaryLabel="Threat Level"
      />

      {/* Incidents / Cases Table & Filters */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-[#D4A017]/20">
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
                placeholder="Search entity, vector, case ID..."
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#111111] border border-[#D4A017]/40 text-[#FAF7F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F5C542]"
            >
              <option value="ALL">All Statuses</option>
              <option value="Flagged">Flagged</option>
              <option value="In Review">In Review</option>
              <option value="Frozen Escrow">Frozen Escrow</option>
              <option value="Cleared">Cleared</option>
            </select>

            <select
              value={currencyFilter}
              onChange={(e) => {
                setCurrencyFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#111111] border border-[#D4A017]/40 text-[#FAF7F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F5C542]"
            >
              <option value="ALL">All Currencies</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
            </select>
          </div>

          {(searchTerm || statusFilter !== 'ALL' || currencyFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setCurrencyFilter('ALL');
                setPage(1);
              }}
              className="text-[10px] text-[#D4A017] hover:underline self-start sm:self-auto"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-[#9CA3AF] gap-2">
            <Loader2 size={24} className="animate-spin text-[#D4A017]" />
            <p className="text-xs">Querying public.fraud_cases from Supabase...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-center gap-3">
            <ShieldAlert size={18} className="text-red-400 shrink-0" />
            <div>
              <p className="font-bold text-xs">Query Error</p>
              <p className="text-[11px] text-red-300">{errorMsg}</p>
            </div>
          </div>
        ) : cases.length === 0 ? (
          <div className="py-12 text-center text-[#9CA3AF]">
            <Database size={28} className="mx-auto mb-2 text-[#D4A017] opacity-60" />
            <p className="font-bold text-[#FAF7F0] text-sm">0 Fraud Cases Found</p>
            <p className="text-[11px] text-[#9CA3AF] mt-1 max-w-md mx-auto">
              No surveillance incident records matched the current filter in <code>public.fraud_cases</code> for {companyName}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017]">
                  <th className="pb-3">Case ID & Timestamp</th>
                  <th className="pb-3">Entity / Customer</th>
                  <th className="pb-3">Surveillance Vector</th>
                  <th className="pb-3">Risk Score</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-right">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4A017]/10 text-[#FAF7F0]">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-[#141414]/80 transition-colors">
                    <td className="py-3">
                      <p className="font-bold text-[#FAF7F0]">{c.id}</p>
                      <p className="text-[10px] text-[#6B7280]">{c.timestamp ? c.timestamp.replace('T', ' ').slice(0, 16) : 'Just now'}</p>
                    </td>
                    <td className="py-3">
                      <p className="font-semibold text-[#FFF8E7]">{c.customerName}</p>
                      <p className="text-[10px] text-[#6B7280]">{c.tenantName || companyName} • {c.location || 'Global'}</p>
                    </td>
                    <td className="py-3 max-w-xs">
                      <p className="text-[#E6C78B] font-medium truncate">{c.ruleTriggered}</p>
                      <span className="text-[10px] text-[#9CA3AF]">{c.amlFlag}</span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.riskScore >= 80
                            ? 'bg-red-950/80 text-red-400 border border-red-500/40'
                            : c.riskScore >= 60
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {c.riskScore}/100
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold text-[#F5C542]">
                      ${Number(c.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {c.currency}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'Frozen Escrow'
                            ? 'bg-red-950/80 text-red-400 border border-red-500/50'
                            : c.status === 'Flagged'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50'
                            : c.status === 'In Review'
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-500/50'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50'
                        }`}
                      >
                        {c.status === 'Frozen Escrow' ? <Lock size={10} /> : <AlertTriangle size={10} />}
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <select
                        value={c.status}
                        onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                        className="bg-[#111111] border border-[#D4A017]/40 text-[#D4A017] rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                      >
                        <option value="Flagged">Flagged</option>
                        <option value="In Review">In Review</option>
                        <option value="Frozen Escrow">Freeze Escrow</option>
                        <option value="Cleared">Clear Case</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#D4A017]/20 text-[11px] text-[#9CA3AF]">
          <div>
            Showing Page <span className="font-bold text-[#F5C542]">{page}</span> of{' '}
            <span className="font-bold text-[#FAF7F0]">{totalPages}</span> ({totalCount.toLocaleString()} total incidents)
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
