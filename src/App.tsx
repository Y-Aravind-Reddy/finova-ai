import React, { useState, useEffect, useCallback } from 'react';
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
} from './data/authStore';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import {
  fetchProfilesResultFromDb,
  saveProfileToDb,
} from './services/finovaDatabase';
import {
  ROLE_DEFAULT_ROUTES,
  ROUTES,
  getRouteMeta,
  isRouteAllowed,
} from './routes/routesConfig';

// Common Components
import { Breadcrumbs } from './components/common/Breadcrumbs';
import { RoleSidebar } from './components/RoleSidebar';
import { FinovaAiCopilot } from './components/FinovaAiCopilot';
import { ReportsView } from './components/ReportsView';
import { ProfileView } from './components/ProfileView';
import { SuperAdminSettingsView } from './components/SuperAdminSettingsView';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { SignupPage } from './components/SignupPage';

// Dashboards
import { SuperAdminDashboard } from './components/dashboards/SuperAdminDashboard';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { FinanceAnalystDashboard } from './components/dashboards/FinanceAnalystDashboard';
import { SupportExecutiveDashboard } from './components/dashboards/SupportExecutiveDashboard';
import { CustomerDashboard } from './components/dashboards/CustomerDashboard';

// Dedicated Platform Engine Pages
import { FinovaAiAssistantPage } from './components/engines/FinovaAiAssistantPage';
import { DocumentOcrPage } from './components/engines/DocumentOcrPage';
import { TransactionClassificationPage } from './components/engines/TransactionClassificationPage';
import { KycVerificationPage } from './components/engines/KycVerificationPage';
import { FraudAmlPage } from './components/engines/FraudAmlPage';
import { CaseManagementPage } from './components/engines/CaseManagementPage';
import { ExcelVisualizationPage } from './components/engines/ExcelVisualizationPage';

// Super Admin Pages
import { SuperAdminRbacPage } from './components/superadmin/SuperAdminRbacPage';
import { SuperAdminSystemConfigPage } from './components/superadmin/SuperAdminSystemConfigPage';
import { SuperAdminAiConfigPage } from './components/superadmin/SuperAdminAiConfigPage';
import { SuperAdminAuditLogsPage } from './components/superadmin/SuperAdminAuditLogsPage';
import { SuperAdminEnterpriseAnalyticsPage } from './components/superadmin/SuperAdminEnterpriseAnalyticsPage';
import { SuperAdminCompanyWorkspacesPage } from './components/superadmin/SuperAdminCompanyWorkspacesPage';
import { getStoredTenants, getTenantById } from './data/tenantStore';

// Admin Pages
import { AdminOperationsPage } from './components/admin/AdminOperationsPage';
import { AdminCustomerManagementPage } from './components/admin/AdminCustomerManagementPage';
import { AdminUserManagementPage } from './components/admin/AdminUserManagementPage';

// Finance Analyst Pages
import { FinanceTransactionAnalyticsPage } from './components/finance/FinanceTransactionAnalyticsPage';
import { FinanceFraudDetectionPage } from './components/finance/FinanceFraudDetectionPage';
import { FinanceAmlMonitoringPage } from './components/finance/FinanceAmlMonitoringPage';
import { FinanceRiskScoringPage } from './components/finance/FinanceRiskScoringPage';
import { FinanceCustomerInsightsPage } from './components/finance/FinanceCustomerInsightsPage';

// Support Executive Pages
import { SupportTicketsPage } from './components/support/SupportTicketsPage';
import { SupportCustomerQueriesPage } from './components/support/SupportCustomerQueriesPage';
import { SupportComplaintResolutionPage } from './components/support/SupportComplaintResolutionPage';
import { SupportFollowupsPage } from './components/support/SupportFollowupsPage';
import { SupportReportsPage } from './components/support/SupportReportsPage';

// Customer Pages
import { CustomerCardsView } from './components/CustomerCardsView';
import { CustomerAccountsPage } from './components/customer/CustomerAccountsPage';
import { CustomerTransactionsPage } from './components/customer/CustomerTransactionsPage';
import { CustomerKycPage } from './components/customer/CustomerKycPage';
import { CustomerDocumentsPage } from './components/customer/CustomerDocumentsPage';
import { CustomerSupportPage } from './components/customer/CustomerSupportPage';
import { CustomerNotificationsPage } from './components/customer/CustomerNotificationsPage';
import { CustomerSettingsPage } from './components/customer/CustomerSettingsPage';

