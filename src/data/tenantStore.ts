import { UserRole } from './finovaDatasets';
import { convertToInr, convertToUsd } from '../services/currencyService';

export interface TenantWorkspace {
  id: string; // e.g. 'tenant_apex_bank'
  name: string; // 'Apex Global Bank'
  shortName: string; // 'Apex Bank'
  type: 'Commercial Bank' | 'NBFC & Lending' | 'Wealth Management' | 'Credit Union' | 'Digital Neo-Bank';
  status: 'Active' | 'Suspended' | 'Provisioning' | 'Pending Review';
  plan: 'Enterprise Sovereign' | 'Growth SaaS' | 'Starter Tier';
  mrr: number; // monthly subscription
  currency: 'USD' | 'GBP' | 'EUR' | 'CHF' | 'SGD' | 'INR';
  currencySymbol: string;
  headquarters: string;
  licenseNo: string;
  primaryContact: {
    name: string;
    email: string;
    phone: string;
  };
  adminUserId: string; // Initial Company Admin ID
  adminName: string;
  adminEmail: string;
  createdDate: string;
  usersCount: number;
  transactionVolumeYTD: number;
  complianceScore: number; // e.g. 99.4%
  activeEngines: {
    aiAssistant: boolean;
    documentOcr: boolean;
    transactionClassification: boolean;
    kycVerification: boolean;
    fraudAml: boolean;
    caseManagement: boolean;
    excelVisualization: boolean;
  };
  notes?: string;
}

export const SEEDED_TENANTS: TenantWorkspace[] = [
  {
    id: 'tenant_apex_bank',
    name: 'Apex Global Bank',
    shortName: 'Apex Bank',
    type: 'Commercial Bank',
    status: 'Active',
    plan: 'Enterprise Sovereign',
    mrr: 45000,
    currency: 'USD',
    currencySymbol: '$',
    headquarters: 'New York & Zurich',
    licenseNo: 'OCC / FINMA Chartered Bank #US-NY-88910',
    primaryContact: {
      name: 'Eleanor Sterling',
      email: 'eleanor.sterling@apexbank.com',
      phone: '+1 (212) 555-0192',
    },
    adminUserId: 'USR-1002',
    adminName: 'Eleanor Sterling',
    adminEmail: 'admin@finova.ai',
    createdDate: '2023-01-10',
    usersCount: 0,
    transactionVolumeYTD: 0,
    complianceScore: 99.8,
    activeEngines: {
      aiAssistant: true,
      documentOcr: true,
      transactionClassification: true,
      kycVerification: true,
      fraudAml: true,
      caseManagement: true,
      excelVisualization: true,
    },
    notes: 'Tier-1 Wall Street clearing bank with prime brokerage and SWIFT GPI rails.',
  },
  {
    id: 'tenant_crest_capital',
    name: 'Crestview Finance NBFC',
    shortName: 'Crestview NBFC',
    type: 'NBFC & Lending',
    status: 'Active',
    plan: 'Growth SaaS',
    mrr: 28500,
    currency: 'GBP',
    currencySymbol: '£',
    headquarters: 'London & Edinburgh',
    licenseNo: 'FCA NBFC Reg #UK-CR-55421',
    primaryContact: {
      name: 'Marcus Brody',
      email: 'marcus.brody@crestviewfinance.com',
      phone: '+44 20 7946 0884',
    },
    adminUserId: 'USR-2001',
    adminName: 'Marcus Brody',
    adminEmail: 'admin@crestviewfinance.com',
    createdDate: '2023-06-20',
    usersCount: 0,
    transactionVolumeYTD: 0,
    complianceScore: 99.4,
    activeEngines: {
      aiAssistant: true,
      documentOcr: true,
      transactionClassification: true,
      kycVerification: true,
      fraudAml: true,
      caseManagement: true,
      excelVisualization: false,
    },
    notes: 'Non-Banking Financial Company specializing in commercial credit & structured bridge loans.',
  },
  {
    id: 'tenant_vanguard_wealth',
    name: 'Vanguard Wealth Partners',
    shortName: 'Vanguard Wealth',
    type: 'Wealth Management',
    status: 'Active',
    plan: 'Enterprise Sovereign',
    mrr: 38000,
    currency: 'EUR',
    currencySymbol: '€',
    headquarters: 'Geneva & Paris',
    licenseNo: 'FINMA Asset Manager #CH-GE-1192',
    primaryContact: {
      name: 'Catherine Duval',
      email: 'catherine.duval@vanguardwealth.eu',
      phone: '+41 22 730 4410',
    },
    adminUserId: 'USR-3001',
    adminName: 'Catherine Duval',
    adminEmail: 'admin@vanguardwealth.eu',
    createdDate: '2023-11-05',
    usersCount: 0,
    transactionVolumeYTD: 0,
    complianceScore: 99.9,
    activeEngines: {
      aiAssistant: true,
      documentOcr: true,
      transactionClassification: true,
      kycVerification: true,
      fraudAml: true,
      caseManagement: true,
      excelVisualization: true,
    },
    notes: 'Single and multi-family office private wealth custodian in Geneva.',
  },
  {
    id: 'tenant_solaris_credit',
    name: 'Solaris Digital Credit Union',
    shortName: 'Solaris Credit',
    type: 'Digital Neo-Bank',
    status: 'Pending Review',
    plan: 'Starter Tier',
    mrr: 12000,
    currency: 'EUR',
    currencySymbol: '€',
    headquarters: 'Berlin & Munich',
    licenseNo: 'BaFin Digital Lending License #DE-BE-3310-PND',
    primaryContact: {
      name: 'Hans Weber',
      email: 'hans.weber@solariscredit.de',
      phone: '+49 30 8820 9140',
    },
    adminUserId: 'USR-4001',
    adminName: 'Hans Weber',
    adminEmail: 'admin@solariscredit.de',
    createdDate: '2024-03-01',
    usersCount: 0,
    transactionVolumeYTD: 0,
    complianceScore: 97.1,
    activeEngines: {
      aiAssistant: true,
      documentOcr: false,
      transactionClassification: true,
      kycVerification: true,
      fraudAml: false,
      caseManagement: false,
      excelVisualization: false,
    },
    notes: 'Retail neo-credit institution currently undergoing final BaFin compliance onboarding audit.',
  },
];

