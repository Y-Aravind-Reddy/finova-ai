import { supabase, isSupabaseConfigured, SupabaseProfile } from '../lib/supabase';
import {
  CustomerTransaction,
  FinanceFraudTransaction,
  SupportTicket,
  UserAccount,
  UserRole,
  CustomerDocument,
} from '../data/finovaDatasets';
import {
  getTransactionsForTenant,
  getFraudTransactionsForTenant,
  getTicketsForTenant,
} from '../data/tenantDatasets';
import {
  TenantWorkspace,
  getStoredTenants,
  getTenantById,
  saveStoredTenants,
  updateTenant,
  createTenant,
} from '../data/tenantStore';
import { getStoredUsers, saveStoredUsers, StoredUser } from '../data/authStore';

export type QueryResultState =
  | 'live_records'
  | 'zero_records'
  | 'demo_session_rls'
  | 'query_error'
  | 'unconfigured';

export interface DatabaseQueryResult<T> {
  data: T;
  source: 'supabase' | 'fallback';
  error: string | null;
  count: number;
  state: QueryResultState;
  details?: string;
  hasAuthSession?: boolean;
}

export interface StatusStoreEntry {
  source: 'supabase' | 'fallback';
  error: string | null;
  state?: QueryResultState;
  details?: string;
}

// Global query status tracker so dashboards can display live status vs fallback error
export const databaseStatusStore: {
  transactions: StatusStoreEntry;
  fraudCases: StatusStoreEntry;
  supportTickets: StatusStoreEntry;
  profiles: StatusStoreEntry;
  tenantWorkspaces: StatusStoreEntry;
  kycRecords: StatusStoreEntry;
} = {
  transactions: { source: 'fallback', error: null, state: 'unconfigured' },
  fraudCases: { source: 'fallback', error: null, state: 'unconfigured' },
  supportTickets: { source: 'fallback', error: null, state: 'unconfigured' },
  profiles: { source: 'fallback', error: null, state: 'unconfigured' },
  tenantWorkspaces: { source: 'fallback', error: null, state: 'unconfigured' },
  kycRecords: { source: 'fallback', error: null, state: 'unconfigured' },
};

/**
 * Checks whether the client currently holds an authenticated Supabase user session
 */
export async function checkHasSupabaseAuthSession(client: any = supabase): Promise<boolean> {
  try {
    if (!client?.auth?.getSession) return false;
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) return false;
    return Boolean(data.session.user);
  } catch {
    return false;
  }
}

/**
 * Fetch Customer Transactions with Supabase priority, transparent error reporting, and tenant fallback
 */
