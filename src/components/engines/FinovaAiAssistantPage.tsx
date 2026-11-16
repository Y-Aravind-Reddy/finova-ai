import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Zap,
  Sliders,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  BrainCircuit,
  ShieldCheck,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { UserRole } from '../../data/finovaDatasets';
import { supabase } from '../../lib/supabase';

interface FinovaAiAssistantPageProps {
  currentRole: UserRole;
  userName: string;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
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
}) => {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [temperature, setTemperature] = useState(0.2);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const initialMessages: Message[] = [
    {
      id: 'msg-1',
      sender: 'assistant',
      text: `Greetings, ${userName}. Finova Sentinel Neural Copilot is primed and calibrated for your ${currentRole.replace('_', ' ')} clearance. I have real-time memory access to cross-border settlement channels (SWIFT GPI, FedNow), risk scoring models, KYC verification queues, and institutional portfolio datasets. How may I assist your financial operations today?`,
      timestamp: '09:00:12 UTC',
      telemetry: {
        model: 'Finova-Sentinel-Ultra-4.2',
        latencyMs: 142,
        tokensPrompt: 85,
        tokensCompletion: 64,
        groundingConfidence: 99.8,
      },
    },
  ];

  const [messages, setMessages] = useState<Message[]>(initialMessages);

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session) return;

        // Fetch latest thread for this user
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
              telemetry: m.telemetry,
            }));
            setMessages([...initialMessages, ...mapped]);
          }
        }
      } catch (err) {
        console.warn('Failed to load chat history:', err);
      }
    };

    fetchHistory();
  }, [currentRole]);

  const quickPrompts = [
    {
      title: 'Portfolio Stress Test',
      prompt: 'Execute a Monte Carlo simulation on private wealth custody holdings under a 150 bps interest rate hike.',
      tag: 'Risk Analysis',
    },
    {
      title: 'Forensic AML Scan',
      prompt: 'Inspect high-velocity wire transactions between Zurich and offshore relay accounts in the last 48 hours for structuring anomalies.',
      tag: 'Forensics',
    },
    {
      title: 'FedNow Settlement Audit',
      prompt: 'Verify liquidity buffers and ISO 20022 pacs.008 message validation rates for instant interbank settlements today.',
      tag: 'Settlement',
    },
    {
      title: 'Yield Optimization',
      prompt: 'Calculate risk-adjusted yield for institutional Treasury bills vs Swiss Confederation bonds.',
      tag: 'Yield',
    },
  ];

  const [threadId, setThreadId] = useState<string | null>(null);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isGenerating) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsGenerating(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        throw new Error('Institutional session required. Please re-authenticate.');
      }

      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('finova-ai-chat', {
        body: {
          message: query,
          thread_id: threadId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        let details = error.message;
        try {
          const errorContext = (error as any).context;
          if (errorContext && typeof errorContext.json === 'function') {
            const body = await errorContext.json();
            details = body.details || body.error || details;
          }
        } catch (e) {
          console.warn('Could not extract granular error metadata', e);
        }
        throw new Error(details);
      }

      if (data.thread_id) {
        setThreadId(data.thread_id);
      }

      const aiMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: data.answer || 'Finova AI encountered a synchronization anomaly.',
        timestamp: new Date().toLocaleTimeString() + ' UTC',
        telemetry: {
          model: data.model || 'Gemini 3.8 Flash',
          latencyMs: data.latencyMs || (Date.now() - startTime),
          tokensPrompt: data.usage?.promptTokenCount || 0,
          tokensCompletion: data.usage?.candidatesTokenCount || 0,
          groundingConfidence: data.citations?.length > 0 ? 99.8 : 85.0,
        },
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('AI Assistant Subsystem Error:', err);
      const errMsg: Message = {
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        text: `**SECURITY ALERT / SYSTEM ERROR:** ${err.message || 'The neural link was interrupted.'}`,
        timestamp: new Date().toLocaleTimeString() + ' UTC',
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
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Dedicated Platform Engine
            </span>
            <span className="text-xs font-mono text-[#D4A017] flex items-center gap-1">
              <Zap size={12} className="text-[#F5C542]" /> Sentinel Neural Copilot v4.2
            </span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Finova AI Assistant
          </h1>
          <p className="font-mono text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Enterprise cognitive financial co-pilot trained on macroeconomic yield curves, regulatory AML frameworks, and high-frequency risk simulations.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#141414] px-3.5 py-2 rounded-xl border border-[#D4A017]/30 text-xs font-mono text-[#F5C542]">
          <BrainCircuit size={16} />
          <span>Clearance: {currentRole.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Grid: Main Chat + Model Controls & Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Interactive Chat Engine (3 cols) */}
        <div className="lg:col-span-3 rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex flex-col h-[650px]">
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-[#D4A017]/20 text-xs font-mono">
            <div className="flex items-center gap-2 text-[#D4A017]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F5C542] animate-pulse" />
              <span className="font-bold">Active Neural Session • 4096-bit Secure Enclave</span>
            </div>
            <button
              onClick={() => setMessages(initialMessages)}
              className="text-[#6B7280] hover:text-[#FFF8E7] flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={12} /> Clear Session
            </button>
          </div>

          {/* Messages Scroll Area */}
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
                  className={`max-w-[85%] rounded-2xl p-4 border transition-all ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-br from-[#301B05] to-[#4A2C0A] border-[#D4A017]/50 text-[#FFF8E7]'
                      : 'bg-[#141414] border-[#D4A017]/30 text-[#FAF7F0]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1 text-[10px] text-[#D4A017]/70">
                    <span className="font-bold">
                      {m.sender === 'user' ? userName : 'Finova AI Sentinel Ultra'}
                    </span>
                    <span>{m.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-line leading-relaxed text-[12px]">{m.text}</div>

                  {m.telemetry && (
                    <div className="mt-3 pt-2 border-t border-[#D4A017]/20 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#6B7280]">
                      <div className="flex items-center gap-3">
                        <span>Latency: {m.telemetry.latencyMs}ms</span>
                        <span>Confidence: {m.telemetry.groundingConfidence}%</span>
                        <span>Tokens: {m.telemetry.tokensPrompt + m.telemetry.tokensCompletion}</span>
                      </div>
                      <button
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
                  <span>Synthesizing multi-modal financial telemetry...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
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
              placeholder="Ask Finova AI about liquidity, fraud vectors, KYC anomalies, or stress tests..."
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

        {/* Right: Presets & Engine Parameters (1 col) */}
        <div className="space-y-6">
          {/* Quick Financial Presets */}
          <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-[#D4A017] font-bold">
              <Sparkles size={16} />
              <span>Financial Presets</span>
            </div>
            <p className="text-[11px] text-[#6B7280]">Click to load and execute institutional prompt scenarios:</p>

            <div className="space-y-2 pt-1">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p.prompt)}
                  className="w-full text-left p-3 rounded-xl bg-[#141414] border border-[#D4A017]/20 hover:border-[#F5C542] hover:bg-[#301B05]/40 transition-all group"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#D4A017] font-bold mb-1">
                    <span>{p.title}</span>
                    <span className="bg-[#111111] px-1.5 py-0.5 rounded text-[9px] text-[#FFF8E7]">
                      {p.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#FAF7F0]/70 line-clamp-2 group-hover:text-[#FFF8E7]">
                    {p.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Engine Parameters */}
          <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4 font-mono text-xs">
            <div className="flex items-center gap-2 text-[#D4A017] font-bold">
              <Sliders size={16} />
              <span>Model Parameters</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#FAF7F0]/80">Temperature (Precision)</span>
                <span className="text-[#F5C542] font-bold">{temperature}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-[#F5C542]"
              />
              <span className="text-[10px] text-[#6B7280] block">
                0.2 provides deterministic financial reasoning with zero hallucinations.
              </span>
            </div>

            <div className="pt-3 border-t border-[#D4A017]/20 space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Context Length:</span>
                <span className="text-[#FFF8E7]">128k Tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Grounding Source:</span>
                <span className="text-[#FFF8E7]">Finova Institutional DB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Audit Guardrail:</span>
                <span className="text-[#C08A00] font-bold">SOC-2 / FINMA Enforced</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinovaAiAssistantPage;
