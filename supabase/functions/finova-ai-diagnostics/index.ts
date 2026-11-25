import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

/**
 * FINOVA AI — SYSTEM DIAGNOSTICS v2.2.0
 * Purpose: Validate Edge Function environment, Database connectivity, and live verified Gemini models.
 */

const APPROVED_ORIGINS = [
  "https://ais-dev-dvm7cp37tu7ipktvhb6bmt-971598154639.asia-southeast1.run.app",
  "https://ais-pre-dvm7cp37tu7ipktvhb6bmt-971598154639.asia-southeast1.run.app",
];

serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": APPROVED_ORIGINS.includes(origin) ? origin : APPROVED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    version: "2.2.0",
    environment: {},
    database: {},
    rpc: {},
    gemini: {},
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Authenticated bearer token required for diagnostics." }),
        { status: 401, headers: corsHeaders }
      );
    }

    const envVars = [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "GEMINI_API_KEY",
    ];

    const envSummary: Record<string, { present: boolean }> = {};
    envVars.forEach((v) => {
      envSummary[v] = { present: Boolean(Deno.env.get(v)) };
    });
    results.environment = envSummary;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing critical Supabase environment variables.");
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Invalid session token." }),
        { status: 401, headers: corsHeaders }
      );
    }

    const dbStartTime = Date.now();
    const { data: profileCheck, error: dbError } = await supabaseUser
      .from("profiles")
      .select("role, tenant_id, status")
      .eq("id", user.id)
      .single();

    if (dbError || !profileCheck || profileCheck.role !== "SUPER_ADMIN") {
      return new Response(
        JSON.stringify({ error: "Forbidden", details: "Diagnostics restricted to verified SUPER_ADMIN." }),
        { status: 403, headers: corsHeaders }
      );
    }

    results.database = {
      connected: true,
      latencyMs: Date.now() - dbStartTime,
      callerRole: profileCheck.role,
    };

    const [{ error: matchErr }, { data: aiConfig }] = await Promise.all([
      supabaseUser.rpc("match_ai_chunks", {
        query_embedding: new Array(768).fill(0),
        match_threshold: 1.0,
        match_count: 1,
      }),
      supabaseUser
        .from("ai_configurations")
        .select("model, is_active")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    results.rpc = {
      match_ai_chunks_available: matchErr?.code !== "42883" && matchErr?.code !== "PGRST202",
      active_ai_configuration: aiConfig?.model || null,
    };

    if (geminiApiKey) {
      const geminiStart = Date.now();
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
        target_models: {
          "gemini-4-hydrogen": modelNames.includes("gemini-4-hydrogen"),
          "gemini-3.1-flash-lite": modelNames.includes("gemini-3.1-flash-lite"),
          "gemini-3.5-flash-lite": modelNames.includes("gemini-3.5-flash-lite"),
          "gemini-embedding-2": modelNames.includes("gemini-embedding-2"),
        },
      };
    }

    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: err?.message || "Diagnostics failure",
        timestamp: results.timestamp,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
