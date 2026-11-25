import React, { useState, useEffect, useCallback } from 'react';
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
  BookOpen,
} from 'lucide-react';
import { UserRole } from '../../data/finovaDatasets';
import { supabase } from '../../lib/supabase';
import { invokeFinovaAiChat } from '../../services/finovaAiClient';
import { checkRagHealth, RagHealthResponse, RagSourceDocument } from '../../services/ragService';
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
  verifiedRole?: string;
  found?: boolean;
  sources?: RagSourceDocument[];
  isError?: boolean;
  telemetry?: {
    model: string;
    latencyMs: number;
    tokensPrompt: number;
    tokensCompletion: number;
  };
}

type QuickPrompt = { title: string; prompt: string; tag: string };

/** Common questions every role may ask */
const COMMON_PROMPTS: QuickPrompt[] = [
  { title: 'Using Finova', prompt: 'How do I use the Finova website and change the dashboard date range?', tag: 'Common' },
  { title: 'Report Fraud', prompt: 'How do I report an unauthorised transaction?', tag: 'Common' },
];

/** Role-specific suggestions, matching each role's assistant topic scope */
const ROLE_PROMPTS: Record<string, QuickPrompt[]> = {
  SUPER_ADMIN: [
    { title: 'Platform KPIs', prompt: 'Summarize the platform-wide KPIs: settled volume, MRR, active users and compliance score.', tag: 'Platform' },
    { title: 'Tenant Overview', prompt: 'Give an overview of the bank workspaces on the platform and their status.', tag: 'Platform' },
    { title: 'Platform Risk', prompt: 'What is the current platform risk exposure score and what does it mean?', tag: 'Platform' },
  ],
  ADMIN: [
    { title: 'Operations Summary', prompt: 'Summarize live transaction volumes, fraud workload, KYC backlog and support queues for my bank.', tag: 'Live Data' },
    { title: 'Fraud Cases vs Policy', prompt: 'How many fraud cases are flagged, and what does the fraud handling procedure say should happen to critical-risk cases?', tag: 'Policy + Data' },
    { title: 'SLA vs Policy', prompt: 'Report the support SLA compliance and compare it with the SLA targets in our support policy.', tag: 'Policy + Data' },
    { title: 'Wire Approval Controls', prompt: 'What dual-authorization controls apply to high-value wire transfers?', tag: 'Policy' },
  ],
  FINANCE_ANALYST: [
    { title: 'Flagged Fraud Cases', prompt: 'How many fraud cases are flagged and what is the risk tier breakdown?', tag: 'Fraud' },
    { title: 'AML Escalation Rules', prompt: 'What are the mandatory escalation thresholds for suspicious AML activity?', tag: 'AML' },
    { title: 'Critical Case Handling', prompt: 'What must happen to a fraud case with a risk score of 80 or above?', tag: 'Fraud' },
    { title: 'Wire Approval Controls', prompt: 'What dual-authorization controls apply to high-value wire transfers?', tag: 'Fraud' },
  ],
  SUPPORT_EXECUTIVE: [
    { title: 'Ticket Backlog & SLA', prompt: 'What is the current support ticket backlog and SLA compliance?', tag: 'Support' },
    { title: 'SLA Targets', prompt: 'What are the response and resolution targets for each ticket priority?', tag: 'Support' },
    { title: 'Escalation Matrix', prompt: 'When and how should a complaint be escalated?', tag: 'Support' },
    { title: 'Account Closure Steps', prompt: 'What steps do I follow when a customer asks to close their account?', tag: 'Support' },
  ],
  CUSTOMER: [
    { title: 'My Transactions', prompt: 'Summarize my recent transactions.', tag: 'My Account' },
    { title: 'My Support Tickets', prompt: 'What is the status of my support tickets?', tag: 'My Account' },
    { title: 'KYC Documents', prompt: 'Which documents do I need for KYC verification?', tag: 'Policy' },
    { title: 'Close My Account', prompt: 'How do I close my account?', tag: 'Policy' },
  ],
};

/** Group stored per-chunk citations ({title, page}) into {document, pages[]} */
function citationsToSources(citations: any[] | null | undefined): RagSourceDocument[] {
  const map = new Map<string, Set<number>>();
  for (const c of citations || []) {
    const title = String(c?.title || c?.metadata?.title || 'Policy document');
    const page = Number(c?.page || c?.metadata?.page || 1);
    if (!map.has(title)) map.set(title, new Set());
    map.get(title)!.add(page);
  }
  return [...map.entries()].map(([document, pages]) => ({
    document,
    pages: [...pages].sort((a, b) => a - b),
  }));
}

