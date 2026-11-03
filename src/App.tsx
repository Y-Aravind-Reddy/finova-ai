import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { FinovaLogo } from './components/FinovaLogo';
import { UserAccount, UserRole } from './data/finovaDatasets';
import {
  getStoredSession,
  clearSession,
  saveSession,
  getStoredUsers,
  saveStoredUsers,
  AuthSession,
  signOutUserAsync,
  loadCurrentUserProfileAsync,
  AUTHORIZED_SUPER_ADMIN_EMAIL,
} from './data/authStore';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import {
  fetchProfilesResultFromDb,
} from './services/finovaDatabase';
import {
  ROLE_DEFAULT_ROUTES,
  getRouteMeta,
  isRouteAllowed,
} from './routes/routesConfig';

// Common Components (Small ones stay static)
import { Breadcrumbs } from './components/common/Breadcrumbs';
import { RoleSidebar } from './components/RoleSidebar';
import { FinovaAiCopilot } from './components/FinovaAiCopilot';

// Lazy Load Pages & Views
const ReportsView = lazy(() => import('./components/ReportsView').then(m => ({ default: m.ReportsView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const SuperAdminSettingsView = lazy(() => import('./components/SuperAdminSettingsView').then(m => ({ default: m.SuperAdminSettingsView })));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./components/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./components/SignupPage').then(m => ({ default: m.SignupPage })));

// Dashboards
const SuperAdminDashboard = lazy(() => import('./components/dashboards/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const AdminDashboard = lazy(() => import('./components/dashboards/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const FinanceAnalystDashboard = lazy(() => import('./components/dashboards/FinanceAnalystDashboard').then(m => ({ default: m.FinanceAnalystDashboard })));
const SupportExecutiveDashboard = lazy(() => import('./components/dashboards/SupportExecutiveDashboard').then(m => ({ default: m.SupportExecutiveDashboard })));
const CustomerDashboard = lazy(() => import('./components/dashboards/CustomerDashboard').then(m => ({ default: m.CustomerDashboard })));

// Platform Engine Pages
const FinovaAiAssistantPage = lazy(() => import('./components/engines/FinovaAiAssistantPage').then(m => ({ default: m.FinovaAiAssistantPage })));
const DocumentOcrPage = lazy(() => import('./components/engines/DocumentOcrPage').then(m => ({ default: m.DocumentOcrPage })));
const TransactionClassificationPage = lazy(() => import('./components/engines/TransactionClassificationPage').then(m => ({ default: m.TransactionClassificationPage })));
const KycVerificationPage = lazy(() => import('./components/engines/KycVerificationPage').then(m => ({ default: m.KycVerificationPage })));
const FraudAmlPage = lazy(() => import('./components/engines/FraudAmlPage').then(m => ({ default: m.FraudAmlPage })));
const CaseManagementPage = lazy(() => import('./components/engines/CaseManagementPage').then(m => ({ default: m.CaseManagementPage })));
const ExcelVisualizationPage = lazy(() => import('./components/engines/ExcelVisualizationPage').then(m => ({ default: m.ExcelVisualizationPage })));

// Super Admin Pages
const SuperAdminRbacPage = lazy(() => import('./components/superadmin/SuperAdminRbacPage').then(m => ({ default: m.SuperAdminRbacPage })));
const SuperAdminSystemConfigPage = lazy(() => import('./components/superadmin/SuperAdminSystemConfigPage').then(m => ({ default: m.SuperAdminSystemConfigPage })));
const SuperAdminAiConfigPage = lazy(() => import('./components/superadmin/SuperAdminAiConfigPage').then(m => ({ default: m.SuperAdminAiConfigPage })));
const SuperAdminAuditLogsPage = lazy(() => import('./components/superadmin/SuperAdminAuditLogsPage').then(m => ({ default: m.SuperAdminAuditLogsPage })));
const SuperAdminEnterpriseAnalyticsPage = lazy(() => import('./components/superadmin/SuperAdminEnterpriseAnalyticsPage').then(m => ({ default: m.SuperAdminEnterpriseAnalyticsPage })));
const SuperAdminCompanyWorkspacesPage = lazy(() => import('./components/superadmin/SuperAdminCompanyWorkspacesPage').then(m => ({ default: m.SuperAdminCompanyWorkspacesPage })));

// Admin Pages
const AdminOperationsPage = lazy(() => import('./components/admin/AdminOperationsPage').then(m => ({ default: m.AdminOperationsPage })));
const AdminCustomerManagementPage = lazy(() => import('./components/admin/AdminCustomerManagementPage').then(m => ({ default: m.AdminCustomerManagementPage })));
const AdminUserManagementPage = lazy(() => import('./components/admin/AdminUserManagementPage').then(m => ({ default: m.AdminUserManagementPage })));

// Finance Analyst Pages
const FinanceTransactionAnalyticsPage = lazy(() => import('./components/finance/FinanceTransactionAnalyticsPage').then(m => ({ default: m.FinanceTransactionAnalyticsPage })));
const FinanceFraudDetectionPage = lazy(() => import('./components/finance/FinanceFraudDetectionPage').then(m => ({ default: m.FinanceFraudDetectionPage })));
const FinanceAmlMonitoringPage = lazy(() => import('./components/finance/FinanceAmlMonitoringPage').then(m => ({ default: m.FinanceAmlMonitoringPage })));
const FinanceRiskScoringPage = lazy(() => import('./components/finance/FinanceRiskScoringPage').then(m => ({ default: m.FinanceRiskScoringPage })));
const FinanceCustomerInsightsPage = lazy(() => import('./components/finance/FinanceCustomerInsightsPage').then(m => ({ default: m.FinanceCustomerInsightsPage })));

// Support Executive Pages
const SupportTicketsPage = lazy(() => import('./components/support/SupportTicketsPage').then(m => ({ default: m.SupportTicketsPage })));
const SupportCustomerQueriesPage = lazy(() => import('./components/support/SupportCustomerQueriesPage').then(m => ({ default: m.SupportCustomerQueriesPage })));
const SupportComplaintResolutionPage = lazy(() => import('./components/support/SupportComplaintResolutionPage').then(m => ({ default: m.SupportComplaintResolutionPage })));
const SupportFollowupsPage = lazy(() => import('./components/support/SupportFollowupsPage').then(m => ({ default: m.SupportFollowupsPage })));
const SupportReportsPage = lazy(() => import('./components/support/SupportReportsPage').then(m => ({ default: m.SupportReportsPage })));

// Data & Transfer Intelligence Pages
const TransferOverview = lazy(() => import('./components/datatransfer/TransferOverview').then(m => ({ default: m.TransferOverview })));
const SettlementMonitoring = lazy(() => import('./components/datatransfer/SettlementMonitoring').then(m => ({ default: m.SettlementMonitoring })));
const TransactionRecords = lazy(() => import('./components/datatransfer/TransactionRecords').then(m => ({ default: m.TransactionRecords })));
const Reconciliation = lazy(() => import('./components/datatransfer/Reconciliation').then(m => ({ default: m.Reconciliation })));
const TransferExceptions = lazy(() => import('./components/datatransfer/TransferExceptions').then(m => ({ default: m.TransferExceptions })));

// Customer Pages
const CustomerCardsView = lazy(() => import('./components/CustomerCardsView').then(m => ({ default: m.CustomerCardsView })));
const CustomerAccountsPage = lazy(() => import('./components/customer/CustomerAccountsPage').then(m => ({ default: m.CustomerAccountsPage })));
const CustomerTransactionsPage = lazy(() => import('./components/customer/CustomerTransactionsPage').then(m => ({ default: m.CustomerTransactionsPage })));
const CustomerKycPage = lazy(() => import('./components/customer/CustomerKycPage').then(m => ({ default: m.CustomerKycPage })));
const CustomerDocumentsPage = lazy(() => import('./components/customer/CustomerDocumentsPage').then(m => ({ default: m.CustomerDocumentsPage })));
const CustomerSupportPage = lazy(() => import('./components/customer/CustomerSupportPage').then(m => ({ default: m.CustomerSupportPage })));
const CustomerNotificationsPage = lazy(() => import('./components/customer/CustomerNotificationsPage').then(m => ({ default: m.CustomerNotificationsPage })));
const CustomerSettingsPage = lazy(() => import('./components/customer/CustomerSettingsPage').then(m => ({ default: m.CustomerSettingsPage })));

import { getStoredTenants } from './data/tenantStore';

import {
  Menu,
  Bot,
  Lock,
  Building2,
  Globe,
  RotateCw
} from 'lucide-react';

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] text-[#D4A017] space-y-4">
    <RotateCw className="animate-spin" size={32} />
    <p className="font-cinzel text-sm font-bold animate-pulse uppercase tracking-widest">Finova Neural Link Active...</p>
  </div>
);

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [impersonatingAdmin, setImpersonatingAdmin] = useState<UserAccount | null>(null);
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'signup' | 'app'>('landing');
  const [currentRoute, setCurrentRoute] = useState<string>('/customer/dashboard');
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('ALL');

  const navigateTo = useCallback(
    (newRoute: string, replace = false) => {
      setCurrentRoute(newRoute);
      if (replace) {
        window.history.replaceState({ route: newRoute }, '', newRoute);
      } else {
        window.history.pushState({ route: newRoute }, '', newRoute);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const refreshUsersListAsync = useCallback(async () => {
    if (isSupabaseConfigured()) {
      try {
        const res = await fetchProfilesResultFromDb();
        if (res.state === 'live_records' && res.data && res.data.length > 0) {
          setUsersList(res.data);
          return;
        } else if (res.state === 'zero_records') {
          setUsersList([]);
          return;
        }
      } catch (err) {
        console.warn('Failed querying live profiles from Supabase:', err);
      }
    }
  }, []);

  const authInitializedRef = React.useRef(false);

  useEffect(() => {
    let isCancelled = false;
    let authSubscription: any = null;

    const handleInitialRouting = (user: UserAccount) => {
      const pathname = window.location.pathname;
      const isUserAuthorizedForPath = (path: string, u: UserAccount) => {
        if (path.startsWith('/super-admin')) {
          return u.role === 'SUPER_ADMIN' && u.email.toLowerCase().trim() === AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase();
        }
        return isRouteAllowed(path, u.role);
      };

      if (pathname && pathname !== '/' && isUserAuthorizedForPath(pathname, user)) {
        setCurrentRoute(pathname);
      } else {
        navigateTo(ROLE_DEFAULT_ROUTES[user.role], true);
      }
    };

    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(async (event, sbSession) => {
        if (isCancelled) return;
        
        // Prevent duplicate processing for same session state
        if (authInitializedRef.current && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && sbSession?.user) {
          // If we already have a session for this user, skip re-loading profile unless it's a fresh sign-in
          if (session?.user.id === sbSession.user.id) return;
        }

        if (event === 'SIGNED_OUT') {
          authInitializedRef.current = true;
          clearSession();
          setSession(null);
          setCurrentView('landing');
          setUsersList([]);
        } else if (
          (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
          sbSession?.user
        ) {
          authInitializedRef.current = true;
          const profileRes = await loadCurrentUserProfileAsync();
          if (!isCancelled && profileRes.success && profileRes.session) {
            setSession(profileRes.session);
            setCurrentView('app');
            handleInitialRouting(profileRes.session.user);
            refreshUsersListAsync();
          }
        } else if (event === 'TOKEN_REFRESHED' && sbSession?.user) {
          const current = getStoredSession();
          if (current) {
            current.token = sbSession.access_token;
            saveSession(current);
            setSession({ ...current });
          }
        }
      });
      authSubscription = data;
    } else {
      const stored = getStoredSession();
      if (stored) {
        setSession(stored);
        setCurrentView('app');
        handleInitialRouting(stored.user);
        authInitializedRef.current = true;
      } else {
        const pathname = window.location.pathname;
        if (pathname === '/login') setCurrentView('login');
        else if (pathname === '/signup') setCurrentView('signup');
        else setCurrentView('landing');
        authInitializedRef.current = true;
      }
    }

    const handleRegisteredEvent = (e: Event) => {
      const customEv = e as CustomEvent<UserAccount>;
      if (customEv.detail) {
        setUsersList((prev) => {
          const exists = prev.some(u => u.id === customEv.detail.id);
          return exists ? prev.map(u => u.id === customEv.detail.id ? customEv.detail : u) : [customEv.detail, ...prev];
        });
      }
      refreshUsersListAsync();
    };

    const handleProfileUpdatedEvent = (e: Event) => {
      const customEv = e as CustomEvent<UserAccount>;
      if (customEv?.detail) {
        const updated = customEv.detail;
        setSession((prev) => {
          if (!prev || (prev.user.id !== updated.id)) return prev;
          const updatedUser = { ...prev.user, ...updated };
          const updatedSession = { ...prev, user: updatedUser };
          saveSession(updatedSession);
          if (!isRouteAllowed(window.location.pathname, updated.role)) {
            navigateTo(ROLE_DEFAULT_ROUTES[updated.role], true);
          }
          return updatedSession;
        });
        refreshUsersListAsync();
      }
    };

    const handleWindowFocus = async () => {
      if (isSupabaseConfigured() && !isCancelled && authInitializedRef.current) {
        const profileRes = await loadCurrentUserProfileAsync();
        if (!isCancelled && profileRes.success && profileRes.session) {
          setSession(prev => {
             // Only update if role or tenant has actually changed to prevent render loops
             if (prev?.user.role !== profileRes.session?.user.role || prev?.user.tenantId !== profileRes.session?.user.tenantId) {
               return profileRes.session;
             }
             return prev;
          });
        }
      }
    };

    window.addEventListener('finova:user_registered', handleRegisteredEvent);
    window.addEventListener('finova:profile_updated', handleProfileUpdatedEvent);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isCancelled = true;
      window.removeEventListener('finova:user_registered', handleRegisteredEvent);
      window.removeEventListener('finova:profile_updated', handleProfileUpdatedEvent);
      window.removeEventListener('focus', handleWindowFocus);
      if (authSubscription?.subscription) {
        authSubscription.subscription.unsubscribe();
      }
    };
  }, [navigateTo, refreshUsersListAsync, session?.user.id]);

  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      if (session) {
        if (pathname && isRouteAllowed(pathname, session.user.role)) {
          setCurrentRoute(pathname);
        } else {
          setCurrentRoute(ROLE_DEFAULT_ROUTES[session.user.role]);
        }
      } else {
        if (pathname === '/login') setCurrentView('login');
        else if (pathname === '/signup') setCurrentView('signup');
        else setCurrentView('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [session]);

  const handleUpdateUsers = useCallback((newUsers: UserAccount[]) => {
    setUsersList(newUsers);
    const currentStored = getStoredUsers();
    const merged = newUsers.map((u) => {
      const match = currentStored.find((c) => c.id === u.id);
      return { ...u, passwordHash: match?.passwordHash || 'finova2026' };
    });
    saveStoredUsers(merged);
  }, []);

  const handleLoginSuccess = async () => {
    setImpersonatingAdmin(null);
    const profileRes = await loadCurrentUserProfileAsync();
    if (profileRes.success && profileRes.session) {
      setSession(profileRes.session);
      setCurrentView('app');
      navigateTo(ROLE_DEFAULT_ROUTES[profileRes.session.user.role]);
      refreshUsersListAsync();
    } else {
      setCurrentView('login');
    }
  };

  const handleSuperAdminSwitchRole = (targetUser: UserAccount) => {
    if (session && session.user.role === 'SUPER_ADMIN') setImpersonatingAdmin(session.user);
    const newSession: AuthSession = { token: `jwt_${targetUser.id}`, user: targetUser, expiresAt: Date.now() + 86400000 };
    setSession(newSession);
    saveSession(newSession);
    navigateTo(ROLE_DEFAULT_ROUTES[targetUser.role]);
  };

  const handleReturnToSuperAdmin = () => {
    if (impersonatingAdmin) {
      const adminSession: AuthSession = { token: `jwt_${impersonatingAdmin.id}`, user: impersonatingAdmin, expiresAt: Date.now() + 86400000 };
      setSession(adminSession);
      saveSession(adminSession);
      setImpersonatingAdmin(null);
      navigateTo('/super-admin/user-management');
    }
  };

  const handleProfileUpdated = (updatedUser: UserAccount) => {
    if (session) setSession({ ...session, user: updatedUser });
    setUsersList((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const handleLogout = () => {
    signOutUserAsync().catch(() => {});
    clearSession();
    setSession(null);
    setImpersonatingAdmin(null);
    setCurrentView('landing');
    setMobileMenuOpen(false);
    window.history.pushState(null, '', '/');
  };

  if (currentView === 'landing' || !session) {
    return (
      <Suspense fallback={<PageLoader />}>
        {currentView === 'login' ? (
          <LoginPage onLoginSuccess={handleLoginSuccess} onGoToSignup={() => { setCurrentView('signup'); window.history.pushState(null, '', '/signup'); }} onBackToLanding={() => { setCurrentView('landing'); window.history.pushState(null, '', '/'); }} />
        ) : currentView === 'signup' ? (
          <SignupPage onSignupSuccess={handleLoginSuccess} onGoToLogin={() => { setCurrentView('login'); window.history.pushState(null, '', '/login'); }} onBackToLanding={() => { setCurrentView('landing'); window.history.pushState(null, '', '/'); }} />
        ) : (
          <LandingPage onGoToLogin={() => { setCurrentView('login'); window.history.pushState(null, '', '/login'); }} onGoToSignup={() => { setCurrentView('signup'); window.history.pushState(null, '', '/signup'); }} />
        )}
      </Suspense>
    );
  }

  const currentUser = session.user;
  const userRole = currentUser.role;
  const routeMeta = getRouteMeta(currentRoute, userRole);
  const routeAllowed = isRouteAllowed(currentRoute, userRole);

  const renderRouteContent = () => {
    if (!routeAllowed) {
      return (
        <div className="rounded-2xl p-8 bg-[#1E1E1E] border border-[#C08A00] shadow-2xl text-center space-y-4 max-w-xl mx-auto my-12">
          <div className="w-16 h-16 rounded-full bg-[#301B05] border border-[#C08A00] text-[#F5C542] flex items-center justify-center mx-auto">
            <Lock size={28} />
          </div>
          <h2 className="font-cinzel text-xl font-bold text-[#FFF8E7]">Clearance Restricted • Access Denied</h2>
          <p className="font-mono text-xs text-[#FAF7F0]/80">Your institutional credentials ({userRole.replace('_', ' ')}) do not possess clearance for: <code className="text-[#F5C542]">{currentRoute}</code>.</p>
          <button onClick={() => navigateTo(ROLE_DEFAULT_ROUTES[userRole])} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg">Return to Authorized Dashboard</button>
        </div>
      );
    }

    return (
      <Suspense fallback={<PageLoader />}>
        {(() => {
          if (userRole === 'SUPER_ADMIN') {
            switch (currentRoute) {
              case '/super-admin/dashboard': return <SuperAdminDashboard currentRole={userRole} users={usersList} onUpdateUsers={handleUpdateUsers} onRefreshUsers={refreshUsersListAsync} onOpenCopilot={() => setCopilotOpen(true)} selectedTenantId={selectedTenantId} onSelectTenant={setSelectedTenantId} onNavigate={navigateTo} />;
              case '/super-admin/company-workspaces': return <SuperAdminCompanyWorkspacesPage onInspectTenant={(tId) => { setSelectedTenantId(tId); navigateTo('/super-admin/dashboard'); }} />;
              case '/super-admin/user-management': return <SuperAdminSettingsView users={usersList} onUpdateUsers={handleUpdateUsers} onRefreshUsers={refreshUsersListAsync} onImpersonateUser={handleSuperAdminSwitchRole} initialTab="users" initialRoleFilter="ALL" />;
              case '/super-admin/rbac': return <SuperAdminRbacPage />;
              case '/super-admin/system-configuration': return <SuperAdminSystemConfigPage />;
              case '/super-admin/ai-configuration': return <SuperAdminAiConfigPage currentUser={currentUser} />;
              case '/super-admin/audit-logs': return <SuperAdminAuditLogsPage currentUser={currentUser} />;
              case '/super-admin/enterprise-analytics': return <SuperAdminEnterpriseAnalyticsPage />;
              case '/super-admin/reports': return <ReportsView />;
              case '/super-admin/profile': return <ProfileView currentRole={userRole} userName={currentUser.name} currentUser={currentUser} onUpdateUser={handleProfileUpdated} />;
              case '/super-admin/ai-assistant': return <FinovaAiAssistantPage currentRole={userRole} userName={currentUser.name} />;
              case '/super-admin/document-ocr': return <DocumentOcrPage />;
              case '/super-admin/transaction-classification': return <TransactionClassificationPage />;
              case '/super-admin/kyc-verification': return <KycVerificationPage />;
              case '/super-admin/fraud-aml': return <FraudAmlPage />;
              case '/super-admin/case-management': return <CaseManagementPage />;
              case '/super-admin/excel-visualization': return <ExcelVisualizationPage />;
              
              default: return <SuperAdminDashboard currentRole={userRole} users={usersList} onUpdateUsers={handleUpdateUsers} onRefreshUsers={refreshUsersListAsync} onOpenCopilot={() => setCopilotOpen(true)} selectedTenantId={selectedTenantId} onSelectTenant={setSelectedTenantId} onNavigate={navigateTo} />;
            }
          }
          if (userRole === 'ADMIN') {
            switch (currentRoute) {
              case '/admin/dashboard':
              case '/admin/user-management':
              case '/admin/operations-management':
              case '/admin/customer-management':
                return <AdminDashboard currentRole={userRole} users={usersList} onUpdateUsers={handleUpdateUsers} onRefreshUsers={refreshUsersListAsync} currentUser={currentUser} activeSection={currentRoute.split('/').pop()} />;
              case '/admin/reports': return <ReportsView />;
              case '/admin/profile': return <ProfileView currentRole={userRole} userName={currentUser.name} currentUser={currentUser} onUpdateUser={handleProfileUpdated} />;
              case '/admin/ai-assistant': return <FinovaAiAssistantPage currentRole={userRole} userName={currentUser.name} />;
              case '/admin/document-ocr': return <DocumentOcrPage />;
              case '/admin/transaction-classification': return <TransactionClassificationPage />;
              case '/admin/kyc-verification': return <KycVerificationPage currentUser={currentUser} tenantId={currentUser?.tenantId} />;
              case '/admin/fraud-aml': return <FraudAmlPage />;
              case '/admin/case-management': return <CaseManagementPage />;
              
              // Data & Transfer Intelligence
              case '/admin/data-transfer/overview': return <TransferOverview />;
              case '/admin/data-transfer/settlements': return <SettlementMonitoring />;
              case '/admin/data-transfer/transactions': return <TransactionRecords />;
              case '/admin/data-transfer/reconciliation': return <Reconciliation />;
              case '/admin/data-transfer/exceptions': return <TransferExceptions />;

              default: return <AdminDashboard currentRole={userRole} users={usersList} onUpdateUsers={handleUpdateUsers} onRefreshUsers={refreshUsersListAsync} currentUser={currentUser} />;
            }
          }
          if (userRole === 'FINANCE_ANALYST') {
            switch (currentRoute) {
              case '/finance/dashboard': return <FinanceAnalystDashboard currentRole={userRole} users={usersList} onUpdateUsers={handleUpdateUsers} currentUser={currentUser} />;
              case '/finance/transaction-analytics': return <FinanceTransactionAnalyticsPage currentUser={currentUser} tenantId={currentUser?.tenantId} />;
              case '/finance/fraud-detection': return <FinanceFraudDetectionPage currentUser={currentUser} tenantId={currentUser?.tenantId} />;
              case '/finance/aml-monitoring': return <FinanceAmlMonitoringPage />;
              case '/finance/kyc-verification': return <KycVerificationPage currentUser={currentUser} tenantId={currentUser?.tenantId} />;
              case '/finance/risk-scoring': return <FinanceRiskScoringPage />;
              case '/finance/customer-financial-insights': return <FinanceCustomerInsightsPage />;
              case '/finance/reports': return <ReportsView />;
              case '/finance/profile': return <ProfileView currentRole={userRole} userName={currentUser.name} currentUser={currentUser} onUpdateUser={handleProfileUpdated} />;
              case '/finance/ai-assistant': return <FinovaAiAssistantPage currentRole={userRole} userName={currentUser.name} />;
              case '/finance/transaction-classification': return <TransactionClassificationPage />;
              case '/finance/fraud-aml': return <FraudAmlPage />;
              case '/finance/excel-visualization': return <ExcelVisualizationPage />;
              default: return <FinanceAnalystDashboard currentRole={userRole} users={usersList} onUpdateUsers={handleUpdateUsers} currentUser={currentUser} />;
            }
          }
          if (userRole === 'SUPPORT_EXECUTIVE') {
            switch (currentRoute) {
              case '/support/dashboard': return <SupportExecutiveDashboard currentRole={userRole} users={usersList} onUpdateUsers={handleUpdateUsers} currentUser={currentUser} />;
              case '/support/tickets': return <SupportTicketsPage currentUser={currentUser} tenantId={currentUser?.tenantId} />;
              case '/support/customer-queries': return <SupportCustomerQueriesPage />;
              case '/support/complaint-resolution': return <SupportComplaintResolutionPage />;
              case '/support/followups': return <SupportFollowupsPage />;
              case '/support/case-management': return <CaseManagementPage />;
              case '/support/reports': return <SupportReportsPage />;
              case '/support/profile': return <ProfileView currentRole={userRole} userName={currentUser.name} currentUser={currentUser} onUpdateUser={handleProfileUpdated} />;
              case '/support/ai-assistant': return <FinovaAiAssistantPage currentRole={userRole} userName={currentUser.name} />;
              case '/support/document-ocr': return <DocumentOcrPage />;
              default: return <SupportExecutiveDashboard currentRole={userRole} users={usersList} onUpdateUsers={handleUpdateUsers} currentUser={currentUser} />;
            }
          }
          if (userRole === 'CUSTOMER') {
            switch (currentRoute) {
              case '/customer/dashboard': return <CustomerDashboard onOpenCopilot={() => setCopilotOpen(true)} currentUser={currentUser} onNavigateSection={navigateTo} />;
              case '/customer/profile': return <ProfileView currentRole={userRole} userName={currentUser.name} currentUser={currentUser} onUpdateUser={handleProfileUpdated} />;
              case '/customer/accounts': return <CustomerAccountsPage currentUser={currentUser} />;
              case '/customer/transactions': return <CustomerTransactionsPage currentUser={currentUser} />;
              case '/customer/cards': return <CustomerCardsView customerName={currentUser.name} />;
              case '/customer/kyc': return <CustomerKycPage tenantId={currentUser?.tenantId} onNavigateSection={navigateTo} />;
              case '/customer/documents': return <CustomerDocumentsPage tenantId={currentUser?.tenantId} />;
              case '/customer/ai-assistant': return <FinovaAiAssistantPage currentRole={userRole} userName={currentUser.name} />;
              case '/customer/support': return <CustomerSupportPage currentUser={currentUser} />;
              case '/customer/notifications': return <CustomerNotificationsPage />;
              case '/customer/settings': return <CustomerSettingsPage currentUser={currentUser} />;
              default: return <CustomerDashboard onOpenCopilot={() => setCopilotOpen(true)} currentUser={currentUser} onNavigateSection={navigateTo} />;
            }
          }
          return null;
        })()}
      </Suspense>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-[#121212] text-[#FAF7F0] flex flex-col lg:flex-row antialiased selection:bg-[#D4A017] selection:text-[#1A1A1A]">
      <RoleSidebar currentUser={currentUser} currentRoute={currentRoute} onNavigate={navigateTo} onLogout={handleLogout} isOpenMobile={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
      {mobileMenuOpen && <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/75 lg:hidden backdrop-blur-sm" />}
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="flex-shrink-0 z-30 bg-[#262626]/95 backdrop-blur-xl border-b border-[#3A3A3A] px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[#D4A017] hover:text-[#E6C78B]"><Menu size={18} /></button>
            <div className="flex items-center gap-2">
              <FinovaLogo variant="compact" size="sm" className="hidden sm:inline-flex" />
              <FinovaLogo variant="icon" size="sm" className="sm:hidden" />
              <div className="hidden xl:flex items-center gap-2 pl-4 border-l border-[#3A3A3A]"><span className="w-2 h-2 rounded-full bg-[#D4A017] animate-pulse" /><span className="text-[11px] font-mono text-[#9CA3AF]">Uptime: 99.992% • FedNow Active</span></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userRole === 'SUPER_ADMIN' ? (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121212] border border-[#3A3A3A] text-xs font-mono">
                <Globe size={13} className="text-[#D4A017] shrink-0" /><span className="text-[#9CA3AF] text-[11px]">Workspace:</span>
                <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} className="bg-transparent text-[#E6C78B] font-bold text-xs focus:outline-none cursor-pointer pr-1">
                  <option value="ALL">All Workspaces</option>
                  {getStoredTenants().map((t) => <option key={t.id} value={t.id}>{t.shortName || t.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121212] border border-[#3A3A3A] text-xs font-mono text-[#E6C78B]">
                <Building2 size={13} className="text-[#D4A017] shrink-0" /><span className="font-bold">{currentUser.tenantName || 'Apex Global Bank'}</span>
              </div>
            )}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121212] border border-[#3A3A3A] text-xs font-mono">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#D4A017] to-[#E6C78B] flex items-center justify-center text-[#1A1A1A] font-bold text-[10px]">{currentUser.name.charAt(0)}</div>
              <span className="font-bold text-[#FAF7F0] truncate max-w-[130px]">{currentUser.name}</span>
              {session?.source === 'supabase' || currentUser.authSource === 'supabase' ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Live DB</span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">Demo</span>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121212] border border-[#3A3A3A] text-xs font-mono text-[#E6C78B]"><span className="w-2 h-2 rounded-full bg-[#D4A017]" /><span className="font-bold uppercase tracking-wider">{userRole.replace('_', ' ')}</span></div>
            <button onClick={() => setCopilotOpen(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_15px_rgba(212,160,23,0.35)] transition-all"><Bot size={15} /><span className="hidden sm:inline">AI Copilot</span></button>
          </div>
        </header>

        {impersonatingAdmin && (
          <div className="flex-shrink-0 bg-gradient-to-r from-[#301B05] via-[#4A2C0A] to-[#301B05] border-b border-[#D4A017] px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs font-mono text-[#FFF8E7] shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#F5C542] animate-ping" /><span><strong>Governance Session:</strong> Auditing as <span className="text-[#F5C542] font-bold">{currentUser.name}</span></span></div>
            <button onClick={handleReturnToSuperAdmin} className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-[11px] hover:brightness-110">← Return to Super Admin</button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-h-0">
          <div className="max-w-7xl w-full mx-auto">
            <Breadcrumbs routeMeta={routeMeta} onNavigateHome={() => navigateTo(ROLE_DEFAULT_ROUTES[userRole])} />
            {renderRouteContent()}
          </div>
        </main>
      </div>
      
      <FinovaAiCopilot currentRole={userRole} userName={currentUser.name} isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}
