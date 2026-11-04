import React, { useState, useMemo, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from '../../services/finovaDatabase';

import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { DashboardFilterBar, DashboardFilters } from './DashboardFilterBar';
import { ModuleSkeleton, KpiSkeleton } from './DashboardSkeletons';

// Lazy load heavy intelligence modules
const TransactionIntelligence = lazy(() => import('./intelligence/TransactionIntelligence').then(m => ({ default: m.TransactionIntelligence })));
const FraudAMLSurveillance = lazy(() => import('./intelligence/FraudAMLSurveillance').then(m => ({ default: m.FraudAMLSurveillance })));
const KYCCompliance = lazy(() => import('./intelligence/KYCCompliance').then(m => ({ default: m.KYCCompliance })));
const SupportOperations = lazy(() => import('./intelligence/SupportOperations').then(m => ({ default: m.SupportOperations })));
const AuditSecurityTrail = lazy(() => import('./intelligence/AuditSecurityTrail').then(m => ({ default: m.AuditSecurityTrail })));
const InstitutionHealth = lazy(() => import('./intelligence/BatchModules').then(m => ({ default: m.InstitutionHealth })));
const RevenueAnalytics = lazy(() => import('./intelligence/BatchModules').then(m => ({ default: m.RevenueAnalytics })));
const TreasuryLiquidity = lazy(() => import('./intelligence/BatchModules').then(m => ({ default: m.TreasuryLiquidity })));
const SystemHealth = lazy(() => import('./intelligence/FinalModules').then(m => ({ default: m.SystemHealth })));
const StrategicMap = lazy(() => import('./intelligence/FinalModules').then(m => ({ default: m.StrategicMap })));

import { UserManagementModal } from '../UserManagementModal';
import { ChangeRoleModal } from '../common/ChangeRoleModal';
import { AdminUserManagementPage } from '../admin/AdminUserManagementPage';
import { AdminCustomerManagementPage } from '../admin/AdminCustomerManagementPage';
import { AdminOperationsPage } from '../admin/AdminOperationsPage';

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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentRole,
  users,
  onUpdateUsers,
  onRefreshUsers,
  activeSection = 'dashboard',
  currentUser,
}) => {
  const [activeModule, setActiveModule] = useState<IntelligenceModule>('overview');
  const [modalOpen, setModalOpen] = useState(false);
  const [changeRoleUser, setChangeRoleUser] = useState<UserAccount | null>(null);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);

  const [filters, setFilters] = useState<DashboardFilters>({
    startDate: '',
    endDate: '',
    currency: 'ALL',
    branchCity: 'Global Operations',
  });

  const tenantId = currentUser?.tenantId || 'tenant_apex_bank';
  const tenant = useMemo(() => getTenantById(tenantId), [tenantId]);
  const companyName = tenant?.name || currentUser?.tenantName || 'Apex Global Bank';

  // --- REACT QUERY DATA FETCHING ---

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['platform-kpis', currentRole],
    queryFn: () => currentRole === 'SUPER_ADMIN' ? fetchPlatformExecutiveKpis() : Promise.resolve(null),
    enabled: !!currentRole,
  });

  const { data: txAgg, isLoading: txLoading } = useQuery({
    queryKey: ['tx-aggregates', tenantId, filters],
    queryFn: () => fetchTransactionAggregatesResultFromDb(tenantId, { ...filters }),
  });

  const { data: sAgg, isLoading: sLoading } = useQuery({
    queryKey: ['support-aggregates', tenantId],
    queryFn: () => fetchSupportAggregatesResultFromDb(tenantId),
  });

  const { data: fAgg, isLoading: fLoading } = useQuery({
    queryKey: ['fraud-aggregates', tenantId, filters.currency],
    queryFn: () => fetchFraudAggregatesResultFromDb(tenantId, { currency: filters.currency }),
  });

  const { data: kAgg, isLoading: kLoading } = useQuery({
    queryKey: ['kyc-aggregates', tenantId],
    queryFn: () => fetchKycAggregatesResultFromDb(tenantId),
  });

  const nodeStatuses = useMemo(() => ({
    kpis: currentRole !== 'SUPER_ADMIN' ? 'restricted' : (kpisLoading ? 'loading' : 'operational'),
    transactions: txLoading ? 'loading' : (txAgg?.source === 'supabase' ? 'operational' : 'degraded'),
    support: sLoading ? 'loading' : (sAgg?.source === 'supabase' ? 'operational' : 'degraded'),
    fraud: fLoading ? 'loading' : (fAgg?.source === 'supabase' ? 'operational' : 'degraded'),
    kyc: kLoading ? 'loading' : (kAgg?.source === 'supabase' ? 'operational' : 'degraded'),
  }), [currentRole, kpisLoading, txLoading, txAgg, sLoading, sAgg, fLoading, fAgg, kLoading, kAgg]);

  const handleSaveUser = async (userData: Partial<UserAccount>) => {
    if (userData.role === 'SUPER_ADMIN' || userData.role === 'ADMIN') {
      alert('Governance Violation: Company Admins cannot provision Admin or Super Admin accounts.');
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
    } else {
      alert(`User provisioning failed: ${res.error}`);
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
                  <div className="rounded-2xl bg-[#1A1A1A]/80 border border-[#3A3A3A] p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-cinzel text-lg font-bold text-[#E6C78B]">Settlement Flux</h3>
                        <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest font-mono">Cross-tenant clearing velocity</p>
                      </div>
                      <TrendingUp size={20} className="text-[#D4A017]" />
                    </div>
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
                  <div className="rounded-2xl bg-[#1A1A1A]/80 border border-[#3A3A3A] p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-cinzel text-lg font-bold text-[#E6C78B]">Risk Distribution</h3>
                        <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest font-mono">Real-time threat vectors</p>
                      </div>
                      <ShieldAlert size={20} className="text-[#D4A017]" />
                    </div>
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
                  <div className="p-5 rounded-2xl bg-[#1A1A1A]/50 border border-[#3A3A3A] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-[#D4A017] mb-2">
                        <Fingerprint size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Compliance</span>
                      </div>
                      <h4 className="text-sm font-bold text-[#FAF7F0]">KYC Onboarding Queue</h4>
                    </div>
                    <div className="mt-4">
                      <span className="text-3xl font-black text-[#E6C78B]">{kAgg?.totalCount || 0}</span>
                      <span className="text-[10px] text-[#9CA3AF] ml-2">Pending Review</span>
                    </div>
                  </div>

                  {/* Support Summary */}
                  <div className="p-5 rounded-2xl bg-[#1A1A1A]/50 border border-[#3A3A3A] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-[#D4A017] mb-2">
                        <LifeBuoy size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Operations</span>
                      </div>
                      <h4 className="text-sm font-bold text-[#FAF7F0]">Concierge Desk Health</h4>
                    </div>
                    <div className="mt-4">
                      <span className="text-3xl font-black text-[#E6C78B]">{sAgg?.slaCompliancePct || 0}%</span>
                      <span className="text-[10px] text-[#9CA3AF] ml-2">SLA Compliance</span>
                    </div>
                  </div>

                  {/* Liquidity Summary */}
                  <div className="p-5 rounded-2xl bg-[#1A1A1A]/50 border border-[#3A3A3A] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-[#D4A017] mb-2">
                        <Wallet size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Treasury</span>
                      </div>
                      <h4 className="text-sm font-bold text-[#FAF7F0]">Net Liquid Balance</h4>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1">
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
              ) : (
                <>
                  <ThreeDKpiCard 
                    title="Settled Volume (YTD)" 
                    value={`₹${((kpis?.settledVolumeYtd || 5240000000) / 10000000).toFixed(1)}B`} 
                    subValue="Cross-tenant aggregate" 
                    change="+14.2%" trend="up" tag="Global" icon={<TrendingUp size={18} />} variant="gold-accent"
                  />
                  <ThreeDKpiCard 
                    title="Institutional MRR" 
                    value={`$${((kpis?.institutionalMrr || 285000) / 1000).toFixed(1)}K`} 
                    subValue="Live active subscriptions" 
                    change="+8.4%" trend="up" tag="Live" icon={<Building2 size={18} />}
                  />
                  <ThreeDKpiCard 
                    title="Fraud Prevention" 
                    value={`₹${((kpis?.preventedFraudVolume || 138420000) / 1000000).toFixed(1)}M`} 
                    subValue="Capital secured in escrow" 
                    change="Verified" trend="up" tag="Risk" icon={<ShieldCheck size={18} />}
                  />
                  <ThreeDKpiCard 
                    title="SLA Compliance" 
                    value={`${kpis?.slaCompliancePct || 98.4}%`} 
                    subValue="Operational throughput" 
                    change="Target Met" trend="up" tag="Ops" icon={<RotateCw size={18} />}
                  />
                  <ThreeDKpiCard 
                    title="Compliance Score" 
                    value={`${kpis?.complianceScore || 99.4}%`} 
                    subValue="Global platform audit" 
                    change="Stable" trend="up" tag="Audit" icon={<AlertCircle size={18} />}
                  />
                  <ThreeDKpiCard 
                    title="Active Users" 
                    value={`${(kpis?.activeUsers || 215000).toLocaleString()}`} 
                    subValue="Unique verified identities" 
                    change="+12K" trend="up" tag="Users" icon={<Users size={18} />}
                  />
                  <ThreeDKpiCard 
                    title="Net Liquid Balance" 
                    value={`$${((kpis?.netLiquidBalance || 842500000) / 1000000).toFixed(1)}M`} 
                    subValue="Consolidated USD Base" 
                    change="Optimized" trend="up" tag="Treasury" icon={<LayoutDashboard size={18} />}
                  />
                  <ThreeDKpiCard 
                    title="Risk Exposure" 
                    value={`${kpis?.riskExposureScore || 12}`} 
                    subValue="Composite platform index" 
                    change="Low" trend="down" tag="Safety" icon={<ShieldAlert size={18} />}
                  />
                </>
              )}
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
            onClick={() => {}} // React Query handles refetching via keys automatically
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
            <div className={`w-2 h-2 rounded-full ${Object.values(nodeStatuses).every(s => s === 'operational') ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`} />
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
                  status === 'operational' ? 'bg-emerald-500/40' :
                  status === 'degraded' ? 'bg-amber-500 animate-pulse' :
                  status === 'restricted' ? 'bg-blue-500' :
                  status === 'loading' ? 'bg-[#9CA3AF] animate-spin h-1.5 w-1.5 border-b border-[#D4A017] rounded-full' :
                  'bg-red-500 animate-bounce'
                }`} />
                <span className={`text-[9px] font-bold font-mono uppercase ${status === 'operational' ? 'text-[#9CA3AF]' : 'text-[#FAF7F0]'}`}>{key}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