export async function fetchTransactionsResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  clientOverride?: any
): Promise<DatabaseQueryResult<CustomerTransaction[]>> {
  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  if (!configured || !client) {
    const errorMsg = 'Supabase client not configured (missing URL or anon key)';
    databaseStatusStore.transactions = {
      source: 'fallback',
      error: errorMsg,
      state: 'unconfigured',
      details: 'Supabase credentials are not configured in the application environment.',
    };
    const fallback = getTransactionsForTenant(tenantId);
    return {
      data: fallback,
      source: 'fallback',
      error: errorMsg,
      count: fallback.length,
      state: 'unconfigured',
      details: 'Supabase client is not configured; using local tenant demo dataset.',
      hasAuthSession: false,
    };
  }

  try {
    let query = client
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (tenantId && tenantId !== 'ALL') {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    // Check for query execution / permission errors
    if (error) {
      const errorMsg = `${error.code || 'ERR'}: ${error.message || 'Database query failed'}`;
      databaseStatusStore.transactions = {
        source: 'fallback',
        error: errorMsg,
        state: 'query_error',
        details: error.message,
      };
      const fallback = getTransactionsForTenant(tenantId);
      return {
        data: fallback,
        source: 'fallback',
        error: errorMsg,
        count: fallback.length,
        state: 'query_error',
        details: `Supabase query failed: ${error.message}`,
        hasAuthSession: false,
      };
    }

    // Determine whether an authenticated Supabase session exists
    const hasAuthSession = await checkHasSupabaseAuthSession(client);

    // Case 1: Supabase query succeeded with records
    if (data && data.length > 0) {
      databaseStatusStore.transactions = {
        source: 'supabase',
        error: null,
        state: 'live_records',
        details: `Loaded ${data.length} live records from Supabase transactions table.`,
      };
      const mapped: CustomerTransaction[] = data.map((t: any) => ({
        id: t.id,
        date: t.date || new Date().toISOString().split('T')[0],
        merchant: t.merchant || 'Institutional Wire',
        category: t.category || 'Securities & Equities',
        amount: Number(t.amount) || 0,
        type: (t.type === 'Credit' ? 'Credit' : 'Debit') as 'Credit' | 'Debit',
        status: (t.status || 'Settled') as 'Settled' | 'Escrow Secured' | 'Clearing',
        referenceNo: t.reference_no || t.id,
        tenantId: t.tenant_id,
        tenantName: t.tenant_name,
      }));
      return {
        data: mapped,
        source: 'supabase',
        error: null,
        count: mapped.length,
        state: 'live_records',
        details: `Retrieved ${mapped.length} live rows from Supabase.`,
        hasAuthSession,
      };
    }

    // Case 2: Supabase query succeeded with 0 records
    if (hasAuthSession) {
      // Authenticated user: table genuinely has 0 records for this tenant
      databaseStatusStore.transactions = {
        source: 'supabase',
        error: null,
        state: 'zero_records',
        details: `Live Supabase table queried successfully; 0 records exist for tenant ${tenantId}.`,
      };
      return {
        data: [],
        source: 'supabase',
        error: null,
        count: 0,
        state: 'zero_records',
        details: `Authenticated query returned 0 records from Supabase transactions table for tenant ${tenantId}.`,
        hasAuthSession: true,
      };
    } else {
      // Demo session without Supabase Auth session: RLS policy restricts anon queries to 0 rows.
      // Display tenant demo dataset so demo workflows function, but transparently flag as fallback.
      const notice = 'Demo session active: Supabase RLS requires an authenticated Supabase user session to read live rows. Displaying tenant demo dataset.';
      databaseStatusStore.transactions = {
        source: 'fallback',
        error: notice,
        state: 'demo_session_rls',
        details: 'Postgres RLS restricts anon queries. Sign in with Supabase Auth credentials to view live rows.',
      };
      const fallback = getTransactionsForTenant(tenantId);
      return {
        data: fallback,
        source: 'fallback',
        error: notice,
        count: fallback.length,
        state: 'demo_session_rls',
        details: 'Supabase table is connected (200 OK), but RLS restricts unauthenticated/demo queries. Displaying verified demo dataset.',
        hasAuthSession: false,
      };
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Network error querying Supabase';
    databaseStatusStore.transactions = {
      source: 'fallback',
      error: errorMsg,
      state: 'query_error',
      details: errorMsg,
    };
    const fallback = getTransactionsForTenant(tenantId);
    return {
      data: fallback,
      source: 'fallback',
      error: errorMsg,
      count: fallback.length,
      state: 'query_error',
      details: `Unexpected error querying Supabase: ${errorMsg}`,
      hasAuthSession: false,
    };
  }
}

/**
 * Fetch Customer Transactions with Supabase priority and tenant fallback
 */
export async function fetchTransactionsFromDb(tenantId: string = 'tenant_apex_bank'): Promise<CustomerTransaction[]> {
  const result = await fetchTransactionsResultFromDb(tenantId);
  return result.data;
}

/**
 * Fetch Fraud & AML Cases with Supabase priority, transparent error reporting, and tenant fallback
 */
export async function fetchFraudCasesResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  clientOverride?: any
): Promise<DatabaseQueryResult<FinanceFraudTransaction[]>> {
  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  if (!configured || !client) {
    const errorMsg = 'Supabase client not configured (missing URL or anon key)';
    databaseStatusStore.fraudCases = {
      source: 'fallback',
      error: errorMsg,
      state: 'unconfigured',
      details: 'Supabase credentials are not configured in the application environment.',
    };
    const fallback = getFraudTransactionsForTenant(tenantId);
    return {
      data: fallback,
      source: 'fallback',
      error: errorMsg,
      count: fallback.length,
      state: 'unconfigured',
      details: 'Supabase client is not configured; using local tenant demo dataset.',
      hasAuthSession: false,
    };
  }

  try {
    let query = client
      .from('fraud_cases')
      .select('*')
      .order('timestamp', { ascending: false });

    if (tenantId && tenantId !== 'ALL') {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      const errorMsg = `${error.code || 'ERR'}: ${error.message || 'Database query failed'}`;
      databaseStatusStore.fraudCases = {
        source: 'fallback',
        error: errorMsg,
        state: 'query_error',
        details: error.message,
      };
      const fallback = getFraudTransactionsForTenant(tenantId);
      return {
        data: fallback,
        source: 'fallback',
        error: errorMsg,
        count: fallback.length,
        state: 'query_error',
        details: `Supabase query failed: ${error.message}`,
        hasAuthSession: false,
      };
    }

    const hasAuthSession = await checkHasSupabaseAuthSession(client);

    if (data && data.length > 0) {
      databaseStatusStore.fraudCases = {
        source: 'supabase',
        error: null,
        state: 'live_records',
        details: `Loaded ${data.length} live records from Supabase fraud_cases table.`,
      };
      const mapped: FinanceFraudTransaction[] = data.map((f: any) => ({
        id: f.id,
        timestamp: f.timestamp || 'Just now',
        customerName: f.customer_name || 'Anonymous Client',
        customerId: f.customer_id || 'CUST-000',
        amount: Number(f.amount) || 0,
        currency: f.currency || 'USD',
        riskScore: Number(f.risk_score) || 50,
        amlFlag: f.aml_flag || 'Clean / Verified',
        status: (f.status || 'Flagged') as 'Flagged' | 'In Review' | 'Cleared' | 'Frozen Escrow',
        location: f.location || 'Global Rail',
        paymentChannel: f.payment_channel || 'SWIFT GPI',
        ruleTriggered: f.rule_triggered || 'Standard Surveillance',
        aiConfidencePct: Number(f.ai_confidence_pct) || 98.4,
        tenantId: f.tenant_id,
        tenantName: f.tenant_name,
      }));
      return {
        data: mapped,
        source: 'supabase',
        error: null,
        count: mapped.length,
        state: 'live_records',
        details: `Retrieved ${mapped.length} live rows from Supabase.`,
        hasAuthSession,
      };
    }

    if (hasAuthSession) {
      databaseStatusStore.fraudCases = {
        source: 'supabase',
        error: null,
        state: 'zero_records',
        details: `Live Supabase table queried successfully; 0 records exist for tenant ${tenantId}.`,
      };
      return {
        data: [],
        source: 'supabase',
        error: null,
        count: 0,
        state: 'zero_records',
        details: `Authenticated query returned 0 records from Supabase fraud_cases table for tenant ${tenantId}.`,
        hasAuthSession: true,
      };
    } else {
      const notice = 'Demo session active: Supabase RLS requires an authenticated Supabase user session to read live rows. Displaying tenant demo dataset.';
      databaseStatusStore.fraudCases = {
        source: 'fallback',
        error: notice,
        state: 'demo_session_rls',
        details: 'Postgres RLS restricts anon queries. Sign in with Supabase Auth credentials to view live rows.',
      };
      const fallback = getFraudTransactionsForTenant(tenantId);
      return {
        data: fallback,
        source: 'fallback',
        error: notice,
        count: fallback.length,
        state: 'demo_session_rls',
        details: 'Supabase table is connected (200 OK), but RLS restricts unauthenticated/demo queries. Displaying verified demo dataset.',
        hasAuthSession: false,
      };
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Network error querying Supabase';
    databaseStatusStore.fraudCases = {
      source: 'fallback',
      error: errorMsg,
      state: 'query_error',
      details: errorMsg,
    };
    const fallback = getFraudTransactionsForTenant(tenantId);
    return {
      data: fallback,
      source: 'fallback',
      error: errorMsg,
      count: fallback.length,
      state: 'query_error',
      details: `Unexpected error querying Supabase: ${errorMsg}`,
      hasAuthSession: false,
    };
  }
}

export async function fetchFraudCasesFromDb(tenantId: string = 'tenant_apex_bank'): Promise<FinanceFraudTransaction[]> {
  const result = await fetchFraudCasesResultFromDb(tenantId);
  return result.data;
}

/**
 * Fetch Support Tickets with Supabase priority, transparent error reporting, and tenant fallback
 */
export async function fetchSupportTicketsResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  clientOverride?: any
): Promise<DatabaseQueryResult<SupportTicket[]>> {
  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  if (!configured || !client) {
    const errorMsg = 'Supabase client not configured (missing URL or anon key)';
    databaseStatusStore.supportTickets = {
      source: 'fallback',
      error: errorMsg,
      state: 'unconfigured',
      details: 'Supabase credentials are not configured in the application environment.',
    };
    const fallback = getTicketsForTenant(tenantId);
    return {
      data: fallback,
      source: 'fallback',
      error: errorMsg,
      count: fallback.length,
      state: 'unconfigured',
      details: 'Supabase client is not configured; using local tenant demo dataset.',
      hasAuthSession: false,
    };
  }

  try {
    let query = client
      .from('support_tickets')
      .select('*')
      .order('opened_at', { ascending: false });

    if (tenantId && tenantId !== 'ALL') {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      const errorMsg = `${error.code || 'ERR'}: ${error.message || 'Database query failed'}`;
      databaseStatusStore.supportTickets = {
        source: 'fallback',
        error: errorMsg,
        state: 'query_error',
        details: error.message,
      };
      const fallback = getTicketsForTenant(tenantId);
      return {
        data: fallback,
        source: 'fallback',
        error: errorMsg,
        count: fallback.length,
        state: 'query_error',
        details: `Supabase query failed: ${error.message}`,
        hasAuthSession: false,
      };
    }

    const hasAuthSession = await checkHasSupabaseAuthSession(client);

    if (data && data.length > 0) {
      databaseStatusStore.supportTickets = {
        source: 'supabase',
        error: null,
        state: 'live_records',
        details: `Loaded ${data.length} live records from Supabase support_tickets table.`,
      };
      const mapped: SupportTicket[] = data.map((s: any) => ({
        ticketId: s.ticket_id || s.id,
        customerName: s.customer_name || 'Client',
        accountTier: s.account_tier || 'Private Wealth Tier 3',
        category: s.category || 'High-Value Wire Authorization',
        priority: (s.priority || 'Medium') as 'Urgent' | 'High' | 'Medium' | 'Low',
        status: (s.status || 'Open') as 'Open' | 'In Progress' | 'Resolved' | 'Pending Client',
        assignedExecutive: s.assigned_executive || 'Unassigned',
        openedAt: s.opened_at || 'Just now',
        slaTargetHours: Number(s.sla_target_hours) || 4,
        hoursOpen: Number(s.hours_open) || 1,
        csatRating: s.csat_rating ? Number(s.csat_rating) : undefined,
        tenantId: s.tenant_id,
        tenantName: s.tenant_name,
      }));
      return {
        data: mapped,
        source: 'supabase',
        error: null,
        count: mapped.length,
        state: 'live_records',
        details: `Retrieved ${mapped.length} live rows from Supabase.`,
        hasAuthSession,
      };
    }

    if (hasAuthSession) {
      databaseStatusStore.supportTickets = {
        source: 'supabase',
        error: null,
        state: 'zero_records',
        details: `Live Supabase table queried successfully; 0 records exist for tenant ${tenantId}.`,
      };
      return {
        data: [],
        source: 'supabase',
        error: null,
        count: 0,
        state: 'zero_records',
        details: `Authenticated query returned 0 records from Supabase support_tickets table for tenant ${tenantId}.`,
        hasAuthSession: true,
      };
    } else {
      const notice = 'Demo session active: Supabase RLS requires an authenticated Supabase user session to read live rows. Displaying tenant demo dataset.';
      databaseStatusStore.supportTickets = {
        source: 'fallback',
        error: notice,
        state: 'demo_session_rls',
        details: 'Postgres RLS restricts anon queries. Sign in with Supabase Auth credentials to view live rows.',
      };
      const fallback = getTicketsForTenant(tenantId);
      return {
        data: fallback,
        source: 'fallback',
        error: notice,
        count: fallback.length,
        state: 'demo_session_rls',
        details: 'Supabase table is connected (200 OK), but RLS restricts unauthenticated/demo queries. Displaying verified demo dataset.',
        hasAuthSession: false,
      };
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Network error querying Supabase';
    databaseStatusStore.supportTickets = {
      source: 'fallback',
      error: errorMsg,
      state: 'query_error',
      details: errorMsg,
    };
    const fallback = getTicketsForTenant(tenantId);
    return {
      data: fallback,
      source: 'fallback',
      error: errorMsg,
      count: fallback.length,
      state: 'query_error',
      details: `Unexpected error querying Supabase: ${errorMsg}`,
      hasAuthSession: false,
    };
  }
}

export async function fetchSupportTicketsFromDb(tenantId: string = 'tenant_apex_bank'): Promise<SupportTicket[]> {
  const result = await fetchSupportTicketsResultFromDb(tenantId);
  return result.data;
}

/**
 * Update Support Ticket Status in Supabase public.support_tickets
 */
export async function updateSupportTicketStatusInDb(
  ticketId: string,
  status: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { success: true, error: null };
  }
  try {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status })
      .eq('ticket_id', ticketId);
    if (error) {
      console.warn('Supabase update support_tickets note:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Update failed' };
  }
}

