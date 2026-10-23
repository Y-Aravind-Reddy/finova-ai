import React, { useState, useEffect, useCallback } from 'react';
import {
  UserAccount,
  UserRole,
} from '../../data/finovaDatasets';
import {
  TenantWorkspace,
  getStoredTenants,
  toggleTenantStatus,
  getPlatformSaaSMetrics,
  getTenantById,
} from '../../data/tenantStore';
import {
  deleteProfileFromDb,
  saveProfileToDb,
  fetchTenantWorkspacesResultFromDb,
  fetchFraudCasesResultFromDb,
  fetchTransactionsResultFromDb,
  fetchFraudAggregatesResultFromDb,
} from '../../services/finovaDatabase';
import { convertToUsd, formatCurrencyWithUsdDisclosure } from '../../services/currencyService';

import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDRevenueViz } from '../charts3d/ThreeDRevenueViz';
import { ThreeDProgressRing } from '../charts3d/ThreeDProgressRing';
import { UserManagementModal } from '../UserManagementModal';
import { ChangeRoleModal } from '../common/ChangeRoleModal';
import {
  Users,
  Activity,
  DollarSign,
  ShieldAlert,
  Headphones,
  Server,
  UserPlus,
  Edit,
  Trash2,
  Lock,
  Building2,
  Globe,
  Power,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Filter,
  RotateCw,
  Database,
  ShieldCheck,
} from 'lucide-react';

