import React, { useState, useEffect } from 'react';
import { FinovaLogo } from './FinovaLogo';
import { UserAccount, UserRole } from '../data/finovaDatasets';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Settings,
  FileText,
  Activity,
  Bot,
  Cpu,
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
  CreditCard,
  Wallet,
  ShieldAlert,
  Headphones,
  FileCheck2,
  FolderGit2,
  MessageSquare,
  AlertTriangle,
  Bell,
  Sliders,
  Database,
  BarChart3,
  Search,
  Lock,
  User,
  FileSearch,
  Tag,
  Table2,
  TrendingUp,
  Clock,
  Layers,
  Sparkles,
  Building2,
  Globe,
} from 'lucide-react';

interface RoleSidebarProps {
  currentUser: UserAccount;
  currentRoute: string;
  onNavigate: (route: string) => void;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const RoleSidebar: React.FC<RoleSidebarProps> = ({
  currentUser,
  currentRoute,
  onNavigate,
  onLogout,
  isOpenMobile,
  onCloseMobile,
}) => {
  const role = currentUser.role;

  // Auto-expand submenus if currentRoute is within that submenu
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    userManagement: true,
    systemConfig: true,
    platformEngines: true,
  });

  useEffect(() => {
    // If active route is in platform engines, keep platformEngines open
    if (
      currentRoute.includes('ai-assistant') ||
      currentRoute.includes('document-ocr') ||
      currentRoute.includes('transaction-classification') ||
      currentRoute.includes('kyc-verification') ||
      currentRoute.includes('fraud-aml') ||
      currentRoute.includes('case-management') ||
      currentRoute.includes('excel-visualization')
    ) {
      setOpenSections((prev) => ({ ...prev, platformEngines: true }));
    }
    // If active route is in user management, keep userManagement open
    if (currentRoute.includes('user-management')) {
      setOpenSections((prev) => ({ ...prev, userManagement: true }));
    }
    // If active route is in system configuration, keep systemConfig open
    if (currentRoute.includes('system-configuration')) {
      setOpenSections((prev) => ({ ...prev, systemConfig: true }));
    }
  }, [currentRoute]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleItemClick = (route: string) => {
    onNavigate(route);
    onCloseMobile();
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return { label: 'SUPER ADMIN', color: 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A]' };
      case 'ADMIN':
        return { label: 'OPERATIONS ADMIN', color: 'bg-[#262626] text-[#E6C78B] border border-[#D4A017]/60' };
      case 'FINANCE_ANALYST':
        return { label: 'FINANCE ANALYST', color: 'bg-[#262626] text-[#FAF7F0] border border-[#B87333]/80' };
      case 'SUPPORT_EXECUTIVE':
        return { label: 'SUPPORT EXECUTIVE', color: 'bg-[#262626] text-[#E6C78B] border border-[#3A3A3A]' };
      case 'CUSTOMER':
        return { label: 'PRIVATE WEALTH', color: 'bg-[#262626] text-[#FAF7F0] border border-[#D4A017]/40' };
    }
  };

  const roleBadge = getRoleBadge(role);

  const renderNavItem = (
    label: string,
    route: string,
    icon: React.ReactNode,
    badge?: string
  ) => {
    const isActive = currentRoute === route;
    return (
      <button
        key={route}
        onClick={() => handleItemClick(route)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-mono text-xs transition-all ${
          isActive
            ? 'bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold shadow-[0_0_15px_rgba(212,160,23,0.35)]'
            : 'text-[#FAF7F0] hover:bg-[#262626] hover:text-[#E6C78B]'
        }`}
      >
        <div className="flex items-center gap-3 truncate">
          <span className={isActive ? 'text-[#1A1A1A]' : 'text-[#D4A017]'}>{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        {badge && (
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
              isActive ? 'bg-[#121212] text-[#E6C78B]' : 'bg-[#262626] text-[#D4A017] border border-[#3A3A3A]'
            }`}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  const renderSubItem = (label: string, route: string, icon?: React.ReactNode) => {
    const isActive = currentRoute === route;
    return (
      <button
        key={route}
        onClick={() => handleItemClick(route)}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
          isActive
            ? 'bg-[#262626] text-[#E6C78B] font-bold border-l-2 border-[#D4A017] shadow-[0_0_10px_rgba(212,160,23,0.2)]'
            : 'text-[#9CA3AF] hover:text-[#FAF7F0] hover:bg-[#262626]/60'
        }`}
      >
        {icon ? icon : <span className="text-[#D4A017]">•</span>}
        <span className="truncate">{label}</span>
      </button>
    );
  };

  // 1. SUPER ADMIN SIDEBAR
  const renderSuperAdminSidebar = () => (
    <>
      {renderNavItem('Executive Dashboard', '/super-admin/dashboard', <LayoutDashboard size={16} />)}

      {/* Multi-Tenant Company Workspaces */}
      {renderNavItem('Company Workspaces', '/super-admin/company-workspaces', <Building2 size={16} />, 'SaaS')}

      {/* User Management */}
      {renderNavItem('User Management', '/super-admin/user-management', <Users size={16} />)}

      {/* RBAC */}
      {renderNavItem('Role Hierarchy & RBAC', '/super-admin/rbac', <ShieldCheck size={16} />)}

      {/* System Configuration */}
      {renderNavItem('System Configuration', '/super-admin/system-configuration', <Settings size={16} />)}

      {/* Audit Logs */}
      {renderNavItem('Audit Logs', '/super-admin/audit-logs', <FileText size={16} />)}

      {/* Enterprise Analytics */}
      {renderNavItem('Enterprise Analytics', '/super-admin/enterprise-analytics', <BarChart3 size={16} />)}

      {/* AI Configuration */}
      {renderNavItem('AI Configuration', '/super-admin/ai-configuration', <Cpu size={16} />)}

      {/* Platform Engines (Collapsible) */}
      <div className="space-y-1">
        <button
          onClick={() => toggleSection('platformEngines')}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-mono text-xs text-[#FAF7F0] hover:bg-[#301B05]/40 hover:text-[#F5C542] transition-all"
        >
          <div className="flex items-center gap-3">
            <Cpu size={16} className="text-[#F5C542]" />
            <span className="font-semibold">Platform Engines</span>
          </div>
          {openSections.platformEngines ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {openSections.platformEngines && (
          <div className="pl-5 pr-1 space-y-1 border-l border-[#D4A017]/25 ml-4 py-1">
            {renderSubItem('Finova AI Assistant', '/super-admin/ai-assistant', <Bot size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Document OCR Intelligence', '/super-admin/document-ocr', <FileSearch size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Transaction Classification', '/super-admin/transaction-classification', <Tag size={13} className="text-[#D4A017]" />)}
            {renderSubItem('KYC Verification', '/super-admin/kyc-verification', <ShieldCheck size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Fraud Detection & AML', '/super-admin/fraud-aml', <ShieldAlert size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Case Management', '/super-admin/case-management', <FolderGit2 size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Excel Data Visualization', '/super-admin/excel-visualization', <Table2 size={13} className="text-[#D4A017]" />)}
          </div>
        )}
      </div>

      {renderNavItem('Reports', '/super-admin/reports', <FileText size={16} />)}
      {renderNavItem('Profile', '/super-admin/profile', <User size={16} />)}
    </>
  );

  // 2. ADMIN SIDEBAR
  const renderAdminSidebar = () => (
    <>
      {renderNavItem('Operations Dashboard', '/admin/dashboard', <LayoutDashboard size={16} />)}
      {renderNavItem('Staff Management', '/admin/user-management', <Users size={16} />)}
      {renderNavItem('Operations Management', '/admin/operations-management', <Activity size={16} />)}
      {renderNavItem('Customer Management', '/admin/customer-management', <Users size={16} />)}
      {renderNavItem('Reports', '/admin/reports', <FileText size={16} />)}

      {/* Platform Engines */}
      <div className="space-y-1">
        <button
          onClick={() => toggleSection('platformEngines')}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-mono text-xs text-[#FAF7F0] hover:bg-[#301B05]/40 hover:text-[#F5C542] transition-all"
        >
          <div className="flex items-center gap-3">
            <Cpu size={16} className="text-[#F5C542]" />
            <span className="font-semibold">Platform Engines</span>
          </div>
          {openSections.platformEngines ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {openSections.platformEngines && (
          <div className="pl-5 pr-1 space-y-1 border-l border-[#D4A017]/25 ml-4 py-1">
            {renderSubItem('Finova AI Assistant', '/admin/ai-assistant', <Bot size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Document OCR Intelligence', '/admin/document-ocr', <FileSearch size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Transaction Classification', '/admin/transaction-classification', <Tag size={13} className="text-[#D4A017]" />)}
            {renderSubItem('KYC Verification', '/admin/kyc-verification', <ShieldCheck size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Fraud Detection & AML', '/admin/fraud-aml', <ShieldAlert size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Case Management', '/admin/case-management', <FolderGit2 size={13} className="text-[#D4A017]" />)}
          </div>
        )}
      </div>

      {renderNavItem('Profile', '/admin/profile', <User size={16} />)}
    </>
  );

  // 3. FINANCE ANALYST SIDEBAR
  const renderFinanceAnalystSidebar = () => (
    <>
      {renderNavItem('Finance Dashboard', '/finance/dashboard', <LayoutDashboard size={16} />)}
      {renderNavItem('Transaction Analytics', '/finance/transaction-analytics', <BarChart3 size={16} />)}
      {renderNavItem('Fraud Detection', '/finance/fraud-detection', <ShieldAlert size={16} />)}
      {renderNavItem('AML Monitoring', '/finance/aml-monitoring', <AlertTriangle size={16} />)}
      {renderNavItem('KYC Verification', '/finance/kyc-verification', <ShieldCheck size={16} />)}
      {renderNavItem('Risk Scoring', '/finance/risk-scoring', <Activity size={16} />)}
      {renderNavItem('Customer Financial Insights', '/finance/customer-financial-insights', <TrendingUp size={16} />)}
      {renderNavItem('Reports', '/finance/reports', <FileText size={16} />)}

      {/* Platform Engines */}
      <div className="space-y-1">
        <button
          onClick={() => toggleSection('platformEngines')}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-mono text-xs text-[#FAF7F0] hover:bg-[#301B05]/40 hover:text-[#F5C542] transition-all"
        >
          <div className="flex items-center gap-3">
            <Cpu size={16} className="text-[#F5C542]" />
            <span className="font-semibold">Platform Engines</span>
          </div>
          {openSections.platformEngines ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {openSections.platformEngines && (
          <div className="pl-5 pr-1 space-y-1 border-l border-[#D4A017]/25 ml-4 py-1">
            {renderSubItem('Finova AI Assistant', '/finance/ai-assistant', <Bot size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Transaction Classification', '/finance/transaction-classification', <Tag size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Fraud Detection & AML', '/finance/fraud-aml', <ShieldAlert size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Excel Data Visualization', '/finance/excel-visualization', <Table2 size={13} className="text-[#D4A017]" />)}
          </div>
        )}
      </div>

      {renderNavItem('Profile', '/finance/profile', <User size={16} />)}
    </>
  );

  // 4. SUPPORT EXECUTIVE SIDEBAR
  const renderSupportExecutiveSidebar = () => (
    <>
      {renderNavItem('Support Dashboard', '/support/dashboard', <LayoutDashboard size={16} />)}
      {renderNavItem('Customer Support Tickets', '/support/tickets', <Headphones size={16} />)}
      {renderNavItem('Customer Queries', '/support/customer-queries', <MessageSquare size={16} />)}
      {renderNavItem('Complaint Resolution', '/support/complaint-resolution', <AlertTriangle size={16} />)}
      {renderNavItem('Follow-Ups', '/support/followups', <Clock size={16} />)}
      {renderNavItem('Case Management', '/support/case-management', <FolderGit2 size={16} />)}
      {renderNavItem('Support Reports', '/support/reports', <FileText size={16} />)}

      {/* Platform Engines */}
      <div className="space-y-1">
        <button
          onClick={() => toggleSection('platformEngines')}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-mono text-xs text-[#FAF7F0] hover:bg-[#301B05]/40 hover:text-[#F5C542] transition-all"
        >
          <div className="flex items-center gap-3">
            <Cpu size={16} className="text-[#F5C542]" />
            <span className="font-semibold">Platform Engines</span>
          </div>
          {openSections.platformEngines ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {openSections.platformEngines && (
          <div className="pl-5 pr-1 space-y-1 border-l border-[#D4A017]/25 ml-4 py-1">
            {renderSubItem('Finova AI Assistant', '/support/ai-assistant', <Bot size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Document OCR Intelligence', '/support/document-ocr', <FileSearch size={13} className="text-[#D4A017]" />)}
            {renderSubItem('Case Management', '/support/case-management', <FolderGit2 size={13} className="text-[#D4A017]" />)}
          </div>
        )}
      </div>

      {renderNavItem('Profile', '/support/profile', <User size={16} />)}
    </>
  );

  // 5. CUSTOMER SIDEBAR
  const renderCustomerSidebar = () => (
    <>
      {renderNavItem('Dashboard', '/customer/dashboard', <LayoutDashboard size={16} />)}
      {renderNavItem('My Profile', '/customer/profile', <User size={16} />)}
      {renderNavItem('My Accounts', '/customer/accounts', <Wallet size={16} />)}
      {renderNavItem('Transactions', '/customer/transactions', <FileText size={16} />)}
      {renderNavItem('Cards', '/customer/cards', <CreditCard size={16} />, '3D Gold')}
      {renderNavItem('KYC Status', '/customer/kyc', <ShieldCheck size={16} />)}
      {renderNavItem('Documents', '/customer/documents', <FileCheck2 size={16} />)}
      {renderNavItem('AI Financial Assistant', '/customer/ai-assistant', <Bot size={16} />, 'AI')}
      {renderNavItem('Support Center', '/customer/support', <Headphones size={16} />)}
      {renderNavItem('Notifications', '/customer/notifications', <Bell size={16} />)}
      {renderNavItem('Settings', '/customer/settings', <Settings size={16} />)}
    </>
  );

  return (
    <aside
      className={`fixed lg:static top-0 left-0 z-50 h-screen w-72 bg-[#121212] border-r border-[#3A3A3A] flex flex-col justify-between transition-transform duration-300 ease-in-out ${
        isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Top Header: Official Golden Logo & Role Badge */}
      <div className="p-5 border-b border-[#3A3A3A] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <FinovaLogo variant="compact" size="md" />
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg bg-[#262626] text-[#D4A017] hover:text-[#E6C78B]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Role Badge & Tenant Workspace Indicator */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between">
            <div
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase ${roleBadge.color}`}
            >
              {roleBadge.label}
            </div>
            {currentUser.authSource === 'supabase' ? (
              <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Supabase DB
              </span>
            ) : (
              <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Demo Persona
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#262626] border border-[#3A3A3A] text-[10px] font-mono text-[#E6C78B]">
            {role === 'SUPER_ADMIN' ? (
              <>
                <Globe size={11} className="text-[#D4A017] shrink-0" />
                <span className="truncate font-semibold">SaaS Platform Operator</span>
              </>
            ) : (
              <>
                <Building2 size={11} className="text-[#D4A017] shrink-0" />
                <span className="truncate font-semibold">{currentUser.tenantName || 'Apex Global Bank'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation List - Role Segregated! */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-1.5 scrollbar-thin scrollbar-thumb-[#3A3A3A]">
        {role === 'SUPER_ADMIN' && renderSuperAdminSidebar()}
        {role === 'ADMIN' && renderAdminSidebar()}
        {role === 'FINANCE_ANALYST' && renderFinanceAnalystSidebar()}
        {role === 'SUPPORT_EXECUTIVE' && renderSupportExecutiveSidebar()}
        {role === 'CUSTOMER' && renderCustomerSidebar()}
      </div>

      {/* Bottom Footer: User Status & Logout */}
      <div className="p-4 border-t border-[#3A3A3A] bg-[#121212] space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4A017] to-[#E6C78B] flex items-center justify-center text-[#1A1A1A] font-bold text-sm shadow-[0_0_10px_rgba(212,160,23,0.3)] shrink-0">
            {currentUser.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-mono font-bold text-[#FAF7F0] truncate">{currentUser.name}</p>
              {currentUser.authSource === 'supabase' ? (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 shrink-0">
                  Live DB
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
                  Demo
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-[#9CA3AF] truncate">{currentUser.email}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] hover:text-[#E6C78B] border border-[#3A3A3A] hover:border-[#D4A017]/40 text-xs font-mono transition-all group"
        >
          <LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />
          <span>Secure Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