const nowStamp = () => new Date().toLocaleTimeString() + ' UTC';

const FinovaAiAssistantPage: React.FC<FinovaAiAssistantPageProps> = ({
  currentRole,
  userName,
  onNavigate,
}) => {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeConfig, setActiveConfig] = useState<AiConfiguration>(DEFAULT_AI_CONFIGURATION);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [kbHealth, setKbHealth] = useState<RagHealthResponse | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Only ADMIN manages Knowledge Base documents (server enforces this as well)
  const isAdminOnly = currentRole === 'ADMIN';

  const buildInitialMessages = useCallback(
    (): Message[] => [
      {
        id: 'msg-1',
        sender: 'assistant',
        text: `Greetings, ${userName}. Finova AI Assistant is ready for your ${currentRole.replace('_', ' ')} clearance. Ask about banking policies (answers cite the policy documents your role is authorized to see) or about live operational data such as transactions, fraud, KYC and support SLAs.`,
        timestamp: nowStamp(),
        verifiedRole: currentRole,
        found: true,
      },
    ],
    [currentRole, userName]
  );

  const [messages, setMessages] = useState<Message[]>(() => buildInitialMessages());

  const loadHistory = useCallback(async () => {
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

      if (!threads || threads.length === 0) return;
      const latestThreadId = threads[0].id;
      setThreadId(latestThreadId);

      const { data: history } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('thread_id', latestThreadId)
        .order('created_at', { ascending: true });

      if (history && history.length > 0) {
        const mapped: Message[] = history.map((m: any) => {
          const sources = citationsToSources(m.citations);
          return {
            id: m.id,
            sender: m.role === 'user' ? 'user' : 'assistant',
            text: m.content,
            timestamp: new Date(m.created_at).toLocaleTimeString() + ' UTC',
            sources,
            found: sources.length > 0,
            telemetry: m.telemetry
              ? {
                  model: m.telemetry.model || 'Gemini',
                  latencyMs: Number(m.telemetry.latencyMs || 0),
                  tokensPrompt: Number(m.telemetry.usage?.promptTokenCount || 0),
                  tokensCompletion: Number(m.telemetry.usage?.candidatesTokenCount || 0),
                }
              : undefined,
          };
        });
        setMessages([...buildInitialMessages(), ...mapped]);
      }
    } catch (err) {
      console.warn('Failed to load assistant chat history:', err);
    }
  }, [buildInitialMessages]);

  useEffect(() => {
    const loadInitialState = async () => {
      const [cfgRes, healthRes] = await Promise.allSettled([
        fetchAiConfigurationResultFromDb(),
        checkRagHealth(),
      ]);
      if (cfgRes.status === 'fulfilled') setActiveConfig(cfgRes.value.config);
      if (healthRes.status === 'fulfilled') setKbHealth(healthRes.value);
    };
    loadInitialState();
    loadHistory();
  }, [currentRole, loadHistory]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isGenerating) return;
    setErrorBanner(null);

    setMessages((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, sender: 'user', text: query, timestamp: nowStamp() },
    ]);
    setInput('');
    setIsGenerating(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) throw new Error('Institutional session required. Please re-authenticate.');

      const startTime = Date.now();
      const data = await invokeFinovaAiChat(session.access_token, { message: query, thread_id: threadId });
      if (data.thread_id) setThreadId(data.thread_id);

      const sources = data.sources && data.sources.length > 0 ? data.sources : citationsToSources(data.citations);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          text: data.answer || 'Finova AI returned an empty response.',
          timestamp: nowStamp(),
          verifiedRole: data.role || currentRole,
          found: data.found ?? sources.length > 0,
          sources,
          telemetry: {
            model: data.model || 'Gemini',
            latencyMs: data.latencyMs || Date.now() - startTime,
            tokensPrompt: data.usage?.promptTokenCount || 0,
            tokensCompletion: data.usage?.candidatesTokenCount || 0,
          },
        },
      ]);
    } catch (err: any) {
      const msg = err?.message || 'The AI gateway request could not be completed.';
      setErrorBanner(msg);
      setMessages((prev) => [
        ...prev,
        { id: `msg-err-${Date.now()}`, sender: 'assistant', text: msg, timestamp: nowStamp(), isError: true },
      ]);
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
            <span className="font-bold text-[#F5C542]">Policy Knowledge + Live Telemetry</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <Zap size={12} className="text-[#F5C542]" /> {activeConfig.model}
            </span>
            {kbHealth && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#9CA3AF]">
                  Knowledge Base roles ready: {kbHealth.indexes_built}/{kbHealth.indexes_total}
                </span>
              </>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Finova AI Assistant
          </h1>
          <p className="font-mono text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            One assistant for role-scoped policy answers with document and page citations, and live operational data for your authorized scope.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

      {errorBanner && (
        <div className="rounded-xl p-3.5 bg-[#2D0A0A] border border-[#EF4444]/60 text-[#FCA5A5] font-mono text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-[#EF4444]" />
            <span>{errorBanner}</span>
          </div>
          <button type="button" onClick={() => setErrorBanner(null)} className="underline text-[11px] shrink-0">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat (3 cols) */}
        <div className="lg:col-span-3 rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex flex-col h-[650px]">
          <div className="flex items-center justify-between pb-3 border-b border-[#D4A017]/20 text-xs font-mono">
            <span className="font-bold text-[#D4A017]">Active Session · Finova AI Assistant</span>
            <button
              type="button"
              onClick={() => {
                setMessages(buildInitialMessages());
                setThreadId(null);
                setErrorBanner(null);
              }}
              className="text-[#9CA3AF] hover:text-[#FFF8E7] flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={12} /> New Session
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2 font-mono text-xs">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                      {m.sender === 'user' ? userName : `Finova AI (${m.verifiedRole || currentRole})`}
                    </span>
                    <span>{m.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-line leading-relaxed text-[12px]">{m.text}</div>

                  {/* Cited knowledge-base sources */}
                  {m.sender === 'assistant' && !m.isError && m.sources && m.sources.length > 0 && (
                    <div className="pt-2.5 border-t border-[#D4A017]/20 space-y-1.5">
                      <div className="text-[10px] font-bold text-[#E6C78B] flex items-center gap-1.5">
                        <FileText size={12} className="text-[#D4A017]" />
                        <span>Cited Policy Sources &amp; Page Numbers</span>
                      </div>
                      <div className="space-y-1">
                        {m.sources.map((src, idx) => (
                          <div
                            key={`${src.document}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] text-[11px]"
                          >
                            <span className="text-[#FAF7F0] font-semibold truncate">{src.document}</span>
                            <span className="text-[#F5C542] tabular-nums">
                              {src.pages.length > 0 ? `Pages: ${src.pages.join(', ')}` : 'Page reference unavailable'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {m.sender === 'assistant' && !m.isError && m.id !== 'msg-1' && m.found === false && (
                    <div className="p-2 rounded-lg bg-[#1A1A1A] border border-[#3A3A3A] text-[#E6C78B] text-[10px] flex items-start gap-2">
                      <BookOpen size={12} className="shrink-0 mt-0.5 text-[#D4A017]" />
                      <span>No policy document authorized for your role matched this question; the answer uses live operational data only.</span>
                    </div>
                  )}

                  {m.sender === 'assistant' && !m.isError && m.id !== 'msg-1' && (
                    <div className="pt-2 border-t border-[#D4A017]/20 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#9CA3AF]">
                      {m.telemetry ? (
                        <div className="flex items-center gap-3 tabular-nums">
                          <span>Model: {m.telemetry.model}</span>
                          <span>Latency: {m.telemetry.latencyMs}ms</span>
                          <span>Tokens: {m.telemetry.tokensPrompt + m.telemetry.tokensCompletion}</span>
                        </div>
                      ) : (
                        <span>Verified Role: {m.verifiedRole || currentRole}</span>
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
                  <span>Searching authorized policies and live telemetry...</span>
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
              placeholder="Ask about a policy, or about transactions, fraud, KYC and support SLAs..."
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

        {/* Prompts & governance summary */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-[#D4A017] font-bold">
              <Sparkles size={16} />
              <span>Suggested Questions</span>
            </div>
            <div className="space-y-2 pt-1">
              {[...(ROLE_PROMPTS[currentRole] || ROLE_PROMPTS.CUSTOMER), ...COMMON_PROMPTS].map((p, idx) => (
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
                  <p className="text-[11px] text-[#FAF7F0]/75 line-clamp-2 group-hover:text-[#FFF8E7]">{p.prompt}</p>
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
              Enforced server-side using your verified Supabase session. Role and tenant are never taken from the browser.
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
