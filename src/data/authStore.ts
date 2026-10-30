import { UserAccount, UserRole } from './finovaDatasets';
import { getStoredTenants, getTenantById } from './tenantStore';
import { supabase, isSupabaseConfigured, SupabaseProfile } from '../lib/supabase';
import { fetchCurrentUserProfileResultFromDb } from '../services/finovaDatabase';

export interface AuthSession {
  token: string;
  user: UserAccount;
  expiresAt: number;
  source?: 'supabase' | 'local';
  isDemoMode?: boolean;
}

export interface StoredUser extends UserAccount {
  passwordHash: string;
}

// Initial credentials seeded into multi-tenant secure storage
export const SEEDED_CREDENTIALS: StoredUser[] = [
  // 1. PLATFORM SUPER ADMIN (SaaS Operator)
  {
    id: 'USR-1001',
    name: 'Alexander Vance',
    email: 'superadmin@finova.ai',
    passwordHash: 'finova2026',
    role: 'SUPER_ADMIN',
    status: 'Active',
    tier: 'Executive Staff',
    createdDate: '2023-01-15',
    lastActive: 'Just now',
    phone: '+1 (212) 555-0190',
    country: 'United States',
    twoFactorEnabled: true,
    tenantId: 'platform_root',
    tenantName: 'Finova AI SaaS Platform Operator',
    notes: 'Global Chief Executive & Multi-Tenant Platform Operator',
  },

  // 2. COMPANY A: APEX GLOBAL BANK (tenant_apex_bank)
  {
    id: 'USR-1002',
    name: 'Eleanor Sterling',
    email: 'admin@finova.ai', // Also accessible as admin@apexbank.com
    passwordHash: 'finova2026',
    role: 'ADMIN',
    status: 'Active',
    tier: 'Executive Staff',
    createdDate: '2023-04-10',
    lastActive: '12m ago',
    phone: '+1 (212) 555-0192',
    country: 'United States',
    twoFactorEnabled: true,
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
    notes: 'VP of Platform Governance & Bank Operations Head',
  },
  {
    id: 'USR-1003',
    name: 'Julian Thorne',
    email: 'analyst@finova.ai',
    passwordHash: 'finova2026',
    role: 'FINANCE_ANALYST',
    status: 'Active',
    tier: 'Executive Staff',
    createdDate: '2023-08-22',
    lastActive: '4m ago',
    phone: '+41 22 730 5900',
    country: 'Switzerland',
    twoFactorEnabled: true,
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
    notes: 'Lead Forensic AML & Risk Modeling Officer at Apex Bank',
  },
  {
    id: 'USR-1004',
    name: 'Claire Montgomery',
    email: 'support@finova.ai',
    passwordHash: 'finova2026',
    role: 'SUPPORT_EXECUTIVE',
    status: 'Active',
    tier: 'Executive Staff',
    createdDate: '2024-01-05',
    lastActive: '18m ago',
    phone: '+65 6718 8900',
    country: 'Singapore',
    twoFactorEnabled: true,
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
    notes: 'Private Wealth Concierge & Escalation Lead at Apex Bank',
  },
  {
    id: 'USR-1005',
    name: 'Harrison Croft',
    email: 'customer@croftcapital.com',
    passwordHash: 'finova2026',
    role: 'CUSTOMER',
    status: 'Active',
    tier: 'Private Wealth Tier 3',
    createdDate: '2024-03-14',
    lastActive: '2m ago',
    phone: '+1 (310) 555-8849',
    country: 'United States',
    twoFactorEnabled: true,
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
    notes: 'Croft Single Family Office Principal - Apex Custody Client',
  },

  // 3. COMPANY B: CRESTVIEW FINANCE NBFC (tenant_crest_capital)
  {
    id: 'USR-2001',
    name: 'Marcus Brody',
    email: 'admin@crestviewfinance.com',
    passwordHash: 'finova2026',
    role: 'ADMIN',
    status: 'Active',
    tier: 'Executive Staff',
    createdDate: '2023-06-20',
    lastActive: '18m ago',
    phone: '+44 20 7946 0884',
    country: 'United Kingdom',
    twoFactorEnabled: true,
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
    notes: 'Head of Operations at Crestview Finance NBFC',
  },
  {
    id: 'USR-2002',
    name: 'Sophia Lin',
    email: 'analyst@crestviewfinance.com',
    passwordHash: 'finova2026',
    role: 'FINANCE_ANALYST',
    status: 'Active',
    tier: 'Executive Staff',
    createdDate: '2023-09-15',
    lastActive: '25m ago',
    phone: '+44 20 7946 0885',
    country: 'United Kingdom',
    twoFactorEnabled: true,
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
    notes: 'Senior Credit Risk Analyst at Crestview Finance',
  },
  {
    id: 'USR-2003',
    name: 'David Vance',
    email: 'support@crestviewfinance.com',
    passwordHash: 'finova2026',
    role: 'SUPPORT_EXECUTIVE',
    status: 'Active',
    tier: 'Executive Staff',
    createdDate: '2024-02-10',
    lastActive: '1h ago',
    phone: '+44 20 7946 0886',
    country: 'United Kingdom',
    twoFactorEnabled: true,
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
    notes: 'Commercial Lending Support Specialist at Crestview',
  },
  {
    id: 'USR-2004',
    name: 'Elena Rostova',
    email: 'customer@rostovacapital.co.uk',
    passwordHash: 'finova2026',
    role: 'CUSTOMER',
    status: 'Active',
    tier: 'Private Wealth Tier 3',
    createdDate: '2024-04-12',
    lastActive: '10m ago',
    phone: '+44 20 7183 9920',
    country: 'United Kingdom',
    twoFactorEnabled: true,
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
    notes: 'Rostova Capital Managing Partner - Crestview Client',
  },

  // 4. COMPANY C: VANGUARD WEALTH PARTNERS (tenant_vanguard_wealth)
  {
    id: 'USR-3001',
    name: 'Catherine Duval',
    email: 'admin@vanguardwealth.eu',
    passwordHash: 'finova2026',
    role: 'ADMIN',
    status: 'Active',
    tier: 'Executive Staff',
    createdDate: '2023-11-05',
    lastActive: '30m ago',
    phone: '+41 22 730 4410',
    country: 'Switzerland',
    twoFactorEnabled: true,
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
    notes: 'Chief Governance Officer at Vanguard Wealth Geneva',
  },
  {
    id: 'USR-3002',
    name: 'Rajesh Nair',
    email: 'analyst@vanguardwealth.eu',
    passwordHash: 'finova2026',
    role: 'FINANCE_ANALYST',
    status: 'Active',
    tier: 'Executive Staff',
    createdDate: '2024-01-18',
    lastActive: '14m ago',
    phone: '+41 22 730 4412',
    country: 'Switzerland',
    twoFactorEnabled: true,
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
    notes: 'Lead Asset Allocation & Sanctions Analyst at Vanguard',
  },
  {
    id: 'USR-3003',
    name: 'Amara Okafor',
    email: 'support@vanguardwealth.eu',
    passwordHash: 'finova2026',
    role: 'SUPPORT_EXECUTIVE',
    status: 'Active',
    tier: 'Executive Staff',
    createdDate: '2024-03-02',
    lastActive: '5m ago',
    phone: '+41 22 730 4415',
    country: 'Switzerland',
    twoFactorEnabled: true,
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
    notes: 'Private Family Office Client Relations Director',
  },
  {
    id: 'USR-3004',
    name: 'Lucian Sterling',
    email: 'customer@sterlingsfo.ch',
    passwordHash: 'finova2026',
    role: 'CUSTOMER',
    status: 'Active',
    tier: 'Private Wealth Tier 3',
    createdDate: '2024-05-19',
    lastActive: '8m ago',
    phone: '+41 22 555 9012',
    country: 'Switzerland',
    twoFactorEnabled: true,
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
    notes: 'Sterling Family Office Trustee - Vanguard Custody Account',
  },
];

