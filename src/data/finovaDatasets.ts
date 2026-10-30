export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FINANCE_ANALYST'
  | 'SUPPORT_EXECUTIVE'
  | 'CUSTOMER';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Suspended' | 'Pending Review' | 'KYC Pending';
  tier: 'Private Wealth Tier 3' | 'Platinum Tier 2' | 'Gold Tier 1' | 'Executive Staff';
  createdDate: string;
  lastActive: string;
  phone: string;
  country: string;
  twoFactorEnabled: boolean;
  notes?: string;
  tenantId?: string; // Multi-Tenant Identifier (e.g. 'tenant_apex_bank', 'tenant_crest_capital')
  tenantName?: string;
  authSource?: 'supabase' | 'local';
}

export interface AdminDataset {
  metrics: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    totalTransactionsCount: number;
    totalRevenueYTD: number;
    fraudCasesReported: number;
    supportTicketsTotal: number;
    systemHealthPct: number;
    serverLatencyMs: number;
    apiThroughput: number;
    dbLoadPct: number;
  };
  roleDistribution: {
    role: string;
    count: number;
    pct: number;
  }[];
  systemAuditLogs: {
    id: string;
    timestamp: string;
    actor: string;
    role: string;
    action: string;
    target: string;
    ipAddress: string;
    status: 'Authorized' | 'Flagged' | 'Audited';
    tenantId?: string;
    tenantName?: string;
  }[];
  users: UserAccount[];
}

export interface CustomerTransaction {
  id: string;
  date: string;
  merchant: string;
  category: 'Securities & Equities' | 'Private Equity' | 'Prime Real Estate' | 'Treasury & Yield' | 'Private Jet Concierge' | 'FX Settlement';
  amount: number;
  type: 'Credit' | 'Debit';
  status: 'Settled' | 'Escrow Secured' | 'Clearing';
  referenceNo: string;
  tenantId?: string;
  tenantName?: string;
  currency?: string;
  amountInr?: number;
  amountUsd?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
}


export interface CustomerDocument {
  id: string;
  title: string;
  documentType: 'Passport' | 'Proof of Address' | 'Tax Certificate W-8BEN' | 'Wealth Declaration' | 'Custody Agreement';
  fileSize: string;
  uploadedAt: string;
  verifiedBy: string;
  status: 'Verified' | 'Under Review' | 'Archived';
  tenantId?: string;
  tenantName?: string;
}

export interface CustomerDataset {
  profile: {
    customerId: string;
    fullName: string;
    email: string;
    phone: string;
    accountNumber: string;
    membershipTier: string;
    liquidityBalance: number;
    portfolioTotalValue: number;
    monthlyInflow: number;
    creditScore: number;
    creditLimit: number;
    creditBalanceUsed: number;
    creditUtilizationPct: number;
    kycStatus: 'Verified (Tier 3 Accredited)' | 'Under Review' | 'Pending';
    relationshipManager: string;
    domicile: string;
    tenantId?: string;
    tenantName?: string;
  };
  transactions: CustomerTransaction[];
  documents: CustomerDocument[];
  spendingCategories: {
    category: string;
    amount: number;
    pct: number;
  }[];
}

export interface FinanceFraudTransaction {
  id: string;
  timestamp: string;
  customerName: string;
  customerId: string;
  amount: number;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'CHF' | 'SGD' | 'CAD' | 'JPY';
  riskScore: number; // 0 - 100
  amlFlag: 'Multi-Hop Velocity' | 'Sanctioned IP Cluster' | 'Rapid Layering' | 'High-Value Anomaly' | 'Clean / Verified';
  status: 'Flagged' | 'In Review' | 'Cleared' | 'Frozen Escrow';
  location: string;
  paymentChannel: 'SWIFT GPI' | 'FedNow Instant' | 'CHAPS London' | 'Prime Liquidity Bridge';
  ruleTriggered: string;
  aiConfidencePct: number;
  tenantId?: string;
  tenantName?: string;
  amountInr?: number;
  amountUsd?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
}


export interface FinanceAnalystDataset {
  metrics: {
    totalMonitoredVolume: number;
    totalMonitoredCount: number;
    flaggedCasesCount: number;
    confirmedFraudPrevented: number;
    falsePositiveRatePct: number;
    amlBreachAlerts: number;
    averageRiskScore: number;
  };
  riskTiers: {
    tier: string;
    count: number;
    volume: number;
  }[];
  transactions: FinanceFraudTransaction[];
}

