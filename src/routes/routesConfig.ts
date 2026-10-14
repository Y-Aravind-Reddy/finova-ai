import { UserRole } from '../data/finovaDatasets';

export interface RouteMeta {
  path: string;
  title: string;
  category?: string;
  allowedRoles: UserRole[];
  breadcrumb: string[];
}

export const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  SUPER_ADMIN: '/super-admin/dashboard',
  ADMIN: '/admin/dashboard',
  FINANCE_ANALYST: '/finance/dashboard',
  SUPPORT_EXECUTIVE: '/support/dashboard',
  CUSTOMER: '/customer/dashboard',
};

export const ROUTES: Record<string, RouteMeta> = {
  // ==========================================
  // SUPER ADMIN ROUTES
  // ==========================================
  '/super-admin/dashboard': {
    path: '/super-admin/dashboard',
    title: 'Executive Dashboard',
    category: 'Super Admin',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Executive Dashboard'],
  },
  '/super-admin/company-workspaces': {
    path: '/super-admin/company-workspaces',
    title: 'Company Workspaces & Tenants',
    category: 'Super Admin',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Company Workspaces & Tenants'],
  },
  '/super-admin/user-management': {
    path: '/super-admin/user-management',
    title: 'User Management',
    category: 'Super Admin',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'User Management'],
  },
  '/super-admin/rbac': {
    path: '/super-admin/rbac',
    title: 'Role Hierarchy & RBAC',
    category: 'Super Admin',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Role Hierarchy & RBAC'],
  },
  '/super-admin/system-configuration': {
    path: '/super-admin/system-configuration',
    title: 'System Configuration',
    category: 'Super Admin',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'System Configuration'],
  },
  '/super-admin/ai-configuration': {
    path: '/super-admin/ai-configuration',
    title: 'AI Configuration',
    category: 'Super Admin',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'AI Configuration'],
  },
  '/super-admin/audit-logs': {
    path: '/super-admin/audit-logs',
    title: 'Audit Logs',
    category: 'Super Admin',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Audit Logs'],
  },
  '/super-admin/enterprise-analytics': {
    path: '/super-admin/enterprise-analytics',
    title: 'Enterprise Analytics',
    category: 'Super Admin',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Enterprise Analytics'],
  },
  '/super-admin/reports': {
    path: '/super-admin/reports',
    title: 'Executive Reports',
    category: 'Super Admin',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Executive Reports'],
  },
  '/super-admin/profile': {
    path: '/super-admin/profile',
    title: 'Executive Profile',
    category: 'Super Admin',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Executive Profile'],
  },
  // Super Admin Platform Engines
  '/super-admin/ai-assistant': {
    path: '/super-admin/ai-assistant',
    title: 'Finova AI Assistant',
    category: 'Platform Engines',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Platform Engines', 'Finova AI Assistant'],
  },
  '/super-admin/document-ocr': {
    path: '/super-admin/document-ocr',
    title: 'Document OCR Intelligence',
    category: 'Platform Engines',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Platform Engines', 'Document OCR Intelligence'],
  },
  '/super-admin/transaction-classification': {
    path: '/super-admin/transaction-classification',
    title: 'Transaction Classification',
    category: 'Platform Engines',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Platform Engines', 'Transaction Classification'],
  },
  '/super-admin/kyc-verification': {
    path: '/super-admin/kyc-verification',
    title: 'KYC Verification',
    category: 'Platform Engines',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Platform Engines', 'KYC Verification'],
  },
  '/super-admin/fraud-aml': {
    path: '/super-admin/fraud-aml',
    title: 'Fraud Detection & AML',
    category: 'Platform Engines',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Platform Engines', 'Fraud Detection & AML'],
  },
  '/super-admin/case-management': {
    path: '/super-admin/case-management',
    title: 'Case Management',
    category: 'Platform Engines',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Platform Engines', 'Case Management'],
  },
  '/super-admin/excel-visualization': {
    path: '/super-admin/excel-visualization',
    title: 'Excel Data Visualization',
    category: 'Platform Engines',
    allowedRoles: ['SUPER_ADMIN'],
    breadcrumb: ['Finova AI', 'Super Admin', 'Platform Engines', 'Excel Data Visualization'],
  },

  // ==========================================
  // ADMIN ROUTES
  // ==========================================
  '/admin/dashboard': {
    path: '/admin/dashboard',
    title: 'Operations Dashboard',
    category: 'Admin',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Operations Dashboard'],
  },
  '/admin/user-management': {
    path: '/admin/user-management',
    title: 'Staff Management',
    category: 'Admin',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Staff Management'],
  },
  '/admin/operations-management': {
    path: '/admin/operations-management',
    title: 'Operations Management',
    category: 'Admin',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Operations Management'],
  },
  '/admin/customer-management': {
    path: '/admin/customer-management',
    title: 'Customer Management',
    category: 'Admin',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Customer Management'],
  },
  '/admin/reports': {
    path: '/admin/reports',
    title: 'Operations Reports',
    category: 'Admin',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Operations Reports'],
  },
  '/admin/profile': {
    path: '/admin/profile',
    title: 'Admin Profile',
    category: 'Admin',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Profile'],
  },
  // Admin Platform Engines
  '/admin/ai-assistant': {
    path: '/admin/ai-assistant',
    title: 'Finova AI Assistant',
    category: 'Platform Engines',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Platform Engines', 'Finova AI Assistant'],
  },
  '/admin/document-ocr': {
    path: '/admin/document-ocr',
    title: 'Document OCR Intelligence',
    category: 'Platform Engines',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Platform Engines', 'Document OCR Intelligence'],
  },
  '/admin/transaction-classification': {
    path: '/admin/transaction-classification',
    title: 'Transaction Classification',
    category: 'Platform Engines',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Platform Engines', 'Transaction Classification'],
  },
  '/admin/kyc-verification': {
    path: '/admin/kyc-verification',
    title: 'KYC Verification',
    category: 'Platform Engines',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Platform Engines', 'KYC Verification'],
  },
  '/admin/fraud-aml': {
    path: '/admin/fraud-aml',
    title: 'Fraud Detection & AML',
    category: 'Platform Engines',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Platform Engines', 'Fraud Detection & AML'],
  },
  '/admin/case-management': {
    path: '/admin/case-management',
    title: 'Case Management',
    category: 'Platform Engines',
    allowedRoles: ['ADMIN'],
    breadcrumb: ['Finova AI', 'Admin', 'Platform Engines', 'Case Management'],
  },

  // ==========================================
  // FINANCE ANALYST ROUTES
  // ==========================================
  '/finance/dashboard': {
    path: '/finance/dashboard',
    title: 'Financial Intelligence Dashboard',
    category: 'Finance Analyst',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Dashboard'],
  },
  '/finance/transaction-analytics': {
    path: '/finance/transaction-analytics',
    title: 'Transaction Analytics',
    category: 'Finance Analyst',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Transaction Analytics'],
  },
  '/finance/fraud-detection': {
    path: '/finance/fraud-detection',
    title: 'Fraud Detection',
    category: 'Finance Analyst',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Fraud Detection'],
  },
  '/finance/aml-monitoring': {
    path: '/finance/aml-monitoring',
    title: 'AML Monitoring',
    category: 'Finance Analyst',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'AML Monitoring'],
  },
  '/finance/kyc-verification': {
    path: '/finance/kyc-verification',
    title: 'KYC Verification',
    category: 'Finance Analyst',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'KYC Verification'],
  },
  '/finance/risk-scoring': {
    path: '/finance/risk-scoring',
    title: 'Risk Scoring',
    category: 'Finance Analyst',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Risk Scoring'],
  },
  '/finance/customer-financial-insights': {
    path: '/finance/customer-financial-insights',
    title: 'Customer Financial Insights',
    category: 'Finance Analyst',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Customer Financial Insights'],
  },
  '/finance/reports': {
    path: '/finance/reports',
    title: 'Finance Regulatory Reports',
    category: 'Finance Analyst',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Regulatory Reports'],
  },
  '/finance/profile': {
    path: '/finance/profile',
    title: 'Analyst Profile',
    category: 'Finance Analyst',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Profile'],
  },
  // Finance Analyst Platform Engines
  '/finance/ai-assistant': {
    path: '/finance/ai-assistant',
    title: 'Finova AI Assistant',
    category: 'Platform Engines',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Platform Engines', 'Finova AI Assistant'],
  },
  '/finance/transaction-classification': {
    path: '/finance/transaction-classification',
    title: 'Transaction Classification',
    category: 'Platform Engines',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Platform Engines', 'Transaction Classification'],
  },
  '/finance/fraud-aml': {
    path: '/finance/fraud-aml',
    title: 'Fraud Detection & AML',
    category: 'Platform Engines',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Platform Engines', 'Fraud Detection & AML'],
  },
  '/finance/excel-visualization': {
    path: '/finance/excel-visualization',
    title: 'Excel Data Visualization',
    category: 'Platform Engines',
    allowedRoles: ['FINANCE_ANALYST'],
    breadcrumb: ['Finova AI', 'Finance Analyst', 'Platform Engines', 'Excel Data Visualization'],
  },

  // ==========================================
  // SUPPORT EXECUTIVE ROUTES
  // ==========================================
  '/support/dashboard': {
    path: '/support/dashboard',
    title: 'Support Operations Dashboard',
    category: 'Support Executive',
    allowedRoles: ['SUPPORT_EXECUTIVE'],
    breadcrumb: ['Finova AI', 'Support Executive', 'Dashboard'],
  },
  '/support/tickets': {
    path: '/support/tickets',
    title: 'Customer Support Tickets',
    category: 'Support Executive',
    allowedRoles: ['SUPPORT_EXECUTIVE'],
    breadcrumb: ['Finova AI', 'Support Executive', 'Customer Support Tickets'],
  },
  '/support/customer-queries': {
    path: '/support/customer-queries',
    title: 'Customer Queries',
    category: 'Support Executive',
    allowedRoles: ['SUPPORT_EXECUTIVE'],
    breadcrumb: ['Finova AI', 'Support Executive', 'Customer Queries'],
  },
  '/support/complaint-resolution': {
    path: '/support/complaint-resolution',
    title: 'Complaint Resolution',
    category: 'Support Executive',
    allowedRoles: ['SUPPORT_EXECUTIVE'],
    breadcrumb: ['Finova AI', 'Support Executive', 'Complaint Resolution'],
  },
  '/support/followups': {
    path: '/support/followups',
    title: 'Client Follow-Ups',
    category: 'Support Executive',
    allowedRoles: ['SUPPORT_EXECUTIVE'],
    breadcrumb: ['Finova AI', 'Support Executive', 'Follow-Ups'],
  },
  '/support/case-management': {
    path: '/support/case-management',
    title: 'Case Management',
    category: 'Support Executive',
    allowedRoles: ['SUPPORT_EXECUTIVE'],
    breadcrumb: ['Finova AI', 'Support Executive', 'Case Management'],
  },
  '/support/reports': {
    path: '/support/reports',
    title: 'Support SLA Reports',
    category: 'Support Executive',
    allowedRoles: ['SUPPORT_EXECUTIVE'],
    breadcrumb: ['Finova AI', 'Support Executive', 'Support Reports'],
  },
  '/support/profile': {
    path: '/support/profile',
    title: 'Support Executive Profile',
    category: 'Support Executive',
    allowedRoles: ['SUPPORT_EXECUTIVE'],
    breadcrumb: ['Finova AI', 'Support Executive', 'Profile'],
  },
  // Support Executive Platform Engines
  '/support/ai-assistant': {
    path: '/support/ai-assistant',
    title: 'Finova AI Assistant',
    category: 'Platform Engines',
    allowedRoles: ['SUPPORT_EXECUTIVE'],
    breadcrumb: ['Finova AI', 'Support Executive', 'Platform Engines', 'Finova AI Assistant'],
  },
  '/support/document-ocr': {
    path: '/support/document-ocr',
    title: 'Document OCR Intelligence',
    category: 'Platform Engines',
    allowedRoles: ['SUPPORT_EXECUTIVE'],
    breadcrumb: ['Finova AI', 'Support Executive', 'Platform Engines', 'Document OCR Intelligence'],
  },

  // ==========================================
  // CUSTOMER ROUTES
  // ==========================================
  '/customer/dashboard': {
    path: '/customer/dashboard',
    title: 'Private Wealth Dashboard',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'Dashboard'],
  },
  '/customer/profile': {
    path: '/customer/profile',
    title: 'Sovereign Profile',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'Sovereign Profile'],
  },
  '/customer/accounts': {
    path: '/customer/accounts',
    title: 'Multi-Asset Accounts',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'Accounts & Balances'],
  },
  '/customer/transactions': {
    path: '/customer/transactions',
    title: 'Custody Transactions',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'Custody Transactions'],
  },
  '/customer/cards': {
    path: '/customer/cards',
    title: 'Sovereign Cards',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'Sovereign Cards'],
  },
  '/customer/kyc': {
    path: '/customer/kyc',
    title: 'KYC Status & Vault',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'KYC Status'],
  },
  '/customer/documents': {
    path: '/customer/documents',
    title: 'Sovereign Document Vault',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'Document Vault'],
  },
  '/customer/ai-assistant': {
    path: '/customer/ai-assistant',
    title: 'AI Financial Assistant',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'AI Financial Assistant'],
  },
  '/customer/support': {
    path: '/customer/support',
    title: 'Concierge Support Center',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'Support Center'],
  },
  '/customer/notifications': {
    path: '/customer/notifications',
    title: 'Security Notifications',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'Notifications'],
  },
  '/customer/settings': {
    path: '/customer/settings',
    title: 'Account & Security Settings',
    category: 'Customer',
    allowedRoles: ['CUSTOMER'],
    breadcrumb: ['Finova AI', 'Private Wealth', 'Settings'],
  },
};

