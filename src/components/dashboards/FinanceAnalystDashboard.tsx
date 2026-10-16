import React, { useState } from 'react';
import {
  FINANCE_ANALYST_DATASET,
  FinanceFraudTransaction,
  UserAccount,
  UserRole,
} from '../../data/finovaDatasets';
import { getFraudTransactionsForTenant } from '../../data/tenantDatasets';
import {
  fetchFraudCasesResultFromDb,
  fetchTransactionsResultFromDb,
  fetchKycRecordsResultFromDb,
  updateFraudCaseStatusInDb,
} from '../../services/finovaDatabase';
import { getTenantById } from '../../data/tenantStore';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDTransactionHeatmap } from '../charts3d/ThreeDTransactionHeatmap';
import { ThreeDPieChart } from '../charts3d/ThreeDPieChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { UserManagementModal } from '../UserManagementModal';
import {
  ShieldAlert,
  Search,
  AlertTriangle,
  Lock,
  CheckCircle2,
  DollarSign,
  UserPlus,
  Eye,
  FileText,
  Users,
  Building2,
  RotateCw,
} from 'lucide-react';

interface FinanceAnalystDashboardProps {
  currentRole: UserRole;
  users: UserAccount[];
  onUpdateUsers: (newUsers: UserAccount[]) => void;
  activeSection?: string;
  currentUser?: UserAccount;
}

