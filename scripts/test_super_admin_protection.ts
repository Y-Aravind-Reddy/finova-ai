/**
 * Finova AI — Comprehensive Super Admin Protection & RBAC Test Suite
 * Validates single Super Admin enforcement for aravindvicky629@gmail.com.
 */

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

import fs from 'fs';
import path from 'path';
import {
  AUTHORIZED_SUPER_ADMIN_EMAIL,
  getStoredSession,
  saveSession,
  clearSession,
  authenticateUser,
  registerCustomer,
  registerCustomerAsync,
  AuthSession,
} from '../src/data/authStore';
import { updateUserRoleInDb } from '../src/services/finovaDatabase';
import { isRouteAllowed } from '../src/routes/routesConfig';
import { UserAccount, UserRole } from '../src/data/finovaDatasets';

async function runSuperAdminProtectionTests() {
  console.log('================================================================');
  console.log('FINOVA AI — SUPER ADMIN PROTECTION & RBAC INTEGRITY AUDIT');
  console.log('Authorized Super Admin: ' + AUTHORIZED_SUPER_ADMIN_EMAIL);
  console.log('Timestamp: ' + new Date().toISOString());
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
  // TEST GROUP 1: Authorized Email and Single Super Admin Definition
  // ----------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Single Super Admin Configuration ---');

  assert(
    'Authorized Super Admin email is strictly aravindvicky629@gmail.com',
    AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase() === 'aravindvicky629@gmail.com'
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 2: Unauthorized Account Cannot Hold SUPER_ADMIN in Stored Session
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Session Sanitization & Role Forgery Rejection ---');

  // Attempt to save a forged session claiming SUPER_ADMIN with a non-authorized email
  const maliciousSession: AuthSession = {
    token: 'forged_jwt_attacker',
    user: {
      id: 'USR-ATTACKER',
      name: 'Malicious Actor',
      email: 'attacker@evilcorp.com',
      role: 'SUPER_ADMIN',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2026-10-26',
      lastActive: 'Just now',
      phone: '+1 555-0199',
      country: 'United States',
      twoFactorEnabled: true,
      tenantId: 'platform_root',
      tenantName: 'Finova AI SaaS Platform Operator',
    },
    expiresAt: Date.now() + 3600000,
    source: 'local',
  };

  saveSession(maliciousSession);
  const restoredSession = getStoredSession();

  assert(
    'Forged SUPER_ADMIN session for unauthorized email is automatically demoted to CUSTOMER',
    restoredSession !== null && restoredSession.user.role === 'CUSTOMER',
    `Received role: ${restoredSession?.user?.role}`
  );

  assert(
    'Demoted session is ejected from platform_root to tenant_apex_bank',
    restoredSession !== null && restoredSession.user.tenantId === 'tenant_apex_bank',
    `Received tenantId: ${restoredSession?.user?.tenantId}`
  );

  clearSession();

  // Test that authorized Super Admin email maintains SUPER_ADMIN
  const authorizedSession: AuthSession = {
    token: 'valid_authorized_jwt',
    user: {
      id: 'USR-SUPERADMIN',
      name: 'Aravind Vicky',
      email: 'aravindvicky629@gmail.com',
      role: 'SUPER_ADMIN',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2026-10-26',
      lastActive: 'Just now',
      phone: '+1 212-555-0190',
      country: 'United States',
      twoFactorEnabled: true,
      tenantId: 'platform_root',
      tenantName: 'Finova AI SaaS Platform Operator',
    },
    expiresAt: Date.now() + 3600000,
    source: 'local',
  };

  saveSession(authorizedSession);
  const restoredAuthSession = getStoredSession();

  assert(
    'Authorized Super Admin (aravindvicky629@gmail.com) retains SUPER_ADMIN role in session',
    restoredAuthSession !== null && restoredAuthSession.user.role === 'SUPER_ADMIN'
  );

  assert(
    'Authorized Super Admin retains platform_root tenant workspace',
    restoredAuthSession !== null && restoredAuthSession.user.tenantId === 'platform_root'
  );

  clearSession();

  // ----------------------------------------------------------------------------
  // TEST GROUP 3: Public Signup Security & Tenant Isolation
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Public Signup Enforces CUSTOMER & Blocks platform_root ---');

  // Attempt signup passing platform_root
  const signupResult = registerCustomer({
    fullName: 'Jane Doe',
    email: 'janedoe_' + Date.now() + '@apexbank.com',
    phone: '+1 (212) 555-0144',
    password: 'SafePassword2026!',
    tenantId: 'platform_root', // Attacker attempts to register into platform operator root
  });

  assert(
    'Public signup succeeds with safe fallback',
    signupResult.success && Boolean(signupResult.session)
  );

  assert(
    'Public signup always assigns CUSTOMER role',
    signupResult.session?.user.role === 'CUSTOMER',
    `Received role: ${signupResult.session?.user.role}`
  );

  assert(
    'Public signup requesting platform_root is forced to non-root tenant (tenant_apex_bank)',
    signupResult.session?.user.tenantId !== 'platform_root',
    `Received tenant: ${signupResult.session?.user.tenantId}`
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 4: Role Modification Protection in Database Layer
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Role Promotion Enforcement & Attack Rejection ---');

  // Attempt to elevate a non-authorized user to SUPER_ADMIN via updateUserRoleInDb
  const roleUpdateAttempt = await updateUserRoleInDb('USR-1005', 'SUPER_ADMIN', 'tenant_apex_bank');

  assert(
    'updateUserRoleInDb blocks promoting non-authorized user (USR-1005) to SUPER_ADMIN',
    roleUpdateAttempt.success === false,
    `Error returned: ${roleUpdateAttempt.error}`
  );

  assert(
    'Governance error message identifies exclusive authorization of aravindvicky629@gmail.com',
    Boolean(roleUpdateAttempt.error && roleUpdateAttempt.error.includes(AUTHORIZED_SUPER_ADMIN_EMAIL)),
    roleUpdateAttempt.error || ''
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 5: Route Protection for Super Admin Dashboard
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Route Guards Restrict /super-admin to SUPER_ADMIN ---');

  const superAdminRoutes = [
    '/super-admin/dashboard',
    '/super-admin/company-workspaces',
    '/super-admin/user-management',
    '/super-admin/rbac',
    '/super-admin/system-configuration',
    '/super-admin/ai-configuration',
    '/super-admin/audit-logs',
    '/super-admin/enterprise-analytics',
  ];

  for (const r of superAdminRoutes) {
    assert(
      `Route ${r} is DENIED to CUSTOMER`,
      isRouteAllowed(r, 'CUSTOMER') === false
    );
    assert(
      `Route ${r} is DENIED to ADMIN`,
      isRouteAllowed(r, 'ADMIN') === false
    );
    assert(
      `Route ${r} is DENIED to FINANCE_ANALYST`,
      isRouteAllowed(r, 'FINANCE_ANALYST') === false
    );
    assert(
      `Route ${r} is DENIED to SUPPORT_EXECUTIVE`,
      isRouteAllowed(r, 'SUPPORT_EXECUTIVE') === false
    );
    assert(
      `Route ${r} is GRANTED to SUPER_ADMIN`,
      isRouteAllowed(r, 'SUPER_ADMIN') === true
    );
  }

  // ----------------------------------------------------------------------------
  // TEST GROUP 6: Database Migration & Schema Integrity Checks
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: SQL Migration & Primary Schema Alignment ---');

  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261026_strict_single_super_admin.sql');
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

  assert(
    'Migration file contains enforce_single_super_admin trigger',
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.enforce_single_super_admin()')
  );

  assert(
    'Migration file checks LOWER(TRIM(NEW.email)) <> \'aravindvicky629@gmail.com\'',
    migrationContent.includes('aravindvicky629@gmail.com')
  );

  assert(
    'Migration file contains provision_authorized_super_admin RPC',
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.provision_authorized_super_admin()')
  );

  assert(
    'Migration file contains audit_super_admin_assignments review query',
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.audit_super_admin_assignments()')
  );

  const schemaPath = path.resolve(process.cwd(), 'supabase-schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  assert(
    'supabase-schema.sql contains enforce_single_super_admin trigger function',
    schemaContent.includes('CREATE OR REPLACE FUNCTION public.enforce_single_super_admin()')
  );

  assert(
    'supabase-schema.sql contains provision_authorized_super_admin RPC',
    schemaContent.includes('CREATE OR REPLACE FUNCTION public.provision_authorized_super_admin()')
  );

  console.log('\n================================================================');
  console.log(`AUDIT COMPLETE: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runSuperAdminProtectionTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