/**
 * Update Fraud Case Status in Supabase public.fraud_cases
 */
export async function updateFraudCaseStatusInDb(
  caseId: string,
  status: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { success: true, error: null };
  }
  try {
    const { error } = await supabase
      .from('fraud_cases')
      .update({ status })
      .eq('id', caseId);
    if (error) {
      console.warn('Supabase update fraud_cases note:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Update failed' };
  }
}

/**
 * Seeded KYC documents for fallback demo mode
 */
const DEMO_KYC_DOCUMENTS: CustomerDocument[] = [
  {
    id: 'KYC-DOC-901',
    title: 'Monaco Diplomatic Passport',
    documentType: 'Passport',
    fileSize: '2.4 MB',
    uploadedAt: '2026-08-14',
    verifiedBy: 'Elena Sterling (Admin)',
    status: 'Verified',
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
  {
    id: 'KYC-DOC-902',
    title: 'IRS Form W-8BEN Treaty Exemption',
    documentType: 'Tax Certificate W-8BEN',
    fileSize: '1.1 MB',
    uploadedAt: '2026-09-02',
    verifiedBy: 'Julian Montgomery (Analyst)',
    status: 'Verified',
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
  {
    id: 'KYC-DOC-903',
    title: 'Zurich Cantonal Indenture of Trust',
    documentType: 'Wealth Declaration',
    fileSize: '4.8 MB',
    uploadedAt: '2026-10-02',
    verifiedBy: 'Compliance Kernel',
    status: 'Under Review',
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
  {
    id: 'KYC-DOC-904',
    title: 'Source of Sovereign Wealth Verification',
    documentType: 'Custody Agreement',
    fileSize: '3.6 MB',
    uploadedAt: '2026-08-20',
    verifiedBy: 'Elena Sterling (Admin)',
    status: 'Verified',
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
  {
    id: 'KYC-DOC-905',
    title: 'Swiss Civil Proof of Domicile',
    documentType: 'Proof of Address',
    fileSize: '980 KB',
    uploadedAt: '2026-10-04',
    verifiedBy: 'System Review',
    status: 'Under Review',
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
];

/**
 * Fetch KYC Records from Supabase public.kyc_records
 */
export async function fetchKycRecordsResultFromDb(
  tenantId: string = 'tenant_apex_bank'
): Promise<DatabaseQueryResult<CustomerDocument[]>> {
  if (!isSupabaseConfigured()) {
    const errorMsg = 'Supabase client not configured';
    databaseStatusStore.kycRecords = {
      source: 'fallback',
      error: errorMsg,
      state: 'unconfigured',
      details: 'Supabase credentials not configured in environment.',
    };
    return {
      data: DEMO_KYC_DOCUMENTS,
      source: 'fallback',
      error: errorMsg,
      count: DEMO_KYC_DOCUMENTS.length,
      state: 'unconfigured',
      hasAuthSession: false,
    };
  }

  try {
    let query = supabase.from('kyc_records').select('*');
    if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
      query = query.eq('tenant_id', tenantId);
    }

    const hasSession = await checkHasSupabaseAuthSession(supabase);
    const { data, error, status } = await query;

    if (error) {
      const msg = `Database error querying kyc_records: ${error.message} (${error.code || status})`;
      databaseStatusStore.kycRecords = {
        source: 'fallback',
        error: msg,
        state: 'query_error',
        details: msg,
      };
      return {
        data: DEMO_KYC_DOCUMENTS,
        source: 'fallback',
        state: 'query_error',
        error: msg,
        count: DEMO_KYC_DOCUMENTS.length,
        hasAuthSession: hasSession,
      };
    }

    if (data && data.length > 0) {
      const liveRecords: CustomerDocument[] = data.map((k: any) => ({
        id: k.id,
        title: k.title || 'Identity Document',
        documentType: k.document_type || 'Passport',
        fileSize: k.file_size || '1.2 MB',
        uploadedAt: k.uploaded_at ? k.uploaded_at.split('T')[0] : 'Today',
        verifiedBy: k.verified_by || 'Compliance Officer',
        status: (k.status === 'Verified' || k.status === 'Approved' ? 'Verified' : k.status === 'Under Review' ? 'Under Review' : 'Archived') as any,
        tenantId: k.tenant_id,
        tenantName: k.tenant_name,
      }));

      databaseStatusStore.kycRecords = {
        source: 'supabase',
        error: null,
        state: 'live_records',
        details: `Loaded ${liveRecords.length} live records from Supabase kyc_records table.`,
      };

      return {
        data: liveRecords,
        source: 'supabase',
        error: null,
        count: liveRecords.length,
        state: 'live_records',
        details: `Successfully loaded ${liveRecords.length} live KYC records from Supabase.`,
        hasAuthSession: hasSession,
      };
    }

    if (hasSession) {
      databaseStatusStore.kycRecords = {
        source: 'supabase',
        error: null,
        state: 'zero_records',
        details: `Authenticated query returned 0 records from Supabase kyc_records table for tenant ${tenantId}.`,
      };
      return {
        data: [],
        source: 'supabase',
        error: null,
        count: 0,
        state: 'zero_records',
        hasAuthSession: true,
      };
    } else {
      const notice = 'Demo session active: Supabase RLS requires an authenticated session to read live rows.';
      databaseStatusStore.kycRecords = {
        source: 'fallback',
        error: notice,
        state: 'demo_session_rls',
      };
      return {
        data: DEMO_KYC_DOCUMENTS,
        source: 'fallback',
        error: notice,
        count: DEMO_KYC_DOCUMENTS.length,
        state: 'demo_session_rls',
        hasAuthSession: false,
      };
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Network error querying kyc_records';
    databaseStatusStore.kycRecords = {
      source: 'fallback',
      error: errorMsg,
      state: 'query_error',
    };
    return {
      data: DEMO_KYC_DOCUMENTS,
      source: 'fallback',
      error: errorMsg,
      count: DEMO_KYC_DOCUMENTS.length,
      state: 'query_error',
      hasAuthSession: false,
    };
  }
}

export async function fetchKycRecordsFromDb(tenantId: string = 'tenant_apex_bank'): Promise<CustomerDocument[]> {
  const res = await fetchKycRecordsResultFromDb(tenantId);
  return res.data;
}

/**
 * Update KYC Record Status in Supabase public.kyc_records
 */
export async function updateKycRecordStatusInDb(
  kycId: string,
  status: string,
  verifiedBy: string = 'Compliance Officer'
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { success: true, error: null };
  }
  try {
    const { error } = await supabase
      .from('kyc_records')
      .update({ status, verified_by: verifiedBy })
      .eq('id', kycId);
    if (error) {
      console.warn('Supabase update kyc_records note:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Update failed' };
  }
}

export interface ProfileQueryResult {
  profile: UserAccount | null;
  source: 'supabase' | 'fallback';
  state: QueryResultState;
  error: string | null;
  details: string;
  hasAuthSession: boolean;
}

/**
 * Fetch the authenticated user's profile from the Supabase public.profiles table
 * Uses the active Supabase Auth session token to comply with Row Level Security (RLS)
 */
export async function fetchCurrentUserProfileResultFromDb(): Promise<ProfileQueryResult> {
  if (!isSupabaseConfigured()) {
    databaseStatusStore.profiles = {
      source: 'fallback',
      error: 'Supabase credentials not configured in environment.',
      state: 'unconfigured',
      details: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
    };
    return {
      profile: null,
      source: 'fallback',
      state: 'unconfigured',
      error: 'Supabase client credentials not configured.',
      details: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
      hasAuthSession: false,
    };
  }

  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      databaseStatusStore.profiles = {
        source: 'fallback',
        error: sessionErr.message,
        state: 'query_error',
        details: sessionErr.message,
      };
      return {
        profile: null,
        source: 'fallback',
        state: 'query_error',
        error: `Supabase Auth error: ${sessionErr.message}`,
        details: sessionErr.message,
        hasAuthSession: false,
      };
    }

    const sbSession = sessionData?.session;
    if (!sbSession || !sbSession.user) {
      const notice = 'Supabase RLS active: An authenticated Supabase Auth session is required to query public.profiles.';
      databaseStatusStore.profiles = {
        source: 'fallback',
        error: notice,
        state: 'demo_session_rls',
        details: 'Postgres RLS restricts unauthenticated queries. Sign in via Supabase Auth to load live profile.',
      };
      return {
        profile: null,
        source: 'fallback',
        state: 'demo_session_rls',
        error: notice,
        details: 'Unauthenticated query restricted by Postgres RLS policy (users_read_own_profile).',
        hasAuthSession: false,
      };
    }

    const userId = sbSession.user.id;
    const { data, error, status } = await supabase
      .from('profiles')
      .select('id, email, role, tenant_id, name, status, tier, phone, country, two_factor_enabled, tenant_name, notes, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      const msg = `Database error querying profiles: ${error.message} (${error.code || status})`;
      databaseStatusStore.profiles = {
        source: 'fallback',
        error: msg,
        state: 'query_error',
        details: msg,
      };
      return {
        profile: null,
        source: 'fallback',
        state: 'query_error',
        error: msg,
        details: `Supabase query returned status ${status}: ${error.message}`,
        hasAuthSession: true,
      };
    }

    if (!data) {
      // Query succeeded with 200 OK, but zero records found for this user in public.profiles
      databaseStatusStore.profiles = {
        source: 'supabase',
        error: null,
        state: 'zero_records',
        details: `Query executed successfully (status ${status}), but user has no profile row in public.profiles yet.`,
      };
      return {
        profile: null,
        source: 'supabase',
        state: 'zero_records',
        error: null,
        details: `Query executed successfully (status ${status}), but user has no profile row in public.profiles yet.`,
        hasAuthSession: true,
      };
    }

    // Live profile retrieved from Supabase PostgreSQL!
    const tenantId = data.tenant_id || 'tenant_apex_bank';
    const tenantMeta = getTenantById(tenantId);
    const tenantName = data.tenant_name || tenantMeta?.name || 'Apex Global Bank';

    // Safely resolve clean display name
    let cleanName = (data.name || '').trim();
    if (!cleanName) {
      const metaName = sbSession.user.user_metadata?.name;
      if (metaName && metaName.trim()) {
        cleanName = metaName.trim();
      } else if (data.email) {
        cleanName = data.email
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
      } else {
        cleanName = 'Apex Customer';
      }
    }

    const userProfile: UserAccount = {
      id: data.id,
      name: cleanName,
      email: data.email || sbSession.user.email || '',
      role: (data.role as UserRole) || 'CUSTOMER',
      status: data.status || 'Active',
      tier: data.tier || 'Private Wealth Tier 3',
      createdDate: data.created_at ? data.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      lastActive: 'Just now',
      phone: data.phone || sbSession.user.user_metadata?.phone || '+1 (212) 555-0100',
      country: data.country || 'United States',
      twoFactorEnabled: data.two_factor_enabled ?? true,
      tenantId,
      tenantName,
      notes: data.notes || 'Loaded directly from live Supabase PostgreSQL profiles table',
      authSource: 'supabase',
    };

    databaseStatusStore.profiles = {
      source: 'supabase',
      error: null,
      state: 'live_records',
      details: `Live profile successfully loaded for role ${userProfile.role} from Supabase profiles table.`,
    };

    return {
      profile: userProfile,
      source: 'supabase',
      state: 'live_records',
      error: null,
      details: `Live profile successfully loaded for role ${userProfile.role} from Supabase profiles table.`,
      hasAuthSession: true,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Network exception querying Supabase profiles';
    databaseStatusStore.profiles = {
      source: 'fallback',
      error: errorMsg,
      state: 'query_error',
      details: errorMsg,
    };
    return {
      profile: null,
      source: 'fallback',
      state: 'query_error',
      error: errorMsg,
      details: errorMsg,
      hasAuthSession: false,
    };
  }
}

/**
 * Fetch User Profiles from Supabase profiles table
 */
export async function fetchProfilesFromDb(tenantId?: string): Promise<UserAccount[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('profiles').select('*');

      if (tenantId && tenantId !== 'ALL') {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map((p) => {
          const pTenantId = p.tenant_id || 'tenant_apex_bank';
          const pTenantName = p.tenant_name || getTenantById(pTenantId)?.name || 'Apex Global Bank';
          let cleanName = (p.name || '').trim();
          if (!cleanName && p.email) {
            cleanName = p.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          }
          return {
            id: p.id,
            name: cleanName || 'Anonymous User',
            email: p.email,
            role: (p.role as UserRole) || 'CUSTOMER',
            status: p.status || 'Active',
            tier: p.tier || 'Private Wealth Tier 3',
            createdDate: p.created_at ? p.created_at.split('T')[0] : '2024-01-01',
            lastActive: 'Just now',
            phone: p.phone || '+1 (212) 555-0100',
            country: p.country || 'United States',
            twoFactorEnabled: p.two_factor_enabled ?? true,
            tenantId: pTenantId,
            tenantName: pTenantName,
            notes: p.notes,
            authSource: 'supabase',
          };
        });
      }
    } catch (err) {
      console.warn('Supabase profiles query error:', err);
    }
  }

  return [];
}

/**
 * Fetch User Profiles with metadata result from Supabase
 */
export async function fetchProfilesResultFromDb(
  tenantId?: string,
  rolesOnly?: UserRole[]
): Promise<DatabaseQueryResult<UserAccount[]>> {
  if (!isSupabaseConfigured()) {
    return {
      data: [],
      source: 'fallback',
      error: 'Supabase client not configured',
      count: 0,
      state: 'unconfigured',
      hasAuthSession: false,
    };
  }

  try {
    let query = supabase.from('profiles').select('*');
    if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
      query = query.eq('tenant_id', tenantId);
    }
    if (rolesOnly && rolesOnly.length > 0) {
      query = query.in('role', rolesOnly);
    }

    query = query.order('created_at', { ascending: false });

    const hasSession = await checkHasSupabaseAuthSession(supabase);
    const { data, error } = await query;

    if (error) {
      databaseStatusStore.profiles = {
        source: 'fallback',
        error: error.message,
        state: 'query_error',
        details: error.message,
      };
      return {
        data: [],
        source: 'fallback',
        error: error.message,
        count: 0,
        state: 'query_error',
        hasAuthSession: hasSession,
      };
    }

    if (data && data.length > 0) {
      const mapped: UserAccount[] = data.map((p: any) => {
        const pTenantId = p.tenant_id || 'tenant_apex_bank';
        const pTenantName = p.tenant_name || getTenantById(pTenantId)?.name || 'Apex Global Bank';
        let cleanName = (p.name || '').trim();
        if (!cleanName && p.email) {
          cleanName = p.email
            .split('@')[0]
            .replace(/[._-]/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
        return {
          id: p.id,
          name: cleanName || 'Authorized User',
          email: p.email,
          role: (p.role as UserRole) || 'CUSTOMER',
          status: p.status || 'Active',
          tier: p.tier || 'Private Wealth Tier 3',
          createdDate: p.created_at ? p.created_at.split('T')[0] : '2024-01-01',
          lastActive: 'Just now',
          phone: p.phone || '+1 (212) 555-0100',
          country: p.country || 'United States',
          twoFactorEnabled: p.two_factor_enabled ?? true,
          tenantId: pTenantId,
          tenantName: pTenantName,
          notes: p.notes,
          authSource: 'supabase' as const,
        };
      });

      databaseStatusStore.profiles = {
        source: 'supabase',
        error: null,
        state: 'live_records',
        details: `Loaded ${mapped.length} live profiles from Supabase profiles table.`,
      };

      return {
        data: mapped,
        source: 'supabase',
        error: null,
        count: mapped.length,
        state: 'live_records',
        details: `Loaded ${mapped.length} live profiles from Supabase profiles table.`,
        hasAuthSession: hasSession,
      };
    }

    databaseStatusStore.profiles = {
      source: 'supabase',
      error: null,
      state: hasSession ? 'zero_records' : 'demo_session_rls',
      details: hasSession ? '0 profiles found in database' : 'RLS requires authenticated session',
    };

    return {
      data: [],
      source: 'supabase',
      error: null,
      count: 0,
      state: hasSession ? 'zero_records' : 'demo_session_rls',
      details: hasSession ? '0 profiles found in database' : 'RLS requires authenticated session',
      hasAuthSession: hasSession,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Error querying profiles';
    databaseStatusStore.profiles = {
      source: 'fallback',
      error: errorMsg,
      state: 'query_error',
      details: errorMsg,
    };
    return {
      data: [],
      source: 'fallback',
      error: errorMsg,
      count: 0,
      state: 'query_error',
      hasAuthSession: false,
    };
  }
}

/**
 * Persist or update user profile in Supabase public.profiles table
 */
export async function saveProfileToDb(
  userData: Partial<UserAccount>
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured() || !userData.id) {
    return { success: true, error: null };
  }
  try {
    const payload: any = {
      name: userData.name,
      role: userData.role,
      status: userData.status,
      tier: userData.tier,
      phone: userData.phone,
      country: userData.country,
      tenant_id: userData.tenantId,
      tenant_name: userData.tenantName,
      notes: userData.notes,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userData.id, email: userData.email, ...payload });

    // Sync to local stored users cache
    const currentStored: StoredUser[] = getStoredUsers();
    const updatedUsers: StoredUser[] = currentStored.map((u: StoredUser) =>
      u.id === userData.id || (userData.email && u.email.toLowerCase() === userData.email.toLowerCase())
        ? ({ ...u, ...userData, authSource: 'supabase' } as StoredUser)
        : u
    );
    if (!updatedUsers.some((u: StoredUser) => u.id === userData.id)) {
      updatedUsers.unshift({
        id: userData.id,
        name: userData.name || 'User Account',
        email: userData.email || '',
        role: userData.role || 'CUSTOMER',
        status: userData.status || 'Active',
        tier: userData.tier || 'Private Wealth Tier 3',
        createdDate: new Date().toISOString().split('T')[0],
        lastActive: 'Just now',
        phone: userData.phone || '+1 (212) 555-0100',
        country: userData.country || 'United States',
        twoFactorEnabled: true,
        tenantId: userData.tenantId || 'tenant_apex_bank',
        tenantName: userData.tenantName || 'Apex Global Bank',
        notes: userData.notes,
        authSource: 'supabase',
        passwordHash: 'finova2026',
      });
    }
    saveStoredUsers(updatedUsers);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('finova:profile_updated', { detail: userData }));
    }

    if (error) {
      console.warn('Supabase saveProfileToDb note:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Update failed' };
  }
}

/**
 * Revoke or delete user profile in Supabase public.profiles table
 */
export async function deleteProfileFromDb(
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  // Always remove from local store
  const currentStored = getStoredUsers();
  saveStoredUsers(currentStored.filter((u: StoredUser) => u.id !== userId));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('finova:profile_updated', { detail: { id: userId, deleted: true } }));
  }

  if (!isSupabaseConfigured()) {
    return { success: true, error: null };
  }
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) {
      console.warn('Supabase deleteProfileFromDb note:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Delete failed' };
  }
}

