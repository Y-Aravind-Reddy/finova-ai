import React, { useState } from 'react';
import { ShieldCheck, Lock, Users, Key, CheckCircle2, XCircle } from 'lucide-react';
import { UserRole } from '../../data/finovaDatasets';

interface PermissionMatrixRow {
  module: string;
  superAdmin: boolean;
  admin: boolean;
  financeAnalyst: boolean;
  supportExecutive: boolean;
  customer: boolean;
  description: string;
}

export const SuperAdminRbacPage: React.FC = () => {
  const permissions: PermissionMatrixRow[] = [
    {
      module: 'User Creation & Deletion',
      superAdmin: true,
      admin: false,
      financeAnalyst: false,
      supportExecutive: false,
      customer: false,
      description: 'Super Admin exclusive root authority over user directory.',
    },
    {
      module: 'Role Reassignment & Governance Session Switch',
      superAdmin: true,
      admin: false,
      financeAnalyst: false,
      supportExecutive: false,
      customer: false,
      description: 'Ability to switch active session to audit other roles.',
    },
    {
      module: 'System & Security Configuration',
      superAdmin: true,
      admin: false,
      financeAnalyst: false,
      supportExecutive: false,
      customer: false,
      description: 'Hardware security keys, 2FA enforcement, IP whitelist.',
    },
    {
      module: 'Cryptographic Audit Trail (Root)',
      superAdmin: true,
      admin: false,
      financeAnalyst: false,
      supportExecutive: false,
      customer: false,
      description: 'Full immutable SHA-256 ledger access.',
    },
    {
      module: 'Enterprise System Analytics',
      superAdmin: true,
      admin: false,
      financeAnalyst: false,
      supportExecutive: false,
      customer: false,
      description: 'High-frequency server throughput and clearing rail health.',
    },
    {
      module: 'Operations Management (Rails & Batches)',
      superAdmin: true,
      admin: true,
      financeAnalyst: false,
      supportExecutive: false,
      customer: false,
      description: 'FedNow, SWIFT GPI, and SEPA batch settlement execution.',
    },
    {
      module: 'Financial Intelligence & AML Surveillance',
      superAdmin: true,
      admin: false,
      financeAnalyst: true,
      supportExecutive: false,
      customer: false,
      description: 'Forensic SAR generation, anomaly radar, escrow freeze.',
    },
    {
      module: 'Customer Support & Dispute Arbitration',
      superAdmin: true,
      admin: false,
      financeAnalyst: false,
      supportExecutive: true,
      customer: false,
      description: 'Support ticket resolution, SLA countdown, client concierge.',
    },
    {
      module: 'Private Wealth Sovereign Vault & 3D Cards',
      superAdmin: true,
      admin: false,
      financeAnalyst: false,
      supportExecutive: false,
      customer: true,
      description: 'Multi-asset accounts, sovereign cards, personal document vault.',
    },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Governance Control
            </span>
            <span className="text-xs text-[#D4A017]">Role-Based Access Control (RBAC)</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Role Hierarchy & Access Matrix
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Strict institutional zero-trust RBAC enforcing multi-tier clearance separation across Finova AI.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Access Enforcement</span>
          <span className="text-sm font-bold text-[#F5C542]">Kernel Security Enforced</span>
        </div>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] space-y-4">
        <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2 pb-3 border-b border-[#D4A017]/20">
          <ShieldCheck size={16} className="text-[#F5C542]" /> Institutional Privilege Matrix
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017]">
                <th className="pb-3 font-semibold">System Capability</th>
                <th className="pb-3 text-center">Super Admin</th>
                <th className="pb-3 text-center">Admin</th>
                <th className="pb-3 text-center">Finance Analyst</th>
                <th className="pb-3 text-center">Support Exec</th>
                <th className="pb-3 text-center">Customer</th>
                <th className="pb-3">Security Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4A017]/10">
              {permissions.map((p, idx) => (
                <tr key={idx} className="hover:bg-[#141414]">
                  <td className="py-3.5 font-bold text-[#FFF8E7] pr-2">{p.module}</td>
                  <td className="py-3.5 text-center">
                    {p.superAdmin ? (
                      <span className="text-[#F5C542] font-bold">✓ Granted</span>
                    ) : (
                      <span className="text-[#6B7280]">✕ Denied</span>
                    )}
                  </td>
                  <td className="py-3.5 text-center">
                    {p.admin ? (
                      <span className="text-[#F5C542] font-bold">✓ Granted</span>
                    ) : (
                      <span className="text-[#6B7280]">✕ Denied</span>
                    )}
                  </td>
                  <td className="py-3.5 text-center">
                    {p.financeAnalyst ? (
                      <span className="text-[#F5C542] font-bold">✓ Granted</span>
                    ) : (
                      <span className="text-[#6B7280]">✕ Denied</span>
                    )}
                  </td>
                  <td className="py-3.5 text-center">
                    {p.supportExecutive ? (
                      <span className="text-[#F5C542] font-bold">✓ Granted</span>
                    ) : (
                      <span className="text-[#6B7280]">✕ Denied</span>
                    )}
                  </td>
                  <td className="py-3.5 text-center">
                    {p.customer ? (
                      <span className="text-[#F5C542] font-bold">✓ Granted</span>
                    ) : (
                      <span className="text-[#6B7280]">✕ Denied</span>
                    )}
                  </td>
                  <td className="py-3.5 text-[11px] text-[#FAF7F0]/70 pl-2">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
