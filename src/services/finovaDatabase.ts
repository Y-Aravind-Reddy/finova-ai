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
  TenantWorkspace,
  getStoredTenants,
  getTenantById,
  saveStoredTenants,
  updateTenant,
  createTenant,
} from '../data/tenantStore';
import { getStoredUsers, saveStoredUsers, StoredUser, getStoredSession, saveSession, AUTHORIZED_SUPER_ADMIN_EMAIL } from '../data/authStore';
import { convertToInr, convertToUsd, getExchangeRates, formatCurrencyWithInrDisclosure, formatCurrencyWithUsdDisclosure } from './currencyService';

export type QueryResultState =
  | 'live_records'
  | 'zero_records'
  | 'demo_session_rls'
  | 'restricted'
  | 'timeout'
  | 'query_error'
  | 'unconfigured';

export type TelemetryNodeStatus = 'OPERATIONAL' | 'DEGRADED' | 'TIMEOUT' | 'RESTRICTED' | 'UNAVAILABLE';

export type DateRangePreset = '30D' | '90D' | 'YTD' | 'ALL';

export interface QueryFilterOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  type?: 'Credit' | 'Debit' | 'ALL';
  status?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  currency?: string;
  rolesOnly?: UserRole[];
  userId?: string;
  channel?: string;
  countMode?: 'exact' | 'planned' | 'estimated';
  signal?: AbortSignal;
  // New Dimensions
  branchCity?: string;
  cardFamily?: string;
  accountType?: string;
  customerSegment?: string;
}

export function getDefaultBoundedDateRange(preset: DateRangePreset = 'YTD'): { startDate: string; endDate: string } {
  if (preset === 'ALL') {
    return { startDate: '', endDate: '' };
  }
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  if (preset === 'YTD') {
    return {
      startDate: `${now.getUTCFullYear()}-01-01`,
      endDate,
    };
  }
  const days = preset === '30D' ? 30 : 90;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate,
  };
}

export interface KycAggregates {
  totalRecords: number;
  totalCount: number;
  verifiedCount: number;
  pendingCount: number;
  reviewCount: number;
  tierDistribution: { label: string; value: number }[];
  docTypeDistribution: { label: string; value: number }[];
  source: 'supabase' | 'fallback';
  state: QueryResultState;
  error?: string | null;
  isPartial: boolean;
  rejectedRecordsCount: number;
}

export interface PlatformExecutiveKpis {
  settledVolumeYtd: number;
  institutionalMrr: number;
  preventedFraudVolume: number;
  slaCompliancePct: number;
  complianceScore: number;
  activeUsers: number;
  netLiquidBalance: number;
  riskExposureScore: number;
  source?: 'supabase' | 'error' | 'unconfigured';
  state?: QueryResultState;
  error?: string | null;
}

export function isPermissionDeniedError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as Record<string, any>;
  const code = String(anyErr?.code || '').toUpperCase();
  const status = Number(anyErr?.status || 0);
  const msg = String(anyErr?.message || (typeof err === 'string' ? err : '')).toLowerCase();
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    status === 401 ||
    status === 403 ||
    msg.includes('permission denied') ||
    msg.includes('access denied') ||
    msg.includes('row-level security') ||
    msg.includes('insufficient privilege') ||
    msg.includes('unauthorized')
  );
}

export function isStatementTimeoutError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as Record<string, any>;
  const code = String(anyErr?.code || '').toUpperCase();
  const msg = String(anyErr?.message || (typeof err === 'string' ? err : '')).toLowerCase();
  return (
    code === '57014' ||
    code === 'ETIMEDOUT' ||
    msg.includes('statement timeout') ||
    msg.includes('canceling statement due to statement timeout') ||
    msg.includes('query_canceled') ||
    msg.includes('query canceled') ||
    msg.includes('request timed out')
  );
}

export function isNetworkTelemetryError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as Record<string, any>;
  const msg = String(anyErr?.message || (typeof err === 'string' ? err : '')).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('connection refused') ||
    msg.includes('fetch failed')
  );
}

export function classifyErrorState(err: unknown, hasAuthSession: boolean): QueryResultState {
  if (isStatementTimeoutError(err)) {
    return 'timeout';
  }
  if (isPermissionDeniedError(err)) {
    return hasAuthSession ? 'restricted' : 'demo_session_rls';
  }
  return 'query_error';
}

export function canRoleAccessFraudTelemetry(role?: UserRole | string | null): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'FINANCE_ANALYST';
}

export function canRoleAccessInstitutionalKyc(role?: UserRole | string | null): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'FINANCE_ANALYST' || role === 'SUPPORT_EXECUTIVE';
}

export function canRoleAccessSupportTelemetry(role?: UserRole | string | null): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SUPPORT_EXECUTIVE';
}

export function mapResultStateToTelemetryStatus(
  state?: QueryResultState,
  source?: 'supabase' | 'fallback' | 'error' | 'unconfigured',
  isLoading?: boolean
): TelemetryNodeStatus {
  if (state === 'timeout') return 'TIMEOUT';
  if (state === 'restricted' || state === 'demo_session_rls') return 'RESTRICTED';
  if (state === 'unconfigured' || source === 'unconfigured') return 'UNAVAILABLE';
  if (state === 'query_error' || source === 'error') return 'DEGRADED';
  if (source === 'supabase' && (state === 'live_records' || state === 'zero_records')) return 'OPERATIONAL';
  if (isLoading) return 'OPERATIONAL';
  return 'DEGRADED';
}

export function getActiveSessionRole(clientOverride?: any): UserRole | null {
  if (clientOverride !== undefined) {
    return (clientOverride?.mockRole as UserRole) || null;
  }
  try {
    const sess = getStoredSession();
    return sess?.user?.role || null;
  } catch {
    return null;
  }
}

async function shouldSkipUnauthenticatedQuery(client: any, clientOverride?: any): Promise<boolean> {
  if (clientOverride !== undefined && !client?.auth?.getSession) {
    return false;
  }
  const hasSession = await checkHasSupabaseAuthSession(client);
  return !hasSession;
}

export function isMissingRpcError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '').toUpperCase();
  const msg = String(err.message || '').toLowerCase();
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    (msg.includes('function') && msg.includes('does not exist'))
  );
}

export function isNonRetryableTelemetryError(err: unknown): boolean {
  return isPermissionDeniedError(err) || isStatementTimeoutError(err) || isMissingRpcError(err);
}

const inFlightRequests = new Map<string, Promise<any>>();
const clientIdentityMap = new WeakMap<object, number>();
let clientIdentityCounter = 1;

function getClientScopeKey(client: any): string {
  if (!client || typeof client !== 'object') return 'none';
  let id = clientIdentityMap.get(client);
  if (!id) {
    id = clientIdentityCounter++;
    clientIdentityMap.set(client, id);
  }
  return `c${id}`;
}

export function dedupeInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = Promise.resolve()
    .then(fn)
    .finally(() => {
      if (inFlightRequests.get(key) === promise) {
        inFlightRequests.delete(key);
      }
    });
  inFlightRequests.set(key, promise);
  return promise;
}

function applyAbortSignal<T>(query: T, signal?: AbortSignal): T {
  if (signal && query && typeof (query as any).abortSignal === 'function') {
    return (query as any).abortSignal(signal);
  }
  return query;
}

export interface TelemetryDiagnosticMetadata {
  correlationId: string;
  widgetName: string;
  rpcName: string;
  sqlstate: string;
  durationMs: number;
  dateRangeDays: number | 'ALL';
  role: string;
  tenantScope: string;
  outcome: 'SUCCESS' | 'TIMEOUT' | 'RESTRICTED' | 'ERROR' | 'ABORTED';
  timestamp: string;
}

const telemetryDiagnosticHistory: TelemetryDiagnosticMetadata[] = [];
const MAX_DIAGNOSTIC_HISTORY = 50;

export function getRecentTelemetryDiagnostics(): TelemetryDiagnosticMetadata[] {
  return [...telemetryDiagnosticHistory];
}

export function clearTelemetryDiagnosticsForTest(): void {
  telemetryDiagnosticHistory.length = 0;
}