/**
 * Fetch Tenant Workspaces with comprehensive result state
 */
export async function fetchTenantWorkspacesResultFromDb(): Promise<DatabaseQueryResult<TenantWorkspace[]>> {
  if (!isSupabaseConfigured()) {
    const fallback = getStoredTenants();
    return {
      data: fallback,
      source: 'fallback',
      error: 'Supabase credentials not configured in environment',
      count: fallback.length,
      state: 'unconfigured',
      hasAuthSession: false,
    };
  }

  try {
    const { data, error } = await supabase.from('tenant_workspaces').select('*');
    const hasSession = await checkHasSupabaseAuthSession(supabase);

    if (error) {
      const fallback = getStoredTenants();
      databaseStatusStore.tenantWorkspaces = {
        source: 'fallback',
        error: error.message,
        state: 'query_error',
      };
      return {
        data: fallback,
        source: 'fallback',
        error: error.message,
        count: fallback.length,
        state: 'query_error',
        hasAuthSession: hasSession,
      };
    }

    if (data && data.length > 0) {
      const mapped: TenantWorkspace[] = data.map((t: any) => ({
        id: t.id,
        name: t.name,
        shortName: t.short_name || t.name,
        type: t.type || 'Commercial Bank',
        status: t.status || 'Active',
        plan: t.plan || 'Growth SaaS',
        mrr: Number(t.mrr) || 28500,
        currency: t.currency || 'USD',
        currencySymbol: t.currency_symbol || '$',
        headquarters: t.headquarters || 'New York',
        licenseNo: t.license_no || 'Standard License',
        primaryContact: {
          name: t.admin_name || 'Admin',
          email: t.admin_email || 'admin@finova.ai',
          phone: '+1 (212) 555-0100',
        },
        adminUserId: t.admin_user_id || 'USR-000',
        adminName: t.admin_name || 'Admin',
        adminEmail: t.admin_email || 'admin@finova.ai',
        createdDate: t.created_at ? t.created_at.split('T')[0] : '2023-01-01',
        usersCount: Number(t.users_count) || 120,
        transactionVolumeYTD: Number(t.transaction_volume_ytd) || 1000000,
        complianceScore: Number(t.compliance_score) || 99.4,
        activeEngines: {
          aiAssistant: true,
          documentOcr: true,
          transactionClassification: true,
          kycVerification: true,
          fraudAml: true,
          caseManagement: true,
          excelVisualization: true,
        },
        notes: t.notes,
      }));

      // Synchronize with local storage
      saveStoredTenants(mapped);

      databaseStatusStore.tenantWorkspaces = {
        source: 'supabase',
        error: null,
        state: 'live_records',
        details: `Loaded ${mapped.length} live workspaces from Supabase.`,
      };

      return {
        data: mapped,
        source: 'supabase',
        error: null,
        count: mapped.length,
        state: 'live_records',
        details: `Successfully loaded ${mapped.length} real company workspaces from Supabase tenant_workspaces table.`,
        hasAuthSession: hasSession,
      };
    }

    const fallback = getStoredTenants();
    return {
      data: fallback,
      source: 'fallback',
      error: null,
      count: fallback.length,
      state: 'zero_records',
      hasAuthSession: hasSession,
    };
  } catch (err: any) {
    const fallback = getStoredTenants();
    return {
      data: fallback,
      source: 'fallback',
      error: err?.message || 'Error querying tenant workspaces',
      count: fallback.length,
      state: 'query_error',
      hasAuthSession: false,
    };
  }
}