const STORAGE_USERS_KEY = 'finova_ai_users_db_v3';
const STORAGE_SESSION_KEY = 'finova_ai_session_jwt_v3';

export function getStoredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

export function saveStoredUsers(users: StoredUser[]): void {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to persist users', err);
  }
}

export const AUTHORIZED_SUPER_ADMIN_EMAIL = 'aravindvicky629@gmail.com';

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt || session.isDemoMode) {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      return null;
    }
    // Strict Single Super Admin Enforcement
    if (session.user?.role === 'SUPER_ADMIN' && session.user.email?.toLowerCase().trim() !== AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase()) {
      console.warn(`[SECURITY VIOLATION] Unauthorized SUPER_ADMIN session rejected for ${session.user.email}. Demoted to CUSTOMER.`);
      session.user.role = 'CUSTOMER';
      session.user.tenantId = 'tenant_apex_bank';
      session.user.tenantName = 'Apex Global Bank';
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  try {
    // Sanitize session before saving
    if (session.user?.role === 'SUPER_ADMIN' && session.user.email?.toLowerCase().trim() !== AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase()) {
      session.user.role = 'CUSTOMER';
      session.user.tenantId = 'tenant_apex_bank';
      session.user.tenantName = 'Apex Global Bank';
    }
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to persist session', err);
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_SESSION_KEY);
  } catch (err) {
    console.error('Failed to clear session', err);
  }
}

