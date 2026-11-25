/**
 * Upload the banking policy documents in knowledge-base/policies/ to the deployed
 * Railway Policy RAG (used by the single Finova AI Assistant).
 *
 * Each Markdown policy is converted to a PDF and uploaded through the Finova server proxy
 *   POST {APP_URL}/api/rag-proxy/admin/knowledge-base/upload  ->  Railway /admin/knowledge-base/upload
 *
 * Usage (PowerShell):
 *   $env:KB_ADMIN_EMAIL="admin@example.com"; $env:KB_ADMIN_PASSWORD="..."; npx tsx scripts/ingest_policy_docs.ts
 *
 * Options:
 *   --supabase   upload to the Supabase knowledge base instead of Railway
 *                (POST {APP_URL}/api/kb/documents; works without redeploying Railway —
 *                the assistant searches Supabase alongside Railway)
 *   --pdf-only   just write PDFs to knowledge-base/pdf/ (no login, no upload)
 *
 * Requirements:
 *   - An ADMIN account (the Railway backend accepts uploads from role ADMIN only).
 *   - The Finova server must be running (npm run dev).
 *   - For the default Railway target: Railway deployed with the current rag-backend code.
 * Re-running with --supabase is safe: existing documents are skipped (HTTP 409).
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const POLICY_DIR = path.resolve('knowledge-base/policies');
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** Which roles may retrieve each document through the assistant. */
// Role visibility per document on Railway (matches the assistant's role topic scope).
const ROLE_ACCESS: Record<string, string[]> = {
  // Common information: every role
  'general-information.md': ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER'],
  // Support & customer-facing policies
  'support-sla-complaint-handling.md': ['ADMIN', 'SUPPORT_EXECUTIVE', 'CUSTOMER'],
  'account-closure-policy.md': ['ADMIN', 'SUPPORT_EXECUTIVE', 'CUSTOMER'],
  'kyc-document-requirements.md': ['ADMIN', 'SUPPORT_EXECUTIVE', 'CUSTOMER'],
  // Fraud & financial-crime policies
  'fraud-case-handling-procedure.md': ['ADMIN', 'FINANCE_ANALYST'],
  'aml-escalation-policy.md': ['ADMIN', 'FINANCE_ANALYST'],
  'wire-transfer-approval-controls.md': ['ADMIN', 'FINANCE_ANALYST'],
};

const args = new Set(process.argv.slice(2));
const TARGET: 'supabase' | 'railway' = args.has('--supabase') ? 'supabase' : 'railway';
const UPLOAD_URL =
  TARGET === 'supabase' ? `${APP_URL}/api/kb/documents` : `${APP_URL}/api/rag-proxy/admin/knowledge-base/upload`;

// ---------------------------------------------------------------------------
// Minimal dependency-free text PDF writer (Helvetica, wrapped, multi-page).
// ---------------------------------------------------------------------------
function markdownToPlainLines(md: string): string[] {
  const out: string[] = [];
  for (const raw of md.split(/\r?\n/)) {
    let line = raw
      .replace(/^#{1,6}\s*/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`/g, '');
    if (/^\|?\s*-{3,}/.test(line)) continue; // table separator row
    if (line.trim().startsWith('|')) {
      line = line.split('|').map((c) => c.trim()).filter(Boolean).join('  -  ');
    }
    // Wrap at ~95 characters (fits Letter width at 10pt Helvetica)
    const words = line.split(' ');
    let current = '';
    for (const w of words) {
      if ((current + ' ' + w).trim().length > 95) {
        out.push(current);
        current = w;
      } else {
        current = (current + ' ' + w).trim();
      }
    }
    out.push(current);
  }
  return out;
}

/** Build a PDF; each string in `sections` starts on a new page. */
function buildPdf(md: string | string[]): Uint8Array {
  const sections = Array.isArray(md) ? md : [md];
  const LINES_PER_PAGE = 58;
  const pages: string[][] = [];
  for (const section of sections) {
    const lines = markdownToPlainLines(section);
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop(); // no blank spill-over pages
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }

  const esc = (s: string) => s.replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1');
  const objects: string[] = [];
  const pageIds: number[] = [];
  // 1: catalog, 2: pages, 3: font; then (content, page) pairs
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  let nextId = 4;
  for (const pageLines of pages) {
    const stream =
      'BT /F1 10 Tf 13 TL 50 750 Td\n' +
      pageLines.map((l) => `(${esc(l)}) Tj T*`).join('\n') +
      '\nET';
    const contentId = nextId++;
    const pageId = nextId++;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageIds.push(pageId);
  }
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, 'latin1'));
}

