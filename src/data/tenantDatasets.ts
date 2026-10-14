import {
  CustomerTransaction,
  CustomerDocument,
  CustomerDataset,
  FinanceFraudTransaction,
  SupportTicket,
  UserAccount,
  AdminDataset,
  FinanceAnalystDataset,
  SupportDataset,
} from './finovaDatasets';

/* ==========================================================
   TENANT-ISOLATED DATA COLLECTIONS
   ========================================================== */

// 1. APEX GLOBAL BANK (COMPANY A - tenant_apex_bank)
export const APEX_TRANSACTIONS: CustomerTransaction[] = [
  {
    id: 'TXN-APX-701',
    date: '2026-10-07',
    merchant: 'Goldman Sachs Institutional Prime',
    category: 'Securities & Equities',
    amount: 245000.0,
    type: 'Debit',
    status: 'Settled',
    referenceNo: 'GS-PRM-89102-USD',
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
  {
    id: 'TXN-APX-702',
    date: '2026-10-05',
    merchant: 'Blackstone Strategic Opportunities VI',
    category: 'Private Equity',
    amount: 150000.0,
    type: 'Debit',
    status: 'Settled',
    referenceNo: 'BX-SOF6-4419-CALL',
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
  {
    id: 'TXN-APX-703',
    date: '2026-10-04',
    merchant: 'Sotheby’s International Realty Escrow',
    category: 'Prime Real Estate',
    amount: 85000.0,
    type: 'Debit',
    status: 'Escrow Secured',
    referenceNo: 'SOTH-ESC-00912-CH',
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
  {
    id: 'TXN-APX-704',
    date: '2026-10-02',
    merchant: 'US Treasury 6-Month T-Bill Coupon',
    category: 'Treasury & Yield',
    amount: 42800.0,
    type: 'Credit',
    status: 'Settled',
    referenceNo: 'UST-CPN-9981-DEP',
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
  {
    id: 'TXN-APX-705',
    date: '2026-09-29',
    merchant: 'NetJets European Aviation Charter',
    category: 'Private Jet Concierge',
    amount: 28400.0,
    type: 'Debit',
    status: 'Settled',
    referenceNo: 'NJ-EUR-7721-FLT',
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
];

export const APEX_FRAUD_TRANSACTIONS: FinanceFraudTransaction[] = [
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
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
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
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
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
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
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
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
];

export const APEX_TICKETS: SupportTicket[] = [
  {
    ticketId: 'TKT-APX-9021',
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
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
  {
    ticketId: 'TKT-APX-9022',
    customerName: 'Victoria Habsburg',
    accountTier: 'Private Wealth Tier 3',
    category: 'High-Value Wire Authorization',
    priority: 'Urgent',
    status: 'Open',
    assignedExecutive: 'Claire Montgomery',
    openedAt: '2026-10-08 07:10',
    slaTargetHours: 1,
    hoursOpen: 0.5,
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
  },
];

// 2. CRESTVIEW FINANCE NBFC (COMPANY B - tenant_crest_capital)
export const CRESTVIEW_TRANSACTIONS: CustomerTransaction[] = [
  {
    id: 'TXN-CRV-801',
    date: '2026-10-08',
    merchant: 'Barclays Corporate Structured Loan Facility',
    category: 'Private Equity',
    amount: 480000.0,
    type: 'Debit',
    status: 'Settled',
    referenceNo: 'BARC-ST-8812-GBP',
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
  },
  {
    id: 'TXN-CRV-802',
    date: '2026-10-06',
    merchant: 'UK Debt Management Office Gilt Auction',
    category: 'Treasury & Yield',
    amount: 195000.0,
    type: 'Credit',
    status: 'Settled',
    referenceNo: 'DMO-GLT-4401-GBP',
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
  },
  {
    id: 'TXN-CRV-803',
    date: '2026-10-03',
    merchant: 'Canary Wharf Prime Commercial Collateral Escrow',
    category: 'Prime Real Estate',
    amount: 320000.0,
    type: 'Debit',
    status: 'Escrow Secured',
    referenceNo: 'CWH-ESC-7729-LON',
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
  },
  {
    id: 'TXN-CRV-804',
    date: '2026-09-28',
    merchant: 'Schroders European Senior Secured Lending Fund',
    category: 'Securities & Equities',
    amount: 110000.0,
    type: 'Credit',
    status: 'Settled',
    referenceNo: 'SCHR-SSL-1092-GBP',
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
  },
];

export const CRESTVIEW_FRAUD_TRANSACTIONS: FinanceFraudTransaction[] = [
  {
    id: 'TXN-FRAUD-CRV-201',
    timestamp: '2026-10-08 05:40:11',
    customerName: 'Caledonian Maritime Asset HoldCo',
    customerId: 'CRV-CUST-5510',
    amount: 540000.0,
    currency: 'GBP',
    riskScore: 78,
    amlFlag: 'Rapid Layering',
    status: 'Flagged',
    location: 'Edinburgh -> Isle of Man Branch',
    paymentChannel: 'CHAPS London',
    ruleTriggered: 'NBFC-AML-R4: Accelerated drawdown against pending security deed',
    aiConfidencePct: 94.6,
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
  },
  {
    id: 'TXN-FRAUD-CRV-202',
    timestamp: '2026-10-07 19:15:30',
    customerName: 'Elena Rostova',
    customerId: 'CRV-CUST-7721',
    amount: 185000.0,
    currency: 'GBP',
    riskScore: 12,
    amlFlag: 'Clean / Verified',
    status: 'Cleared',
    location: 'London Mayfair (Coutts Clearing)',
    paymentChannel: 'CHAPS London',
    ruleTriggered: 'High-net-worth liquidity disbursement: fully collateralized',
    aiConfidencePct: 99.4,
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
  },
];

export const CRESTVIEW_TICKETS: SupportTicket[] = [
  {
    ticketId: 'TKT-CRV-441',
    customerName: 'Elena Rostova',
    accountTier: 'Private Wealth Tier 3',
    category: 'High-Value Wire Authorization',
    priority: 'Urgent',
    status: 'In Progress',
    assignedExecutive: 'David Vance',
    openedAt: '2026-10-08 08:15',
    slaTargetHours: 2,
    hoursOpen: 0.9,
    csatRating: 5.0,
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
  },
  {
    ticketId: 'TKT-CRV-442',
    customerName: 'Lothian Commercial Partners Ltd',
    accountTier: 'Platinum Tier 2',
    category: 'Tax Document Export',
    priority: 'Medium',
    status: 'Resolved',
    assignedExecutive: 'David Vance',
    openedAt: '2026-10-07 11:00',
    slaTargetHours: 6,
    hoursOpen: 2.4,
    csatRating: 4.9,
    tenantId: 'tenant_crest_capital',
    tenantName: 'Crestview Finance NBFC',
  },
];

// 3. VANGUARD WEALTH PARTNERS (COMPANY C - tenant_vanguard_wealth)
export const VANGUARD_TRANSACTIONS: CustomerTransaction[] = [
  {
    id: 'TXN-VGW-901',
    date: '2026-10-08',
    merchant: 'Pictet & Cie Sovereign Fixed Income Custody',
    category: 'Securities & Equities',
    amount: 380000.0,
    type: 'Debit',
    status: 'Settled',
    referenceNo: 'PIC-CH-9941-EUR',
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
  },
  {
    id: 'TXN-VGW-902',
    date: '2026-10-06',
    merchant: 'LGT Private Banking Alpine Multi-Asset Mandate',
    category: 'Treasury & Yield',
    amount: 220000.0,
    type: 'Credit',
    status: 'Settled',
    referenceNo: 'LGT-MAM-3301-EUR',
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
  },
  {
    id: 'TXN-VGW-903',
    date: '2026-10-02',
    merchant: 'St. Moritz Alpine Estate Escrow Deposit',
    category: 'Prime Real Estate',
    amount: 510000.0,
    type: 'Debit',
    status: 'Escrow Secured',
    referenceNo: 'STM-ESC-8812-CHF',
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
  },
];

export const VANGUARD_FRAUD_TRANSACTIONS: FinanceFraudTransaction[] = [
  {
    id: 'TXN-FRAUD-VGW-301',
    timestamp: '2026-10-08 06:12:00',
    customerName: 'Lucian Sterling',
    customerId: 'VGW-CUST-6610',
    amount: 380000.0,
    currency: 'EUR',
    riskScore: 11,
    amlFlag: 'Clean / Verified',
    status: 'Cleared',
    location: 'Geneva (Banque Cantonale)',
    paymentChannel: 'SWIFT GPI',
    ruleTriggered: 'Family office portfolio rebalancing: source verified',
    aiConfidencePct: 99.7,
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
  },
  {
    id: 'TXN-FRAUD-VGW-302',
    timestamp: '2026-10-07 22:30:15',
    customerName: 'Helvetia Trust Holdings Anstalt',
    customerId: 'VGW-CUST-4412',
    amount: 920000.0,
    currency: 'EUR',
    riskScore: 84,
    amlFlag: 'Sanctioned IP Cluster',
    status: 'In Review',
    location: 'Vaduz -> Nicosia Direct Tunnel',
    paymentChannel: 'SWIFT GPI',
    ruleTriggered: 'AML-V12: Cross-border high value wire from newly modified beneficial owner',
    aiConfidencePct: 95.8,
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
  },
];

export const VANGUARD_TICKETS: SupportTicket[] = [
  {
    ticketId: 'TKT-VGW-701',
    customerName: 'Lucian Sterling',
    accountTier: 'Private Wealth Tier 3',
    category: 'High-Value Wire Authorization',
    priority: 'Urgent',
    status: 'In Progress',
    assignedExecutive: 'Amara Okafor',
    openedAt: '2026-10-08 07:45',
    slaTargetHours: 2,
    hoursOpen: 0.6,
    csatRating: 5.0,
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
  },
  {
    ticketId: 'TKT-VGW-702',
    customerName: 'Baroness Beatrix Von Weber',
    accountTier: 'Private Wealth Tier 3',
    category: 'Bespoke Card Issuance',
    priority: 'High',
    status: 'Resolved',
    assignedExecutive: 'Amara Okafor',
    openedAt: '2026-10-07 15:20',
    slaTargetHours: 4,
    hoursOpen: 1.8,
    csatRating: 5.0,
    tenantId: 'tenant_vanguard_wealth',
    tenantName: 'Vanguard Wealth Partners',
  },
];

/* ==========================================================
   TENANT DATA RESOLUTION HELPER
   ========================================================== */

export function getTransactionsForTenant(tenantId?: string | null): CustomerTransaction[] {
  if (!tenantId || tenantId === 'platform_root' || tenantId === 'ALL') {
    return [...APEX_TRANSACTIONS, ...CRESTVIEW_TRANSACTIONS, ...VANGUARD_TRANSACTIONS];
  }
  if (tenantId === 'tenant_crest_capital') return CRESTVIEW_TRANSACTIONS;
  if (tenantId === 'tenant_vanguard_wealth') return VANGUARD_TRANSACTIONS;
  return APEX_TRANSACTIONS;
}

export function getFraudTransactionsForTenant(tenantId?: string | null): FinanceFraudTransaction[] {
  if (!tenantId || tenantId === 'platform_root' || tenantId === 'ALL') {
    return [...APEX_FRAUD_TRANSACTIONS, ...CRESTVIEW_FRAUD_TRANSACTIONS, ...VANGUARD_FRAUD_TRANSACTIONS];
  }
  if (tenantId === 'tenant_crest_capital') return CRESTVIEW_FRAUD_TRANSACTIONS;
  if (tenantId === 'tenant_vanguard_wealth') return VANGUARD_FRAUD_TRANSACTIONS;
  return APEX_FRAUD_TRANSACTIONS;
}

export function getTicketsForTenant(tenantId?: string | null): SupportTicket[] {
  if (!tenantId || tenantId === 'platform_root' || tenantId === 'ALL') {
    return [...APEX_TICKETS, ...CRESTVIEW_TICKETS, ...VANGUARD_TICKETS];
  }
  if (tenantId === 'tenant_crest_capital') return CRESTVIEW_TICKETS;
  if (tenantId === 'tenant_vanguard_wealth') return VANGUARD_TICKETS;
  return APEX_TICKETS;
}
