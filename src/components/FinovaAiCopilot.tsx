import React, { useState } from 'react';
import { FileText, ShieldAlert, BookOpen } from 'lucide-react';
import { FinovaLogo } from './FinovaLogo';
import { UserRole } from '../data/finovaDatasets';
import { supabase } from '../lib/supabase';
import { invokeFinovaAiChat } from '../services/finovaAiClient';
import { RagApiError, RagSourceDocument, sendRagMessage } from '../services/ragService';

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
  found?: boolean;
  verifiedRole?: string;
  sources?: RagSourceDocument[];
  sourceDocuments?: string[];
  sourcePages?: number[];
  contextWarning?: boolean;
  isError?: boolean;
  insights?: { label: string; value: string }[];
}

export const FinovaAiCopilot: React.FC<FinovaAiCopilotProps> = ({
  currentRole,
  userName,
  isOpen,
  onClose,
}) => {
  const [engineMode, setEngineMode] = useState<'rag' | 'telemetry'>('rag');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'ai',
      text: `Greetings, ${userName}. Finova AI is initialized for your ${currentRole.replace('_', ' ')} clearance. Policy RAG mode connects directly to the role-scoped RAG service (POST /chat) with cited source filenames and page numbers.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      found: true,
      insights: [
        { label: 'Role Clearance', value: currentRole.replace('_', ' ') },
        { label: 'RAG Mode', value: 'POST /chat' },
        { label: 'Guardrail Mode', value: 'Strict RBAC' },
      ],
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const QUICK_PROMPTS =
    engineMode === 'rag'
      ? [
          'What is the account closure process?',
          'Summarize KYC document verification requirements',
          'Explain high-risk AML escalation procedures',
          'What wire transfer controls apply to my role?',
        ]
      : [
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
      if (engineMode === 'rag') {
        if (query.length < 3) {
          throw new RagApiError(422, 'Question must be at least 3 characters.');
        }
        const res = await sendRagMessage(query);
        const citationsCount =
          res.sources.length > 0 ? res.sources.length : res.source_documents.length;

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: res.answer || 'No policy excerpt matched this question.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          found: res.found,
          verifiedRole: res.role,
          sources: res.sources,
          sourceDocuments: res.source_documents,
          sourcePages: res.source_pages,
          contextWarning: res.context_warning,
          insights: [
            { label: 'Verified Role', value: res.role },
            { label: 'Match State', value: res.found ? 'Found' : 'Not Found' },
            { label: 'Cited Docs', value: String(citationsCount) },
          ],
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
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
            { label: 'Intelligence', value: data.model || 'gemini-4-hydrogen' },
            { label: 'Latency', value: `${data.latencyMs || Date.now() - startTime}ms` },
            { label: 'Grounding', value: String(data.citations?.length || 0) },
          ],
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err: any) {
      const msg =
        err instanceof RagApiError
          ? `HTTP ${err.status}: ${err.detail}`
          : err?.message || 'The AI request failed.';
      const errMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: msg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
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
        <div className="p-4 bg-gradient-to-r from-[#111111] via-[#1E1E1E] to-[#111111] border-b border-[#D4A017]/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <FinovaLogo variant="compact" size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-cinzel text-sm font-bold text-[#FFF8E7] truncate">
                  Finova AI Copilot
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#D4A017]/80 truncate">
                {engineMode === 'rag'
                  ? 'Banking Policy RAG · Backend Role Enforced'
                  : 'Institutional Data & Live AML Telemetry'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-[#111111] p-0.5 rounded-lg border border-[#D4A017]/30 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setEngineMode('rag')}
                className={`px-2 py-1 rounded-md font-bold transition-colors ${
                  engineMode === 'rag' ? 'bg-[#D4A017] text-[#111111]' : 'text-[#D4A017]'
                }`}
              >
                Policy RAG
              </button>
              <button
                type="button"
                onClick={() => setEngineMode('telemetry')}
                className={`px-2 py-1 rounded-md font-bold transition-colors ${
                  engineMode === 'telemetry' ? 'bg-[#D4A017] text-[#111111]' : 'text-[#D4A017]'
                }`}
              >
                Telemetry
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[#111111] border border-[#D4A017]/30 text-[#D4A017] hover:text-[#FFF8E7] hover:bg-[#6B3E00]/40 flex items-center justify-center transition-colors font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#141414]/90">
          {messages.map((msg) => {
            const sourceList: RagSourceDocument[] =
              msg.sources && msg.sources.length > 0
                ? msg.sources
                : (msg.sourceDocuments || []).map((doc) => ({
                    document: doc,
                    pages: msg.sourcePages || [],
                  }));

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  {msg.sender === 'ai' ? (
                    <span className="font-cinzel text-xs font-bold text-[#F5C542]">
                      FINOVA AI
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-[#D4A017]/80">{userName}</span>
                  )}
                  <span className="text-[10px] font-mono text-[#6B7280]">{msg.timestamp}</span>
                </div>

                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed whitespace-pre-line space-y-2 ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-medium shadow-[0_4px_16px_rgba(212,160,23,0.3)]'
                      : msg.isError
                      ? 'bg-[#2D0A0A] text-[#FCA5A5] border border-[#EF4444]/60'
                      : 'bg-[#1E1E1E] text-[#FAF7F0] border border-[#D4A017]/30 shadow-[0_4px_16px_rgba(0,0,0,0.5)]'
                  }`}
                >
                  {msg.contextWarning && (
                    <div className="p-2 rounded-lg bg-amber-950/70 border border-amber-500/60 text-amber-200 flex items-center gap-1.5 text-[11px]">
                      <ShieldAlert size={13} className="shrink-0 text-amber-400" />
                      <span>Context Warning: Prompt injection text detected &amp; ignored.</span>
                    </div>
                  )}

                  {msg.found === false && !msg.isError && (
                    <div className="p-2 rounded-lg bg-[#141414] border border-[#3A3A3A] text-[#E6C78B] flex items-center gap-1.5 text-[11px]">
                      <BookOpen size={13} className="shrink-0 text-[#D4A017]" />
                      <span>No matching excerpt found in documents permitted for your role.</span>
                    </div>
                  )}

                  <div>{msg.text}</div>

                  {sourceList.length > 0 && (
                    <div className="pt-2 border-t border-[#D4A017]/20 space-y-1 font-mono text-[10px]">
                      <div className="text-[#E6C78B] font-bold flex items-center gap-1">
                        <FileText size={11} className="text-[#D4A017]" />
                        <span>Cited Sources</span>
                      </div>
                      {sourceList.map((s, idx) => (
                        <div key={`${s.document}-${idx}`} className="flex justify-between gap-2 text-[#FAF7F0]/90">
                          <span className="truncate">{s.document}</span>
                          <span className="text-[#F5C542] shrink-0 tabular-nums">
                            {s.pages.length > 0 ? `p. ${s.pages.join(', ')}` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.insights && (
                    <div className="mt-2 pt-2 border-t border-[#D4A017]/20 grid grid-cols-3 gap-2">
                      {msg.insights.map((ins, i) => (
                        <div
                          key={i}
                          className="bg-[#111111] p-1.5 rounded-lg border border-[#D4A017]/25 text-center"
                        >
                          <p className="text-[9px] font-mono text-[#D4A017]/70 uppercase">{ins.label}</p>
                          <p className="font-mono text-xs font-bold text-[#F5C542] mt-0.5 truncate">{ins.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs font-mono text-[#D4A017]">
              <span className="w-2 h-2 rounded-full bg-[#F5C542] animate-ping" />
              {engineMode === 'rag'
                ? 'Querying role-scoped Policy RAG API...'
                : 'Finova Neural Engine synthesizing datasets...'}
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="p-2.5 bg-[#181818] border-t border-[#D4A017]/20 flex gap-2 overflow-x-auto">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
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
            placeholder="Query Finova Policy RAG or telemetry..."
            className="flex-1 bg-[#1E1E1E] border border-[#D4A017]/40 rounded-xl px-3.5 py-2 text-xs text-[#FAF7F0] placeholder-[#6B7280] focus:outline-none focus:border-[#F5C542] font-mono"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 transition-all shadow-[0_0_15px_rgba(212,160,23,0.4)]"
          >
            Execute
          </button>
        </div>

        {/* Compliance Disclaimer */}
        <div className="px-3 py-1.5 bg-[#0D0D0D] border-t border-[#3A3A3A] text-[9px] font-mono text-[#9CA3AF] text-center">
          Policy RAG citations reflect role-authorized documents only. AML flags require compliance officer adjudication.
        </div>
      </div>
    </div>
  );
};
