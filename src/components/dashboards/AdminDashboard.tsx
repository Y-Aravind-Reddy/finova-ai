import React, { useState } from 'react';
import {
  ADMIN_DATASET,
  CUSTOMER_DATASET,
  UserAccount,
  UserRole,
} from '../../data/finovaDatasets';
import { getStoredTenants, getTenantById } from '../../data/tenantStore';
import { saveProfileToDb } from '../../services/finovaDatabase';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDProgressRing } from '../charts3d/ThreeDProgressRing';
import { UserManagementModal } from '../UserManagementModal';
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

  // KYC breakdown
  const kycDonutData = [
    { label: 'Tier 3 Verified', value: 94200, subtext: 'Private Wealth accredited' },
    { label: 'Tier 2 Verified', value: 38400, subtext: 'Platinum verified' },
    { label: 'Tier 1 Verified', value: 12100, subtext: 'Gold retail tier' },
    { label: 'Under Review', value: 3200, subtext: 'Manual compliance queue' },
    { label: 'Pending Docs', value: 1020, subtext: 'Awaiting passport/tax' },
  ];

  // Daily operations volume trend
  const txnTrendData = [
    { label: '08:00', value: 12400 },
    { label: '10:00', value: 38900 },
    { label: '12:00', value: 52100 },
    { label: '14:00', value: 48600 },
    { label: '16:00', value: 61200 },
    { label: '18:00', value: 34500 },
    { label: '20:00', value: 21000 },
  ];

  // 3D Customer Growth Curve
  const customerGrowthData = [
    { label: 'Jan', value: 118000 },
    { label: 'Mar', value: 126400 },
    { label: 'May', value: 132900 },
    { label: 'Jul', value: 139100 },
    { label: 'Sep', value: 143800 },
    { label: 'Oct', value: 147250 },
  ];

  // 3D Case Analytics Column Chart
  const caseAnalyticsData = [
    { label: 'Tier 3 Audits', value: 480, secondaryValue: 460 },
    { label: 'Escrow Clearance', value: 390, secondaryValue: 380 },
    { label: 'High-Value Wires', value: 280, secondaryValue: 275 },
    { label: 'AML Exceptions', value: 95, secondaryValue: 88, highlight: true },
  ];

  const handleSaveUser = (userData: Partial<UserAccount>) => {
    if (userData.role === 'SUPER_ADMIN') {
      alert('Governance Violation: Company Admins cannot create Super Admins.');
      return;
    }

    if (editingUser) {
      if (editingUser.role === 'SUPER_ADMIN') {
        alert('Governance Violation: Cannot edit Super Admin accounts.');
        return;
      }
      saveProfileToDb({ ...editingUser, ...userData, tenantId });
      const updated = users.map((u) =>
        u.id === editingUser.id ? ({ ...u, ...userData, tenantId, authSource: editingUser.authSource } as UserAccount) : u
      );
      onUpdateUsers(updated);
    } else {
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
      saveProfileToDb(newUser);
      onUpdateUsers([newUser, ...users]);
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

      {/* 4 3D KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Company Clients"
          value={tenant ? `${(tenant.usersCount).toLocaleString()}` : `${companyUsers.length}`}
          subValue="Private Wealth & Commercial"
          change="+8.4%"
          trend="up"
          tag="Tenant Clients"
          icon={<Users size={20} />}
          sparkline={[40, 52, 68, 80, 95, 120, 147]}
        />
        <ThreeDKpiCard
          title="Daily Settlements"
          value={`${tenant?.currencySymbol || '$'}142.8M`}
          subValue="18,400 Orders Cleared"
          change="+19.2%"
          trend="up"
          tag="Clearing Desk"
          variant="gold-accent"
          icon={<TrendingUp size={20} />}
          sparkline={[30, 45, 60, 85, 95, 110, 142]}
        />
        <ThreeDKpiCard
          title="KYC Clearance"
          value="98.2%"
          subValue="Compliance Verified"
          change="+1.8%"
          trend="up"
          tag="AML Policy"
          icon={<FileCheck size={20} />}
          sparkline={[90, 91, 92, 94, 95, 96, 97]}
        />
        <ThreeDKpiCard
          title="Open Desk Cases"
          value="18 Active"
          subValue="Zero Systemic Defaults"
          change="Under SLA"
          trend="up"
          tag="Operations"
          icon={<ShieldCheck size={20} />}
          sparkline={[12, 18, 14, 20, 15, 11, 8]}
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
                            setEditingUser(u);
                            setModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#D4A017] hover:text-[#E6C78B] hover:bg-[#262626] text-[11px]"
                        >
                          Edit Permissions
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
    </div>
  );
};
