import React, { useState, useEffect, useCallback } from 'react';
import {
  UserAccount,
  UserRole,
} from '../../data/finovaDatasets';
import { getStoredTenants, getTenantById } from '../../data/tenantStore';
import {
  saveProfileToDb,
  fetchTransactionsResultFromDb,
  fetchKycRecordsResultFromDb,
  fetchSupportTicketsResultFromDb,
  fetchFraudCasesResultFromDb,
  fetchTransactionAggregatesResultFromDb,
  TransactionAggregates,
} from '../../services/finovaDatabase';
import { convertToUsd, formatCurrencyWithUsdDisclosure } from '../../services/currencyService';

import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDProgressRing } from '../charts3d/ThreeDProgressRing';
import { UserManagementModal } from '../UserManagementModal';
import { ChangeRoleModal } from '../common/ChangeRoleModal';
import {
  Users,
  CheckCircle,
  FileCheck,
  Briefcase,
  UserPlus,
  Edit,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Award,
  Building2,
  Lock,
  RotateCw,
} from 'lucide-react';

interface AdminDashboardProps {
  currentRole: UserRole;
  users: UserAccount[];
  onUpdateUsers: (newUsers: UserAccount[]) => void;
  onRefreshUsers?: () => void;
  activeSection?: string;
  currentUser?: UserAccount;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentRole,
  users,
  onUpdateUsers,
  onRefreshUsers,
  activeSection = 'dashboard',
  currentUser,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [changeRoleUser, setChangeRoleUser] = useState<UserAccount | null>(null);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('ALL');

  // Resolve current company workspace
  const tenantId = currentUser?.tenantId || 'tenant_apex_bank';
  const tenant = getTenantById(tenantId);
  const companyName = tenant?.name || currentUser?.tenantName || 'Apex Global Bank';

  React.useEffect(() => {
    if (activeSection === 'user_mgmt_analysts') setFilterRole('FINANCE_ANALYST');
    else if (activeSection === 'user_mgmt_support') setFilterRole('SUPPORT_EXECUTIVE');
    else if (activeSection === 'user_mgmt_customers' || activeSection === 'customer_management') setFilterRole('CUSTOMER');
    else setFilterRole('ALL');
  }, [activeSection]);

  React.useEffect(() => {
    if (onRefreshUsers) {
      onRefreshUsers();
    }
  }, [onRefreshUsers]);

  // Tenant-scoped users: strictly only users from this company, excluding Super Admin
  const companyUsers = users.filter((u) => {
    if (u.role === 'SUPER_ADMIN') return false;
    return u.tenantId ? u.tenantId === tenantId : true;
  });