export function createTelemetryCorrelationId(): string {
  return `tel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function computeDateRangeDays(startDate?: string, endDate?: string): number | 'ALL' {
  if (!startDate && !endDate) return 'ALL';
  if (startDate && endDate) {
    const startMs = Date.parse(`${startDate}T00:00:00Z`);
    const endMs = Date.parse(`${endDate}T00:00:00Z`);
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);
    }
  }
  return 'ALL';
}

export function extractSafeSqlstate(err: unknown): string {
  if (!err) return 'NONE';
  const anyErr = err as Record<string, any>;
  const rawCode = String(anyErr?.code || '').trim().toUpperCase();
  if (rawCode && /^[A-Z0-9_]{2,16}$/.test(rawCode)) return rawCode;
  if (isStatementTimeoutError(err)) return '57014';
  if (isPermissionDeniedError(err)) return '42501';
  if (isMissingRpcError(err)) return '42883';
  const status = Number(anyErr?.status || 0);
  if (status >= 400 && status <= 599) return `HTTP_${status}`;
  return 'UNKNOWN';
}

function sanitizeTenantScopeLabel(tenantId?: string | null): string {
  const raw = String(tenantId || '').trim();
  if (!raw || raw === 'ALL' || raw === 'platform_root') return 'ALL';
  if (raw.includes('@') || raw.toLowerCase().includes('bearer ') || raw.startsWith('eyJ')) {
    return 'REDACTED_SCOPE';
  }
  return raw.slice(0, 64);
}

function redactSensitiveTelemetryTokens(input?: string | null): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  return raw
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*\b/g, '[JWT_REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]');
}

export function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!err) return false;
  const anyErr = err as Record<string, any>;
  const name = String(anyErr?.name || '');
  const msg = String(anyErr?.message || (typeof err === 'string' ? err : '')).toLowerCase();
  return name === 'AbortError' || msg.includes('aborted') || msg.includes('signal is aborted');
}

export function recordTelemetryDiagnostic(params: {
  correlationId?: string;
  widgetName: string;
  rpcName: string;
  sqlstate: string;
  durationMs: number;
  dateRangeDays: number | 'ALL';
  role?: string | null;
  tenantScope?: string | null;
  outcome: TelemetryDiagnosticMetadata['outcome'];
}): TelemetryDiagnosticMetadata {
  const entry: TelemetryDiagnosticMetadata = {
    correlationId: params.correlationId || createTelemetryCorrelationId(),
    widgetName: params.widgetName,
    rpcName: params.rpcName,
    sqlstate: params.sqlstate || 'NONE',
    durationMs: Math.max(0, Math.round(params.durationMs)),
    dateRangeDays: params.dateRangeDays,
    role: params.role || 'UNAUTHENTICATED',
    tenantScope: sanitizeTenantScopeLabel(params.tenantScope),
    outcome: params.outcome,
    timestamp: new Date().toISOString(),
  };

  telemetryDiagnosticHistory.unshift(entry);
  if (telemetryDiagnosticHistory.length > MAX_DIAGNOSTIC_HISTORY) {
    telemetryDiagnosticHistory.length = MAX_DIAGNOSTIC_HISTORY;
  }

  if (entry.outcome === 'TIMEOUT' || entry.outcome === 'ERROR') {
    console.warn('[TELEMETRY_DIAGNOSTIC]', entry);
  }

  return entry;
}

export function formatTelemetryDiagnosticError(
  meta: TelemetryDiagnosticMetadata,
  baseMessage?: string | null
): string {
  const rangeLabel = meta.dateRangeDays === 'ALL' ? 'ALL' : `${meta.dateRangeDays}d`;
  const cleanMsg = redactSensitiveTelemetryTokens(baseMessage || 'Telemetry query did not complete.');
  return `[${meta.rpcName} | SQLSTATE ${meta.sqlstate} | ${meta.durationMs}ms | scope=${meta.tenantScope} | range=${rangeLabel} | ref=${meta.correlationId}] ${cleanMsg}`;
}

function isSupabaseClientLike(candidate: any): boolean {
  return Boolean(
    candidate &&
      typeof candidate === 'object' &&
      (typeof candidate.rpc === 'function' ||
        typeof candidate.from === 'function' ||
        Boolean(candidate.auth))
  );
}

export interface DatabaseQueryResult<T> {
  data: T;
  source: 'supabase' | 'fallback';
  error: string | null;
  count: number;
  totalCount?: number;
  state: QueryResultState;
  details?: string;
  hasAuthSession?: boolean;
  page?: number;
  pageSize?: number;
  totalPages?: number;
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
 * Deduplicates concurrent in-flight auth session checks on the same client.
 */
export async function checkHasSupabaseAuthSession(client: any = supabase): Promise<boolean> {
  if (!client?.auth?.getSession) return false;
  return dedupeInFlight(`auth:session:${getClientScopeKey(client)}`, async () => {
    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data?.session) return false;
      return Boolean(data.session.user);
    } catch {
      return false;
    }
  });
}

/**
 * Safely executes a paginated query with automatic page offset clamping and PGRST103 recovery.
 * Uses 'estimated' count mode by default to prevent full-table COUNT(*) scans on large ledgers.
 */
async function executeSafelyWithPagination(
  client: any,
  tableName: string,
  buildQuery: (q: any) => any,
  page: number,
  pageSize: number,
  countMode: 'exact' | 'planned' | 'estimated' = 'estimated',
  signal?: AbortSignal
): Promise<{ data: any[] | null; error: any; count: number | null }> {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = applyAbortSignal(
    buildQuery(client.from(tableName).select('*', { count: countMode })),
    signal
  ).range(from, to);
  let result = await query;

  if (result.error) {
    console.log(`[DB_DIAGNOSTIC] executeSafelyWithPagination error on ${tableName} - Code: ${result.error.code}, Message: ${result.error.message}`);

    if (result.error.code === 'PGRST103' || result.error.message?.includes('range not satisfiable')) {
      if (result.error.code === '42501' || result.error.message?.includes('permission') || result.error.message?.includes('policy') || result.error.message?.includes('JWT')) {
        return result;
      }

      let countQuery = applyAbortSignal(
        buildQuery(client.from(tableName).select('*', { count: countMode, head: true })),
        signal
      );
      let countRes = await countQuery;
      const totalCount = countRes.count || 0;

      if (totalCount > 0 && from >= totalCount) {
        const clampedPage = Math.max(1, Math.ceil(totalCount / pageSize));
        const newFrom = (clampedPage - 1) * pageSize;
        const newTo = newFrom + pageSize - 1;

        console.log(`[DB_DIAGNOSTIC] Clamping page for ${tableName} to ${clampedPage} due to out-of-range request.`);

        let retryQuery = applyAbortSignal(
          buildQuery(client.from(tableName).select('*', { count: countMode })),
          signal
        ).range(newFrom, newTo);
        return await retryQuery;
      }
    }
  }

  return result;
}

/**
 * Fetch Customer Transactions with Supabase priority, transparent error reporting, and tenant fallback
 */
export async function fetchTransactionsResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions,
  clientOverride?: any
): Promise<DatabaseQueryResult<CustomerTransaction[]>> {
  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  const page = Math.max(1, options?.page || 1);
  const pageSize = options?.pageSize || 50;

  if (!configured || !client) {
    const errorMsg = 'Supabase client not configured (missing URL or anon key)';
    databaseStatusStore.transactions = {
      source: 'fallback',
      error: errorMsg,
      state: 'unconfigured',
      details: 'Supabase credentials are not configured in the application environment.',
    };
    return {
      data: [],
      source: 'fallback',
      error: errorMsg,
      count: 0,
      totalCount: 0,
      state: 'unconfigured',
      details: 'Supabase client is not configured; no live records available.',
      hasAuthSession: false,
      page: 1,
      pageSize,
      totalPages: 1,
    };
  }

  if (await shouldSkipUnauthenticatedQuery(client, clientOverride)) {
    const notice = 'Authentication required: Active Supabase Auth session needed to query transactions.';
    databaseStatusStore.transactions = {
      source: 'fallback',
      error: notice,
      state: 'demo_session_rls',
      details: 'Postgres RLS restricts unauthenticated queries. Sign in with an authenticated session to view ledger telemetry.',
    };
    return {
      data: [],
      source: 'fallback',
      error: notice,
      count: 0,
      totalCount: 0,
      state: 'demo_session_rls',
      details: 'Postgres RLS restricts unauthenticated queries to 0 rows.',
      hasAuthSession: false,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  const runQuery = async (): Promise<DatabaseQueryResult<CustomerTransaction[]>> => {
    try {
      const buildQuery = (q: any) => {
        let filtered = q.order('date', { ascending: false });
        if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
          filtered = filtered.eq('tenant_id', tenantId);
        }
        if (options?.userId) {
          filtered = filtered.eq('user_id', options.userId);
        }
        if (options?.search) {
          const s = options.search.trim();
          filtered = filtered.or(`merchant.ilike.%${s}%,reference_no.ilike.%${s}%,category.ilike.%${s}%`);
        }
        if (options?.category && options.category !== 'ALL') {
          filtered = filtered.eq('category', options.category);
        }
        if (options?.type && options.type !== 'ALL') {
          filtered = filtered.eq('type', options.type);
        }
        if (options?.status && options.status !== 'ALL') {
          filtered = filtered.eq('status', options.status);
        }
        if (options?.startDate) {
          filtered = filtered.gte('date', options.startDate);
        }
        if (options?.endDate) {
          filtered = filtered.lte('date', options.endDate);
        }
        return filtered;
      };

      const { data, error, count } = await executeSafelyWithPagination(
        client,
        'transactions',
        buildQuery,
        page,
        pageSize,
        options?.countMode || 'estimated',
        options?.signal
      );

    // Check for query execution / permission errors
    if (error) {
      const hasSession = await checkHasSupabaseAuthSession(client);
      const errState = classifyErrorState(error, hasSession);
      const errorMsg = `${error.code || 'ERR'}: ${error.message || 'Database query failed'}`;
      databaseStatusStore.transactions = {
        source: 'fallback',
        error: errorMsg,
        state: errState,
        details: error.message,
      };
      return {
        data: [],
        source: 'fallback',
        error: errorMsg,
        count: 0,
        totalCount: 0,
        state: errState,
        details: `Supabase query failed: ${error.message}`,
        hasAuthSession: hasSession,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    // Determine whether an authenticated Supabase session exists
    const hasAuthSession = await checkHasSupabaseAuthSession(client);

    // Case 1: Supabase query succeeded with records
    if (data && data.length > 0) {
      const mapped: CustomerTransaction[] = data.map((t: any) => {
        const rawCurr = (t.currency || (t.tenant_id === 'tenant_crest_capital' ? 'GBP' : t.tenant_id === 'tenant_vanguard_wealth' || t.tenant_id === 'tenant_solaris_credit' ? 'EUR' : 'INR')).toUpperCase();
        const conv = convertToInr(Number(t.amount) || 0, rawCurr);
        return {
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
          currency: rawCurr,
          amountInr: conv.amountInr,
          amountUsd: conv.amountUsd,
          exchangeRate: conv.exchangeRate,
          exchangeRateDate: conv.effectiveDate,
        };
      });


      const totalCount = count ?? mapped.length;
      databaseStatusStore.transactions = {
        source: 'supabase',
        error: null,
        state: 'live_records',
        details: `Loaded ${mapped.length} live records from Supabase transactions table (Total: ${totalCount}).`,
      };

      return {
        data: mapped,
        source: 'supabase',
        error: null,
        count: mapped.length,
        totalCount,
        state: 'live_records',
        details: `Retrieved ${mapped.length} live rows from Supabase (Total: ${totalCount}).`,
        hasAuthSession,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      };
    }

    // Case 2: Supabase query returned 0 records (or restricted by RLS for unauthenticated users)
    const notice = hasAuthSession
      ? null
      : 'Unauthenticated session: Supabase Row-Level Security (RLS) restricts access to confirmed users.';
    databaseStatusStore.transactions = {
      source: hasAuthSession ? 'supabase' : 'fallback',
      error: notice,
      state: hasAuthSession ? 'zero_records' : 'demo_session_rls',
      details: hasAuthSession
        ? `Live Supabase table queried successfully; 0 records exist for tenant ${tenantId}.`
        : 'Postgres RLS restricts anon queries to 0 rows. Authenticate with an active Supabase Auth session to access protected records.',
    };

    if (hasAuthSession) {
      return {
        data: [],
        source: 'supabase',
        error: null,
        count: 0,
        totalCount: 0,
        state: 'zero_records',
        details: `Authenticated query returned 0 records from Supabase transactions table for tenant ${tenantId}.`,
        hasAuthSession,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    return {
      data: [],
      source: 'fallback',
      error: notice,
      count: 0,
      totalCount: 0,
      state: 'demo_session_rls',
      details: 'Postgres RLS restricts unauthenticated queries to 0 rows. Sign in with an authenticated Supabase session to view institutional transactions.',
      hasAuthSession: false,
      page,
      pageSize,
      totalPages: 1,
    };
  } catch (err: any) {
    const hasSession = await checkHasSupabaseAuthSession(client);
    const errState = classifyErrorState(err, hasSession);
    const errorMsg = err?.message || 'Network error querying Supabase';
    databaseStatusStore.transactions = {
      source: 'fallback',
      error: errorMsg,
      state: errState,
      details: errorMsg,
    };
    return {
      data: [],
      source: 'fallback',
      error: errorMsg,
      count: 0,
      totalCount: 0,
      state: errState,
      details: `Unexpected error querying Supabase: ${errorMsg}`,
      hasAuthSession: hasSession,
      page,
      pageSize,
      totalPages: 1,
    };
  }
  };

  if (options?.signal) {
    return runQuery();
  }
  const dedupeKey = `tx_list:${getClientScopeKey(client)}:${tenantId}:${page}:${pageSize}:${options?.userId || ''}:${options?.search || ''}:${options?.category || ''}:${options?.type || ''}:${options?.status || ''}:${options?.startDate || ''}:${options?.endDate || ''}:${options?.countMode || 'estimated'}`;
  return dedupeInFlight(dedupeKey, runQuery);
}

/**
 * Fetch Customer Transactions with Supabase priority and tenant fallback
 */
export async function fetchTransactionsFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions
): Promise<CustomerTransaction[]> {
  const result = await fetchTransactionsResultFromDb(tenantId, options);
  return result.data;
}

export interface TransactionAggregates {
  totalCount: number;
  settledCount: number;
  settledVolumeInr: number;
  settledVolumeUsd: number; // Backwards-compatible field
  settledVolumeOriginal: number;
  creditsVolumeInr: number;
  creditsVolumeUsd: number; // Backwards-compatible field
  debitsVolumeInr: number;
  debitsVolumeUsd: number; // Backwards-compatible field
  netLiquidBalanceInr: number;
  netLiquidBalanceUsd: number; // Backwards-compatible field
  volumeByCurrency: Record<string, { original: number; inr: number; usd?: number; rate: number; effectiveDate: string }>;
  volumeByDay?: { date: string; volumeInr: number; count: number }[];
  categoryBreakdown?: Record<string, { count: number; volumeInr: number }>;
  typeBreakdown?: Record<string, { count: number; volumeInr: number }>;
  statusBreakdown?: Record<string, { count: number; volumeInr: number }>;
  topMerchants?: { merchant: string; count: number; volumeInr: number }[];
  unconvertedCount?: number;
  unconvertedVolumeOriginal?: number;
  hasUnconvertedRecords?: boolean;
  source: 'supabase' | 'fallback';
  state: QueryResultState;
  error?: string | null;
  hasAuthSession: boolean;
  reportingBaseCurrency: 'INR';
  isPartial: boolean;
  rejectedRecordsCount: number;
}

function emptyTransactionAggregates(
  state: QueryResultState,
  error: string | null,
  hasAuthSession: boolean = false
): TransactionAggregates {
  return {
    totalCount: 0,
    settledCount: 0,
    settledVolumeInr: 0,
    settledVolumeUsd: 0,
    settledVolumeOriginal: 0,
    creditsVolumeInr: 0,
    creditsVolumeUsd: 0,
    debitsVolumeInr: 0,
    debitsVolumeUsd: 0,
    netLiquidBalanceInr: 0,
    netLiquidBalanceUsd: 0,
    volumeByCurrency: {},
    volumeByDay: [],
    categoryBreakdown: {},
    typeBreakdown: {},
    statusBreakdown: {},
    topMerchants: [],
    unconvertedCount: 0,
    unconvertedVolumeOriginal: 0,
    hasUnconvertedRecords: false,
    source: 'fallback',
    state,
    error,
    hasAuthSession,
    reportingBaseCurrency: 'INR',
    isPartial: false,
    rejectedRecordsCount: 0,
  };
}

/**
 * Fetch Complete Dataset Transaction Aggregates in INR Base
 * Solves pagination truncation: sums the complete database collection rather than the current page.
 */
export async function fetchTransactionAggregatesResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions,
  clientOverride?: any
): Promise<TransactionAggregates> {
  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  if (!configured || !client) {
    return emptyTransactionAggregates(
      'unconfigured',
      'Supabase client is not configured (missing URL or anon key).',
      false
    );
  }

  if (await shouldSkipUnauthenticatedQuery(client, clientOverride)) {
    return emptyTransactionAggregates(
      'demo_session_rls',
      'Authentication required: Active Supabase Auth session needed for transaction aggregates.',
      false
    );
  }

  const runAggregate = async (): Promise<TransactionAggregates> => {
  const correlationId = createTelemetryCorrelationId();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const dateRangeDays = computeDateRangeDays(options?.startDate, options?.endDate);
  const callerRole = getActiveSessionRole(clientOverride) || 'AUTHENTICATED';
  const elapsedMs = () =>
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;

  // 1. Attempt PostgreSQL server-side RPC aggregate function
  try {
    const rpcParams: Record<string, any> = {
      p_tenant_id: tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root' ? tenantId : null,
      p_user_id: options?.userId || null,
      p_start_date: options?.startDate || null,
      p_end_date: options?.endDate || null,
      p_status: options?.status && options.status !== 'ALL' ? options.status : null,
      p_type: options?.type && options.type !== 'ALL' ? options.type : null,
    };

    const { data: rpcData, error: rpcError } = await applyAbortSignal(
      client.rpc('get_transaction_aggregates', rpcParams),
      options?.signal
    );

    if (!rpcError && rpcData && typeof rpcData === 'object' && 'totalCount' in rpcData) {
      const hasAuthSession = await checkHasSupabaseAuthSession(client);
      recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'Transactions Analytics',
        rpcName: 'get_transaction_aggregates',
        sqlstate: '00000',
        durationMs: elapsedMs(),
        dateRangeDays,
        role: callerRole,
        tenantScope: tenantId,
        outcome: 'SUCCESS',
      });
      const usdRate = 84.070000;

      const settledVolumeInr = rpcData.settledVolumeInr !== undefined
        ? Number(rpcData.settledVolumeInr) || 0
        : Math.round((Number(rpcData.settledVolumeUsd) || 0) * usdRate * 100) / 100;
      const settledVolumeUsd = rpcData.settledVolumeUsd !== undefined
        ? Number(rpcData.settledVolumeUsd) || 0
        : Math.round((settledVolumeInr / usdRate) * 100) / 100;

      const creditsVolumeInr = rpcData.creditsVolumeInr !== undefined
        ? Number(rpcData.creditsVolumeInr) || 0
        : Math.round((Number(rpcData.creditsVolumeUsd) || 0) * usdRate * 100) / 100;
      const creditsVolumeUsd = rpcData.creditsVolumeUsd !== undefined
        ? Number(rpcData.creditsVolumeUsd) || 0
        : Math.round((creditsVolumeInr / usdRate) * 100) / 100;

      const debitsVolumeInr = rpcData.debitsVolumeInr !== undefined
        ? Number(rpcData.debitsVolumeInr) || 0
        : Math.round((Number(rpcData.debitsVolumeUsd) || 0) * usdRate * 100) / 100;
      const debitsVolumeUsd = rpcData.debitsVolumeUsd !== undefined
        ? Number(rpcData.debitsVolumeUsd) || 0
        : Math.round((debitsVolumeInr / usdRate) * 100) / 100;

      const netLiquidBalanceInr = rpcData.netLiquidBalanceInr !== undefined
        ? Number(rpcData.netLiquidBalanceInr) || 0
        : Math.round((creditsVolumeInr - debitsVolumeInr) * 100) / 100;
      const netLiquidBalanceUsd = rpcData.netLiquidBalanceUsd !== undefined
        ? Number(rpcData.netLiquidBalanceUsd) || 0
        : Math.round((netLiquidBalanceInr / usdRate) * 100) / 100;

      return {
        totalCount: Number(rpcData.totalCount) || 0,
        settledCount: Number(rpcData.settledCount) || 0,
        settledVolumeInr,
        settledVolumeUsd,
        settledVolumeOriginal: Number(rpcData.settledVolumeOriginal) || 0,
        creditsVolumeInr,
        creditsVolumeUsd,
        debitsVolumeInr,
        debitsVolumeUsd,
        netLiquidBalanceInr,
        netLiquidBalanceUsd,
        volumeByCurrency: rpcData.volumeByCurrency || {},
        volumeByDay: Array.isArray(rpcData.volumeByDay) ? rpcData.volumeByDay : [],
        categoryBreakdown: rpcData.categoryBreakdown || {},
        typeBreakdown: rpcData.typeBreakdown || {},
        statusBreakdown: rpcData.statusBreakdown || {},
        topMerchants: Array.isArray(rpcData.topMerchants) ? rpcData.topMerchants : [],
        unconvertedCount: Number(rpcData.unconvertedCount) || 0,
        unconvertedVolumeOriginal: Number(rpcData.unconvertedVolumeOriginal) || 0,
        hasUnconvertedRecords: Boolean(rpcData.hasUnconvertedRecords),
        source: 'supabase',
        state: (Number(rpcData.totalCount) > 0) ? 'live_records' : (hasAuthSession ? 'zero_records' : 'demo_session_rls'),
        error: null,
        hasAuthSession,
        reportingBaseCurrency: 'INR',
        isPartial: Boolean(rpcData.isPartial),
        rejectedRecordsCount: Number(rpcData.rejectedRecordsCount) || 0,
      };
    }

    if (rpcError && !isMissingRpcError(rpcError)) {
      const hasAuthSession = await checkHasSupabaseAuthSession(client);
      const state = classifyErrorState(rpcError, hasAuthSession);
      const diag = recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'Transactions Analytics',
        rpcName: 'get_transaction_aggregates',
        sqlstate: extractSafeSqlstate(rpcError),
        durationMs: elapsedMs(),
        dateRangeDays,
        role: callerRole,
        tenantScope: tenantId,
        outcome: isAbortError(rpcError, options?.signal)
          ? 'ABORTED'
          : state === 'timeout'
          ? 'TIMEOUT'
          : state === 'restricted' || state === 'demo_session_rls'
          ? 'RESTRICTED'
          : 'ERROR',
      });
      return emptyTransactionAggregates(
        state,
        formatTelemetryDiagnosticError(diag, rpcError.message || 'Transaction aggregate RPC failed.'),
        hasAuthSession
      );
    }
  } catch (err: any) {
    const hasAuthSession = await checkHasSupabaseAuthSession(client);
    const state = classifyErrorState(err, hasAuthSession);
    const diag = recordTelemetryDiagnostic({
      correlationId,
      widgetName: 'Transactions Analytics',
      rpcName: 'get_transaction_aggregates',
      sqlstate: extractSafeSqlstate(err),
      durationMs: elapsedMs(),
      dateRangeDays,
      role: callerRole,
      tenantScope: tenantId,
      outcome: isAbortError(err, options?.signal)
        ? 'ABORTED'
        : state === 'timeout'
        ? 'TIMEOUT'
        : state === 'restricted' || state === 'demo_session_rls'
        ? 'RESTRICTED'
        : 'ERROR',
    });
    return emptyTransactionAggregates(
      state,
      formatTelemetryDiagnosticError(diag, err?.message || 'Unexpected error invoking get_transaction_aggregates.'),
      hasAuthSession
    );
  }

  // 2. Fallback Chunked Batch Fetch ONLY when RPC is absent in target database
  try {
    const MAX_FALLBACK_ROWS = 2000;
    const CHUNK_SIZE = 1000;
    let offset = 0;
    let allRows: any[] = [];
    let hasMore = true;
    let lastQueryError: any = null;

    while (hasMore && allRows.length < MAX_FALLBACK_ROWS) {
      let query = client
        .from('transactions')
        .select('id, amount, currency, type, status, date, tenant_id, user_id, merchant, category')
        .range(offset, offset + CHUNK_SIZE - 1);

      if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
        query = query.eq('tenant_id', tenantId);
      }
      if (options?.userId) {
        query = query.eq('user_id', options.userId);
      }
      if (options?.startDate) {
        query = query.gte('date', options.startDate);
      }
      if (options?.endDate) {
        query = query.lte('date', options.endDate);
      }
      if (options?.status && options.status !== 'ALL') {
        query = query.eq('status', options.status);
      }
      if (options?.type && options.type !== 'ALL') {
        query = query.eq('type', options.type);
      }

      const { data, error } = await query;

      if (error) {
        lastQueryError = error;
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRows = allRows.concat(data);
        if (data.length < CHUNK_SIZE) {
          hasMore = false;
        } else {
          offset += CHUNK_SIZE;
        }
      }
    }

    const hasAuthSession = await checkHasSupabaseAuthSession(client);

    if (lastQueryError) {
      return emptyTransactionAggregates(
        classifyErrorState(lastQueryError, hasAuthSession),
        lastQueryError.message || 'Database query failed while loading transactions.',
        hasAuthSession
      );
    }

    if (allRows.length > 0) {
      let settledCount = 0;
      let settledVolumeInr = 0;
      let settledVolumeOriginal = 0;
      let creditsVolumeInr = 0;
      let debitsVolumeInr = 0;
      const volumeByCurrency: Record<string, { original: number; inr: number; usd?: number; rate: number; effectiveDate: string }> = {};
      const categoryBreakdown: Record<string, { count: number; volumeInr: number }> = {};
      const typeBreakdown: Record<string, { count: number; volumeInr: number }> = {};
      const statusBreakdown: Record<string, { count: number; volumeInr: number }> = {};
      const merchantMap: Record<string, { count: number; volumeInr: number }> = {};
      const dayMap: Record<string, { volumeInr: number; count: number }> = {};
      let rejected = 0;

      for (const row of allRows) {
        const amt = Number(row.amount) || 0;
        const curr = (row.currency || (row.tenant_id === 'tenant_crest_capital' ? 'GBP' : row.tenant_id === 'tenant_vanguard_wealth' || row.tenant_id === 'tenant_solaris_credit' ? 'EUR' : 'INR')).toUpperCase();
        const conv = convertToInr(amt, curr);

        if (!volumeByCurrency[curr]) {
          volumeByCurrency[curr] = { original: 0, inr: 0, usd: 0, rate: conv.exchangeRate, effectiveDate: conv.effectiveDate };
        }
        volumeByCurrency[curr].original = Math.round((volumeByCurrency[curr].original + amt) * 100) / 100;
        volumeByCurrency[curr].inr = Math.round((volumeByCurrency[curr].inr + conv.amountInr) * 100) / 100;
        volumeByCurrency[curr].usd = Math.round(((volumeByCurrency[curr].usd || 0) + conv.amountUsd) * 100) / 100;

        const st = (row.status || 'Settled').trim();
        const stUpper = st.toUpperCase();
        const isSettled = !row.status || stUpper === 'SETTLED' || stUpper === 'COMPLETED' || stUpper === 'SUCCESS' || stUpper === 'ESCROW SECURED';
        if (isSettled) {
          settledCount++;
          settledVolumeInr += conv.amountInr;
          settledVolumeOriginal += amt;
        }

        const ty = (row.type || 'Debit').trim();
        const tyUpper = ty.toUpperCase();
        if (tyUpper === 'CREDIT' || tyUpper === 'DEPOSIT') {
          creditsVolumeInr += conv.amountInr;
        } else {
          debitsVolumeInr += conv.amountInr;
        }

        const cat = row.category || 'Securities & Equities';
        if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, volumeInr: 0 };
        categoryBreakdown[cat].count += 1;
        categoryBreakdown[cat].volumeInr += conv.amountInr;

        const typeLabel = tyUpper === 'CREDIT' ? 'Credit' : 'Debit';
        if (!typeBreakdown[typeLabel]) typeBreakdown[typeLabel] = { count: 0, volumeInr: 0 };
        typeBreakdown[typeLabel].count += 1;
        typeBreakdown[typeLabel].volumeInr += conv.amountInr;

        if (!statusBreakdown[st]) statusBreakdown[st] = { count: 0, volumeInr: 0 };
        statusBreakdown[st].count += 1;
        statusBreakdown[st].volumeInr += conv.amountInr;

        const merch = row.merchant || 'Institutional Wire';
        if (!merchantMap[merch]) merchantMap[merch] = { count: 0, volumeInr: 0 };
        merchantMap[merch].count += 1;
        merchantMap[merch].volumeInr += conv.amountInr;

        const dStr = row.date || 'Unknown';
        if (dStr === 'Unknown') {
          rejected++;
        }
        if (!dayMap[dStr]) dayMap[dStr] = { volumeInr: 0, count: 0 };
        dayMap[dStr].count += 1;
        dayMap[dStr].volumeInr += conv.amountInr;
      }

      settledVolumeInr = Math.round(settledVolumeInr * 100) / 100;
      creditsVolumeInr = Math.round(creditsVolumeInr * 100) / 100;
      debitsVolumeInr = Math.round(debitsVolumeInr * 100) / 100;
      const netLiquidBalanceInr = Math.round((creditsVolumeInr - debitsVolumeInr) * 100) / 100;
      const usdRate = 84.070000;
      const settledVolumeUsd = Math.round((settledVolumeInr / usdRate) * 100) / 100;
      const creditsVolumeUsd = Math.round((creditsVolumeInr / usdRate) * 100) / 100;
      const debitsVolumeUsd = Math.round((debitsVolumeInr / usdRate) * 100) / 100;
      const netLiquidBalanceUsd = Math.round((netLiquidBalanceInr / usdRate) * 100) / 100;

      const topMerchants = Object.entries(merchantMap)
        .map(([merchant, val]) => ({ merchant, count: val.count, volumeInr: Math.round(val.volumeInr) }))
        .sort((a, b) => b.volumeInr - a.volumeInr)
        .slice(0, 6);

      const volumeByDay = Object.entries(dayMap)
        .map(([date, val]) => ({ date, volumeInr: Math.round(val.volumeInr), count: val.count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalCount: allRows.length,
        settledCount,
        settledVolumeInr,
        settledVolumeUsd,
        settledVolumeOriginal: Math.round(settledVolumeOriginal * 100) / 100,
        creditsVolumeInr,
        creditsVolumeUsd,
        debitsVolumeInr,
        debitsVolumeUsd,
        netLiquidBalanceInr,
        netLiquidBalanceUsd,
        volumeByCurrency,
        volumeByDay,
        categoryBreakdown,
        typeBreakdown,
        statusBreakdown,
        topMerchants,
        unconvertedCount: 0,
        unconvertedVolumeOriginal: 0,
        hasUnconvertedRecords: false,
        source: 'supabase',
        state: 'live_records',
        error: null,
        hasAuthSession,
        reportingBaseCurrency: 'INR',
        isPartial: allRows.length >= MAX_FALLBACK_ROWS,
        rejectedRecordsCount: rejected,
      };
    }

    if (hasAuthSession) {
      return {
        ...emptyTransactionAggregates('zero_records', null, true),
        source: 'supabase',
      };
    }

    return emptyTransactionAggregates(
      'demo_session_rls',
      'Authentication required: Supabase RLS restricts unauthenticated access.',
      false
    );
  } catch (err: any) {
    const hasSession = await checkHasSupabaseAuthSession(client);
    return emptyTransactionAggregates(
      classifyErrorState(err, hasSession),
      err?.message || 'Unexpected error querying transaction aggregates.',
      hasSession
    );
  }
  };

  if (options?.signal) {
    return runAggregate();
  }
  const dedupeKey = `tx_agg:${getClientScopeKey(client)}:${tenantId}:${options?.userId || ''}:${options?.startDate || ''}:${options?.endDate || ''}:${options?.status || ''}:${options?.type || ''}`;
  return dedupeInFlight(dedupeKey, runAggregate);
}




/**
 * Fetch Fraud & AML Cases with Supabase priority, transparent error reporting, and tenant fallback
 */
export async function fetchFraudCasesResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions,
  clientOverride?: any
): Promise<DatabaseQueryResult<FinanceFraudTransaction[]>> {
  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  const page = Math.max(1, options?.page || 1);
  const pageSize = options?.pageSize || 50;

  if (!configured || !client) {
    const errorMsg = 'Supabase client not configured (missing URL or anon key)';
    databaseStatusStore.fraudCases = {
      source: 'fallback',
      error: errorMsg,
      state: 'unconfigured',
      details: 'Supabase credentials are not configured in the application environment.',
    };
    return {
      data: [],
      source: 'fallback',
      error: errorMsg,
      count: 0,
      totalCount: 0,
      state: 'unconfigured',
      details: 'Supabase client is not configured; no live fraud cases available.',
      hasAuthSession: false,
      page: 1,
      pageSize,
      totalPages: 1,
    };
  }

  if (await shouldSkipUnauthenticatedQuery(client, clientOverride)) {
    const notice = 'Authentication required: Active Supabase Auth session needed to query fraud_cases.';
    databaseStatusStore.fraudCases = {
      source: 'fallback',
      error: notice,
      state: 'demo_session_rls',
      details: 'Postgres RLS restricts unauthenticated access to fraud_cases.',
    };
    return {
      data: [],
      source: 'fallback',
      error: notice,
      count: 0,
      totalCount: 0,
      state: 'demo_session_rls',
      details: 'Authenticate with an active Supabase Auth session to access protected fraud surveillance records.',
      hasAuthSession: false,
      page: 1,
      pageSize,
      totalPages: 1,
    };
  }

  const activeRole = getActiveSessionRole(clientOverride);
  if (activeRole && !canRoleAccessFraudTelemetry(activeRole)) {
    const notice = `Restricted: Role ${activeRole} is not authorized to query fraud_cases.`;
    databaseStatusStore.fraudCases = {
      source: 'fallback',
      error: notice,
      state: 'restricted',
      details: notice,
    };
    return {
      data: [],
      source: 'fallback',
      error: notice,
      count: 0,
      totalCount: 0,
      state: 'restricted',
      details: notice,
      hasAuthSession: true,
      page: 1,
      pageSize,
      totalPages: 1,
    };
  }

  const runQuery = async (): Promise<DatabaseQueryResult<FinanceFraudTransaction[]>> => {
  try {
    const countMode = options?.countMode || 'estimated';
    let query = client
      .from('fraud_cases')
      .select('*', { count: countMode })
      .order('timestamp', { ascending: false });

    if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
      query = query.eq('tenant_id', tenantId);
    }

    if (options?.search) {
      const s = options.search.trim();
      query = query.or(`customer_name.ilike.%${s}%,rule_triggered.ilike.%${s}%,aml_flag.ilike.%${s}%,id.ilike.%${s}%`);
    }

    if (options?.status && options.status !== 'ALL') {
      query = query.eq('status', options.status);
    }

    if (options?.currency && options.currency !== 'ALL') {
      query = query.eq('currency', options.currency);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = applyAbortSignal(query.range(from, to), options?.signal);

    const { data, error, count } = await query;

    if (error) {
      const hasAuthSession = await checkHasSupabaseAuthSession(client);
      if (error.code === 'PGRST103' || error.message?.includes('range not satisfiable')) {
        return {
          data: [],
          source: 'supabase',
          error: null,
          count: 0,
          totalCount: 0,
          state: 'zero_records',
          details: 'Pagination range adjusted to available records.',
          hasAuthSession,
          page,
          pageSize,
          totalPages: 1,
        };
      }
      const errState = classifyErrorState(error, hasAuthSession);
      const errorMsg = `${error.code || 'ERR'}: ${error.message || 'Database query failed'}`;
      databaseStatusStore.fraudCases = {
        source: 'fallback',
        error: errorMsg,
        state: errState,
        details: error.message,
      };
      return {
        data: [],
        source: 'fallback',
        error: errorMsg,
        count: 0,
        totalCount: 0,
        state: errState,
        details: `Supabase query rejected: ${error.message}`,
        hasAuthSession,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    const hasAuthSession = await checkHasSupabaseAuthSession(client);

    if (data && data.length > 0) {
      const mapped: FinanceFraudTransaction[] = data.map((f: any) => {
        const rawCurr = (f.currency || 'INR').toUpperCase();
        const conv = convertToInr(Number(f.amount) || 0, rawCurr);
        return {
          id: f.id,
          timestamp: f.timestamp || 'Just now',
          customerName: f.customer_name || 'Anonymous Client',
          customerId: f.customer_id || 'CUST-000',
          amount: Number(f.amount) || 0,
          currency: (rawCurr as any) || 'INR',
          riskScore: Number(f.risk_score) || 50,
          amlFlag: f.aml_flag || 'Clean / Verified',
          status: (f.status || 'Flagged') as 'Flagged' | 'In Review' | 'Cleared' | 'Frozen Escrow',
          location: f.location || 'Global Rail',
          paymentChannel: f.payment_channel || 'SWIFT GPI',
          ruleTriggered: f.rule_triggered || 'Standard Surveillance',
          aiConfidencePct: Number(f.ai_confidence_pct) || 98.4,
          tenantId: f.tenant_id,
          tenantName: f.tenant_name,
          amountInr: conv.amountInr,
          amountUsd: conv.amountUsd,
          exchangeRate: conv.exchangeRate,
          exchangeRateDate: conv.effectiveDate,
        };
      });


      const totalCount = count ?? mapped.length;
      databaseStatusStore.fraudCases = {
        source: 'supabase',
        error: null,
        state: 'live_records',
        details: `Loaded ${mapped.length} live records from Supabase fraud_cases table (Total: ${totalCount}).`,
      };

      return {
        data: mapped,
        source: 'supabase',
        error: null,
        count: mapped.length,
        totalCount,
        state: 'live_records',
        details: `Retrieved ${mapped.length} live rows from Supabase (Total: ${totalCount}).`,
        hasAuthSession,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      };
    }

    const notice = hasAuthSession
      ? null
      : 'Unauthenticated session: Supabase Row-Level Security (RLS) restricts access to confirmed users.';
    databaseStatusStore.fraudCases = {
      source: hasAuthSession ? 'supabase' : 'fallback',
      error: notice,
      state: hasAuthSession ? 'zero_records' : 'demo_session_rls',
      details: hasAuthSession
        ? `Live Supabase table queried successfully; 0 records exist for tenant ${tenantId}.`
        : 'Postgres RLS restricts anon queries to 0 rows. Authenticate with an active Supabase Auth session to access protected records.',
    };

    if (hasAuthSession) {
      return {
        data: [],
        source: 'supabase',
        error: null,
        count: 0,
        totalCount: 0,
        state: 'zero_records',
        details: `Authenticated query returned 0 records from Supabase fraud_cases table for tenant ${tenantId}.`,
        hasAuthSession,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    return {
      data: [],
      source: 'fallback',
      error: notice,
      count: 0,
      totalCount: 0,
      state: 'demo_session_rls',
      details: 'Postgres RLS restricts unauthenticated queries to 0 rows. Sign in with an authenticated Supabase session to view fraud cases.',
      hasAuthSession: false,
      page,
      pageSize,
      totalPages: 1,
    };
  } catch (err: any) {
    const hasSession = await checkHasSupabaseAuthSession(client);
    const errState = classifyErrorState(err, hasSession);
    const errorMsg = err?.message || 'Network error querying Supabase';
    databaseStatusStore.fraudCases = {
      source: 'fallback',
      error: errorMsg,
      state: errState,
      details: errorMsg,
    };
    return {
      data: [],
      source: 'fallback',
      error: errorMsg,
      count: 0,
      totalCount: 0,
      state: errState,
      details: `Unexpected error querying Supabase: ${errorMsg}`,
      hasAuthSession: hasSession,
      page,
      pageSize,
      totalPages: 1,
    };
  }
  };

  if (options?.signal) {
    return runQuery();
  }
  const dedupeKey = `fraud_list:${getClientScopeKey(client)}:${tenantId}:${page}:${pageSize}:${options?.search || ''}:${options?.status || ''}:${options?.currency || ''}:${options?.countMode || 'estimated'}`;
  return dedupeInFlight(dedupeKey, runQuery);
}

export async function fetchFraudCasesFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions
): Promise<FinanceFraudTransaction[]> {
  const result = await fetchFraudCasesResultFromDb(tenantId, options);
  return result.data;
}

export interface FraudAggregates {
  totalCases: number;
  flaggedCount: number;
  frozenCount: number;
  clearedCount: number;
  preventedVolumeInr: number;
  preventedVolumeUsd: number; // Backwards-compatible field
  preventedVolumeOriginal: number;
  monitoredVolumeInr: number;
  monitoredVolumeUsd: number; // Backwards-compatible field
  volumeByCurrency: Record<string, { original: number; inr: number; usd?: number; rate: number; effectiveDate: string }>;
  riskTierDistribution?: { tier: string; count: number; volumeInr: number }[];
  channelDistribution?: { channel: string; count: number; volumeInr: number }[];
  ruleDistribution?: { rule: string; count: number }[];
  casesByDay?: { date: string; count: number; preventedInr: number }[];
  source: 'supabase' | 'fallback';
  state: QueryResultState;
  error?: string | null;
  hasAuthSession: boolean;
  reportingBaseCurrency: 'INR';
}

function emptyFraudAggregates(
  state: QueryResultState,
  error: string | null,
  hasAuthSession: boolean = false
): FraudAggregates {
  return {
    totalCases: 0,
    flaggedCount: 0,
    frozenCount: 0,
    clearedCount: 0,
    preventedVolumeInr: 0,
    preventedVolumeUsd: 0,
    preventedVolumeOriginal: 0,
    monitoredVolumeInr: 0,
    monitoredVolumeUsd: 0,
    volumeByCurrency: {},
    riskTierDistribution: [],
    channelDistribution: [],
    ruleDistribution: [],
    casesByDay: [],
    source: 'fallback',
    state,
    error,
    hasAuthSession,
    reportingBaseCurrency: 'INR',
  };
}

/**
 * Fetch Complete Dataset Fraud Aggregates in INR Base
 * Solves pagination truncation: sums all monitored fraud cases and frozen amounts across entire dataset.
 */
export async function fetchFraudAggregatesResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions,
  clientOverride?: any
): Promise<FraudAggregates> {
  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  if (!configured || !client) {
    return emptyFraudAggregates(
      'unconfigured',
      'Supabase client is not configured (missing URL or anon key).',
      false
    );
  }

  if (await shouldSkipUnauthenticatedQuery(client, clientOverride)) {
    return emptyFraudAggregates(
      'demo_session_rls',
      'Authentication required: Active Supabase Auth session needed for fraud surveillance aggregates.',
      false
    );
  }

  const activeRole = getActiveSessionRole(clientOverride);
  if (activeRole && !canRoleAccessFraudTelemetry(activeRole)) {
    return emptyFraudAggregates(
      'restricted',
      `Restricted: Role ${activeRole} is not authorized for fraud surveillance analytics.`,
      true
    );
  }

  const usdRate = 84.070000;

  const runAggregate = async (): Promise<FraudAggregates> => {
  const correlationId = createTelemetryCorrelationId();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const dateRangeDays = computeDateRangeDays(options?.startDate, options?.endDate);
  const callerRole = activeRole || 'AUTHENTICATED';
  const elapsedMs = () =>
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;

  // 1. Attempt PostgreSQL server-side RPC aggregate function
  try {
    const rpcParams: Record<string, any> = {
      p_tenant_id: tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root' ? tenantId : null,
      p_currency: options?.currency && options.currency !== 'ALL' ? options.currency : null,
      p_start_date: options?.startDate || null,
      p_end_date: options?.endDate || null,
      p_customer_id: options?.userId || null,
      p_status: options?.status && options.status !== 'ALL' ? options.status : null,
    };
    const { data: rpcData, error: rpcError } = await applyAbortSignal(
      client.rpc('get_fraud_aggregates', rpcParams),
      options?.signal
    );
    if (!rpcError && rpcData && typeof rpcData === 'object' && 'totalCases' in rpcData) {
      const hasAuthSession = await checkHasSupabaseAuthSession(client);
      recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'Fraud & AML Surveillance',
        rpcName: 'get_fraud_aggregates',
        sqlstate: '00000',
        durationMs: elapsedMs(),
        dateRangeDays,
        role: callerRole,
        tenantScope: tenantId,
        outcome: 'SUCCESS',
      });

      const preventedVolumeInr = rpcData.preventedVolumeInr !== undefined
        ? Number(rpcData.preventedVolumeInr) || 0
        : Math.round((Number(rpcData.preventedVolumeUsd) || 0) * usdRate * 100) / 100;

      const preventedVolumeUsd = rpcData.preventedVolumeUsd !== undefined
        ? Number(rpcData.preventedVolumeUsd) || 0
        : Math.round((preventedVolumeInr / usdRate) * 100) / 100;

      const monitoredVolumeInr = rpcData.monitoredVolumeInr !== undefined
        ? Number(rpcData.monitoredVolumeInr) || 0
        : Math.round((Number(rpcData.monitoredVolumeUsd) || 0) * usdRate * 100) / 100;

      const monitoredVolumeUsd = rpcData.monitoredVolumeUsd !== undefined
        ? Number(rpcData.monitoredVolumeUsd) || 0
        : Math.round((monitoredVolumeInr / usdRate) * 100) / 100;

      return {
        totalCases: Number(rpcData.totalCases) || 0,
        flaggedCount: Number(rpcData.flaggedCount) || 0,
        frozenCount: Number(rpcData.frozenCount) || 0,
        clearedCount: Number(rpcData.clearedCount) || 0,
        preventedVolumeInr,
        preventedVolumeUsd,
        preventedVolumeOriginal: Number(rpcData.preventedVolumeOriginal) || 0,
        monitoredVolumeInr,
        monitoredVolumeUsd,
        volumeByCurrency: rpcData.volumeByCurrency || {},
        riskTierDistribution: Array.isArray(rpcData.riskTierDistribution) ? rpcData.riskTierDistribution : [],
        channelDistribution: Array.isArray(rpcData.channelDistribution) ? rpcData.channelDistribution : [],
        ruleDistribution: Array.isArray(rpcData.ruleDistribution) ? rpcData.ruleDistribution : [],
        casesByDay: Array.isArray(rpcData.casesByDay) ? rpcData.casesByDay : [],
        source: 'supabase',
        state: (Number(rpcData.totalCases) > 0) ? 'live_records' : (hasAuthSession ? 'zero_records' : 'demo_session_rls'),
        error: null,
        hasAuthSession,
        reportingBaseCurrency: 'INR',
      };
    }

    if (rpcError && !isMissingRpcError(rpcError)) {
      const hasAuthSession = await checkHasSupabaseAuthSession(client);
      const state = classifyErrorState(rpcError, hasAuthSession);
      const diag = recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'Fraud & AML Surveillance',
        rpcName: 'get_fraud_aggregates',
        sqlstate: extractSafeSqlstate(rpcError),
        durationMs: elapsedMs(),
        dateRangeDays,
        role: callerRole,
        tenantScope: tenantId,
        outcome: isAbortError(rpcError, options?.signal)
          ? 'ABORTED'
          : state === 'timeout'
          ? 'TIMEOUT'
          : state === 'restricted' || state === 'demo_session_rls'
          ? 'RESTRICTED'
          : 'ERROR',
      });
      return emptyFraudAggregates(
        state,
        formatTelemetryDiagnosticError(diag, rpcError.message || 'Fraud aggregate RPC failed.'),
        hasAuthSession
      );
    }
  } catch (err: any) {
    const hasAuthSession = await checkHasSupabaseAuthSession(client);
    const state = classifyErrorState(err, hasAuthSession);
    const diag = recordTelemetryDiagnostic({
      correlationId,
      widgetName: 'Fraud & AML Surveillance',
      rpcName: 'get_fraud_aggregates',
      sqlstate: extractSafeSqlstate(err),
      durationMs: elapsedMs(),
      dateRangeDays,
      role: callerRole,
      tenantScope: tenantId,
      outcome: isAbortError(err, options?.signal)
        ? 'ABORTED'
        : state === 'timeout'
        ? 'TIMEOUT'
        : state === 'restricted' || state === 'demo_session_rls'
        ? 'RESTRICTED'
        : 'ERROR',
    });
    return emptyFraudAggregates(
      state,
      formatTelemetryDiagnosticError(diag, err?.message || 'Unexpected error invoking get_fraud_aggregates.'),
      hasAuthSession
    );
  }

  // 2. Fallback Chunked Batch Fetch ONLY when RPC is absent in target database
  try {
    const MAX_FALLBACK_ROWS = 5000;
    const CHUNK_SIZE = 1000;
    let offset = 0;
    let allRows: any[] = [];
    let hasMore = true;
    let lastQueryError: any = null;

    while (hasMore && allRows.length < MAX_FALLBACK_ROWS) {
      let query = client
        .from('fraud_cases')
        .select('id, amount, currency, status, risk_score, tenant_id, location, payment_channel, rule_triggered, timestamp')
        .range(offset, offset + CHUNK_SIZE - 1);

      if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
        query = query.eq('tenant_id', tenantId);
      }
      if (options?.currency && options.currency !== 'ALL') {
        query = query.eq('currency', options.currency);
      }

      const { data, error } = await query;
      if (error) {
        lastQueryError = error;
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRows = allRows.concat(data);
        if (data.length < CHUNK_SIZE) {
          hasMore = false;
        } else {
          offset += CHUNK_SIZE;
        }
      }
    }

    const hasAuthSession = await checkHasSupabaseAuthSession(client);

    if (lastQueryError) {
      return emptyFraudAggregates(
        classifyErrorState(lastQueryError, hasAuthSession),
        lastQueryError.message || 'Database query failed while loading fraud cases.',
        hasAuthSession
      );
    }

    if (allRows.length === 0) {
      if (hasAuthSession) {
        return {
          ...emptyFraudAggregates('zero_records', null, true),
          source: 'supabase',
        };
      }

      return emptyFraudAggregates(
        'demo_session_rls',
        'Authentication required: Supabase RLS restricts unauthenticated access.',
        false
      );
    }

    let flaggedCount = 0;
    let frozenCount = 0;
    let clearedCount = 0;
    let preventedVolumeInr = 0;
    let preventedVolumeOriginal = 0;
    let monitoredVolumeInr = 0;
    const volumeByCurrency: Record<string, { original: number; inr: number; usd?: number; rate: number; effectiveDate: string }> = {};
    const riskTierCounts = { critical: 0, critVol: 0, high: 0, highVol: 0, nominal: 0, nomVol: 0 };
    const channelMap: Record<string, { count: number; volumeInr: number }> = {};
    const ruleMap: Record<string, number> = {};
    const dayMap: Record<string, { count: number; preventedInr: number }> = {};

    for (const row of allRows) {
      const amt = Number(row.amount) || 0;
      const curr = (row.currency || 'INR').toUpperCase();
      const conv = convertToInr(amt, curr);

      if (!volumeByCurrency[curr]) {
        volumeByCurrency[curr] = { original: 0, inr: 0, usd: 0, rate: conv.exchangeRate, effectiveDate: conv.effectiveDate };
      }
      volumeByCurrency[curr].original = Math.round((volumeByCurrency[curr].original + amt) * 100) / 100;
      volumeByCurrency[curr].inr = Math.round((volumeByCurrency[curr].inr + conv.amountInr) * 100) / 100;
      volumeByCurrency[curr].usd = Math.round(((volumeByCurrency[curr].usd || 0) + conv.amountUsd) * 100) / 100;

      monitoredVolumeInr += conv.amountInr;

      const st = (row.status || '').toUpperCase();
      const score = Number(row.risk_score) || 0;

      if (score >= 80) {
        riskTierCounts.critical++;
        riskTierCounts.critVol += conv.amountInr;
      } else if (score >= 50) {
        riskTierCounts.high++;
        riskTierCounts.highVol += conv.amountInr;
      } else {
        riskTierCounts.nominal++;
        riskTierCounts.nomVol += conv.amountInr;
      }

      const chan = row.payment_channel || 'SWIFT GPI Cross-Border';
      if (!channelMap[chan]) channelMap[chan] = { count: 0, volumeInr: 0 };
      channelMap[chan].count++;
      channelMap[chan].volumeInr += conv.amountInr;

      const rule = row.rule_triggered || 'Surveillance Rule Triggered';
      ruleMap[rule] = (ruleMap[rule] || 0) + 1;

      const dateStr = (row.timestamp || '').split('T')[0] || 'Recent';
      if (!dayMap[dateStr]) dayMap[dateStr] = { count: 0, preventedInr: 0 };
      dayMap[dateStr].count++;

      if (st.includes('FROZEN') || st.includes('PREVENT') || st.includes('BLOCK') || st === 'CONFIRMED') {
        frozenCount++;
        preventedVolumeInr += conv.amountInr;
        preventedVolumeOriginal += amt;
        dayMap[dateStr].preventedInr += conv.amountInr;
      } else if (st.includes('FLAG') || st.includes('REVIEW') || st === 'OPEN') {
        flaggedCount++;
      } else if (st.includes('CLEAR') || st.includes('FALSE_POSITIVE')) {
        clearedCount++;
      }
    }

    const preventedVolumeUsd = Math.round((preventedVolumeInr / usdRate) * 100) / 100;
    const monitoredVolumeUsd = Math.round((monitoredVolumeInr / usdRate) * 100) / 100;

    return {
      totalCases: allRows.length,
      flaggedCount,
      frozenCount,
      clearedCount,
      preventedVolumeInr: Math.round(preventedVolumeInr * 100) / 100,
      preventedVolumeUsd,
      preventedVolumeOriginal: Math.round(preventedVolumeOriginal * 100) / 100,
      monitoredVolumeInr: Math.round(monitoredVolumeInr * 100) / 100,
      monitoredVolumeUsd,
      volumeByCurrency,
      riskTierDistribution: [
        { tier: 'Critical Anomaly (Risk ≥ 80)', count: riskTierCounts.critical, volumeInr: Math.round(riskTierCounts.critVol) },
        { tier: 'High Threat (Risk 50-79)', count: riskTierCounts.high, volumeInr: Math.round(riskTierCounts.highVol) },
        { tier: 'Nominal Surveillance (< 50)', count: riskTierCounts.nominal, volumeInr: Math.round(riskTierCounts.nomVol) },
      ],
      channelDistribution: Object.entries(channelMap).map(([channel, d]) => ({
        channel,
        count: d.count,
        volumeInr: Math.round(d.volumeInr),
      })),
      ruleDistribution: Object.entries(ruleMap).map(([rule, count]) => ({ rule, count })),
      casesByDay: Object.entries(dayMap).map(([date, d]) => ({ date, count: d.count, preventedInr: Math.round(d.preventedInr) })),
      source: 'supabase',
      state: 'live_records',
      error: null,
      hasAuthSession,
      reportingBaseCurrency: 'INR',
    };
  } catch (err: any) {
    const hasSession = await checkHasSupabaseAuthSession(client);
    return emptyFraudAggregates(
      classifyErrorState(err, hasSession),
      err?.message || 'Unexpected error querying fraud aggregates.',
      hasSession
    );
  }
  };

  if (options?.signal) {
    return runAggregate();
  }
  const dedupeKey = `fraud_agg:${getClientScopeKey(client)}:${tenantId}:${options?.currency || ''}:${options?.startDate || ''}:${options?.endDate || ''}:${options?.userId || ''}:${options?.status || ''}`;
  return dedupeInFlight(dedupeKey, runAggregate);
}

export interface SupportAggregates {
  totalTickets: number;
  openCount: number;
  closedCount: number;
  inProgressCount: number;
  pendingClientCount: number;
  priorityDistribution: { priority: string; count: number; color?: string }[];
  categoryDistribution: { category: string; count: number; percentage: number }[];
  executiveWorkload: { executive: string; activeTickets: number; resolvedTickets: number }[];
  slaCompliancePct: number;
  averageCsat: number;
  resolutionTimeDisplay: string;
  resolutionTimeNote: string;
  source: 'supabase' | 'fallback';
  state: QueryResultState;
  error?: string | null;
  hasAuthSession: boolean;
}

const SUPPORT_RESOLUTION_NOTE =
  'Completed duration unavailable: public.support_tickets stores hours_open (elapsed open duration) without a completed resolution duration timestamp.';

function emptySupportAggregates(
  state: QueryResultState,
  error: string | null,
  hasAuthSession: boolean = false,
  display: string = 'Unavailable'
): SupportAggregates {
  return {
    totalTickets: 0,
    openCount: 0,
    closedCount: 0,
    inProgressCount: 0,
    pendingClientCount: 0,
    priorityDistribution: [],
    categoryDistribution: [],
    executiveWorkload: [],
    slaCompliancePct: 0,
    averageCsat: 0,
    resolutionTimeDisplay: display,
    resolutionTimeNote: SUPPORT_RESOLUTION_NOTE,
    source: 'fallback',
    state,
    error,
    hasAuthSession,
  };
}

/**
 * Fetch Support Ticket Aggregates from Supabase / Complete Dataset
 * Uses public.get_support_aggregates RPC for performance and SECURITY INVOKER RLS compliance.
 */
export async function fetchSupportAggregatesResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions,
  clientOverride?: any
): Promise<SupportAggregates> {
  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  if (!configured || !client) {
    return emptySupportAggregates(
      'unconfigured',
      'Supabase client is not configured (missing URL or anon key).',
      false
    );
  }

  if (await shouldSkipUnauthenticatedQuery(client, clientOverride)) {
    return emptySupportAggregates(
      'demo_session_rls',
      'Authentication required: Active Supabase Auth session needed for support aggregates.',
      false
    );
  }

  const activeRole = getActiveSessionRole(clientOverride);
  if (activeRole && !canRoleAccessSupportTelemetry(activeRole)) {
    return emptySupportAggregates(
      'restricted',
      `Restricted: Role ${activeRole} is not authorized for institutional support aggregates.`,
      true
    );
  }

  const hasExplicitStart = options?.startDate !== undefined;
  const hasExplicitEnd = options?.endDate !== undefined;
  const defaultBoundedRange = !hasExplicitStart && !hasExplicitEnd ? getDefaultBoundedDateRange('90D') : null;
  const effectiveStartDate = hasExplicitStart ? (options?.startDate || '') : (defaultBoundedRange?.startDate || '');
  const effectiveEndDate = hasExplicitEnd ? (options?.endDate || '') : (defaultBoundedRange?.endDate || '');
  const requestedRangeDays = computeDateRangeDays(effectiveStartDate || undefined, effectiveEndDate || undefined);

  const runAggregate = async (): Promise<SupportAggregates> => {
  const correlationId = createTelemetryCorrelationId();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const callerRole = activeRole || 'AUTHENTICATED';
  let executedRangeDays: number | 'ALL' = requestedRangeDays;
  const elapsedMs = () =>
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;

  // 1. Attempt PostgreSQL server-side RPC aggregate function (bounded by default, ALL when explicitly selected)
  try {
    const rpcTenantId = tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root' ? tenantId : null;
    let { data: rpcData, error: rpcError } = await applyAbortSignal(
      client.rpc('get_support_aggregates', {
        p_tenant_id: rpcTenantId,
        p_start_date: effectiveStartDate || null,
        p_end_date: effectiveEndDate || null,
      }),
      options?.signal
    );

    if (rpcError && isMissingRpcError(rpcError)) {
      executedRangeDays = 'ALL';
      const legacyRes = await applyAbortSignal(
        client.rpc('get_support_aggregates', {
          p_tenant_id: rpcTenantId,
        }),
        options?.signal
      );
      rpcData = legacyRes.data;
      rpcError = legacyRes.error;
    }

    if (!rpcError && rpcData && typeof rpcData === 'object' && 'totalTickets' in rpcData) {
      const hasAuthSession = await checkHasSupabaseAuthSession(client);
      recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'Support Desk Aggregates',
        rpcName: 'get_support_aggregates',
        sqlstate: '00000',
        durationMs: elapsedMs(),
        dateRangeDays: executedRangeDays,
        role: callerRole,
        tenantScope: tenantId,
        outcome: 'SUCCESS',
      });
      const totalTickets = Number(rpcData.totalTickets) || 0;
      return {
        totalTickets,
        openCount: Number(rpcData.openCount) || 0,
        closedCount: Number(rpcData.closedCount) || 0,
        inProgressCount: Number(rpcData.inProgressCount) || 0,
        pendingClientCount: Number(rpcData.pendingClientCount) || 0,
        priorityDistribution: Array.isArray(rpcData.priorityDistribution) ? rpcData.priorityDistribution : [],
        categoryDistribution: Array.isArray(rpcData.categoryDistribution) ? rpcData.categoryDistribution : [],
        executiveWorkload: Array.isArray(rpcData.executiveWorkload) ? rpcData.executiveWorkload : [],
        slaCompliancePct: Number(rpcData.slaCompliancePct ?? 0),
        averageCsat: Number(rpcData.averageCsat ?? 0),
        resolutionTimeDisplay: totalTickets > 0 ? 'Open Duration Only' : 'No Records',
        resolutionTimeNote: SUPPORT_RESOLUTION_NOTE,
        source: 'supabase',
        state: totalTickets > 0 ? 'live_records' : (hasAuthSession ? 'zero_records' : 'demo_session_rls'),
        error: null,
        hasAuthSession,
      };
    }

    if (rpcError && !isMissingRpcError(rpcError)) {
      const hasAuthSession = await checkHasSupabaseAuthSession(client);
      const state = classifyErrorState(rpcError, hasAuthSession);
      const diag = recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'Support Desk Aggregates',
        rpcName: 'get_support_aggregates',
        sqlstate: extractSafeSqlstate(rpcError),
        durationMs: elapsedMs(),
        dateRangeDays: executedRangeDays,
        role: callerRole,
        tenantScope: tenantId,
        outcome: isAbortError(rpcError, options?.signal)
          ? 'ABORTED'
          : state === 'timeout'
          ? 'TIMEOUT'
          : state === 'restricted' || state === 'demo_session_rls'
          ? 'RESTRICTED'
          : 'ERROR',
      });
      return emptySupportAggregates(
        state,
        formatTelemetryDiagnosticError(diag, rpcError.message || 'Support aggregate RPC failed.'),
        hasAuthSession
      );
    }
  } catch (err: any) {
    const hasAuthSession = await checkHasSupabaseAuthSession(client);
    const state = classifyErrorState(err, hasAuthSession);
    const diag = recordTelemetryDiagnostic({
      correlationId,
      widgetName: 'Support Desk Aggregates',
      rpcName: 'get_support_aggregates',
      sqlstate: extractSafeSqlstate(err),
      durationMs: elapsedMs(),
      dateRangeDays: executedRangeDays,
      role: callerRole,
      tenantScope: tenantId,
      outcome: isAbortError(err, options?.signal)
        ? 'ABORTED'
        : state === 'timeout'
        ? 'TIMEOUT'
        : state === 'restricted' || state === 'demo_session_rls'
        ? 'RESTRICTED'
        : 'ERROR',
    });
    return emptySupportAggregates(
      state,
      formatTelemetryDiagnosticError(diag, err?.message || 'Unexpected error invoking get_support_aggregates.'),
      hasAuthSession
    );
  }

  // 2. Resilient chunk query ONLY when RPC is absent
  try {
    const hasAuthSession = await checkHasSupabaseAuthSession(client);
    const CHUNK_SIZE = 1000;
    let offset = 0;
    let allRows: any[] = [];
    let hasMore = true;
    let lastQueryError: any = null;

    while (hasMore) {
      let query = client
        .from('support_tickets')
        .select('ticket_id, status, priority, category, assigned_executive, sla_target_hours, hours_open, csat_rating')
        .range(offset, offset + CHUNK_SIZE - 1);

      if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
        query = query.eq('tenant_id', tenantId);
      }
      if (effectiveStartDate) {
        query = query.gte('opened_at', `${effectiveStartDate}T00:00:00.000Z`);
      }
      if (effectiveEndDate) {
        query = query.lte('opened_at', `${effectiveEndDate}T23:59:59.999Z`);
      }

      const { data, error } = await query;
      if (error) {
        lastQueryError = error;
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRows = allRows.concat(data);
        if (data.length < CHUNK_SIZE) {
          hasMore = false;
        } else {
          offset += CHUNK_SIZE;
        }
      }
    }

    if (lastQueryError) {
      return emptySupportAggregates(
        classifyErrorState(lastQueryError, hasAuthSession),
        lastQueryError.message || 'Database query failed while loading support tickets.',
        hasAuthSession
      );
    }

    if (allRows.length === 0) {
      if (hasAuthSession) {
        return {
          ...emptySupportAggregates('zero_records', null, true, 'No Records'),
          source: 'supabase',
        };
      }

      return emptySupportAggregates(
        'demo_session_rls',
        'Authentication required: Supabase RLS restricts unauthenticated access.',
        false
      );
    }

    let openCount = 0;
    let closedCount = 0;
    let inProgressCount = 0;
    let pendingClientCount = 0;
    let compliantCount = 0;
    let totalCsatSum = 0;
    let csatCount = 0;

    const prioMap: Record<string, number> = {};
    const catMap: Record<string, number> = {};
    const execMap: Record<string, { active: number; resolved: number }> = {};

    for (const row of allRows) {
      const st = (row.status || '').toUpperCase();
      if (st === 'RESOLVED' || st === 'CLOSED') {
        closedCount++;
      } else if (st === 'IN PROGRESS' || st === 'IN_PROGRESS') {
        inProgressCount++;
      } else if (st === 'PENDING CLIENT' || st === 'PENDING_CLIENT') {
        pendingClientCount++;
      } else {
        openCount++;
      }

      const hours = Number(row.hours_open) || 0;
      const target = Number(row.sla_target_hours) || 4;
      if (hours <= target) compliantCount++;

      if (row.csat_rating && Number(row.csat_rating) > 0) {
        totalCsatSum += Number(row.csat_rating);
        csatCount++;
      }

      const prio = row.priority || 'Medium';
      prioMap[prio] = (prioMap[prio] || 0) + 1;

      const cat = row.category || 'General';
      catMap[cat] = (catMap[cat] || 0) + 1;

      const exec = row.assigned_executive || 'Unassigned Desk';
      if (!execMap[exec]) execMap[exec] = { active: 0, resolved: 0 };
      if (st === 'RESOLVED' || st === 'CLOSED') {
        execMap[exec].resolved++;
      } else {
        execMap[exec].active++;
      }
    }

    const total = allRows.length;
    const slaCompliancePct = total > 0 ? Math.round((compliantCount / total) * 1000) / 10 : 0;
    const averageCsat = csatCount > 0 ? Math.round((totalCsatSum / csatCount) * 100) / 100 : 0;

    return {
      totalTickets: total,
      openCount: openCount + inProgressCount + pendingClientCount,
      closedCount,
      inProgressCount,
      pendingClientCount,
      priorityDistribution: Object.entries(prioMap).map(([priority, count]) => ({ priority, count })),
      categoryDistribution: Object.entries(catMap).map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / (total || 1)) * 1000) / 10,
      })),
      executiveWorkload: Object.entries(execMap).map(([executive, d]) => ({
        executive,
        activeTickets: d.active,
        resolvedTickets: d.resolved,
      })),
      slaCompliancePct,
      averageCsat,
      resolutionTimeDisplay: 'Open Duration Only',
      resolutionTimeNote: SUPPORT_RESOLUTION_NOTE,
      source: 'supabase',
      state: 'live_records',
      error: null,
      hasAuthSession,
    };
  } catch (err: any) {
    const hasSession = await checkHasSupabaseAuthSession(client);
    return emptySupportAggregates(
      classifyErrorState(err, hasSession),
      err?.message || 'Unexpected error querying support aggregates.',
      hasSession
    );
  }
  };

  if (options?.signal) {
    return runAggregate();
  }
  const dedupeKey = `support_agg:${getClientScopeKey(client)}:${tenantId}:${effectiveStartDate}:${effectiveEndDate}`;
  return dedupeInFlight(dedupeKey, runAggregate);
}




/**
 * Fetch Support Tickets with Supabase priority, transparent error reporting, and tenant fallback
 */
export async function fetchSupportTicketsResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions,
  clientOverride?: any
): Promise<DatabaseQueryResult<SupportTicket[]>> {
  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  const page = Math.max(1, options?.page || 1);
  const pageSize = options?.pageSize || 50;

  if (!configured || !client) {
    const errorMsg = 'Supabase client not configured (missing URL or anon key)';
    databaseStatusStore.supportTickets = {
      source: 'fallback',
      error: errorMsg,
      state: 'unconfigured',
      details: 'Supabase credentials are not configured in the application environment.',
    };
    return {
      data: [],
      source: 'fallback',
      error: errorMsg,
      count: 0,
      totalCount: 0,
      state: 'unconfigured',
      details: 'Supabase client is not configured; no live support tickets available.',
      hasAuthSession: false,
      page: 1,
      pageSize,
      totalPages: 1,
    };
  }

  if (await shouldSkipUnauthenticatedQuery(client, clientOverride)) {
    const notice = 'Authentication required: Active Supabase Auth session needed to query support_tickets.';
    databaseStatusStore.supportTickets = {
      source: 'fallback',
      error: notice,
      state: 'demo_session_rls',
      details: 'Postgres RLS restricts unauthenticated access to support_tickets.',
    };
    return {
      data: [],
      source: 'fallback',
      error: notice,
      count: 0,
      totalCount: 0,
      state: 'demo_session_rls',
      details: 'Authentication required to view support tickets.',
      hasAuthSession: false,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  const runQuery = async (): Promise<DatabaseQueryResult<SupportTicket[]>> => {
  try {
    const buildQuery = (q: any) => {
      let filtered = q.order('opened_at', { ascending: false });
      if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
        filtered = filtered.eq('tenant_id', tenantId);
      }
      if (options?.userId) {
        filtered = filtered.eq('user_id', options.userId);
      }
      if (options?.search) {
        const s = options.search.trim();
        filtered = filtered.or(`customer_name.ilike.%${s}%,ticket_id.ilike.%${s}%,category.ilike.%${s}%`);
      }
      if (options?.priority && options.priority !== 'ALL') {
        filtered = filtered.eq('priority', options.priority);
      }
      if (options?.status && options.status !== 'ALL') {
        filtered = filtered.eq('status', options.status);
      }
      if (options?.category && options.category !== 'ALL') {
        filtered = filtered.eq('category', options.category);
      }
      if (options?.startDate) {
        filtered = filtered.gte('opened_at', `${options.startDate}T00:00:00.000Z`);
      }
      if (options?.endDate) {
        filtered = filtered.lte('opened_at', `${options.endDate}T23:59:59.999Z`);
      }
      return filtered;
    };

    const { data, error, count } = await executeSafelyWithPagination(
      client,
      'support_tickets',
      buildQuery,
      page,
      pageSize,
      options?.countMode || 'estimated',
      options?.signal
    );

    if (error) {
      const hasSession = await checkHasSupabaseAuthSession(client);
      const errState = classifyErrorState(error, hasSession);
      const errorMsg = `${error.code || 'ERR'}: ${error.message || 'Database query failed'}`;
      databaseStatusStore.supportTickets = {
        source: 'fallback',
        error: errorMsg,
        state: errState,
        details: error.message,
      };
      return {
        data: [],
        source: 'fallback',
        error: errorMsg,
        count: 0,
        totalCount: 0,
        state: errState,
        details: `Supabase query failed: ${error.message}`,
        hasAuthSession: hasSession,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    const hasAuthSession = await checkHasSupabaseAuthSession(client);

    if (data && data.length > 0) {
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

      const totalCount = count ?? mapped.length;
      databaseStatusStore.supportTickets = {
        source: 'supabase',
        error: null,
        state: 'live_records',
        details: `Loaded ${mapped.length} live records from Supabase support_tickets table (Total: ${totalCount}).`,
      };

      return {
        data: mapped,
        source: 'supabase',
        error: null,
        count: mapped.length,
        totalCount,
        state: 'live_records',
        details: `Retrieved ${mapped.length} live rows from Supabase (Total: ${totalCount}).`,
        hasAuthSession,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      };
    }

    const notice = hasAuthSession
      ? null
      : 'Unauthenticated session: Supabase Row-Level Security (RLS) restricts access to confirmed users.';

    if (!hasAuthSession) {
      databaseStatusStore.supportTickets = {
        source: 'fallback',
        error: notice,
        state: 'demo_session_rls',
        details: 'Postgres RLS restricts unauthenticated queries to 0 rows. Sign in with an authenticated Supabase session to access support tickets.',
      };
      return {
        data: [],
        source: 'fallback',
        error: notice,
        count: 0,
        totalCount: 0,
        state: 'demo_session_rls',
        details: 'Postgres RLS restricts unauthenticated queries to 0 rows. Sign in with an authenticated Supabase session to access support tickets.',
        hasAuthSession: false,
        page,
        pageSize,
        totalPages: 1,
      };
    }

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
      totalCount: 0,
      state: 'zero_records',
      details: `Authenticated query returned 0 records from Supabase support_tickets table for tenant ${tenantId}.`,
      hasAuthSession: true,
      page,
      pageSize,
      totalPages: 1,
    };
  } catch (err: any) {
    const hasSession = await checkHasSupabaseAuthSession(client);
    const errState = classifyErrorState(err, hasSession);
    const errorMsg = err?.message || 'Network error querying Supabase';
    databaseStatusStore.supportTickets = {
      source: 'fallback',
      error: errorMsg,
      state: errState,
      details: errorMsg,
    };
    return {
      data: [],
      source: 'fallback',
      error: errorMsg,
      count: 0,
      totalCount: 0,
      state: errState,
      details: `Unexpected error querying Supabase: ${errorMsg}`,
      hasAuthSession: hasSession,
      page,
      pageSize,
      totalPages: 1,
    };
  }
  };

  if (options?.signal) {
    return runQuery();
  }
  const dedupeKey = `support_list:${getClientScopeKey(client)}:${tenantId}:${page}:${pageSize}:${options?.userId || ''}:${options?.search || ''}:${options?.priority || ''}:${options?.status || ''}:${options?.category || ''}:${options?.startDate || ''}:${options?.endDate || ''}:${options?.countMode || 'estimated'}`;
  return dedupeInFlight(dedupeKey, runQuery);
}

export async function fetchSupportTicketsFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions
): Promise<SupportTicket[]> {
  const result = await fetchSupportTicketsResultFromDb(tenantId, options);
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
/**
 * Empty default for KYC records as required: no fake records
 */
const DEMO_KYC_DOCUMENTS: CustomerDocument[] = [];

/**
 * Fetch KYC Records from Supabase public.kyc_records
 * Follows Requirement 8: Keep public.kyc_records empty in UI until genuine records exist.
 */
export async function fetchKycRecordsResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions,
  clientOverride?: any
): Promise<DatabaseQueryResult<CustomerDocument[]>> {
  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  if (!configured || !client) {
    const notice = 'Supabase client is not configured (missing URL or anon key).';
    databaseStatusStore.kycRecords = {
      source: 'fallback',
      error: notice,
      state: 'unconfigured',
      details: 'Supabase credentials are not configured in the application environment.',
    };
    return {
      data: [],
      source: 'fallback',
      error: notice,
      count: 0,
      totalCount: 0,
      state: 'unconfigured',
      details: notice,
      hasAuthSession: false,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    };
  }

  const runQuery = async (): Promise<DatabaseQueryResult<CustomerDocument[]>> => {
  try {
    if (await shouldSkipUnauthenticatedQuery(client, clientOverride)) {
      const notice = 'Authentication required: Active Supabase Auth session needed to query kyc_records.';
      databaseStatusStore.kycRecords = {
        source: 'fallback',
        error: notice,
        state: 'demo_session_rls',
        details: 'Postgres RLS restricts unauthenticated access to kyc_records.',
      };
      return {
        data: [],
        source: 'fallback',
        state: 'demo_session_rls',
        error: notice,
        count: 0,
        totalCount: 0,
        hasAuthSession: false,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      };
    }

    const activeRole = getActiveSessionRole(clientOverride);
    if (activeRole === 'CUSTOMER' && !options?.userId) {
      const notice = 'Restricted: CUSTOMER role cannot run tenant-wide institutional KYC scans.';
      databaseStatusStore.kycRecords = {
        source: 'fallback',
        error: notice,
        state: 'restricted',
        details: notice,
      };
      return {
        data: [],
        source: 'fallback',
        state: 'restricted',
        error: notice,
        count: 0,
        totalCount: 0,
        hasAuthSession: true,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      };
    }

    const hasSession = await checkHasSupabaseAuthSession(client);
    const page = Math.max(1, options?.page || 1);
    const pageSize = options?.pageSize || 50;
    const countMode = options?.countMode || 'estimated';

    let query = client.from('kyc_records').select('*', { count: countMode });
    if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
      query = query.eq('tenant_id', tenantId);
    }
    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }

    if (options?.search) {
      const s = options.search.trim();
      query = query.or(`title.ilike.%${s}%,document_type.ilike.%${s}%,id.ilike.%${s}%`);
    }

    if (options?.status && options.status !== 'ALL') {
      query = query.eq('status', options.status);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await applyAbortSignal(query.range(from, to), options?.signal);

    if (error) {
      const errState = classifyErrorState(error, hasSession);
      const msg = `Database query on kyc_records: ${error.message}`;
      databaseStatusStore.kycRecords = {
        source: 'fallback',
        error: msg,
        state: errState,
        details: msg,
      };
      return {
        data: [],
        source: 'fallback',
        state: errState,
        error: msg,
        count: 0,
        totalCount: 0,
        hasAuthSession: hasSession,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    if (data && data.length > 0) {
      const liveRecords: CustomerDocument[] = data.map((k: any) => ({
        id: k.id,
        title: k.title || 'Identity Document',
        documentType: k.document_type || 'Passport',
        fileSize: k.file_size || '1.2 MB',
        uploadedAt: k.uploaded_at ? k.uploaded_at.split('T')[0] : 'Today',
        verifiedBy: k.verified_by || 'Pending Compliance Review',
        status: (k.status === 'Verified' || k.status === 'Approved'
          ? 'Verified'
          : k.status === 'Under Review'
          ? 'Under Review'
          : k.status === 'Pending'
          ? 'Pending'
          : 'Archived') as any,
        tenantId: k.tenant_id,
        tenantName: k.tenant_name,
      }));

      const totalCount = count ?? liveRecords.length;
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
        totalCount,
        state: 'live_records',
        details: `Successfully loaded ${liveRecords.length} live KYC records from Supabase.`,
        hasAuthSession: hasSession,
        page: options?.page || 1,
        pageSize: options?.pageSize || 50,
        totalPages: Math.max(1, Math.ceil(totalCount / (options?.pageSize || 50))),
      };
    }

    // Zero records: Genuine empty state
    databaseStatusStore.kycRecords = {
      source: 'supabase',
      error: null,
      state: 'zero_records',
      details: `0 records found in Supabase kyc_records table for tenant ${tenantId}.`,
    };
    return {
      data: [],
      source: 'supabase',
      error: null,
      count: 0,
      totalCount: 0,
      state: 'zero_records',
      details: 'No KYC documents on file. Compliance queue is empty.',
      hasAuthSession: hasSession,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Network error querying kyc_records';
    const hasSession = await checkHasSupabaseAuthSession(client);
    const errState = classifyErrorState(err, hasSession);
    databaseStatusStore.kycRecords = {
      source: 'fallback',
      error: errorMsg,
      state: errState,
    };
    return {
      data: [],
      source: 'fallback',
      error: errorMsg,
      count: 0,
      totalCount: 0,
      state: errState,
      hasAuthSession: hasSession,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    };
  }
  };

  if (options?.signal) {
    return runQuery();
  }
  const dedupeKey = `kyc_list:${getClientScopeKey(client)}:${tenantId}:${options?.page || 1}:${options?.pageSize || 50}:${options?.userId || ''}:${options?.search || ''}:${options?.status || ''}:${options?.countMode || 'estimated'}`;
  return dedupeInFlight(dedupeKey, runQuery);
}

export async function fetchKycRecordsFromDb(
  tenantId: string = 'tenant_apex_bank',
  options?: QueryFilterOptions
): Promise<CustomerDocument[]> {
  const res = await fetchKycRecordsResultFromDb(tenantId, options);
  return res.data;
}

/**
 * Upload genuine KYC Record into Supabase public.kyc_records
 */
export async function uploadKycRecordToDb(doc: {
  userId?: string;
  tenantId: string;
  tenantName?: string;
  title: string;
  documentType: string;
  fileSize?: string;
  status?: 'Verified' | 'Under Review' | 'Archived' | 'Pending';
  verifiedBy?: string;
}): Promise<{ success: boolean; data?: CustomerDocument; error?: string }> {
  const newId = `KYC-${Math.floor(10000 + Math.random() * 90000)}`;
  let resolvedUserId = doc.userId || null;
  let resolvedStatus = doc.status || 'Pending';

  if (isSupabaseConfigured()) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!resolvedUserId && userData?.user?.id) {
        resolvedUserId = userData.user.id;
      }
      const sessRole = getActiveSessionRole();
      if (sessRole === 'CUSTOMER' && resolvedStatus === 'Verified') {
        resolvedStatus = 'Pending';
      }
    } catch {
      // ignore fallback resolution error
    }
  }

  const record = {
    id: newId,
    user_id: resolvedUserId,
    tenant_id: doc.tenantId,
    tenant_name: doc.tenantName || getTenantById(doc.tenantId)?.name || 'Apex Global Bank',
    title: doc.title,
    document_type: doc.documentType,
    file_size: doc.fileSize || '1.8 MB',
    status: resolvedStatus,
    verified_by: doc.verifiedBy || null,
  };

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('kyc_records').insert([record]).select().single();
      if (error || !data) {
        return {
          success: false,
          error: error?.message || 'Failed to insert KYC record into Supabase.',
        };
      }
      return {
        success: true,
        data: {
          id: data.id,
          title: data.title,
          documentType: data.document_type,
          fileSize: data.file_size,
          uploadedAt: data.uploaded_at ? data.uploaded_at.split('T')[0] : new Date().toISOString().split('T')[0],
          verifiedBy: data.verified_by || 'Compliance Verification Engine',
          status: data.status,
          tenantId: data.tenant_id,
          tenantName: data.tenant_name,
        },
      };
    } catch (err: any) {
      console.warn('Supabase KYC insert error:', err);
      return {
        success: false,
        error: err?.message || 'Unexpected exception inserting KYC record into Supabase.',
      };
    }
  }

  return {
    success: true,
    data: {
      id: newId,
      title: doc.title,
      documentType: doc.documentType as CustomerDocument['documentType'],
      fileSize: doc.fileSize || '1.8 MB',
      uploadedAt: new Date().toISOString().split('T')[0],
      verifiedBy: doc.verifiedBy || 'Compliance Verification Engine',
      status: (doc.status === 'Pending' ? 'Under Review' : (doc.status || 'Under Review')) as CustomerDocument['status'],
      tenantId: doc.tenantId,
      tenantName: doc.tenantName || 'Apex Global Bank',
    },
  };
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
    console.log(`[DATABASE_DIAGNOSTIC] fetchCurrentUserProfileResultFromDb - Querying profile for: ${userId}`);
    
    const { data, error, status } = await supabase
      .from('profiles')
      .select('id, email, role, tenant_id, name, status, tier, phone, country, two_factor_enabled, tenant_name, notes, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[DATABASE_DIAGNOSTIC] fetchCurrentUserProfileResultFromDb - Query failed:', {
        status,
        code: error.code,
        message: error.message,
        details: error.details
      });
      const msg = `Database error querying profiles: ${error.message} (${error.code || status})`;
      const errState = classifyErrorState(error, true);
      databaseStatusStore.profiles = {
        source: 'fallback',
        error: msg,
        state: errState,
        details: msg,
      };
      return {
        profile: null,
        source: 'fallback',
        state: errState,
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

    const userEmail = (data.email || sbSession.user.email || '').trim().toLowerCase();
    const isAuthorizedSuperAdmin = userEmail === AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase();

    let resolvedRole = (data.role as UserRole) || 'CUSTOMER';
    let resolvedTenantId = tenantId;
    let resolvedTenantName = tenantName;

    // Strict single Super Admin validation
    if (resolvedRole === 'SUPER_ADMIN' && !isAuthorizedSuperAdmin) {
      console.warn(`[SECURITY VIOLATION] Unauthorized SUPER_ADMIN profile queried for ${userEmail}. Demoting to CUSTOMER.`);
      resolvedRole = 'CUSTOMER';
      resolvedTenantId = 'tenant_apex_bank';
      resolvedTenantName = 'Apex Global Bank';
    } else if (isAuthorizedSuperAdmin) {
      resolvedRole = 'SUPER_ADMIN';
      resolvedTenantId = 'platform_root';
      resolvedTenantName = 'Finova AI SaaS Platform Operator';
    }

    const userProfile: UserAccount = {
      id: data.id,
      name: cleanName,
      email: data.email || sbSession.user.email || '',
      role: resolvedRole,
      status: data.status || 'Active',
      tier: isAuthorizedSuperAdmin ? 'Executive Staff' : (data.tier || 'Private Wealth Tier 3'),
      createdDate: data.created_at ? data.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      lastActive: 'Just now',
      phone: data.phone || sbSession.user.user_metadata?.phone || '+1 (212) 555-0100',
      country: data.country || 'United States',
      twoFactorEnabled: data.two_factor_enabled ?? true,
      tenantId: resolvedTenantId,
      tenantName: resolvedTenantName,
      notes: data.notes || (isAuthorizedSuperAdmin ? 'Authorized Platform Super Admin' : 'Loaded directly from live Supabase PostgreSQL profiles table'),
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
    const errState = classifyErrorState(err, false);
    databaseStatusStore.profiles = {
      source: 'fallback',
      error: errorMsg,
      state: errState,
      details: errorMsg,
    };
    return {
      profile: null,
      source: 'fallback',
      state: errState,
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
            lastActive: 'Not Tracked',
            phone: p.phone || '',
            country: p.country || '',
            twoFactorEnabled: p.two_factor_enabled ?? false,
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
  rolesOnly?: UserRole[],
  options?: QueryFilterOptions
): Promise<DatabaseQueryResult<UserAccount[]>> {
  if (!isSupabaseConfigured()) {
    return {
      data: [],
      source: 'fallback',
      error: 'Supabase client not configured',
      count: 0,
      totalCount: 0,
      state: 'unconfigured',
      hasAuthSession: false,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    };
  }

  if (await shouldSkipUnauthenticatedQuery(supabase)) {
    const notice = 'Authentication required: Active Supabase Auth session needed to query profiles.';
    databaseStatusStore.profiles = {
      source: 'fallback',
      error: notice,
      state: 'demo_session_rls',
      details: notice,
    };
    return {
      data: [],
      source: 'fallback',
      error: notice,
      count: 0,
      totalCount: 0,
      state: 'demo_session_rls',
      hasAuthSession: false,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    };
  }

  const runQuery = async (): Promise<DatabaseQueryResult<UserAccount[]>> => {
  try {
    const countMode = options?.countMode || 'estimated';
    let query = supabase.from('profiles').select('*', { count: countMode });
    if (tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root') {
      query = query.eq('tenant_id', tenantId);
    }
    if (rolesOnly && rolesOnly.length > 0) {
      query = query.in('role', rolesOnly);
    }

    if (options?.search) {
      const s = options.search.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
      if (isUuid) {
        query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,id.eq.${s}`);
      } else {
        query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%`);
      }
    }

    query = query.order('created_at', { ascending: false });

    if (options?.page && options?.pageSize) {
      const page = Math.max(1, options.page);
      const pageSize = options.pageSize;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const hasSession = await checkHasSupabaseAuthSession(supabase);
    const { data, error, count } = await applyAbortSignal(query, options?.signal);

    if (error) {
      if (error.code === 'PGRST103' || error.message?.includes('range not satisfiable')) {
        return {
          data: [],
          source: 'supabase',
          error: null,
          count: 0,
          totalCount: 0,
          state: 'zero_records',
          details: 'Pagination range adjusted to available records.',
          hasAuthSession: hasSession,
          page: options?.page || 1,
          pageSize: options?.pageSize || 50,
          totalPages: 1,
        };
      }
      const errState = classifyErrorState(error, hasSession);
      databaseStatusStore.profiles = {
        source: 'fallback',
        error: error.message,
        state: errState,
        details: error.message,
      };
      return {
        data: [],
        source: 'fallback',
        error: error.message,
        count: 0,
        totalCount: 0,
        state: errState,
        hasAuthSession: hasSession,
        page: options?.page || 1,
        pageSize: options?.pageSize || 50,
        totalPages: 1,
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
          lastActive: 'Not Tracked',
          phone: p.phone || '',
          country: p.country || '',
          twoFactorEnabled: p.two_factor_enabled ?? false,
          tenantId: pTenantId,
          tenantName: pTenantName,
          notes: p.notes,
          authSource: 'supabase' as const,
        };
      });

      const totalCount = count ?? mapped.length;
      databaseStatusStore.profiles = {
        source: 'supabase',
        error: null,
        state: 'live_records',
        details: `Loaded ${mapped.length} live profiles from Supabase profiles table (Total: ${totalCount}).`,
      };

      return {
        data: mapped,
        source: 'supabase',
        error: null,
        count: mapped.length,
        totalCount,
        state: 'live_records',
        details: `Loaded ${mapped.length} live profiles from Supabase profiles table.`,
        hasAuthSession: hasSession,
        page: options?.page || 1,
        pageSize: options?.pageSize || mapped.length,
        totalPages: Math.max(1, Math.ceil(totalCount / (options?.pageSize || mapped.length || 1))),
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
      totalCount: 0,
      state: hasSession ? 'zero_records' : 'demo_session_rls',
      details: hasSession ? '0 profiles found in database' : 'RLS requires authenticated session',
      hasAuthSession: hasSession,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    };
  } catch (err: any) {
    const hasSession = await checkHasSupabaseAuthSession(supabase);
    const errState = classifyErrorState(err, hasSession);
    const errorMsg = err?.message || 'Error querying profiles';
    databaseStatusStore.profiles = {
      source: 'fallback',
      error: errorMsg,
      state: errState,
      details: errorMsg,
    };
    return {
      data: [],
      source: 'fallback',
      error: errorMsg,
      count: 0,
      totalCount: 0,
      state: errState,
      hasAuthSession: hasSession,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    };
  }
  };

  if (options?.signal) {
    return runQuery();
  }
  const dedupeKey = `profiles_list:${tenantId || 'ALL'}:${(rolesOnly || []).join(',')}:${options?.page || ''}:${options?.pageSize || ''}:${options?.search || ''}:${options?.countMode || 'estimated'}`;
  return dedupeInFlight(dedupeKey, runQuery);
}

/**
 * Persist or update user profile in Supabase public.profiles table
 * Uses a safe update-first strategy to comply with restrictive RLS policies
 */
export async function saveProfileToDb(
  userData: Partial<UserAccount>
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured() || !userData.id) {
    return { success: true, error: null };
  }

  console.log(`[DATABASE_DIAGNOSTIC] saveProfileToDb start for user: ${userData.id}`);

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

    // Remove undefined values to prevent database errors or unintended overwrites
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    // 1. Check if record exists to determine strategy
    // Only proceed if we have an active session to avoid 'anon' permission errors
    const hasSession = await checkHasSupabaseAuthSession(supabase);
    if (!hasSession) {
      console.warn('[DATABASE_DIAGNOSTIC] Skipping profile save: No active Supabase session.');
      return { success: false, error: 'Unauthorized: No active session' };
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, name, role, status, tier, phone, country, tenant_id, tenant_name, notes')
      .eq('id', userData.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[DATABASE_DIAGNOSTIC] Error checking profile existence:', fetchErr);
      return { success: false, error: fetchErr.message };
    }

    let dbError: any = null;

    const executeUpdate = async () => {
      console.log('[DATABASE_DIAGNOSTIC] Executing UPDATE.', payload);
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userData.id);
      return error;
    };

    if (existing) {
      // Only update if there are actual changes
      const hasChanges = Object.keys(payload).some(key => {
        if (key === 'updated_at') return false;
        return payload[key] !== (existing as any)[key];
      });

      if (!hasChanges) {
        console.log('[DATABASE_DIAGNOSTIC] No changes detected. Skipping update.');
        return { success: true, error: null };
      }
      dbError = await executeUpdate();
    } else {
      console.log('[DATABASE_DIAGNOSTIC] Profile missing from select. Attempting INSERT.');
      const insertPayload = { id: userData.id, email: userData.email, ...payload };
      Object.keys(insertPayload).forEach(key => (insertPayload as any)[key] === undefined && delete (insertPayload as any)[key]);
      
      const { error: insertErr } = await supabase
        .from('profiles')
        .insert(insertPayload);
      
      dbError = insertErr;

      // Handle race condition: If insert fails because it already exists (409), fall back to update
      if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('duplicate key'))) {
        console.log('[DATABASE_DIAGNOSTIC] Insert conflicted. Falling back to UPDATE.');
        dbError = await executeUpdate();
      }
    }

    if (dbError) {
      console.error('[DATABASE_DIAGNOSTIC] Supabase operation failed:', {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details
      });
      return { success: false, error: dbError.message };
    }

    console.log('[DATABASE_DIAGNOSTIC] Profile operation successful.');
    
    // Sync to local stored users cache strictly AFTER backend confirmation
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
      });
    }
    saveStoredUsers(updatedUsers);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('finova:profile_updated', { detail: userData }));
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('[DATABASE_DIAGNOSTIC] Unexpected exception in saveProfileToDb:', err);
    return { success: false, error: err?.message || 'Update failed' };
  }
}

/**
 * Dedicated Change Role Operation
 * Updates ONLY the role of an existing user in public.profiles.
 * Keeps personal information, email, phone, tenant assignment, tier, and status read-only.
 * Enforces role-assignment governance and backend verification before updating state.
 */
export async function updateUserRoleInDb(
  userId: string,
  newRole: UserRole,
  expectedTenantId?: string
): Promise<{ success: boolean; error: string | null; updatedProfile?: UserAccount }> {
  if (!userId) {
    return { success: false, error: 'User ID is required for role modification.' };
  }

  // Governance Check 1: Nobody other than aravindvicky629@gmail.com may ever hold SUPER_ADMIN
  if (newRole === 'SUPER_ADMIN') {
    let targetEmail: string | undefined;

    // First check local / stored users
    const localUser = getStoredUsers().find((u) => u.id === userId);
    if (localUser?.email) {
      targetEmail = localUser.email.trim().toLowerCase();
    } else if (isSupabaseConfigured() && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      try {
        const { data: targetCheck } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .maybeSingle();
        targetEmail = targetCheck?.email?.trim().toLowerCase();
      } catch {
        // fall through
      }
    }

    if (targetEmail && targetEmail !== AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase()) {
      return {
        success: false,
        error: `Finova AI Governance Violation: Exclusively ${AUTHORIZED_SUPER_ADMIN_EMAIL} may hold the Platform Super Admin role.`,
      };
    }

    if (!targetEmail) {
      return {
        success: false,
        error: `Finova AI Governance Violation: Exclusively ${AUTHORIZED_SUPER_ADMIN_EMAIL} may hold the Platform Super Admin role.`,
      };
    }
  }

  if (isSupabaseConfigured()) {
    try {
      // Execute targeted update strictly on role
      const { data, error } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id, email, name, role, status, tier, phone, country, two_factor_enabled, tenant_id, tenant_name, notes, created_at, updated_at')
        .maybeSingle();

      if (error) {
        console.warn('Backend rejected role update:', error.message);
        return { success: false, error: `Backend Rejected Role Update: ${error.message}` };
      }

      if (!data) {
        return {
          success: false,
          error: 'Role update returned 0 rows. You may lack permission to modify this user account or tenant workspace under PostgreSQL RLS.',
        };
      }

      // Live profile verified from database
      const mappedUser: UserAccount = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as UserRole,
        status: data.status || 'Active',
        tier: data.tier || 'Private Wealth Tier 3',
        createdDate: data.created_at ? data.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        lastActive: 'Just now',
        phone: data.phone || '',
        country: data.country || 'United States',
        twoFactorEnabled: data.two_factor_enabled ?? true,
        tenantId: data.tenant_id,
        tenantName: data.tenant_name || getTenantById(data.tenant_id)?.name || 'Apex Global Bank',
        notes: data.notes,
        authSource: 'supabase',
      };

      // Sync verified profile to stored users
      const currentStored = getStoredUsers();
      const updatedList = currentStored.map((u: StoredUser) =>
        u.id === userId || (mappedUser.email && u.email.toLowerCase() === mappedUser.email.toLowerCase())
          ? ({ ...u, ...mappedUser } as StoredUser)
          : u
      );
      saveStoredUsers(updatedList);

      // Check if the modified user is the currently authenticated session
      const activeSession = getStoredSession();
      if (
        activeSession &&
        (activeSession.user.id === userId ||
          activeSession.user.email.toLowerCase() === mappedUser.email.toLowerCase())
      ) {
        activeSession.user = mappedUser;
        saveSession(activeSession);
      }

      // Dispatch verified profile updated event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finova:profile_updated', { detail: mappedUser }));
      }

      // Record audit event safely
      recordAuditEventInDb({
        action: 'UPDATE_ROLE',
        target: `User ${mappedUser.email} (${userId}) -> ${newRole}`,
        status: 'Authorized',
        tenantId: mappedUser.tenantId,
      }).catch((auditErr) => console.warn('Audit record note:', auditErr));

      return { success: true, error: null, updatedProfile: mappedUser };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unexpected exception during role update' };
    }
  }

  // Fallback for offline demo simulation ONLY when Supabase credentials are not in environment
  const currentStored = getStoredUsers();
  const target = currentStored.find((u) => u.id === userId);
  if (!target) {
    return { success: false, error: 'User not found in local demo store.' };
  }
  const updatedUser: UserAccount = { ...target, role: newRole };
  const updatedList = currentStored.map((u) => (u.id === userId ? { ...u, role: newRole } : u));
  saveStoredUsers(updatedList);

  const activeSession = getStoredSession();
  if (activeSession && activeSession.user.id === userId) {
    activeSession.user = updatedUser;
    saveSession(activeSession);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('finova:profile_updated', { detail: updatedUser }));
  }

  return { success: true, error: null, updatedProfile: updatedUser };
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

  return dedupeInFlight('tenant_workspaces:all', async () => {
    try {
      const { data, error } = await supabase.from('tenant_workspaces').select('*');
      const hasSession = await checkHasSupabaseAuthSession(supabase);

      if (error) {
        const errState = classifyErrorState(error, hasSession);
        databaseStatusStore.tenantWorkspaces = {
          source: 'fallback',
          error: error.message,
          state: errState,
        };
        return {
          data: [],
          source: 'fallback',
          error: error.message,
          count: 0,
          state: errState,
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

    return {
      data: [],
      source: 'supabase',
      error: null,
      count: 0,
      state: 'zero_records',
      hasAuthSession: hasSession,
    };
  } catch (err: any) {
    const hasSession = await checkHasSupabaseAuthSession(supabase);
    return {
      data: [],
      source: 'fallback',
      error: err?.message || 'Error querying tenant workspaces',
      count: 0,
      state: classifyErrorState(err, hasSession),
      hasAuthSession: hasSession,
    };
  }
  });
}

export interface PublicTenantDirectoryEntry {
  id: string;
  name: string;
  shortName: string;
}

/**
 * Safe public signup tenant directory via get_public_tenant_directory() RPC.
 * Exposes ONLY (id, name, short_name) for active non-platform-root institutions.
 */
export async function fetchPublicTenantDirectoryFromDb(): Promise<{
  data: PublicTenantDirectoryEntry[];
  source: 'supabase' | 'fallback' | 'error';
  error: string | null;
}> {
  if (!isSupabaseConfigured()) {
    const localTenants = getStoredTenants()
      .filter((t) => t.status === 'Active' && t.id !== 'platform_root')
      .map((t) => ({
        id: t.id,
        name: t.name,
        shortName: t.shortName || t.name,
      }));
    return { data: localTenants, source: 'fallback', error: null };
  }

  try {
    const { data, error } = await supabase.rpc('get_public_tenant_directory');
    if (error) {
      return { data: [], source: 'error', error: error.message || 'Unable to load financial institutions directory.' };
    }

    const mapped: PublicTenantDirectoryEntry[] = (Array.isArray(data) ? data : []).map((row: any) => ({
      id: String(row.id),
      name: String(row.name),
      shortName: String(row.short_name || row.name),
    }));

    return { data: mapped, source: 'supabase', error: null };
  } catch (err: any) {
    return {
      data: [],
      source: 'error',
      error: err?.message || 'Network error loading financial institutions directory.',
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
  const existingLocal = tenantData.id ? getTenantById(tenantData.id) : undefined;
  const candidateTenant: TenantWorkspace = existingLocal
    ? { ...existingLocal, ...tenantData }
    : {
        id: tenantData.id || `tenant_${Date.now()}`,
        name: tenantData.name || 'New Financial Institution',
        shortName: tenantData.shortName || (tenantData.name ? tenantData.name.slice(0, 12) : 'Finova'),
        type: tenantData.type || 'Commercial Bank',
        status: tenantData.status || 'Active',
        plan: tenantData.plan || 'Growth SaaS',
        mrr: tenantData.mrr ?? 25000,
        currency: tenantData.currency || 'USD',
        currencySymbol: tenantData.currencySymbol || '$',
        headquarters: tenantData.headquarters || 'New York, USA',
        licenseNo: tenantData.licenseNo || `FINOVA-REG-${Math.floor(10000 + Math.random() * 90000)}`,
        primaryContact: tenantData.primaryContact || {
          name: tenantData.adminName || 'Workspace Admin',
          email: tenantData.adminEmail || 'admin@institution.com',
          phone: '+1 (555) 019-4820',
        },
        adminUserId: tenantData.adminUserId || `USR-${Math.floor(5000 + Math.random() * 4000)}`,
        adminName: tenantData.adminName || 'Workspace Admin',
        adminEmail: tenantData.adminEmail || 'admin@institution.com',
        createdDate: tenantData.createdDate || new Date().toISOString().split('T')[0],
        usersCount: tenantData.usersCount ?? 0,
        transactionVolumeYTD: tenantData.transactionVolumeYTD ?? 0,
        complianceScore: tenantData.complianceScore ?? 98.5,
        activeEngines: tenantData.activeEngines || {
          aiAssistant: true,
          documentOcr: true,
          transactionClassification: true,
          kycVerification: true,
          fraudAml: true,
          caseManagement: true,
          excelVisualization: true,
        },
        notes: tenantData.notes,
      };

  // Persist to Supabase FIRST before mutating local cache when Supabase is configured
  if (isSupabaseConfigured()) {
    try {
      const payload: Record<string, unknown> = {
        id: candidateTenant.id,
        name: candidateTenant.name,
        short_name: candidateTenant.shortName,
        type: candidateTenant.type,
        status: candidateTenant.status,
        plan: candidateTenant.plan,
        mrr: candidateTenant.mrr,
        currency: candidateTenant.currency,
        currency_symbol: candidateTenant.currencySymbol,
        headquarters: candidateTenant.headquarters,
        license_no: candidateTenant.licenseNo,
        admin_name: candidateTenant.adminName,
        admin_email: candidateTenant.adminEmail,
        users_count: candidateTenant.usersCount,
        transaction_volume_ytd: candidateTenant.transactionVolumeYTD,
        compliance_score: candidateTenant.complianceScore,
        notes: candidateTenant.notes,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('tenant_workspaces')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase upsert tenant_workspaces error:', error.message);
        return { success: false, data: null, error: error.message };
      }
    } catch (err: any) {
      console.warn('Supabase tenant_workspaces exception:', err);
      return { success: false, data: null, error: err?.message || 'Tenant workspace save failed' };
    }
  }

  const syncedTenant = existingLocal
    ? updateTenant(candidateTenant.id, candidateTenant) || candidateTenant
    : createTenant(candidateTenant);

  return { success: true, data: syncedTenant, error: null };
}

/**
 * Update company workspace status (Active / Suspended / Pending Review) in Supabase
 */
export async function updateTenantWorkspaceStatusInDb(
  tenantId: string,
  status: 'Active' | 'Suspended' | 'Pending Review' | 'Provisioning'
): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('tenant_workspaces')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', tenantId);

      if (error) {
        console.warn('Supabase update tenant_workspaces status error:', error.message);
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Workspace status update failed' };
    }
  }

  updateTenant(tenantId, { status });
  return { success: true, error: null };
}

// -----------------------------------------------------------------------------
// AI CONFIGURATION & AUDIT LOGS DATABASE INTEGRATION
// -----------------------------------------------------------------------------

export interface AiConfiguration {
  model: string;
  temperature: number;
  latencySla: number;
  guardrailActive: boolean;
  hallucinationFilter: boolean;
  sentinelConfidenceThreshold: number; // AML Anomaly Confidence Threshold (70-99%)
  autoFreezeThreshold: number;          // Autonomous Escrow Freeze Risk Threshold (60-95)
  maxDailyWireVelocity: number;         // e.g. 5,000,000 USD
  dualKeySignoffEnabled: boolean;       // Dual-Key Approval for Wires > $5M
  realTimeAuditLogging: boolean;        // Real-time Cryptographic Audit Trail
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export const DEFAULT_AI_CONFIGURATION: AiConfiguration = {
  model: 'Finova-Sentinel-Ultra-4.2',
  temperature: 0.2,
  latencySla: 250,
  guardrailActive: true,
  hallucinationFilter: true,
  sentinelConfidenceThreshold: 92,
  autoFreezeThreshold: 85,
  maxDailyWireVelocity: 5000000,
  dualKeySignoffEnabled: true,
  realTimeAuditLogging: true,
  updatedAt: null,
  updatedBy: null,
};

const LOCAL_AI_CONFIG_KEY = 'finova_ai_engine_config_v1';
const LOCAL_AUDIT_LOGS_KEY = 'finova_audit_logs_cache_v1';

export interface AiConfigQueryResult {
  config: AiConfiguration;
  isDbConnected: boolean;
  isPersistent: boolean;
  error?: string | null;
  source: 'database' | 'local_fallback';
}

/**
 * Loads the active enterprise AI engine configuration exclusively from public.ai_configurations.
 * Never reads from tenant_workspaces.notes and reports DB errors honestly.
 */
export async function fetchAiConfigurationResultFromDb(): Promise<AiConfigQueryResult> {
  let cachedConfig: AiConfiguration = { ...DEFAULT_AI_CONFIGURATION };
  try {
    const rawLocal = localStorage.getItem(LOCAL_AI_CONFIG_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      cachedConfig = { ...DEFAULT_AI_CONFIGURATION, ...parsed };
    }
  } catch {
    // Ignore cache read error
  }

  if (!isSupabaseConfigured()) {
    return {
      config: cachedConfig,
      isDbConnected: false,
      isPersistent: false,
      error: 'Supabase is not configured; live database persistence for AI configuration is unavailable.',
      source: 'local_fallback',
    };
  }

  try {
    const { data: dedicatedData, error: dedicatedErr } = await supabase
      .from('ai_configurations')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dedicatedErr) {
      return {
        config: cachedConfig,
        isDbConnected: false,
        isPersistent: false,
        error: `Failed to load public.ai_configurations: ${dedicatedErr.message}`,
        source: 'local_fallback',
      };
    }

    if (!dedicatedData) {
      return {
        config: { ...DEFAULT_AI_CONFIGURATION },
        isDbConnected: true,
        isPersistent: false,
        error: 'No active configuration row found in public.ai_configurations; showing defaults until deployed.',
        source: 'local_fallback',
      };
    }

    const dbConfig: AiConfiguration = {
      model: dedicatedData.model || DEFAULT_AI_CONFIGURATION.model,
      temperature: Number(dedicatedData.temperature ?? DEFAULT_AI_CONFIGURATION.temperature),
      latencySla: Number(dedicatedData.latency_sla ?? DEFAULT_AI_CONFIGURATION.latencySla),
      guardrailActive: Boolean(dedicatedData.guardrail_active ?? DEFAULT_AI_CONFIGURATION.guardrailActive),
      hallucinationFilter: Boolean(dedicatedData.hallucination_filter ?? DEFAULT_AI_CONFIGURATION.hallucinationFilter),
      sentinelConfidenceThreshold: Number(dedicatedData.sentinel_confidence_threshold ?? DEFAULT_AI_CONFIGURATION.sentinelConfidenceThreshold),
      autoFreezeThreshold: Number(dedicatedData.auto_freeze_threshold ?? DEFAULT_AI_CONFIGURATION.autoFreezeThreshold),
      maxDailyWireVelocity: Number(dedicatedData.max_daily_wire_velocity ?? DEFAULT_AI_CONFIGURATION.maxDailyWireVelocity),
      dualKeySignoffEnabled: Boolean(dedicatedData.dual_key_signoff_enabled ?? DEFAULT_AI_CONFIGURATION.dualKeySignoffEnabled),
      realTimeAuditLogging: Boolean(dedicatedData.real_time_audit_logging ?? DEFAULT_AI_CONFIGURATION.realTimeAuditLogging),
      updatedAt: dedicatedData.updated_at || null,
      updatedBy: dedicatedData.updated_by || null,
    };

    try {
      localStorage.setItem(LOCAL_AI_CONFIG_KEY, JSON.stringify(dbConfig));
    } catch {
      // Ignore storage error
    }

    return {
      config: dbConfig,
      isDbConnected: true,
      isPersistent: true,
      error: null,
      source: 'database',
    };
  } catch (err: any) {
    return {
      config: cachedConfig,
      isDbConnected: false,
      isPersistent: false,
      error: err?.message || 'Failed to query public.ai_configurations.',
      source: 'local_fallback',
    };
  }
}

/**
 * Persists updated enterprise AI engine configuration exclusively to public.ai_configurations.
 * Strictly verifies SUPER_ADMIN caller identity and never mutates localStorage or logs audit events on failure.
 */
export async function saveAiConfigurationToDb(
  newConfig: Partial<AiConfiguration>,
  caller?: { role?: string; name?: string; email?: string } | null
): Promise<{ success: boolean; config: AiConfiguration; error: string | null; auditLogged: boolean }> {
  const callerEmail = (caller?.email || '').trim().toLowerCase();
  if (!caller || caller.role !== 'SUPER_ADMIN' || callerEmail !== AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase()) {
    return {
      success: false,
      config: { ...DEFAULT_AI_CONFIGURATION, ...newConfig },
      error: `Access Denied: Only the authorized Platform Super Admin (${AUTHORIZED_SUPER_ADMIN_EMAIL}) can modify Platform AI Engine parameters.`,
      auditLogged: false,
    };
  }

  let existingConfig = { ...DEFAULT_AI_CONFIGURATION };
  try {
    const rawLocal = localStorage.getItem(LOCAL_AI_CONFIG_KEY);
    if (rawLocal) {
      existingConfig = { ...existingConfig, ...JSON.parse(rawLocal) };
    }
  } catch {
    // Ignore cache parse error
  }

  const clampNum = (val: unknown, fallback: number, min: number, max: number) => {
    const n = Number(val);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  const payload: AiConfiguration = {
    ...existingConfig,
    ...newConfig,
    temperature: clampNum(newConfig.temperature ?? existingConfig.temperature, DEFAULT_AI_CONFIGURATION.temperature, 0, 1),
    latencySla: Math.round(clampNum(newConfig.latencySla ?? existingConfig.latencySla, DEFAULT_AI_CONFIGURATION.latencySla, 50, 10000)),
    sentinelConfidenceThreshold: Math.round(clampNum(newConfig.sentinelConfidenceThreshold ?? existingConfig.sentinelConfidenceThreshold, DEFAULT_AI_CONFIGURATION.sentinelConfidenceThreshold, 50, 99)),
    autoFreezeThreshold: Math.round(clampNum(newConfig.autoFreezeThreshold ?? existingConfig.autoFreezeThreshold, DEFAULT_AI_CONFIGURATION.autoFreezeThreshold, 50, 99)),
    maxDailyWireVelocity: Math.round(clampNum(newConfig.maxDailyWireVelocity ?? existingConfig.maxDailyWireVelocity, DEFAULT_AI_CONFIGURATION.maxDailyWireVelocity, 100000, 1000000000)),
    updatedAt: new Date().toISOString(),
    updatedBy: caller.name || caller.email || AUTHORIZED_SUPER_ADMIN_EMAIL,
  };

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      config: payload,
      error: 'Supabase is not configured. Platform AI configuration changes require a live database connection.',
      auditLogged: false,
    };
  }

  try {
    const { data, error } = await supabase
      .from('ai_configurations')
      .upsert(
        {
          id: 'default',
          tenant_id: 'platform_root',
          model: payload.model,
          temperature: payload.temperature,
          latency_sla: payload.latencySla,
          guardrail_active: payload.guardrailActive,
          hallucination_filter: payload.hallucinationFilter,
          sentinel_confidence_threshold: payload.sentinelConfidenceThreshold,
          auto_freeze_threshold: payload.autoFreezeThreshold,
          max_daily_wire_velocity: payload.maxDailyWireVelocity,
          dual_key_signoff_enabled: payload.dualKeySignoffEnabled,
          real_time_audit_logging: payload.realTimeAuditLogging,
          is_active: true,
          updated_at: payload.updatedAt,
          updated_by: payload.updatedBy,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      return {
        success: false,
        config: payload,
        error: `Supabase write rejected on public.ai_configurations: ${error.message}`,
        auditLogged: false,
      };
    }

    const persistedConfig: AiConfiguration = data
      ? {
          model: data.model || payload.model,
          temperature: Number(data.temperature ?? payload.temperature),
          latencySla: Number(data.latency_sla ?? payload.latencySla),
          guardrailActive: Boolean(data.guardrail_active ?? payload.guardrailActive),
          hallucinationFilter: Boolean(data.hallucination_filter ?? payload.hallucinationFilter),
          sentinelConfidenceThreshold: Number(data.sentinel_confidence_threshold ?? payload.sentinelConfidenceThreshold),
          autoFreezeThreshold: Number(data.auto_freeze_threshold ?? payload.autoFreezeThreshold),
          maxDailyWireVelocity: Number(data.max_daily_wire_velocity ?? payload.maxDailyWireVelocity),
          dualKeySignoffEnabled: Boolean(data.dual_key_signoff_enabled ?? payload.dualKeySignoffEnabled),
          realTimeAuditLogging: Boolean(data.real_time_audit_logging ?? payload.realTimeAuditLogging),
          updatedAt: data.updated_at || payload.updatedAt,
          updatedBy: data.updated_by || payload.updatedBy,
        }
      : payload;

    try {
      localStorage.setItem(LOCAL_AI_CONFIG_KEY, JSON.stringify(persistedConfig));
    } catch {
      // Ignore storage error
    }

    let auditLogged = false;
    const auditRes = await recordAuditEventInDb({
      action: 'AI Engine & Risk Parameters Updated',
      target: `Model: ${persistedConfig.model} (AML: ${persistedConfig.sentinelConfidenceThreshold}%, Freeze: ${persistedConfig.autoFreezeThreshold}/100, DualKey: ${persistedConfig.dualKeySignoffEnabled})`,
      actor: caller.name || AUTHORIZED_SUPER_ADMIN_EMAIL,
      role: 'SUPER_ADMIN',
      tenantId: 'platform_root',
      status: 'Authorized',
    });
    auditLogged = auditRes.success;

    return {
      success: true,
      config: persistedConfig,
      error: null,
      auditLogged,
    };
  } catch (err: any) {
    return {
      success: false,
      config: payload,
      error: err?.message || 'Unexpected database error writing public.ai_configurations.',
      auditLogged: false,
    };
  }
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  ipAddress: string;
  timestamp: string;
  sha256Hash: string;
  severity: 'Nominal' | 'Elevated' | 'Critical';
  status?: string;
  tenantId?: string | null;
}

/**
 * Deterministic hash generator for audit record visual display.
 * Cryptographic immutability is enforced server-side by PostgreSQL RLS and trigger constraints.
 */
function generateAuditHash(seed: string): string {
  // FNV-1a 64-bit variant hash algorithm
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    const code = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ (code + i), 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const fullHex = `${hex1}${hex2}`;
  return `${fullHex.slice(0, 4)}...${fullHex.slice(-4)}`;
}

/**
 * Verified baseline audit events for display when database table is freshly initialized
 */
export const SEEDED_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'AUD-9901',
    actor: 'Alexander Vance',
    role: 'SUPER_ADMIN',
    action: 'Root Governance Policy Update',
    target: 'RBAC Kernel Module',
    ipAddress: '194.209.12.18 (Zurich)',
    timestamp: 'Today, 09:24:18 UTC',
    sha256Hash: '4a1f...9b20',
    severity: 'Nominal',
    tenantId: 'platform_root',
    status: 'Authorized',
  },
  {
    id: 'AUD-9902',
    actor: 'Julian Thorne',
    role: 'FINANCE_ANALYST',
    action: 'Escrow Freeze Initiated',
    target: 'Account #FNV-CUST-9104 ($1.24M)',
    ipAddress: '185.122.10.45 (London)',
    timestamp: 'Today, 09:12:05 UTC',
    sha256Hash: '8b72...31c4',
    severity: 'Critical',
    tenantId: 'tenant_apex_bank',
    status: 'Flagged',
  },
  {
    id: 'AUD-9903',
    actor: 'Sarah Jenkins',
    role: 'ADMIN',
    action: 'Batch Settlement Executed',
    target: 'SWIFT GPI Outgoing Queue #48',
    ipAddress: '194.209.12.22 (Zurich)',
    timestamp: 'Today, 08:45:10 UTC',
    sha256Hash: '19f2...88aa',
    severity: 'Nominal',
    tenantId: 'tenant_apex_bank',
    status: 'Authorized',
  },
  {
    id: 'AUD-9904',
    actor: 'Claire Montgomery',
    role: 'SUPPORT_EXECUTIVE',
    action: 'Case Escalated to Lead Risk',
    target: 'CASE-2026-104 (Wire Callback)',
    ipAddress: '185.122.10.89 (London)',
    timestamp: 'Today, 08:20:44 UTC',
    sha256Hash: 'f4e1...29d1',
    severity: 'Elevated',
    tenantId: 'tenant_apex_bank',
    status: 'Flagged',
  },
  {
    id: 'AUD-9905',
    actor: 'Harrison Croft',
    role: 'CUSTOMER',
    action: 'Biometric 2FA Login Approved',
    target: 'Sovereign Portal Enclave',
    ipAddress: '84.115.190.12 (Geneva)',
    timestamp: 'Today, 08:14:02 UTC',
    sha256Hash: 'aa77...112e',
    severity: 'Nominal',
    tenantId: 'tenant_apex_bank',
    status: 'Authorized',
  },
];

/**
 * Fetches audit logs from public.audit_logs in Supabase PostgreSQL
 */
export async function fetchAuditLogsResultFromDb(
  tenantId?: string
): Promise<{ logs: AuditLogEntry[]; count: number; error: string | null; isDbConnected: boolean }> {
  // Check local cache
  let localLogs: AuditLogEntry[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localLogs = parsed;
      }
    }
  } catch {
    // Ignore local storage error
  }

  if (!isSupabaseConfigured()) {
    return {
      logs: localLogs,
      count: localLogs.length,
      error: 'Supabase unconfigured; displaying localized logs.',
      isDbConnected: false,
    };
  }

  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (tenantId && tenantId !== 'platform_root') {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Supabase audit_logs query error:', error.message);
      return {
        logs: localLogs,
        count: localLogs.length,
        error: `Supabase audit query notice: ${error.message} (Code: ${error.code})`,
        isDbConnected: false,
      };
    }

    if (!data || data.length === 0) {
      // Database table exists but is currently empty
      return {
        logs: [],
        count: 0,
        error: null,
        isDbConnected: true,
      };
    }

    const mappedLogs: AuditLogEntry[] = data.map((row: any) => {
      let severity: 'Nominal' | 'Elevated' | 'Critical' = 'Nominal';
      if (row.status === 'Flagged') severity = 'Elevated';
      if (row.status === 'Audited' || row.action?.toLowerCase().includes('freeze')) severity = 'Critical';

      const timeStr = row.timestamp
        ? new Date(row.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
          })
        : 'Just now';

      return {
        id: row.id || `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
        actor: row.actor || 'System Engine',
        role: row.role || 'SYSTEM',
        action: row.action || 'Administrative Action',
        target: row.target || 'System Resource',
        ipAddress: row.ip_address || '127.0.0.1 (Secure Rail)',
        timestamp: timeStr,
        sha256Hash: generateAuditHash(`${row.id}-${row.timestamp}-${row.action}`),
        severity,
        status: row.status || 'Authorized',
        tenantId: row.tenant_id,
      };
    });

    // Merge any newer local runtime audit logs that might not have synched due to RLS
    const allIds = new Set(mappedLogs.map((l) => l.id));
    const unmergedLocal = localLogs.filter((l) => !allIds.has(l.id));
    const combined = [...mappedLogs, ...unmergedLocal];

    return {
      logs: combined,
      count: combined.length,
      error: null,
      isDbConnected: true,
    };
  } catch (err: any) {
    return {
      logs: localLogs,
      count: localLogs.length,
      error: err?.message || 'Error querying audit_logs table.',
      isDbConnected: false,
    };
  }
}

