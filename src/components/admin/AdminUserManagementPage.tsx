import React, { useState } from 'react';
import { Users, Search, Building2, Shield, CheckCircle2, RotateCw } from 'lucide-react';
import { UserAccount } from '../../data/finovaDatasets';

interface AdminUserManagementPageProps {
  users: UserAccount[];
  onUpdateUsers: (users: UserAccount[]) => void;
  onRefreshUsers?: () => void;
  currentUser?: UserAccount;
}

export const AdminUserManagementPage: React.FC<AdminUserManagementPageProps> = ({
  users,
  onUpdateUsers,
  onRefreshUsers,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  React.useEffect(() => {
    if (onRefreshUsers) {
      onRefreshUsers();
    }
  }, [onRefreshUsers]);

  const tenantId = currentUser?.tenantId || 'tenant_apex_bank';
  const companyName = currentUser?.tenantName || 'Apex Global Bank';

  // Admin cannot see Super Admin, and can only see users of their own tenant workspace
  const scopedCompanyUsers = users.filter((u) => {
    if (u.role === 'SUPER_ADMIN') return false;
    return u.tenantId ? u.tenantId === tenantId : true;
  });

  const filtered = scopedCompanyUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName} Directory
            </span>
            <span className="text-xs text-[#E6C78B]">Staff & Account Access</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            Staff & User Management
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Manage operational access credentials for Finance Analysts, Support Executives, and Private Wealth Customers within {companyName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshUsers && (
            <button
              onClick={onRefreshUsers}
              title="Refresh staff and user directory"
              className="p-2 rounded-xl bg-[#121212] border border-[#3A3A3A] hover:border-[#D4A017] text-[#D4A017] transition-all hover:rotate-180 duration-300"
            >
              <RotateCw size={14} />
            </button>
          )}
          <div className="p-3 bg-[#121212] rounded-xl border border-[#3A3A3A] text-right">
            <span className="text-[10px] text-[#9CA3AF] block">Workspace Active Staff</span>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-sm font-bold text-[#E6C78B]">{scopedCompanyUsers.length} Records</span>
              {scopedCompanyUsers.some((u) => u.authSource === 'supabase') && (
                <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                  Live DB
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#3A3A3A]">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-3 text-[#D4A017]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff by name or email..."
              className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {['ALL', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  roleFilter === r
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A]'
                    : 'bg-[#121212] text-[#9CA3AF] border border-[#3A3A3A]'
                }`}
              >
                {r.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#3A3A3A] text-[10px] uppercase text-[#E6C78B]">
                <th className="pb-3">User ID</th>
                <th className="pb-3">Name & Email</th>
                <th className="pb-3">Operational Role</th>
                <th className="pb-3">Security 2FA</th>
                <th className="pb-3">Account Status</th>
                <th className="pb-3">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#9CA3AF]">
                    <Users size={22} className="mx-auto mb-2 text-[#D4A017] opacity-60" />
                    <p className="font-semibold text-[#FAF7F0]">No Accounts Found</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      No staff or customer accounts match the current filter in {companyName}.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-[#121212]/50 transition-colors">
                    <td className="py-3 font-bold text-[#E6C78B]">
                      <div className="flex items-center gap-1">
                        <span>{u.id}</span>
                        {u.authSource === 'supabase' && (
                          <span className="px-1 py-0.2 rounded text-[7px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                            Live
                          </span>
                        )}
                      </div>
                    </td>
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
                      <p className="text-[10px] text-[#9CA3AF]">{u.email}</p>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#121212] text-[#D4A017] border border-[#3A3A3A]">
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-[11px] text-[#D4A017]">
                      {u.twoFactorEnabled ? '✓ Hardware Key' : 'SMS'}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]">
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 text-[11px] text-[#9CA3AF]">{u.lastActive}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