  // Real database metrics state
  const [dbSettlementCount, setDbSettlementCount] = useState<number>(0);
  const [dbSettlementVolumeUsd, setDbSettlementVolumeUsd] = useState<number>(0);
  const [dbSettlementVolumeOriginal, setDbSettlementVolumeOriginal] = useState<number>(0);
  const [dbKycCount, setDbKycCount] = useState<number>(0);
  const [dbOpenCasesCount, setDbOpenCasesCount] = useState<number>(0);
  const [dbLoading, setDbLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const loadAdminMetrics = useCallback(async () => {
    setDbLoading(true);
    try {
      const [tAgg, kRes, sRes, fRes] = await Promise.all([
        fetchTransactionAggregatesResultFromDb(tenantId),
        fetchKycRecordsResultFromDb(tenantId),
        fetchSupportTicketsResultFromDb(tenantId),
        fetchFraudCasesResultFromDb(tenantId),
      ]);

      setDbSettlementCount(tAgg.totalCount);
      setDbSettlementVolumeUsd(tAgg.settledVolumeUsd);
      setDbSettlementVolumeOriginal(tAgg.settledVolumeOriginal);

      const kCount = kRes.totalCount ?? kRes.count ?? kRes.data?.length ?? 0;
      setDbKycCount(kCount);

      const openTickets = (sRes.data || []).filter((s) => s.status !== 'Resolved').length;
      const openFraud = (fRes.data || []).filter((f) => f.status !== 'Cleared').length;
      setDbOpenCasesCount(openTickets + openFraud);

      setDbError(kRes.error || sRes.error || fRes.error);
    } catch (err: any) {
      setDbError(err?.message || 'Error querying database');
    } finally {
      setDbLoading(false);
    }
  }, [tenantId]);


  useEffect(() => {
    loadAdminMetrics();
  }, [loadAdminMetrics]);

  // Dynamic KYC breakdown strictly derived from database records
  const kycDonutData = React.useMemo(() => {
    if (dbKycCount === 0) {
      return [{ label: '0 Records Pending', value: 1, subtext: 'Compliance Queue Clean' }];
    }
    return [{ label: 'Verified Records', value: dbKycCount, subtext: `${dbKycCount} in database` }];
  }, [dbKycCount]);

  // Operations volume trend derived from settlement volume (USD Base)
  const txnTrendData = React.useMemo(() => {
    if (dbSettlementVolumeUsd <= 0) {
      return [
        { label: '08:00', value: 0 },
        { label: '10:00', value: 0 },
        { label: '12:00', value: 0 },
        { label: '14:00', value: 0 },
        { label: '16:00', value: 0 },
        { label: '18:00', value: 0 },
        { label: '20:00', value: 0 },
      ];
    }
    const base = Math.round(dbSettlementVolumeUsd / 7);
    return [
      { label: '08:00', value: base },
      { label: '10:00', value: base },
      { label: '12:00', value: base },
      { label: '14:00', value: base },
      { label: '16:00', value: base },
      { label: '18:00', value: base },
      { label: '20:00', value: base },
    ];
  }, [dbSettlementVolumeUsd]);

  // 3D Client Growth Curve based on company users
  const customerGrowthData = React.useMemo(() => {
    const total = companyUsers.length;
    if (total === 0) {
      return [
        { label: 'Q1', value: 0 },
        { label: 'Q2', value: 0 },
        { label: 'Q3', value: 0 },
        { label: 'Q4', value: 0 },
      ];
    }
    return [
      { label: 'Q1', value: Math.max(0, Math.round(total * 0.6)) },
      { label: 'Q2', value: Math.max(0, Math.round(total * 0.75)) },
      { label: 'Q3', value: Math.max(0, Math.round(total * 0.9)) },
      { label: 'Q4', value: total },
    ];
  }, [companyUsers.length]);

  // 3D Case Analytics Column Chart
  const caseAnalyticsData = React.useMemo(() => {
    return [
      { label: 'Desk Cases', value: dbOpenCasesCount, secondaryValue: Math.max(0, dbOpenCasesCount - 1) },
      { label: 'Settlements', value: Math.min(dbSettlementCount, 500), secondaryValue: Math.min(dbSettlementCount, 480) },
      { label: 'KYC Reviews', value: dbKycCount, secondaryValue: 0 },
    ];
  }, [dbOpenCasesCount, dbSettlementCount, dbKycCount]);

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
      notes: userData.notes || `Created via ${companyName} Admin Operations Center`,
      authSource: 'local',
    };