/**
 * Records a new immutable audit record to public.audit_logs in Supabase PostgreSQL.
 * SECURITY NOTICE: Identity (actor, role, tenant_id) is enforced by the database trigger
 * 'trg_secure_audit_log' (V5.2). User-provided values are used for local caching but 
 * are overwritten by the database using the secure session context (auth.uid()).
 */
export async function recordAuditEventInDb(params: {
  action: string;
  target: string;
  actor?: string;
  role?: string;
  tenantId?: string;
  ipAddress?: string;
  status?: 'Authorized' | 'Flagged' | 'Audited';
}): Promise<{ success: boolean; error: string | null; id?: string }> {
  const logId = `AUD-${Math.floor(100000 + Math.random() * 900000)}`;
  const actorName = params.actor || 'Alexander Vance';
  const callerRole = params.role || 'SUPER_ADMIN';
  const tenantId = params.tenantId || 'platform_root';
  const status = params.status || 'Authorized';
  const ipAddress = params.ipAddress || '194.209.12.18 (Zurich)';
  const now = new Date();

  let severity: 'Nominal' | 'Elevated' | 'Critical' = 'Nominal';
  if (status === 'Flagged') severity = 'Elevated';
  if (status === 'Audited' || params.action.toLowerCase().includes('freeze')) severity = 'Critical';

  const newEntry: AuditLogEntry = {
    id: logId,
    actor: actorName,
    role: callerRole,
    action: params.action,
    target: params.target,
    ipAddress,
    timestamp: now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    }),
    sha256Hash: generateAuditHash(`${logId}-${now.toISOString()}-${params.action}`),
    severity,
    status,
    tenantId,
  };

  // Sync to local cache
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
    let list: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
    list = [newEntry, ...list.filter((l) => l.id !== logId)].slice(0, 200);
    localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(list));
  } catch {
    // Ignore local storage error
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          id: logId,
          tenant_id: tenantId,
          actor: actorName,
          role: callerRole,
          action: params.action,
          target: params.target,
          ip_address: ipAddress.split(' ')[0], // Valid IP format
          status,
        })
        .select()
        .single();

      if (error) {
        console.warn('Supabase audit_logs insert rejected by RLS or schema:', error.message);
        return { success: false, error: error.message, id: logId };
      }

      return { success: true, error: null, id: data?.id || logId };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to insert audit record', id: logId };
    }
  }

  return { success: true, error: null, id: logId };
}


