import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Zap,
  Sliders,
  RefreshCw,
  Copy,
  Check,
  BrainCircuit,
  FileText,
  AlertTriangle,
  Database,
  ShieldAlert,
  BookOpen,
} from 'lucide-react';
import { UserRole } from '../../data/finovaDatasets';
import { supabase } from '../../lib/supabase';
import { invokeFinovaAiChat } from '../../services/finovaAiClient';
import {
  checkRagHealth,
  RagApiError,
  RagHealthResponse,
  RagSourceDocument,
  sendRagMessage,
} from '../../services/ragService';
import {
  fetchAiConfigurationResultFromDb,
  DEFAULT_AI_CONFIGURATION,
  AiConfiguration,
} from '../../services/finovaDatabase';

interface FinovaAiAssistantPageProps {
  currentRole: UserRole;
  userName: string;
  onNavigate?: (route: string) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  engineMode?: 'rag' | 'telemetry';
  verifiedRole?: string;
  found?: boolean;
  sources?: RagSourceDocument[];
  sourceDocuments?: string[];
  sourcePages?: number[];
  contextWarning?: boolean;
  isError?: boolean;
  telemetry?: {
    model: string;
    latencyMs: number;
    tokensPrompt: number;
    tokensCompletion: number;
    groundingConfidence: number;
  };
}

