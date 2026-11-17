import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

/**
 * FINOVA AI — SYSTEM DIAGNOSTICS v1.0.0
 * Purpose: Validate Edge Function environment, Database connectivity, and API availability.
 */

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {},
    database: {},
    rpc: {},
    gemini: {},
  };

  try {
    // 1. Environment Variable Audit (Presence & Format only)
    const envVars = [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "GEMINI_API_KEY"
    ];

    envVars.forEach(v => {
      const val = Deno.env.get(v);
      results.environment[v] = {
        present: !!val,
        length: val?.length || 0,
        prefix: val ? `${val.substring(0, 4)}...` : null
      };
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing critical Supabase environment variables.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Database Connectivity Test
    const dbStartTime = Date.now();
    const { data: profileCheck, error: dbError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .limit(1);

    results.database = {
      connected: !dbError,
      latencyMs: Date.now() - dbStartTime,
      error: dbError ? { code: dbError.code, message: dbError.message } : null,
      table_profiles_exists: !dbError,
    };

    // 3. RPC Availability Tests (match_ai_chunks & check_ai_rate_limit_v218)
    const [{ error: rpcError }, { error: rateLimitRpcErr }] = await Promise.all([
      supabaseAdmin.rpc("match_ai_chunks", {
        query_embedding: new Array(768).fill(0),
        match_threshold: 1.0,
        match_count: 1
      }),
      supabaseAdmin.rpc("check_ai_rate_limit_v218"),
    ]);

    results.rpc = {
      match_ai_chunks_available: rpcError?.code !== "42883" && rpcError?.code !== "PGRST202",
      match_ai_chunks_error: rpcError && rpcError.code !== "P0001" ? { code: rpcError.code, message: rpcError.message } : null,
      check_ai_rate_limit_v218_available: rateLimitRpcErr?.code !== "42883" && rateLimitRpcErr?.code !== "PGRST202",
      check_ai_rate_limit_v218_error: rateLimitRpcErr && rateLimitRpcErr.code !== "P0001" ? { code: rateLimitRpcErr.code, message: rateLimitRpcErr.message } : null,
      notes: "Service-role diagnostic probe without user session. P0001 means auth.uid() guard executed cleanly."
    };

    // 4. Gemini API Connectivity (Header-based Key Handshake)
    if (geminiApiKey) {
      const geminiStart = Date.now();
      try {
        const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
          headers: { "x-goog-api-key": geminiApiKey },
        });
        const geminiData = await resp.json();
        const modelNames = Array.isArray(geminiData.models)
          ? geminiData.models.map((m: { name?: string }) => String(m.name || "").replace(/^models\//, ""))
          : [];

        results.gemini = {
          connected: resp.ok,
          status: resp.status,
          latencyMs: Date.now() - geminiStart,
          has_models: modelNames.length > 0,
          target_models: {
            "gemini-3.6-flash": modelNames.includes("gemini-3.6-flash"),
            "gemini-3.5-flash": modelNames.includes("gemini-3.5-flash"),
            "gemini-embedding-2": modelNames.includes("gemini-embedding-2"),
          },
          error: resp.ok ? null : geminiData.error?.message || "Unknown API error"
        };
      } catch (e: any) {
        results.gemini = {
          connected: false,
          error: e.message
        };
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ 
      status: "error", 
      message: err.message,
      timestamp: results.timestamp 
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
