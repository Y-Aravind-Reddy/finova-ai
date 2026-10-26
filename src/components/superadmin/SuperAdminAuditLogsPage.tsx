import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Shield,
  Search,
  Download,
  CheckCircle2,
  Lock,
  RefreshCw,
  Database,
  AlertTriangle,
} from 'lucide-react';
import {
  fetchAuditLogsResultFromDb,
  AuditLogEntry,
} from '../../services/finovaDatabase';
import { getStoredSession } from '../../data/authStore';

interface SuperAdminAuditLogsPageProps {
  currentUser?: {
    role?: string;
    name?: string;
    email?: string;
  };
}

export const SuperAdminAuditLogsPage: React.FC<SuperAdminAuditLogsPageProps> = ({ currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

  const activeUser = currentUser || getStoredSession()?.user;

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditLogsResultFromDb();
      setLogs(res.logs);
      setIsDbConnected(res.isDbConnected);
      if (res.error && !res.isDbConnected) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch audit log chain from Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const filtered = logs.filter((l) => {
    const matchesSearch =
      l.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.target.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSev = severityFilter === 'ALL' || l.severity === severityFilter;
    return matchesSearch && matchesSev;
  });

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `Finova_Audit_Log_Chain_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Append-Only Audit Trail
            </span>
            <span className="text-xs text-[#D4A017]">Postgres RLS Enforced (Zero UPDATE / DELETE)</span>
            <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-[#111111]/80 border border-[#D4A017]/30 text-[10px]">
              <Database size={11} className={isDbConnected ? 'text-[#10B981]' : 'text-[#F59E0B]'} />
              <span className={isDbConnected ? 'text-[#10B981]' : 'text-[#F59E0B]'}>
                {isDbConnected ? 'Supabase public.audit_logs' : 'Localized Cache'}
              </span>
            </div>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            System Audit Logs
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Append-only security audit journal tracking root access, administrative clearances, and AI parameter deployments under strict database RLS.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAuditLogs}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 text-[#FAF7F0] hover:bg-[#1E1E1E] text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            title="Reload from Supabase"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#D4A017]' : 'text-[#D4A017]'} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExport}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2"
          >
            <Download size={14} /> Export Immutable Log Chain
          </button>
        </div>
      </div>

      {/* Error Banner if Query Failed */}
      {error && (
        <div className="rounded-xl p-4 bg-[#2D0A0A] border border-[#EF4444]/60 text-[#FAF7F0] flex items-start gap-3 shadow-lg">
          <AlertTriangle size={18} className="text-[#EF4444] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-[#EF4444] text-xs">Audit Log Query Notice</p>
            <p className="text-[11px] text-[#FCA5A5] mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Audit Log Table Container */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#D4A017]/20">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-3 text-[#D4A017]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search actor, action, or target..."
              className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#6B7280]">Severity:</span>
            {['ALL', 'Nominal', 'Elevated', 'Critical'].map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  severityFilter === s
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111]'
                    : 'bg-[#141414] text-[#D4A017] hover:bg-[#1E1E1E]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017]">
                <th className="pb-3">Log ID</th>
                <th className="pb-3">Actor & Role</th>
                <th className="pb-3">Action Description</th>
                <th className="pb-3">Target Resource</th>
                <th className="pb-3">IP / Geo</th>
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Hash Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4A017]/10">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-[#D4A017]" />
                      <span>Loading immutable audit records from Supabase...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                    No audit records match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-[#141414] transition-colors">
                    <td className="py-3 font-bold text-[#F5C542]">{l.id}</td>
                    <td className="py-3">
                      <p className="font-semibold text-[#FFF8E7]">{l.actor}</p>
                      <p className="text-[10px] text-[#6B7280]">{l.role}</p>
                    </td>
                    <td className="py-3 text-[#FAF7F0]">{l.action}</td>
                    <td className="py-3 text-[#D4A017]">{l.target}</td>
                    <td className="py-3 text-[#6B7280]">{l.ipAddress}</td>
                    <td className="py-3 text-[#FAF7F0]/80">{l.timestamp}</td>
                    <td className="py-3">
                      <code className="text-[10px] bg-[#111111] px-2 py-0.5 rounded text-[#C08A00] border border-[#D4A017]/20">
                        {l.sha256Hash}
                      </code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div className="pt-3 border-t border-[#D4A017]/20 flex items-center justify-between text-[10px] text-[#6B7280]">
          <span>Total Verified Events: {logs.length} (Filtered: {filtered.length})</span>
          <span>Access Clearance: SUPER_ADMIN</span>
        </div>
      </div>
    </div>
  );
};
