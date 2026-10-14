import React, { useState } from 'react';
import { UserAccount, UserRole } from '../data/finovaDatasets';
import { getStoredTenants, getTenantById } from '../data/tenantStore';
import { Building2, ShieldCheck, Lock } from 'lucide-react';

interface UserManagementModalProps {
  currentRole: UserRole;
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<UserAccount>) => void;
  editingUser?: UserAccount | null;
  adminTenantId?: string;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  currentRole,
  isOpen,
  onClose,
  onSave,
  editingUser,
  adminTenantId,
}) => {
  const isEditing = !!editingUser;
  const tenants = getStoredTenants();

  // Compute allowed roles that current user is permitted to create
  const getAllowedRoles = (): UserRole[] => {
    if (currentRole === 'SUPER_ADMIN') {
      return ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER'];
    }
    if (currentRole === 'ADMIN') {
      return ['FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER'];
    }
    if (currentRole === 'FINANCE_ANALYST' || currentRole === 'SUPPORT_EXECUTIVE') {
      return ['CUSTOMER'];
    }
    return [];
  };

  const allowedRoles = getAllowedRoles();

  const initialTenantId =
    editingUser?.tenantId ||
    adminTenantId ||
    (currentRole === 'SUPER_ADMIN' ? 'tenant_apex_bank' : 'tenant_apex_bank');

  const [formData, setFormData] = useState<Partial<UserAccount>>({
    name: editingUser?.name || '',
    email: editingUser?.email || '',
    role: editingUser?.role || allowedRoles[0] || 'CUSTOMER',
    status: editingUser?.status || 'Active',
    tier: editingUser?.tier || 'Private Wealth Tier 3',
    phone: editingUser?.phone || '',
    country: editingUser?.country || 'United States',
    twoFactorEnabled: editingUser?.twoFactorEnabled ?? true,
    tenantId: initialTenantId,
    tenantName: getTenantById(initialTenantId)?.name || 'Apex Global Bank',
    notes: editingUser?.notes || '',
  });

  if (!isOpen) return null;

  // Customer cannot manage users
  if (currentRole === 'CUSTOMER') {
    return null;
  }

  // Admin cannot edit Super Admin
  if (isEditing && editingUser?.role === 'SUPER_ADMIN' && currentRole !== 'SUPER_ADMIN') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="bg-[#262626] border border-[#B87333] rounded-2xl p-6 max-w-md text-center">
          <p className="font-cinzel text-lg font-bold text-[#E6C78B]">Access Denied by Governance Protocol</p>
          <p className="font-mono text-xs text-[#B87333] mt-2">
            Company Admins are strictly prohibited from creating or modifying Platform Super Admin accounts under the Finova AI SaaS Multi-Tenant Governance rules.
          </p>
          <button
            onClick={onClose}
            className="mt-5 px-5 py-2 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[#FAF7F0] text-xs font-mono font-bold hover:bg-[#3A3A3A]"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    // Resolve tenantName
    const resolvedTenantName = getTenantById(formData.tenantId)?.name || 'Apex Global Bank';
    onSave({
      ...formData,
      tenantName: resolvedTenantName,
    });
    onClose();
  };

  const formatRoleLabel = (r: UserRole) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'Platform Super Admin (SaaS Operator)';
      case 'ADMIN':
        return 'Company Admin (Operations Head)';
      case 'FINANCE_ANALYST':
        return 'Finance Analyst (Risk & AML)';
      case 'SUPPORT_EXECUTIVE':
        return 'Support Executive';
      case 'CUSTOMER':
        return 'Private Wealth Customer';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#262626] border border-[#3A3A3A] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#121212] border-b border-[#3A3A3A] flex items-center justify-between">
          <div>
            <h3 className="font-cinzel text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017]">
              {isEditing ? 'Modify Account & Role Permissions' : 'Provision New Institutional User'}
            </h3>
            <p className="font-mono text-[11px] text-[#9CA3AF]">
              Multi-Tenant Governance: Operator Clearance <span className="text-[#E6C78B] font-bold">{currentRole}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#262626] border border-[#3A3A3A] text-[#D4A017] hover:text-[#FAF7F0] flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 font-mono text-xs">
          {/* Tenant Assignment Field */}
          <div>
            <label className="block text-[11px] text-[#E6C78B] mb-1 font-semibold flex items-center gap-1.5">
              <Building2 size={13} className="text-[#D4A017]" />
              Company Workspace
            </label>
            {currentRole === 'SUPER_ADMIN' ? (
              <select
                value={formData.tenantId || 'tenant_apex_bank'}
                onChange={(e) => {
                  const tId = e.target.value;
                  const tName = getTenantById(tId)?.name || 'Apex Global Bank';
                  setFormData({ ...formData, tenantId: tId, tenantName: tName });
                }}
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type} • {t.status})
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-2.5 rounded-xl bg-[#121212] border border-[#3A3A3A] flex items-center justify-between">
                <span className="font-bold text-[#FAF7F0]">
                  {getTenantById(adminTenantId || formData.tenantId)?.name || 'Apex Global Bank'}
                </span>
                <span className="text-[10px] text-[#D4A017] bg-[#262626] px-2 py-0.5 rounded border border-[#3A3A3A]">
                  Assigned Company
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#E6C78B] mb-1 font-semibold">Full Legal Name</label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Sterling Montgomery"
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#E6C78B] mb-1 font-semibold">Corporate Email</label>
              <input
                type="email"
                required
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@apexbank.com"
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#E6C78B] mb-1 font-semibold">Role Assignment</label>
              <select
                value={formData.role || allowedRoles[0]}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {formatRoleLabel(r)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#E6C78B] mb-1 font-semibold">Account Status</label>
              <select
                value={formData.status || 'Active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
              >
                <option value="Active">Active</option>
                <option value="Pending Review">Pending Review</option>
                <option value="KYC Pending">KYC Pending</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#E6C78B] mb-1 font-semibold">Accreditation Tier</label>
              <select
                value={formData.tier || 'Private Wealth Tier 3'}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
              >
                <option value="Private Wealth Tier 3">Private Wealth Tier 3</option>
                <option value="Platinum Tier 2">Platinum Tier 2</option>
                <option value="Gold Tier 1">Gold Tier 1</option>
                <option value="Executive Staff">Executive Staff</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#E6C78B] mb-1 font-semibold">Phone Contact</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (212) 555-0199"
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#E6C78B] mb-1 font-semibold">Audit Notes</label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Authorization reason, compliance notes, regulatory license..."
              className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
            />
          </div>

          {/* Security Rule Warning */}
          <div className="p-2.5 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[10px] text-[#9CA3AF]">
            ℹ Multi-Tenant RBAC: As <strong>{currentRole}</strong>, records are strictly scoped to the assigned tenant workspace and logged cryptographically.
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#121212] border border-[#3A3A3A] text-xs text-[#9CA3AF] hover:text-[#FAF7F0]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_15px_rgba(212,160,23,0.35)]"
            >
              {isEditing ? 'Save Changes' : 'Confirm User Creation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
