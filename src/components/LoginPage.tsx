import React, { useState, useEffect } from 'react';
import { FinovaLogo } from './FinovaLogo';
import { authenticateUser, authenticateUserAsync } from '../data/authStore';
import { isSupabaseConfigured, SUPABASE_PROJECT_URL, checkSupabaseConnection, ConnectionStatus, signInWithGoogleOAuth } from '../lib/supabase';
import { UserAccount } from '../data/finovaDatasets';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, Key, ArrowRight, Building2, Globe, CheckCircle2, Database, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount) => void;
  onGoToSignup: () => void;
  onBackToLanding: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onGoToSignup,
  onBackToLanding,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    checkSupabaseConnection().then(setConnectionStatus);
  }, []);

  // Submit Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const res = await authenticateUserAsync(email, password);
      setLoading(false);

      if (res.success && res.session) {
        onLoginSuccess(res.session.user);
      } else {
        setErrorMessage(res.error || 'Authentication failed. Please verify institutional credentials.');
      }
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Authentication encountered an unexpected error.';
      setErrorMessage(msg);
    }
  };

  const handleGoogleOAuth = async () => {
    setErrorMessage('');
    setOauthLoading(true);
    try {
      const res = await signInWithGoogleOAuth();
      setOauthLoading(false);
      if (res.error) {
        setErrorMessage(`Google OAuth: ${res.error}. Ensure Google provider is enabled in Supabase Auth settings.`);
      } else if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: unknown) {
      setOauthLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Google OAuth error: ${msg}`);
    }
  };

  // Quick fill helper for personas
  const handleQuickFill = (targetEmail: string) => {
    setEmail(targetEmail);
    setPassword('finova2026');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-[#121212] text-[#FAF7F0] flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Background Gold/Copper Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-[#D4A017]/10 via-[#B87333]/10 to-transparent rounded-full blur-[150px] pointer-events-none" />

      {/* Top Header */}
      <div className="flex items-center justify-between z-10 max-w-6xl mx-auto w-full">
        <FinovaLogo variant="full" size="md" />
        <button
          onClick={onBackToLanding}
          className="text-xs font-mono text-[#D4A017] hover:text-[#E6C78B] transition-colors"
        >
          ← Return to Public Home
        </button>
      </div>

      {/* Main Authentication Box */}
      <div className="max-w-xl w-full mx-auto my-6 z-10">
        <div className="bg-[#262626]/95 border border-[#3A3A3A] hover:border-[#D4A017]/40 transition-colors rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl p-6 sm:p-8">
          {/* Logo on Login Page */}
          <div className="flex flex-col items-center text-center pb-5 border-b border-[#3A3A3A]">
            <FinovaLogo variant="icon" size="lg" className="mb-2.5" />
            <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017]">
              Sovereign Multi-Tenant Portal
            </h2>
            <p className="font-mono text-xs text-[#E6C78B] mt-1">
              Data. Intelligence. Better Decisions.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#121212] border border-[#3A3A3A] text-[10px] font-mono text-[#9CA3AF]">
                <Globe size={11} className="text-[#D4A017]" />
                <span>Multi-Tenant Financial Operations SaaS</span>
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono border ${
                  connectionStatus?.connected
                    ? 'bg-[#121212] border-[#D4A017]/40 text-[#E6C78B]'
                    : 'bg-[#121212] border-[#3A3A3A] text-[#9CA3AF]'
                }`}
              >
                <Database size={11} className={connectionStatus?.connected ? 'text-[#D4A017]' : 'text-[#B87333]'} />
                <span>
                  {connectionStatus?.connected
                    ? 'Supabase: Connected'
                    : connectionStatus?.configured
                    ? 'Supabase: Connecting...'
                    : 'Supabase: Hybrid Mode (Local/Cloud)'}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="mt-5 space-y-4 font-mono text-xs">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-[#262626] border border-[#B87333] text-[#FAF7F0] text-xs">
                ⚠ {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-[#E6C78B] mb-1 font-semibold">Institutional Corporate Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="principal@finova.ai"
                  className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 pl-9 text-xs text-[#FAF7F0] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#D4A017]"
                />
                <Mail size={15} className="absolute left-3 top-3 text-[#D4A017]" />
              </div>
            </div>

            <div>
              <label className="block text-[#E6C78B] mb-1 font-semibold">Master Access Key (Password)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 pl-9 pr-9 text-xs text-[#FAF7F0] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#D4A017]"
                />
                <Lock size={15} className="absolute left-3 top-3 text-[#D4A017]" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#9CA3AF] hover:text-[#E6C78B]"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-[#121212] border-[#3A3A3A] text-[#D4A017] focus:ring-0"
                />
                <span>Enforce hardware session persistence</span>
              </label>
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(true)}
                className="text-[#D4A017] hover:text-[#E6C78B] transition-colors"
              >
                Recover credentials
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs uppercase tracking-wider hover:brightness-110 shadow-[0_4px_20px_rgba(212,160,23,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating Workspace...</span>
              ) : (
                <>
                  <Key size={14} />
                  <span>Authenticate & Enter Workspace</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Google OAuth Option */}
          <div className="mt-3">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-[#3A3A3A]"></div>
              <span className="flex-shrink mx-3 text-[10px] font-mono text-[#9CA3AF] uppercase">Or SSO Access</span>
              <div className="flex-grow border-t border-[#3A3A3A]"></div>
            </div>
            <button
              type="button"
              disabled={oauthLoading}
              onClick={handleGoogleOAuth}
              className="w-full py-2.5 px-4 rounded-xl bg-[#121212] hover:bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#D4A017]/60 text-xs font-mono text-[#FAF7F0] flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{oauthLoading ? 'Initiating Google OAuth...' : 'Sign In with Google Workspace'}</span>
            </button>
          </div>

          {/* Switch to Signup */}
          <div className="mt-4 pt-4 border-t border-[#3A3A3A] text-center font-mono text-xs text-[#9CA3AF]">
            New financial customer?{' '}
            <button
              onClick={onGoToSignup}
              className="text-[#D4A017] font-bold hover:text-[#E6C78B] underline transition-colors"
            >
              Open Institutional Account
            </button>
          </div>

          {/* MULTI-TENANT DEMO PERSONAS MATRIX */}
          <div className="mt-5 pt-4 border-t border-[#3A3A3A]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold text-[#E6C78B] flex items-center gap-1.5">
                <Building2 size={13} className="text-[#D4A017]" />
                Multi-Tenant Demo Quick Access (Password: finova2026)
              </span>
            </div>

            {/* Platform Super Admin */}
            <div className="mb-2">
              <button
                type="button"
                onClick={() => handleQuickFill('superadmin@finova.ai')}
                className="w-full p-2 rounded-xl bg-[#121212] hover:bg-[#262626] border border-[#D4A017]/40 text-left flex items-center justify-between transition-all group"
              >
                <div>
                  <span className="font-bold text-[#D4A017] text-[11px] group-hover:text-[#E6C78B]">
                    Alexander Vance (Platform Super Admin)
                  </span>
                  <span className="block text-[10px] text-[#9CA3AF]">superadmin@finova.ai • Global SaaS Operator</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#D4A017] text-[#1A1A1A]">
                  PLATFORM ROOT
                </span>
              </button>
            </div>

            {/* Tenant Accordions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono">
              {/* Tenant 1: Apex Global Bank */}
              <div className="p-2.5 rounded-xl bg-[#121212] border border-[#3A3A3A] space-y-1.5">
                <div className="font-bold text-[#E6C78B] border-b border-[#3A3A3A] pb-1 flex items-center justify-between">
                  <span>Apex Global Bank</span>
                  <span className="text-[8px] px-1 rounded bg-[#262626] text-[#D4A017]">[USD $]</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@finova.ai')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Eleanor (Admin)</span>
                  <span className="text-[#D4A017]">admin@</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('analyst@finova.ai')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Julian (Analyst)</span>
                  <span className="text-[#B87333]">analyst@</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('support@finova.ai')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Claire (Support)</span>
                  <span className="text-[#9CA3AF]">support@</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('customer@croftcapital.com')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Harrison (Cust)</span>
                  <span className="text-[#E6C78B]">customer@</span>
                </button>
              </div>

              {/* Tenant 2: Crestview Finance NBFC */}
              <div className="p-2.5 rounded-xl bg-[#121212] border border-[#3A3A3A] space-y-1.5">
                <div className="font-bold text-[#E6C78B] border-b border-[#3A3A3A] pb-1 flex items-center justify-between">
                  <span>Crestview NBFC</span>
                  <span className="text-[8px] px-1 rounded bg-[#262626] text-[#B87333]">[GBP £]</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@crestviewfinance.com')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Marcus (Admin)</span>
                  <span className="text-[#D4A017]">admin@</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('analyst@crestviewfinance.com')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Sophia (Analyst)</span>
                  <span className="text-[#B87333]">analyst@</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('support@crestviewfinance.com')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">David (Support)</span>
                  <span className="text-[#9CA3AF]">support@</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('customer@rostovacapital.co.uk')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Elena (Cust)</span>
                  <span className="text-[#E6C78B]">customer@</span>
                </button>
              </div>

              {/* Tenant 3: Vanguard Wealth */}
              <div className="p-2.5 rounded-xl bg-[#121212] border border-[#3A3A3A] space-y-1.5">
                <div className="font-bold text-[#E6C78B] border-b border-[#3A3A3A] pb-1 flex items-center justify-between">
                  <span>Vanguard Wealth</span>
                  <span className="text-[8px] px-1 rounded bg-[#262626] text-[#E6C78B]">[EUR €]</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@vanguardwealth.eu')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Catherine (Admin)</span>
                  <span className="text-[#D4A017]">admin@</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('analyst@vanguardwealth.eu')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Rajesh (Analyst)</span>
                  <span className="text-[#B87333]">analyst@</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('support@vanguardwealth.eu')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Amara (Support)</span>
                  <span className="text-[#9CA3AF]">support@</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('customer@sterlingsfo.ch')}
                  className="w-full text-left p-1 rounded bg-[#262626] hover:bg-[#3A3A3A] text-[#FAF7F0] flex justify-between"
                >
                  <span className="truncate">Lucian (Cust)</span>
                  <span className="text-[#E6C78B]">customer@</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#262626] border border-[#3A3A3A] rounded-2xl p-6 max-w-sm w-full font-mono text-xs">
            <h3 className="font-cinzel text-base font-bold text-[#FAF7F0]">
              Reset Institutional Credentials
            </h3>
            <p className="text-[11px] text-[#9CA3AF] mt-1">
              Enter your registered company email to receive a recovery token.
            </p>

            {forgotSubmitted ? (
              <div className="my-5 p-3 rounded-xl bg-[#121212] border border-[#D4A017] text-[#E6C78B]">
                ✓ A cryptographic reset link has been dispatched to {forgotEmail}.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="registered@apexbank.com"
                  className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
                />
                <button
                  type="button"
                  onClick={() => setForgotSubmitted(true)}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold text-xs"
                >
                  Send Recovery Token
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setForgotPasswordOpen(false);
                setForgotSubmitted(false);
              }}
              className="mt-4 w-full py-1.5 text-center text-[11px] text-[#9CA3AF] hover:text-[#FAF7F0]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs font-mono text-[#9CA3AF] z-10 max-w-6xl mx-auto w-full">
        Finova AI Multi-Tenant SaaS Platform • Basel III Multi-Factor Compliance • Encrypted Tenant Vault Isolation
      </div>
    </div>
  );
};