export interface SupportTicket {
  ticketId: string;
  customerName: string;
  accountTier: 'Private Wealth Tier 3' | 'Platinum Tier 2' | 'Gold Tier 1';
  category: 'High-Value Wire Authorization' | 'Transaction Dispute' | 'KYC Resubmission' | 'Bespoke Card Issuance' | 'Tax Document Export';
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Pending Client';
  assignedExecutive: string;
  openedAt: string;
  slaTargetHours: number;
  hoursOpen: number;
  csatRating?: number; // 1 to 5
  tenantId?: string;
  tenantName?: string;
}

export interface SupportDataset {
  metrics: {
    openTickets: number;
    resolvedTicketsCount: number;
    avgResolutionTimeMin: number;
    csatScore: number;
    urgentFollowUps: number;
    slaCompliancePct: number;
  };
  ticketCategories: {
    category: string;
    count: number;
    resolvedPct: number;
  }[];
  tickets: SupportTicket[];
}

/* ==========================================================
   OFFICIAL DATASETS (MAPPED DIRECTLY TO UPLOADED SPREADSHEETS)
   ========================================================== */

// 1. cleaned_admin_data_pandas.xls
export const ADMIN_DATASET: AdminDataset = {
  metrics: {
    totalUsers: 148920,
    activeUsers: 124310,
    inactiveUsers: 24610,
    totalTransactionsCount: 2841920,
    totalRevenueYTD: 84620000, // $84.62M
    fraudCasesReported: 142,
    supportTicketsTotal: 3420,
    systemHealthPct: 99.992,
    serverLatencyMs: 22,
    apiThroughput: 14850,
    dbLoadPct: 34,
  },
  roleDistribution: [
    { role: 'Customer (Private Wealth)', count: 147250, pct: 98.88 },
    { role: 'Support Executive', count: 820, pct: 0.55 },
    { role: 'Finance Analyst', count: 480, pct: 0.32 },
    { role: 'Operations Admin', count: 320, pct: 0.22 },
    { role: 'Super Admin', count: 50, pct: 0.03 },
  ],
  systemAuditLogs: [
    {
      id: 'AUD-99120',
      timestamp: '2026-10-08 07:54:12',
      actor: 'Alexander Vance (Super Admin)',
      role: 'SUPER_ADMIN',
      action: 'Elevated Liquidity Limit & Policy Overwrite',
      target: 'Institutional Custody Engine',
      ipAddress: '194.26.29.11 (Zurich Vault Node)',
      status: 'Audited',
    },
    {
      id: 'AUD-99119',
      timestamp: '2026-10-08 07:41:03',
      actor: 'Eleanor Sterling (Admin)',
      role: 'ADMIN',
      action: 'Approved Tier 3 KYC Verification',
      target: 'USR-1008 (Genevieve Dupont)',
      ipAddress: '51.15.42.88 (Paris Desk)',
      status: 'Authorized',
    },
    {
      id: 'AUD-99118',
      timestamp: '2026-10-08 07:15:20',
      actor: 'Julian Thorne (Analyst)',
      role: 'FINANCE_ANALYST',
      action: 'Freezing Escrow on Suspicious SWIFT Sweep',
      target: 'TXN-994101 ($1,240,000 USD)',
      ipAddress: '104.244.42.1 (London City Hub)',
      status: 'Flagged',
    },
    {
      id: 'AUD-99117',
      timestamp: '2026-10-08 06:48:33',
      actor: 'Claire Montgomery (Support)',
      role: 'SUPPORT_EXECUTIVE',
      action: 'Dispatched Sovereign Black Card Replacement',
      target: 'TKT-9021 (Harrison Croft)',
      ipAddress: '185.190.140.2 (Geneva HQ)',
      status: 'Authorized',
    },
    {
      id: 'AUD-99116',
      timestamp: '2026-10-08 06:12:09',
      actor: 'System Sentinel AI',
      role: 'SECURITY_AUTOMATION',
      action: 'Automated AML Anomaly Rule Run #481',
      target: 'Global FedNow Inflow Gateway',
      ipAddress: '10.0.84.102 (Internal Core)',
      status: 'Authorized',
    },
  ],
  users: [
    {
      id: 'USR-1001',
      name: 'Alexander Vance',
      email: 'alexander.vance@finova.ai',
      role: 'SUPER_ADMIN',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2023-01-15',
      lastActive: 'Just now',
      phone: '+1 (212) 555-0190',
      country: 'United States',
      twoFactorEnabled: true,
      notes: 'Global Chief Executive & Key Vault Signer',
    },
    {
      id: 'USR-1002',
      name: 'Eleanor Sterling',
      email: 'eleanor.sterling@finova.ai',
      role: 'ADMIN',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2023-04-10',
      lastActive: '12m ago',
      phone: '+44 20 7946 0912',
      country: 'United Kingdom',
      twoFactorEnabled: true,
      notes: 'VP of Platform Governance & Compliance',
    },
    {
      id: 'USR-1003',
      name: 'Julian Thorne',
      email: 'julian.thorne@finova.ai',
      role: 'FINANCE_ANALYST',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2023-08-22',
      lastActive: '4m ago',
      phone: '+41 22 730 5900',
      country: 'Switzerland',
      twoFactorEnabled: true,
      notes: 'Lead Forensic AML & Risk Modeling Officer',
    },
    {
      id: 'USR-1004',
      name: 'Claire Montgomery',
      email: 'claire.montgomery@finova.ai',
      role: 'SUPPORT_EXECUTIVE',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2024-01-05',
      lastActive: '18m ago',
      phone: '+65 6718 8900',
      country: 'Singapore',
      twoFactorEnabled: true,
      notes: 'Private Wealth Concierge & Escalation Lead',
    },
    {
      id: 'USR-1005',
      name: 'Harrison Croft',
      email: 'harrison.croft@croftcapital.com',
      role: 'CUSTOMER',
      status: 'Active',
      tier: 'Private Wealth Tier 3',
      createdDate: '2024-03-14',
      lastActive: '2m ago',
      phone: '+1 (310) 555-8849',
      country: 'United States',
      twoFactorEnabled: true,
      notes: 'Croft Single Family Office Principal',
    },
    {
      id: 'USR-1006',
      name: 'Genevieve Dupont',
      email: 'g.dupont@chateaulux.fr',
      role: 'CUSTOMER',
      status: 'Active',
      tier: 'Private Wealth Tier 3',
      createdDate: '2024-05-18',
      lastActive: '1h ago',
      phone: '+33 1 42 68 55 00',
      country: 'France',
      twoFactorEnabled: true,
      notes: 'European Real Estate Syndicate Partner',
    },
    {
      id: 'USR-1007',
      name: 'Kenji Takahashi',
      email: 'kenji.takahashi@tokyoprime.jp',
      role: 'CUSTOMER',
      status: 'Active',
      tier: 'Platinum Tier 2',
      createdDate: '2024-07-29',
      lastActive: '3h ago',
      phone: '+81 3 5555 0144',
      country: 'Japan',
      twoFactorEnabled: true,
      notes: 'High-Tech Venture General Partner',
    },
    {
      id: 'USR-1008',
      name: 'Marcus Aurelius Sterling',
      email: 'marcus@aurelius-holdings.co.uk',
      role: 'CUSTOMER',
      status: 'Pending Review',
      tier: 'Gold Tier 1',
      createdDate: '2024-09-02',
      lastActive: '1d ago',
      phone: '+44 20 7183 9920',
      country: 'United Kingdom',
      twoFactorEnabled: false,
      notes: 'KYC Document verification in progress',
    },
    {
      id: 'USR-1009',
      name: 'Soren Lindqvist',
      email: 'soren.lindqvist@finova.ai',
      role: 'FINANCE_ANALYST',
      status: 'Active',
      tier: 'Executive Staff',
      createdDate: '2024-02-11',
      lastActive: '2h ago',
      phone: '+46 8 123 4567',
      country: 'Sweden',
      twoFactorEnabled: true,
      notes: 'Nordic Markets Risk Specialist',
    },
    {
      id: 'USR-1010',
      name: 'Victoria Habsburg',
      email: 'v.habsburg@vienna-trust.at',
      role: 'CUSTOMER',
      status: 'Active',
      tier: 'Private Wealth Tier 3',
      createdDate: '2024-04-09',
      lastActive: '5h ago',
      phone: '+43 1 515 440',
      country: 'Austria',
      twoFactorEnabled: true,
      notes: 'Sovereign Family Trust Trustee',
    },
  ],
};

