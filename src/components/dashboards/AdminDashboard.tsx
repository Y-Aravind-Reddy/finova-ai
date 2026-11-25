import React, { useState, useMemo, Suspense, lazy } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserAccount,
  UserRole,
} from '../../data/finovaDatasets';
import { getTenantById } from '../../data/tenantStore';
import {
  saveProfileToDb,
  fetchTransactionAggregatesResultFromDb,
  fetchSupportAggregatesResultFromDb,
  fetchFraudAggregatesResultFromDb,
  fetchKycAggregatesResultFromDb,
  fetchPlatformExecutiveKpis,
  canRoleAccessFraudTelemetry,
  canRoleAccessSupportTelemetry,
  mapResultStateToTelemetryStatus,
  getDefaultBoundedDateRange,
} from '../../services/finovaDatabase';

import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { DashboardFilterBar, DashboardFilters } from './DashboardFilterBar';
import { ModuleSkeleton, KpiSkeleton } from './DashboardSkeletons';
import { WidgetFailureNotice, WidgetStatusBadge } from '../common/WidgetTelemetryStatus';

// Lazy load heavy intelligence modules
const TransactionIntelligence = lazy(() => import('./intelligence/TransactionIntelligence'));
const FraudAMLSurveillance = lazy(() => import('./intelligence/FraudAMLSurveillance'));
const KYCCompliance = lazy(() => import('./intelligence/KYCCompliance'));
const SupportOperations = lazy(() => import('./intelligence/SupportOperations'));
const AuditSecurityTrail = lazy(() => import('./intelligence/AuditSecurityTrail'));
const InstitutionHealth = lazy(() => import('./intelligence/InstitutionHealth'));
const RevenueAnalytics = lazy(() => import('./intelligence/RevenueAnalytics'));
const TreasuryLiquidity = lazy(() => import('./intelligence/TreasuryLiquidity'));
const SystemHealth = lazy(() => import('./intelligence/SystemHealth'));
const StrategicMap = lazy(() => import('./intelligence/StrategicMap'));

import { UserManagementModal } from '../UserManagementModal';
import { ChangeRoleModal } from '../common/ChangeRoleModal';
import AdminUserManagementPage from '../admin/AdminUserManagementPage';
import AdminCustomerManagementPage from '../admin/AdminCustomerManagementPage';
import AdminOperationsPage from '../admin/AdminOperationsPage';

import {
  Users,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Building2,
  RotateCw,
  LayoutDashboard,
  Cpu,
  BarChart3,
  ShieldAlert,
  Fingerprint,
  LifeBuoy,
  History,
  Workflow,
  Globe,
  Wallet,
  UserPlus,
  Activity
} from 'lucide-react';

interface AdminDashboardProps {
  currentRole: UserRole;
  users: UserAccount[];
  onUpdateUsers: (newUsers: UserAccount[]) => void;
  onRefreshUsers?: () => void;
  activeSection?: string;
  currentUser?: UserAccount;
}

