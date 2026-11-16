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

    // 3. RPC Availability Test (match_ai_chunks)
    // We attempt to find the function signature without executing it with real vectors
    const { data: rpcCheck, error: rpcError } = await supabaseAdmin
      .rpc("match_ai_chunks", {
        query_embedding: new Array(768).fill(0),
        match_threshold: 1.0,
        match_count: 1
      });

    results.rpc = {
      match_ai_chunks_available: rpcError?.code !== "P0001" && rpcError?.code !== "42883",
      error: rpcError && rpcError.code !== "P0001" ? { code: rpcError.code, message: rpcError.message } : null,
      notes: "Executed with dummy zero-vector. Code P0001 (Raise Exception) usually means auth check passed but no session was present, which is expected for service-role diagnostic check."
    };

    // 4. Gemini API Connectivity (Network Handshake)
    if (geminiApiKey) {
      const geminiStart = Date.now();
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
        const geminiData = await resp.json();
        
        results.gemini = {
          connected: resp.ok,
          status: resp.status,
          latencyMs: Date.now() - geminiStart,
          has_models: !!geminiData.models,
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
