import React, { useState, useEffect } from 'react';
import { FinovaLogo } from './FinovaLogo';
import { registerCustomer, registerCustomerAsync } from '../data/authStore';
import { getStoredTenants } from '../data/tenantStore';
import { isSupabaseConfigured, checkSupabaseConnection, ConnectionStatus } from '../lib/supabase';
import { UserAccount } from '../data/finovaDatasets';
import { Lock, Mail, User, Phone, Eye, EyeOff, Building2, ArrowRight, Database } from 'lucide-react';

interface SignupPageProps {
  onSignupSuccess: (user: UserAccount) => void;
  onGoToLogin: () => void;
  onBackToLanding: () => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({
  onSignupSuccess,
  onGoToLogin,
  onBackToLanding,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    checkSupabaseConnection().then(setConnectionStatus);
  }, []);

  // Multi-tenant institution selector
  const tenants = getStoredTenants().filter((t) => t.status === 'Active');
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    tenants[0]?.id || 'tenant_apex_bank'
  );

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await registerCustomerAsync({
        fullName,
        email,
        phone,
        password,
        tenantId: selectedTenantId,
      });

      setLoading(false);

      if (res.success && res.session) {
        onSignupSuccess(res.session.user);
      } else if (res.requiresEmailConfirmation || (res.success && !res.session)) {
        setSuccessMessage(
          res.error ||
            'Account registration submitted to Supabase Auth! Please check your email to confirm your account, then sign in.'
        );
      } else {
        setErrorMessage(res.error || 'Registration failed. Please try again.');
      }
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Registration failed unexpectedly.';
      setErrorMessage(msg);
    }
  };

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

  return (
    <div className="min-h-screen bg-[#121212] text-[#FAF7F0] flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Background Gold Ambient Glow */}
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

      {/* Main Registration Card */}
      <div className="max-w-lg w-full mx-auto my-6 z-10">
        <div className="bg-[#262626]/95 border border-[#3A3A3A] hover:border-[#D4A017]/40 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl p-6 sm:p-8">
          {/* Logo on Signup Page */}
          <div className="flex flex-col items-center text-center pb-5 border-b border-[#3A3A3A]">
            <FinovaLogo variant="icon" size="lg" className="mb-2.5" />
            <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017]">
              Open Institutional Account
            </h2>
            <p className="font-mono text-xs text-[#E6C78B] mt-1">
              Select Your Financial Institution • Tier 3 Accredited Custody
            </p>
            <div
              className={`mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono border ${
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

          <form onSubmit={handleSignup} className="mt-5 space-y-4 font-mono text-xs">
            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                  <span>✓</span>
                  <span>Institutional Account Registration Submitted</span>
                </div>
                <div className="text-[11px] text-emerald-200/90 leading-relaxed">
                  {successMessage}
                </div>
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors"
                >
                  Proceed to Sign In →
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-[#262626] border border-[#B87333] text-[#FAF7F0] text-xs">
                ⚠ {errorMessage}
              </div>
            )}

            {/* Financial Institution / Bank Workspace Selector */}
            <div>
              <label className="block text-[#E6C78B] mb-1 font-semibold flex items-center gap-1.5">
                <Building2 size={13} className="text-[#D4A017]" />
                Select Financial Institution Workspace
              </label>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type} • {t.headquarters})
                  </option>
                ))}
              </select>
              {selectedTenant && (
                <div className="mt-1 text-[11px] text-[#9CA3AF] flex items-center justify-between">
                  <span>License: {selectedTenant.licenseNo}</span>
                  <span className="text-[#D4A017] font-bold">Currency: {selectedTenant.currency}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[#E6C78B] mb-1 font-semibold">Full Legal Name / Entity</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Lord Sterling Croft"
                  className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 pl-9 text-xs text-[#FAF7F0] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#D4A017]"
                />
                <User size={15} className="absolute left-3 top-3 text-[#D4A017]" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#E6C78B] mb-1 font-semibold">Corporate Email</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="harrison@familyoffice.com"
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 pl-9 text-xs text-[#FAF7F0] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#D4A017]"
                  />
                  <Mail size={15} className="absolute left-3 top-3 text-[#D4A017]" />
                </div>
              </div>

              <div>
                <label className="block text-[#E6C78B] mb-1 font-semibold">Contact Phone</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (212) 555-0199"
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 pl-9 text-xs text-[#FAF7F0] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#D4A017]"
                  />
                  <Phone size={15} className="absolute left-3 top-3 text-[#D4A017]" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#E6C78B] mb-1 font-semibold">Security Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 pl-9 text-xs text-[#FAF7F0] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#D4A017]"
                  />
                  <Lock size={15} className="absolute left-3 top-3 text-[#D4A017]" />
                </div>
              </div>

              <div>
                <label className="block text-[#E6C78B] mb-1 font-semibold">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 pl-9 text-xs text-[#FAF7F0] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#D4A017]"
                  />
                  <Lock size={15} className="absolute left-3 top-3 text-[#D4A017]" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs uppercase tracking-wider hover:brightness-110 shadow-[0_4px_20px_rgba(212,160,23,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Submitting KYC Registration...</span>
              ) : (
                <>
                  <span>Create Account at {selectedTenant?.shortName || 'Bank'}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Switch to Login */}
          <div className="mt-5 pt-4 border-t border-[#3A3A3A] text-center font-mono text-xs text-[#9CA3AF]">
            Already hold an institutional key?{' '}
            <button
              onClick={onGoToLogin}
              className="text-[#D4A017] font-bold hover:text-[#E6C78B] underline transition-colors"
            >
              Sign In to Your Workspace
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs font-mono text-[#9CA3AF] z-10 max-w-6xl mx-auto w-full">
        Finova AI Multi-Tenant SaaS Platform • Basel III Multi-Factor Compliance • Encrypted Institutional Vault Isolation
      </div>
    </div>
  );
};