const FinovaAiAssistantPage: React.FC<FinovaAiAssistantPageProps> = ({
  currentRole,
  userName,
  onNavigate,
}) => {
  const [engineMode, setEngineMode] = useState<'rag' | 'telemetry'>('rag');
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeConfig, setActiveConfig] = useState<AiConfiguration>(DEFAULT_AI_CONFIGURATION);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [ragHealth, setRagHealth] = useState<RagHealthResponse | null>(null);
  const [ragErrorBanner, setRagErrorBanner] = useState<string | null>(null);

  // STRICT SECURITY: Only ADMIN may access document upload/update/delete management.
  // SUPER_ADMIN, FINANCE_ANALYST, SUPPORT_EXECUTIVE, and CUSTOMER never see management controls.
  const isAdminOnly = currentRole === 'ADMIN';

  const buildInitialMessages = (modelLabel: string): Message[] => [
    {
      id: 'msg-1',
      sender: 'assistant',
      text: `Greetings, ${userName}. Finova AI Assistant is ready for your ${currentRole.replace('_', ' ')} clearance. In Policy RAG mode, queries call the deployed Banking Policy RAG backend (POST /chat) and retrieve citations strictly from documents authorized for your backend-verified role.`,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
      engineMode: 'rag',
      verifiedRole: currentRole,
      found: true,
    },
  ];

  const [messages, setMessages] = useState<Message[]>(() =>
    buildInitialMessages(DEFAULT_AI_CONFIGURATION.model || 'Finova-Sentinel-Ultra-4.2')
  );

  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const [cfgRes, healthRes] = await Promise.allSettled([
          fetchAiConfigurationResultFromDb(),
          checkRagHealth(),
        ]);
        if (cfgRes.status === 'fulfilled') {
          setActiveConfig(cfgRes.value.config);
        }
        if (healthRes.status === 'fulfilled') {
          setRagHealth(healthRes.value);
        }
      } catch {
        // Keep safe defaults
      }
    };

    loadInitialState();
  }, [currentRole]);

  const loadTelemetryHistory = async () => {
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
          const mapped: Message[] = history.map((m: any) => ({
            id: m.id,
            sender: m.role === 'user' ? 'user' : 'assistant',
            text: m.content,
            timestamp: new Date(m.created_at).toLocaleTimeString() + ' UTC',
            engineMode: 'telemetry',
            telemetry: m.telemetry
              ? {
                  model: m.telemetry.model || 'gemini-4-hydrogen',
                  latencyMs: Number(m.telemetry.latencyMs || 0),
                  tokensPrompt: Number(m.telemetry.usage?.promptTokenCount || 0),
                  tokensCompletion: Number(m.telemetry.usage?.candidatesTokenCount || 0),
                  groundingConfidence: (m.citations?.length ?? 0) > 0 ? 99.5 : 88.0,
                }
              : undefined,
          }));
          setMessages([...buildInitialMessages(activeConfig.model), ...mapped]);
        }
      }
    } catch (err) {
      console.warn('Failed to load telemetry chat history:', err);
    }
  };

  const quickPrompts =
    engineMode === 'rag'
      ? [
          {
            title: 'Account Closure Policy',
            prompt: 'What is the account closure process?',
            tag: 'Policy RAG',
          },
          {
            title: 'AML Escalation Rules',
            prompt: 'What are the mandatory escalation thresholds for suspicious AML activity?',
            tag: 'Compliance',
          },
          {
            title: 'KYC Document Rules',
            prompt: 'Which verification documents are required for institutional customer onboarding?',
            tag: 'KYC',
          },
          {
            title: 'Wire Approval Controls',
            prompt: 'What dual-authorization controls apply to high-value wire transfers?',
            tag: 'Treasury',
          },
        ]
      : [
          {
            title: 'Operational Summary',
            prompt: 'Summarize live settlement volumes, multi-currency exposure, and operational queue status within my authorized scope.',
            tag: 'Live Telemetry',
          },
          {
            title: 'Forensic AML Scan',
            prompt: 'Report current fraud/AML flagged case counts and prevented escrow volume within my authorized scope.',
            tag: 'Forensics',
          },
          {
            title: 'SLA & Ticket Status',
            prompt: 'Report current support ticket backlog, open queues, and SLA compliance percentage.',
            tag: 'Operations',
          },
          {
            title: 'Policy & KYC Check',
            prompt: 'Summarize indexed institutional compliance policies and current KYC verification counts.',
            tag: 'Compliance',
          },
        ];

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isGenerating) return;

    setRagErrorBanner(null);

    if (engineMode === 'rag' && query.length < 3) {
      setRagErrorBanner('Policy questions must be at least 3 characters long.');
      return;
    }

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
      engineMode,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsGenerating(true);

    try {
      if (engineMode === 'rag') {
        const res = await sendRagMessage(query);
        const aiMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          text: res.answer || '',
          timestamp: new Date().toLocaleTimeString() + ' UTC',
          engineMode: 'rag',
          verifiedRole: res.role,
          found: res.found,
          sources: res.sources,
          sourceDocuments: res.source_documents,
          sourcePages: res.source_pages,
          contextWarning: res.context_warning,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session) {
          throw new Error('Institutional session required. Please re-authenticate.');
        }

        const startTime = Date.now();
        const data = await invokeFinovaAiChat(session.access_token, {
          message: query,
          thread_id: threadId,
        });

        if (data.thread_id) {
          setThreadId(data.thread_id);
        }

        const aiMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          text: data.answer || 'Finova AI encountered a synchronization anomaly.',
          timestamp: new Date().toLocaleTimeString() + ' UTC',
          engineMode: 'telemetry',
          telemetry: {
            model: data.model || 'gemini-4-hydrogen',
            latencyMs: data.latencyMs || Date.now() - startTime,
            tokensPrompt: data.usage?.promptTokenCount || 0,
            tokensCompletion: data.usage?.candidatesTokenCount || 0,
            groundingConfidence: (data.citations?.length ?? 0) > 0 ? 99.5 : 88.0,
          },
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err: any) {
      const msg =
        err instanceof RagApiError
          ? `HTTP ${err.status}: ${err.detail}`
          : err?.message || 'The AI gateway request could not be completed.';
      setRagErrorBanner(msg);
      const errMsg: Message = {
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        text: msg,
        timestamp: new Date().toLocaleTimeString() + ' UTC',
        engineMode,
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#D4A017]">
            <span className="font-bold text-[#F5C542]">Role-Scoped Banking Policy RAG</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <Zap size={12} className="text-[#F5C542]" /> {activeConfig.model}
            </span>
            {ragHealth && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#9CA3AF]">
                  RAG Indexes: {ragHealth.indexes_built}/{ragHealth.indexes_total}
                </span>
              </>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Finova AI Assistant
          </h1>
          <p className="font-mono text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Role-scoped banking policy Q&amp;A grounded with verified citations, source page numbers, and prompt-injection protection.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[#141414] p-1 rounded-xl border border-[#D4A017]/30 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                setEngineMode('rag');
                setRagErrorBanner(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                engineMode === 'rag' ? 'bg-[#D4A017] text-[#111111]' : 'text-[#D4A017] hover:text-[#FFF8E7]'
              }`}
            >
              Policy RAG (Railway)
            </button>
            <button
              type="button"
              onClick={() => {
                setEngineMode('telemetry');
                setRagErrorBanner(null);
                loadTelemetryHistory();
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                engineMode === 'telemetry' ? 'bg-[#D4A017] text-[#111111]' : 'text-[#D4A017] hover:text-[#FFF8E7]'
              }`}
            >
              Telemetry Copilot
            </button>
          </div>

          {isAdminOnly && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('/admin/knowledge-base')}
              className="flex items-center gap-1.5 bg-[#262626] hover:bg-[#301B05] px-3.5 py-2 rounded-xl border border-[#D4A017]/50 text-xs font-mono font-bold text-[#F5C542] transition-colors whitespace-nowrap"
            >
              <Database size={14} />
              <span>Knowledge Base</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-[#141414] px-3.5 py-2 rounded-xl border border-[#D4A017]/30 text-xs font-mono text-[#F5C542] whitespace-nowrap">
            <BrainCircuit size={16} />
            <span>Clearance: {currentRole.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {ragErrorBanner && (
        <div className="rounded-xl p-3.5 bg-[#2D0A0A] border border-[#EF4444]/60 text-[#FCA5A5] font-mono text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-[#EF4444]" />
            <span>{ragErrorBanner}</span>
          </div>
          <button type="button" onClick={() => setRagErrorBanner(null)} className="underline text-[11px] shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Grid: Main Chat + Model Controls & Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Interactive Chat Engine (3 cols) */}
        <div className="lg:col-span-3 rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex flex-col h-[650px]">
          <div className="flex items-center justify-between pb-3 border-b border-[#D4A017]/20 text-xs font-mono">
            <div className="flex items-center gap-2 text-[#D4A017]">
              <span className="font-bold">
                {engineMode === 'rag'
                  ? 'Active Session · Railway Policy RAG (POST /chat)'
                  : 'Active Session · Tenant & Role Telemetry Copilot'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMessages(buildInitialMessages(activeConfig.model));
                setThreadId(null);
                setRagErrorBanner(null);
              }}
              className="text-[#9CA3AF] hover:text-[#FFF8E7] flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={12} /> Clear Session
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2 font-mono text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#D4A017] to-[#F5C542] flex items-center justify-center text-[#111111] shrink-0 font-bold shadow-[0_0_10px_rgba(212,160,23,0.3)]">
                    <Bot size={16} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 border transition-all space-y-2.5 ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-br from-[#301B05] to-[#4A2C0A] border-[#D4A017]/50 text-[#FFF8E7]'
                      : m.isError
                      ? 'bg-[#2D0A0A]/80 border-[#EF4444]/60 text-[#FCA5A5]'
                      : 'bg-[#141414] border-[#D4A017]/30 text-[#FAF7F0]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-[10px] text-[#D4A017]/80">
                    <span className="font-bold">
                      {m.sender === 'user'
                        ? userName
                        : m.engineMode === 'rag'
                        ? `Finova Policy RAG (${m.verifiedRole || currentRole})`
                        : `Finova AI (${m.telemetry?.model || 'Gateway'})`}
                    </span>
                    <span>{m.timestamp}</span>
                  </div>

                  {/* Prompt Injection Context Warning Alert */}
                  {m.contextWarning && (
                    <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/60 text-amber-200 flex items-start gap-2 text-[11px]">
                      <ShieldAlert size={14} className="shrink-0 mt-0.5 text-amber-400" />
                      <span>
                        <strong>Security Context Warning:</strong> Retrieved source text contained instruction-like content. Output was strictly constrained to policy facts.
                      </span>
                    </div>
                  )}

                  {/* Empty / Not Found State */}
                  {m.sender === 'assistant' && m.engineMode === 'rag' && m.found === false && !m.isError && (
                    <div className="p-2.5 rounded-lg bg-[#1A1A1A] border border-[#3A3A3A] text-[#E6C78B] text-[11px] flex items-start gap-2">
                      <BookOpen size={14} className="shrink-0 mt-0.5 text-[#D4A017]" />
                      <span>
                        No direct answer was found inside indexed policy documents permitted for your verified role ({m.verifiedRole || currentRole}).
                      </span>
                    </div>
                  )}

                  {/* Answer Text */}
                  <div className="whitespace-pre-line leading-relaxed text-[12px]">
                    {m.text || (m.found === false ? 'No supporting policy excerpt was located for your question.' : '')}
                  </div>

                  {/* Sources & Page Citations */}
                  {m.sender === 'assistant' && m.engineMode === 'rag' && !m.isError && (
                    (() => {
                      const sourceItems: RagSourceDocument[] =
                        m.sources && m.sources.length > 0
                          ? m.sources
                          : (m.sourceDocuments || []).map((doc) => ({
                              document: doc,
                              pages: m.sourcePages || [],
                            }));
                      if (sourceItems.length === 0) return null;
                      return (
                        <div className="pt-2.5 border-t border-[#D4A017]/20 space-y-1.5">
                          <div className="text-[10px] font-bold text-[#E6C78B] flex items-center gap-1.5">
                            <FileText size={12} className="text-[#D4A017]" />
                            <span>Cited Policy Sources &amp; Page Numbers</span>
                          </div>
                          <div className="space-y-1">
                            {sourceItems.map((src, idx) => (
                              <div
                                key={`${src.document}-${idx}`}
                                className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] text-[11px]"
                              >
                                <span className="text-[#FAF7F0] font-semibold truncate">{src.document}</span>
                                <span className="text-[#F5C542] tabular-nums">
                                  {src.pages && src.pages.length > 0
                                    ? `Pages: ${src.pages.join(', ')}`
                                    : 'Page reference unavailable'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {m.sender === 'assistant' && !m.isError && (
                    <div className="pt-2 border-t border-[#D4A017]/20 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#9CA3AF]">
                      {m.telemetry ? (
                        <div className="flex items-center gap-3 tabular-nums">
                          <span>Latency: {m.telemetry.latencyMs}ms</span>
                          <span>Confidence: {m.telemetry.groundingConfidence}%</span>
                          <span>Tokens: {m.telemetry.tokensPrompt + m.telemetry.tokensCompletion}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>Verified Role: {m.verifiedRole || currentRole}</span>
                          <span aria-hidden="true">·</span>
                          <span>{m.found === false ? 'Unmatched Query' : 'Policy Grounded'}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(m.id, m.text)}
                        className="text-[#D4A017] hover:text-[#F5C542] flex items-center gap-1"
                      >
                        {copiedId === m.id ? <Check size={11} /> : <Copy size={11} />}
                        {copiedId === m.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#D4A017] to-[#F5C542] flex items-center justify-center text-[#111111] shrink-0 font-bold">
                  <Bot size={16} className="animate-spin" />
                </div>
                <div className="p-4 rounded-2xl bg-[#141414] border border-[#D4A017]/30 text-xs font-mono text-[#D4A017] flex items-center gap-2">
                  <Sparkles size={14} className="animate-pulse" />
                  <span>
                    {engineMode === 'rag'
                      ? 'Retrieving role-authorized policy citations from RAG engine...'
                      : 'Querying role-scoped telemetry & vector context...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="pt-3 border-t border-[#D4A017]/20 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                engineMode === 'rag'
                  ? 'Ask a banking policy question (e.g., What is the account closure process?)...'
                  : 'Ask Finova AI about authorized transactions, fraud risks, KYC, or support SLAs...'
              }
              className="flex-1 bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-3 text-xs font-mono text-[#FAF7F0] focus:outline-none focus:border-[#F5C542] placeholder-[#6B7280]"
            />
            <button
              type="submit"
              disabled={isGenerating || !input.trim()}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-[0_0_15px_rgba(212,160,23,0.35)] transition-all flex items-center gap-2 disabled:opacity-40"
            >
              <Send size={14} /> Send
            </button>
          </form>
        </div>

        {/* Right: Presets & Read-Only Governance Configuration Summary */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-[#D4A017] font-bold">
              <Sparkles size={16} />
              <span>{engineMode === 'rag' ? 'Policy RAG Prompts' : 'Operational Prompts'}</span>
            </div>
            <p className="text-[11px] text-[#9CA3AF]">
              Execute backend role-verified queries:
            </p>

            <div className="space-y-2 pt-1">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(p.prompt)}
                  className="w-full text-left p-3 rounded-xl bg-[#141414] border border-[#D4A017]/20 hover:border-[#F5C542] hover:bg-[#301B05]/40 transition-all group"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#D4A017] font-bold mb-1">
                    <span>{p.title}</span>
                    <span className="text-[9px] text-[#9CA3AF]">{p.tag}</span>
                  </div>
                  <p className="text-[11px] text-[#FAF7F0]/75 line-clamp-2 group-hover:text-[#FFF8E7]">
                    {p.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-[#D4A017] font-bold">
              <Sliders size={16} />
              <span>Platform Engine Policy</span>
            </div>
            <p className="text-[10px] text-[#9CA3AF]">
              Enforced strictly server-side using your verified Supabase access token. Role fields are never sent from the browser.
            </p>

            <div className="pt-2 border-t border-[#D4A017]/20 space-y-2 text-[11px] tabular-nums">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Active Profile:</span>
                <span className="text-[#FFF8E7] font-bold">{activeConfig.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Precision Temperature:</span>
                <span className="text-[#F5C542] font-bold">{activeConfig.temperature.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Hallucination Filter:</span>
                <span className="text-[#FFF8E7]">{activeConfig.hallucinationFilter ? 'Active' : 'Standard'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">SOC-2 PII Guardrail:</span>
                <span className="text-[#E6C78B] font-bold">{activeConfig.guardrailActive ? 'Enforced' : 'Standard'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinovaAiAssistantPage;
