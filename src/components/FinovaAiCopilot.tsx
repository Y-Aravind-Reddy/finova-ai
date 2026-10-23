import React, { useState } from 'react';
import { FinovaLogo } from './FinovaLogo';
import {
  ADMIN_DATASET,
  CUSTOMER_DATASET,
  FINANCE_ANALYST_DATASET,
  SUPPORT_DATASET,
  UserRole,
} from '../data/finovaDatasets';

interface FinovaAiCopilotProps {
  currentRole: UserRole;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  insights?: { label: string; value: string }[];
}

export const FinovaAiCopilot: React.FC<FinovaAiCopilotProps> = ({
  currentRole,
  userName,
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'ai',
      text: `Greetings, ${userName}. Finova AI Financial Intelligence Engine is online. System running at 99.992% uptime with direct integration to Bloomberg, SWIFT GPI, and Institutional Custody. How may I assist your financial decisions today?`,
      timestamp: '08:02 AM',
      insights: [
        { label: 'Audited YTD Revenue', value: '$84.62M' },
        { label: 'Fraud Intercepted', value: '$4.82M' },
        { label: 'System Threat Level', value: 'Nominal / L1' },
      ],
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const QUICK_PROMPTS = [
    'Analyze high-risk AML flagged transactions',
    'Evaluate private wealth credit utilization',
    'Report on SLA resolution compliance',
    'Institutional revenue growth projection',
  ];

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = '';
      let insights: { label: string; value: string }[] | undefined;

      const qLower = query.toLowerCase();

      if (qLower.includes('risk') || qLower.includes('aml') || qLower.includes('fraud')) {
        reply = `Forensic Analysis from cleaned_finance_analyst&fraud_pandas.xls:
• Total Monitored Capital: $248.91M across 842,190 transactions.
• Highest Priority Alert: TXN-FRAUD-994101 by Aegis Offshore Holdings ($1,240,000 USD, Risk Score 94/100). Status is currently FROZEN ESCROW due to Multi-Hop Velocity across non-equivalent jurisdictions.
• Total Confirmed Fraud Prevented: $4,821,500 with an ultra-low False Positive Rate of 0.12%.`;
        insights = [
          { label: 'Prevented Fraud', value: '$4.82M USD' },
          { label: 'Critical Cases', value: '142 Active' },
          { label: 'AI Confidence', value: '98.4%' },
        ];
      } else if (qLower.includes('credit') || qLower.includes('wealth') || qLower.includes('croft') || qLower.includes('customer')) {
        reply = `Private Wealth Dossier for Harrison Croft (FNV-CUST-8849) from cleaned_customer_data_pandas.xls:
• Liquid Cash Balance: $1,428,500.00 | Total Portfolio Value: $4,892,300.00.
• Credit Line: $250,000.00 Limit with $46,000.00 utilized (Optimal 18.4% utilization).
• Credit Score: 815 (Exceptional Sovereign Tier).
• KYC Status: Verified Tier 3 Accredited. All 5 sovereign vault documents in compliant order.`;
        insights = [
          { label: 'Net Liquidity', value: '$1.43M' },
          { label: 'Credit Score', value: '815 / 850' },
          { label: 'Utilization', value: '18.4%' },
        ];
      } else if (qLower.includes('sla') || qLower.includes('ticket') || qLower.includes('support')) {
        reply = `Support Operations Audit from Support Executive main FinTech.xlsx:
• Current Open Queue: 24 tickets (3 Urgent Wire Authorizations).
• Weekly Resolved Volume: 382 cases with an average resolution speed of 18.4 minutes.
• SLA Compliance: 99.2% with a premier CSAT benchmark of 4.94 / 5.0.`;
        insights = [
          { label: 'Average Speed', value: '18.4 mins' },
          { label: 'CSAT Rating', value: '4.94 / 5.0' },
          { label: 'Compliance', value: '99.2%' },
        ];
      } else if (qLower.includes('revenue') || qLower.includes('growth') || qLower.includes('admin')) {
        reply = `Executive System Health from cleaned_admin_data_pandas.xls:
• YTD Institutional Gross Revenue: $84,620,000 across 2.84M settlement runs.
• Active User Base: 124,310 private wealth and institutional users.
• System Resilience: 99.992% uptime with 22ms average latency across European and North American vault hubs.`;
        insights = [
          { label: 'Gross Revenue', value: '$84.62M YTD' },
          { label: 'Latency', value: '22ms' },
          { label: 'Active Base', value: '124,310' },
        ];
      } else {
        reply = `Finova AI Synthesis: Operating under strict regulatory standards. I have cross-correlated data from the 4 institutional ledgers (Admin, Customer Wealth, Fraud Forensics, Support Operations). 

Key Observation: System health is nominal at 99.992%. High-value escrow transactions are clearing via SWIFT GPI and FedNow with zero systemic breaches. Please specify if you require transaction tracing, compliance auditing, or portfolio allocation projections.`;
        insights = [
          { label: 'Model', value: 'Finova Sentinel 4.2' },
          { label: 'Latency', value: '18ms' },
          { label: 'Integrity', value: '100% Cryptographic' },
        ];
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        insights,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#1E1E1E] border border-[#F5C542]/50 rounded-2xl shadow-[0_20px_60px_rgba(212,160,23,0.35)] flex flex-col h-[640px] max-h-[90vh] overflow-hidden">
        {/* Modal Top Bar */}
        <div className="p-4 bg-gradient-to-r from-[#111111] via-[#1E1E1E] to-[#111111] border-b border-[#D4A017]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FinovaLogo variant="compact" size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-cinzel text-sm font-bold text-[#FFF8E7]">
                  Finova AI Executive Copilot
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#D4A017]/20 text-[#F5C542] border border-[#D4A017]/40">
                  Data. Intelligence. Better Decisions.
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#D4A017]/70">
                Connected to Institutional Data Repositories & Real-Time AML Engines
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#111111] border border-[#D4A017]/30 text-[#D4A017] hover:text-[#FFF8E7] hover:bg-[#6B3E00]/40 flex items-center justify-center transition-colors font-bold"
          >
            ✕
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#141414]/90">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                {msg.sender === 'ai' ? (
                  <span className="font-cinzel text-xs font-bold text-[#F5C542] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F5C542] shadow-[0_0_6px_#F5C542]" />
                    FINOVA AI
                  </span>
                ) : (
                  <span className="font-mono text-xs text-[#D4A017]/80">{userName}</span>
                )}
                <span className="text-[10px] font-mono text-[#6B7280]">{msg.timestamp}</span>
              </div>

              <div
                className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed whitespace-pre-line ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-medium shadow-[0_4px_16px_rgba(212,160,23,0.3)]'
                    : 'bg-[#1E1E1E] text-[#FAF7F0] border border-[#D4A017]/30 shadow-[0_4px_16px_rgba(0,0,0,0.5)]'
                }`}
              >
                {msg.text}

                {/* Insight Stat Badges */}
                {msg.insights && (
                  <div className="mt-3 pt-2.5 border-t border-[#D4A017]/20 grid grid-cols-3 gap-2">
                    {msg.insights.map((ins, i) => (
                      <div
                        key={i}
                        className="bg-[#111111] p-1.5 rounded-lg border border-[#D4A017]/25 text-center"
                      >
                        <p className="text-[9px] font-mono text-[#D4A017]/70 uppercase">{ins.label}</p>
                        <p className="font-mono text-xs font-bold text-[#F5C542] mt-0.5">{ins.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs font-mono text-[#D4A017]">
              <span className="w-2 h-2 rounded-full bg-[#F5C542] animate-ping" />
              Finova Neural Engine synthesizing datasets...
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="p-2.5 bg-[#181818] border-t border-[#D4A017]/20 flex gap-2 overflow-x-auto">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-[#111111] border border-[#D4A017]/30 text-[11px] font-mono text-[#D4A017] hover:text-[#FFF8E7] hover:border-[#F5C542] transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Box */}
        <div className="p-3 bg-[#111111] border-t border-[#D4A017]/30 flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Query Finova Intelligence (e.g., AML risks, portfolio, SLAs, revenue)..."
            className="flex-1 bg-[#1E1E1E] border border-[#D4A017]/40 rounded-xl px-3.5 py-2 text-xs text-[#FAF7F0] placeholder-[#6B7280] focus:outline-none focus:border-[#F5C542] font-mono"
          />
          <button
            onClick={() => handleSend()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 transition-all shadow-[0_0_15px_rgba(212,160,23,0.4)]"
          >
            Execute
          </button>
        </div>

        {/* Compliance & Heuristic Benchmark Disclaimer */}
        <div className="px-3 py-1.5 bg-[#0D0D0D] border-t border-[#3A3A3A] text-[9px] font-mono text-[#9CA3AF] text-center">
          Heuristic benchmark synthesis. Not legally binding or automated financial advice. AML flags require compliance officer adjudication.
        </div>
      </div>
    </div>
  );
};
