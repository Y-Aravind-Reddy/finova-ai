import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { GoogleGenAI } from "https://esm.sh/@google/genai@2.29.1";

/**
 * FINOVA AI — PRODUCTION RAG & CHAT ENGINE v2.1.8
 * Final Production Hardening: Atomic Rate Limiting, Triple-Insulated RAG, and SDK Precision
 */

const APPROVED_ORIGINS = [
  "https://ais-dev-dvm7cp37tu7ipktvhb6bmt-971598154639.asia-southeast1.run.app",
  "https://ais-pre-dvm7cp37tu7ipktvhb6bmt-971598154639.asia-southeast1.run.app"
];

const GENERATION_MODEL_ID = "gemini-3.6-flash";
const FALLBACK_GENERATION_MODELS = ["gemini-3.5-flash"];
const EMBEDDING_MODEL_ID = "gemini-embedding-2";

serve(async (req) => {
  const startTime = Date.now();
  const origin = req.headers.get("origin") || "";
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": APPROVED_ORIGINS.includes(origin) ? origin : APPROVED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // 1. Protocol Handling
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Strict origin check for institutional security
  if (origin && !APPROVED_ORIGINS.includes(origin) && !origin.includes("localhost")) {
    return new Response(JSON.stringify({ error: "Forbidden", details: "Institutional Security: Origin unauthorized." }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  try {
    // 2. Authentication & Session Verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: "Authorization Bearer token required." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // [Step A] Verify Authenticated Session
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: "Institutional session expired or invalid." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // [Step B] Resolve Immutable Institutional Profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, tenant_id, role, status")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Forbidden", details: "Financial profile not found in directory." }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    if (profile.status !== "Active") {
      return new Response(JSON.stringify({ error: "Forbidden", details: `Account status [${profile.status}] restricts AI access.` }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // 3. Atomic Rate Limiting (v2.1.8 Sliding Window — Fail-Closed)
    let isAllowed = false;
    const { data: allowed218, error: rateError } = await supabaseUser.rpc("check_ai_rate_limit_v218");

    if (!rateError) {
      isAllowed = Boolean(allowed218);
    } else if (
      rateError.code === "42883" ||
      rateError.code === "PGRST202" ||
      String(rateError.message || "").includes("Could not find the function")
    ) {
      const { data: allowed217, error: rateErr217 } = await supabaseUser.rpc("check_ai_rate_limit_v217");
      if (rateErr217) {
        console.error("[Audit] Rate Limit Engine Failure (v217 fallback):", rateErr217);
        return new Response(JSON.stringify({
          error: "Service Unavailable",
          details: "Rate limiting subsystem unavailable; request rejected by safety policy.",
          version: "2.1.8",
        }), {
          status: 503,
          headers: corsHeaders,
        });
      }
      isAllowed = Boolean(allowed217);
    } else {
      console.error("[Audit] Rate Limit Engine Failure:", rateError);
      return new Response(JSON.stringify({
        error: "Service Unavailable",
        details: "Rate limiting subsystem unavailable; request rejected by safety policy.",
        version: "2.1.8",
      }), {
        status: 503,
        headers: corsHeaders,
      });
    }

    if (!isAllowed) {
      return new Response(JSON.stringify({
        error: "Rate Limit Exceeded",
        details: "Institutional safety policy: 10 queries per rolling minute.",
        version: "2.1.8",
      }), {
        status: 429,
        headers: corsHeaders,
      });
    }

    // 4. Request Analysis & Extraction
    const body = await req.json();
    const { message, thread_id } = body;
    if (!message || typeof message !== "string" || message.trim().length === 0 || message.length > 4000) {
      return new Response(JSON.stringify({ error: "Bad Request", details: "Message must be a valid institutional query string." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 5. Thread Context & Ownership Persistence
    let threadId = thread_id;
    if (!threadId) {
      const { data: newThread, error: threadError } = await supabaseAdmin
        .from("ai_chat_threads")
        .insert({
          user_id: user.id,
          tenant_id: profile.tenant_id,
          title: message.substring(0, 50),
        })
        .select()
        .single();
      
      if (threadError) throw new Error(`Thread Initialization Failure: ${threadError.message}`);
      threadId = newThread.id;
    } else {
      const { data: existingThread, error: threadCheckError } = await supabaseAdmin
        .from("ai_chat_threads")
        .select("id")
        .eq("id", threadId)
        .eq("user_id", user.id)
        .eq("tenant_id", profile.tenant_id)
        .single();
      
      if (threadCheckError || !existingThread) {
        return new Response(JSON.stringify({ error: "Not Found", details: "AI context thread unauthorized or missing." }), {
          status: 404,
          headers: corsHeaders,
        });
      }
    }

    // 6. Gemini Intelligence Setup (Pattern: { apiKey })
    const genAI = new GoogleGenAI({ 
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
        timeout: 10000,
      }
    });

    const isTransientGeminiError = (err: any): boolean => {
      const status = Number(err?.status || err?.code || 0);
      const msg = String(err?.message || "").toLowerCase();
      return (
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        msg.includes("high demand") ||
        msg.includes("unavailable") ||
        msg.includes("deadline") ||
        msg.includes("timeout") ||
        msg.includes("resource_exhausted") ||
        msg.includes("fetch failed")
      );
    };

    // 7. RAG: Embedding Generation (768-dim) with transient resilience
    let queryEmbedding: number[] | null = null;
    try {
      const embedResult = await genAI.models.embedContent({
        model: EMBEDDING_MODEL_ID,
        contents: [message],
        config: { outputDimensionality: 768 }
      });

      const candidateVec = embedResult.embeddings?.[0]?.values || [];
      if (candidateVec.length !== 768) {
        throw new Error(`Dimensionality Mismatch: Expected 768, detected ${candidateVec.length}.`);
      }
      queryEmbedding = candidateVec;
    } catch (err: any) {
      console.error("[Gemini] Embedding Subsystem Error (continuing without RAG vectors):", err);
      // Do not fail user chat response if embedding service experiences transient issues
    }

    // 8. RAG: Authenticated Multi-Tenant Retrieval
    let chunks: any[] = [];
    if (queryEmbedding) {
      const { data: chunkRows, error: searchError } = await supabaseUser.rpc("match_ai_chunks", {
        query_embedding: queryEmbedding,
        match_threshold: 0.45,
        match_count: 5,
      });

      if (searchError) {
        console.error("[RAG] Retrieval Subsystem Error:", searchError);
      } else if (Array.isArray(chunkRows)) {
        chunks = chunkRows;
      }
    }

    const context = chunks.map((c: any) => c.content).join("\n\n") || "";
    const citations = chunks.map((c: any) => ({
      chunk_id: c.id,
      metadata: c.metadata,
      similarity: c.similarity
    }));

    // 9. Persist User Message (Schema Aligned: id, thread_id, tenant_id, role, content)
    const { error: userLogErr } = await supabaseAdmin.from("ai_chat_messages").insert({
      thread_id: threadId,
      tenant_id: profile.tenant_id,
      role: "user",
      content: message
    });
    if (userLogErr) throw new Error(`Database Integrity: Failed to log user query (${userLogErr.message}).`);

    // 10. Memory Optimization (Latest 10 Chronological)
    const { data: history, error: historyError } = await supabaseAdmin
      .from("ai_chat_messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (historyError) throw new Error(`History Retrieval Failure: ${historyError.message}`);

    const historyMessages = (history || []).reverse().map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    // Inject grounded context into the active session prompt
    if (context && historyMessages.length > 0) {
      const lastIdx = historyMessages.length - 1;
      if (historyMessages[lastIdx].role === "user") {
        historyMessages[lastIdx].parts[0].text = `INSTITUTIONAL KNOWLEDGE CONTEXT:\n---\n${context}\n---\n\nUSER QUERY: ${message}`;
      }
    }

    // 11. Intelligence Generation (gemini-3.6-flash primary + transient failover)
    const systemInstruction = `You are Finova AI, a luxury financial intelligence engine. Role: ${profile.role}. Tenant: ${profile.tenant_id}. Only provide information based on provided context if available. Precision, compliance, and professional tone are mandatory.`;
    const candidateModels = [GENERATION_MODEL_ID, ...FALLBACK_GENERATION_MODELS];

    let answer = "";
    let usage: any = {};
    let usedModel = GENERATION_MODEL_ID;
    let lastGenErr: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const modelId = candidateModels[i];
      const maxAttempts = i === 0 ? 2 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const genResult = await genAI.models.generateContent({
            model: modelId,
            contents: historyMessages,
            config: { systemInstruction }
          });

          const text = genResult.text || "";
          if (!text) {
            const finishReason = genResult.candidates?.[0]?.finishReason || "UNKNOWN_BLOCK";
            throw new Error(`Intelligence Synthesis Blocked. Reason: ${finishReason}`);
          }

          answer = text;
          usage = genResult.usageMetadata || {};
          usedModel = modelId;
          break;
        } catch (err: any) {
          lastGenErr = err;
          const errStatus = Number(err?.status || err?.code || 0);
          const errMsg = String(err?.message || err);
          console.error(`[Gemini] Generation error on ${modelId} (attempt ${attempt}/${maxAttempts}):`, errMsg);
          if (!isTransientGeminiError(err)) {
            break;
          }
          if (errStatus === 504 || errMsg.toLowerCase().includes("deadline")) {
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
      return new Response(JSON.stringify({ 
        error: "Bad Gateway", 
        details: `Upstream Intelligence: Model synthesis failed. ${lastGenErr?.message || "No response generated."}`,
        version: "2.1.8"
      }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    const latency = Date.now() - startTime;

    // 12. Persist Assistant Response
    const { error: aiLogErr } = await supabaseAdmin.from("ai_chat_messages").insert({
      thread_id: threadId,
      tenant_id: profile.tenant_id,
      role: "assistant",
      content: answer,
      citations: citations,
      telemetry: {
        model: usedModel,
        latencyMs: latency,
        usage: usage,
        rag: { chunk_count: chunks.length }
      }
    });
    if (aiLogErr) throw new Error(`Database Integrity: Failed to log AI response (${aiLogErr.message}).`);

    // Update session heartbeat & verify persistence
    const { error: threadUpdateErr } = await supabaseAdmin
      .from("ai_chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("user_id", user.id)
      .eq("tenant_id", profile.tenant_id);
    if (threadUpdateErr) {
      throw new Error(`Database Integrity: Failed to update thread timestamp (${threadUpdateErr.message}).`);
    }

    return new Response(JSON.stringify({ 
      answer, 
      thread_id: threadId,
      model: usedModel,
      citations: citations,
      latencyMs: latency,
      usage: usage,
      version: "2.1.8"
    }), {
      headers: corsHeaders,
    });

  } catch (err: any) {
    console.error("[CRITICAL] Edge Function Hardware Exception:", err);
    return new Response(JSON.stringify({ 
      error: "Internal Server Error", 
      details: err.message,
      version: "2.1.8"
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