type IntelligenceModule = 
  | 'overview' 
  | 'transactions' 
  | 'fraud' 
  | 'kyc' 
  | 'support' 
  | 'audit' 
  | 'health' 
  | 'revenue' 
  | 'treasury' 
  | 'system' 
  | 'strategic';

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentRole,
  users,
  onUpdateUsers,
  onRefreshUsers,
  activeSection = 'dashboard',
  currentUser,
}) => {
  const queryClient = useQueryClient();
  const [activeModule, setActiveModule] = useState<IntelligenceModule>('overview');
  const [modalOpen, setModalOpen] = useState(false);
  const [changeRoleUser, setChangeRoleUser] = useState<UserAccount | null>(null);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [adminNotice, setAdminNotice] = useState<{ type: 'error' | 'info'; message: string } | null>(null);

  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    ...getDefaultBoundedDateRange('YTD'),
    currency: 'ALL',
    branchCity: 'Global Operations',
  }));

  const tenantId = currentUser?.tenantId || 'tenant_apex_bank';
  const tenant = useMemo(() => getTenantById(tenantId), [tenantId]);
  const companyName = tenant?.name || currentUser?.tenantName || 'Apex Global Bank';

  const fraudAuthorized = canRoleAccessFraudTelemetry(currentRole);
  const supportAuthorized = canRoleAccessSupportTelemetry(currentRole);

  // --- REACT QUERY DATA FETCHING (with bounded range & AbortSignal) ---

  const { data: kpis, isLoading: kpisLoading, isFetching: kpisFetching, refetch: refetchKpis } = useQuery({
    queryKey: ['platform-kpis', currentUser?.id, currentRole],
    queryFn: ({ signal }) => fetchPlatformExecutiveKpis({ signal }),
    enabled: currentRole === 'SUPER_ADMIN',
  });

  const { data: txAgg, isLoading: txLoading, isFetching: txFetching, refetch: refetchTx } = useQuery({
    queryKey: ['tx-aggregates', currentUser?.id, currentRole, tenantId, filters],
    queryFn: ({ signal }) => fetchTransactionAggregatesResultFromDb(tenantId, { ...filters, signal }),
  });

  const { data: sAgg, isLoading: sLoading, isFetching: sFetching, refetch: refetchSupport } = useQuery({
    queryKey: ['support-aggregates', currentUser?.id, currentRole, tenantId, filters.startDate, filters.endDate],
    queryFn: ({ signal }) =>
      fetchSupportAggregatesResultFromDb(tenantId, {
        startDate: filters.startDate,
        endDate: filters.endDate,
        signal,
      }),
    enabled: supportAuthorized,
  });

  const { data: fAgg, isLoading: fLoading, isFetching: fFetching, refetch: refetchFraud } = useQuery({
    queryKey: ['fraud-aggregates', currentUser?.id, currentRole, tenantId, filters.currency, filters.startDate, filters.endDate],
    queryFn: ({ signal }) =>
      fetchFraudAggregatesResultFromDb(tenantId, {
        currency: filters.currency,
        startDate: filters.startDate,
        endDate: filters.endDate,
        signal,
      }),
    enabled: fraudAuthorized,
  });

  const { data: kAgg, isLoading: kLoading, isFetching: kFetching, refetch: refetchKyc } = useQuery({
    queryKey: ['kyc-aggregates', currentUser?.id, currentRole, tenantId],
    queryFn: ({ signal }) => fetchKycAggregatesResultFromDb(tenantId, { signal }),
  });

  const telemetryStatuses = useMemo(() => ({
    kpis:
      currentRole !== 'SUPER_ADMIN'
        ? ('RESTRICTED' as const)
        : mapResultStateToTelemetryStatus(kpis?.state, kpis?.source, kpisLoading),
    transactions: mapResultStateToTelemetryStatus(txAgg?.state, txAgg?.source, txLoading),
    support: !supportAuthorized
      ? ('RESTRICTED' as const)
      : mapResultStateToTelemetryStatus(sAgg?.state, sAgg?.source, sLoading),
    fraud: !fraudAuthorized
      ? ('RESTRICTED' as const)
      : mapResultStateToTelemetryStatus(fAgg?.state, fAgg?.source, fLoading),
    kyc: mapResultStateToTelemetryStatus(kAgg?.state, kAgg?.source, kLoading),
  }), [currentRole, fraudAuthorized, supportAuthorized, kpisLoading, kpis, txLoading, txAgg, sLoading, sAgg, fLoading, fAgg, kLoading, kAgg]);

  const nodeStatuses = useMemo(() => ({
    kpis: kpisLoading ? 'loading' : telemetryStatuses.kpis.toLowerCase(),
    transactions: txLoading ? 'loading' : telemetryStatuses.transactions.toLowerCase(),
    support: sLoading ? 'loading' : telemetryStatuses.support.toLowerCase(),
    fraud: fLoading ? 'loading' : telemetryStatuses.fraud.toLowerCase(),
    kyc: kLoading ? 'loading' : telemetryStatuses.kyc.toLowerCase(),
  }), [kpisLoading, txLoading, sLoading, fLoading, kLoading, telemetryStatuses]);

  const hasTimeoutNode = useMemo(
    () => Object.values(telemetryStatuses).some((s) => s === 'TIMEOUT'),
    [telemetryStatuses]
  );

  const { combinedDbError, failingWidgetLabel } = useMemo(() => {
    const entries = [
      { label: 'Executive KPIs (get_platform_executive_kpis)', state: kpis?.state, error: kpis?.error },
      { label: 'Transactions (get_transaction_aggregates)', state: txAgg?.state, error: txAgg?.error },
      { label: 'Support (get_support_aggregates)', state: sAgg?.state, error: sAgg?.error },
      { label: 'Fraud (get_fraud_aggregates)', state: fAgg?.state, error: fAgg?.error },
      { label: 'KYC (get_kyc_aggregates)', state: kAgg?.state, error: kAgg?.error },
    ];
    const activeFailures = entries.filter((item) => item.error && item.state !== 'restricted');
    const timeoutLabels = activeFailures
      .filter((item) => item.state === 'timeout')
      .map((item) => item.label);
    const allLabels = activeFailures.map((item) => item.label);
    const errs = activeFailures.map((item) => `${item.label}: ${item.error}`);
    const labelSummary =
      timeoutLabels.length > 0
        ? `Telemetry Timeout [${timeoutLabels.join(', ')}]`
        : allLabels.length > 0
        ? `Telemetry Failure [${allLabels.join(', ')}]`
        : 'Database Telemetry';
    return {
      combinedDbError: errs.length > 0 ? Array.from(new Set(errs)).join(' | ') : null,
      failingWidgetLabel: labelSummary,
    };
  }, [kpis, txAgg, sAgg, fAgg, kAgg]);

  const handleSaveUser = async (userData: Partial<UserAccount>) => {
    setAdminNotice(null);
    if (userData.role === 'SUPER_ADMIN' || userData.role === 'ADMIN') {
      setAdminNotice({
        type: 'error',
        message: 'Governance Violation: Company Admins cannot provision Admin or Super Admin accounts.',
      });
      setModalOpen(false);
      return;
    }
    const newId = `USR-${Math.floor(1000 + Math.random() * 9000)}`;
    const newUser: UserAccount = {
      id: newId,
      name: userData.name || 'New Staff',
      email: userData.email || '',
      role: userData.role || 'CUSTOMER',
      status: userData.status || 'Active',
      tier: userData.tier || 'Private Wealth Tier 3',
      createdDate: new Date().toISOString().split('T')[0],
      lastActive: 'Just now',
      phone: userData.phone || '+1 (212) 555-0100',
      country: userData.country || 'United States',
      twoFactorEnabled: true,
      tenantId,
      tenantName: companyName,
      notes: userData.notes || `Created via ${companyName} Admin Intelligence Center`,
      authSource: 'local',
    };

    const res = await saveProfileToDb(newUser);
    if (res.success) {
      onUpdateUsers([newUser, ...users]);
      if (onRefreshUsers) onRefreshUsers();
      setAdminNotice({ type: 'info', message: `User profile ${newUser.name} synchronized to database.` });
    } else {
      setAdminNotice({ type: 'error', message: `User provisioning failed: ${res.error || 'Unknown error'}` });
    }
    setModalOpen(false);
  };

  const menuItems = [
    { id: 'overview', label: 'Executive Overview', icon: <LayoutDashboard size={14} /> },
    { id: 'transactions', label: 'Transaction Intelligence', icon: <BarChart3 size={14} /> },
    { id: 'fraud', label: 'Fraud & AML Surveillance', icon: <ShieldAlert size={14} /> },
    { id: 'kyc', label: 'KYC & Compliance', icon: <Fingerprint size={14} /> },
    { id: 'support', label: 'Support Operations', icon: <LifeBuoy size={14} /> },
    { id: 'audit', label: 'Audit & Security', icon: <History size={14} /> },
    { id: 'health', label: 'Institution Health', icon: <Workflow size={14} /> },
    { id: 'revenue', label: 'Revenue Analytics', icon: <TrendingUp size={14} /> },
    { id: 'treasury', label: 'Treasury & Liquidity', icon: <Wallet size={14} /> },
    { id: 'system', label: 'System Health', icon: <Cpu size={14} /> },
    { id: 'strategic', label: 'Strategic Map', icon: <Globe size={14} /> },
  ];

  const renderModule = () => {
    return (
      <Suspense fallback={<ModuleSkeleton />}>
        {(() => {
          switch (activeModule) {
            case 'transactions': return txAgg && <TransactionIntelligence aggregates={txAgg} isLoading={txLoading} />;
            case 'fraud': return fAgg && <FraudAMLSurveillance aggregates={fAgg} isLoading={fLoading} />;
            case 'kyc': return kAgg && <KYCCompliance aggregates={kAgg} isLoading={kLoading} />;
            case 'support': return sAgg && <SupportOperations aggregates={sAgg} isLoading={sLoading} />;
            case 'audit': return <AuditSecurityTrail />;
            case 'health': return <InstitutionHealth />;
            case 'revenue': return <RevenueAnalytics />;
            case 'treasury': return <TreasuryLiquidity />;
            case 'system': return <SystemHealth />;
            case 'strategic': return <StrategicMap />;
            default: return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Summary Settlement Velocity */}
                  <div className="rounded-2xl bg-[#1A1A1A]/80 border border-[#3A3A3A] p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-cinzel text-lg font-bold text-[#E6C78B]">Settlement Flux</h3>
                          <WidgetStatusBadge status={txLoading ? 'LOADING' : telemetryStatuses.transactions} />
                        </div>
                        <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest font-mono">Cross-tenant clearing velocity</p>
                      </div>
                      <TrendingUp size={20} className="text-[#D4A017]" />
                    </div>
                    {!txLoading && telemetryStatuses.transactions !== 'OPERATIONAL' && (
                      <WidgetFailureNotice
                        widgetName="Transactions Telemetry"
                        status={telemetryStatuses.transactions}
                        error={txAgg?.error}
                        onRetry={() => refetchTx()}
                        isRetrying={txFetching}
                        compact
                      />
                    )}
                    {txAgg && (
                      <ThreeDAreaChart
                        data={txAgg.volumeByDay?.map(d => ({ label: d.date.split('-')[2], value: d.volumeInr / 1000000 })) || []}
                        valuePrefix="₹"
                        valueSuffix="M"
                        height={200}
                      />
                    )}
                  </div>

                  {/* Summary Fraud Risk */}
                  <div className="rounded-2xl bg-[#1A1A1A]/80 border border-[#3A3A3A] p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-cinzel text-lg font-bold text-[#E6C78B]">Risk Distribution</h3>
                          <WidgetStatusBadge status={fLoading ? 'LOADING' : telemetryStatuses.fraud} />
                        </div>
                        <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest font-mono">Real-time threat vectors</p>
                      </div>
                      <ShieldAlert size={20} className="text-[#D4A017]" />
                    </div>
                    {!fLoading && telemetryStatuses.fraud !== 'OPERATIONAL' && (
                      <WidgetFailureNotice
                        widgetName="Fraud & AML Surveillance"
                        status={telemetryStatuses.fraud}
                        error={fAgg?.error}
                        onRetry={fraudAuthorized ? () => refetchFraud() : undefined}
                        isRetrying={fFetching}
                        compact
                      />
                    )}
                    {fAgg && (
                      <ThreeDDonutChart
                        segments={fAgg.riskTierDistribution?.map(r => ({ label: r.tier, value: r.count, subtext: `₹${(r.volumeInr / 1000000).toFixed(1)}M` })) || []}
                        centerLabel="Alerts"
                        centerValue={fAgg.totalCases.toLocaleString()}
                        height={200}
                      />
                    )}
                  </div>
                </div>

                {/* Additional Insight Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* KYC Summary */}
                  <div className="p-5 rounded-2xl bg-[#1A1A1A]/50 border border-[#3A3A3A] flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[#D4A017] mb-2">
                        <div className="flex items-center gap-2">
                          <Fingerprint size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Compliance</span>
                        </div>
                        <WidgetStatusBadge status={kLoading ? 'LOADING' : telemetryStatuses.kyc} />
                      </div>
                      <h4 className="text-sm font-bold text-[#FAF7F0]">KYC Onboarding Queue</h4>
                    </div>
                    {!kLoading && telemetryStatuses.kyc !== 'OPERATIONAL' && (
                      <WidgetFailureNotice
                        widgetName="KYC Queue"
                        status={telemetryStatuses.kyc}
                        error={kAgg?.error}
                        onRetry={() => refetchKyc()}
                        isRetrying={kFetching}
                        compact
                      />
                    )}
                    <div>
                      <span className="text-3xl font-black text-[#E6C78B]">{kAgg?.pendingCount ?? 0}</span>
                      <span className="text-[10px] text-[#9CA3AF] ml-2">Pending Review ({kAgg?.totalCount ?? 0} Total)</span>
                    </div>
                  </div>

                  {/* Support Summary */}
                  <div className="p-5 rounded-2xl bg-[#1A1A1A]/50 border border-[#3A3A3A] flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[#D4A017] mb-2">
                        <div className="flex items-center gap-2">
                          <LifeBuoy size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Operations</span>
                        </div>
                        <WidgetStatusBadge status={sLoading ? 'LOADING' : telemetryStatuses.support} />
                      </div>
                      <h4 className="text-sm font-bold text-[#FAF7F0]">Concierge Desk Health</h4>
                    </div>
                    {!sLoading && telemetryStatuses.support !== 'OPERATIONAL' && (
                      <WidgetFailureNotice
                        widgetName="Support Telemetry"
                        status={telemetryStatuses.support}
                        error={sAgg?.error}
                        onRetry={supportAuthorized ? () => refetchSupport() : undefined}
                        isRetrying={sFetching}
                        compact
                      />
                    )}
                    <div>
                      <span className="text-3xl font-black text-[#E6C78B]">{sAgg?.slaCompliancePct ?? 0}%</span>
                      <span className="text-[10px] text-[#9CA3AF] ml-2">SLA Compliance</span>
                    </div>
                  </div>

                  {/* Liquidity Summary */}
                  <div className="p-5 rounded-2xl bg-[#1A1A1A]/50 border border-[#3A3A3A] flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[#D4A017] mb-2">
                        <div className="flex items-center gap-2">
                          <Wallet size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Treasury</span>
                        </div>
                        <WidgetStatusBadge status={txLoading ? 'LOADING' : telemetryStatuses.transactions} />
                      </div>
                      <h4 className="text-sm font-bold text-[#FAF7F0]">Net Liquid Balance</h4>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-[#E6C78B]">₹{((txAgg?.netLiquidBalanceInr || 0) / 10000000).toFixed(1)}</span>
                      <span className="text-[10px] text-[#9CA3AF]">Cr</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
        })()}
      </Suspense>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'user-management':
        return <AdminUserManagementPage users={users} onUpdateUsers={onUpdateUsers} onRefreshUsers={onRefreshUsers} currentUser={currentUser} />;
      case 'customer-management':
        return <AdminCustomerManagementPage users={users} onRefreshUsers={onRefreshUsers} currentUser={currentUser} />;
      case 'operations-management':
        return <AdminOperationsPage />;
      default:
        return (
          <div className="space-y-6 animate-in fade-in duration-700">
            {/* 8 Executive KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpisLoading ? (
                [...Array(8)].map((_, i) => <KpiSkeleton key={i} />)
              ) : (() => {
                const isSuperAdminLive = currentRole === 'SUPER_ADMIN' && kpis?.source === 'supabase';
                const settledInr = isSuperAdminLive ? kpis!.settledVolumeYtd : (txAgg?.settledVolumeInr ?? 0);
                const preventedInr = isSuperAdminLive ? kpis!.preventedFraudVolume : (fAgg?.preventedVolumeInr ?? 0);
                const slaPct = isSuperAdminLive ? kpis!.slaCompliancePct : (sAgg?.slaCompliancePct ?? 0);
                const kycCompliancePct = isSuperAdminLive
                  ? kpis!.complianceScore
                  : kAgg && kAgg.totalCount > 0
                  ? Math.round((kAgg.verifiedCount / kAgg.totalCount) * 1000) / 10
                  : 0;
                const activeUsersVal = isSuperAdminLive ? kpis!.activeUsers : users.length;
                const netLiquidUsd = isSuperAdminLive ? kpis!.netLiquidBalance : (txAgg?.netLiquidBalanceUsd ?? 0);
                const riskScoreVal = isSuperAdminLive
                  ? kpis!.riskExposureScore
                  : fAgg && (txAgg?.totalCount ?? 0) > 0
                  ? Math.min(100, Math.round((fAgg.totalCases / Math.max(1, txAgg?.totalCount ?? 1)) * 100))
                  : 0;
                const mrrDisplay = isSuperAdminLive
                  ? `$${(kpis!.institutionalMrr / 1000).toFixed(1)}K`
                  : currentRole === 'SUPER_ADMIN'
                  ? 'Unavailable'
                  : 'Platform Scope';

                return (
                  <>
                    <ThreeDKpiCard
                      title="Settled Volume (YTD)"
                      value={`₹${(settledInr / 10000000).toFixed(2)} Cr`}
                      subValue={isSuperAdminLive ? 'Cross-tenant aggregate' : `${companyName} verified ledger`}
                      change={txAgg?.source === 'supabase' || isSuperAdminLive ? 'Live DB' : 'Unavailable'}
                      trend="up"
                      tag={isSuperAdminLive ? 'Global' : 'Tenant'}
                      icon={<TrendingUp size={18} />}
                      variant="gold-accent"
                    />
                    <ThreeDKpiCard
                      title="Institutional MRR"
                      value={mrrDisplay}
                      subValue={isSuperAdminLive ? 'Live active subscriptions' : 'Restricted to Super Admin'}
                      change={isSuperAdminLive ? 'Live' : 'Scoped'}
                      trend="up"
                      tag="SaaS"
                      icon={<Building2 size={18} />}
                    />
                    <ThreeDKpiCard
                      title="Fraud Prevention"
                      value={`₹${(preventedInr / 1000000).toFixed(2)}M`}
                      subValue="Capital secured in escrow"
                      change={fAgg?.source === 'supabase' || isSuperAdminLive ? 'Verified' : 'Unavailable'}
                      trend="up"
                      tag="Risk"
                      icon={<ShieldCheck size={18} />}
                    />
                    <ThreeDKpiCard
                      title="SLA Compliance"
                      value={`${slaPct.toFixed(1)}%`}
                      subValue="Operational throughput"
                      change={slaPct >= 90 ? 'Target Met' : 'Auditing'}
                      trend="up"
                      tag="Ops"
                      icon={<RotateCw size={18} />}
                    />
                    <ThreeDKpiCard
                      title="Compliance Score"
                      value={`${kycCompliancePct.toFixed(1)}%`}
                      subValue={isSuperAdminLive ? 'Global KYC audit' : `${kAgg?.verifiedCount ?? 0} verified KYC`}
                      change={kAgg?.source === 'supabase' || isSuperAdminLive ? 'Audited' : 'Pending'}
                      trend="up"
                      tag="Audit"
                      icon={<AlertCircle size={18} />}
                    />
                    <ThreeDKpiCard
                      title="Active Users"
                      value={activeUsersVal.toLocaleString()}
                      subValue="Registered tenant profiles"
                      change={activeUsersVal > 0 ? 'Live' : '0 Records'}
                      trend="up"
                      tag="Users"
                      icon={<Users size={18} />}
                    />
                    <ThreeDKpiCard
                      title="Net Liquid Balance"
                      value={`$${(netLiquidUsd / 1000000).toFixed(2)}M`}
                      subValue="Consolidated USD Base"
                      change={txAgg?.source === 'supabase' || isSuperAdminLive ? 'Verified' : 'Unavailable'}
                      trend="up"
                      tag="Treasury"
                      icon={<LayoutDashboard size={18} />}
                    />
                    <ThreeDKpiCard
                      title="Risk Exposure"
                      value={`${riskScoreVal}`}
                      subValue="Composite anomaly index"
                      change={riskScoreVal <= 20 ? 'Low' : 'Elevated'}
                      trend="down"
                      tag="Safety"
                      icon={<ShieldAlert size={18} />}
                    />
                  </>
                );
              })()}
            </div>

            {/* Global Filters */}
            <DashboardFilterBar filters={filters} onFilterChange={setFilters} isLoading={txLoading || fLoading} />

            {/* Module Navigation Tabs */}
            <div className="flex overflow-x-auto pb-2 scrollbar-hide gap-1 bg-[#121212]/50 p-1 rounded-xl border border-[#3A3A3A]">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id as IntelligenceModule)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold font-cinzel transition-all whitespace-nowrap ${
                    activeModule === item.id 
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] shadow-[0_0_15px_rgba(212,160,23,0.3)]' 
                    : 'text-[#9CA3AF] hover:text-[#FAF7F0] hover:bg-[#1A1A1A]'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            {/* Active Module Content */}
            <div className="bg-[#121212]/30 p-1 rounded-2xl border border-[#262626]">
              {renderModule()}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs text-[#FAF7F0]">
      {/* Platform Header */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#0A0A0A] via-[#1A1A1A] to-[#0A0A0A] border border-[#3A3A3A] shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="px-2 py-0.5 rounded-md bg-[#D4A017] text-[#0A0A0A] text-[9px] font-black uppercase tracking-[0.2em] shadow-[0_0_10px_rgba(212,160,23,0.4)]">
              Enterprise Intelligence
            </div>
            <span className="text-[10px] text-[#9CA3AF] font-mono tracking-tighter uppercase">{companyName} // PLATFORM NODE // LIVE</span>
            {txAgg?.isPartial && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-400 animate-pulse flex items-center gap-1">
                <Activity size={10} />
                Partial Stream
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] leading-tight">
            Banking Intelligence Center
          </h1>
          <p className="text-[11px] text-[#9CA3AF] max-w-2xl font-medium leading-relaxed">
            Consolidated administrative intelligence dashboard. Real-time surveillance of global settlement rails, multi-tenant liquidity pools, and compliance throughput.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              queryClient.invalidateQueries();
              if (onRefreshUsers) onRefreshUsers();
            }}
            title="Refresh live telemetry"
            className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A] hover:border-[#D4A017] text-[#D4A017] transition-all hover:scale-105 active:scale-95 group"
          >
            <RotateCw size={16} className={`${txLoading || fLoading || kLoading || sLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          </button>
          
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-b from-[#D4A017] to-[#B87333] text-[#0A0A0A] font-bold text-[11px] hover:brightness-110 shadow-[0_10px_20px_rgba(212,160,23,0.2)] transition-all"
          >
            <UserPlus size={16} />
            PROVISION ASSET
          </button>
        </div>
      </div>

      {/* NODAL INTELLIGENCE STATUS BAR */}
      <div className="flex flex-wrap gap-2 px-2">
        <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-[#121212]/80 border border-[#3A3A3A] backdrop-blur-md shadow-inner">
          <div className="flex items-center gap-2 border-r border-[#3A3A3A] pr-4">
            <div className={`w-2 h-2 rounded-full ${Object.values(nodeStatuses).every(s => s === 'operational' || s === 'restricted') ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#E6C78B]">System Health</span>
          </div>
          <div className="flex items-center gap-3">
            {Object.entries(nodeStatuses).map(([key, status]) => (
              <div 
                key={key} 
                className="flex items-center gap-1.5"
                title={`${key}: ${status.toUpperCase()}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${
                  status === 'operational' ? 'bg-emerald-500/80' :
                  status === 'timeout' ? 'bg-orange-500 animate-pulse' :
                  status === 'degraded' ? 'bg-amber-500 animate-pulse' :
                  status === 'restricted' ? 'bg-blue-400' :
                  status === 'loading' ? 'bg-[#9CA3AF] animate-spin h-1.5 w-1.5 border-b border-[#D4A017] rounded-full' :
                  'bg-red-500 animate-bounce'
                }`} />
                <span className={`text-[9px] font-bold font-mono uppercase ${
                  status === 'operational' ? 'text-[#9CA3AF]' :
                  status === 'timeout' ? 'text-orange-300' :
                  status === 'restricted' ? 'text-blue-300' :
                  status === 'unavailable' ? 'text-red-300' :
                  'text-[#FAF7F0]'
                }`}>
                  {key}
                  {status === 'timeout'
                    ? ' (Timeout)'
                    : status === 'restricted'
                    ? ' (Restricted)'
                    : status === 'unavailable'
                    ? ' (Unavailable)'
                    : status === 'degraded'
                    ? ' (Degraded)'
                    : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {adminNotice && (
        <div
          className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 ${
            adminNotice.type === 'error'
              ? 'bg-red-950/60 border-red-500/50 text-red-200'
              : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <span>{adminNotice.message}</span>
          <button onClick={() => setAdminNotice(null)} className="text-[10px] underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {combinedDbError && (
        <WidgetFailureNotice
          widgetName={failingWidgetLabel}
          status={hasTimeoutNode ? 'TIMEOUT' : 'DEGRADED'}
          error={combinedDbError}
          onRetry={() => {
            if (currentRole === 'SUPER_ADMIN' && telemetryStatuses.kpis !== 'OPERATIONAL') refetchKpis();
            if (telemetryStatuses.transactions !== 'OPERATIONAL') refetchTx();
            if (supportAuthorized && telemetryStatuses.support !== 'OPERATIONAL') refetchSupport();
            if (fraudAuthorized && telemetryStatuses.fraud !== 'OPERATIONAL') refetchFraud();
            if (telemetryStatuses.kyc !== 'OPERATIONAL') refetchKyc();
          }}
          isRetrying={kpisFetching || txFetching || sFetching || fFetching || kFetching}
        />
      )}

      <div className="min-h-[600px]">
        {renderContent()}
      </div>

      <UserManagementModal
        currentRole={currentRole}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveUser}
        adminTenantId={tenantId}
      />

      <ChangeRoleModal
        isOpen={changeRoleOpen}
        onClose={() => {
          setChangeRoleOpen(false);
          setChangeRoleUser(null);
        }}
        targetUser={changeRoleUser}
        currentRole={currentRole}
        currentUserTenantId={tenantId}
        onRoleChanged={() => {
          if (onRefreshUsers) onRefreshUsers();
        }}
      />
    </div>
  );
};

export default AdminDashboard;