const STORAGE_TENANTS_KEY = 'finova_ai_tenants_store_v1';

export function getStoredTenants(): TenantWorkspace[] {
  try {
    const raw = localStorage.getItem(STORAGE_TENANTS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_TENANTS_KEY, JSON.stringify(SEEDED_TENANTS));
      return SEEDED_TENANTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_TENANTS_KEY, JSON.stringify(SEEDED_TENANTS));
      return SEEDED_TENANTS;
    }
    return parsed;
  } catch {
    return SEEDED_TENANTS;
  }
}

export function saveStoredTenants(tenants: TenantWorkspace[]): void {
  try {
    localStorage.setItem(STORAGE_TENANTS_KEY, JSON.stringify(tenants));
  } catch (err) {
    console.error('Failed to save tenants to local storage', err);
  }
}

export function getTenantById(tenantId?: string | null): TenantWorkspace | undefined {
  if (!tenantId || tenantId === 'platform_root' || tenantId === 'ALL') return undefined;
  const list = getStoredTenants();
  return list.find((t) => t.id === tenantId);
}

export function createTenant(data: Partial<TenantWorkspace>): TenantWorkspace {
  const current = getStoredTenants();
  const rawId = data.name
    ? 'tenant_' + data.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 18)
    : `tenant_${Date.now().toString(36)}`;

  // Ensure unique ID
  const existingIds = new Set(current.map((t) => t.id));
  let finalId = rawId;
  let counter = 1;
  while (existingIds.has(finalId)) {
    finalId = `${rawId}_${counter++}`;
  }

  const newTenant: TenantWorkspace = {
    id: finalId,
    name: data.name?.trim() || 'New Financial Workspace',
    shortName: data.shortName?.trim() || data.name?.trim().split(' ')[0] || 'New Bank',
    type: data.type || 'Commercial Bank',
    status: data.status || 'Active',
    plan: data.plan || 'Growth SaaS',
    mrr: data.mrr || (data.plan === 'Enterprise Sovereign' ? 45000 : data.plan === 'Starter Tier' ? 12000 : 28500),
    currency: data.currency || 'USD',
    currencySymbol: data.currency === 'GBP' ? '£' : data.currency === 'EUR' ? '€' : data.currency === 'CHF' ? 'CHF ' : '$',
    headquarters: data.headquarters || 'Zurich & London',
    licenseNo: data.licenseNo || `FINOVA-SaaS-REG-${Math.floor(10000 + Math.random() * 90000)}`,
    primaryContact: {
      name: data.primaryContact?.name || data.adminName || 'Chief Operating Officer',
      email: data.primaryContact?.email || data.adminEmail || 'admin@newbank.com',
      phone: data.primaryContact?.phone || '+1 (555) 019-4820',
    },
    adminUserId: data.adminUserId || `USR-${Math.floor(5000 + Math.random() * 4000)}`,
    adminName: data.adminName || 'Lead Company Admin',
    adminEmail: data.adminEmail || 'admin@newbank.com',
    createdDate: new Date().toISOString().split('T')[0],
    usersCount: data.usersCount || 1,
    transactionVolumeYTD: data.transactionVolumeYTD || 0,
    complianceScore: data.complianceScore || 100,
    activeEngines: data.activeEngines || {
      aiAssistant: true,
      documentOcr: true,
      transactionClassification: true,
      kycVerification: true,
      fraudAml: true,
      caseManagement: true,
      excelVisualization: true,
    },
    notes: data.notes || 'Newly onboarded tenant company workspace.',
  };

  const updated = [newTenant, ...current];
  saveStoredTenants(updated);
  return newTenant;
}

