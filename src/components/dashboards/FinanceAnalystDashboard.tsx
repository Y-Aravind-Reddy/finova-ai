import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FinanceFraudTransaction,
  UserAccount,
  UserRole,
} from '../../data/finovaDatasets';
import {
  fetchFraudCasesResultFromDb,
  fetchKycAggregatesResultFromDb,
  updateFraudCaseStatusInDb,
  fetchFraudAggregatesResultFromDb,
  fetchTransactionAggregatesResultFromDb,
  mapResultStateToTelemetryStatus,
  TelemetryNodeStatus,
  DateRangePreset,
  getDefaultBoundedDateRange,
} from '../../services/finovaDatabase';
import { WidgetFailureNotice, WidgetStatusBadge } from '../common/WidgetTelemetryStatus';
import { convertToInr } from '../../services/currencyService';
import { getTenantById } from '../../data/tenantStore';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDTransactionHeatmap } from '../charts3d/ThreeDTransactionHeatmap';
import { ThreeDPieChart } from '../charts3d/ThreeDPieChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { UserManagementModal } from '../UserManagementModal';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  UserPlus,
  FileText,
  Building2,
  RotateCw,
  Activity
} from 'lucide-react';

interface FinanceAnalystDashboardProps {
  currentRole: UserRole;
  users: UserAccount[];
  onUpdateUsers: (newUsers: UserAccount[]) => void;
  activeSection?: string;
  currentUser?: UserAccount;
}