/**
 * Fetch KYC Aggregates from Supabase / Complete Dataset
 */
export async function fetchKycAggregatesResultFromDb(
  tenantId: string = 'tenant_apex_bank',
  optionsOrClient?: QueryFilterOptions | any,
  clientOverride?: any
): Promise<KycAggregates> {
  const options: QueryFilterOptions | undefined =
    clientOverride !== undefined
      ? (optionsOrClient as QueryFilterOptions)
      : isSupabaseClientLike(optionsOrClient)
      ? undefined
      : (optionsOrClient as QueryFilterOptions | undefined);
  const resolvedClientOverride =
    clientOverride !== undefined
      ? clientOverride
      : isSupabaseClientLike(optionsOrClient)
      ? optionsOrClient
      : undefined;

  const client = resolvedClientOverride !== undefined ? resolvedClientOverride : supabase;
  const configured = resolvedClientOverride !== undefined ? Boolean(resolvedClientOverride) : isSupabaseConfigured();

  if (!configured || !client) {
    return {
      totalRecords: 0,
      totalCount: 0,
      verifiedCount: 0,
      pendingCount: 0,
      reviewCount: 0,
      tierDistribution: [],
      docTypeDistribution: [],
      source: 'fallback',
      state: 'unconfigured',
      error: 'Supabase client is not configured.',
      isPartial: false,
      rejectedRecordsCount: 0,
    };
  }

  if (await shouldSkipUnauthenticatedQuery(client, resolvedClientOverride)) {
    return {
      totalRecords: 0,
      totalCount: 0,
      verifiedCount: 0,
      pendingCount: 0,
      reviewCount: 0,
      tierDistribution: [],
      docTypeDistribution: [],
      source: 'fallback',
      state: 'demo_session_rls',
      error: 'Authentication required: Active Supabase Auth session needed for institutional KYC aggregates.',
      isPartial: false,
      rejectedRecordsCount: 0,
    };
  }

  const activeRole = getActiveSessionRole(resolvedClientOverride);
  if (activeRole && !canRoleAccessInstitutionalKyc(activeRole)) {
    return {
      totalRecords: 0,
      totalCount: 0,
      verifiedCount: 0,
      pendingCount: 0,
      reviewCount: 0,
      tierDistribution: [],
      docTypeDistribution: [],
      source: 'fallback',
      state: 'restricted',
      error: `Restricted: Role ${activeRole} is not authorized for institutional KYC aggregates.`,
      isPartial: false,
      rejectedRecordsCount: 0,
    };
  }

  const runKycAggregate = async (): Promise<KycAggregates> => {
  const correlationId = createTelemetryCorrelationId();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const callerRole = activeRole || 'AUTHENTICATED';
  const elapsedMs = () =>
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;

  try {
    const { data: rpcData, error: rpcError } = await applyAbortSignal(
      client.rpc('get_kyc_aggregates', {
        p_tenant_id: tenantId && tenantId !== 'ALL' && tenantId !== 'platform_root' ? tenantId : null,
      }),
      options?.signal
    );

    if (rpcError) {
      const hasAuthSession = await checkHasSupabaseAuthSession(client);
      const state = classifyErrorState(rpcError, hasAuthSession);
      const diag = recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'KYC & Compliance Queue',
        rpcName: 'get_kyc_aggregates',
        sqlstate: extractSafeSqlstate(rpcError),
        durationMs: elapsedMs(),
        dateRangeDays: 'ALL',
        role: callerRole,
        tenantScope: tenantId,
        outcome: isAbortError(rpcError, options?.signal)
          ? 'ABORTED'
          : state === 'timeout'
          ? 'TIMEOUT'
          : state === 'restricted' || state === 'demo_session_rls'
          ? 'RESTRICTED'
          : 'ERROR',
      });
      return {
        totalRecords: 0,
        totalCount: 0,
        verifiedCount: 0,
        pendingCount: 0,
        reviewCount: 0,
        tierDistribution: [],
        docTypeDistribution: [],
        source: 'fallback',
        state,
        error: formatTelemetryDiagnosticError(diag, rpcError.message || 'Failed to load KYC aggregates.'),
        isPartial: false,
        rejectedRecordsCount: 0,
      };
    }

    if (rpcData && typeof rpcData === 'object') {
      const hasAuthSession = await checkHasSupabaseAuthSession(client);
      recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'KYC & Compliance Queue',
        rpcName: 'get_kyc_aggregates',
        sqlstate: '00000',
        durationMs: elapsedMs(),
        dateRangeDays: 'ALL',
        role: callerRole,
        tenantScope: tenantId,
        outcome: 'SUCCESS',
      });
      const totalRecords = Number(rpcData.totalRecords) || 0;
      return {
        totalRecords,
        totalCount: totalRecords,
        verifiedCount: Number(rpcData.verifiedCount) || 0,
        pendingCount: Number(rpcData.pendingCount) || 0,
        reviewCount: Number(rpcData.reviewCount) || 0,
        tierDistribution: Array.isArray(rpcData.tierDistribution) ? rpcData.tierDistribution : [],
        docTypeDistribution: Array.isArray(rpcData.docTypeDistribution) ? rpcData.docTypeDistribution : [],
        source: 'supabase',
        state: totalRecords > 0 ? 'live_records' : (hasAuthSession ? 'zero_records' : 'demo_session_rls'),
        error: null,
        isPartial: Boolean(rpcData.isPartial),
        rejectedRecordsCount: Number(rpcData.rejectedRecordsCount) || 0,
      };
    }

    const emptyDiag = recordTelemetryDiagnostic({
      correlationId,
      widgetName: 'KYC & Compliance Queue',
      rpcName: 'get_kyc_aggregates',
      sqlstate: 'EMPTY',
      durationMs: elapsedMs(),
      dateRangeDays: 'ALL',
      role: callerRole,
      tenantScope: tenantId,
      outcome: 'ERROR',
    });
    return {
      totalRecords: 0,
      totalCount: 0,
      verifiedCount: 0,
      pendingCount: 0,
      reviewCount: 0,
      tierDistribution: [],
      docTypeDistribution: [],
      source: 'fallback',
      state: 'query_error',
      error: formatTelemetryDiagnosticError(emptyDiag, 'Empty response from get_kyc_aggregates.'),
      isPartial: false,
      rejectedRecordsCount: 0,
    };
  } catch (err: any) {
    const hasAuthSession = await checkHasSupabaseAuthSession(client);
    const state = classifyErrorState(err, hasAuthSession);
    const diag = recordTelemetryDiagnostic({
      correlationId,
      widgetName: 'KYC & Compliance Queue',
      rpcName: 'get_kyc_aggregates',
      sqlstate: extractSafeSqlstate(err),
      durationMs: elapsedMs(),
      dateRangeDays: 'ALL',
      role: callerRole,
      tenantScope: tenantId,
      outcome: isAbortError(err, options?.signal)
        ? 'ABORTED'
        : state === 'timeout'
        ? 'TIMEOUT'
        : state === 'restricted' || state === 'demo_session_rls'
        ? 'RESTRICTED'
        : 'ERROR',
    });
    return {
      totalRecords: 0,
      totalCount: 0,
      verifiedCount: 0,
      pendingCount: 0,
      reviewCount: 0,
      tierDistribution: [],
      docTypeDistribution: [],
      source: 'fallback',
      state,
      error: formatTelemetryDiagnosticError(diag, err?.message || 'Unexpected error querying KYC aggregates.'),
      isPartial: false,
      rejectedRecordsCount: 0,
    };
  }
  };

  if (options?.signal) {
    return runKycAggregate();
  }
  return dedupeInFlight(`kyc_agg:${getClientScopeKey(client)}:${tenantId}`, runKycAggregate);
}

