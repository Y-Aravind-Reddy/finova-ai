export type CanonicalRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FINANCE_ANALYST'
  | 'SUPPORT_EXECUTIVE'
  | 'CUSTOMER';

export interface OperationalContextNodeStatus {
  node: string;
  status: 'OPERATIONAL' | 'RESTRICTED' | 'UNAVAILABLE';
  reason?: string;
}

export interface OperationalAiContext {
  role: CanonicalRole;
  tenantScope: string;
  generatedAt: string;
  nodeStatuses: OperationalContextNodeStatus[];
  transactions?: {
    scope: 'TENANT' | 'GLOBAL' | 'SELF_ONLY';
    totalCount: number;
    settledCount: number;
    settledVolumeInr: number;
    settledVolumeUsd: number;
    creditsVolumeInr: number;
    debitsVolumeInr: number;
    netLiquidBalanceInr: number;
    unconvertedCount: number;
    currencyExposure: Record<string, { original: number; inr: number; usd?: number }>;
    topCategories: Array<{ category: string; count: number; volumeInr: number }>;
  };
  fraud?: {
    totalCases: number;
    flaggedCount: number;
    frozenCount: number;
    clearedCount: number;
    preventedVolumeInr: number;
    monitoredVolumeInr: number;
    unconvertedCases: number;
    currencyExposure: Record<string, { original: number; inr: number; usd?: number }>;
  };
  support?: {
    totalTickets: number;
    openCount: number;
    closedCount: number;
    inProgressCount: number;
    pendingClientCount: number;
    slaCompliancePct: number;
    averageCsat: number;
  };
  kyc?: {
    scope: 'INSTITUTIONAL' | 'SELF_ONLY';
    totalRecords: number;
    verifiedCount: number;
    pendingCount: number;
    reviewCount: number;
  };
  executiveKpis?: {
    settledVolumeYtdInr: number;
    institutionalMrr: number;
    preventedFraudVolumeInr: number;
    slaCompliancePct: number;
    complianceScore: number;
    activeUsers: number;
    netLiquidBalanceInr: number;
    riskExposureScore: number;
  };
}

/**
 * Strips control characters, delimiter breakout tags, and common directive prefixes
 * from untrusted RAG/database text before placing inside delimited prompt sections.
 */
export function sanitizeUntrustedText(raw: unknown, maxLen = 1800): string {
  const input = String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/<\/?untrusted_[a-z0-9_]+>/gi, '[TAG_STRIPPED]')
    .replace(/<\/?system>/gi, '[TAG_STRIPPED]')
    .replace(/\b(ignore\s+(all\s+)?previous\s+instructions|system\s+override|developer\s+mode|reveal\s+system\s+prompt)\b/gi, '[DIRECTIVE_REDACTED]');

  return input.length > maxLen ? input.slice(0, maxLen) + '…' : input;
}

export function wrapUntrustedReferenceData(label: string, content: string): string {
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `<untrusted_reference_data source="${safeLabel}">\n${sanitizeUntrustedText(content, 12000)}\n</untrusted_reference_data>`;
}