// 2. cleaned_customer_data_pandas.xls
export const CUSTOMER_DATASET: CustomerDataset = {
  profile: {
    customerId: 'FNV-CUST-8849',
    fullName: 'Harrison Croft',
    email: 'harrison.croft@croftcapital.com',
    phone: '+1 (310) 555-8849',
    accountNumber: 'FNV-CH-8849-0092-GOLD',
    membershipTier: 'Private Wealth - Diamond Sovereign',
    liquidityBalance: 1428500.0,
    portfolioTotalValue: 4892300.0,
    monthlyInflow: 384000.0,
    creditScore: 815,
    creditLimit: 250000.0,
    creditBalanceUsed: 46000.0,
    creditUtilizationPct: 18.4,
    kycStatus: 'Verified (Tier 3 Accredited)',
    relationshipManager: 'Claire Montgomery (VP Senior Wealth)',
    domicile: 'Geneva / New York Multi-Jurisdiction',
  },
  transactions: [
    {
      id: 'TXN-CUST-701',
      date: '2026-10-07',
      merchant: 'Goldman Sachs Institutional Prime',
      category: 'Securities & Equities',
      amount: 245000.0,
      type: 'Debit',
      status: 'Settled',
      referenceNo: 'GS-PRM-89102-USD',
    },
    {
      id: 'TXN-CUST-702',
      date: '2026-10-05',
      merchant: 'Blackstone Strategic Opportunities VI',
      category: 'Private Equity',
      amount: 150000.0,
      type: 'Debit',
      status: 'Settled',
      referenceNo: 'BX-SOF6-4419-CALL',
    },
    {
      id: 'TXN-CUST-703',
      date: '2026-10-04',
      merchant: 'Sotheby’s International Realty Escrow',
      category: 'Prime Real Estate',
      amount: 85000.0,
      type: 'Debit',
      status: 'Escrow Secured',
      referenceNo: 'SOTH-ESC-00912-CH',
    },
    {
      id: 'TXN-CUST-704',
      date: '2026-10-02',
      merchant: 'US Treasury 6-Month T-Bill Coupon',
      category: 'Treasury & Yield',
      amount: 42800.0,
      type: 'Credit',
      status: 'Settled',
      referenceNo: 'UST-CPN-9981-DEP',
    },
    {
      id: 'TXN-CUST-705',
      date: '2026-09-29',
      merchant: 'NetJets European Aviation Charter',
      category: 'Private Jet Concierge',
      amount: 28400.0,
      type: 'Debit',
      status: 'Settled',
      referenceNo: 'NJ-EUR-7721-FLT',
    },
    {
      id: 'TXN-CUST-706',
      date: '2026-09-26',
      merchant: 'UBS Zurich Cross-Border Liquidity Swaps',
      category: 'FX Settlement',
      amount: 120000.0,
      type: 'Credit',
      status: 'Settled',
      referenceNo: 'UBS-FX-SWAP-901',
    },
    {
      id: 'TXN-CUST-707',
      date: '2026-09-21',
      merchant: 'Apollo Global Management Credit Fund',
      category: 'Private Equity',
      amount: 65000.0,
      type: 'Debit',
      status: 'Clearing',
      referenceNo: 'APO-CRD-3301',
    },
  ],
  documents: [
    {
      id: 'DOC-8801',
      title: 'Biometric Sovereign Passport (Notarized)',
      documentType: 'Passport',
      fileSize: '4.8 MB',
      uploadedAt: '2026-03-15',
      verifiedBy: 'Finova Gold Identity Guard',
      status: 'Verified',
    },
    {
      id: 'DOC-8802',
      title: 'Geneva Lakeside Residence Proof of Domicile',
      documentType: 'Proof of Address',
      fileSize: '2.1 MB',
      uploadedAt: '2026-03-15',
      verifiedBy: 'Swiss Canton Notary Public',
      status: 'Verified',
    },
    {
      id: 'DOC-8803',
      title: 'IRS Form W-8BEN (Foreign Status Certificate)',
      documentType: 'Tax Certificate W-8BEN',
      fileSize: '1.4 MB',
      uploadedAt: '2026-01-10',
      verifiedBy: 'PwC Global Tax Audit',
      status: 'Verified',
    },
    {
      id: 'DOC-8804',
      title: 'Accredited Sovereign Wealth Declaration 2026',
      documentType: 'Wealth Declaration',
      fileSize: '6.2 MB',
      uploadedAt: '2026-04-02',
      verifiedBy: 'JP Morgan Private Bank Legal',
      status: 'Verified',
    },
    {
      id: 'DOC-8805',
      title: 'Finova Master Custody & Tri-Party Agreement',
      documentType: 'Custody Agreement',
      fileSize: '8.9 MB',
      uploadedAt: '2026-04-05',
      verifiedBy: 'Finova Compliance Office',
      status: 'Verified',
    },
  ],
  spendingCategories: [
    { category: 'Securities & Equities', amount: 395000, pct: 44.5 },
    { category: 'Private Equity & Ventures', amount: 215000, pct: 24.2 },
    { category: 'Prime Real Estate & Escrow', amount: 145000, pct: 16.3 },
    { category: 'Treasury & FX Optimization', amount: 84000, pct: 9.5 },
    { category: 'Concierge & Luxury Lifestyle', amount: 48400, pct: 5.5 },
  ],
};

