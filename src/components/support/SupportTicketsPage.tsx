import React, { useState } from 'react';
import {
  Headphones,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { SUPPORT_DATASET } from '../../data/finovaDatasets';

interface TicketItem {
  ticketId: string;
  clientName: string;
  subject: string;
  category: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Escalated' | 'Resolved';
  assignedTo: string;
  timeOpened: string;
  slaStatus: string;
  csatRating?: number;
}

export const SupportTicketsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const [tickets, setTickets] = useState<TicketItem[]>(SUPPORT_DATASET.tickets as any);

  const handleResolve = (id: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.ticketId === id ? { ...t, status: 'Resolved', csatRating: 5.0 } : t))
    );
  };

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ticketId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Concierge Operations
            </span>
            <span className="text-xs text-[#D4A017]">Private Wealth Client Support</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Customer Support Tickets
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Triage private wealth inquiries, track SLA countdown clocks, and resolve client requests with high touch concierge precision.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Average First Response Time</span>
          <span className="text-sm font-bold text-[#F5C542]">4.2 Minutes (Target &lt;10m)</span>
        </div>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#D4A017]/20">
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-3 text-[#D4A017]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ticket ID, client, subject..."
              className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#6B7280]">Priority:</span>
            {['ALL', 'Urgent', 'High', 'Medium'].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  priorityFilter === p
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111]'
                    : 'bg-[#141414] text-[#D4A017] hover:bg-[#301B05]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017]">
                <th className="pb-3">Ticket ID</th>
                <th className="pb-3">Client</th>
                <th className="pb-3">Subject & Category</th>
                <th className="pb-3">Priority</th>
                <th className="pb-3">Assignee</th>
                <th className="pb-3">SLA Status</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4A017]/10">
              {filtered.map((t) => (
                <tr key={t.ticketId} className="hover:bg-[#141414]">
                  <td className="py-3 font-bold text-[#F5C542]">{t.ticketId}</td>
                  <td className="py-3 font-semibold text-[#FFF8E7]">{t.clientName}</td>
                  <td className="py-3">
                    <p className="text-[#FAF7F0] font-medium">{t.subject}</p>
                    <p className="text-[10px] text-[#6B7280]">{t.category}</p>
                  </td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === 'Urgent'
                          ? 'bg-[#301B05] text-[#C08A00] border border-[#C08A00]'
                          : t.priority === 'High'
                          ? 'bg-[#141414] text-[#F5C542] border border-[#D4A017]'
                          : 'bg-[#111111] text-[#FAF7F0]'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-3 text-[#D4A017]">{t.assignedTo}</td>
                  <td className="py-3 text-[#F5C542]">{t.slaStatus}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.status === 'Resolved'
                          ? 'bg-[#141414] text-[#F5C542] border border-[#D4A017]'
                          : 'bg-[#301B05] text-[#FFF8E7]'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {t.status !== 'Resolved' ? (
                      <button
                        onClick={() => handleResolve(t.ticketId)}
                        className="px-2.5 py-1 rounded bg-[#301B05] hover:bg-[#4A2C0A] text-[#F5C542] border border-[#D4A017]/40 text-[10px] font-bold transition-all"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="text-[#F5C542] text-[10px]">★ 5.0 CSAT</span>
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