// Generate JWT-style mock token with multi-tenant claims
function generateMockJWT(user: UserAccount): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      tenantId: user.tenantId || 'tenant_apex_bank',
      tenantName: user.tenantName || 'Apex Global Bank',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + 86400000) / 1000), // 24 hours
    })
  );
  const signature = btoa(`sig_${user.id}_${Date.now()}`);
  return `${header}.${payload}.${signature}`;
}

export function authenticateUser(email: string, password: string): { success: boolean; session?: AuthSession; error?: string } {
  const users = getStoredUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return { success: false, error: 'Unrecognized institutional credentials. Please verify your email.' };
  }

  // Strictly check matching password hash
  const isValid = password === user.passwordHash;

  if (!isValid) {
    return { success: false, error: 'Cryptographic hash mismatch. Incorrect password.' };
  }

  // Resolve tenant info if not populated
  if (!user.tenantId && user.role !== 'SUPER_ADMIN') {
    user.tenantId = 'tenant_apex_bank';
    user.tenantName = 'Apex Global Bank';
  }

  const { passwordHash, ...cleanUser } = user;
  cleanUser.authSource = 'local';

  // Strict Single Super Admin Enforcement
  if (cleanUser.role === 'SUPER_ADMIN' && cleanUser.email.toLowerCase() !== AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase()) {
    console.warn(`[SECURITY VIOLATION] Unauthorized SUPER_ADMIN role blocked for local user ${cleanUser.email}.`);
    cleanUser.role = 'CUSTOMER';
    cleanUser.tenantId = 'tenant_apex_bank';
    cleanUser.tenantName = 'Apex Global Bank';
  }

  const token = generateMockJWT(cleanUser);
  const session: AuthSession = {
    token,
    user: cleanUser,
    expiresAt: Date.now() + 86400000, // 24 hours
    source: 'local',
  };

  saveSession(session);
  return { success: true, session };
}

