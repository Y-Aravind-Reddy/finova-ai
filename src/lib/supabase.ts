import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserAccount, UserRole } from '../data/finovaDatasets';

// Project configuration from user specifications
const envUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://rjudrmnnpwlovpkbwnte.supabase.co';

export const SUPABASE_PROJECT_URL = envUrl
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' &&
    ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
     (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY)) ||
  (typeof process !== 'undefined' &&
    (process.env?.VITE_SUPABASE_ANON_KEY ||
     process.env?.VITE_SUPABASE_PUBLISHABLE_KEY)) ||
  '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_PROJECT_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_ANON_KEY.trim().length > 10 &&
    !SUPABASE_ANON_KEY.includes('your_supabase')
  );
};

// Single shared Supabase client
export const supabase: SupabaseClient = createClient(
  SUPABASE_PROJECT_URL,
  SUPABASE_ANON_KEY || 'placeholder_anon_key_for_initialization',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export interface SupabaseProfile {
  id: string; // references auth.users(id)
  email: string;
  name: string;
  role: UserRole;
  status: 'Active' | 'Suspended' | 'Pending Review' | 'KYC Pending';
  tier: 'Private Wealth Tier 3' | 'Platinum Tier 2' | 'Gold Tier 1' | 'Executive Staff';
  phone?: string;
  country?: string;
  two_factor_enabled?: boolean;
  tenant_id: string;
  tenant_name?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ConnectionStatus {
  configured: boolean;
  connected: boolean;
  url: string;
  message: string;
  error?: string;
  tables?: {
    profiles: boolean;
    transactions: boolean;
    fraud_cases: boolean;
    support_tickets: boolean;
    tenant_workspaces: boolean;
  };
}

/**
 * Test live connection to the Supabase project
 */
export async function checkSupabaseConnection(): Promise<ConnectionStatus> {
  const configured = isSupabaseConfigured();

  if (!configured) {
    return {
      configured: false,
      connected: false,
      url: SUPABASE_PROJECT_URL,
      message: 'Supabase credentials not yet detected in environment variables. Running in local hybrid mode.',
    };
  }

  try {
    // Attempt a light ping against auth
    const { data: sessionData, error: authError } = await supabase.auth.getSession();
    if (authError) {
      return {
        configured: true,
        connected: false,
        url: SUPABASE_PROJECT_URL,
        message: 'Supabase URL reached but auth returned an error.',
        error: authError.message,
      };
    }

    const tableStatus = {
      profiles: false,
      transactions: false,
      fraud_cases: false,
      support_tickets: false,
      tenant_workspaces: false,
    };

    // Always verify public REST connectivity against safe public.exchange_rates (never probe private tables as anon)
    let restReachable = false;
    try {
      const { error: fxErr } = await supabase.from('exchange_rates').select('id').limit(1);
      if (!fxErr) restReachable = true;
    } catch {
      // ignore
    }

    // Only verify user profile access when an authenticated Supabase session exists
    if (sessionData?.session?.user) {
      try {
        const { error: pErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', sessionData.session.user.id)
          .limit(1);
        if (!pErr) tableStatus.profiles = true;
      } catch {
        // ignore
      }
    }

    return {
      configured: true,
      connected: true,
      url: SUPABASE_PROJECT_URL,
      message: restReachable
        ? 'Successfully connected to Supabase project.'
        : 'Supabase Auth connected; protected table telemetry activates upon sign-in.',
      tables: tableStatus,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      connected: false,
      url: SUPABASE_PROJECT_URL,
      message: 'Network error communicating with Supabase.',
      error: errorMsg,
    };
  }
}

/**
 * Initiates Google OAuth with Supabase Auth
 * (Temporarily disabled: returns an explicit maintenance error to prevent triggering broken flow)
 */
export async function signInWithGoogleOAuth(): Promise<{ url?: string; error?: string }> {
  return {
    error: 'Google Workspace Sign-In is temporarily disabled. Please authenticate using your corporate email and password.',
  };
}

