import React, { useState } from 'react';
import { FinovaLogo } from './FinovaLogo';
import { UserRole } from '../data/finovaDatasets';
import { supabase } from '../lib/supabase';
import { invokeFinovaAiChat } from '../services/finovaAiClient';

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
  const [threadId, setThreadId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const fetchHistory = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session) return;

        const { data: threads } = await supabase
          .from('ai_chat_threads')
          .select('id')
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (threads && threads.length > 0) {
          const latestThreadId = threads[0].id;
          setThreadId(latestThreadId);

          const { data: history } = await supabase
            .from('ai_chat_messages')
            .select('*')
            .eq('thread_id', latestThreadId)
            .order('created_at', { ascending: true });

          if (history && history.length > 0) {
            const initialAiMessage = messages[0];
            const mapped: ChatMessage[] = history.map((m: any) => ({
              id: m.id,
              sender: m.role === 'user' ? 'user' : 'ai',
              text: m.content,
              timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              insights: m.telemetry?.rag ? [{ label: 'Sources', value: String(m.telemetry.rag.chunk_count) }] : undefined,
            }));
            setMessages([initialAiMessage, ...mapped]);
          }
        }
      } catch (err) {
        console.warn('Failed to load copilot history:', err);
      }
    };

    fetchHistory();
  }, [isOpen, currentRole]);

  const QUICK_PROMPTS = [
    'Analyze high-risk AML flagged transactions',
    'Evaluate private wealth credit utilization',
    'Report on SLA resolution compliance',
    'Institutional revenue growth projection',
  ];


  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        throw new Error('Institutional session required. Please sign in.');
      }

      const startTime = Date.now();
      const data = await invokeFinovaAiChat(session.access_token, {
        message: query,
        thread_id: threadId,
      });

      if (data.thread_id) {
        setThreadId(data.thread_id);
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.answer || 'Finova AI encountered a synchronization anomaly.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        insights: [
          { label: 'Intelligence', value: data.model || 'Gemini 3.8' },
          { label: 'Latency', value: `${data.latencyMs || (Date.now() - startTime)}ms` },
          { label: 'Grounding', value: String(data.citations?.length || 0) },
        ],
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Copilot Critical Error:', err);
      const errMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: `**SECURITY ALERT:** ${err.message || 'The neural link was interrupted.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
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
