import React, { useState } from 'react';
import { Clock, CheckCircle2, User, PhoneCall, Calendar } from 'lucide-react';

interface FollowUpItem {
  id: string;
  client: string;
  subject: string;
  dueDate: string;
  priority: 'Urgent' | 'High' | 'Standard';
  status: 'Pending' | 'Callback Scheduled' | 'Completed';
  rm: string;
}

export const SupportFollowupsPage: React.FC = () => {
  const [followups, setFollowups] = useState<FollowUpItem[]>([
    {
      id: 'FOL-8821',
      client: 'Harrison Croft',
      subject: 'Courier delivery confirmation of Black Sovereign Card to Geneva Chalet',
      dueDate: 'Today, 14:00 UTC',
      priority: 'Urgent',
      status: 'Pending',
      rm: 'Claire Montgomery',
    },
    {
      id: 'FOL-8822',
      client: 'Marcus Aurelius Sterling',
      subject: 'IRS W-8BEN notarized document resubmission verification check',
      dueDate: 'Today, 17:30 UTC',
      priority: 'High',
      status: 'Callback Scheduled',
      rm: 'James Sterling',
    },
    {
      id: 'FOL-8823',
      client: 'Victoria Habsburg',
      subject: 'High-value wire dual authorization callback verification ($1.8M)',
      dueDate: 'Tomorrow, 09:00 UTC',
      priority: 'Urgent',
      status: 'Pending',
      rm: 'Claire Montgomery',
    },
  ]);

  const handleComplete = (id: string) => {
    setFollowups((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'Completed' } : f))
    );
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Client Relationship Concierge
            </span>
            <span className="text-xs text-[#D4A017]">Scheduled Callbacks & Deliveries</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Client Follow-Ups & Callbacks
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Active concierge calendar tracking sovereign physical deliveries, phone authorizations for high-value wires, and relationship manager syncs.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Pending Scheduled Actions</span>
          <span className="text-sm font-bold text-[#F5C542]">3 On Schedule</span>
        </div>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2 pb-3 border-b border-[#D4A017]/20">
          <Calendar size={16} className="text-[#F5C542]" /> Scheduled High-Touch Concierge Queue
        </h3>

        <div className="space-y-3">
          {followups.map((f) => (
            <div
              key={f.id}
              className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#301B05] text-[#F5C542] font-bold text-[10px]">
                    {f.id}
                  </span>
                  <span className="font-bold text-[#FFF8E7] text-sm">{f.client}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      f.priority === 'Urgent'
                        ? 'bg-[#301B05] text-[#C08A00] border border-[#C08A00]'
                        : 'bg-[#111111] text-[#D4A017]'
                    }`}
                  >
                    {f.priority}
                  </span>
                </div>
                <p className="text-[11px] text-[#FAF7F0] mt-1">{f.subject}</p>
                <p className="text-[10px] text-[#D4A017] flex items-center gap-1 mt-1">
                  <Clock size={11} /> Target Due: {f.dueDate} • RM: {f.rm}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                    f.status === 'Completed'
                      ? 'bg-[#141414] text-[#F5C542] border border-[#D4A017]'
                      : 'bg-[#301B05] text-[#FFF8E7]'
                  }`}
                >
                  {f.status}
                </span>

                {f.status !== 'Completed' && (
                  <button
                    onClick={() => handleComplete(f.id)}
                    className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-[10px] hover:brightness-110"
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
