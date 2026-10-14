import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Clock, ArrowRight } from 'lucide-react';

interface ComplaintItem {
  id: string;
  client: string;
  subject: string;
  severity: 'Critical' | 'Medium' | 'Low';
  openedAt: string;
  status: 'Under Investigation' | 'Arbitration' | 'Settled' | 'Resolved';
  assigned: string;
  settlementDetails?: string;
}

export const SupportComplaintResolutionPage: React.FC = () => {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([
    {
      id: 'CMP-104',
      client: 'Genevieve Dupont',
      subject: 'Delayed SWIFT GPI notification on Paris real estate escrow release',
      severity: 'Medium',
      openedAt: 'Yesterday 16:20 UTC',
      status: 'Under Investigation',
      assigned: 'James Sterling',
    },
    {
      id: 'CMP-105',
      client: 'Kenji Takahashi',
      subject: 'International roaming dual-factor SMS delay at Tokyo Narita',
      severity: 'Low',
      openedAt: '2 days ago',
      status: 'Resolved',
      assigned: 'Claire Montgomery',
      settlementDetails: 'Hardware security key issued with complimentary express courier.',
    },
    {
      id: 'CMP-106',
      client: 'Aegis Offshore Holdings Syndicate',
      subject: 'Disputed escrow freeze on $1,240,000 USD transfer to Nassau',
      severity: 'Critical',
      openedAt: '3 days ago',
      status: 'Arbitration',
      assigned: 'Julian Thorne (Lead AML)',
      settlementDetails: 'Under formal FINMA legal review. Regulatory standstill enforced.',
    },
  ]);

  const handleResolve = (id: string) => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'Resolved', settlementDetails: 'Arbitrated and settled by executive consensus.' } : c
      )
    );
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Dispute Resolution
            </span>
            <span className="text-xs text-[#D4A017]">Formal Client Grievance Portal</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Complaint Resolution & Arbitration
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Track formal customer complaints, manage arbitration settlement procedures, and maintain full compliance with FINMA/FCA standards.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Average Resolution Time</span>
          <span className="text-sm font-bold text-[#F5C542]">18.4 Hours (100% within SLA)</span>
        </div>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2 pb-3 border-b border-[#D4A017]/20">
          <AlertTriangle size={16} className="text-[#F5C542]" /> Active Formal Dispute Incidents
        </h3>

        <div className="space-y-3">
          {complaints.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#301B05] text-[#F5C542] font-bold text-[10px]">
                    {c.id}
                  </span>
                  <span className="font-bold text-[#FFF8E7]">{c.client}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.severity === 'Critical'
                        ? 'bg-[#301B05] text-[#C08A00] border border-[#C08A00]'
                        : 'bg-[#111111] text-[#D4A017]'
                    }`}
                  >
                    {c.severity}
                  </span>
                </div>
                <p className="text-[11px] text-[#FAF7F0] mt-1">{c.subject}</p>
                <p className="text-[10px] text-[#6B7280]">
                  Opened: {c.openedAt} • Officer: {c.assigned}
                </p>
                {c.settlementDetails && (
                  <p className="text-[10px] text-[#F5C542] mt-1 bg-[#111111] p-1.5 rounded border border-[#D4A017]/20">
                    Resolution: {c.settlementDetails}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 text-right">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                    c.status === 'Resolved'
                      ? 'bg-[#141414] text-[#F5C542] border border-[#D4A017]'
                      : 'bg-[#301B05] text-[#FFF8E7]'
                  }`}
                >
                  {c.status}
                </span>

                {c.status !== 'Resolved' && (
                  <button
                    onClick={() => handleResolve(c.id)}
                    className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-[10px]"
                  >
                    Resolve Dispute
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
