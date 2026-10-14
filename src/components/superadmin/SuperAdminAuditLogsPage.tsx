import React, { useState } from 'react';
import { FileText, Shield, Search, Download, CheckCircle2, Lock } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  ipAddress: string;
  timestamp: string;
  sha256Hash: string;
  severity: 'Nominal' | 'Elevated' | 'Critical';
}

export const SuperAdminAuditLogsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const [logs] = useState<AuditLogEntry[]>([
    {
      id: 'AUD-9901',
      actor: 'Alexander Vance',
      role: 'SUPER_ADMIN',
      action: 'Root Governance Policy Update',
      target: 'RBAC Kernel Module',
      ipAddress: '194.209.12.18 (Zurich)',
      timestamp: 'Today, 09:24:18 UTC',
      sha256Hash: '4a1f...9b20',
      severity: 'Nominal',
    },
    {
      id: 'AUD-9902',
      actor: 'Julian Thorne',
      role: 'FINANCE_ANALYST',
      action: 'Escrow Freeze Initiated',
      target: 'Account #FNV-CUST-9104 ($1.24M)',
      ipAddress: '185.122.10.45 (London)',
      timestamp: 'Today, 09:12:05 UTC',
      sha256Hash: '8b72...31c4',
      severity: 'Critical',
    },
    {
      id: 'AUD-9903',
      actor: 'Sarah Jenkins',
      role: 'ADMIN',
      action: 'Batch Settlement Executed',
      target: 'SWIFT GPI Outgoing Queue #48',
      ipAddress: '194.209.12.22 (Zurich)',
      timestamp: 'Today, 08:45:10 UTC',
      sha256Hash: '19f2...88aa',
      severity: 'Nominal',
    },
    {
      id: 'AUD-9904',
      actor: 'Claire Montgomery',
      role: 'SUPPORT_EXECUTIVE',
      action: 'Case Escalated to Lead Risk',
      target: 'CASE-2026-104 (Wire Callback)',
      ipAddress: '185.122.10.89 (London)',
      timestamp: 'Today, 08:20:44 UTC',
      sha256Hash: 'f4e1...29d1',
      severity: 'Elevated',
    },
    {
      id: 'AUD-9905',
      actor: 'Harrison Croft',
      role: 'CUSTOMER',
      action: 'Biometric 2FA Login Approved',
      target: 'Sovereign Portal Enclave',
      ipAddress: '84.115.190.12 (Geneva)',
      timestamp: 'Today, 08:14:02 UTC',
      sha256Hash: 'aa77...112e',
      severity: 'Nominal',
    },
  ]);

  const filtered = logs.filter((l) => {
    const matchesSearch =
      l.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSev = severityFilter === 'ALL' || l.severity === severityFilter;
    return matchesSearch && matchesSev;
  });

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', 'Finova_Audit_Log_Chain.json');
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Cryptographic Ledger
            </span>
            <span className="text-xs text-[#D4A017]">SHA-256 Immutability Active</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            System Audit Logs
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Cryptographically sealed immutable audit journal tracking root access, administrative clearances, and financial escrow freezes.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2"
        >
          <Download size={14} /> Export Immutable Log Chain
        </button>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#D4A017]/20">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-3 text-[#D4A017]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search actor or action..."
              className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#6B7280]">Severity:</span>
            {['ALL', 'Nominal', 'Elevated', 'Critical'].map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  severityFilter === s
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111]'
                    : 'bg-[#141414] text-[#D4A017]'
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
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-[#141414]">
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
