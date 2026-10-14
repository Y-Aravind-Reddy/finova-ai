import React, { useState } from 'react';
import {
  FolderGit2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  User,
  Plus,
  Search,
  Filter,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface CaseItem {
  id: string;
  title: string;
  client: string;
  tier: string;
  priority: 'P1 - Critical' | 'P2 - High' | 'P3 - Standard';
  slaTimeRemaining: string;
  assignedTo: string;
  status: 'Open' | 'In Progress' | 'Escalated' | 'Resolved';
  openedDate: string;
  category: string;
  notes: string[];
}

export const CaseManagementPage: React.FC = () => {
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCase, setActiveCase] = useState<CaseItem | null>(null);
  const [newNote, setNewNote] = useState('');

  const [cases, setCases] = useState<CaseItem[]>([
    {
      id: 'CASE-2026-104',
      title: 'High-Value Wire Escrow Freeze Verification ($1.8M)',
      client: 'Victoria Habsburg (Austria)',
      tier: 'Private Wealth Tier 3',
      priority: 'P1 - Critical',
      slaTimeRemaining: '38 minutes (SLA Green)',
      assignedTo: 'Claire Montgomery (Lead RM)',
      status: 'In Progress',
      openedDate: 'Today, 08:15 UTC',
      category: 'Wire Authorization',
      notes: [
        'Dual cryptographic authorization required from Relationship Manager and Client.',
        'Notarized passport signature matched against biometric repository.',
      ],
    },
    {
      id: 'CASE-2026-105',
      title: 'SWIFT GPI Delayed Notification on Paris Real Estate Release',
      client: 'Genevieve Dupont (France)',
      tier: 'Private Wealth Tier 2',
      priority: 'P2 - High',
      slaTimeRemaining: '2 hrs 14 mins',
      assignedTo: 'Julian Thorne (Analyst)',
      status: 'Open',
      openedDate: 'Today, 07:40 UTC',
      category: 'SWIFT Settlement',
      notes: [
        'Intermediary clearing bank held pacs.008 due to holiday hours at Banque de France.',
      ],
    },
    {
      id: 'CASE-2026-106',
      title: 'Gold Sovereign Debit Card Physical Courier Dispatch',
      client: 'Harrison Croft (Zurich)',
      tier: 'Private Wealth Tier 3',
      priority: 'P3 - Standard',
      slaTimeRemaining: '4 hrs 50 mins',
      assignedTo: 'James Sterling (Logistics)',
      status: 'In Progress',
      openedDate: 'Yesterday, 15:20 UTC',
      category: 'Card Issuance',
      notes: [
        'Metal 24K engraved card dispatched via armored courier to St. Moritz Chalet.',
      ],
    },
    {
      id: 'CASE-2026-107',
      title: 'IRS W-8BEN Apostille Foreign Tax Verification',
      client: 'Marcus Aurelius Sterling (Monaco)',
      tier: 'Private Wealth Tier 3',
      priority: 'P2 - High',
      slaTimeRemaining: '1 hr 05 mins',
      assignedTo: 'Soren Lindqvist (Compliance)',
      status: 'Resolved',
      openedDate: 'Yesterday, 11:30 UTC',
      category: 'Tax Document Vault',
      notes: [
        'Apostille stamp validated against Monaco Ministry of Foreign Affairs public registry.',
      ],
    },
  ]);

  const handleAddNote = () => {
    if (!activeCase || !newNote.trim()) return;
    const updatedNotes = [...activeCase.notes, `${new Date().toLocaleTimeString()}: ${newNote}`];
    const updatedCase = { ...activeCase, notes: updatedNotes };
    setActiveCase(updatedCase);
    setCases((prev) => prev.map((c) => (c.id === activeCase.id ? updatedCase : c)));
    setNewNote('');
  };

  const handleUpdateStatus = (id: string, status: CaseItem['status']) => {
    setCases((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
    if (activeCase && activeCase.id === id) {
      setActiveCase({ ...activeCase, status });
    }
  };

  const filtered = cases.filter((c) => {
    const matchesPriority = selectedPriority === 'ALL' || c.priority.includes(selectedPriority);
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPriority && matchesSearch;
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
              <FolderGit2 size={12} className="text-[#F5C542]" /> SLA Orchestration Engine v4.8
            </span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Enterprise Case Management
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            End-to-end incident tracking, multi-tier escalation, relationship manager triage, and SLA compliance orchestration across private wealth operations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#141414] border border-[#D4A017]/30 text-right">
            <span className="text-[10px] text-[#6B7280] block">Global SLA Adherence</span>
            <span className="text-sm font-bold text-[#F5C542]">99.42%</span>
          </div>
        </div>
      </div>

      {/* Grid: Case List (left) + Detail Panel (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Case List (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#D4A017]/20">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search size={14} className="absolute left-3 top-3 text-[#D4A017]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search cases or clients..."
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#6B7280]">Priority:</span>
              {['ALL', 'P1', 'P2', 'P3'].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPriority(p)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    selectedPriority === p
                      ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111]'
                      : 'bg-[#141414] text-[#D4A017] hover:bg-[#301B05]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveCase(item)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  activeCase?.id === item.id
                    ? 'bg-gradient-to-br from-[#301B05] to-[#4A2C0A] border-[#F5C542] shadow-[0_0_15px_rgba(212,160,23,0.3)]'
                    : 'bg-[#141414] border-[#D4A017]/20 hover:border-[#D4A017]/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#111111] text-[#F5C542] font-bold text-[10px] border border-[#D4A017]/40">
                      {item.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.priority.includes('P1')
                          ? 'bg-[#301B05] text-[#C08A00] border border-[#C08A00]'
                          : item.priority.includes('P2')
                          ? 'bg-[#1E1E1E] text-[#F5C542] border border-[#D4A017]'
                          : 'bg-[#111111] text-[#FAF7F0] border border-[#D4A017]/30'
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      item.status === 'Resolved'
                        ? 'bg-[#141414] text-[#F5C542] border border-[#D4A017]'
                        : item.status === 'In Progress'
                        ? 'bg-[#301B05] text-[#FFF8E7] border border-[#D4A017]/40'
                        : 'bg-[#141414] text-[#FAF7F0] border border-[#D4A017]/20'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <h4 className="font-bold text-[#FFF8E7] text-[13px] mt-2">{item.title}</h4>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#6B7280]">
                  <div className="flex items-center gap-3">
                    <span className="text-[#D4A017]">Client: {item.client}</span>
                    <span>Assignee: {item.assignedTo}</span>
                  </div>
                  <span className="text-[#F5C542] flex items-center gap-1">
                    <Clock size={11} /> {item.slaTimeRemaining}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Selected Case Dossier (1 col) */}
        <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4 flex flex-col justify-between">
          {activeCase ? (
            <div className="space-y-4">
              <div className="pb-3 border-b border-[#D4A017]/20">
                <span className="text-[10px] uppercase text-[#D4A017] font-bold block">
                  Active Case File
                </span>
                <h3 className="font-bold text-[#FFF8E7] text-sm mt-1">{activeCase.title}</h3>
                <p className="text-[11px] text-[#6B7280]">{activeCase.id} • {activeCase.category}</p>
              </div>

              <div className="p-3 bg-[#111111] rounded-xl border border-[#301B05] space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Client:</span>
                  <span className="text-[#FAF7F0] font-semibold">{activeCase.client}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Tier:</span>
                  <span className="text-[#F5C542]">{activeCase.tier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Assignee:</span>
                  <span className="text-[#FAF7F0]">{activeCase.assignedTo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">SLA Clock:</span>
                  <span className="text-[#C08A00] font-bold">{activeCase.slaTimeRemaining}</span>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="space-y-2">
                <span className="text-[10px] text-[#6B7280] font-bold uppercase block">
                  Update Case State
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateStatus(activeCase.id, 'In Progress')}
                    className="p-2 rounded-lg bg-[#141414] hover:bg-[#301B05] border border-[#D4A017]/30 text-[#D4A017] text-[10px] font-bold"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(activeCase.id, 'Resolved')}
                    className="p-2 rounded-lg bg-[#301B05] hover:bg-[#4A2C0A] border border-[#F5C542] text-[#F5C542] text-[10px] font-bold"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>

              {/* Case Notes Trail */}
              <div className="space-y-2 pt-2 border-t border-[#D4A017]/20">
                <span className="text-[10px] text-[#D4A017] font-bold flex items-center gap-1">
                  <MessageSquare size={12} /> Case Investigation Notes ({activeCase.notes.length})
                </span>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {activeCase.notes.map((n, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#111111] border border-[#301B05] text-[10px] text-[#FFF8E7]/90 leading-relaxed"
                    >
                      {n}
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add audit note..."
                    className="flex-1 bg-[#111111] border border-[#D4A017]/30 rounded-lg px-2.5 py-1.5 text-[11px] text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
                  />
                  <button
                    onClick={handleAddNote}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-[10px]"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center space-y-2 text-[#6B7280]">
              <FolderGit2 size={32} className="text-[#D4A017]/40" />
              <p>Select any case item from the left queue to open its full dossier.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