// 3. cleaned_finance_analyst&fraud_pandas.xls
export const FINANCE_ANALYST_DATASET: FinanceAnalystDataset = {
  metrics: {
    totalMonitoredVolume: 248910000, // $248.91M
    totalMonitoredCount: 842190,
    flaggedCasesCount: 142,
    confirmedFraudPrevented: 4821500, // $4.82M
    falsePositiveRatePct: 0.12,
    amlBreachAlerts: 18,
    averageRiskScore: 16.4,
  },
  riskTiers: [
    { tier: 'Low Risk (0 - 25)', count: 832400, volume: 231500000 },
    { tier: 'Moderate Risk (26 - 50)', count: 9140, volume: 11400000 },
    { tier: 'Elevated Risk (51 - 75)', count: 508, volume: 3800000 },
    { tier: 'Critical Threat (76 - 100)', count: 142, volume: 2210000 },
  ],
  transactions: [
    {
      id: 'TXN-FRAUD-994101',
      timestamp: '2026-10-08 07:12:44',
      customerName: 'Aegis Offshore Holdings Ltd',
      customerId: 'FNV-CUST-9104',
      amount: 1240000.0,
      currency: 'USD',
      riskScore: 94,
      amlFlag: 'Multi-Hop Velocity',
      status: 'Frozen Escrow',
      location: 'Nassau -> Limassol Proxy Node',
      paymentChannel: 'SWIFT GPI',
      ruleTriggered: 'AML-R9: Structuring sweep across non-equivalent jurisdictions',
      aiConfidencePct: 98.4,
    },
    {
      id: 'TXN-FRAUD-994102',
      timestamp: '2026-10-08 06:45:19',
      customerName: 'Kenji Takahashi',
      customerId: 'FNV-CUST-1007',
      amount: 450000.0,
      currency: 'SGD',
      riskScore: 28,
      amlFlag: 'Clean / Verified',
      status: 'Cleared',
      location: 'Singapore (DBS Institutional)',
      paymentChannel: 'Prime Liquidity Bridge',
      ruleTriggered: 'Routine high-ticket check: Source of wealth verified',
      aiConfidencePct: 99.1,
    },
    {
      id: 'TXN-FRAUD-994103',
      timestamp: '2026-10-08 05:22:01',
      customerName: 'Veloce Global Syndicate',
      customerId: 'FNV-CUST-3902',
      amount: 890000.0,
      currency: 'EUR',
      riskScore: 82,
      amlFlag: 'Sanctioned IP Cluster',
      status: 'In Review',
      location: 'Seychelles / Tor Exit Relay',
      paymentChannel: 'CHAPS London',
      ruleTriggered: 'AML-R14: Geolocation spoofing with high-velocity euro clearing',
      aiConfidencePct: 93.7,
    },
    {
      id: 'TXN-FRAUD-994104',
      timestamp: '2026-10-08 04:09:55',
      customerName: 'Genevieve Dupont',
      customerId: 'FNV-CUST-1006',
      amount: 320000.0,
      currency: 'EUR',
      riskScore: 14,
      amlFlag: 'Clean / Verified',
      status: 'Cleared',
      location: 'Paris (BNP Paribas Private)',
      paymentChannel: 'SWIFT GPI',
      ruleTriggered: 'Regular dividend re-investment: Clean historical pedigree',
      aiConfidencePct: 99.8,
    },
    {
      id: 'TXN-FRAUD-994105',
      timestamp: '2026-10-08 03:31:12',
      customerName: 'Alpha Orion Capital LLC',
      customerId: 'FNV-CUST-6621',
      amount: 675000.0,
      currency: 'USD',
      riskScore: 88,
      amlFlag: 'Rapid Layering',
      status: 'Flagged',
      location: 'Panama City -> Delaware Bridge',
      paymentChannel: 'FedNow Instant',
      ruleTriggered: 'AML-R22: Layered outbound wire within 60s of inbound ACH',
      aiConfidencePct: 96.2,
    },
    {
      id: 'TXN-FRAUD-994106',
      timestamp: '2026-10-08 02:14:38',
      customerName: 'Harrison Croft',
      customerId: 'FNV-CUST-8849',
      amount: 245000.0,
      currency: 'USD',
      riskScore: 8,
      amlFlag: 'Clean / Verified',
      status: 'Cleared',
      location: 'New York (Goldman Sachs Custody)',
      paymentChannel: 'FedNow Instant',
      ruleTriggered: 'Whitelisted Prime Brokerage Settlement',
      aiConfidencePct: 99.9,
    },
  ],
};

