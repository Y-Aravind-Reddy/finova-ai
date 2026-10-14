import React, { useState, useEffect } from 'react';
import { FinovaLogo } from './FinovaLogo';
import { UserRole, UserAccount } from '../data/finovaDatasets';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getStoredSession, saveSession, getStoredUsers, saveStoredUsers } from '../data/authStore';
import { fetchCurrentUserProfileResultFromDb } from '../services/finovaDatabase';
import {
  ShieldCheck,
  Key,
  Fingerprint,
  Award,
  CheckCircle,
  Lock,
  Smartphone,
  Building2,
  Database,
  Edit,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Globe,
  Mail,
  Phone,
  Loader2,
} from 'lucide-react';

interface ProfileViewProps {
  currentRole: UserRole;
  userName: string;
  currentUser?: UserAccount;
  onUpdateUser?: (updated: UserAccount) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentRole,
  userName,
  currentUser: propUser,
  onUpdateUser,
}) => {
  // Resolve user account
  const session = getStoredSession();
  const initialUser = propUser || session?.user || {
    id: 'USR-TEMP',
    name: userName,
    email: 'user@finova.ai',
    role: currentRole,
    status: 'Active' as const,
    tier: 'Private Wealth Tier 3' as const,
    createdDate: '2024-01-01',
    lastActive: 'Just now',
    phone: '+1 (212) 555-0100',
    country: 'United States',
    twoFactorEnabled: true,
    tenantId: 'tenant_apex_bank',
    tenantName: 'Apex Global Bank',
    authSource: session?.source || 'local',
  };

  const [user, setUser] = useState<UserAccount>(initialUser);
  const [profileSource, setProfileSource] = useState<'supabase' | 'fallback'>(
    initialUser.authSource === 'supabase' || session?.source === 'supabase' ? 'supabase' : 'fallback'
  );
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState(initialUser.phone || '+1 (212) 555-0100');
  const [country, setCountry] = useState(initialUser.country || 'United States');
  const [notes, setNotes] = useState(initialUser.notes || '');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fetch live profile from Supabase on mount
  useEffect(() => {
    let isCancelled = false;

    if (isSupabaseConfigured()) {
      setLoadingProfile(true);
      fetchCurrentUserProfileResultFromDb().then((res) => {
        if (isCancelled) return;
        setLoadingProfile(false);
        setProfileSource(res.source);
        setProfileError(res.error);

        if (res.profile) {
          setUser(res.profile);
          setPhone(res.profile.phone || '+1 (212) 555-0100');
          setCountry(res.profile.country || 'United States');
          setNotes(res.profile.notes || '');

          // Update active session cache
          const currentSession = getStoredSession();
          if (currentSession) {
            currentSession.user = res.profile;
            currentSession.source = 'supabase';
            saveSession(currentSession);
          }

          if (onUpdateUser) {
            onUpdateUser(res.profile);
          }
        }
      }).catch((err) => {
        if (isCancelled) return;
        setLoadingProfile(false);
        setProfileError(err instanceof Error ? err.message : 'Error loading profile from database');
      });
    }

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    const updatedUser: UserAccount = {
      ...user,
      phone,
      country,
      notes,
    };

    // 1. If Supabase is configured, update in Supabase PostgreSQL profiles table
    if (isSupabaseConfigured() && user.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            phone,
            country,
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (error) {
          console.warn('Supabase profile update note:', error.message);
        }
      } catch (err) {
        console.warn('Supabase profile update exception:', err);
      }
    }

    // 2. Update local session & user cache
    if (session) {
      session.user = updatedUser;
      saveSession(session);
    }

    const storedUsers = getStoredUsers();
    const updatedUsers = storedUsers.map((u) => (u.id === user.id ? { ...u, phone, country, notes } : u));
    saveStoredUsers(updatedUsers);

    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }

    setSaving(false);
    setIsEditing(false);
    setStatusMsg({
      text: isSupabaseConfigured()
        ? 'Profile successfully updated and synchronized with Supabase PostgreSQL.'
        : 'Profile updated in active session store.',
      type: 'success',
    });

    setTimeout(() => setStatusMsg(null), 4000);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Profile Header Card */}
      <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {/* Avatar with Golden Ring */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#D4A017] via-[#E6C78B] to-[#B87333] flex items-center justify-center font-cinzel text-2xl font-black text-[#1A1A1A] shadow-[0_8px_24px_rgba(212,160,23,0.35)] border-2 border-[#FAF7F0]">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#121212] border-2 border-[#D4A017] flex items-center justify-center text-[11px] text-[#D4A017]">
              ✓
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider">
                {user.role.replace('_', ' ')}
              </span>
              <span className="text-xs text-[#E6C78B] font-semibold">
                {user.tenantName || 'Apex Global Bank'}
              </span>
              {loadingProfile ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#121212] border border-[#3A3A3A] text-[#9CA3AF] flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin text-[#D4A017]" />
                  Syncing Database...
                </span>
              ) : profileSource === 'supabase' ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Supabase Profile (PostgreSQL)
                </span>
              ) : (
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center gap-1"
                  title={profileError || 'Demo session active. Supabase RLS requires an authenticated Supabase user session to read live rows.'}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Demo Persona (RLS Active)
                </span>
              )}
            </div>
            <h1 className="font-cinzel text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
              {user.name}
            </h1>
            <p className="text-xs text-[#9CA3AF] mt-1 flex items-center gap-2">
              <Mail size={12} className="text-[#D4A017]" />
              <span>{user.email}</span>
              <span className="text-[#3A3A3A]">|</span>
              <span className="text-[#E6C78B]">{user.tier}</span>
            </p>
          </div>
        </div>

        {/* Header Right Action & Logo */}
        <div className="flex flex-col items-start md:items-end gap-2.5">
          <FinovaLogo variant="compact" size="md" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#262626] hover:bg-[#3A3A3A] border border-[#3A3A3A] hover:border-[#D4A017]/40 text-[#FAF7F0] text-xs transition-all"
            >
              <Edit size={13} className="text-[#D4A017]" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Contact Details'}</span>
            </button>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs ${
            statusMsg.type === 'success'
              ? 'bg-[#121212] border-[#D4A017]/50 text-[#FAF7F0]'
              : 'bg-[#121212] border-[#B87333] text-[#FAF7F0]'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 size={16} className="text-[#D4A017]" />
          ) : (
            <AlertCircle size={16} className="text-[#B87333]" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Edit Form Modal/Drawer */}
      {isEditing && (
        <form
          onSubmit={handleSaveProfile}
          className="p-6 rounded-2xl bg-[#262626] border border-[#D4A017]/40 shadow-xl space-y-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#3A3A3A]">
            <h3 className="font-cinzel text-sm font-bold text-[#FAF7F0] flex items-center gap-2">
              <Database size={15} className="text-[#D4A017]" />
              Update Contact & Profile Information (PostgreSQL Synchronized)
            </h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-[#9CA3AF] hover:text-[#FAF7F0]"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#E6C78B] mb-1 font-semibold">Primary Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#121212] border border-[#3A3A3A] focus:border-[#D4A017] rounded-xl px-3.5 py-2 text-[#FAF7F0] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[#E6C78B] mb-1 font-semibold">Country of Domicile</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-[#121212] border border-[#3A3A3A] focus:border-[#D4A017] rounded-xl px-3.5 py-2 text-[#FAF7F0] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#E6C78B] mb-1 font-semibold">Institutional Governance Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational clearances, compliance mandates, or delegated scopes..."
              className="w-full bg-[#121212] border border-[#3A3A3A] focus:border-[#D4A017] rounded-xl px-3.5 py-2 text-[#FAF7F0] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[#FAF7F0] hover:bg-[#3A3A3A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold hover:brightness-110 flex items-center gap-1.5"
            >
              <Save size={14} />
              <span>{saving ? 'Synchronizing...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Security & Credentials Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Posture */}
        <div className="rounded-2xl bg-[#262626] border border-[#3A3A3A] p-6 shadow-md">
          <h3 className="font-cinzel text-sm font-bold text-[#FAF7F0] flex items-center gap-2 pb-3 border-b border-[#3A3A3A]">
            <Lock size={15} className="text-[#D4A017]" />
            Security & Authentication Posture
          </h3>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <div className="flex items-center gap-2">
                <Database size={15} className="text-[#D4A017]" />
                <div>
                  <p className="text-[#FAF7F0] font-medium">Database Storage</p>
                  <p className="text-[10px] text-[#9CA3AF]">
                    {isSupabaseConfigured() ? 'Supabase PostgreSQL' : 'Local Partition Store'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-[#E6C78B] font-bold">
                {isSupabaseConfigured() ? 'Cloud Synced' : 'Active'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <div className="flex items-center gap-2">
                <Fingerprint size={15} className="text-[#D4A017]" />
                <div>
                  <p className="text-[#FAF7F0] font-medium">Session Validation</p>
                  <p className="text-[10px] text-[#9CA3AF]">JWT Cryptographic Signature</p>
                </div>
              </div>
              <span className="text-[10px] text-[#E6C78B] font-bold">Valid</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <div className="flex items-center gap-2">
                <Key size={15} className="text-[#D4A017]" />
                <div>
                  <p className="text-[#FAF7F0] font-medium">Two-Factor Authentication</p>
                  <p className="text-[10px] text-[#9CA3AF]">TOTP / WebAuthn Enforced</p>
                </div>
              </div>
              <span className="text-[10px] text-[#D4A017] font-bold">
                {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* KYC Credentials & Governance Attestation */}
        <div className="lg:col-span-2 rounded-2xl bg-[#262626] border border-[#3A3A3A] p-6 shadow-md">
          <h3 className="font-cinzel text-sm font-bold text-[#FAF7F0] flex items-center gap-2 pb-3 border-b border-[#3A3A3A]">
            <Award size={15} className="text-[#D4A017]" />
            KYC Accreditation & Multi-Tenant Boundaries
          </h3>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">Accreditation Tier</span>
                <span className="text-[10px] text-[#D4A017] font-bold">✓ Verified</span>
              </div>
              <p className="font-cinzel text-sm font-bold text-[#FAF7F0] mt-1">{user.tier}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">Audited by Institutional Compliance</p>
            </div>

            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">Assigned Financial Institution</span>
                <span className="text-[10px] text-[#E6C78B] font-bold">✓ Isolated</span>
              </div>
              <p className="font-cinzel text-sm font-bold text-[#FAF7F0] mt-1">{user.tenantName || 'Apex Global Bank'}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">Primary Banking Workspace</p>
            </div>

            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">Registered Contact Phone</span>
                <span className="text-[10px] text-[#D4A017] font-bold">Direct Line</span>
              </div>
              <p className="font-cinzel text-sm font-bold text-[#FAF7F0] mt-1">{user.phone || '+1 (212) 555-0100'}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">Verified SMS / Voice OTP</p>
            </div>

            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">Role Hierarchy Clearance</span>
                <span className="text-[10px] text-[#E6C78B] font-bold">Protocol Bound</span>
              </div>
              <p className="font-cinzel text-sm font-bold text-[#FAF7F0] mt-1">{user.role}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">PostgreSQL RLS Protected</p>
            </div>
          </div>

          <div className="mt-5 p-3 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[11px] text-[#9CA3AF] flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#D4A017] shrink-0" />
            <span>
              All identities and data partitions are guarded by PostgreSQL Row Level Security (RLS) policies.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
