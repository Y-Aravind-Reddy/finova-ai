import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  Search,
  Filter,
  FileText,
  BadgeAlert,
  Fingerprint,
} from 'lucide-react';

interface KycRecord {
  id: string;
  name: string;
  email: string;
  tier: string;
  jurisdiction: string;
  biometricScore: number;
  pepStatus: 'Clean' | 'PEP Watch' | 'Sanction Match';
  sanctionLists: string;
  docsCount: number;
  status: 'Approved' | 'Under Review' | 'Escalated' | 'Pending Docs';
  lastUpdated: string;
}

export const KycVerificationPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [records, setRecords] = useState<KycRecord[]>([
    {
      id: 'KYC-REC-901',
      name: 'Harrison Croft',
      email: 'harrison.croft@finovaclient.com',
      tier: 'Private Wealth Tier 3',
      jurisdiction: 'Zurich, Switzerland',
      biometricScore: 99.8,
      pepStatus: 'Clean',
      sanctionLists: 'OFAC: Pass • EU: Pass • UN: Pass • FINMA: Pass',
      docsCount: 5,
      status: 'Approved',
      lastUpdated: 'Today, 08:30 UTC',
    },
    {
      id: 'KYC-REC-902',
      name: 'Victoria Habsburg',
      email: 'victoria.habsburg@finovaclient.com',
      tier: 'Private Wealth Tier 3',
      jurisdiction: 'Vienna, Austria',
      biometricScore: 99.4,
      pepStatus: 'Clean',
      sanctionLists: 'OFAC: Pass • EU: Pass • UN: Pass • FINMA: Pass',
      docsCount: 4,
      status: 'Approved',
      lastUpdated: 'Yesterday, 16:45 UTC',
    },
    {
      id: 'KYC-REC-903',
      name: 'Aegis Offshore Holdings Syndicate',
      email: 'compliance@aegisholdings.ch',
      tier: 'Institutional Tier 2',
      jurisdiction: 'Nassau / Limassol',
      biometricScore: 78.2,
      pepStatus: 'PEP Watch',
      sanctionLists: 'OFAC: Enhanced Due Diligence • EU: Watchlist',
      docsCount: 2,
      status: 'Escalated',
      lastUpdated: 'Oct 06, 2026',
    },
    {
      id: 'KYC-REC-904',
      name: 'Marcus Aurelius Sterling',
      email: 'marcus.sterling@finovaclient.com',
      tier: 'Private Wealth Tier 3',
      jurisdiction: 'Monaco / London',
      biometricScore: 99.9,
      pepStatus: 'Clean',
      sanctionLists: 'OFAC: Pass • EU: Pass • UN: Pass • FINMA: Pass',
      docsCount: 6,
      status: 'Approved',
      lastUpdated: 'Oct 05, 2026',
    },
    {
      id: 'KYC-REC-905',
      name: 'Kenji Takahashi',
      email: 'kenji.takahashi@finovaclient.com',
      tier: 'Private Wealth Tier 3',
      jurisdiction: 'Tokyo, Japan',
      biometricScore: 96.5,
      pepStatus: 'Clean',
      sanctionLists: 'OFAC: Pass • EU: Pass • UN: Pass • FINMA: Pass',
      docsCount: 3,
      status: 'Under Review',
      lastUpdated: 'Oct 04, 2026',
    },
  ]);

  const handleUpdateStatus = (id: string, newStatus: KycRecord['status']) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus, lastUpdated: 'Just now' } : r))
    );
  };

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.jurisdiction.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Dedicated Platform Engine
            </span>
            <span className="text-xs text-[#D4A017] flex items-center gap-1">
              <Fingerprint size={12} className="text-[#F5C542]" /> Finova Sentinel Biometrics v5.4
            </span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            KYC Verification Engine
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Comprehensive sovereign identity compliance, biometric facial liveness matching, PEP watchlist scanning, and OFAC/FINMA sanction screening.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#141414] border border-[#D4A017]/30 text-right">
            <span className="text-[10px] text-[#6B7280] block">Sanction Database Sync</span>
            <span className="text-sm font-bold text-[#F5C542]">Every 15 Minutes</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search size={14} className="absolute left-3.5 top-3.5 text-[#D4A017]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by client name, record ID, or jurisdiction..."
              className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            {['ALL', 'Approved', 'Under Review', 'Escalated'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111]'
                    : 'bg-[#141414] text-[#D4A017] hover:bg-[#301B05]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Table of Records */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017] tracking-wider">
                <th className="pb-3 font-semibold">Client & Account</th>
                <th className="pb-3 font-semibold">Tier & Jurisdiction</th>
                <th className="pb-3 font-semibold">Biometric Match</th>
                <th className="pb-3 font-semibold">Sanctions & PEP</th>
                <th className="pb-3 font-semibold">Compliance Status</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4A017]/10">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-[#141414] transition-colors">
                  <td className="py-3.5 pr-3">
                    <p className="font-bold text-[#FFF8E7]">{r.name}</p>
                    <p className="text-[10px] text-[#6B7280]">{r.id} • {r.email}</p>
                  </td>
                  <td className="py-3.5 pr-3">
                    <span className="text-[#F5C542]">{r.tier}</span>
                    <p className="text-[10px] text-[#FAF7F0]/70">{r.jurisdiction}</p>
                  </td>
                  <td className="py-3.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-[#111111] rounded-full h-2 overflow-hidden border border-[#D4A017]/20">
                        <div
                          className="bg-gradient-to-r from-[#D4A017] to-[#F5C542] h-full"
                          style={{ width: `${r.biometricScore}%` }}
                        />
                      </div>
                      <span className="font-bold text-[#FFF8E7]">{r.biometricScore}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.pepStatus === 'Clean'
                          ? 'bg-[#111111] text-[#F5C542] border border-[#D4A017]/30'
                          : 'bg-[#301B05] text-[#C08A00] border border-[#C08A00]'
                      }`}
                    >
                      {r.pepStatus}
                    </span>
                    <p className="text-[9px] text-[#6B7280] mt-1">{r.sanctionLists}</p>
                  </td>
                  <td className="py-3.5 pr-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        r.status === 'Approved'
                          ? 'bg-[#141414] text-[#F5C542] border border-[#D4A017]'
                          : r.status === 'Escalated'
                          ? 'bg-[#301B05] text-[#FFF8E7] border border-[#C08A00]'
                          : 'bg-[#141414] text-[#D4A017] border border-[#D4A017]/40'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-right space-x-2">
                    {r.status !== 'Approved' && (
                      <button
                        onClick={() => handleUpdateStatus(r.id, 'Approved')}
                        className="px-2.5 py-1 rounded bg-[#301B05] text-[#F5C542] hover:bg-[#4A2C0A] border border-[#D4A017]/40 text-[10px] font-bold transition-all"
                      >
                        Approve
                      </button>
                    )}
                    {r.status !== 'Escalated' && (
                      <button
                        onClick={() => handleUpdateStatus(r.id, 'Escalated')}
                        className="px-2.5 py-1 rounded bg-[#111111] text-[#C08A00] hover:bg-[#301B05] border border-[#C08A00]/40 text-[10px] font-bold transition-all"
                      >
                        Escalate
                      </button>
                    )}
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