/**
 * Checks whether a given role is allowed to access the specified route path.
 */
export function isRouteAllowed(path: string, role: UserRole): boolean {
  const meta = ROUTES[path];
  if (!meta) {
    // If it's a sub-path or unknown, check by prefix
    if (path.startsWith('/super-admin/')) return role === 'SUPER_ADMIN';
    if (path.startsWith('/admin/')) return role === 'ADMIN';
    if (path.startsWith('/finance/')) return role === 'FINANCE_ANALYST';
    if (path.startsWith('/support/')) return role === 'SUPPORT_EXECUTIVE';
    if (path.startsWith('/customer/')) return role === 'CUSTOMER';
    return false;
  }
  return meta.allowedRoles.includes(role);
}

/**
 * Returns metadata for a route or synthesizes one based on prefix.
 */
export function getRouteMeta(path: string, userRole?: UserRole): RouteMeta {
  if (ROUTES[path]) {
    return ROUTES[path];
  }

  // Synthesize sensible fallback meta
  const parts = path.split('/').filter(Boolean);
  const title = parts[parts.length - 1]
    ? parts[parts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Dashboard';

  return {
    path,
    title,
    allowedRoles: userRole ? [userRole] : ['CUSTOMER'],
    breadcrumb: ['Finova AI', userRole ? userRole.replace('_', ' ') : 'Portal', title],
  };
}