export async function getOperationalAiContext(params: {
  supabaseUser: any;
  userId: string;
  role: CanonicalRole;
  tenantId: string;
}): Promise<OperationalAiContext> {
  const { supabaseUser, userId, role, tenantId } = params;
  const scopedTenant =
    role === 'SUPER_ADMIN' && (tenantId === 'platform_root' || tenantId === 'ALL')
      ? null
      : tenantId;

  const ctx: OperationalAiContext = {
    role,
    tenantScope: scopedTenant || 'GLOBAL_ALL_TENANTS',
    generatedAt: new Date().toISOString(),
    nodeStatuses: [],
  };

  // 1. Transactions aggregate (Allowed for all 5 roles, strictly self-scoped for CUSTOMER)
  try {
    const { data: txData, error: txErr } = await supabaseUser.rpc(
      'get_transaction_aggregates',
      {
        p_tenant_id: scopedTenant,
        p_user_id: role === 'CUSTOMER' ? userId : null,
        p_start_date: null,
        p_end_date: null,
        p_status: null,
        p_type: null,
      }
    );

    if (txErr || !txData) {
      const code = String(txErr?.code || '');
      ctx.nodeStatuses.push({
        node: 'transactions',
        status: code === '42501' ? 'RESTRICTED' : 'UNAVAILABLE',
        reason: txErr?.message || 'RPC unavailable',
      });
    } else {
      const catBreakdown = (txData.categoryBreakdown || {}) as Record<
        string,
        { count?: number; volumeInr?: number }
      >;
      const topCategories = Object.entries(catBreakdown)
        .map(([category, v]) => ({
          category: sanitizeUntrustedText(category, 60),
          count: Number(v?.count) || 0,
          volumeInr: Number(v?.volumeInr) || 0,
        }))
        .sort((a, b) => b.volumeInr - a.volumeInr)
        .slice(0, 5);

      ctx.transactions = {
        scope:
          role === 'CUSTOMER'
            ? 'SELF_ONLY'
            : scopedTenant
            ? 'TENANT'
            : 'GLOBAL',
        totalCount: Number(txData.totalCount) || 0,
        settledCount: Number(txData.settledCount) || 0,
        settledVolumeInr: Number(txData.settledVolumeInr) || 0,
        settledVolumeUsd: Number(txData.settledVolumeUsd) || 0,
        creditsVolumeInr: Number(txData.creditsVolumeInr) || 0,
        debitsVolumeInr: Number(txData.debitsVolumeInr) || 0,
        netLiquidBalanceInr: Number(txData.netLiquidBalanceInr) || 0,
        unconvertedCount: Number(txData.unconvertedCount) || 0,
        currencyExposure: (txData.volumeByCurrency || {}) as Record<
          string,
          { original: number; inr: number; usd?: number }
        >,
        topCategories,
      };
      ctx.nodeStatuses.push({ node: 'transactions', status: 'OPERATIONAL' });
    }
  } catch (err) {
    ctx.nodeStatuses.push({
      node: 'transactions',
      status: 'UNAVAILABLE',
      reason: (err as Error)?.message,
    });
  }

  // 2. Fraud & AML surveillance aggregates (STRICTLY SUPER_ADMIN, ADMIN, FINANCE_ANALYST)
  if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'FINANCE_ANALYST') {
    try {
      const { data: fraudData, error: fraudErr } = await supabaseUser.rpc(
        'get_fraud_aggregates',
        {
          p_tenant_id: scopedTenant,
          p_currency: null,
          p_start_date: null,
          p_end_date: null,
          p_customer_id: null,
          p_status: null,
        }
      );

      if (fraudErr || !fraudData) {
        const code = String(fraudErr?.code || '');
        ctx.nodeStatuses.push({
          node: 'fraud_surveillance',
          status: code === '42501' ? 'RESTRICTED' : 'UNAVAILABLE',
          reason: fraudErr?.message || 'RPC unavailable',
        });
      } else {
        ctx.fraud = {
          totalCases: Number(fraudData.totalCases) || 0,
          flaggedCount: Number(fraudData.flaggedCount) || 0,
          frozenCount: Number(fraudData.frozenCount) || 0,
          clearedCount: Number(fraudData.clearedCount) || 0,
          preventedVolumeInr: Number(fraudData.preventedVolumeInr) || 0,
          monitoredVolumeInr: Number(fraudData.monitoredVolumeInr) || 0,
          unconvertedCases: Number(fraudData.unconvertedCases) || 0,
          currencyExposure: (fraudData.volumeByCurrency || {}) as Record<
            string,
            { original: number; inr: number; usd?: number }
          >,
        };
        ctx.nodeStatuses.push({ node: 'fraud_surveillance', status: 'OPERATIONAL' });
      }
    } catch (err) {
      ctx.nodeStatuses.push({
        node: 'fraud_surveillance',
        status: 'UNAVAILABLE',
        reason: (err as Error)?.message,
      });
    }
  } else {
    ctx.nodeStatuses.push({
      node: 'fraud_surveillance',
      status: 'RESTRICTED',
      reason: `Role ${role} has no fraud surveillance clearance.`,
    });
  }

  // 3. Support desk aggregates (SUPER_ADMIN, ADMIN, SUPPORT_EXECUTIVE)
  //    or self-only ticket summary for CUSTOMER
  if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SUPPORT_EXECUTIVE') {
    try {
      const { data: supData, error: supErr } = await supabaseUser.rpc(
        'get_support_aggregates',
        { p_tenant_id: scopedTenant }
      );
      if (supErr || !supData) {
        const code = String(supErr?.code || '');
        ctx.nodeStatuses.push({
          node: 'support_desk',
          status: code === '42501' ? 'RESTRICTED' : 'UNAVAILABLE',
          reason: supErr?.message || 'RPC unavailable',
        });
      } else {
        ctx.support = {
          totalTickets: Number(supData.totalTickets) || 0,
          openCount: Number(supData.openCount) || 0,
          closedCount: Number(supData.closedCount) || 0,
          inProgressCount: Number(supData.inProgressCount) || 0,
          pendingClientCount: Number(supData.pendingClientCount) || 0,
          slaCompliancePct: Number(supData.slaCompliancePct) || 0,
          averageCsat: Number(supData.averageCsat) || 0,
        };
        ctx.nodeStatuses.push({ node: 'support_desk', status: 'OPERATIONAL' });
      }
    } catch (err) {
      ctx.nodeStatuses.push({
        node: 'support_desk',
        status: 'UNAVAILABLE',
        reason: (err as Error)?.message,
      });
    }
  } else if (role === 'CUSTOMER') {
    try {
      const { data: ownTickets, error: ownSupErr } = await supabaseUser
        .from('support_tickets')
        .select('status')
        .eq('user_id', userId)
        .limit(100);

      if (ownSupErr) {
        ctx.nodeStatuses.push({
          node: 'support_desk',
          status: ownSupErr.code === '42501' ? 'RESTRICTED' : 'UNAVAILABLE',
          reason: ownSupErr.message,
        });
      } else {
        const rows = ownTickets || [];
        ctx.support = {
          totalTickets: rows.length,
          openCount: rows.filter((r: any) => !['Resolved', 'Closed'].includes(r.status)).length,
          closedCount: rows.filter((r: any) => ['Resolved', 'Closed'].includes(r.status)).length,
          inProgressCount: rows.filter((r: any) => r.status === 'In Progress').length,
          pendingClientCount: rows.filter((r: any) => r.status === 'Pending Client').length,
          slaCompliancePct: 0,
          averageCsat: 0,
        };
        ctx.nodeStatuses.push({ node: 'support_desk', status: 'OPERATIONAL' });
      }
    } catch {
      ctx.nodeStatuses.push({ node: 'support_desk', status: 'UNAVAILABLE' });
    }
  } else {
    ctx.nodeStatuses.push({
      node: 'support_desk',
      status: 'RESTRICTED',
      reason: `Role ${role} does not query institutional support queue.`,
    });
  }

  // 4. KYC aggregates (staff only via RPC; CUSTOMER strictly own rows)
  if (role === 'CUSTOMER') {
    try {
      const { data: ownKyc, error: ownKycErr } = await supabaseUser
        .from('kyc_records')
        .select('status')
        .eq('user_id', userId)
        .limit(50);

      if (ownKycErr) {
        ctx.nodeStatuses.push({
          node: 'kyc_records',
          status: ownKycErr.code === '42501' ? 'RESTRICTED' : 'UNAVAILABLE',
          reason: ownKycErr.message,
        });
      } else {
        const rows = ownKyc || [];
        ctx.kyc = {
          scope: 'SELF_ONLY',
          totalRecords: rows.length,
          verifiedCount: rows.filter((r: any) => r.status === 'Verified').length,
          pendingCount: rows.filter((r: any) => r.status === 'Pending').length,
          reviewCount: rows.filter((r: any) => r.status === 'Under Review').length,
        };
        ctx.nodeStatuses.push({ node: 'kyc_records', status: 'OPERATIONAL' });
      }
    } catch {
      ctx.nodeStatuses.push({ node: 'kyc_records', status: 'UNAVAILABLE' });
    }
  } else {
    try {
      const { data: kycData, error: kycErr } = await supabaseUser.rpc(
        'get_kyc_aggregates',
        { p_tenant_id: scopedTenant }
      );
      if (kycErr || !kycData) {
        const code = String(kycErr?.code || '');
        ctx.nodeStatuses.push({
          node: 'kyc_records',
          status: code === '42501' ? 'RESTRICTED' : 'UNAVAILABLE',
          reason: kycErr?.message || 'RPC unavailable',
        });
      } else {
        ctx.kyc = {
          scope: 'INSTITUTIONAL',
          totalRecords: Number(kycData.totalRecords) || 0,
          verifiedCount: Number(kycData.verifiedCount) || 0,
          pendingCount: Number(kycData.pendingCount) || 0,
          reviewCount: Number(kycData.reviewCount) || 0,
        };
        ctx.nodeStatuses.push({ node: 'kyc_records', status: 'OPERATIONAL' });
      }
    } catch (err) {
      ctx.nodeStatuses.push({
        node: 'kyc_records',
        status: 'UNAVAILABLE',
        reason: (err as Error)?.message,
      });
    }
  }

  // 5. Global Platform Executive KPIs (STRICTLY SUPER_ADMIN ONLY)
  if (role === 'SUPER_ADMIN') {
    try {
      const { data: execData, error: execErr } = await supabaseUser.rpc(
        'get_platform_executive_kpis'
      );
      if (execErr || !execData) {
        ctx.nodeStatuses.push({
          node: 'platform_executive_kpis',
          status: String(execErr?.code || '') === '42501' ? 'RESTRICTED' : 'UNAVAILABLE',
          reason: execErr?.message || 'RPC unavailable',
        });
      } else {
        ctx.executiveKpis = {
          settledVolumeYtdInr: Number(execData.settledVolumeYtd) || 0,
          institutionalMrr: Number(execData.institutionalMrr) || 0,
          preventedFraudVolumeInr: Number(execData.preventedFraudVolume) || 0,
          slaCompliancePct: Number(execData.slaCompliancePct) || 0,
          complianceScore: Number(execData.complianceScore) || 0,
          activeUsers: Number(execData.activeUsers) || 0,
          netLiquidBalanceInr: Number(execData.netLiquidBalance) || 0,
          riskExposureScore: Number(execData.riskExposureScore) || 0,
        };
        ctx.nodeStatuses.push({
          node: 'platform_executive_kpis',
          status: 'OPERATIONAL',
        });
      }
    } catch (err) {
      ctx.nodeStatuses.push({
        node: 'platform_executive_kpis',
        status: 'UNAVAILABLE',
        reason: (err as Error)?.message,
      });
    }
  }

  return ctx;
}