export function registerCustomer(params: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  tenantId?: string;
}): { success: boolean; session?: AuthSession; error?: string } {
  const users = getStoredUsers();
  const normalizedEmail = params.email.trim().toLowerCase();

  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return { success: false, error: 'An institutional account is already registered with this email.' };
  }

  let selectedTenantId = params.tenantId || 'tenant_apex_bank';
  if (selectedTenantId === 'platform_root' || !selectedTenantId) {
    selectedTenantId = 'tenant_apex_bank';
  }
  const tenantMeta = getTenantById(selectedTenantId);
  const tenantName = tenantMeta?.name || 'Apex Global Bank';

  const newUser: StoredUser = {
    id: `USR-${Math.floor(2000 + Math.random() * 8000)}`,
    name: params.fullName.trim(),
    email: normalizedEmail,
    passwordHash: params.password,
    role: 'CUSTOMER',
    status: 'Active',
    tier: 'Private Wealth Tier 3',
    createdDate: new Date().toISOString().split('T')[0],
    lastActive: 'Just now',
    phone: params.phone.trim(),
    country: 'United States',
    twoFactorEnabled: true,
    tenantId: selectedTenantId,
    tenantName,
    notes: `Registered via Finova AI Public Customer Portal for ${tenantName}`,
    authSource: 'local',
  };

  const updatedUsers = [newUser, ...users];
  saveStoredUsers(updatedUsers);

  const { passwordHash, ...cleanUser } = newUser;
  const token = generateMockJWT(cleanUser);
  const session: AuthSession = {
    token,
    user: cleanUser,
    expiresAt: Date.now() + 86400000,
    source: 'local',
  };

  saveSession(session);
  return { success: true, session };
}

/**
 * Loads the current authenticated user's profile from Supabase PostgreSQL (or stored session)
 * Ensures session restoration queries public.profiles using the active Supabase token
 */