// 4. Support Executive main FinTech.xlsx
export const SUPPORT_DATASET: SupportDataset = {
  metrics: {
    openTickets: 24,
    resolvedTicketsCount: 382,
    avgResolutionTimeMin: 18.4,
    csatScore: 4.94,
    urgentFollowUps: 3,
    slaCompliancePct: 99.2,
  },
  ticketCategories: [
    { category: 'High-Value Wire Authorization', count: 142, resolvedPct: 98.6 },
    { category: 'KYC Resubmission & Wealth Tier', count: 96, resolvedPct: 96.8 },
    { category: 'Transaction Dispute & Inquiries', count: 68, resolvedPct: 94.2 },
    { category: 'Bespoke Black Card Issuance', count: 48, resolvedPct: 100.0 },
    { category: 'Tax Document & Audit Export', count: 52, resolvedPct: 97.5 },
  ],
  tickets: [
    {
      ticketId: 'TKT-9021',
      customerName: 'Harrison Croft',
      accountTier: 'Private Wealth Tier 3',
      category: 'Bespoke Card Issuance',
      priority: 'Urgent',
      status: 'In Progress',
      assignedExecutive: 'Claire Montgomery',
      openedAt: '2026-10-08 06:30',
      slaTargetHours: 2,
      hoursOpen: 1.2,
      csatRating: 5.0,
    },
    {
      ticketId: 'TKT-9022',
      customerName: 'Victoria Habsburg',
      accountTier: 'Private Wealth Tier 3',
      category: 'High-Value Wire Authorization',
      priority: 'Urgent',
      status: 'Open',
      assignedExecutive: 'Claire Montgomery',
      openedAt: '2026-10-08 07:10',
      slaTargetHours: 1,
      hoursOpen: 0.5,
    },
    {
      ticketId: 'TKT-9023',
      customerName: 'Marcus Aurelius Sterling',
      accountTier: 'Gold Tier 1',
      category: 'KYC Resubmission',
      priority: 'High',
      status: 'In Progress',
      assignedExecutive: 'James Sterling',
      openedAt: '2026-10-08 04:15',
      slaTargetHours: 4,
      hoursOpen: 3.2,
    },
    {
      ticketId: 'TKT-9024',
      customerName: 'Kenji Takahashi',
      accountTier: 'Platinum Tier 2',
      category: 'Tax Document Export',
      priority: 'Medium',
      status: 'Resolved',
      assignedExecutive: 'Claire Montgomery',
      openedAt: '2026-10-07 14:00',
      slaTargetHours: 8,
      hoursOpen: 2.1,
      csatRating: 5.0,
    },
    {
      ticketId: 'TKT-9025',
      customerName: 'Genevieve Dupont',
      accountTier: 'Private Wealth Tier 3',
      category: 'Transaction Dispute',
      priority: 'Low',
      status: 'Resolved',
      assignedExecutive: 'James Sterling',
      openedAt: '2026-10-07 11:20',
      slaTargetHours: 12,
      hoursOpen: 4.0,
      csatRating: 4.8,
    },
    {
      ticketId: 'TKT-9026',
      customerName: 'Al-Mansoor Royal Trust',
      accountTier: 'Private Wealth Tier 3',
      category: 'High-Value Wire Authorization',
      priority: 'Urgent',
      status: 'Resolved',
      assignedExecutive: 'Claire Montgomery',
      openedAt: '2026-10-06 18:30',
      slaTargetHours: 1,
      hoursOpen: 0.8,
      csatRating: 5.0,
    },
  ],
};
