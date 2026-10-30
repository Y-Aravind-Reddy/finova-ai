import React, { useState } from 'react';
import { Users, Search, Filter, ShieldCheck, DollarSign, Building2, RotateCw } from 'lucide-react';
import { UserAccount } from '../../data/finovaDatasets';

interface AdminCustomerManagementPageProps {
  users: UserAccount[];
  onRefreshUsers?: () => void;
  currentUser?: UserAccount;
}

export const AdminCustomerManagementPage: React.FC<AdminCustomerManagementPageProps> = ({
  users,
  onRefreshUsers,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

  React.useEffect(() => {
    if (onRefreshUsers) {
      onRefreshUsers();
    }
  }, [onRefreshUsers]);

  const tenantId = currentUser?.tenantId || 'tenant_apex_bank';
  const companyName = currentUser?.tenantName || 'Apex Global Bank';

  // Strictly filter to customers of this tenant workspace
  const customerAccounts = users.filter((u) => {
    if (u.role !== 'CUSTOMER') return false;
    return u.tenantId ? u.tenantId === tenantId : true;
  });

  const filtered = customerAccounts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'ALL' || (c.tier && c.tier.includes(tierFilter));
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName} Operations
            </span>
            <span className="text-xs text-[#E6C78B]">Accredited Client Directory</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            Customer Management
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Manage Tier 3 Sovereign, Tier 2 Platinum, and Tier 1 Gold private wealth client portfolios and KYC compliance standings for {companyName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshUsers && (
            <button
              onClick={onRefreshUsers}
              title="Refresh customer client directory"
              className="p-2 rounded-xl bg-[#121212] border border-[#3A3A3A] hover:border-[#D4A017] text-[#D4A017] transition-all hover:rotate-180 duration-300"
            >
              <RotateCw size={14} />
            </button>
          )}
          <div className="p-3 bg-[#121212] rounded-xl border border-[#3A3A3A] text-right">
            <span className="text-[10px] text-[#9CA3AF] block">Workspace Active Clients</span>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-sm font-bold text-[#E6C78B]">{customerAccounts.length} Verified</span>
              {customerAccounts.some((c) => c.authSource === 'supabase') && (
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
              placeholder="Search client by name or account ID..."
              className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#9CA3AF]">Wealth Tier:</span>
            {['ALL', 'Tier 3', 'Tier 2', 'Tier 1'].map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  tierFilter === t
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A]'
                    : 'bg-[#121212] text-[#9CA3AF] border border-[#3A3A3A]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#3A3A3A] text-[10px] uppercase text-[#E6C78B]">
                <th className="pb-3">Client Identifier</th>
                <th className="pb-3">Client Name & Email</th>
                <th className="pb-3">Accreditation Tier</th>
                <th className="pb-3">Jurisdiction</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#9CA3AF]">
                    <Users size={22} className="mx-auto mb-2 text-[#D4A017] opacity-60" />
                    <p className="font-semibold text-[#FAF7F0]">No Customers Found</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      No customer accounts match the current filter in {companyName}.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#121212]/50 transition-colors">
                    <td className="py-3 font-bold text-[#E6C78B]">
                      <div className="flex items-center gap-1">
                        <span>{c.id}</span>
                        {c.authSource === 'supabase' && (
                          <span className="px-1 py-0.2 rounded text-[7px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                            Live
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-[#FAF7F0]">{c.name}</p>
                        {c.authSource === 'supabase' ? (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                            Live DB
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Demo
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#9CA3AF]">{c.email}</p>
                    </td>
                    <td className="py-3 text-[#D4A017]">{c.tier || 'Private Wealth Tier 3'}</td>
                    <td className="py-3 text-[#FAF7F0]/80">{c.country || 'Switzerland'}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 text-[11px] text-[#9CA3AF]">
                      <span className="text-zinc-500 italic text-[11px]" title="Database schema does not store last_active timestamps">
                        Not Tracked
                      </span>
                    </td>
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