/**
 * Fetch Platform Executive KPIs (SUPER_ADMIN Only)
 */
export async function fetchPlatformExecutiveKpis(
  clientOrOptions?: any,
  maybeOptions?: { signal?: AbortSignal }
): Promise<PlatformExecutiveKpis> {
  const clientOverride = isSupabaseClientLike(clientOrOptions) ? clientOrOptions : undefined;
  const options: { signal?: AbortSignal } | undefined = isSupabaseClientLike(clientOrOptions)
    ? maybeOptions
    : (clientOrOptions as { signal?: AbortSignal } | undefined);

  const client = clientOverride !== undefined ? clientOverride : supabase;
  const configured = clientOverride !== undefined ? Boolean(clientOverride) : isSupabaseConfigured();

  const emptyKpis = (
    source: 'error' | 'unconfigured',
    error: string,
    state: QueryResultState = 'query_error'
  ): PlatformExecutiveKpis => ({
    settledVolumeYtd: 0,
    institutionalMrr: 0,
    preventedFraudVolume: 0,
    slaCompliancePct: 0,
    complianceScore: 0,
    activeUsers: 0,
    netLiquidBalance: 0,
    riskExposureScore: 0,
    source,
    state,
    error,
  });

  if (!configured || !client) {
    return emptyKpis('unconfigured', 'Supabase client is not configured.', 'unconfigured');
  }

  if (await shouldSkipUnauthenticatedQuery(client, clientOverride)) {
    return emptyKpis(
      'error',
      'Authentication required: Active Supabase Auth session needed for executive KPIs.',
      'demo_session_rls'
    );
  }

  const activeRole = getActiveSessionRole(clientOverride);
  if (activeRole && activeRole !== 'SUPER_ADMIN') {
    return emptyKpis(
      'error',
      `Restricted: Global Executive KPIs are restricted exclusively to SUPER_ADMIN (current role: ${activeRole}).`,
      'restricted'
    );
  }

  const runKpis = async (): Promise<PlatformExecutiveKpis> => {
    const correlationId = createTelemetryCorrelationId();
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const callerRole = activeRole || 'SUPER_ADMIN';
    const elapsedMs = () =>
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;

    try {
      const { data, error } = await applyAbortSignal(
        client.rpc('get_platform_executive_kpis'),
        options?.signal
      );
      if (error) {
        const hasAuthSession = await checkHasSupabaseAuthSession(client);
        const state = classifyErrorState(error, hasAuthSession);
        const diag = recordTelemetryDiagnostic({
          correlationId,
          widgetName: 'Platform Executive KPIs',
          rpcName: 'get_platform_executive_kpis',
          sqlstate: extractSafeSqlstate(error),
          durationMs: elapsedMs(),
          dateRangeDays: 'ALL',
          role: callerRole,
          tenantScope: 'ALL',
          outcome: isAbortError(error, options?.signal)
            ? 'ABORTED'
            : state === 'timeout'
            ? 'TIMEOUT'
            : state === 'restricted' || state === 'demo_session_rls'
            ? 'RESTRICTED'
            : 'ERROR',
        });
        return emptyKpis(
          'error',
          formatTelemetryDiagnosticError(diag, error.message || 'Executive KPIs access failed.'),
          state
        );
      }
      if (data && typeof data === 'object') {
        recordTelemetryDiagnostic({
          correlationId,
          widgetName: 'Platform Executive KPIs',
          rpcName: 'get_platform_executive_kpis',
          sqlstate: '00000',
          durationMs: elapsedMs(),
          dateRangeDays: 'ALL',
          role: callerRole,
          tenantScope: 'ALL',
          outcome: 'SUCCESS',
        });
        return {
          settledVolumeYtd: Number(data.settledVolumeYtd) || 0,
          institutionalMrr: Number(data.institutionalMrr) || 0,
          preventedFraudVolume: Number(data.preventedFraudVolume) || 0,
          slaCompliancePct: Number(data.slaCompliancePct) || 0,
          complianceScore: Number(data.complianceScore) || 0,
          activeUsers: Number(data.activeUsers) || 0,
          netLiquidBalance: Number(data.netLiquidBalance) || 0,
          riskExposureScore: Number(data.riskExposureScore) || 0,
          source: 'supabase',
          state: 'live_records',
          error: null,
        };
      }
      const emptyDiag = recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'Platform Executive KPIs',
        rpcName: 'get_platform_executive_kpis',
        sqlstate: 'EMPTY',
        durationMs: elapsedMs(),
        dateRangeDays: 'ALL',
        role: callerRole,
        tenantScope: 'ALL',
        outcome: 'ERROR',
      });
      return emptyKpis('error', formatTelemetryDiagnosticError(emptyDiag, 'No executive KPI data returned from Supabase.'));
    } catch (err: any) {
      const hasAuthSession = await checkHasSupabaseAuthSession(client);
      const state = classifyErrorState(err, hasAuthSession);
      const diag = recordTelemetryDiagnostic({
        correlationId,
        widgetName: 'Platform Executive KPIs',
        rpcName: 'get_platform_executive_kpis',
        sqlstate: extractSafeSqlstate(err),
        durationMs: elapsedMs(),
        dateRangeDays: 'ALL',
        role: callerRole,
        tenantScope: 'ALL',
        outcome: isAbortError(err, options?.signal)
          ? 'ABORTED'
          : state === 'timeout'
          ? 'TIMEOUT'
          : state === 'restricted' || state === 'demo_session_rls'
          ? 'RESTRICTED'
          : 'ERROR',
      });
      return emptyKpis(
        'error',
        formatTelemetryDiagnosticError(diag, err?.message || 'Unexpected exception fetching executive KPIs.'),
        state
      );
    }
  };

  if (options?.signal) {
    return runKpis();
  }
  return dedupeInFlight(`platform_kpis:${getClientScopeKey(client)}`, runKpis);
}
