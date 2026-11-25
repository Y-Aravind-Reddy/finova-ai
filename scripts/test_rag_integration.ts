import assert from 'node:assert/strict';
import { isRouteAllowed } from '../src/routes/routesConfig.ts';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}:`, (err as Error)?.message || err);
    failed++;
  }
}

async function main() {
  await runTest('1. Route guard restricts /admin/knowledge-base strictly to ADMIN role', () => {
    assert.equal(isRouteAllowed('/admin/knowledge-base', 'ADMIN'), true);
    assert.equal(isRouteAllowed('/admin/knowledge-base', 'SUPER_ADMIN'), false);
    assert.equal(isRouteAllowed('/admin/knowledge-base', 'FINANCE_ANALYST'), false);
    assert.equal(isRouteAllowed('/admin/knowledge-base', 'SUPPORT_EXECUTIVE'), false);
    assert.equal(isRouteAllowed('/admin/knowledge-base', 'CUSTOMER'), false);
  });

  await runTest('2. All five canonical roles retain access to their scoped Finova AI Assistant route', () => {
    const roleAssistantRoutes = {
      SUPER_ADMIN: '/super-admin/ai-assistant',
      ADMIN: '/admin/ai-assistant',
      FINANCE_ANALYST: '/finance/ai-assistant',
      SUPPORT_EXECUTIVE: '/support/ai-assistant',
      CUSTOMER: '/customer/ai-assistant',
    } as const;

    for (const [role, path] of Object.entries(roleAssistantRoutes)) {
      assert.equal(
        isRouteAllowed(path, role as keyof typeof roleAssistantRoutes),
        true,
        `${role} should have access to ${path}`
      );
    }
  });

  await runTest(
    '3. Live Railway RAG /health & /roles respond cleanly and /chat rejects unauthenticated call (401/403)',
    async () => {
      const ragUrl = (
        process.env.VITE_RAG_API_URL || 'https://finovaairag-production.up.railway.app'
      ).replace(/\/+$/, '');

      const healthResp = await fetch(`${ragUrl}/health`);
      assert.equal(healthResp.status, 200);
      const healthJson = (await healthResp.json()) as {
        status: string;
        indexes_total: number;
      };
      assert.equal(healthJson.status, 'ok');
      assert.equal(healthJson.indexes_total, 5);

      const rolesResp = await fetch(`${ragUrl}/roles`);
      assert.equal(rolesResp.status, 200);
      const rolesJson = (await rolesResp.json()) as {
        roles: Array<{ role: string }>;
      };
      assert.deepEqual(
        rolesJson.roles.map((r) => r.role),
        [
          'SUPER_ADMIN',
          'ADMIN',
          'FINANCE_ANALYST',
          'SUPPORT_EXECUTIVE',
          'CUSTOMER',
        ]
      );

      const chatUnauth = await fetch(`${ragUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'What is the account closure process?',
        }),
      });
      assert.ok(
        chatUnauth.status === 401 || chatUnauth.status === 403,
        `Expected 401/403 got ${chatUnauth.status}`
      );
    }
  );

  await runTest(
    '4. Local Express /api/rag-proxy/* endpoints enforce Bearer auth cleanly when dev server is running',
    async () => {
      const localBase = 'http://localhost:3000';
      let serverUp = false;
      try {
        const probe = await fetch(`${localBase}/api/health`);
        serverUp = probe.ok;
      } catch {
        serverUp = false;
      }

      if (!serverUp) {
        console.log('SKIP-LOCAL-HTTP: localhost:3000 is not running during standalone run');
        return;
      }

      const healthProxy = await fetch(`${localBase}/api/rag-proxy/health`);
      assert.equal(healthProxy.status, 200);

      const rolesProxy = await fetch(`${localBase}/api/rag-proxy/roles`);
      assert.equal(rolesProxy.status, 200);

      for (const path of [
        '/api/rag-proxy/chat',
        '/api/rag-proxy/admin/knowledge-base/documents',
        '/api/rag-proxy/admin/knowledge-base/upload',
        '/api/rag-proxy/admin/knowledge-base/status',
      ]) {
        const method =
          path.endsWith('/chat') || path.endsWith('/upload') ? 'POST' : 'GET';
        const resp = await fetch(`${localBase}${path}`, { method });
        assert.equal(resp.status, 401, `${path} must return 401 without Bearer token`);
      }
    }
  );

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