interface SuperAdminDashboardProps {
  currentRole: UserRole;
  users: UserAccount[];
  onUpdateUsers: (newUsers: UserAccount[]) => void;
  onRefreshUsers?: () => void;
  onOpenCopilot: () => void;
  selectedTenantId?: string;
  onSelectTenant?: (tenantId: string) => void;
  onNavigate?: (route: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  currentRole,
  users,
  onUpdateUsers,
  onRefreshUsers,
  onOpenCopilot,
  selectedTenantId: externalSelectedTenantId,
  onSelectTenant,
  onNavigate,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [changeRoleUser, setChangeRoleUser] = useState<UserAccount | null>(null);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('ALL');

  // Multi-Tenant Inspector State
  const [tenants, setTenants] = useState<TenantWorkspace[]>(getStoredTenants());
  const [internalTenantId, setInternalTenantId] = useState<string>('ALL');
  const activeTenantId = externalSelectedTenantId || internalTenantId;

  const currentInspectedTenant = activeTenantId !== 'ALL' ? getTenantById(activeTenantId) : undefined;
  const saasMetrics = getPlatformSaaSMetrics();

  // Real Database Metrics State
  const [dbFraudPrevented, setDbFraudPrevented] = useState<number>(0);
  const [dbFraudCaseCount, setDbFraudCaseCount] = useState<number>(0);
  const [dbLoading, setDbLoading] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const loadSuperAdminData = useCallback(async () => {
    setDbLoading(true);
    setDbError(null);
    try {
      const [wRes, fAgg] = await Promise.all([
        fetchTenantWorkspacesResultFromDb(),
        fetchFraudAggregatesResultFromDb('ALL'),
      ]);

      if (wRes.data && wRes.data.length > 0) {
        setTenants(wRes.data);
      }

      setDbFraudPrevented(fAgg.preventedVolumeUsd);
      setDbFraudCaseCount(fAgg.totalCases);

      if (wRes.error) {
        setDbError(wRes.error);
      }
    } catch (e: any) {
      console.warn('Super Admin DB query note:', e);
      setDbError(e?.message || 'Database query error');
    } finally {
      setDbLoading(false);
    }
  }, []);


  useEffect(() => {
    loadSuperAdminData();
    if (onRefreshUsers) {
      onRefreshUsers();
    }
  }, [loadSuperAdminData, onRefreshUsers]);

  // Count live Supabase records vs demo
  const liveCount = users.filter((u) => u.authSource === 'supabase').length;

  const handleTenantChange = (tId: string) => {
    setInternalTenantId(tId);
    if (onSelectTenant) onSelectTenant(tId);
  };

  const handleToggleTenant = (tId: string) => {
    const updated = toggleTenantStatus(tId);
    if (updated) {
      setTenants(getStoredTenants());
    }
  };

  // 3D Role Distribution Chart dynamically calculated from real users array
  const roleDonutData = React.useMemo(() => {
    if (users.length === 0) {
      return [{ label: 'No Users', value: 1, subtext: '0 identities' }];
    }
    const rMap: Record<string, number> = {};
    for (const u of users) {
      const r = u.role || 'CUSTOMER';
      rMap[r] = (rMap[r] || 0) + 1;
    }
    return Object.entries(rMap).map(([role, count]) => ({
      label: role.replace('_', ' '),
      value: count,
      subtext: `${Math.round((count / users.length) * 100)}% share`,
    }));
  }, [users]);

  const userGrowthData = [
    { label: 'Q1 24', value: 82400 },
    { label: 'Q2 24', value: 94800 },
    { label: 'Q3 24', value: 108200 },
    { label: 'Q4 24', value: 121500 },
    { label: 'Q1 25', value: 133200 },
    { label: 'Q2 25', value: 139800 },
    { label: 'Q3 25', value: 144500 },
    { label: 'Q4 25', value: 148920 },
  ];

  const aiUsageData = [
    { label: 'Mon', value: 14200, secondaryValue: 12000, meta: 'AML Tracing' },
    { label: 'Tue', value: 18400, secondaryValue: 15000, meta: 'Portfolio Models' },
    { label: 'Wed', value: 19800, secondaryValue: 16500, meta: 'Risk Scoring' },
    { label: 'Thu', value: 22100, secondaryValue: 17800, meta: 'Escrow Audits' },
    { label: 'Fri', value: 26500, secondaryValue: 21000, highlight: true, meta: 'Settlement Runs' },
    { label: 'Sat', value: 11200, secondaryValue: 9000, meta: 'Weekend Batch' },
    { label: 'Sun', value: 9800, secondaryValue: 8000, meta: 'Cold Ledger Sync' },
  ];

  // User Provisioning (New Account)
  const handleSaveUser = async (userData: Partial<UserAccount>) => {
    const targetTenant = getTenantById(userData.tenantId);
    const newId = `USR-${Math.floor(1000 + Math.random() * 9000)}`;
    const newUser: UserAccount = {
      id: newId,
      name: userData.name || 'New Staff',
      email: userData.email || '',
      role: userData.role || 'ADMIN',
      status: userData.status || 'Active',
      tier: userData.tier || 'Executive Staff',
      createdDate: new Date().toISOString().split('T')[0],
      lastActive: 'Just now',
      phone: userData.phone || '+1 (212) 555-0100',
      country: userData.country || 'United States',
      twoFactorEnabled: true,
      tenantId: userData.tenantId || 'tenant_apex_bank',
      tenantName: targetTenant?.name || 'Apex Global Bank',
      notes: userData.notes || 'Created via Super Admin SaaS Panel',
      authSource: 'local',
    };
    const res = await saveProfileToDb(newUser);
    if (res.success) {
      onUpdateUsers([newUser, ...users]);
      if (onRefreshUsers) onRefreshUsers();
    } else {
      alert(`Provisioning failed: ${res.error}`);
    }
    setEditingUser(null);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm(`Super Admin Authority: Confirm permanent revocation of user ${userId}?`)) {
      deleteProfileFromDb(userId);
      onUpdateUsers(users.filter((u) => u.id !== userId));
    }
  };

