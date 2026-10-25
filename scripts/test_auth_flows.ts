import fs from 'fs';
import path from 'path';

// In-memory localStorage polyfill for Node.js test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    length: 0,
  } as unknown as Storage;
}

import { signInWithGoogleOAuth } from '../src/lib/supabase';
import {
  authenticateUser,
  authenticateDemoPersona,
  registerCustomer,
  signOutUserAsync,
  getStoredSession,
  saveSession,
  clearSession,
  SEEDED_CREDENTIALS,
} from '../src/data/authStore';
import { isRouteAllowed, ROLE_DEFAULT_ROUTES } from '../src/routes/routesConfig';
import { UserRole } from '../src/data/finovaDatasets';

async function runAuthVerification() {
  console.log('================================================================');
  console.log('FINOVA AI — AUTHENTICATION & GOOGLE SIGN-IN REMOVAL AUDIT');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${name}`);
    } else {
      console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`);
    }
  }

  // ----------------------------------------------------------------------------
  // TEST GROUP 1: Verification of Google Sign-In Removal from Frontend
  // ----------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Google Workspace Sign-In Entry Point Removal ---');

  const loginPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/LoginPage.tsx'),
    'utf-8'
  );

  assert(
    'LoginPage.tsx does NOT contain "Sign In with Google Workspace" text',
    !loginPageContent.includes('Sign In with Google Workspace')
  );

  assert(
    'LoginPage.tsx does NOT contain "Or SSO Access" divider',
    !loginPageContent.includes('Or SSO Access')
  );

  assert(
    'LoginPage.tsx does NOT import signInWithGoogleOAuth',
    !loginPageContent.includes('signInWithGoogleOAuth')
  );

  assert(
    'LoginPage.tsx does NOT define handleGoogleOAuth click handler',
    !loginPageContent.includes('handleGoogleOAuth')
  );

  // Test the disabled handler in supabase.ts returns safe error
  const oauthRes = await signInWithGoogleOAuth();
  assert(
    'signInWithGoogleOAuth() in supabase.ts returns explicit disabled error notice',
    Boolean(oauthRes.error && oauthRes.error.includes('temporarily disabled')) && !oauthRes.url,
    oauthRes.error
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 2: Email/Password Authentication & Protected Dashboard Access
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Email/Password Auth for All 5 Roles & Dashboard Access ---');

  const testRoles: { role: UserRole; email: string; defaultRoute: string }[] = [
    { role: 'SUPER_ADMIN', email: 'superadmin@finova.ai', defaultRoute: '/super-admin/dashboard' },
    { role: 'ADMIN', email: 'admin@finova.ai', defaultRoute: '/admin/dashboard' },
    { role: 'FINANCE_ANALYST', email: 'analyst@finova.ai', defaultRoute: '/finance/dashboard' },
    { role: 'SUPPORT_EXECUTIVE', email: 'support@finova.ai', defaultRoute: '/support/dashboard' },
    { role: 'CUSTOMER', email: 'customer@croftcapital.com', defaultRoute: '/customer/dashboard' },
  ];

  for (const { role, email, defaultRoute } of testRoles) {
    const authRes = authenticateUser(email, 'finova2026');
    assert(
      `Authenticate ${role} (${email}) with email/password`,
      authRes.success === true && !!authRes.session && authRes.session.user.role === role,
      authRes.error
    );

    const isAllowed = isRouteAllowed(defaultRoute, role);
    assert(
      `${role} is permitted access to their dashboard: ${defaultRoute}`,
      isAllowed === true
    );

    // Cross-role security check: Customer must NEVER access Super Admin or Admin dashboards
    if (role === 'CUSTOMER') {
      const customerForbiddenSuperAdmin = isRouteAllowed('/super-admin/dashboard', 'CUSTOMER');
      const customerForbiddenAdmin = isRouteAllowed('/admin/dashboard', 'CUSTOMER');
      assert(
        'CUSTOMER is strictly forbidden from accessing /super-admin/dashboard',
        customerForbiddenSuperAdmin === false
      );
      assert(
        'CUSTOMER is strictly forbidden from accessing /admin/dashboard',
        customerForbiddenAdmin === false
      );
    }
  }

  // ----------------------------------------------------------------------------
  // TEST GROUP 3: Demo Persona Quick Launch & Isolation
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Demo Personas & Sandbox Session Isolation ---');

  const demoRes = authenticateDemoPersona('admin@finova.ai');
  assert(
    'Demo persona authenticates and sets isDemoMode: true',
    demoRes.success === true && demoRes.session?.isDemoMode === true && demoRes.session?.source === 'local'
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 4: Registration / Signup Flow & Strict Role Enforcement
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Institutional Customer Signup Flow ---');

  const testSignupEmail = `test.client.${Date.now()}@apexinvest.com`;
  const signupRes = registerCustomer({
    fullName: 'Jane Sterling',
    email: testSignupEmail,
    phone: '+1 (555) 839-2910',
    password: 'SecurePassword2026!',
    tenantId: 'tenant_apex_bank',
  });

  assert(
    'Customer registration succeeds with valid details',
    signupRes.success === true && !!signupRes.session
  );
  assert(
    'Customer registration strictly assigns CUSTOMER role (no privilege escalation)',
    signupRes.session?.user.role === 'CUSTOMER'
  );
  assert(
    'Customer registration correctly maps to selected tenant (tenant_apex_bank)',
    signupRes.session?.user.tenantId === 'tenant_apex_bank'
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 5: Sign Out & Session Cleansing
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Logout & Session Invalidation ---');

  await signOutUserAsync();
  const sessionAfterSignOut = getStoredSession();
  assert(
    'signOutUserAsync() successfully invalidates and clears the session',
    sessionAfterSignOut === null
  );

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runAuthVerification().catch((err) => {
  console.error('Fatal error during auth test execution:', err);
  process.exit(1);
});
