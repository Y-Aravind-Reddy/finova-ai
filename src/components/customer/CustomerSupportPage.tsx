import React, { useState } from 'react';
import { Headphones, Phone, Mail, Clock, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { CUSTOMER_DATASET } from '../../data/finovaDatasets';

export const CustomerSupportPage: React.FC = () => {
  const profile = CUSTOMER_DATASET.profile;
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim()) return;
    setSubmitted(true);
    setTicketSubject('');
    setTicketMessage('');
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Private Concierge
            </span>
            <span className="text-xs text-[#D4A017]">Relationship Manager: {profile.relationshipManager}</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Concierge Support Center
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Dedicated private banker concierge desk available 24/7 for high-value settlement dual-signoff, physical delivery, and wealth management requests.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Priority Response Guarantee</span>
          <span className="text-sm font-bold text-[#F5C542]">&lt; 5 Minutes</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-3">
            <h3 className="text-sm font-bold text-[#F5C542]">Direct Dedicated Concierge Lines</h3>
            <div className="p-3 bg-[#111111] rounded-xl border border-[#301B05] space-y-1">
              <span className="text-[10px] text-[#6B7280] uppercase block">Lead Relationship Manager</span>
              <p className="font-bold text-[#FFF8E7]">{profile.relationshipManager}</p>
              <p className="text-[#D4A017]">+41 22 819 0100 (Direct Geneva)</p>
            </div>

            <div className="p-3 bg-[#111111] rounded-xl border border-[#301B05] space-y-1">
              <span className="text-[10px] text-[#6B7280] uppercase block">Sovereign Hotline</span>
              <p className="font-bold text-[#FFF8E7]">24/7 Ultra HNW Emergency Escrow</p>
              <p className="text-[#D4A017]">+1 (212) 555-8849 (Secure Wire)</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2 pb-2 border-b border-[#D4A017]/20">
            <MessageSquare size={16} className="text-[#F5C542]" /> Submit Concierge Service Request
          </h3>

          {submitted && (
            <div className="p-3 bg-[#301B05] border border-[#D4A017] rounded-xl text-[#F5C542] flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>Inquiry dispatched with Priority P1 to {profile.relationshipManager}. SLA response timer started.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[#D4A017] font-bold block mb-1">Inquiry Subject</label>
              <input
                type="text"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="e.g. Dual Authorization for Zurich Escrow Release..."
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
              />
            </div>

            <div>
              <label className="text-[#D4A017] font-bold block mb-1">Details & Special Instructions</label>
              <textarea
                rows={4}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Please include wire reference numbers, currency specifics, or courier delivery notes..."
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2"
            >
              <Send size={14} /> Transmit to Private Concierge
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
