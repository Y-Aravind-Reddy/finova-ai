import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const GENERATION_MODEL_ID = 'gemini-3.6-flash';
const FALLBACK_GENERATION_MODELS = ['gemini-3.5-flash'];
const EMBEDDING_MODEL_ID = 'gemini-embedding-2';

function isTransientGeminiError(err: unknown): boolean {
  const e = err as { status?: number; code?: number; message?: string };
  const status = Number(e?.status || e?.code || 0);
  const msg = String(e?.message || '').toLowerCase();
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('deadline') ||
    msg.includes('timeout') ||
    msg.includes('resource_exhausted') ||
    msg.includes('fetch failed')
  );
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL),
    });
  });

  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Unauthorized',
          details: 'Authorization Bearer token required.',
        });
        return;
      }

      const supabaseUrl = (
        process.env.VITE_SUPABASE_URL || 'https://rjudrmnnpwlovpkbwnte.supabase.co'
      )
        .replace(/\/rest\/v1\/?$/, '')
        .replace(/\/+$/, '');

      const supabaseAnonKey =
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        '';

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        res.status(500).json({
          error: 'Configuration Error',
          details: 'GEMINI_API_KEY is not configured on the server.',
        });
        return;
      }

      if (!supabaseAnonKey) {
        res.status(500).json({
          error: 'Configuration Error',
          details: 'Supabase anon key is not configured on the server.',
        });
        return;
      }

      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      // 1. Verify Authenticated Session
      const {
        data: { user },
        error: userError,
      } = await supabaseUser.auth.getUser();

      if (userError || !user) {
        res.status(401).json({
          error: 'Unauthorized',
          details: 'Institutional session expired or invalid.',
        });
        return;
      }

      // 2. Resolve Profile from Database (strictly derived server-side)
      const { data: profile, error: profileError } = await supabaseUser
        .from('profiles')
        .select('id, tenant_id, role, status')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        res.status(403).json({
          error: 'Forbidden',
          details: 'Financial profile not found in directory.',
        });
        return;
      }

      if (profile.status !== 'Active') {
        res.status(403).json({
          error: 'Forbidden',
          details: `Account status [${profile.status}] restricts AI access.`,
        });
        return;
      }

      // 3. Atomic Rate Limiting (v2.1.8 -> v2.1.7 only if missing; fail-closed on errors)
      let rateAllowed = false;
      const { data: allowed218, error: rateErr218 } = await supabaseUser.rpc(
        'check_ai_rate_limit_v218'
      );

      if (!rateErr218) {
        rateAllowed = Boolean(allowed218);
      } else if (
        rateErr218.code === '42883' ||
        rateErr218.code === 'PGRST202' ||
        String(rateErr218.message || '').includes('Could not find the function')
      ) {
        const { data: allowed217, error: rateErr217 } = await supabaseUser.rpc(
          'check_ai_rate_limit_v217'
        );
        if (rateErr217) {
          console.error('[Audit] Rate Limit RPC v217 Error:', rateErr217);
          res.status(503).json({
            error: 'Service Unavailable',
            details: 'Rate limiting subsystem unavailable; request rejected by safety policy.',
          });
          return;
        }
        rateAllowed = Boolean(allowed217);
      } else {
        console.error('[Audit] Rate Limit RPC Error:', rateErr218);
        res.status(503).json({
          error: 'Service Unavailable',
          details: 'Rate limiting subsystem unavailable; request rejected by safety policy.',
        });
        return;
      }

      if (!rateAllowed) {
        res.status(429).json({
          error: 'Rate Limit Exceeded',
          details: 'Institutional safety policy: 10 queries per rolling minute.',
        });
        return;
      }

      // 4. Validate Request Body
      const { message, thread_id } = req.body || {};
      if (
        !message ||
        typeof message !== 'string' ||
        message.trim().length === 0 ||
        message.length > 4000
      ) {
        res.status(400).json({
          error: 'Bad Request',
          details: 'Message must be a valid institutional query string (1-4000 characters).',
        });
        return;
      }

      // 5. Thread Ownership & Creation
      let threadId: string = thread_id;
      if (!threadId) {
        const { data: newThread, error: threadError } = await supabaseUser
          .from('ai_chat_threads')
          .insert({
            user_id: user.id,
            tenant_id: profile.tenant_id,
            title: message.trim().substring(0, 50),
          })
          .select('id')
          .single();

        if (threadError || !newThread) {
          throw new Error(
            `Thread Initialization Failure: ${threadError?.message || 'Unknown error'}`
          );
        }
        threadId = newThread.id;
      } else {
        const { data: existingThread, error: threadCheckError } = await supabaseUser
          .from('ai_chat_threads')
          .select('id')
          .eq('id', threadId)
          .eq('user_id', user.id)
          .eq('tenant_id', profile.tenant_id)
          .single();

        if (threadCheckError || !existingThread) {
          res.status(404).json({
            error: 'Not Found',
            details: 'AI context thread unauthorized or missing.',
          });
          return;
        }
      }

      // 6. Initialize Official @google/genai SDK
      const genAI = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
          timeout: 10000,
        },
      });

      // 7. RAG: Embedding Generation (768-dim) with graceful degradation
      let queryEmbedding: number[] | null = null;
      try {
        const embedResult = await genAI.models.embedContent({
          model: EMBEDDING_MODEL_ID,
          contents: [message],
          config: { outputDimensionality: 768 },
        });
        const vec = embedResult.embeddings?.[0]?.values || [];
        if (vec.length === 768) {
          queryEmbedding = vec;
        } else {
          console.warn(`[Gemini] Embedding dimensionality mismatch: ${vec.length}`);
        }
      } catch (embedErr) {
        console.warn('[Gemini] Embedding generation skipped due to upstream error:', embedErr);
      }

      // 8. RAG: Authenticated Multi-Tenant Retrieval
      let chunks: Array<{ id: string; content: string; metadata: unknown; similarity: number }> = [];
      if (queryEmbedding) {
        const { data: chunkRows, error: searchError } = await supabaseUser.rpc(
          'match_ai_chunks',
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.45,
            match_count: 5,
          }
        );

        if (searchError) {
          console.warn('[RAG] match_ai_chunks warning:', searchError.message);
        } else if (Array.isArray(chunkRows)) {
          chunks = chunkRows;
        }
      }

      const context = chunks.map((c) => c.content).join('\n\n');
      const citations = chunks.map((c) => ({
        chunk_id: c.id,
        metadata: c.metadata,
        similarity: c.similarity,
      }));

      // 9. Persist User Message (schema: thread_id, tenant_id, role, content)
      const { error: userLogErr } = await supabaseUser.from('ai_chat_messages').insert({
        thread_id: threadId,
        tenant_id: profile.tenant_id,
        role: 'user',
        content: message,
      });

      if (userLogErr) {
        throw new Error(`Database Integrity: Failed to log user query (${userLogErr.message}).`);
      }

      // 10. Memory Optimization (Latest 10 Chronological)
      const { data: history, error: historyError } = await supabaseUser
        .from('ai_chat_messages')
        .select('role, content')
        .eq('thread_id', threadId)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (historyError) {
        throw new Error(`History Retrieval Failure: ${historyError.message}`);
      }

      const historyMessages = (history || []).reverse().map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      if (context && historyMessages.length > 0) {
        const lastIdx = historyMessages.length - 1;
        if (historyMessages[lastIdx].role === 'user') {
          historyMessages[lastIdx].parts[0].text = `INSTITUTIONAL KNOWLEDGE CONTEXT:\n---\n${context}\n---\n\nUSER QUERY: ${message}`;
        }
      }

      // 11. Intelligence Generation (gemini-3.6-flash primary + transient failover)
      const systemInstruction = `You are Finova AI, a luxury financial intelligence engine. Role: ${profile.role}. Tenant: ${profile.tenant_id}. Only provide information based on provided context if available. Precision, compliance, and professional tone are mandatory.`;
      const candidateModels = [GENERATION_MODEL_ID, ...FALLBACK_GENERATION_MODELS];

      let answer = '';
      let usage: unknown = {};
      let usedModel = GENERATION_MODEL_ID;
      let lastGenErr: unknown = null;

      for (let i = 0; i < candidateModels.length; i++) {
        const modelId = candidateModels[i];
        const maxAttempts = i === 0 ? 2 : 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const genResult = await genAI.models.generateContent({
              model: modelId,
              contents: historyMessages,
              config: { systemInstruction },
            });

            const text = genResult.text || '';
            if (!text) {
              const finishReason =
                genResult.candidates?.[0]?.finishReason || 'UNKNOWN_BLOCK';
              throw new Error(`Intelligence Synthesis Blocked. Reason: ${finishReason}`);
            }

            answer = text;
            usage = genResult.usageMetadata || {};
            usedModel = modelId;
            break;
          } catch (err) {
            lastGenErr = err;
            const errMsg = String((err as Error)?.message || err);
            const errStatus = Number((err as { status?: number; code?: number })?.status || (err as { code?: number })?.code || 0);
            console.error(
              `[Gemini] Generation error on ${modelId} (attempt ${attempt}/${maxAttempts}):`,
              errMsg
            );
            if (!isTransientGeminiError(err)) {
              break;
            }
            // Don't retry same model after a 10s deadline expiration; fail over immediately
            if (errStatus === 504 || errMsg.toLowerCase().includes('deadline')) {
              break;
            }
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, 350 * attempt));
            }
          }
        }

        if (answer) break;
        if (lastGenErr && !isTransientGeminiError(lastGenErr)) break;
      }

      if (!answer) {
        const errMessage = (lastGenErr as Error)?.message || 'Model synthesis failed.';
        res.status(502).json({
          error: 'Bad Gateway',
          details: `Upstream Intelligence: ${errMessage}`,
          version: '2.1.8',
        });
        return;
      }

      const latency = Date.now() - startTime;

      // 12. Persist Assistant Response
      const { error: aiLogErr } = await supabaseUser.from('ai_chat_messages').insert({
        thread_id: threadId,
        tenant_id: profile.tenant_id,
        role: 'assistant',
        content: answer,
        citations,
        telemetry: {
          model: usedModel,
          latencyMs: latency,
          usage,
          rag: { chunk_count: chunks.length },
        },
      });

      if (aiLogErr) {
        throw new Error(`Database Integrity: Failed to log AI response (${aiLogErr.message}).`);
      }

      const { error: threadUpdateErr } = await supabaseUser
        .from('ai_chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId)
        .eq('user_id', user.id)
        .eq('tenant_id', profile.tenant_id);

      if (threadUpdateErr) {
        throw new Error(`Database Integrity: Failed to update thread timestamp (${threadUpdateErr.message}).`);
      }

      res.json({
        answer,
        thread_id: threadId,
        model: usedModel,
        citations,
        latencyMs: latency,
        usage,
        version: '2.1.8',
      });
    } catch (err) {
      console.error('[CRITICAL] /api/ai/chat Exception:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        details: (err as Error)?.message || 'Unexpected AI service error.',
        version: '2.1.8',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.use((req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Finova AI server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start Finova AI server:', err);
  process.exit(1);
});