export function updateTenant(tenantId: string, updates: Partial<TenantWorkspace>): TenantWorkspace | null {
  const current = getStoredTenants();
  const idx = current.findIndex((t) => t.id === tenantId);
  if (idx === -1) return null;

  const updatedTenant: TenantWorkspace = {
    ...current[idx],
    ...updates,
  };

  current[idx] = updatedTenant;
  saveStoredTenants(current);
  return updatedTenant;
}

export function toggleTenantStatus(tenantId: string): TenantWorkspace | null {
  const current = getStoredTenants();
  const target = current.find((t) => t.id === tenantId);
  if (!target) return null;

  const nextStatus = target.status === 'Active' ? 'Suspended' : 'Active';
  return updateTenant(tenantId, { status: nextStatus });
}

export interface PlatformSaaSMetrics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalMrr: number;
  totalArr: number;
  totalMrrInr: number;
  totalArrInr: number;
  totalMrrUsd: number; // Backwards-compatible field
  totalArrUsd: number; // Backwards-compatible field
  aggregateUsers: number;
  aggregateVolumeYTD: number;
  aggregateVolumeYtdInr: number;
  aggregateVolumeYtdUsd: number; // Backwards-compatible field
  mrrByCurrency: Record<string, number>;
  platformUptime: number;
  averageComplianceScore: number;
  systemUptime: string;
  aiQueriesToday: number;
  apiErrorRate: string;
  reportingBaseCurrency: 'INR';
}

export function getPlatformSaaSMetrics(): PlatformSaaSMetrics {
  const tenants = getStoredTenants();
  const activeTenants = tenants.filter((t) => t.status === 'Active');
  const suspendedTenants = tenants.filter((t) => t.status === 'Suspended');

  let totalMrrInr = 0;
  let aggregateVolumeYtdInr = 0;
  const mrrByCurrency: Record<string, number> = {};

  tenants.forEach((t) => {
    if (t.status === 'Active') {
      const convMrr = convertToInr(t.mrr, t.currency);
      totalMrrInr += convMrr.amountInr;
      mrrByCurrency[t.currency] = (mrrByCurrency[t.currency] || 0) + t.mrr;
    }
    const convVol = convertToInr(t.transactionVolumeYTD, t.currency);
    aggregateVolumeYtdInr += convVol.amountInr;
  });

  totalMrrInr = Math.round(totalMrrInr * 100) / 100;
  aggregateVolumeYtdInr = Math.round(aggregateVolumeYtdInr * 100) / 100;
  const totalArrInr = Math.round(totalMrrInr * 12 * 100) / 100;

  // Backwards-compatible USD calculations
  const usdRate = 84.070000;
  const totalMrrUsd = Math.round((totalMrrInr / usdRate) * 100) / 100;
  const totalArrUsd = Math.round((totalArrInr / usdRate) * 100) / 100;
  const aggregateVolumeYtdUsd = Math.round((aggregateVolumeYtdInr / usdRate) * 100) / 100;

  const totalMrr = tenants.reduce((acc, t) => acc + (t.status === 'Active' ? t.mrr : 0), 0);
  const totalArr = totalMrr * 12;
  const aggregateUsers = tenants.reduce((acc, t) => acc + t.usersCount, 0);
  const aggregateVolumeYTD = tenants.reduce((acc, t) => acc + t.transactionVolumeYTD, 0);
  const avgCompliance = tenants.length
    ? +(tenants.reduce((acc, t) => acc + t.complianceScore, 0) / tenants.length).toFixed(1)
    : 99.5;

  return {
    totalTenants: tenants.length,
    activeTenants: activeTenants.length,
    suspendedTenants: suspendedTenants.length,
    totalMrr,
    totalArr,
    totalMrrInr,
    totalArrInr,
    totalMrrUsd,
    totalArrUsd,
    aggregateUsers,
    aggregateVolumeYTD,
    aggregateVolumeYtdInr,
    aggregateVolumeYtdUsd,
    mrrByCurrency,
    platformUptime: 99.992,
    averageComplianceScore: avgCompliance,
    systemUptime: '99.992%',
    aiQueriesToday: 34280,
    apiErrorRate: '0.008%',
    reportingBaseCurrency: 'INR',
  };
}