export const FinanceAnalystDashboard: React.FC<FinanceAnalystDashboardProps> = ({
  currentRole,
  users,
  onUpdateUsers,
  activeSection = 'dashboard',
  currentUser,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const tenantId = currentUser?.tenantId || 'tenant_apex_bank';
  const tenant = getTenantById(tenantId);
  const companyName = tenant?.name || currentUser?.tenantName || 'Apex Global Bank';

  // Load tenant-isolated fraud, transaction, and KYC records
  const [transactions, setTransactions] = useState<FinanceFraudTransaction[]>(() =>
    getFraudTransactionsForTenant(tenantId)
  );
  const [monitoredTxnCount, setMonitoredTxnCount] = useState<number>(52000);
  const [monitoredTxnVolume, setMonitoredTxnVolume] = useState<number>(248900000);
  const [kycQueueCount, setKycQueueCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [dbSource, setDbSource] = useState<'supabase' | 'fallback'>('fallback');
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeTableTab, setActiveTableTab] = useState<'suspicious' | 'high_risk' | 'reports'>('suspicious');

  const loadAllData = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load fraud cases
      const fResult = await fetchFraudCasesResultFromDb(tenantId);
      setDbSource(fResult.source);
      setDbError(fResult.error);
      if (fResult.source === 'supabase') {
        setTransactions(fResult.data);
      } else if (fResult.data && fResult.data.length > 0) {
        setTransactions(fResult.data);
      }

      // 2. Load monitored transactions count & volume from transactions table
      try {
        const tResult = await fetchTransactionsResultFromDb(tenantId, { pageSize: 100 });
        if (tResult.totalCount !== undefined && tResult.totalCount > 0) {
          setMonitoredTxnCount(tResult.totalCount);
          const vol = tResult.data.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
          if (vol > 0) setMonitoredTxnVolume(vol * Math.ceil(tResult.totalCount / (tResult.data.length || 1)));
        }
      } catch (tErr) {
        console.warn('Transactions count notice:', tErr);
      }

      // 3. Load genuine KYC records count (guaranteed empty until records exist per Req 8)
      try {
        const kResult = await fetchKycRecordsResultFromDb(tenantId);
        setKycQueueCount(kResult.totalCount ?? kResult.count ?? 0);
      } catch (kErr) {
        console.warn('KYC count notice:', kErr);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  React.useEffect(() => {
    if (activeSection === 'finance_customer_insights') {
      setActiveTableTab('high_risk');
    } else if (activeSection === 'reports') {
      setActiveTableTab('reports');
    } else if (activeSection === 'finance_fraud_detection' || activeSection === 'finance_aml_monitoring') {
      setActiveTableTab('suspicious');
    }
  }, [activeSection]);

  // Dynamic KPI computations from query results
  const metrics = React.useMemo(() => {
    const totalFraudCases = transactions.length;
    const preventedVolume = transactions
      .filter((t) => t.status === 'Frozen Escrow' || t.status === 'Flagged')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const interceptedCount = transactions.filter((t) => t.status === 'Frozen Escrow' || t.status === 'Flagged').length;
    const activeAmlAlerts = transactions.filter((t) => t.status !== 'Cleared').length;
    const avgScore =
      transactions.length > 0
        ? (transactions.reduce((acc, t) => acc + (Number(t.riskScore) || 50), 0) / transactions.length).toFixed(1)
        : '16.4';

    return {
      totalFraudCases,
      preventedVolume,
      interceptedCount,
      activeAmlAlerts,
      avgScore,
    };
  }, [transactions]);

  // Dynamic 3D Pie Chart calculated from current transactions risk tiers
  const riskPieData = React.useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [
        { label: 'Low Risk', value: 1, subtext: `0.0M ${tenant?.currency || 'USD'}` },
      ];
    }
    const critical = transactions.filter((t) => (t.riskScore || 0) >= 80);
    const high = transactions.filter((t) => (t.riskScore || 0) >= 50 && (t.riskScore || 0) < 80);
    const low = transactions.filter((t) => (t.riskScore || 0) < 50);

    const critVol = critical.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const highVol = high.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const lowVol = low.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    return [
      { label: 'Critical Tier', value: Math.max(1, critical.length), subtext: `${(critVol / 1000000).toFixed(1)}M ${tenant?.currency || 'USD'}` },
      { label: 'High Alert', value: Math.max(1, high.length), subtext: `${(highVol / 1000000).toFixed(1)}M ${tenant?.currency || 'USD'}` },
      { label: 'Nominal Tier', value: Math.max(1, low.length), subtext: `${(lowVol / 1000000).toFixed(1)}M ${tenant?.currency || 'USD'}` },
    ];
  }, [transactions, tenant]);

  const fraudAnalyticsData = [
    { label: 'May', value: 680, secondaryValue: 720 },
    { label: 'Jun', value: 890, secondaryValue: 840 },
    { label: 'Jul', value: 1120, secondaryValue: 1050 },
    { label: 'Aug', value: 980, secondaryValue: 920 },
    { label: 'Sep', value: 1340, secondaryValue: 1200 },
    { label: 'Oct', value: 1480, secondaryValue: 1420, highlight: true },
  ];

  const transactionVolumeData = [
    { label: '08:00', value: 24500 },
    { label: '10:00', value: 68200 },
    { label: '12:00', value: 94800 },
    { label: '14:00', value: 89100 },
    { label: '16:00', value: 112400 },
    { label: '18:00', value: 64200 },
  ];

  // High Risk Customers from dataset for this company
  const highRiskCustomers = [
    {
      id: `${tenantId === 'tenant_crest_capital' ? 'CRV' : tenantId === 'tenant_vanguard_wealth' ? 'VGW' : 'FNV'}-CUST-9104`,
      name: tenantId === 'tenant_crest_capital' ? 'Caledonian Maritime Asset HoldCo' : tenantId === 'tenant_vanguard_wealth' ? 'Helvetia Trust Holdings Anstalt' : 'Aegis Offshore Holdings Ltd',
      riskScore: 94,
      flaggedVolume: `${tenant?.currencySymbol || '$'}1,240,000`,
      jurisdiction: tenantId === 'tenant_crest_capital' ? 'Edinburgh / Isle of Man' : tenantId === 'tenant_vanguard_wealth' ? 'Vaduz / Nicosia' : 'Nassau / Limassol',
      status: 'Escrow Frozen',
    },
    {
      id: `${tenantId === 'tenant_crest_capital' ? 'CRV' : tenantId === 'tenant_vanguard_wealth' ? 'VGW' : 'FNV'}-CUST-3902`,
      name: 'Veloce Global Syndicate',
      riskScore: 82,
      flaggedVolume: `${tenant?.currencySymbol || '€'}890,000`,
      jurisdiction: 'Seychelles Relay',
      status: 'Under Review',
    },
    {
      id: `${tenantId === 'tenant_crest_capital' ? 'CRV' : tenantId === 'tenant_vanguard_wealth' ? 'VGW' : 'FNV'}-CUST-6621`,
      name: 'Alpha Orion Capital LLC',
      riskScore: 88,
      flaggedVolume: `${tenant?.currencySymbol || '$'}675,000`,
      jurisdiction: 'Panama / Delaware',
      status: 'Enhanced Due Diligence',
    },
  ];

  // Risk Reports for this tenant
  const riskReports = [
    {
      id: `REP-${tenantId.slice(7, 10).toUpperCase()}-2026-08`,
      title: 'Cross-Border Layering Anomaly Analysis #481',
      date: '2026-10-08',
      analyst: currentUser?.name || 'Julian Thorne',
      threatLevel: 'Elevated Threat',
      status: 'Escalated to Desk Lead',
    },
    {
      id: `REP-${tenantId.slice(7, 10).toUpperCase()}-2026-07`,
      title: 'Offshore Geolocation Spoofing Cluster Investigation',
      date: '2026-10-07',
      analyst: currentUser?.name || 'Julian Thorne',
      threatLevel: 'Critical Anomaly',
      status: `SAR Prepared for ${tenant?.licenseNo?.split(' ')[0] || 'Regulator'}`,
    },
    {
      id: `REP-${tenantId.slice(7, 10).toUpperCase()}-2026-06`,
      title: 'Quarterly False Positive Audit (0.12% Benchmark)',
      date: '2026-10-05',
      analyst: 'Risk Modeling Officer',
      threatLevel: 'Nominal Cleared',
      status: 'Archived Verified',
    },
  ];

  const handleEscalateOrFreeze = (txnId: string, action: 'Freeze' | 'Clear') => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === txnId) {
          const newStatus = action === 'Freeze' ? 'Frozen Escrow' : 'Cleared';
          updateFraudCaseStatusInDb(txnId, newStatus);
          return {
            ...t,
            status: newStatus as any,
            riskScore: action === 'Clear' ? 12 : t.riskScore,
          };
        }
        return t;
      })
    );
  };

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
            {dbSource === 'supabase' ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Supabase Database ({transactions.length} Cases)
              </span>
            ) : (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center gap-1"
                title={dbError || 'Fraud cases table pending or requires authentication'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                {dbError && dbError.includes('Demo') ? 'Demo Dataset (RLS Active)' : 'Workspace Scoped'}
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            {companyName} Forensic AML & Fraud Intelligence
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Real-time transaction surveillance strictly scoped to {companyName}. Monitoring transaction flows, high-risk counterparties, and KYC verification queues from <code>public.fraud_cases</code>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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

      {/* 5 KPI Cards: Transactions, Fraud Alerts, AML Cases, Risk Scores, KYC Queue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ThreeDKpiCard
          title="Monitored Transactions"
          value={monitoredTxnCount.toLocaleString()}
          subValue={`${tenant?.currencySymbol || '$'}${(monitoredTxnVolume / 1000000).toFixed(1)}M Volume`}
          change="+18.5%"
          trend="up"
          tag="Monitored"
          icon={<DollarSign size={20} />}
          sparkline={[140, 160, 185, 200, 220, 235, 248]}
        />
        <ThreeDKpiCard
          title="Fraud Alerts Stopped"
          value={`${tenant?.currencySymbol || '$'}${metrics.preventedVolume.toLocaleString()}`}
          subValue={`${metrics.interceptedCount} Intercepted`}
          change="0.12% FP Rate"
          trend="up"
          tag="Intercepted"
          variant="gold-accent"
          icon={<ShieldAlert size={20} />}
          sparkline={[80, 110, 140, 165, 195, 220, 248]}
        />
        <ThreeDKpiCard
          title="Active AML Alerts"
          value={`${metrics.activeAmlAlerts} Active`}
          subValue="Velocity / Structuring"
          change={metrics.activeAmlAlerts > 0 ? 'Surveillance' : 'Clean'}
          trend="down"
          tag="Action Req"
          icon={<AlertTriangle size={20} />}
          sparkline={[24, 22, 20, 19, 18, 18, 18]}
        />
        <ThreeDKpiCard
          title="Avg Risk Baseline"
          value={`${metrics.avgScore} / 100`}
          subValue="Nominal Baseline"
          change="-2.1 pts"
          trend="up"
          tag="Resilient"
          icon={<CheckCircle2 size={20} />}
          sparkline={[22, 20, 19, 18, 17, 16, 16]}
        />
        <ThreeDKpiCard
          title="KYC Review Queue"
          value={kycQueueCount.toString()}
          subValue={kycQueueCount === 0 ? "0 Records Pending" : `${kycQueueCount} In Review`}
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
          subtitle={`Intraday Transaction Intensity & Geolocation Risk for ${companyName}`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ThreeDAreaChart
            title="3D Daily Settlement Flow Volume"
            subtitle={`Gross Settlement Volume for ${companyName} (${tenant?.currency || 'USD'})`}
            data={transactionVolumeData}
            valuePrefix={tenant?.currencySymbol || '$'}
            valueSuffix=""
            height={260}
          />
          <ThreeDPieChart
            title="3D Risk Tier Distribution"
            subtitle="Dataset Classification (0 - 100 Risk Index)"
            segments={riskPieData}
            height={300}
          />
        </div>

        <ThreeDColumnChart
          title="3D Quarterly Fraud Detection & Interception Velocity"
          subtitle="Anomalies Flagged vs Confirmed Countermeasures Cleared"
          data={fraudAnalyticsData}
          height={260}
          valuePrefix=""
          valueSuffix=" alerts"
          dualSeries={true}
          primaryLabel="Anomalies Flagged"
          secondaryLabel="Confirmed Prevented"
        />
      </div>

      {/* Table Section with Tabs */}
      <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#3A3A3A] gap-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'suspicious', label: `Suspicious Transactions (${transactions.length})` },
              { id: 'high_risk', label: 'High-Risk Counterparties' },
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
                  <th className="pb-2.5">Amount</th>
                  <th className="pb-2.5">Risk Score</th>
                  <th className="pb-2.5">AML Violation Rule</th>
                  <th className="pb-2.5">Channel Rail</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5 text-right">Analyst Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                {transactions.map((t) => (
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
                      {t.currency} {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                ))}
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
                  <th className="pb-2">Flagged Volume</th>
                  <th className="pb-2">Jurisdiction Node</th>
                  <th className="pb-2 text-right">Surveillance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                {highRiskCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-[#121212]/50">
                    <td className="py-2.5 font-bold text-[#E6C78B]">{cust.id}</td>
                    <td className="py-2.5 font-semibold text-[#FAF7F0]">{cust.name}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded font-bold bg-[#121212] text-[#B87333] border border-[#B87333]">
                        {cust.riskScore} / 100
                      </span>
                    </td>
                    <td className="py-2.5 font-bold text-[#FAF7F0]">{cust.flaggedVolume}</td>
                    <td className="py-2.5 text-[#D4A017]">{cust.jurisdiction}</td>
                    <td className="py-2.5 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]">
                        {cust.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Risk Reports */}
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
                {riskReports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-[#121212]/50">
                    <td className="py-2.5 font-bold text-[#E6C78B]">{rep.id}</td>
                    <td className="py-2.5 text-[#FAF7F0]">{rep.title}</td>
                    <td className="py-2.5 text-[#D4A017]">{rep.analyst}</td>
                    <td className="py-2.5 text-[#B87333]">{rep.threatLevel}</td>
                    <td className="py-2.5 text-[#9CA3AF]">{rep.date}</td>
                    <td className="py-2.5 text-right font-bold text-[#E6C78B]">{rep.status}</td>
                  </tr>
                ))}
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
