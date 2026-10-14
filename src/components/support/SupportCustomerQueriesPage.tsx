import React, { useState } from 'react';
import { MessageSquare, Send, User, Bot, Clock, CheckCircle2 } from 'lucide-react';

interface ClientQuery {
  id: string;
  client: string;
  account: string;
  channel: string;
  preview: string;
  time: string;
  messages: Array<{ sender: 'client' | 'agent'; text: string; time: string }>;
}

export const SupportCustomerQueriesPage: React.FC = () => {
  const [queries, setQueries] = useState<ClientQuery[]>([
    {
      id: 'QRY-8801',
      client: 'Harrison Croft',
      account: 'FNV-CUST-8849',
      channel: 'Secure Concierge Chat',
      preview: 'Inquiry regarding physical 24K Black Sovereign Card delivery window...',
      time: '10 mins ago',
      messages: [
        {
          sender: 'client',
          text: 'Good morning. Could you confirm whether the armored courier with my physical Black Sovereign Card has cleared Swiss customs for St. Moritz delivery today?',
          time: '09:05 UTC',
        },
        {
          sender: 'agent',
          text: 'Good morning Mr. Croft. Yes, courier dispatch tracking #CH-ARM-99104 shows delivery vehicle en route with estimated arrival at your chalet at 14:00 UTC.',
          time: '09:08 UTC',
        },
      ],
    },
    {
      id: 'QRY-8802',
      client: 'Victoria Habsburg',
      account: 'FNV-CUST-8850',
      channel: 'Private RM Portal',
      preview: 'Requesting dual-authorization protocol details for $1.8M wire...',
      time: '25 mins ago',
      messages: [
        {
          sender: 'client',
          text: 'We are releasing the Vienna estate escrow of $1.8M USD via FedNow / SWIFT. Do I need my YubiKey hardware key for dual sign-off?',
          time: '08:50 UTC',
        },
      ],
    },
  ]);

  const [activeQuery, setActiveQuery] = useState<ClientQuery>(queries[0]);
  const [replyText, setReplyText] = useState('');

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    const newMsg = {
      sender: 'agent' as const,
      text: replyText,
      time: new Date().toLocaleTimeString() + ' UTC',
    };
    const updated = {
      ...activeQuery,
      messages: [...activeQuery.messages, newMsg],
    };
    setActiveQuery(updated);
    setQueries((prev) => prev.map((q) => (q.id === activeQuery.id ? updated : q)));
    setReplyText('');
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Live Concierge
            </span>
            <span className="text-xs text-[#D4A017]">High-Touch Client Communications</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Customer Queries
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Real-time encrypted message channels with accredited private wealth clients, relationship managers, and family offices.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Channel Security</span>
          <span className="text-sm font-bold text-[#F5C542]">Signal Protocol E2EE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Query List */}
        <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-3">
          <h3 className="text-sm font-bold text-[#F5C542] pb-2 border-b border-[#D4A017]/20 flex items-center gap-2">
            <MessageSquare size={16} /> Live Inbound Threads
          </h3>

          <div className="space-y-2">
            {queries.map((q) => (
              <button
                key={q.id}
                onClick={() => setActiveQuery(q)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  activeQuery.id === q.id
                    ? 'bg-gradient-to-br from-[#301B05] to-[#4A2C0A] border-[#F5C542] shadow-lg'
                    : 'bg-[#141414] border-[#D4A017]/20 hover:border-[#D4A017]/60'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-[#FFF8E7]">
                  <span>{q.client}</span>
                  <span className="text-[10px] text-[#D4A017] font-normal">{q.time}</span>
                </div>
                <p className="text-[11px] text-[#FAF7F0]/70 line-clamp-1 mt-1">{q.preview}</p>
                <span className="text-[10px] text-[#6B7280] block mt-1">{q.channel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Message Thread */}
        <div className="lg:col-span-2 rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg flex flex-col h-[520px]">
          <div className="pb-3 border-b border-[#D4A017]/20 flex items-center justify-between">
            <div>
              <span className="font-bold text-[#FFF8E7] text-sm">{activeQuery.client}</span>
              <p className="text-[11px] text-[#D4A017]">{activeQuery.account} • {activeQuery.channel}</p>
            </div>
            <span className="text-[10px] text-[#F5C542] bg-[#301B05] px-2.5 py-1 rounded-full border border-[#D4A017]/40">
              Verified Tier 3 Client
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2">
            {activeQuery.messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-3.5 text-xs ${
                    m.sender === 'agent'
                      ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-medium'
                      : 'bg-[#141414] border border-[#D4A017]/30 text-[#FAF7F0]'
                  }`}
                >
                  <p>{m.text}</p>
                  <span
                    className={`block text-[10px] mt-1 text-right ${
                      m.sender === 'agent' ? 'text-[#111111]/70' : 'text-[#6B7280]'
                    }`}
                  >
                    {m.time}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendReply();
            }}
            className="pt-3 border-t border-[#D4A017]/20 flex items-center gap-2"
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type verified concierge reply..."
              className="flex-1 bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold hover:brightness-110 shadow-lg flex items-center gap-1.5"
            >
              <Send size={13} /> Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