// ---------------------------------------------------------------------------

async function main() {
  if (args.has('--pdf-combined')) {
    // One PDF with every policy, each starting on a new page, for manual upload
    const outDir = path.resolve('knowledge-base/pdf');
    mkdirSync(outDir, { recursive: true });
    const files = readdirSync(POLICY_DIR).filter((f) => f.endsWith('.md')).sort();
    const docs = files.map((f) => readFileSync(path.join(POLICY_DIR, f), 'utf8'));
    const contents = [
      '# Finova Banking Policy Handbook\n\nApex Global Bank - all policy documents in one file.\n' +
        'Illustrative policies for the Finova demo workspace. Not legal or regulatory advice.\n\n## Contents\n\n' +
        docs.map((d, i) => `${i + 1}. ${(d.match(/^#\s+(.+)$/m)?.[1] || files[i]).trim()}`).join('\n'),
      ...docs,
    ];
    const out = path.join(outDir, 'finova-policy-handbook.pdf');
    writeFileSync(out, buildPdf(contents));
    console.log(`Wrote ${path.relative(process.cwd(), out)} (${files.length} policies + contents page)`);
    process.exit(0);
  }

  if (args.has('--pdf-only')) {
    const outDir = path.resolve('knowledge-base/pdf');
    mkdirSync(outDir, { recursive: true });
    for (const file of readdirSync(POLICY_DIR).filter((f) => f.endsWith('.md')).sort()) {
      const out = path.join(outDir, file.replace(/\.md$/, '.pdf'));
      writeFileSync(out, buildPdf(readFileSync(path.join(POLICY_DIR, file), 'utf8')));
      console.log(`Wrote ${path.relative(process.cwd(), out)}  (roles: ${(ROLE_ACCESS[file] || ['ADMIN']).join(', ')})`);
    }
    process.exit(0);
  }

  const email = process.env.KB_ADMIN_EMAIL;
  const password = process.env.KB_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set KB_ADMIN_EMAIL and KB_ADMIN_PASSWORD (an ADMIN account) before running.');
  }

  const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password });
  if (authErr || !auth.session) throw new Error(`Login failed: ${authErr?.message || 'no session'}`);
  const token = auth.session.access_token;
  console.log(`Logged in as ${email}. Uploading to: ${TARGET === 'supabase' ? 'Supabase knowledge base' : 'Railway Policy RAG'}`);

  const files = readdirSync(POLICY_DIR).filter((f) => f.endsWith('.md')).sort();
  let failures = 0;

  for (const file of files) {
    const md = readFileSync(path.join(POLICY_DIR, file), 'utf8');
    const title = (md.match(/^#\s+(.+)$/m)?.[1] || file.replace(/\.md$/, '')).trim();
    const roles = ROLE_ACCESS[file] || ['SUPER_ADMIN', 'ADMIN'];

    const form = new FormData();
    form.append('file', new Blob([buildPdf(md)], { type: 'application/pdf' }), file.replace(/\.md$/, '.pdf'));
    form.append('title', title);
    form.append('description', `Policy document ${file}`);
    form.append('category', 'POLICY');
    form.append('allowedRoles', JSON.stringify(roles));

    let r: Response;
    try {
      r = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
    } catch {
      throw new Error(`Cannot reach ${APP_URL}. Start the Finova server first (npm run dev).`);
    }
    const j: any = await r.json().catch(() => ({}));
    if (r.ok) {
      console.log(`OK       ${title}  (${j.chunkCount ?? j.document?.chunkCount ?? '?'} chunks, roles: ${roles.join(', ')})`);
    } else if (r.status === 409) {
      console.log(`SKIPPED  ${title}  (already uploaded)`);
    } else {
      failures++;
      console.log(`FAILED   ${title}  HTTP ${r.status} ${j.detail || j.error || ''}`);
    }
  }

  await sb.auth.signOut();
  console.log(failures ? `\nDone with ${failures} failure(s).` : '\nAll documents uploaded.');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