/**
 * Fetch Tenant Workspaces
 */
export async function fetchTenantWorkspacesFromDb(): Promise<TenantWorkspace[]> {
  const result = await fetchTenantWorkspacesResultFromDb();
  return result.data;
}

/**
 * Persist or update company workspace in Supabase public.tenant_workspaces table
 */
export async function saveTenantWorkspaceToDb(
  tenantData: Partial<TenantWorkspace>
): Promise<{ success: boolean; data: TenantWorkspace | null; error: string | null }> {
  // 1. Create or update in local store first
  let localTenant: TenantWorkspace;
  if (tenantData.id && getTenantById(tenantData.id)) {
    localTenant = updateTenant(tenantData.id, tenantData) || createTenant(tenantData);
  } else {
    localTenant = createTenant(tenantData);
  }

  // 2. If Supabase configured, persist directly to public.tenant_workspaces
  if (isSupabaseConfigured()) {
    try {
      const payload: any = {
        id: localTenant.id,
        name: localTenant.name,
        short_name: localTenant.shortName,
        type: localTenant.type,
        status: localTenant.status,
        plan: localTenant.plan,
        mrr: localTenant.mrr,
        currency: localTenant.currency,
        currency_symbol: localTenant.currencySymbol,
        headquarters: localTenant.headquarters,
        license_no: localTenant.licenseNo,
        admin_name: localTenant.adminName,
        admin_email: localTenant.adminEmail,
        users_count: localTenant.usersCount,
        transaction_volume_ytd: localTenant.transactionVolumeYTD,
        compliance_score: localTenant.complianceScore,
        notes: localTenant.notes,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('tenant_workspaces')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase upsert tenant_workspaces note:', error.message);
        return { success: true, data: localTenant, error: error.message };
      }
    } catch (err: any) {
      console.warn('Supabase tenant_workspaces exception:', err);
      return { success: true, data: localTenant, error: err?.message };
    }
  }

  return { success: true, data: localTenant, error: null };
}

/**
 * Update company workspace status (Active / Suspended / Pending Review) in Supabase
 */
export async function updateTenantWorkspaceStatusInDb(
  tenantId: string,
  status: 'Active' | 'Suspended' | 'Pending Review' | 'Provisioning'
): Promise<{ success: boolean; error: string | null }> {
  // Sync to local store
  updateTenant(tenantId, { status });

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('tenant_workspaces')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', tenantId);

      if (error) {
        console.warn('Supabase update tenant_workspaces status note:', error.message);
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  return { success: true, error: null };
}