  // Super Admin view restriction: ONLY display platform Admin and Super Admin accounts.
  // Never expose individual Customer, Finance Analyst, or Support Executive records.
  const adminAuthorizedUsers = users.filter((u) => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN');

  const tenantScopedUsers =
    activeTenantId === 'ALL'
      ? adminAuthorizedUsers
      : adminAuthorizedUsers.filter((u) => u.tenantId === activeTenantId || u.role === 'SUPER_ADMIN');

  const filteredUsers =
    filterRole === 'ALL'
      ? tenantScopedUsers
      : tenantScopedUsers.filter((u) => u.role === filterRole);

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Super Admin SaaS Header */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider">
              Platform SaaS Operator
            </span>
            <span className="text-xs text-[#E6C78B]">Multi-Tenant Financial Architecture</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            Super Admin Executive Oversight
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Global SaaS operating console. Monitor cross-tenant settlement rails, enforce company workspace isolation, and administer platform-level credentials.
          </p>
        </div>

        {/* Tenant Switcher & Quick Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
          {/* Tenant Inspector Selector */}
          <div className="bg-[#121212] p-1.5 rounded-xl border border-[#3A3A3A] flex items-center gap-2 w-full sm:w-auto">
            <Building2 size={15} className="text-[#D4A017] ml-1 shrink-0" />
            <select
              value={activeTenantId}
              onChange={(e) => handleTenantChange(e.target.value)}
              className="bg-transparent text-[#FAF7F0] font-bold text-xs focus:outline-none cursor-pointer pr-2"
            >
              <option value="ALL">All Workspaces (Aggregate SaaS View)</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type} • {t.status})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onNavigate) {
                  onNavigate('/super-admin/company-workspaces');
                } else {
                  setEditingUser(null);
                  setModalOpen(true);
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_15px_rgba(212,160,23,0.35)] transition-all whitespace-nowrap"
            >
              <Building2 size={14} />
              <span>Manage Tenants</span>
            </button>
            <button
              onClick={onOpenCopilot}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 text-[#E6C78B] text-xs transition-colors whitespace-nowrap"
            >
              <Lock size={13} className="text-[#D4A017]" />
              <span>Audit Copilot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inspected Tenant Banner if specific tenant selected */}
      {currentInspectedTenant && (
        <div className="p-4 rounded-xl bg-[#262626] border border-[#D4A017]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#121212] border border-[#3A3A3A] flex items-center justify-center text-[#D4A017]">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[#FAF7F0]">{currentInspectedTenant.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]">
                  {currentInspectedTenant.shortName || currentInspectedTenant.type}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#121212] text-[#D4A017] border border-[#D4A017]/40">
                  {currentInspectedTenant.status}
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                {currentInspectedTenant.headquarters} • License: {currentInspectedTenant.licenseNo} • Admin: {currentInspectedTenant.adminEmail}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleTenantChange('ALL')}
            className="text-[11px] text-[#D4A017] hover:text-[#E6C78B] underline"
          >
            Reset to Platform Aggregate View
          </button>
        </div>
      )}

      {/* Database / RLS Status Banner */}
      {dbError && (
        <div className="rounded-xl p-4 bg-[#1E1A10] border border-[#D4A017]/50 text-[#FAF7F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="text-[#D4A017] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#E6C78B] text-xs">
                Platform Root Database Telemetry Notice
              </p>
              <p className="text-[11px] text-[#FAF7F0]/80 mt-0.5 max-w-3xl">
                {dbError}
              </p>
              <p className="text-[10px] text-[#9CA3AF] mt-1">
                PostgreSQL Row-Level Security restricts table queries to authenticated sessions. Authenticate with a confirmed <code className="text-[#E6C78B]">SUPER_ADMIN</code> account to stream live global telemetry.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              loadSuperAdminData();
              if (onRefreshUsers) onRefreshUsers();
            }}
            disabled={dbLoading}
            className="px-3 py-1.5 rounded-lg bg-[#121212] border border-[#D4A017]/60 text-[#D4A017] text-xs hover:bg-[#262626] flex items-center gap-1.5 shrink-0 transition-all disabled:opacity-50"
          >
            <RotateCw size={12} className={dbLoading ? 'animate-spin' : ''} />
            <span>Retry Query</span>
          </button>
        </div>
      )}

      {/* 6 Top 3D KPI Cards - Multi-Tenant SaaS Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <ThreeDKpiCard
          title="Active Workspaces"
          value={`${tenants.filter((t) => t.status === 'Active').length} / ${tenants.length}`}
          subValue="Banks & NBFCs"
          change="+1 Q4"
          trend="up"
          tag="Multi-Tenant"
          icon={<Building2 size={20} />}
          sparkline={[1, 2, 2, 3, 3, 4, tenants.length]}
        />
        <ThreeDKpiCard
          title="Platform MRR"
          value={`$${(saasMetrics.totalMrrUsd / 1000).toFixed(1)}k`}
          subValue={`ARR: $${(saasMetrics.totalArrUsd / 1000000).toFixed(2)}M (USD Base)`}
          change="+28.4%"
          trend="up"
          tag="USD Base"
          variant="gold-accent"
          icon={<DollarSign size={20} />}
          sparkline={[65, 78, 85, 92, 102, 114, 123]}
        />
        <ThreeDKpiCard
          title="Total Assets"
          value={`$${(saasMetrics.aggregateVolumeYtdUsd / 1000000000).toFixed(2)}B`}
          subValue="Cross-Tenant YTD (USD)"
          change="+34.8%"
          trend="up"
          tag="USD Normalized"
          icon={<Activity size={20} />}
          sparkline={[210, 280, 340, 410, 480, 510, 531]}
        />
        <ThreeDKpiCard
          title="Fraud Prevented"
          value={`$${dbFraudPrevented >= 1000000 ? (dbFraudPrevented / 1000000).toFixed(2) + 'M' : dbFraudPrevented.toLocaleString()}`}
          subValue={`${dbFraudCaseCount} Cases (USD Base)`}
          change={dbFraudPrevented > 0 ? 'Surveillance Active' : 'Clean Ledger'}
          trend="up"
          tag="USD Base"
          icon={<ShieldAlert size={20} />}
          sparkline={dbFraudPrevented > 0 ? [10, 20, 25, 30] : [0, 0, 0, 0]}
        />
        <ThreeDKpiCard
          title="Enrolled Users"
          value={users.length.toLocaleString()}
          subValue={`${liveCount} Live DB Accounts`}
          change="Real-time"
          trend="up"
          tag="Identities"
          icon={<Users size={20} />}
          sparkline={[Math.max(1, users.length - 2), Math.max(1, users.length - 1), users.length]}
        />
        <ThreeDKpiCard
          title="Platform SLA"
          value="99.992%"
          subValue="18.4ms Latency"
          change="Nominal"
          trend="up"
          tag="Cluster Health"
          icon={<Server size={20} />}
          sparkline={[99, 99, 100, 99, 100, 100, 100]}
        />
      </div>

      {/* MULTI-TENANT COMPANY WORKSPACES MATRIX */}
      <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-[#3A3A3A]">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[#D4A017]" />
            <h3 className="font-cinzel text-base font-bold text-[#FAF7F0]">
              Onboarded Company Workspaces (Multi-Tenant Matrix)
            </h3>
          </div>
          <span className="text-[10px] text-[#9CA3AF]">
            {tenants.length} Workspaces Registered • Cryptographic Tenant Isolation
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {tenants.map((t) => {
            const isSelected = activeTenantId === t.id;
            return (
              <div
                key={t.id}
                onClick={() => handleTenantChange(t.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#121212] border-[#D4A017] shadow-[0_0_15px_rgba(212,160,23,0.25)]'
                    : 'bg-[#121212]/70 border-[#3A3A3A] hover:border-[#3A3A3A] hover:bg-[#121212]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-[#FAF7F0] truncate">{t.name}</p>
                    <p className="text-[10px] text-[#9CA3AF] truncate">{t.type} • {t.headquarters}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      t.status === 'Active'
                        ? 'bg-[#262626] text-[#E6C78B] border border-[#D4A017]/40'
                        : 'bg-[#262626] text-[#B87333] border border-[#B87333]'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#3A3A3A] flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-[10px] text-[#9CA3AF] block">Plan</span>
                    <span className="text-[#D4A017] font-semibold">{t.plan}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#9CA3AF] block">Volume</span>
                    <span className="text-[#FAF7F0] font-semibold">{t.currencySymbol}{(t.transactionVolumeYTD / 1000000).toFixed(1)}M</span>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#9CA3AF]">
                  <span>Admin: {t.adminName}</span>
                  <span className="text-[#D4A017]">{isSelected ? '✓ Inspecting' : 'Click to Inspect →'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 3D Visualization Row: 3D Revenue Architecture & 3D User Growth Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDRevenueViz
          title="3D SaaS Revenue Architecture"
          subtitle="Monthly Recurring Revenue (MRR) by Tenant Subscription Tier"
        />
        <ThreeDAreaChart
          title="3D Institutional User Expansion Curve"
          subtitle="Multi-Tenant Account Aggregation (2024 - 2026)"
          data={userGrowthData}
          valuePrefix=""
          valueSuffix=" users"
          height={240}
        />
      </div>

      {/* Second 3D Row: 3D Donut Role Distribution & 3D Column AI Sentinel Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDDonutChart
          title="3D Global Role & Clearance Distribution"
          subtitle="Identity Breakdown Across All Tenant Banks"
          segments={roleDonutData}
          centerLabel="Identities"
          centerValue={saasMetrics.aggregateUsers.toLocaleString()}
          height={320}
        />
        <ThreeDColumnChart
          title="3D Multi-Tenant AI Engine Compute Velocity"
          subtitle="Daily Automated Queries vs Authorized Settlements"
          data={aiUsageData}
          height={280}
          valuePrefix=""
          valueSuffix="k runs"
          dualSeries={true}
          primaryLabel="AI Queries"
          secondaryLabel="Settled"
        />
      </div>

      {/* Role Management & Identity Table */}
      <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#3A3A3A] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4A017] shadow-[0_0_8px_#D4A017]" />
                Super Admin Platform User Management
              </h3>
              {liveCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Supabase DB ({liveCount})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Demo Directory ({tenantScopedUsers.length})
                </span>
              )}
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {activeTenantId === 'ALL'
                ? 'Showing identities across all platform tenant workspaces'
                : `Filtered exclusively to workspace: ${currentInspectedTenant?.name || activeTenantId}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onRefreshUsers && (
              <button
                onClick={onRefreshUsers}
                title="Refresh user directory from database"
                className="p-2 rounded-xl bg-[#121212] border border-[#3A3A3A] hover:border-[#D4A017] text-[#D4A017] transition-all hover:rotate-180 duration-300"
              >
                <RotateCw size={13} />
              </button>
            )}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-1.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
            >
              <option value="ALL">All Admin Accounts ({tenantScopedUsers.length})</option>
              <option value="SUPER_ADMIN">Platform Super Admins</option>
              <option value="ADMIN">Company Admins</option>
            </select>
            <button
              onClick={() => {
                setEditingUser(null);
                setModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold text-xs hover:brightness-110 flex items-center gap-1.5"
            >
              <UserPlus size={14} /> Add User
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                <th className="pb-2.5">User Identity</th>
                <th className="pb-2.5">Tenant Workspace</th>
                <th className="pb-2.5">Role Assignment</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5">Enrolled Date</th>
                <th className="pb-2.5">MFA Vault</th>
                <th className="pb-2.5 text-right">Governance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                    <Users size={24} className="mx-auto mb-2 text-[#D4A017] opacity-60" />
                    <p className="font-semibold text-[#FAF7F0]">No Admin accounts found</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">
                      {activeTenantId === 'ALL'
                        ? 'Zero Admin or Super Admin records match the selected role filter.'
                        : `No Admin records registered under ${currentInspectedTenant?.name || 'this workspace'}.`}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#121212]/50 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-[#FAF7F0]">{u.name}</p>
                        {u.authSource === 'supabase' ? (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                            Live DB
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Demo
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#9CA3AF]">{u.email}</p>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]">
                        {u.tenantName || 'Apex Global Bank'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'SUPER_ADMIN'
                            ? 'bg-[#D4A017] text-[#1A1A1A]'
                            : u.role === 'ADMIN'
                            ? 'bg-[#121212] text-[#E6C78B] border border-[#D4A017]/40'
                            : u.role === 'FINANCE_ANALYST'
                            ? 'bg-[#121212] text-[#FAF7F0] border border-[#B87333]'
                            : 'bg-[#121212] text-[#9CA3AF] border border-[#3A3A3A]'
                        }`}
                      >
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]">
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 text-[11px] text-[#9CA3AF]">{u.createdDate}</td>
                    <td className="py-3">
                      <span className="text-[11px] text-[#D4A017] font-bold">
                        {u.twoFactorEnabled ? '✓ Biometric/Key' : '⚠ SMS Only'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setChangeRoleUser(u);
                            setChangeRoleOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#D4A017] hover:bg-[#3A3A3A] flex items-center gap-1 text-[11px] font-semibold"
                          title="Change User Role (Institutional Governance)"
                        >
                          <ShieldCheck size={14} />
                          <span className="hidden sm:inline">Role</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#B87333] hover:bg-[#3A3A3A]"
                          title="Delete User"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Provisioning Modal */}
      <UserManagementModal
        currentRole={currentRole}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
        editingUser={editingUser}
      />

      {/* Dedicated Change Role Modal */}
      <ChangeRoleModal
        isOpen={changeRoleOpen}
        onClose={() => {
          setChangeRoleOpen(false);
          setChangeRoleUser(null);
        }}
        targetUser={changeRoleUser}
        currentRole={currentRole}
        onRoleChanged={() => {
          if (onRefreshUsers) onRefreshUsers();
        }}
      />
    </div>
  );
};
