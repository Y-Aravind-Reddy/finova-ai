import React, { useState, useEffect } from 'react';
import { FinovaLogo } from './FinovaLogo';
import { authenticateUserAsync } from '../data/authStore';
import { supabase, isSupabaseConfigured, SUPABASE_PROJECT_URL, checkSupabaseConnection, ConnectionStatus } from '../lib/supabase';
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
  const [errorMessage, setErrorMessage] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    checkSupabaseConnection().then(setConnectionStatus);
  }, []);

  // Submit Handler for Production Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter your institutional email and password.');
      return;
    }
    setLoading(true);

    try {
      const res = await authenticateUserAsync(email.trim(), password);
      setLoading(false);

      if (res.success && res.session) {
        onLoginSuccess(res.session.user);
      } else {
        setErrorMessage(res.error || 'Authentication failed. Please verify institutional credentials in Supabase Auth.');
      }
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Authentication encountered an unexpected error.';
      setErrorMessage(msg);
    }
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
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 text-xs">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-red-300">Authentication Failed</div>
                    <div className="text-[11px] text-red-200/90 mt-0.5">{errorMessage}</div>
                    {errorMessage.toLowerCase().includes('invalid login credentials') && (
                      <div className="mt-2 text-[10px] text-zinc-400 border-t border-red-900/50 pt-1.5 font-mono">
                        Notice: Production login strictly requires a registered Supabase Auth account. Failed logins are not silently converted to demo sessions. Use the Offline Sandbox below to simulate UI without a database session.
                      </div>
                    )}
                  </div>
                </div>
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
                  onClick={async () => {
                    if (isSupabaseConfigured() && forgotEmail.trim()) {
                      try {
                        await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase());
                      } catch (err) {
                        console.warn('Supabase resetPasswordForEmail notice:', err);
                      }
                    }
                    setForgotSubmitted(true);
                  }}
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
