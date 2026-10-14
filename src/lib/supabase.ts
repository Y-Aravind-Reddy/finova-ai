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
    const { error: authError } = await supabase.auth.getSession();
    if (authError) {
      return {
        configured: true,
        connected: false,
        url: SUPABASE_PROJECT_URL,
        message: 'Supabase URL reached but auth returned an error.',
        error: authError.message,
      };
    }

    // Probe existing tables
    const tableStatus = {
      profiles: false,
      transactions: false,
      fraud_cases: false,
      support_tickets: false,
      tenant_workspaces: false,
    };

    try {
      const { error: pErr } = await supabase.from('profiles').select('id').limit(1);
      if (!pErr) tableStatus.profiles = true;
    } catch {
      // table might not exist
    }

    try {
      const { error: tErr } = await supabase.from('transactions').select('id').limit(1);
      if (!tErr) tableStatus.transactions = true;
    } catch {
      // table might not exist
    }

    try {
      const { error: fErr } = await supabase.from('fraud_cases').select('id').limit(1);
      if (!fErr) tableStatus.fraud_cases = true;
    } catch {
      // table might not exist
    }

    try {
      const { error: sErr } = await supabase.from('support_tickets').select('ticket_id').limit(1);
      if (!sErr) tableStatus.support_tickets = true;
    } catch {
      // table might not exist
    }

    try {
      const { error: wErr } = await supabase.from('tenant_workspaces').select('id').limit(1);
      if (!wErr) tableStatus.tenant_workspaces = true;
    } catch {
      // table might not exist
    }

    return {
      configured: true,
      connected: true,
      url: SUPABASE_PROJECT_URL,
      message: 'Successfully connected to Supabase project.',
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