import {
  Menu,
  Bot,
  ShieldAlert,
  ArrowLeft,
  Lock,
  Building2,
  Globe,
} from 'lucide-react';

export default function App() {
  // Authentication State
  const [session, setSession] = useState<AuthSession | null>(null);
  const [impersonatingAdmin, setImpersonatingAdmin] = useState<UserAccount | null>(null);
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'signup' | 'app'>('landing');

  // Active Route State (synchronized with window.location.pathname)
  const [currentRoute, setCurrentRoute] = useState<string>('/customer/dashboard');

  // Users Directory in State (Initialized from stored users)
  const [usersList, setUsersList] = useState<UserAccount[]>([]);

  // Mobile sidebar toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Finova AI Copilot modal toggle
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Multi-Tenant Selected Tenant for Super Admin inspection
  const [selectedTenantId, setSelectedTenantId] = useState<string>('ALL');

  // Synchronize route and browser URL history
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

  // Dynamically load users from Supabase public.profiles with local fallback
  const refreshUsersListAsync = useCallback(async () => {
    if (isSupabaseConfigured()) {
      try {
        const res = await fetchProfilesResultFromDb();
        if (res.state === 'live_records' && res.data && res.data.length > 0) {
          const stored = getStoredUsers().map(({ passwordHash, ...u }) => u);
          const liveIds = new Set(res.data.map((p) => p.id));
          const liveEmails = new Set(res.data.map((p) => p.email.toLowerCase()));

          // Merge: live Supabase profiles are authoritative + non-duplicate demo accounts
          const nonConflictingLocal = stored.filter(
            (u) => !liveIds.has(u.id) && !liveEmails.has(u.email.toLowerCase())
          );
          setUsersList([...res.data, ...nonConflictingLocal]);
          return;
        }
      } catch (err) {
        console.warn('Failed querying live profiles from Supabase:', err);
      }
    }

    const loadedUsers = getStoredUsers().map(({ passwordHash, ...u }) => u);
    setUsersList(loadedUsers);
  }, []);

  // Initialize from storage & pathname on mount + Supabase Auth listener
  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      // 1. Priority: Check live Supabase Auth session first
      if (isSupabaseConfigured()) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const sbSession = sessionData?.session;
          if (sbSession?.user) {
            const profileRes = await loadCurrentUserProfileAsync();
            if (!isCancelled && profileRes.success && profileRes.session) {
              setSession(profileRes.session);
              setCurrentView('app');
              const pathname = window.location.pathname;
              if (pathname && pathname !== '/' && isRouteAllowed(pathname, profileRes.session.user.role)) {
                setCurrentRoute(pathname);
              } else {
                navigateTo(ROLE_DEFAULT_ROUTES[profileRes.session.user.role], true);
              }
              return;
            }
          }
        } catch (err) {
          console.warn('Supabase session restoration notice:', err);
        }
      }

      // 2. Fallback to locally stored session (e.g. demo personas)
      const existingSession = getStoredSession();
      const pathname = window.location.pathname;

      if (!isCancelled) {
        if (existingSession) {
          setSession(existingSession);
          setCurrentView('app');

          // Check if pathname is valid for user role
          if (pathname && pathname !== '/' && isRouteAllowed(pathname, existingSession.user.role)) {
            setCurrentRoute(pathname);
          } else {
            const defaultRoute = ROLE_DEFAULT_ROUTES[existingSession.user.role];
            navigateTo(defaultRoute, true);
          }
        } else {
          if (pathname === '/login') {
            setCurrentView('login');
          } else if (pathname === '/signup') {
            setCurrentView('signup');
          } else {
            setCurrentView('landing');
          }
        }
      }
    };

    restoreSession();
    refreshUsersListAsync();

    // Listen to user registration events from signup
    const handleRegisteredEvent = (e: Event) => {
      const customEv = e as CustomEvent<UserAccount>;
      if (customEv.detail) {
        setUsersList((prev) => {
          const exists = prev.some(
            (u) =>
              u.id === customEv.detail.id ||
              u.email.toLowerCase() === customEv.detail.email.toLowerCase()
          );
          if (exists) {
            return prev.map((u) => (u.id === customEv.detail.id ? customEv.detail : u));
          }
          return [customEv.detail, ...prev];
        });
      }
      refreshUsersListAsync();
    };

    const handleProfileUpdatedEvent = () => {
      refreshUsersListAsync();
    };

    window.addEventListener('finova:user_registered', handleRegisteredEvent);
    window.addEventListener('finova:profile_updated', handleProfileUpdatedEvent);

    // Listen for Supabase session changes without causing event loops
    if (isSupabaseConfigured()) {
      let lastUserId: string | null = null;

      const { data: authSubscription } = supabase.auth.onAuthStateChange(async (event, sbSession) => {
        if (isCancelled) return;

        if (event === 'SIGNED_OUT') {
          lastUserId = null;
          clearSession();
          setSession(null);
          setCurrentView('landing');
          refreshUsersListAsync();
        } else if (
          (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
          sbSession?.user
        ) {
          // Avoid duplicate redundant profile fetches if the user is already loaded
          if (lastUserId === sbSession.user.id) return;
          lastUserId = sbSession.user.id;

          const profileRes = await loadCurrentUserProfileAsync();
          if (!isCancelled && profileRes.success && profileRes.session) {
            setSession(profileRes.session);
            setCurrentView('app');
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

      return () => {
        isCancelled = true;
        window.removeEventListener('finova:user_registered', handleRegisteredEvent);
        window.removeEventListener('finova:profile_updated', handleProfileUpdatedEvent);
        authSubscription?.subscription?.unsubscribe();
      };
    }

    return () => {
      isCancelled = true;
      window.removeEventListener('finova:user_registered', handleRegisteredEvent);
      window.removeEventListener('finova:profile_updated', handleProfileUpdatedEvent);
    };
  }, [navigateTo, refreshUsersListAsync]);

  // Handle popstate (back/forward browser buttons)
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

  const handleUpdateUsers = (newUsers: UserAccount[]) => {
    setUsersList(newUsers);
    const currentStored = getStoredUsers();
    const merged = newUsers.map((u) => {
      const match = currentStored.find((c) => c.id === u.id);
      return {
        ...u,
        passwordHash: match?.passwordHash || 'finova2026',
      };
    });
    saveStoredUsers(merged);

    if (isSupabaseConfigured()) {
      for (const u of newUsers) {
        if (u.authSource === 'supabase') {
          saveProfileToDb(u).catch((err) => console.warn('Supabase profile sync note:', err));
        }
      }
    }
  };

  // Registration handler: immediately registers new profile into directory state and routes to dashboard
  const handleSignupSuccess = (user: UserAccount) => {
    setUsersList((prev) => {
      const exists = prev.some(
        (u) =>
          u.id === user.id ||
          u.email.toLowerCase() === user.email.toLowerCase()
      );
      if (exists) return prev.map((u) => (u.id === user.id ? user : u));
      return [user, ...prev];
    });
    handleLoginSuccess(user);
    refreshUsersListAsync();
  };

  // Login handler: Reads role directly from authenticated user and routes to assigned dashboard
  const handleLoginSuccess = (user: UserAccount) => {
    setImpersonatingAdmin(null);
    const active = getStoredSession();
    if (active) {
      setSession(active);
    } else {
      const newSession: AuthSession = {
        token: `jwt_${user.id}`,
        user,
        expiresAt: Date.now() + 86400000,
      };
      setSession(newSession);
      saveSession(newSession);
    }

    setCurrentView('app');
    const targetRoute = ROLE_DEFAULT_ROUTES[user.role];
    navigateTo(targetRoute);
  };

  // Super Admin Role Switching (Exclusively inside Settings -> User Management)
  const handleSuperAdminSwitchRole = (targetUser: UserAccount) => {
    if (session && session.user.role === 'SUPER_ADMIN') {
      setImpersonatingAdmin(session.user);
    }
    const newSession: AuthSession = {
      token: `jwt_${targetUser.id}`,
      user: targetUser,
      expiresAt: Date.now() + 86400000,
    };
    setSession(newSession);
    saveSession(newSession);

    const targetRoute = ROLE_DEFAULT_ROUTES[targetUser.role];
    navigateTo(targetRoute);
  };

  const handleReturnToSuperAdmin = () => {
    if (impersonatingAdmin) {
      const adminSession: AuthSession = {
        token: `jwt_${impersonatingAdmin.id}`,
        user: impersonatingAdmin,
        expiresAt: Date.now() + 86400000,
      };
      setSession(adminSession);
      saveSession(adminSession);
      setImpersonatingAdmin(null);
      navigateTo('/super-admin/user-management');
    }
  };

  const handleProfileUpdated = (updatedUser: UserAccount) => {
    if (session) {
      setSession({
        ...session,
        user: updatedUser,
      });
    }
    setUsersList((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  // Logout handler: Clears session and returns to landing page
  const handleLogout = () => {
    signOutUserAsync().catch((err) => console.warn('Supabase signout notice:', err));
    clearSession();
    setSession(null);
    setImpersonatingAdmin(null);
    setCurrentView('landing');
    setMobileMenuOpen(false);
    window.history.pushState(null, '', '/');
  };

  // ==========================================================
  // UN-AUTHENTICATED PUBLIC VIEWS
  // ==========================================================
  if (currentView === 'landing' || !session) {
    if (currentView === 'login') {
      return (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onGoToSignup={() => {
            setCurrentView('signup');
            window.history.pushState(null, '', '/signup');
          }}
          onBackToLanding={() => {
            setCurrentView('landing');
            window.history.pushState(null, '', '/');
          }}
        />
      );
    }

    if (currentView === 'signup') {
      return (
        <SignupPage
          onSignupSuccess={handleLoginSuccess}
          onGoToLogin={() => {
            setCurrentView('login');
            window.history.pushState(null, '', '/login');
          }}
          onBackToLanding={() => {
            setCurrentView('landing');
            window.history.pushState(null, '', '/');
          }}
        />
      );
    }

    return (
      <LandingPage
        onGoToLogin={() => {
          setCurrentView('login');
          window.history.pushState(null, '', '/login');
        }}
        onGoToSignup={() => {
          setCurrentView('signup');
          window.history.pushState(null, '', '/signup');
        }}
      />
    );
  }

  // ==========================================================
  // AUTHENTICATED USER PORTAL (ROLE-BASED ISOLATION)
  // ==========================================================
  const currentUser = session.user;
  const userRole = currentUser.role;
  const routeMeta = getRouteMeta(currentRoute, userRole);
  const routeAllowed = isRouteAllowed(currentRoute, userRole);

  // Render Page Content Component according to active route
  const renderRouteContent = () => {
    if (!routeAllowed) {
      return (
        <div className="rounded-2xl p-8 bg-[#1E1E1E] border border-[#C08A00] shadow-2xl text-center space-y-4 max-w-xl mx-auto my-12">
          <div className="w-16 h-16 rounded-full bg-[#301B05] border border-[#C08A00] text-[#F5C542] flex items-center justify-center mx-auto">
            <Lock size={28} />
          </div>
          <h2 className="font-cinzel text-xl font-bold text-[#FFF8E7]">
            Clearance Restricted • Access Denied
          </h2>
          <p className="font-mono text-xs text-[#FAF7F0]/80">
            Your current institutional credentials ({userRole.replace('_', ' ')}) do not possess
            clearance for route: <code className="text-[#F5C542]">{currentRoute}</code>.
          </p>
          <button
            onClick={() => navigateTo(ROLE_DEFAULT_ROUTES[userRole])}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg"
          >
            Return to Authorized Dashboard
          </button>
        </div>
      );
    }

    // 1. SUPER ADMIN ROUTES
    if (userRole === 'SUPER_ADMIN') {
      switch (currentRoute) {
        case '/super-admin/dashboard':
          return (
            <SuperAdminDashboard
              currentRole={userRole}
              users={usersList}
              onUpdateUsers={handleUpdateUsers}
              onRefreshUsers={refreshUsersListAsync}
              onOpenCopilot={() => setCopilotOpen(true)}
              selectedTenantId={selectedTenantId}
              onSelectTenant={setSelectedTenantId}
              onNavigate={navigateTo}
            />
          );
        case '/super-admin/company-workspaces':
          return (
            <SuperAdminCompanyWorkspacesPage
              onInspectTenant={(tId) => {
                setSelectedTenantId(tId);
                navigateTo('/super-admin/dashboard');
              }}
            />
          );
        case '/super-admin/user-management':
          return (
            <SuperAdminSettingsView
              users={usersList}
              onUpdateUsers={handleUpdateUsers}
              onRefreshUsers={refreshUsersListAsync}
              onImpersonateUser={handleSuperAdminSwitchRole}
              initialTab="users"
              initialRoleFilter="ALL"
            />
          );
        case '/super-admin/rbac':
          return <SuperAdminRbacPage />;
        case '/super-admin/system-configuration':
          return <SuperAdminSystemConfigPage />;
        case '/super-admin/ai-configuration':
          return <SuperAdminAiConfigPage />;
        case '/super-admin/audit-logs':
          return <SuperAdminAuditLogsPage />;
        case '/super-admin/enterprise-analytics':
          return <SuperAdminEnterpriseAnalyticsPage />;
        case '/super-admin/reports':
          return <ReportsView />;
        case '/super-admin/profile':
          return <ProfileView currentRole={userRole} userName={currentUser.name} currentUser={currentUser} onUpdateUser={handleProfileUpdated} />;

        // Super Admin Platform Engines
        case '/super-admin/ai-assistant':
          return <FinovaAiAssistantPage currentRole={userRole} userName={currentUser.name} />;
        case '/super-admin/document-ocr':
          return <DocumentOcrPage />;
        case '/super-admin/transaction-classification':
          return <TransactionClassificationPage />;
        case '/super-admin/kyc-verification':
          return <KycVerificationPage />;
        case '/super-admin/fraud-aml':
          return <FraudAmlPage />;
        case '/super-admin/case-management':
          return <CaseManagementPage />;
        case '/super-admin/excel-visualization':
          return <ExcelVisualizationPage />;

        default:
          return (
            <SuperAdminDashboard
              currentRole={userRole}
              users={usersList}
              onUpdateUsers={handleUpdateUsers}
              onRefreshUsers={refreshUsersListAsync}
              onOpenCopilot={() => setCopilotOpen(true)}
              selectedTenantId={selectedTenantId}
              onSelectTenant={setSelectedTenantId}
              onNavigate={navigateTo}
            />
          );
      }
    }

    // 2. ADMIN ROUTES
    if (userRole === 'ADMIN') {
      switch (currentRoute) {
        case '/admin/dashboard':
          return (
            <AdminDashboard
              currentRole={userRole}
              users={usersList}
              onUpdateUsers={handleUpdateUsers}
              onRefreshUsers={refreshUsersListAsync}
              currentUser={currentUser}
            />
          );
        case '/admin/user-management':
          return (
            <AdminUserManagementPage
              users={usersList}
              onUpdateUsers={handleUpdateUsers}
              onRefreshUsers={refreshUsersListAsync}
              currentUser={currentUser}
            />
          );
        case '/admin/operations-management':
          return <AdminOperationsPage />;
        case '/admin/customer-management':
          return (
            <AdminCustomerManagementPage
              users={usersList}
              onRefreshUsers={refreshUsersListAsync}
              currentUser={currentUser}
            />
          );
        case '/admin/reports':
          return <ReportsView />;
        case '/admin/profile':
          return <ProfileView currentRole={userRole} userName={currentUser.name} currentUser={currentUser} onUpdateUser={handleProfileUpdated} />;

        // Admin Platform Engines
        case '/admin/ai-assistant':
          return <FinovaAiAssistantPage currentRole={userRole} userName={currentUser.name} />;
        case '/admin/document-ocr':
          return <DocumentOcrPage />;
        case '/admin/transaction-classification':
          return <TransactionClassificationPage />;
        case '/admin/kyc-verification':
          return <KycVerificationPage />;
        case '/admin/fraud-aml':
          return <FraudAmlPage />;
        case '/admin/case-management':
          return <CaseManagementPage />;

        default:
          return (
            <AdminDashboard
              currentRole={userRole}
              users={usersList}
              onUpdateUsers={handleUpdateUsers}
              onRefreshUsers={refreshUsersListAsync}
              currentUser={currentUser}
            />
          );
      }
    }

    // 3. FINANCE ANALYST ROUTES
    if (userRole === 'FINANCE_ANALYST') {
      switch (currentRoute) {
        case '/finance/dashboard':
          return (
            <FinanceAnalystDashboard
              currentRole={userRole}
              users={usersList}
              onUpdateUsers={handleUpdateUsers}
              currentUser={currentUser}
            />
          );
        case '/finance/transaction-analytics':
          return <FinanceTransactionAnalyticsPage />;
        case '/finance/fraud-detection':
          return <FinanceFraudDetectionPage />;
        case '/finance/aml-monitoring':
          return <FinanceAmlMonitoringPage />;
        case '/finance/kyc-verification':
          return <KycVerificationPage />;
        case '/finance/risk-scoring':
          return <FinanceRiskScoringPage />;
        case '/finance/customer-financial-insights':
          return <FinanceCustomerInsightsPage />;
        case '/finance/reports':
          return <ReportsView />;
        case '/finance/profile':
          return <ProfileView currentRole={userRole} userName={currentUser.name} currentUser={currentUser} onUpdateUser={handleProfileUpdated} />;

        // Finance Platform Engines
        case '/finance/ai-assistant':
          return <FinovaAiAssistantPage currentRole={userRole} userName={currentUser.name} />;
        case '/finance/transaction-classification':
          return <TransactionClassificationPage />;
        case '/finance/fraud-aml':
          return <FraudAmlPage />;
        case '/finance/excel-visualization':
          return <ExcelVisualizationPage />;

        default:
          return (
            <FinanceAnalystDashboard
              currentRole={userRole}
              users={usersList}
              onUpdateUsers={handleUpdateUsers}
              currentUser={currentUser}
            />
          );
      }
    }

    // 4. SUPPORT EXECUTIVE ROUTES
    if (userRole === 'SUPPORT_EXECUTIVE') {
      switch (currentRoute) {
        case '/support/dashboard':
          return (
            <SupportExecutiveDashboard
              currentRole={userRole}
              users={usersList}
              onUpdateUsers={handleUpdateUsers}
              currentUser={currentUser}
            />
          );
        case '/support/tickets':
          return <SupportTicketsPage />;
        case '/support/customer-queries':
          return <SupportCustomerQueriesPage />;
        case '/support/complaint-resolution':
          return <SupportComplaintResolutionPage />;
        case '/support/followups':
          return <SupportFollowupsPage />;
        case '/support/case-management':
          return <CaseManagementPage />;
        case '/support/reports':
          return <SupportReportsPage />;
        case '/support/profile':
          return <ProfileView currentRole={userRole} userName={currentUser.name} currentUser={currentUser} onUpdateUser={handleProfileUpdated} />;

        // Support Platform Engines
        case '/support/ai-assistant':
          return <FinovaAiAssistantPage currentRole={userRole} userName={currentUser.name} />;
        case '/support/document-ocr':
          return <DocumentOcrPage />;

        default:
          return (
            <SupportExecutiveDashboard
              currentRole={userRole}
              users={usersList}
              onUpdateUsers={handleUpdateUsers}
              currentUser={currentUser}
            />
          );
      }
    }

    // 5. CUSTOMER ROUTES
    if (userRole === 'CUSTOMER') {
      switch (currentRoute) {
        case '/customer/dashboard':
          return (
            <CustomerDashboard
              onOpenCopilot={() => setCopilotOpen(true)}
              currentUser={currentUser}
              onNavigateSection={(route) => navigateTo(route)}
            />
          );
        case '/customer/profile':
          return <ProfileView currentRole={userRole} userName={currentUser.name} currentUser={currentUser} onUpdateUser={handleProfileUpdated} />;
        case '/customer/accounts':
          return <CustomerAccountsPage />;
        case '/customer/transactions':
          return <CustomerTransactionsPage />;
        case '/customer/cards':
          return <CustomerCardsView customerName={currentUser.name} />;
        case '/customer/kyc':
          return <CustomerKycPage />;
        case '/customer/documents':
          return <CustomerDocumentsPage />;
        case '/customer/ai-assistant':
          return <FinovaAiAssistantPage currentRole={userRole} userName={currentUser.name} />;
        case '/customer/support':
          return <CustomerSupportPage />;
        case '/customer/notifications':
          return <CustomerNotificationsPage />;
        case '/customer/settings':
          return <CustomerSettingsPage />;

        default:
          return (
            <CustomerDashboard
              onOpenCopilot={() => setCopilotOpen(true)}
              currentUser={currentUser}
              onNavigateSection={(route) => navigateTo(route)}
            />
          );
      }
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#121212] text-[#FAF7F0] flex flex-col lg:flex-row antialiased selection:bg-[#D4A017] selection:text-[#1A1A1A]">
      {/* ========================================================
          DYNAMIC ROLE-BASED SIDEBAR
          Every sidebar item is a functional route!
          ======================================================== */}
      <RoleSidebar
        currentUser={currentUser}
        currentRoute={currentRoute}
        onNavigate={navigateTo}
        onLogout={handleLogout}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Backdrop for Mobile Sidebar */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/75 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* ========================================================
          MAIN CONTENT AREA
          ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ========================================================
            DASHBOARD HEADER: Official Golden Logo & Controls
            ======================================================== */}
        <header className="sticky top-0 z-30 bg-[#262626]/95 backdrop-blur-xl border-b border-[#3A3A3A] px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[#D4A017] hover:text-[#E6C78B]"
            >
              <Menu size={18} />
            </button>

            {/* Official Logo in Dashboard Header */}
            <div className="flex items-center gap-2">
              <FinovaLogo variant="compact" size="sm" className="hidden sm:inline-flex" />
              <FinovaLogo variant="icon" size="sm" className="sm:hidden" />
              <div className="hidden xl:flex items-center gap-2 pl-4 border-l border-[#3A3A3A]">
                <span className="w-2 h-2 rounded-full bg-[#D4A017] animate-pulse" />
                <span className="text-[11px] font-mono text-[#9CA3AF]">
                  Uptime: 99.992% • SWIFT GPI / FedNow Active
                </span>
              </div>
            </div>
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center gap-3">
            {/* Multi-Tenant Workspace Context */}
            {userRole === 'SUPER_ADMIN' ? (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121212] border border-[#3A3A3A] text-xs font-mono">
                <Globe size={13} className="text-[#D4A017] shrink-0" />
                <span className="text-[#9CA3AF] text-[11px]">Workspace:</span>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="bg-transparent text-[#E6C78B] font-bold text-xs focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL">All Workspaces (Aggregate)</option>
                  {getStoredTenants().map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shortName || t.name} ({t.currency})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121212] border border-[#3A3A3A] text-xs font-mono text-[#E6C78B]">
                <Building2 size={13} className="text-[#D4A017] shrink-0" />
                <span className="font-bold">{currentUser.tenantName || 'Apex Global Bank'}</span>
              </div>
            )}

            {/* User Identity & Live Supabase / Demo Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121212] border border-[#3A3A3A] text-xs font-mono">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#D4A017] to-[#E6C78B] flex items-center justify-center text-[#1A1A1A] font-bold text-[10px]">
                {currentUser.name.charAt(0)}
              </div>
              <span className="font-bold text-[#FAF7F0] truncate max-w-[130px]">{currentUser.name}</span>
              {session?.source === 'supabase' || currentUser.authSource === 'supabase' ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1" title="Authenticated with live Supabase PostgreSQL session">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live DB
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700" title="Demo persona session (RLS active)">
                  Demo
                </span>
              )}
            </div>

            {/* Authenticated Role Tag */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121212] border border-[#3A3A3A] text-xs font-mono text-[#E6C78B]">
              <span className="w-2 h-2 rounded-full bg-[#D4A017]" />
              <span className="font-bold uppercase tracking-wider">{userRole.replace('_', ' ')}</span>
            </div>

            {/* Finova AI Copilot Trigger */}
            <button
              onClick={() => setCopilotOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_15px_rgba(212,160,23,0.35)] transition-all"
            >
              <Bot size={15} />
              <span className="hidden sm:inline">AI Copilot</span>
            </button>
          </div>
        </header>

        {/* Super Admin Impersonation Notice Banner */}
        {impersonatingAdmin && (
          <div className="bg-gradient-to-r from-[#301B05] via-[#4A2C0A] to-[#301B05] border-b border-[#D4A017] px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs font-mono text-[#FFF8E7] shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F5C542] animate-ping" />
              <span>
                <strong>Super Admin Governance Session:</strong> Auditing as{' '}
                <span className="text-[#F5C542] font-bold">{currentUser.name}</span> ({userRole.replace('_', ' ')})
              </span>
            </div>
            <button
              onClick={handleReturnToSuperAdmin}
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-[11px] hover:brightness-110 shadow-[0_0_10px_rgba(212,160,23,0.4)]"
            >
              ← Return to Super Admin Master Settings
            </button>
          </div>
        )}

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Breadcrumb Navigation Trail */}
          <Breadcrumbs
            routeMeta={routeMeta}
            onNavigateHome={() => navigateTo(ROLE_DEFAULT_ROUTES[userRole])}
          />

          {/* Active Route Content */}
          {renderRouteContent()}
        </main>
      </div>

      {/* Finova AI Copilot Drawer */}
      <FinovaAiCopilot
        currentRole={userRole}
        userName={currentUser.name}
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
    </div>
  );
}
