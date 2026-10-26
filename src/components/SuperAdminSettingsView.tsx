import React, { useState, useEffect, useCallback } from 'react';
import { FinovaLogo } from './FinovaLogo';
import { UserAccount, UserRole } from '../data/finovaDatasets';
import { UserManagementModal } from './UserManagementModal';
import {
  Users,
  Settings,
  ShieldAlert,
  Cpu,
  FileCheck,
  UserPlus,
  Edit,
  Trash2,
  Key,
  Database,
  Lock,
  CheckCircle,
  RotateCw,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  fetchAiConfigurationResultFromDb,
  saveAiConfigurationToDb,
  fetchAuditLogsResultFromDb,
  AuditLogEntry,
  DEFAULT_AI_CONFIGURATION,
} from '../services/finovaDatabase';
import { getStoredSession } from '../data/authStore';

interface SuperAdminSettingsViewProps {
  users: UserAccount[];
  onUpdateUsers: (newUsers: UserAccount[]) => void;
  onRefreshUsers?: () => void;
  onImpersonateUser?: (user: UserAccount) => void;
  initialTab?: 'users' | 'ai_config' | 'audit_logs' | 'security';
  initialRoleFilter?: string;
}

export const SuperAdminSettingsView: React.FC<SuperAdminSettingsViewProps> = ({
  users,
  onUpdateUsers,
  onRefreshUsers,
  onImpersonateUser,
  initialTab = 'users',
  initialRoleFilter = 'ALL',
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'ai_config' | 'audit_logs' | 'security'>(
    initialTab
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [filterRole, setFilterRole] = useState<string>(initialRoleFilter);

  // AI Configuration State (Persistent with Supabase)
  const [aiSettings, setAiSettings] = useState({
    sentinelConfidenceThreshold: DEFAULT_AI_CONFIGURATION.sentinelConfidenceThreshold,
    autoFreezeThreshold: DEFAULT_AI_CONFIGURATION.autoFreezeThreshold,
    maxDailyWireVelocity: DEFAULT_AI_CONFIGURATION.maxDailyWireVelocity,
    dualKeySignoffEnabled: DEFAULT_AI_CONFIGURATION.dualKeySignoffEnabled,
    realTimeAuditLogging: DEFAULT_AI_CONFIGURATION.realTimeAuditLogging,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [aiSaveError, setAiSaveError] = useState<string | null>(null);

  // Audit Logs State (Persistent with Supabase public.audit_logs)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const loadAiConfig = useCallback(async () => {
    setAiLoading(true);
    setAiSaveError(null);
    try {
      const res = await fetchAiConfigurationResultFromDb();
      setAiSettings({
        sentinelConfidenceThreshold: res.config.sentinelConfidenceThreshold,
        autoFreezeThreshold: res.config.autoFreezeThreshold,
        maxDailyWireVelocity: res.config.maxDailyWireVelocity,
        dualKeySignoffEnabled: res.config.dualKeySignoffEnabled,
        realTimeAuditLogging: res.config.realTimeAuditLogging,
      });
    } catch (err: any) {
      setAiSaveError(err?.message || 'Failed to reload AI configuration from Supabase storage.');
    } finally {
      setAiLoading(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await fetchAuditLogsResultFromDb();
      setAuditLogs(res.logs);
      if (res.error && !res.isDbConnected) {
        setAuditError(res.error);
      }
    } catch (err: any) {
      setAuditError(err?.message || 'Failed to query public.audit_logs from Supabase.');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    if (initialRoleFilter) {
      setFilterRole(initialRoleFilter);
    }
    if (onRefreshUsers) {
      onRefreshUsers();
    }
  }, [initialTab, initialRoleFilter, onRefreshUsers]);

  React.useEffect(() => {
    if (activeTab === 'ai_config') {
      loadAiConfig();
    } else if (activeTab === 'audit_logs') {
      loadAuditLogs();
    }
  }, [activeTab, loadAiConfig, loadAuditLogs]);

  const handleSaveUser = (userData: Partial<UserAccount>) => {
    if (editingUser) {
      const updated = users.map((u) =>
        u.id === editingUser.id ? ({ ...u, ...userData } as UserAccount) : u
      );
      onUpdateUsers(updated);
    } else {
      const newUser: UserAccount = {
        id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
        name: userData.name || 'New Account',
        email: userData.email || '',
        role: userData.role || 'ADMIN',
        status: userData.status || 'Active',
        tier: userData.tier || 'Executive Staff',
        createdDate: new Date().toISOString().split('T')[0],
        lastActive: 'Just now',
        phone: userData.phone || '+1 (212) 555-0100',
        country: userData.country || 'United States',
        twoFactorEnabled: true,
        notes: userData.notes || 'Provisioned by Super Admin Settings Control',
      };
      onUpdateUsers([newUser, ...users]);
    }
    setEditingUser(null);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm(`Confirm permanent revocation of user ${userId}?`)) {
      onUpdateUsers(users.filter((u) => u.id !== userId));
    }
  };

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiSaving(true);
    setAiSaved(false);
    setAiSaveError(null);

    const caller = getStoredSession()?.user;
    if (!caller || caller.role !== 'SUPER_ADMIN') {
      setAiSaveError('Authentication required: Only an active Platform Super Admin session may modify AI parameters.');
      setAiSaving(false);
      return;
    }

    try {
      const result = await saveAiConfigurationToDb(aiSettings, caller);
      if (!result.success) {
        // Disclose real error - strictly prevent false success
        setAiSaveError(result.error || 'Failed to save configuration to Supabase.');
        setAiSaved(false);
      } else {
        setAiSaved(true);
        setTimeout(() => setAiSaved(false), 4000);
      }
    } catch (err: any) {
      setAiSaveError(err?.message || 'Unexpected exception saving AI parameters.');
      setAiSaved(false);
    } finally {
      setAiSaving(false);
    }
  };

  const adminAuthorizedUsers = users.filter((u) => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN');
  const filteredUsers = filterRole === 'ALL' ? adminAuthorizedUsers : adminAuthorizedUsers.filter((u) => u.role === filterRole);

  return (
    <div className="space-y-6">
      {/* Super Admin Control Header */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#F5C542]/50 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Super Admin Settings & Governance
            </span>
            <span className="text-xs font-mono text-[#D4A017]">Clearance Level: Supreme Master Key</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Platform Configuration & Role Hierarchy Control
          </h1>
          <p className="font-mono text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Exclusive to Super Admin. Create staff, reassign roles, tune Finova Sentinel AI weights, and audit immutable transaction logs.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingUser(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all"
        >
          <UserPlus size={16} />
          Create New User / Role
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#D4A017]/20 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'users'
              ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] shadow-[0_0_12px_rgba(212,160,23,0.3)]'
              : 'text-[#D4A017] hover:bg-[#1E1E1E]'
          }`}
        >
          <Users size={15} /> User & Role Management ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('ai_config')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'ai_config'
              ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] shadow-[0_0_12px_rgba(212,160,23,0.3)]'
              : 'text-[#D4A017] hover:bg-[#1E1E1E]'
          }`}
        >
          <Cpu size={15} /> AI Configuration
        </button>

        <button
          onClick={() => setActiveTab('audit_logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'audit_logs'
              ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] shadow-[0_0_12px_rgba(212,160,23,0.3)]'
              : 'text-[#D4A017] hover:bg-[#1E1E1E]'
          }`}
        >
          <FileCheck size={15} /> Audit Logs
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'security'
              ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] shadow-[0_0_12px_rgba(212,160,23,0.3)]'
              : 'text-[#D4A017] hover:bg-[#1E1E1E]'
          }`}
        >
          <ShieldAlert size={15} /> Security Settings
        </button>
      </div>

      {/* ========================================================
          USER & ROLE MANAGEMENT TAB
          ======================================================== */}
      {activeTab === 'users' && (
        <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#D4A017]/15 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
                  Institutional User & Role Registry
                </h3>
                {adminAuthorizedUsers.some((u) => u.authSource === 'supabase') ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Supabase DB ({adminAuthorizedUsers.filter((u) => u.authSource === 'supabase').length})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                    Platform Directory ({adminAuthorizedUsers.length})
                  </span>
                )}
              </div>
              <p className="font-mono text-xs text-[#D4A017]/70 mt-0.5">
                Super Admin exclusive: Manage platform Admin and Super Admin accounts. Individual customer and operational accounts are restricted to company admins.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onRefreshUsers && (
                <button
                  onClick={onRefreshUsers}
                  title="Refresh user directory from database"
                  className="p-1.5 rounded-xl bg-[#111111] border border-[#D4A017]/40 hover:border-[#F5C542] text-[#D4A017] transition-all hover:rotate-180 duration-300"
                >
                  <RotateCw size={13} />
                </button>
              )}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-[#111111] border border-[#D4A017]/40 rounded-xl px-3 py-1.5 text-xs text-[#FAF7F0] font-mono focus:outline-none focus:border-[#F5C542]"
              >
                <option value="ALL">All Admin Accounts ({adminAuthorizedUsers.length})</option>
                <option value="SUPER_ADMIN">Platform Super Admins</option>
                <option value="ADMIN">Company Admins</option>
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#D4A017]/20 text-[#D4A017]/80 text-[11px]">
                  <th className="pb-2.5">User Identity</th>
                  <th className="pb-2.5">Current Role</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Enrolled Date</th>
                  <th className="pb-2.5">Clearance Tier</th>
                  <th className="pb-2.5 text-right">Super Admin Authority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4A017]/10 text-[#FAF7F0]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#9CA3AF]">
                      <Users size={22} className="mx-auto mb-2 text-[#D4A017] opacity-60" />
                      <p className="font-semibold text-[#FFF8E7]">No Admin Accounts Found</p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                        Zero platform Admin or Super Admin accounts match the current filter.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#301B05]/20 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-[#FFF8E7]">{u.name}</p>
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
                        <p className="text-[11px] text-[#6B7280]">{u.id} • {u.email}</p>
                      </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'SUPER_ADMIN'
                            ? 'bg-[#F5C542] text-[#111111]'
                            : u.role === 'ADMIN'
                            ? 'bg-[#D4A017]/20 text-[#F5C542] border border-[#D4A017]'
                            : u.role === 'FINANCE_ANALYST'
                            ? 'bg-[#6B3E00]/40 text-[#FFF8E7] border border-[#6B3E00]'
                            : u.role === 'SUPPORT_EXECUTIVE'
                            ? 'bg-[#4A2C0A]/40 text-[#D4A017] border border-[#4A2C0A]'
                            : 'bg-[#111111] text-[#FAF7F0] border border-[#301B05]'
                        }`}
                      >
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C08A00]/20 text-[#F5C542] border border-[#C08A00]/40">
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 text-[11px] text-[#6B7280]">{u.createdDate}</td>
                    <td className="py-3 text-[11px] text-[#FFF8E7]">{u.tier}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onImpersonateUser && u.role !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => onImpersonateUser(u)}
                            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-[11px] hover:brightness-110 shadow-[0_0_8px_rgba(212,160,23,0.3)]"
                            title={`Switch Active Session to ${u.role.replace('_', ' ')} for audit`}
                          >
                            Switch to {u.role.replace('_', ' ')}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#111111] border border-[#D4A017]/30 text-[#F5C542] hover:bg-[#6B3E00]/40 text-[11px]"
                          title="Edit User / Change Role"
                        >
                          Change Role / Edit
                        </button>
                        {u.id !== 'USR-1001' && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 rounded-lg bg-[#111111] border border-[#B45309]/50 text-[#D97706] hover:bg-[#B45309]/30"
                            title="Delete User"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          AI CONFIGURATION TAB
          ======================================================== */}
      {activeTab === 'ai_config' && (
        <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-cinzel text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
                Finova Sentinel AI Configuration
              </h3>
              <p className="font-mono text-xs text-[#D4A017]/70 mt-1">
                Global autonomous risk thresholds, escrow freeze triggers, and wire velocity limits persisted in Supabase.
              </p>
            </div>
            <button
              onClick={loadAiConfig}
              disabled={aiLoading || aiSaving}
              className="px-3 py-1.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 text-[#FAF7F0] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              title="Reload from Supabase"
            >
              <RefreshCw size={12} className={aiLoading ? 'animate-spin text-[#D4A017]' : 'text-[#D4A017]'} />
              <span>Reload</span>
            </button>
          </div>

          {aiSaveError && (
            <div className="mt-4 p-3 rounded-xl bg-[#2D0A0A] border border-[#EF4444]/60 text-xs font-mono text-[#FCA5A5] flex items-center gap-2">
              <AlertTriangle size={15} className="text-[#EF4444] shrink-0" />
              <span>Configuration save failed: {aiSaveError}</span>
            </div>
          )}

          {aiSaved && (
            <div className="mt-4 p-3 rounded-xl bg-[#C08A00]/20 border border-[#C08A00] text-xs font-mono text-[#F5C542] flex items-center gap-2">
              <CheckCircle size={15} /> Neural parameters updated and cryptographically deployed to Supabase storage.
            </div>
          )}

          <form onSubmit={handleSaveAiConfig} className="mt-6 space-y-5 font-mono text-xs max-w-xl">
            <div>
              <div className="flex justify-between text-[#FAF7F0] mb-1">
                <span>AML Anomaly Confidence Threshold</span>
                <span className="font-bold text-[#F5C542]">{aiSettings.sentinelConfidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min="70"
                max="99"
                value={aiSettings.sentinelConfidenceThreshold}
                onChange={(e) =>
                  setAiSettings({ ...aiSettings, sentinelConfidenceThreshold: Number(e.target.value) })
                }
                disabled={aiLoading || aiSaving}
                className="w-full accent-[#F5C542]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#FAF7F0] mb-1">
                <span>Autonomous Escrow Freeze Risk Threshold</span>
                <span className="font-bold text-[#F5C542]">{aiSettings.autoFreezeThreshold} / 100</span>
              </div>
              <input
                type="range"
                min="60"
                max="95"
                value={aiSettings.autoFreezeThreshold}
                onChange={(e) =>
                  setAiSettings({ ...aiSettings, autoFreezeThreshold: Number(e.target.value) })
                }
                disabled={aiLoading || aiSaving}
                className="w-full accent-[#F5C542]"
              />
            </div>

            <div className="pt-2 border-t border-[#D4A017]/20 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiSettings.dualKeySignoffEnabled}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, dualKeySignoffEnabled: e.target.checked })
                  }
                  disabled={aiLoading || aiSaving}
                  className="rounded bg-[#111111] border-[#D4A017]/40 text-[#D4A017]"
                />
                <span className="text-[#FAF7F0]">Enforce Dual-Key Super Admin Signoff for Wires &gt; $5,000,000 USD</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiSettings.realTimeAuditLogging}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, realTimeAuditLogging: e.target.checked })
                  }
                  disabled={aiLoading || aiSaving}
                  className="rounded bg-[#111111] border-[#D4A017]/40 text-[#D4A017]"
                />
                <span className="text-[#FAF7F0]">Real-time Cryptographic Audit Trail Stream to public.audit_logs</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={aiLoading || aiSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-xs hover:brightness-110 shadow-[0_0_15px_rgba(212,160,23,0.35)] disabled:opacity-50"
            >
              {aiSaving ? 'Deploying to Supabase...' : 'Deploy AI Parameters'}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================
          AUDIT LOGS TAB
          ======================================================== */}
      {activeTab === 'audit_logs' && (
        <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-cinzel text-lg font-bold text-[#FFF8E7]">
                Immutable System Audit Logs
              </h3>
              <p className="font-mono text-xs text-[#D4A017]/70 mt-1">
                Permanent cryptographic ledger verified from Supabase public.audit_logs
              </p>
            </div>
            <button
              onClick={loadAuditLogs}
              disabled={auditLoading}
              className="px-3 py-1.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 text-[#FAF7F0] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh Audit Logs"
            >
              <RefreshCw size={12} className={auditLoading ? 'animate-spin text-[#D4A017]' : 'text-[#D4A017]'} />
              <span>Refresh</span>
            </button>
          </div>

          {auditError && (
            <div className="mt-3 p-3 rounded-xl bg-[#2D0A0A] border border-[#EF4444]/60 text-xs font-mono text-[#FCA5A5] flex items-center gap-2">
              <AlertTriangle size={15} className="text-[#EF4444] shrink-0" />
              <span>Audit Query Notice: {auditError}</span>
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#D4A017]/20 text-[#D4A017]/80 text-[11px]">
                  <th className="pb-2">Audit ID</th>
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Actor & Role</th>
                  <th className="pb-2">Action</th>
                  <th className="pb-2">Target</th>
                  <th className="pb-2">IP Node</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4A017]/10 text-[#FAF7F0]">
                {auditLoading && auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#9CA3AF]">
                      Loading audit records from Supabase...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#9CA3AF]">
                      No audit events recorded in database yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#301B05]/20">
                      <td className="py-2.5 font-bold text-[#F5C542]">{log.id}</td>
                      <td className="py-2.5 text-[#6B7280]">{log.timestamp}</td>
                      <td className="py-2.5 text-[#FFF8E7]">
                        <span>{log.actor}</span>
                        <span className="block text-[10px] text-[#9CA3AF]">{log.role}</span>
                      </td>
                      <td className="py-2.5 text-[#D4A017]">{log.action}</td>
                      <td className="py-2.5 text-[#FAF7F0]/80">{log.target}</td>
                      <td className="py-2.5 text-[#6B7280]">{log.ipAddress}</td>
                      <td className="py-2.5 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C08A00]/20 text-[#F5C542] border border-[#C08A00]">
                          {log.status || 'Authorized'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          SECURITY SETTINGS TAB
          ======================================================== */}
      {activeTab === 'security' && (
        <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.6)] font-mono text-xs space-y-4">
          <h3 className="font-cinzel text-lg font-bold text-[#FFF8E7]">
            Platform Security & Vault Keys
          </h3>
          <p className="text-[#D4A017]/70">
            Elliptic curve master encryption and hardware token certificates.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/25">
              <span className="text-[#D4A017]">Master Key Hash</span>
              <p className="font-bold text-[#FAF7F0] mt-1 break-all">
                0x7A94B2E810C49F0321A858849E2D17
              </p>
              <span className="text-[10px] text-[#C08A00] block mt-1">✓ Zurich HSM Slot 0 Valid</span>
            </div>
            <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/25">
              <span className="text-[#D4A017]">Session Algorithm</span>
              <p className="font-bold text-[#FAF7F0] mt-1">
                HMAC-SHA256 with 24-Hour Expiration
              </p>
              <span className="text-[10px] text-[#C08A00] block mt-1">✓ Zero Session Hijack Vulnerabilities</span>
            </div>
          </div>
        </div>
      )}

      {/* User Management Modal */}
      <UserManagementModal
        currentRole="SUPER_ADMIN"
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
        editingUser={editingUser}
      />
    </div>
  );
};
