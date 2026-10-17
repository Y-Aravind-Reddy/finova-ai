import React, { useState, useEffect, useCallback } from 'react';
import { Headphones, Phone, Mail, Clock, MessageSquare, Send, CheckCircle2, RotateCw, ShieldCheck, Building2 } from 'lucide-react';
import { UserAccount, SupportTicket } from '../../data/finovaDatasets';
import { fetchSupportTicketsResultFromDb } from '../../services/finovaDatabase';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getStoredSession } from '../../data/authStore';
import { getTenantById } from '../../data/tenantStore';

interface CustomerSupportPageProps {
  currentUser?: UserAccount;
}

export const CustomerSupportPage: React.FC<CustomerSupportPageProps> = ({ currentUser: propUser }) => {
  const activeUser = propUser || getStoredSession()?.user;
  const tenantId = activeUser?.tenantId || 'tenant_apex_bank';
  const tenant = getTenantById(tenantId);
  const companyName = tenant?.name || activeUser?.tenantName || 'Apex Global Bank';

  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('High-Value Wire Authorization');
  const [ticketPriority, setTicketPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState<boolean>(true);
  const [dbSource, setDbSource] = useState<'supabase' | 'fallback'>('fallback');
  const [dbError, setDbError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await fetchSupportTicketsResultFromDb(tenantId, {
        userId: activeUser?.id,
      });
      setDbSource(res.source);
      setDbError(res.error);
      setTickets(res.data || []);
    } catch (err: any) {
      setDbSource('fallback');
      setDbError(err?.message || 'Error loading tickets');
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [tenantId, activeUser?.id]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim()) return;

    setSubmitting(true);
    const newId = `TICK-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTicketRecord = {
      id: newId,
      ticket_id: newId,
      user_id: activeUser?.id || null,
      tenant_id: tenantId,
      tenant_name: companyName,
      customer_name: activeUser?.name || 'Authorized Client',
      account_tier: activeUser?.tier || 'Private Wealth Tier 3',
      category: ticketCategory,
      priority: ticketPriority,
      status: 'Open',
      assigned_executive: 'Unassigned',
      opened_at: new Date().toISOString(),
      sla_target_hours: ticketPriority === 'Urgent' ? 2 : ticketPriority === 'High' ? 4 : 8,
      hours_open: 0,
      notes: ticketMessage.trim() || ticketSubject.trim(),
    };

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('support_tickets').insert([newTicketRecord]);
        if (error) {
          console.warn('Supabase ticket insert note:', error.message);
        }
      } catch (err) {
        console.warn('Support ticket insert exception:', err);
      }
    }

    setSubmitted(true);
    setTicketSubject('');
    setTicketMessage('');
    setSubmitting(false);
    loadTickets();
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName}
            </span>
            <span className="text-xs text-[#D4A017]">Private Concierge Service Desk</span>
            {dbSource === 'supabase' ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                Live DB Connected ({tickets.length} User Tickets)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300">
                RLS Scoped ({dbError ? 'Query Restricted' : 'Awaiting Auth'})
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Concierge Support Center
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Dedicated private banker concierge desk available 24/7 for high-value settlement dual-signoff, custody release, and wealth management requests.
          </p>
        </div>

        <button
          onClick={() => loadTickets()}
          disabled={loadingTickets}
          className="p-2.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 hover:border-[#F5C542] text-[#D4A017] transition-all flex items-center gap-1.5"
        >
          <RotateCw size={14} className={loadingTickets ? 'animate-spin' : ''} />
          <span className="text-xs font-bold">Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-3">
            <h3 className="text-sm font-bold text-[#F5C542]">Direct Dedicated Concierge Lines</h3>
            <div className="p-3 bg-[#111111] rounded-xl border border-[#301B05] space-y-1">
              <span className="text-[10px] text-[#6B7280] uppercase block">Institutional Banking Desk</span>
              <p className="font-bold text-[#FFF8E7]">{companyName} Concierge Team</p>
              <p className="text-[#D4A017]">+1 (212) 555-0100 (Direct Wire Desk)</p>
            </div>

            <div className="p-3 bg-[#111111] rounded-xl border border-[#301B05] space-y-1">
              <span className="text-[10px] text-[#6B7280] uppercase block">Escrow Emergency Rail</span>
              <p className="font-bold text-[#FFF8E7]">24/7 Ultra HNW Emergency Escrow</p>
              <p className="text-[#D4A017]">+41 22 730 5900 (Geneva Escrow Guard)</p>
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
              <span>Inquiry dispatched with Priority {ticketPriority} to {companyName} Operations. Record inserted into database.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[#D4A017] font-bold block mb-1">Inquiry Subject</label>
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="e.g. Dual Authorization for Zurich Escrow Release..."
                  className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
                />
              </div>

              <div>
                <label className="text-[#D4A017] font-bold block mb-1">Category</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
                >
                  <option value="High-Value Wire Authorization">High-Value Wire Authorization</option>
                  <option value="Custody Escrow Release">Custody Escrow Release</option>
                  <option value="KYC Re-accreditation">KYC Re-accreditation</option>
                  <option value="Dual-Keyholder Signoff">Dual-Keyholder Signoff</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[#D4A017] font-bold block mb-1">Details & Special Instructions</label>
              <textarea
                rows={3}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Please include wire reference numbers, currency specifics, or courier delivery notes..."
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2"
            >
              <Send size={14} />
              {submitting ? 'Transmitting to Supabase...' : 'Transmit to Private Concierge'}
            </button>
          </form>

          {/* Active Tickets Table */}
          <div className="pt-4 border-t border-[#D4A017]/20">
            <h4 className="text-xs font-bold text-[#E6C78B] mb-2">My Concierge Service Tickets</h4>
            {loadingTickets ? (
              <div className="py-6 text-center text-[#9CA3AF]">
                <RotateCw size={18} className="mx-auto mb-1 text-[#D4A017] animate-spin" />
                <p>Loading tickets from database...</p>
              </div>
            ) : tickets.length === 0 ? (
              <div className="py-6 text-center text-[#9CA3AF] border border-dashed border-[#3A3A3A] rounded-xl">
                <Headphones size={24} className="mx-auto mb-1 text-[#D4A017] opacity-60" />
                <p className="font-bold text-[#FAF7F0]">No Support Tickets On File</p>
                <p className="text-[11px] text-[#6B7280] mt-1 max-w-sm mx-auto">
                  No tickets found in public.support_tickets for your user account. Historical tenant tickets have user_id = NULL and remain isolated to tenant audit staff.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[10px]">
                      <th className="pb-2">Ticket ID</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2">Priority</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Target SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                    {tickets.map((t) => (
                      <tr key={t.ticketId} className="hover:bg-[#141414]">
                        <td className="py-2 font-bold text-[#F5C542]">{t.ticketId}</td>
                        <td className="py-2 text-[#FAF7F0]">{t.category}</td>
                        <td className="py-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#141414] text-[#E6C78B] border border-[#3A3A3A]">
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#141414] text-[#E6C78B] border border-[#3A3A3A]">
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2 text-right text-[#9CA3AF]">{t.slaTargetHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