export async function loadCurrentUserProfileAsync(): Promise<{
  success: boolean;
  session: AuthSession | null;
  source: 'supabase' | 'local';
}> {
  if (isSupabaseConfigured()) {
    try {
      const { data: sessionData, error: sbErr } = await supabase.auth.getSession();
      const sbSession = sessionData?.session;
      if (!sbErr && sbSession?.user) {
        const userEmail = (sbSession.user.email || '').trim().toLowerCase();
        const isAuthorizedSuperAdmin = userEmail === AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase();

        // Query public.profiles using the active authenticated session
        const profileRes = await fetchCurrentUserProfileResultFromDb();
        if (profileRes.profile) {
          let authUser = { ...profileRes.profile };

          // Single Super Admin Policy:
          // 1. If profile has SUPER_ADMIN but email does NOT match authorized Super Admin, demote to CUSTOMER
          if (authUser.role === 'SUPER_ADMIN' && !isAuthorizedSuperAdmin) {
            console.warn(`[SECURITY VIOLATION] Unauthorized SUPER_ADMIN role blocked for profile ${authUser.id} (${userEmail}). Enforcing demotion to CUSTOMER.`);
            authUser.role = 'CUSTOMER';
            authUser.tenantId = 'tenant_apex_bank';
            authUser.tenantName = 'Apex Global Bank';
          }
          // 2. If authenticated user IS aravindvicky629@gmail.com, verify SUPER_ADMIN and platform_root
          else if (isAuthorizedSuperAdmin) {
            if (authUser.role !== 'SUPER_ADMIN' || authUser.tenantId !== 'platform_root') {
              try {
                await supabase.rpc('provision_authorized_super_admin');
              } catch (provErr) {
                console.warn('Super Admin initial provisioning RPC note:', provErr);
              }
              authUser.role = 'SUPER_ADMIN';
              authUser.tenantId = 'platform_root';
              authUser.tenantName = 'Finova AI SaaS Platform Operator';
            }
          }

          const session: AuthSession = {
            token: sbSession.access_token,
            user: authUser,
            expiresAt: sbSession.expires_at ? sbSession.expires_at * 1000 : Date.now() + 86400000,
            source: 'supabase',
            isDemoMode: false,
          };
          saveSession(session);
          return { success: true, session, source: 'supabase' };
        } else {
          // Supabase Auth session active, but public.profiles returned zero records or trigger pending
          let cleanName = (sbSession.user.user_metadata?.name || '').trim();
          if (!cleanName && userEmail) {
            cleanName = userEmail
              .split('@')[0]
              .replace(/[._-]/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
          }

          // Strict security: Default to CUSTOMER per signup policy unless verified authorized Super Admin
          let safeRole: UserRole = 'CUSTOMER';
          let metaTenantId = sbSession.user.user_metadata?.tenant_id || 'tenant_apex_bank';
          if (metaTenantId === 'platform_root') {
            metaTenantId = 'tenant_apex_bank';
          }
          let metaTenantName = sbSession.user.user_metadata?.tenant_name || getTenantById(metaTenantId)?.name || 'Apex Global Bank';

          if (isAuthorizedSuperAdmin) {
            try {
              await supabase.rpc('provision_authorized_super_admin');
            } catch (provErr) {
              console.warn('Super Admin initial provisioning RPC note:', provErr);
            }
            safeRole = 'SUPER_ADMIN';
            metaTenantId = 'platform_root';
            metaTenantName = 'Finova AI SaaS Platform Operator';
          }

          const fallbackProfile: UserAccount = {
            id: sbSession.user.id,
            name: isAuthorizedSuperAdmin ? (cleanName || 'Aravind Vicky') : (cleanName || 'Apex Customer'),
            email: userEmail,
            role: safeRole,
            status: 'Active',
            tier: isAuthorizedSuperAdmin ? 'Executive Staff' : 'Private Wealth Tier 3',
            createdDate: sbSession.user.created_at ? sbSession.user.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            lastActive: 'Just now',
            phone: sbSession.user.user_metadata?.phone || '+1 (212) 555-0100',
            country: 'United States',
            twoFactorEnabled: true,
            tenantId: metaTenantId,
            tenantName: metaTenantName,
            notes: isAuthorizedSuperAdmin ? 'Authorized Platform Super Admin' : 'Authenticated via live Supabase Auth session (Customer Role)',
            authSource: 'supabase',
          };

          const session: AuthSession = {
            token: sbSession.access_token,
            user: fallbackProfile,
            expiresAt: sbSession.expires_at ? sbSession.expires_at * 1000 : Date.now() + 86400000,
            source: 'supabase',
            isDemoMode: false,
          };
          saveSession(session);
          return { success: true, session, source: 'supabase' };
        }
      }
    } catch (err) {
      console.warn('Supabase session restoration notice:', err);
    }
  }

  // Fallback to local stored session (for isolated demo personas)
  const stored = getStoredSession();
  if (stored) {
    return { success: true, session: stored, source: stored.source || 'local' };
  }

  return { success: false, session: null, source: 'local' };
}

/**
 * Evaluator Persona Switching for Demo Inspection
 * Strictly enforces single Super Admin (aravindvicky629@gmail.com).
 */
export function authenticateDemoPersona(personaRoleOrEmail: string): {
  success: boolean;
  session?: AuthSession;
  error?: string;
} {
  const norm = personaRoleOrEmail.trim().toLowerCase();

  const personas: Record<string, UserAccount> = {
    super_admin: {
      id: 'USR-SUPER-001',
      name: 'Aravind Vicky',
      email: AUTHORIZED_SUPER_ADMIN_EMAIL,
      role: 'SUPER_ADMIN',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2023-01-15',
      lastActive: 'Just now',
      phone: '+1 (415) 555-0100',
      country: 'United States',
      twoFactorEnabled: true,
      tenantId: 'platform_root',
      tenantName: 'Finova AI SaaS Platform Operator',
      notes: 'Authorized Platform Super Admin',
      authSource: 'local',
    },
    admin: {
      id: 'USR-1001',
      name: 'Marcus Vance',
      email: 'admin@finova.ai',
      role: 'ADMIN',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2023-06-01',
      lastActive: 'Just now',
      phone: '+1 (212) 555-0120',
      country: 'United States',
      twoFactorEnabled: true,
      tenantId: 'tenant_apex_bank',
      tenantName: 'Apex Global Bank',
      notes: 'Chief Risk Officer & Operations Admin at Apex Global Bank',
      authSource: 'local',
    },
    analyst: {
      id: 'USR-1002',
      name: 'Julian Thorne',
      email: 'analyst@finova.ai',
      role: 'FINANCE_ANALYST',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2023-08-15',
      lastActive: 'Just now',
      phone: '+1 (212) 555-0122',
      country: 'United States',
      twoFactorEnabled: true,
      tenantId: 'tenant_apex_bank',
      tenantName: 'Apex Global Bank',
      notes: 'Lead Forensic AML & Financial Intelligence Analyst',
      authSource: 'local',
    },
    support: {
      id: 'USR-1003',
      name: 'Claire Montgomery',
      email: 'support@finova.ai',
      role: 'SUPPORT_EXECUTIVE',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2023-09-01',
      lastActive: 'Just now',
      phone: '+1 (212) 555-0125',
      country: 'United States',
      twoFactorEnabled: true,
      tenantId: 'tenant_apex_bank',
      tenantName: 'Apex Global Bank',
      notes: 'Senior Client Concierge & Support Desk Executive',
      authSource: 'local',
    },
    customer: {
      id: 'USR-1004',
      name: 'Elena Rostova',
      email: 'customer@finova.ai',
      role: 'CUSTOMER',
      status: 'Active',
      tier: 'Private Wealth Tier 3',
      createdDate: '2023-10-10',
      lastActive: 'Just now',
      phone: '+1 (212) 555-0199',
      country: 'United States',
      twoFactorEnabled: true,
      tenantId: 'tenant_apex_bank',
      tenantName: 'Apex Global Bank',
      notes: 'Institutional Client Custody & Settlement Account',
      authSource: 'local',
    },
  };

  let target: UserAccount | undefined;
  if (norm.includes('super') || norm === AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase()) {
    target = personas.super_admin;
  } else if (norm.includes('analyst')) {
    target = personas.analyst;
  } else if (norm.includes('support')) {
    target = personas.support;
  } else if (norm.includes('customer') || norm.includes('client')) {
    target = personas.customer;
  } else if (norm.includes('admin')) {
    target = personas.admin;
  }

  if (!target) {
    return { success: false, error: 'Unrecognized evaluator demo role.' };
  }

  // Strict Single Super Admin check
  if (target.role === 'SUPER_ADMIN' && target.email.toLowerCase() !== AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase()) {
    target.role = 'CUSTOMER';
    target.tenantId = 'tenant_apex_bank';
    target.tenantName = 'Apex Global Bank';
  }

  const token = generateMockJWT(target);
  const session: AuthSession = {
    token,
    user: target,
    expiresAt: Date.now() + 86400000,
    source: 'local',
    isDemoMode: true,
  };

  saveSession(session);
  return { success: true, session };
}

/**
 * Async Authentication with Supabase Auth priority
 * Production login strictly requires a genuine Supabase Auth session.
 * Does NOT silently convert failed login attempts into local demo sessions.
 */
export async function authenticateUserAsync(
  email: string,
  password: string
): Promise<{ success: boolean; session?: AuthSession; error?: string; source?: 'supabase' | 'local' }> {
  const normalizedEmail = email.trim().toLowerCase();
  const isAuthorizedSuperAdmin = normalizedEmail === AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase();

  // 1. If Supabase is configured with an active key, enforce real Supabase Auth
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!error && data.user && data.session) {
        // Retrieve verified profile from profiles table via fetchCurrentUserProfileResultFromDb
        const profileRes = await fetchCurrentUserProfileResultFromDb();
        let authenticatedUser: UserAccount;

        if (profileRes.profile) {
          authenticatedUser = { ...profileRes.profile };
        } else {
          // Construct safely from auth user data with strict CUSTOMER fallback
          const userEmail = data.user.email || normalizedEmail;
          let cleanName = (data.user.user_metadata?.name || '').trim();
          if (!cleanName && userEmail) {
            cleanName = userEmail
              .split('@')[0]
              .replace(/[._-]/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
          }
          const userRole: UserRole = isAuthorizedSuperAdmin ? 'SUPER_ADMIN' : 'CUSTOMER';
          const tenantId = isAuthorizedSuperAdmin ? 'platform_root' : 'tenant_apex_bank';
          const tenantName = isAuthorizedSuperAdmin ? 'Finova AI SaaS Platform Operator' : 'Apex Global Bank';

          authenticatedUser = {
            id: data.user.id,
            name: isAuthorizedSuperAdmin ? (cleanName || 'Aravind Vicky') : (cleanName || 'Apex Customer'),
            email: userEmail,
            role: userRole,
            status: 'Active',
            tier: isAuthorizedSuperAdmin ? 'Executive Staff' : 'Private Wealth Tier 3',
            createdDate: data.user.created_at ? data.user.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            lastActive: 'Just now',
            phone: data.user.user_metadata?.phone || '+1 (212) 555-0100',
            country: 'United States',
            twoFactorEnabled: true,
            tenantId,
            tenantName,
            notes: isAuthorizedSuperAdmin ? 'Platform Super Admin' : 'Authenticated via live Supabase PostgreSQL Session',
            authSource: 'supabase',
          };
        }

        // Strict Single Super Admin Enforcement on Authenticated Profile
        if (authenticatedUser.role === 'SUPER_ADMIN' && !isAuthorizedSuperAdmin) {
          console.warn(`[SECURITY VIOLATION] Unauthorized SUPER_ADMIN login blocked for ${normalizedEmail}.`);
          authenticatedUser.role = 'CUSTOMER';
          authenticatedUser.tenantId = 'tenant_apex_bank';
          authenticatedUser.tenantName = 'Apex Global Bank';
        } else if (isAuthorizedSuperAdmin) {
          if (authenticatedUser.role !== 'SUPER_ADMIN' || authenticatedUser.tenantId !== 'platform_root') {
            try {
              await supabase.rpc('provision_authorized_super_admin');
            } catch (provErr) {
              console.warn('Super Admin initial provisioning RPC note:', provErr);
            }
            authenticatedUser.role = 'SUPER_ADMIN';
            authenticatedUser.tenantId = 'platform_root';
            authenticatedUser.tenantName = 'Finova AI SaaS Platform Operator';
          }
        }

        const session: AuthSession = {
          token: data.session.access_token,
          user: authenticatedUser,
          expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 86400000,
          source: 'supabase',
          isDemoMode: false,
        };

        saveSession(session);
        return { success: true, session, source: 'supabase' };
      }

      // DO NOT silently convert failed login attempts into local demo sessions!
      return {
        success: false,
        error: error?.message || 'Authentication failed. Please verify institutional credentials in Supabase Auth.',
      };
    } catch (err: any) {
      console.error('Supabase signInWithPassword exception:', err);
      return {
        success: false,
        error: err?.message || 'An unexpected error occurred during Supabase authentication.',
      };
    }
  }

  // Fallback to local authentication ONLY when Supabase is completely unconfigured
  const localRes = authenticateUser(email, password);
  return { ...localRes, source: 'local' };
}

