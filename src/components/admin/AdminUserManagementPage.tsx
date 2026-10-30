import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Building2, Shield, RotateCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { UserAccount } from '../../data/finovaDatasets';
import { fetchProfilesResultFromDb, QueryResultState } from '../../services/finovaDatabase';
import { isSupabaseConfigured } from '../../lib/supabase';

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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [liveDbProfiles, setLiveDbProfiles] = useState<UserAccount[]>([]);
  const [queryState, setQueryState] = useState<QueryResultState>('live_records');

  const tenantId = currentUser?.tenantId || 'tenant_apex_bank';
  const companyName = currentUser?.tenantName || 'Apex Global Bank';

  // Fetch authorized profiles for the selected workspace from live Supabase
  const loadWorkspaceProfiles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setQueryError(null);

    try {
      if (isSupabaseConfigured()) {
        const res = await fetchProfilesResultFromDb(tenantId);
        setQueryState(res.state);

        if (res.state === 'query_error' && res.error) {
          setQueryError(res.error);
        } else if (res.state === 'live_records' && res.data) {
          setLiveDbProfiles(res.data);
          setQueryError(null);
          if (onUpdateUsers && res.data.length > 0) {
            onUpdateUsers(res.data);
          }
        } else if (res.state === 'zero_records') {
          setLiveDbProfiles([]);
          setQueryError(null);
        } else if (res.state === 'demo_session_rls') {
          setLiveDbProfiles([]);
          setQueryError(null);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query workspace profiles from Supabase database';
      setQueryError(msg);
      setQueryState('query_error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId, onUpdateUsers]);

  useEffect(() => {
    loadWorkspaceProfiles(false);
  }, [loadWorkspaceProfiles, tenantId, currentUser]);

  const handleRefresh = async () => {
    await loadWorkspaceProfiles(true);
    if (onRefreshUsers) {
      onRefreshUsers();
    }
  };

  // Determine active profile pool:
  // 1. If live DB returned records, use them.
  // 2. If running under demo/evaluation session where Supabase RLS restricts anon queries, fall back to props.users.
  const activeProfiles =
    liveDbProfiles.length > 0
      ? liveDbProfiles
      : queryState === 'demo_session_rls' || !isSupabaseConfigured()
      ? users
      : liveDbProfiles;

  // Strict tenant isolation: Admin can only see users of their own tenant workspace, and never Super Admin
  const scopedCompanyUsers = activeProfiles.filter((u) => {
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
      {/* Header Banner */}
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
            Manage operational access credentials for Company Admins, Finance Analysts, Support Executives, and Private Wealth Customers within {companyName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Refresh staff and user directory from Supabase"
            className={`p-2 rounded-xl bg-[#121212] border border-[#3A3A3A] hover:border-[#D4A017] text-[#D4A017] transition-all duration-300 ${
              refreshing ? 'animate-spin border-[#D4A017]' : 'hover:rotate-180'
            }`}
          >
            <RotateCw size={14} />
          </button>

          <div className="p-3 bg-[#121212] rounded-xl border border-[#3A3A3A] text-right min-w-[130px]">
            <span className="text-[10px] text-[#9CA3AF] block">
              {filtered.length !== scopedCompanyUsers.length
                ? `Filtered (${filtered.length} of ${scopedCompanyUsers.length})`
                : 'Workspace Staff'}
            </span>
            <div className="flex items-center gap-1.5 justify-end mt-0.5">
              <span className="text-sm font-bold text-[#E6C78B]">
                {filtered.length} {filtered.length === 1 ? 'Record' : 'Records'}
              </span>
              {liveDbProfiles.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                  Live DB
                </span>
              ) : queryState === 'demo_session_rls' ? (
                <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300">
                  Sandbox
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Visible Error Banner if Query Failed (Requirement 8) */}
      {queryError && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 text-xs flex items-start gap-3 shadow-lg">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-red-300">Supabase Profiles Query Error</div>
            <div className="text-[11px] text-red-200/90 mt-0.5">{queryError}</div>
            <div className="mt-2 text-[10px] text-red-300/80">
              Workspace: <span className="font-semibold text-white">{tenantId}</span> ({companyName}). Check Supabase connection and Row Level Security permissions.
            </div>
          </div>
        </div>
      )}

      {/* RLS Sandbox / Auth Notice */}
      {!queryError && (queryState === 'demo_session_rls' || !currentUser) && liveDbProfiles.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs flex items-start gap-3 shadow-lg">
          <Shield size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-amber-300">
              {currentUser ? 'Supabase Row Level Security Active' : 'Authentication Required'}
            </div>
            <div className="text-[11px] text-amber-200/90 mt-0.5">
              {currentUser 
                ? 'Your session is active but restricted by Row Level Security from reading workspace profiles.' 
                : 'You are not authenticated with Supabase. Please sign in to access workspace profiles.'}
            </div>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-lg space-y-4">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#3A3A3A]">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-3 text-[#D4A017]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff by name, email, or ID..."
              className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['ALL', 'ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  roleFilter === r
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A]'
                    : 'bg-[#121212] text-[#9CA3AF] border border-[#3A3A3A] hover:border-[#D4A017]/50'
                }`}
              >
                {r.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Profiles Table */}
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#9CA3AF]">
                    <RotateCw size={22} className="mx-auto mb-2 text-[#D4A017] animate-spin" />
                    <p className="font-semibold text-[#FAF7F0]">Querying Workspace Profiles...</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      Querying Supabase database for {companyName}
                    </p>
                  </td>
                </tr>
              ) : !queryError && filtered.length === 0 ? (
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
                    {/* User ID */}
                    <td className="py-3 font-bold text-[#E6C78B]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[140px]" title={u.id}>
                          {u.id}
                        </span>
                        {u.authSource === 'supabase' ? (
                          <span className="px-1 py-0.2 rounded text-[7px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                            Live
                          </span>
                        ) : (
                          <span className="px-1 py-0.2 rounded text-[7px] font-bold bg-zinc-800 border border-zinc-700 text-zinc-400">
                            Local
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Name & Email */}
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-[#FAF7F0]">{u.name}</p>
                      </div>
                      <p className="text-[10px] text-[#9CA3AF]">{u.email}</p>
                    </td>

                    {/* Operational Role */}
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#121212] text-[#D4A017] border border-[#3A3A3A]">
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Security 2FA (Honest Database Mapping) */}
                    <td className="py-3 text-[11px]">
                      {u.twoFactorEnabled ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <ShieldCheck size={12} className="text-emerald-400" /> Enabled
                        </span>
                      ) : (
                        <span className="text-zinc-500 font-normal">Disabled</span>
                      )}
                    </td>

                    {/* Account Status */}
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]">
                        {u.status || 'Active'}
                      </span>
                    </td>

                    {/* Last Active (Honest Schema Unavailable State) */}
                    <td className="py-3 text-[11px]">
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
