/**
 * Read-only Live System Verification Probe for Finova AI
 * Inspects anon Supabase boundary, Gemini 4/3 & embedding runtime, and Express route auth gates.
 * Never mutates DB data or prints any secrets/tokens.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import {
  createGeminiClient,
  generateEmbedding768,
  generateWithResilientFailover,
  resolveServerAiConfig,
} from '../server/aiGateway.js';

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.');
  }

  const sb = createClient(url, key);

  console.log('--- 1. LIVE SUPABASE ANON BOUNDARY & SCHEMA PROBE ---');
  const probes: Array<{
    name: string;
    expectBlocked?: boolean;
    fn: () => PromiseLike<{ data: any; error: any }>;
  }> = [
    { name: 'exchange_rates (public read)', fn: () => sb.from('exchange_rates').select('id').limit(3) },
    { name: 'tenant_workspaces (anon denied)', expectBlocked: true, fn: () => sb.from('tenant_workspaces').select('id').limit(3) },
    { name: 'fraud_cases (anon denied)', expectBlocked: true, fn: () => sb.from('fraud_cases').select('id').limit(1) },
    { name: 'kyc_records (anon denied)', expectBlocked: true, fn: () => sb.from('kyc_records').select('id').limit(1) },
    { name: 'ai_configurations (anon denied)', expectBlocked: true, fn: () => sb.from('ai_configurations').select('id').limit(1) },
    { name: 'ai_knowledge_documents (content_hash check)', expectBlocked: true, fn: () => sb.from('ai_knowledge_documents').select('id, content_hash').limit(1) },
    { name: 'ai_document_chunks (anon denied)', expectBlocked: true, fn: () => sb.from('ai_document_chunks').select('id').limit(1) },
    { name: 'rpc:get_fraud_aggregates (anon denied)', expectBlocked: true, fn: () => sb.rpc('get_fraud_aggregates', { p_tenant_id: 'tenant_apex_bank' }) },
    { name: 'rpc:get_transaction_aggregates (anon denied)', expectBlocked: true, fn: () => sb.rpc('get_transaction_aggregates', { p_tenant_id: 'tenant_apex_bank' }) },
    { name: 'rpc:get_platform_executive_kpis (anon denied)', expectBlocked: true, fn: () => sb.rpc('get_platform_executive_kpis') },
    { name: 'rpc:get_support_aggregates (anon denied)', expectBlocked: true, fn: () => sb.rpc('get_support_aggregates', { p_tenant_id: 'tenant_apex_bank' }) },
    { name: 'rpc:get_kyc_aggregates (anon denied)', expectBlocked: true, fn: () => sb.rpc('get_kyc_aggregates', { p_tenant_id: 'tenant_apex_bank' }) },
  ];

  for (const p of probes) {
    const { data, error } = await p.fn();
    const outcome = error
      ? `DENIED[${error.code || 'ERR'}]: ${error.message}`
      : `ROWS(${Array.isArray(data) ? data.length : typeof data})`;
    console.log(`  ${p.name} => ${outcome}`);
  }

  console.log('\n--- 2. LIVE GEMINI GATEWAY & EMBEDDING PROBE ---');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('  [SKIP] GEMINI_API_KEY missing.');
  } else {
    const genAI = createGeminiClient(apiKey, 15000);
    const cfg = resolveServerAiConfig(null);
    const t0 = Date.now();
    const chatRes = await generateWithResilientFailover({
      genAI,
      config: cfg,
      contents: 'Respond with exactly two words: FINOVA OPERATIONAL',
      systemInstruction: 'Finova verification probe. Output concisely.',
    });
    console.log(
      `  Chat Primary/Failover => model=${chatRes.model}, attempts=${chatRes.attempts}, latencyMs=${Date.now() - t0}, output=${JSON.stringify(chatRes.answer)}`
    );

    const t1 = Date.now();
    const vec = await generateEmbedding768(
      genAI,
      'Basel III AML transaction monitoring verification'
    );
    console.log(
      `  Embedding => model=gemini-embedding-2, dimensions=${vec.length}, latencyMs=${Date.now() - t1}`
    );
  }

  console.log('\n--- 3. LIVE EXPRESS API GATEWAY PROBE (EPHEMERAL PORT 3199) ---');
  const srv = spawn('npx', ['tsx', 'server.ts'], {
    env: { ...process.env, PORT: '3199', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Express boot timeout')), 10000);
    srv.stdout.on('data', (d) => {
      if (d.toString().includes('listening on')) {
        clearTimeout(timer);
        resolve();
      }
    });
    srv.stderr.on('data', (d) => {
      const s = d.toString().trim();
      if (s) console.error('  [server stderr]', s);
    });
  });

  try {
    const h = await fetch('http://127.0.0.1:3199/api/health');
    const hJson = await h.json();
    console.log('  GET /api/health =>', h.status, JSON.stringify(hJson));

    const c401 = await fetch('http://127.0.0.1:3199/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
    });
    console.log('  POST /api/ai/chat (unauthenticated) => HTTP', c401.status);

    const kbList401 = await fetch('http://127.0.0.1:3199/api/ai/knowledge');
    console.log('  GET /api/ai/knowledge (unauthenticated) => HTTP', kbList401.status);

    const kbIngest401 = await fetch('http://127.0.0.1:3199/api/ai/knowledge/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', content: 'Body' }),
    });
    console.log('  POST /api/ai/knowledge/ingest (unauthenticated) => HTTP', kbIngest401.status);
  } finally {
    srv.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
