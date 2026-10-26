import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole } from '../../data/finovaDatasets';
import { updateUserRoleInDb } from '../../services/finovaDatabase';
import { getTenantById } from '../../data/tenantStore';
import { AUTHORIZED_SUPER_ADMIN_EMAIL } from '../../data/authStore';
import { ShieldCheck, Lock, Building2, AlertTriangle, CheckCircle2, RotateCw, UserCheck } from 'lucide-react';

interface ChangeRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserAccount | null;
  currentRole: UserRole;
  currentUserTenantId?: string;
  onRoleChanged: (updatedUser: UserAccount) => void;
}

export const ChangeRoleModal: React.FC<ChangeRoleModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  currentRole,
  currentUserTenantId,
  onRoleChanged,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('CUSTOMER');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (targetUser) {
      setSelectedRole(targetUser.role);
      setErrorMessage(null);
      setSuccessNotice(null);
    }
  }, [targetUser, isOpen]);

  if (!isOpen || !targetUser) return null;

  // Determine permissions based on caller role and target user
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';
  const isAdmin = currentRole === 'ADMIN';

  // Target user check
  const isTargetAuthorizedSuperAdmin =
    targetUser.email.toLowerCase().trim() === AUTHORIZED_SUPER_ADMIN_EMAIL.toLowerCase();

  // Governance Rule 1: Admin cannot modify another Admin or Super Admin
  const isTargetAdminOrSuper = targetUser.role === 'ADMIN' || targetUser.role === 'SUPER_ADMIN';
  const adminBlockedFromTarget = isAdmin && isTargetAdminOrSuper;

  // Governance Rule 2: Admin cannot modify accounts in other tenants
  const tenantMismatch =
    isAdmin &&
    Boolean(currentUserTenantId) &&
    Boolean(targetUser.tenantId) &&
    targetUser.tenantId !== currentUserTenantId;

  // Governance Rule 3: Customer and other staff cannot change roles
  const callerUnauthorized = !isSuperAdmin && !isAdmin;

  const isOperationBlocked = adminBlockedFromTarget || tenantMismatch || callerUnauthorized;

  // Calculate available target roles
  const getPermittedRoles = (): UserRole[] => {
    if (isSuperAdmin) {
      const roles: UserRole[] = ['ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER'];
      // Only the authenticated account for aravindvicky629@gmail.com can ever hold SUPER_ADMIN
      if (isTargetAuthorizedSuperAdmin) {
        roles.unshift('SUPER_ADMIN');
      }
      return roles;
    }
    if (isAdmin) {
      // Company Admins may only assign non-admin staff and customer roles within their tenant
      return ['FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER'];
    }
    return [];
  };

  const permittedRoles = getPermittedRoles();

  const formatRoleLabel = (r: UserRole) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'Platform Super Admin (SaaS Operator)';
      case 'ADMIN':
        return 'Company Admin (Operations Head)';
      case 'FINANCE_ANALYST':
        return 'Finance Analyst (Forensic Risk & AML)';
      case 'SUPPORT_EXECUTIVE':
        return 'Support Executive (Concierge)';
      case 'CUSTOMER':
        return 'Private Wealth Customer (Client)';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOperationBlocked) return;
    if (selectedRole === targetUser.role) {
      setErrorMessage('Please select a different role to change authorization.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await updateUserRoleInDb(targetUser.id, selectedRole, targetUser.tenantId);
      setSubmitting(false);

      if (res.success && res.updatedProfile) {
        setSuccessNotice(`Role successfully updated to ${selectedRole.replace('_', ' ')}.`);
        setTimeout(() => {
          onRoleChanged(res.updatedProfile!);
          onClose();
        }, 600);
      } else {
        setErrorMessage(res.error || 'Backend rejected role modification.');
      }
    } catch (err: any) {
      setSubmitting(false);
      setErrorMessage(err?.message || 'Unexpected exception during role update.');
    }
  };

  const tenantName = targetUser.tenantName || getTenantById(targetUser.tenantId)?.name || 'Apex Global Bank';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#262626] border border-[#3A3A3A] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="p-4 bg-[#121212] border-b border-[#3A3A3A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D4A017]/10 border border-[#D4A017]/40 flex items-center justify-center text-[#D4A017]">
              <UserCheck size={16} />
            </div>
            <div>
              <h3 className="font-cinzel text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017]">
                Change Role Assignment
              </h3>
              <p className="text-[10px] text-[#9CA3AF]">
                Multi-Tenant Governance Protocol • Clearance:{' '}
                <span className="text-[#E6C78B] font-bold">{currentRole}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-7 h-7 rounded-lg bg-[#262626] border border-[#3A3A3A] text-[#D4A017] hover:text-[#FAF7F0] flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>

        {/* Blocking Violations Banner */}
        {adminBlockedFromTarget && (
          <div className="m-4 p-3 rounded-xl bg-amber-950/60 border border-amber-600/60 text-amber-200 flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-bold text-xs">Governance Clearance Restriction</p>
              <p className="text-[11px] text-amber-200/90 mt-0.5">
                Company Admins are strictly prohibited from modifying Admin or Super Admin accounts. Escalation to Platform Super Admin is required.
              </p>
            </div>
          </div>
        )}

        {tenantMismatch && (
          <div className="m-4 p-3 rounded-xl bg-red-950/60 border border-red-600/60 text-red-200 flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
            <div>
              <p className="font-bold text-xs">Cross-Tenant Isolation Violation</p>
              <p className="text-[11px] text-red-200/90 mt-0.5">
                You cannot modify an account assigned to another tenant workspace ({targetUser.tenantId}).
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-red-950/60 border border-red-600/60 text-red-200 flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
            <p className="text-[11px]">{errorMessage}</p>
          </div>
        )}

        {successNotice && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-600/60 text-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
            <p className="text-[11px]">{successNotice}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Read-Only Identity Card */}
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#3A3A3A] space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#2A2A2A]">
              <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Lock size={11} className="text-[#D4A017]" />
                Identity & Attributes (Strictly Read-Only)
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-[#262626] text-[#E6C78B] border border-[#3A3A3A]">
                ID: {targetUser.id}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-[#6B7280] block text-[10px]">Legal Name</span>
                <span className="font-semibold text-[#FAF7F0]">{targetUser.name}</span>
              </div>
              <div>
                <span className="text-[#6B7280] block text-[10px]">Email Address</span>
                <span className="font-semibold text-[#FAF7F0] truncate block">{targetUser.email}</span>
              </div>
              <div>
                <span className="text-[#6B7280] block text-[10px]">Company Workspace</span>
                <span className="font-semibold text-[#E6C78B] flex items-center gap-1">
                  <Building2 size={11} className="text-[#D4A017]" />
                  {tenantName}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block text-[10px]">Accreditation Tier</span>
                <span className="font-semibold text-[#FAF7F0]">{targetUser.tier}</span>
              </div>
              <div>
                <span className="text-[#6B7280] block text-[10px]">Account Status</span>
                <span className="font-semibold text-emerald-400">{targetUser.status}</span>
              </div>
              <div>
                <span className="text-[#6B7280] block text-[10px]">Current Role</span>
                <span className="font-semibold text-[#D4A017]">{targetUser.role.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Dedicated Role Selection */}
          <div>
            <label className="block text-[11px] text-[#E6C78B] mb-1.5 font-semibold flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-[#D4A017]" />
              New Authorized Role Assignment
            </label>
            <select
              disabled={isOperationBlocked || submitting}
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017] disabled:opacity-50"
            >
              {permittedRoles.map((r) => (
                <option key={r} value={r}>
                  {formatRoleLabel(r)} {r === targetUser.role ? '(Current)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#9CA3AF] mt-1.5">
              Role permissions determine database access, dashboard routing, and ledger signing privileges under PostgreSQL Row-Level Security.
            </p>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-[#3A3A3A] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[#9CA3AF] hover:text-[#FAF7F0] text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isOperationBlocked || submitting || selectedRole === targetUser.role}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RotateCw size={13} className="animate-spin" />
                  <span>Verifying with Backend...</span>
                </>
              ) : (
                <span>Confirm Role Change</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