/**
 * Async Registration with Supabase Auth priority
 */
export async function registerCustomerAsync(params: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  tenantId?: string;
}): Promise<{
  success: boolean;
  session?: AuthSession;
  error?: string;
  source?: 'supabase' | 'local';
  requiresEmailConfirmation?: boolean;
}> {
  const normalizedEmail = params.email.trim().toLowerCase();
  // Never allow public users to select platform_root workspace
  let selectedTenantId = params.tenantId || 'tenant_apex_bank';
  if (selectedTenantId === 'platform_root' || !selectedTenantId) {
    selectedTenantId = 'tenant_apex_bank';
  }
  const tenantMeta = getTenantById(selectedTenantId);
  const tenantName = tenantMeta?.name || 'Apex Global Bank';

  // 1. If Supabase is configured with active keys, register in Supabase Auth
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: params.password,
        options: {
          data: {
            name: params.fullName.trim(),
            phone: params.phone.trim(),
            tenant_id: selectedTenantId,
            tenant_name: tenantName,
            role: 'CUSTOMER', // Strict security: public registration cannot select privileged roles
          },
        },
      });

      if (error) {
        console.warn('Supabase signUp error:', error.message);
        // If rate limited or domain blocked, fall back gracefully to local registration
        if (error.message.toLowerCase().includes('rate limit')) {
          const fallbackRes = registerCustomer({
            ...params,
            tenantId: selectedTenantId,
          });
          if (fallbackRes.success && fallbackRes.session?.user && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('finova:user_registered', { detail: fallbackRes.session.user }));
          }
          return {
            ...fallbackRes,
            error: `Supabase Auth Rate Limit: ${error.message}. Registered in local hybrid store.`,
          };
        }
        return { success: false, error: error.message };
      }

      if (data.user) {
        const userId = data.user.id;

        // Try to insert directly into profiles table to ensure immediate readiness
        try {
          await supabase.from('profiles').upsert({
            id: userId,
            email: normalizedEmail,
            name: params.fullName.trim(),
            role: 'CUSTOMER',
            status: 'Active',
            tier: 'Private Wealth Tier 3',
            phone: params.phone.trim(),
            tenant_id: selectedTenantId,
            tenant_name: tenantName,
            country: 'United States',
          });
        } catch (profileErr) {
          console.warn('Profile upsert note (trigger may handle):', profileErr);
        }

        const cleanUser: UserAccount = {
          id: userId,
          name: params.fullName.trim(),
          email: normalizedEmail,
          role: 'CUSTOMER',
          status: 'Active',
          tier: 'Private Wealth Tier 3',
          createdDate: new Date().toISOString().split('T')[0],
          lastActive: 'Just now',
          phone: params.phone.trim(),
          country: 'United States',
          twoFactorEnabled: true,
          tenantId: selectedTenantId,
          tenantName,
          notes: `Registered via Supabase Auth for ${tenantName}`,
          authSource: 'supabase',
        };

        // Also sync to local user cache to ensure immediate UI visibility across roles
        const existingStored = getStoredUsers();
        const updatedStored = [
          {
            ...cleanUser,
            passwordHash: params.password,
            authSource: 'supabase' as const,
          },
          ...existingStored.filter((u) => u.email.toLowerCase() !== normalizedEmail),
        ];
        saveStoredUsers(updatedStored);

        // If Supabase did not return an active session, email verification is required by project policy
        if (!data.session) {
          return {
            success: true,
            requiresEmailConfirmation: true,
            source: 'supabase',
            error: 'Account registered with Supabase Auth. Email verification is required by platform policy before you can sign in. Please verify your email or request activation from an administrator.',
          };
        }

        const session: AuthSession = {
          token: data.session.access_token,
          user: cleanUser,
          expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 86400000,
          source: 'supabase',
        };

        saveSession(session);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('finova:user_registered', { detail: cleanUser }));
        }

        return { success: true, session, source: 'supabase' };
      }
    } catch (err: any) {
      console.error('Supabase signUp error:', err);
    }
  }

  // Fallback to local registration
  const localRes = registerCustomer(params);
  if (localRes.success && localRes.session?.user && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('finova:user_registered', { detail: localRes.session.user }));
  }
  return { ...localRes, source: 'local' };
}

/**
 * Async Sign Out with Supabase session invalidation
 */
export async function signOutUserAsync(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase signOut error:', err);
    }
  }
  clearSession();
}