const FinanceAnalystDashboard: React.FC<FinanceAnalystDashboardProps> = ({
  currentRole,
  users,
  onUpdateUsers,
  activeSection = 'dashboard',
  currentUser,
}) => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('YTD');
  const dateRange = useMemo(() => getDefaultBoundedDateRange(datePreset), [datePreset]);

  const tenantId = currentUser?.tenantId || 'tenant_apex_bank';
  const tenant = getTenantById(tenantId);
  const companyName = tenant?.name || currentUser?.tenantName || 'Apex Global Bank';

  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTableTab, setActiveTableTab] = useState<'suspicious' | 'high_risk' | 'merchants' | 'reports'>('suspicious');

  const { data: fResult, isLoading: fListLoading, isFetching: fListFetching, refetch: refetchFraudCases } = useQuery({
    queryKey: ['analyst-fraud-cases', tenantId, dateRange],
    queryFn: ({ signal }) =>
      fetchFraudCasesResultFromDb(tenantId, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        countMode: 'estimated',
        signal,
      }),
  });

  const { data: fraudAggregates, isLoading: fAggLoading, isFetching: fAggFetching, refetch: refetchFraudAgg } = useQuery({
    queryKey: ['analyst-fraud-agg', tenantId, dateRange],
    queryFn: ({ signal }) =>
      fetchFraudAggregatesResultFromDb(tenantId, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        signal,
      }),
  });

  const { data: transactionAggregates, isLoading: tAggLoading, isFetching: tAggFetching, refetch: refetchTxAgg } = useQuery({
    queryKey: ['analyst-tx-agg', tenantId, dateRange],
    queryFn: ({ signal }) =>
      fetchTransactionAggregatesResultFromDb(tenantId, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        signal,
      }),
  });

  const { data: kycAggregates, isLoading: kycLoading, isFetching: kycFetching, refetch: refetchKycAgg } = useQuery({
    queryKey: ['analyst-kyc-agg', tenantId],
    queryFn: ({ signal }) => fetchKycAggregatesResultFromDb(tenantId, { signal }),
  });

  const fraudCases: FinanceFraudTransaction[] = fResult?.data || [];
  const kycQueueCount = kycAggregates?.totalCount ?? 0;
  const loading = fListLoading || fAggLoading || tAggLoading || kycLoading;
  const dbSource = fResult?.source === 'supabase' && transactionAggregates?.source === 'supabase' ? 'supabase' : 'fallback';

  const domainStatuses = useMemo(() => ({
    fraudCases: mapResultStateToTelemetryStatus(fResult?.state, fResult?.source, fListLoading),
    fraudAgg: mapResultStateToTelemetryStatus(fraudAggregates?.state, fraudAggregates?.source, fAggLoading),
    txAgg: mapResultStateToTelemetryStatus(transactionAggregates?.state, transactionAggregates?.source, tAggLoading),
    kycAgg: mapResultStateToTelemetryStatus(kycAggregates?.state, kycAggregates?.source, kycLoading),
  }), [fResult, fListLoading, fraudAggregates, fAggLoading, transactionAggregates, tAggLoading, kycAggregates, kycLoading]);

  const telemetryStatus: TelemetryNodeStatus = useMemo(() => {
    const vals = Object.values(domainStatuses);
    if (vals.includes('UNAVAILABLE')) return 'UNAVAILABLE';
    if (vals.includes('TIMEOUT')) return 'TIMEOUT';
    if (vals.includes('DEGRADED')) return 'DEGRADED';
    if (vals.includes('RESTRICTED')) return 'RESTRICTED';
    return 'OPERATIONAL';
  }, [domainStatuses]);

  const dbError = useMemo(() => {
    const errs = [fResult?.error, fraudAggregates?.error, transactionAggregates?.error, kycAggregates?.error].filter(
      (msg): msg is string => Boolean(msg)
    );
    return errs.length > 0 ? Array.from(new Set(errs)).join(' | ') : null;
  }, [fResult, fraudAggregates, transactionAggregates, kycAggregates]);

  const loadAllData = () => {
    refetchFraudCases();
    refetchFraudAgg();
    refetchTxAgg();
    refetchKycAgg();
  };

  useEffect(() => {
    if (activeSection === 'finance_customer_insights') {
      setActiveTableTab('high_risk');
    } else if (activeSection === 'reports') {
      setActiveTableTab('reports');
    } else if (activeSection === 'finance_fraud_detection' || activeSection === 'finance_aml_monitoring') {
      setActiveTableTab('suspicious');
    }
  }, [activeSection]);

  // Derived metrics from fraud records
  const metrics = React.useMemo(() => {
    const totalCases = fraudAggregates?.totalCases ?? fraudCases.length;
    const avgScore =
      fraudCases.length > 0
        ? (fraudCases.reduce((acc, t) => acc + (Number(t.riskScore) || 0), 0) / fraudCases.length).toFixed(1)
        : '0.0';

    return {
      totalCases,
      avgScore,
    };
  }, [fraudCases, fraudAggregates]);

  // 3D Area Chart: Daily Settlement Volume in INR (₹ Millions)
  const settlementFlowData = React.useMemo(() => {
    if (transactionAggregates?.volumeByDay && transactionAggregates.volumeByDay.length > 0) {
      return transactionAggregates.volumeByDay.map((d) => ({
        label: d.date,
        value: Math.round((d.volumeInr / 1000000) * 10) / 10,
      }));
    }
    return [];
  }, [transactionAggregates]);

  // 3D Donut Chart: Transaction Categories Distribution in INR
  const categoryDonutData = React.useMemo(() => {
    if (transactionAggregates?.categoryBreakdown && Object.keys(transactionAggregates.categoryBreakdown).length > 0) {
      const totalVol = Object.values(transactionAggregates.categoryBreakdown).reduce((a, b) => a + b.volumeInr, 0) || 1;
      return Object.entries(transactionAggregates.categoryBreakdown).map(([cat, d]) => ({
        label: cat,
        value: d.count,
        subtext: `₹${(d.volumeInr / 1000000).toFixed(1)}M (${Math.round((d.volumeInr / totalVol) * 100)}%)`,
      }));
    }
    return [];
  }, [transactionAggregates]);

  // 3D Pie Chart: Risk Tier Distribution
  const riskPieData = React.useMemo(() => {
    if (fraudAggregates?.riskTierDistribution && fraudAggregates.riskTierDistribution.length > 0) {
      return fraudAggregates.riskTierDistribution.map((r) => ({
        label: r.tier.split(' ')[0] + ' ' + (r.tier.split(' ')[1] || ''),
        value: r.count,
        subtext: `₹${(r.volumeInr / 1000000).toFixed(1)}M INR`,
      }));
    }
    return [];
  }, [fraudAggregates]);

  // 3D Column Chart: Payment Rails & Channels
  const channelColumnData = React.useMemo(() => {
    if (fraudAggregates?.channelDistribution && fraudAggregates.channelDistribution.length > 0) {
      return fraudAggregates.channelDistribution.map((c) => ({
        label: c.channel.split(' ')[0],
        value: c.count,
        secondaryValue: Math.round(c.volumeInr / 1000000),
      }));
    }
    return [];
  }, [fraudAggregates]);

  // High Risk Counterparties derived directly from active fraud cases
  const highRiskCustomers = React.useMemo(() => {
    return fraudCases
      .filter((t) => (t.riskScore || 0) >= 70)
      .map((t) => {
        const inr = convertToInr(t.amount, t.currency || 'INR');
        return {
          id: t.customerId || t.id,
          name: t.customerName,
          riskScore: t.riskScore,
          flaggedVolumeInr: `₹${inr.amountInr.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          originalVolume: t.currency && t.currency !== 'INR' ? `${t.currency} ${t.amount.toLocaleString()}` : null,
          jurisdiction: t.location || 'Global Clearing Rail',
          status: t.status,
        };
      });
  }, [fraudCases]);

  // Top Settlement Counterparties / Merchants
  const topMerchantsList = React.useMemo(() => {
    if (transactionAggregates?.topMerchants && transactionAggregates.topMerchants.length > 0) {
      return transactionAggregates.topMerchants;
    }
    return [];
  }, [transactionAggregates]);

  // Risk Reports for this tenant derived from confirmed flagged anomalies
  const riskReports = React.useMemo(() => {
    return fraudCases
      .filter((t) => t.status === 'Frozen Escrow' || (t.riskScore && t.riskScore >= 80))
      .map((t, idx) => ({
        id: `REP-${tenantId.slice(7, 10).toUpperCase()}-2026-${String(idx + 1).padStart(2, '0')}`,
        title: `${t.ruleTriggered || 'Rapid Velocity Spike'} Surveillance Investigation`,
        date: t.timestamp?.split(' ')[0] || new Date().toISOString().split('T')[0],
        analyst: currentUser?.name || 'Julian Thorne',
        threatLevel: (t.riskScore || 85) >= 85 ? 'Critical Anomaly' : 'Elevated Threat',
        status: t.status === 'Frozen Escrow' ? 'Escrow Frozen' : 'SAR Documented',
      }));
  }, [fraudCases, tenantId, currentUser]);

  const handleEscalateOrFreeze = async (txnId: string, action: 'Freeze' | 'Clear') => {
    setActionError(null);
    const newStatus = action === 'Freeze' ? 'Frozen Escrow' : 'Cleared';
    const res = await updateFraudCaseStatusInDb(txnId, newStatus);
    if (!res.success) {
      setActionError(`Failed to update fraud case ${txnId}: ${res.error || 'Database update rejected.'}`);
      return;
    }
    queryClient.setQueryData(['analyst-fraud-cases', tenantId, dateRange], (prev: any) => {
      if (!prev || !Array.isArray(prev.data)) return prev;
      return {
        ...prev,
        data: prev.data.map((t: FinanceFraudTransaction) =>
          t.id === txnId
            ? {
                ...t,
                status: newStatus as any,
                riskScore: action === 'Clear' ? 12 : t.riskScore,
              }
            : t
        ),
      };
    });
  };

  const totalSettledInr = transactionAggregates?.settledVolumeInr ?? 0;
  const totalMonitoredTxns = transactionAggregates?.totalCount ?? 0;
  const preventedInr = fraudAggregates?.preventedVolumeInr ?? 0;
  const frozenCount = fraudAggregates?.frozenCount ?? 0;
  const flaggedCount = fraudAggregates?.flaggedCount ?? 0;

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Finance Analyst Header with Tenant Scoping */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName} Desk
            </span>
            <span className="text-xs text-[#E6C78B]">Clearance: Finance Analyst</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300">
              Base: INR (₹)
            </span>
            {dbSource === 'supabase' && telemetryStatus === 'OPERATIONAL' ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Supabase Database ({fraudCases.length} Cases)
              </span>
            ) : telemetryStatus === 'RESTRICTED' ? (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-950/80 border border-blue-500/50 text-blue-300 flex items-center gap-1"
                title={dbError || 'Access restricted by PostgreSQL RLS'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                RESTRICTED (RLS / Clearance)
              </span>
            ) : (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center gap-1"
                title={dbError || 'Finance telemetry degraded'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                {telemetryStatus}
              </span>
            )}
            {transactionAggregates?.isPartial && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300 animate-pulse flex items-center gap-1">
                <Activity size={10} />
                Partial Forensics
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            {companyName} Forensic AML & Financial Intelligence
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Real-time multi-rail financial surveillance strictly scoped to {companyName}. Live portfolio monitoring across {totalMonitoredTxns.toLocaleString()} transactions and {metrics.totalCases.toLocaleString()} fraud cases in INR base currency.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-[#141414] border border-[#3A3A3A] rounded-xl p-1">
            {(['30D', '90D', 'YTD', 'ALL'] as DateRangePreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                  datePreset === preset
                    ? 'bg-[#D4A017] text-[#1A1A1A]'
                    : 'text-[#9CA3AF] hover:text-[#FAF7F0]'
                }`}
              >
                {preset === 'ALL' ? 'All History' : preset}
              </button>
            ))}
          </div>
          <button
            onClick={() => loadAllData()}
            disabled={loading}
            title="Refresh live metrics from Supabase"
            className="p-2.5 rounded-xl bg-[#141414] border border-[#3A3A3A] hover:border-[#D4A017] text-[#D4A017] transition-all flex items-center gap-1.5 hover:scale-105"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline text-[11px] font-bold">Refresh</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all shrink-0"
          >
            <UserPlus size={16} />
            Create Customer Record
          </button>
        </div>
      </div>

      {/* Per-Domain Telemetry Health Strip */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <WidgetStatusBadge label="Transactions" status={tAggLoading ? 'LOADING' : domainStatuses.txAgg} />
        <WidgetStatusBadge label="Fraud Aggregates" status={fAggLoading ? 'LOADING' : domainStatuses.fraudAgg} />
        <WidgetStatusBadge label="Fraud Queue" status={fListLoading ? 'LOADING' : domainStatuses.fraudCases} />
        <WidgetStatusBadge label="KYC Queue" status={kycLoading ? 'LOADING' : domainStatuses.kycAgg} />
      </div>

      {actionError && (
        <div className="rounded-xl p-3.5 bg-red-950/60 border border-red-500/50 text-red-200 flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-[10px] underline shrink-0">Dismiss</button>
        </div>
      )}

      {/* Isolated Per-Widget Failure / Timeout Notices */}
      <div className="space-y-2">
        {!tAggLoading && domainStatuses.txAgg !== 'OPERATIONAL' && transactionAggregates?.error && (
          <WidgetFailureNotice
            widgetName="Transactions Analytics"
            status={domainStatuses.txAgg}
            error={transactionAggregates.error}
            onRetry={() => refetchTxAgg()}
            isRetrying={tAggFetching}
            compact
          />
        )}
        {!fAggLoading && domainStatuses.fraudAgg !== 'OPERATIONAL' && fraudAggregates?.error && (
          <WidgetFailureNotice
            widgetName="Fraud Aggregates"
            status={domainStatuses.fraudAgg}
            error={fraudAggregates.error}
            onRetry={() => refetchFraudAgg()}
            isRetrying={fAggFetching}
            compact
          />
        )}
        {!fListLoading && domainStatuses.fraudCases !== 'OPERATIONAL' && fResult?.error && (
          <WidgetFailureNotice
            widgetName="Suspicious Transactions Queue"
            status={domainStatuses.fraudCases}
            error={fResult.error}
            onRetry={() => refetchFraudCases()}
            isRetrying={fListFetching}
            compact
          />
        )}
        {!kycLoading && domainStatuses.kycAgg !== 'OPERATIONAL' && kycAggregates?.error && (
          <WidgetFailureNotice
            widgetName="KYC Review Queue"
            status={domainStatuses.kycAgg}
            error={kycAggregates.error}
            onRetry={() => refetchKycAgg()}
            isRetrying={kycFetching}
            compact
          />
        )}
      </div>

      {/* 5 KPI Cards: Monitored Transactions, Fraud Prevented, AML Alerts, Risk Score, KYC Queue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ThreeDKpiCard
          title="Monitored Transactions"
          value={totalMonitoredTxns.toLocaleString()}
          subValue={`₹${(totalSettledInr / 1000000).toFixed(2)}M Settled (INR)`}
          change="+18.5%"
          trend="up"
          tag="INR Base"
          icon={<DollarSign size={20} />}
          sparkline={[140, 160, 185, 200, 220, 235, 248]}
        />
        <ThreeDKpiCard
          title="Fraud Alerts Stopped"
          value={`₹${(preventedInr / 1000000).toFixed(2)}M`}
          subValue={`${frozenCount.toLocaleString()} Frozen Escrow`}
          change="0.12% FP Rate"
          trend="up"
          tag="INR Base"
          variant="gold-accent"
          icon={<ShieldAlert size={20} />}
          sparkline={[80, 110, 140, 165, 195, 220, 248]}
        />
        <ThreeDKpiCard
          title="Active AML Alerts"
          value={`${flaggedCount.toLocaleString()} Active`}
          subValue="Velocity / Structuring Rules"
          change={flaggedCount > 0 ? 'Surveillance' : 'Clean'}
          trend="down"
          tag="Action Req"
          icon={<AlertTriangle size={20} />}
          sparkline={[24, 22, 20, 19, 18, 18, 18]}
        />
        <ThreeDKpiCard
          title="Avg Risk Baseline"
          value={`${metrics.avgScore} / 100`}
          subValue="Nominal Risk Threshold"
          change="-2.1 pts"
          trend="up"
          tag="Resilient"
          icon={<CheckCircle2 size={20} />}
          sparkline={[22, 20, 19, 18, 17, 16, 16]}
        />
        <ThreeDKpiCard
          title="KYC Review Queue"
          value={kycQueueCount.toString()}
          subValue={kycQueueCount === 0 ? "0 Records (Queue Clear)" : `${kycQueueCount} In Review`}
          change={kycQueueCount === 0 ? "Compliant" : "Under SLA"}
          trend="up"
          tag="Queue"
          icon={<FileText size={20} />}
          sparkline={[0, 0, 0, 0, 0, 0, 0]}
        />
      </div>

      {/* 3D Charts: Heatmap, Area, Donut, Column */}
      <div className="space-y-6">
        <ThreeDTransactionHeatmap
          title="3D Real-Time AML Monitoring & Threat Heatmap"
          subtitle={`Intraday Transaction Intensity & Geolocation Risk for ${companyName} (Reporting Base: INR ₹)`}
          currencySymbol="₹"
          baseCurrency="INR"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ThreeDAreaChart
            title="3D Daily Settlement Flow Volume"
            subtitle={`Gross Settlement Volume for ${companyName} in INR ₹ Millions`}
            data={settlementFlowData}
            valuePrefix="₹"
            valueSuffix="M"
            height={280}
          />
          <ThreeDDonutChart
            title="3D Portfolio Category Distribution"
            subtitle="Volume Allocation Across Institutional Asset Classes"
            segments={categoryDonutData}
            centerLabel="Total Settled"
            centerValue={`₹${(totalSettledInr / 1000000).toFixed(0)}M`}
            height={320}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ThreeDPieChart
            title="3D Fraud Case Risk Tier Distribution"
            subtitle={`Surveillance Classification for ${metrics.totalCases.toLocaleString()} Monitored Cases`}
            segments={riskPieData}
            height={300}
          />
          <ThreeDColumnChart
            title="3D Payment Rail Clearance & Interception Volume"
            subtitle="Monitored Alerts vs Prevented Exposure (₹ Millions)"
            data={channelColumnData}
            height={280}
            valuePrefix=""
            valueSuffix=" cases"
            dualSeries={true}
            primaryLabel="Alert Cases"
            secondaryLabel="Prevented (₹M)"
          />
        </div>
      </div>

      {/* Table Section with Tabs */}
      <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#3A3A3A] gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'suspicious', label: `Suspicious Transactions (${fraudCases.length})` },
              { id: 'high_risk', label: 'High-Risk Counterparties' },
              { id: 'merchants', label: 'Top Settlement Counterparties' },
              { id: 'reports', label: 'Forensic Reports' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTableTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                  activeTableTab === tab.id
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] shadow-md'
                    : 'bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-[10px] text-[#9CA3AF]">
            Institutional Boundary: {companyName} • Cross-company isolation active
          </span>
        </div>

        {/* Tab 1: Suspicious Transactions */}
        {activeTableTab === 'suspicious' && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                  <th className="pb-2.5">Txn ID & Time</th>
                  <th className="pb-2.5">Customer & ID</th>
                  <th className="pb-2.5">Amount (INR Base)</th>
                  <th className="pb-2.5">Risk Score</th>
                  <th className="pb-2.5">AML Violation Rule</th>
                  <th className="pb-2.5">Channel Rail</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5 text-right">Analyst Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                {fraudCases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#9CA3AF]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldAlert size={28} className="text-[#D4A017]" />
                        <p className="text-sm font-bold text-[#FAF7F0]">No Fraud / AML Cases Recorded</p>
                        <p className="text-xs text-[#9CA3AF] max-w-md">
                          {dbError || `No records found in public.fraud_cases for ${companyName}.`}
                        </p>
                        <button
                          onClick={() => loadAllData()}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-[#121212] border border-[#D4A017] text-[#D4A017] text-xs hover:bg-[#262626] flex items-center gap-1.5"
                        >
                          <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
                          <span>Retry Query</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  fraudCases.slice(0, 15).map((t) => {
                    const conv = convertToInr(t.amount, t.currency || 'INR');
                    return (
                      <tr key={t.id} className="hover:bg-[#121212]/50 transition-colors">
                        <td className="py-3">
                          <p className="font-bold text-[#E6C78B]">{t.id}</p>
                          <p className="text-[10px] text-[#9CA3AF]">{t.timestamp}</p>
                        </td>
                        <td className="py-3">
                          <p className="font-semibold text-[#FAF7F0]">{t.customerName}</p>
                          <p className="text-[10px] text-[#9CA3AF]">{t.customerId} • {t.location}</p>
                        </td>
                        <td className="py-3 font-bold text-[#FAF7F0]">
                          <div>
                            <span className="text-[#E6C78B]">₹{conv.amountInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            {t.currency && t.currency !== 'INR' && (
                              <span className="block text-[10px] text-[#9CA3AF] font-normal">
                                {t.currency} {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} @ ₹{conv.exchangeRate.toFixed(2)}/unit
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.riskScore > 75
                                ? 'bg-[#121212] text-[#B87333] border border-[#B87333]'
                                : t.riskScore > 40
                                ? 'bg-[#121212] text-[#D4A017] border border-[#D4A017]'
                                : 'bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]'
                            }`}
                          >
                            {t.riskScore} / 100
                          </span>
                        </td>
                        <td className="py-3 text-[11px] text-[#D4A017]">
                          <p className="font-semibold text-[#FAF7F0]">{t.amlFlag}</p>
                          <p className="text-[10px] text-[#9CA3AF] max-w-xs truncate">{t.ruleTriggered}</p>
                        </td>
                        <td className="py-3 text-[11px] text-[#FAF7F0]">{t.paymentChannel}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === 'Frozen Escrow'
                                ? 'bg-[#121212] text-[#B87333] border border-[#B87333]'
                                : t.status === 'Flagged'
                                ? 'bg-[#121212] text-[#D4A017] border border-[#D4A017]'
                                : 'bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {t.status !== 'Frozen Escrow' ? (
                            <button
                              onClick={() => handleEscalateOrFreeze(t.id, 'Freeze')}
                              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#D4A017] to-[#B87333] hover:brightness-110 text-[#1A1A1A] text-[10px] font-bold shadow-sm"
                            >
                              Freeze Escrow
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEscalateOrFreeze(t.id, 'Clear')}
                              className="px-2.5 py-1 rounded-lg bg-[#121212] text-[#E6C78B] border border-[#D4A017] text-[10px] font-bold hover:bg-[#262626]"
                            >
                              Clear Escrow
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: High Risk Customers */}
        {activeTableTab === 'high_risk' && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                  <th className="pb-2">Customer ID</th>
                  <th className="pb-2">Entity Name</th>
                  <th className="pb-2">Risk Score</th>
                  <th className="pb-2">Flagged Volume (INR)</th>
                  <th className="pb-2">Jurisdiction Node</th>
                  <th className="pb-2 text-right">Surveillance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                {highRiskCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#9CA3AF]">
                      No high-risk counterparties detected in database query.
                    </td>
                  </tr>
                ) : (
                  highRiskCustomers.slice(0, 15).map((cust) => (
                    <tr key={cust.id} className="hover:bg-[#121212]/50">
                      <td className="py-2.5 font-bold text-[#E6C78B]">{cust.id}</td>
                      <td className="py-2.5 font-semibold text-[#FAF7F0]">{cust.name}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded font-bold bg-[#121212] text-[#B87333] border border-[#B87333]">
                          {cust.riskScore} / 100
                        </span>
                      </td>
                      <td className="py-2.5 font-bold text-[#FAF7F0]">
                        <span className="text-[#E6C78B]">{cust.flaggedVolumeInr}</span>
                        {cust.originalVolume && (
                          <span className="block text-[10px] text-[#9CA3AF] font-normal">{cust.originalVolume}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-[#D4A017]">{cust.jurisdiction}</td>
                      <td className="py-2.5 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]">
                          {cust.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Top Settlement Counterparties */}
        {activeTableTab === 'merchants' && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                  <th className="pb-2">Counterparty / Clearing Node</th>
                  <th className="pb-2">Transaction Volume</th>
                  <th className="pb-2">Settled Volume (INR Base)</th>
                  <th className="pb-2">Settlement Share</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                {topMerchantsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#9CA3AF]">
                      No settlement counterparty aggregates available for {companyName}.
                    </td>
                  </tr>
                ) : (
                  topMerchantsList.map((m, idx) => (
                    <tr key={m.merchant} className="hover:bg-[#121212]/50">
                      <td className="py-2.5 font-bold text-[#E6C78B]">
                        <span className="text-[#9CA3AF] mr-2">#{idx + 1}</span>
                        {m.merchant}
                      </td>
                      <td className="py-2.5 font-semibold text-[#FAF7F0]">{m.count.toLocaleString()} txns</td>
                      <td className="py-2.5 font-bold text-[#E6C78B]">₹{(m.volumeInr / 1000000).toFixed(2)}M</td>
                      <td className="py-2.5 text-[#D4A017]">
                        {totalSettledInr > 0 ? Math.round((m.volumeInr / totalSettledInr) * 100) : 0}% of total
                      </td>
                      <td className="py-2.5 text-right font-bold text-emerald-400">
                        Primary Rail
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Risk Reports */}
        {activeTableTab === 'reports' && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                  <th className="pb-2">Report ID</th>
                  <th className="pb-2">Investigation Subject</th>
                  <th className="pb-2">Auditing Analyst</th>
                  <th className="pb-2">Threat Level</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Disposition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                {riskReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#9CA3AF]">
                      No forensic reports filed in database for {companyName}.
                    </td>
                  </tr>
                ) : (
                  riskReports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-[#121212]/50">
                      <td className="py-2.5 font-bold text-[#E6C78B]">{rep.id}</td>
                      <td className="py-2.5 text-[#FAF7F0]">{rep.title}</td>
                      <td className="py-2.5 text-[#D4A017]">{rep.analyst}</td>
                      <td className="py-2.5 text-[#B87333]">{rep.threatLevel}</td>
                      <td className="py-2.5 text-[#9CA3AF]">{rep.date}</td>
                      <td className="py-2.5 text-right font-bold text-[#E6C78B]">{rep.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserManagementModal
        currentRole={currentRole}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(newUserData) => {
          const newUser: UserAccount = {
            id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
            name: newUserData.name || 'New Client',
            email: newUserData.email || '',
            role: 'CUSTOMER',
            status: 'Active',
            tier: newUserData.tier || 'Private Wealth Tier 3',
            createdDate: new Date().toISOString().split('T')[0],
            lastActive: 'Just now',
            phone: newUserData.phone || '+1 (212) 555-0100',
            country: newUserData.country || 'Switzerland',
            twoFactorEnabled: true,
            tenantId,
            tenantName: companyName,
            notes: newUserData.notes || `Created via ${companyName} Analyst Risk Queue`,
          };
          onUpdateUsers([newUser, ...users]);
        }}
        adminTenantId={tenantId}
      />
    </div>
  );
};

export default FinanceAnalystDashboard;