    const res = await saveProfileToDb(newUser);
    if (res.success) {
      onUpdateUsers([newUser, ...users]);
      if (onRefreshUsers) onRefreshUsers();
    } else {
      alert(`User provisioning failed: ${res.error}`);
    }
    setEditingUser(null);
  };

  const filteredCompanyUsers =
    filterRole === 'ALL'
      ? companyUsers
      : companyUsers.filter((u) => u.role === filterRole);

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Company Admin Operations Banner with Tenant Scoping */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName} Workspace
            </span>
            <span className="text-xs text-[#E6C78B]">Clearance: Operations Admin</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            {companyName} Operations Control
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Institutional banking operations console. Managing client onboarding, KYC queues, payment rail settlements, and delegated personnel.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              loadAdminMetrics();
              if (onRefreshUsers) onRefreshUsers();
            }}
            disabled={dbLoading}
            title="Refresh database metrics"
            className="p-2.5 rounded-xl bg-[#141414] border border-[#3A3A3A] hover:border-[#D4A017] text-[#D4A017] transition-all flex items-center gap-1.5 hover:scale-105"
          >
            <RotateCw size={14} className={dbLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline text-[11px] font-bold">Refresh</span>
          </button>
          <button
            onClick={() => {
              setEditingUser(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all shrink-0"
          >
            <UserPlus size={16} />
            Create Customer / Staff
          </button>
        </div>
      </div>

      {/* Database / RLS Status Notification Banner */}
      {dbError && (
        <div className="rounded-xl p-4 bg-[#1E1A10] border border-[#D4A017]/50 text-[#FAF7F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-[#D4A017] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#E6C78B] text-xs">
                Database Telemetry Notice — {companyName} Operations
              </p>
              <p className="text-[11px] text-[#FAF7F0]/80 mt-0.5 max-w-3xl">
                {dbError}
              </p>
              <p className="text-[10px] text-[#9CA3AF] mt-1">
                PostgreSQL Row-Level Security requires an authenticated staff session matching tenant <code className="text-[#E6C78B]">{tenantId}</code> to access protected settlement records.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              loadAdminMetrics();
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

      {/* 4 3D KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Company Clients"
          value={`${companyUsers.length}`}
          subValue={`${companyUsers.filter((u) => u.authSource === 'supabase').length} Live DB Profiles`}
          change="+8.4%"
          trend="up"
          tag="Tenant Clients"
          icon={<Users size={20} />}
          sparkline={[Math.max(1, companyUsers.length - 3), Math.max(1, companyUsers.length - 2), Math.max(1, companyUsers.length - 1), companyUsers.length]}
        />
        <ThreeDKpiCard
          title="Daily Settlements"
          value={`$${dbSettlementVolumeUsd >= 1000000 ? (dbSettlementVolumeUsd / 1000000).toFixed(2) + 'M' : dbSettlementVolumeUsd.toLocaleString()}`}
          subValue={
            dbSettlementCount > 0
              ? `${tenant?.currency && tenant.currency !== 'USD' ? `${tenant.currencySymbol || ''}${dbSettlementVolumeOriginal.toLocaleString()} ${tenant.currency} • ` : ''}${dbSettlementCount.toLocaleString()} Orders`
              : (dbError ? 'RLS Scoped / Auth Required' : '0 Orders Cleared')
          }
          change={dbSettlementCount > 0 ? '+100%' : '0.0%'}
          trend="up"
          tag="USD Base"
          variant="gold-accent"
          icon={<TrendingUp size={20} />}
          sparkline={dbSettlementCount > 0 ? [10, 30, 60, 85, 95, 110, 142] : [0, 0, 0, 0, 0, 0, 0]}
        />
        <ThreeDKpiCard
          title="KYC Clearance"
          value={dbKycCount > 0 ? `${dbKycCount} Verified` : '0 Records'}
          subValue={dbKycCount === 0 ? 'Compliance Queue Empty' : `${dbKycCount} in Database`}
          change={dbKycCount > 0 ? 'Verified' : 'Clean Queue'}
          trend="up"
          tag="AML Policy"
          icon={<FileCheck size={20} />}
          sparkline={dbKycCount > 0 ? [50, 70, 85, 95, 100] : [0, 0, 0, 0, 0]}
        />
        <ThreeDKpiCard
          title="Open Desk Cases"
          value={`${dbOpenCasesCount} Active`}
          subValue="Real-time Surveillance"
          change="Under SLA"
          trend="up"
          tag="Operations"
          icon={<ShieldCheck size={20} />}
          sparkline={[dbOpenCasesCount, dbOpenCasesCount, dbOpenCasesCount]}
        />
      </div>

      {/* 3D Visualizations: Customer Growth & Intraday Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDAreaChart
          title="3D Client Expansion Trajectory"
          subtitle={`Accredited Portfolios for ${companyName}`}
          data={customerGrowthData}
          valuePrefix=""
          valueSuffix=" clients"
          height={260}
        />
        <ThreeDAreaChart
          title="3D Hourly Clearing Velocity"
          subtitle={`Settlement Desks - Volume Trends (${tenant?.currency || 'USD'})`}
          data={txnTrendData}
          valuePrefix=""
          valueSuffix=" tx"
          height={260}
        />
      </div>

      {/* 3D KYC Analytics & Case Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDDonutChart
          title="3D KYC Pipeline & Wealth Tiers"
          subtitle={`Accredited Client Distribution for ${companyName}`}
          segments={kycDonutData}
          centerLabel="Verified Users"
          centerValue="144,700"
          height={320}
        />
        <ThreeDColumnChart
          title="3D Case Operations Velocity"
          subtitle="Completed vs Scheduled (Daily Breakdown)"
          data={caseAnalyticsData}
          height={280}
          valuePrefix=""
          valueSuffix=" cases"
          dualSeries={true}
          primaryLabel="Completed"
          secondaryLabel="Target"
        />
      </div>

      {/* Team Performance & Delegated Staff Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Performance Ring */}
        <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
          <ThreeDProgressRing
            title="3D Operations Performance"
            subtitle={`${companyName} SLA Targets`}
            size={220}
            items={[
              { label: 'KYC SLA', value: 98.4, displayValue: '98.4%', subtext: 'Target: < 4 hours' },
              { label: 'Wire Clearance', value: 99.1, displayValue: '99.1%', subtext: 'First-pass approval' },
              { label: 'Compliance Audit', value: 100, displayValue: '100%', subtext: 'Regulatory attestation' },
            ]}
          />
        </div>

        {/* Staff & Customer Management Table */}
        <div className="lg:col-span-2 rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#3A3A3A] gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D4A017] shadow-[0_0_8px_#D4A017]" />
                  Company Staff & Customer Directory
                </h3>
                {companyUsers.some((u) => u.authSource === 'supabase') ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Supabase DB ({companyUsers.filter((u) => u.authSource === 'supabase').length})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                    Workspace Accounts ({companyUsers.length})
                  </span>
                )}
              </div>
              <p className="font-mono text-xs text-[#9CA3AF] mt-0.5">
                Restricted to {companyName}. Super Admin records are strictly isolated.
              </p>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              {onRefreshUsers && (
                <button
                  onClick={onRefreshUsers}
                  title="Refresh user directory from database"
                  className="p-1.5 rounded-lg bg-[#121212] border border-[#3A3A3A] hover:border-[#D4A017] text-[#D4A017] transition-all hover:rotate-180 duration-300"
                >
                  <RotateCw size={12} />
                </button>
              )}
              {['ALL', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER'].map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRole(r)}
                  className={`px-2 py-1 rounded-lg transition-colors ${
                    filterRole === r
                      ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold'
                      : 'bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]'
                  }`}
                >
                  {r === 'ALL' ? 'All' : r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                  <th className="pb-2">Name & ID</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">KYC Tier</th>
                  <th className="pb-2 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                {filteredCompanyUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#9CA3AF]">
                      <Users size={22} className="mx-auto mb-2 text-[#D4A017] opacity-60" />
                      <p className="font-semibold text-[#FAF7F0]">No Accounts Found</p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                        No staff or customer accounts match the current filter in {companyName}.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredCompanyUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#121212]/50 transition-colors">
                      <td className="py-2.5">
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
                        <p className="text-[10px] text-[#9CA3AF]">{u.id} • {u.email}</p>
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 text-[11px]">{u.status}</td>
                      <td className="py-2.5 text-[11px] text-[#D4A017]">{u.tier}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => {
                            setChangeRoleUser(u);
                            setChangeRoleOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#D4A017] hover:text-[#E6C78B] hover:bg-[#262626] text-[11px] flex items-center gap-1 font-semibold ml-auto"
                        >
                          <ShieldCheck size={12} />
                          Change Role
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <UserManagementModal
        currentRole={currentRole}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
        editingUser={editingUser}
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
