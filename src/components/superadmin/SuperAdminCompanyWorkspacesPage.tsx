import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  Users,
  Activity,
  ShieldCheck,
  Globe,
  Settings,
  ExternalLink,
  Edit,
  Power,
  Server,
  Zap,
  Sparkles,
} from 'lucide-react';
import {
  TenantWorkspace,
  getStoredTenants,
  saveStoredTenants,
  createTenant,
  updateTenant,
  toggleTenantStatus,
  getPlatformSaaSMetrics,
} from '../../data/tenantStore';
import {
  fetchTenantWorkspacesResultFromDb,
  saveTenantWorkspaceToDb,
  updateTenantWorkspaceStatusInDb,
} from '../../services/finovaDatabase';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';

interface SuperAdminCompanyWorkspacesPageProps {
  onInspectTenant?: (tenantId: string) => void;
}

export const SuperAdminCompanyWorkspacesPage: React.FC<SuperAdminCompanyWorkspacesPageProps> = ({
  onInspectTenant,
}) => {
  const [tenants, setTenants] = useState<TenantWorkspace[]>(getStoredTenants());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Suspended' | 'Pending Review'>('ALL');
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWorkspace | null>(null);
  const [inspectedTenant, setInspectedTenant] = useState<TenantWorkspace | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Load real workspaces from Supabase tenant_workspaces table on mount
  React.useEffect(() => {
    let isCancelled = false;
    setLoadingWorkspaces(true);
    fetchTenantWorkspacesResultFromDb().then((res) => {
      if (!isCancelled) {
        setLoadingWorkspaces(false);
        if (res.data && res.data.length > 0) {
          setTenants(res.data);
        }
      }
    }).catch(() => {
      if (!isCancelled) setLoadingWorkspaces(false);
    });
    return () => { isCancelled = true; };
  }, []);

  // Form states for new workspace onboarding
  const [formData, setFormData] = useState<Partial<TenantWorkspace>>({
    name: '',
    shortName: '',
    type: 'Commercial Bank',
    status: 'Active',
    plan: 'Growth SaaS',
    mrr: 28500,
    currency: 'USD',
    headquarters: '',
    licenseNo: '',
    adminName: '',
    adminEmail: '',
    notes: '',
  });

  const saasMetrics = getPlatformSaaSMetrics();

  const handleToggleStatus = async (tenantId: string) => {
    const target = tenants.find((t) => t.id === tenantId);
    if (!target) return;
    const nextStatus = target.status === 'Active' ? 'Suspended' : 'Active';
    const updated = updateTenant(tenantId, { status: nextStatus });
    if (updated) {
      setTenants(getStoredTenants());
      setFeedbackMsg(`Tenant "${updated.name}" status updated to ${updated.status}.`);
      setTimeout(() => setFeedbackMsg(''), 3000);
    }

    // Persist to Supabase
    await updateTenantWorkspaceStatusInDb(tenantId, nextStatus);
    const refreshed = await fetchTenantWorkspacesResultFromDb();
    if (refreshed.data && refreshed.data.length > 0) {
      setTenants(refreshed.data);
    }
  };

  const handleSaveOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingTenant) {
      updateTenant(editingTenant.id, formData);
      setFeedbackMsg(`Workspace "${editingTenant.name}" successfully updated.`);
      await saveTenantWorkspaceToDb({ ...editingTenant, ...formData });
    } else {
      const created = createTenant(formData);
      setFeedbackMsg(`Workspace "${created.name}" successfully provisioned.`);
      await saveTenantWorkspaceToDb(created);
    }

    const refreshed = await fetchTenantWorkspacesResultFromDb();
    if (refreshed.data && refreshed.data.length > 0) {
      setTenants(refreshed.data);
    } else {
      setTenants(getStoredTenants());
    }

    setOnboardModalOpen(false);
    setEditingTenant(null);
    setFormData({
      name: '',
      shortName: '',
      type: 'Commercial Bank',
      status: 'Active',
      plan: 'Growth SaaS',
      mrr: 28500,
      currency: 'USD',
      headquarters: '',
      licenseNo: '',
      adminName: '',
      adminEmail: '',
      notes: '',
    });
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.licenseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.headquarters.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top SaaS Header Banner */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider">
              Platform SaaS Operator
            </span>
            <span className="text-xs text-[#E6C78B]">Multi-Tenant Workspaces Architecture</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            Company Workspaces & SaaS Onboarding
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Centrally manage independent banks, NBFCs, and wealth management SaaS workspaces. Enforce strict tenant isolation, cryptographic data segregation, subscription tiering, and operational lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingTenant(null);
              setFormData({
                name: '',
                shortName: '',
                type: 'Commercial Bank',
                status: 'Active',
                plan: 'Enterprise Sovereign',
                mrr: 45000,
                currency: 'USD',
                headquarters: 'Zurich & New York',
                licenseNo: `FINOVA-SaaS-REG-${Math.floor(10000 + Math.random() * 90000)}`,
                adminName: 'Lead Company Admin',
                adminEmail: 'admin@newbank.com',
                notes: '',
              });
              setOnboardModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all"
          >
            <Plus size={16} />
            <span>Onboard Company Workspace</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-[#262626] border border-[#D4A017] text-[#E6C78B] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-[#D4A017]" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* SaaS Platform Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Registered Companies"
          value={saasMetrics.totalTenants.toString()}
          subValue={`${saasMetrics.activeTenants} Active • ${saasMetrics.suspendedTenants} Suspended`}
          change="+1 New Q4"
          trend="up"
          tag="Workspaces"
          icon={<Building2 size={20} />}
          sparkline={[1, 2, 2, 3, 3, 4, 4]}
        />
        <ThreeDKpiCard
          title="Platform MRR / ARR"
          value={`$${(saasMetrics.totalMrr / 1000).toFixed(1)}k`}
          subValue={`ARR: $${(saasMetrics.totalArr / 1000000).toFixed(2)}M`}
          change="+28.4% YoY"
          trend="up"
          tag="Subscription"
          variant="gold-accent"
          icon={<DollarSign size={20} />}
          sparkline={[65, 78, 85, 92, 102, 114, 123]}
        />
        <ThreeDKpiCard
          title="Total Processed Assets"
          value={`$${(saasMetrics.aggregateVolumeYTD / 1000000000).toFixed(2)}B`}
          subValue="Across all tenant banks"
          change="+34.2%"
          trend="up"
          tag="Cross-Tenant"
          icon={<Activity size={20} />}
          sparkline={[210, 280, 340, 410, 480, 510, 531]}
        />
        <ThreeDKpiCard
          title="Total Enterprise Users"
          value={saasMetrics.aggregateUsers.toLocaleString()}
          subValue={`Compliance Avg: ${saasMetrics.averageComplianceScore}%`}
          change="99.992% SLA"
          trend="up"
          tag="Global Core"
          icon={<Users size={20} />}
          sparkline={[120, 140, 160, 175, 190, 205, 213]}
        />
      </div>

      {/* Company Workspaces Table */}
      <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#3A3A3A]">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-3 text-[#D4A017]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search companies by name, tenant ID, license..."
              className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {(['ALL', 'Active', 'Suspended', 'Pending Review'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  statusFilter === s
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] shadow-md'
                    : 'bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#3A3A3A] text-[10px] uppercase text-[#E6C78B]">
                <th className="pb-3">Company Workspace</th>
                <th className="pb-3">Institution Code</th>
                <th className="pb-3">Institution Type</th>
                <th className="pb-3">Assigned Admin</th>
                <th className="pb-3">Plan & MRR</th>
                <th className="pb-3">Operational Status</th>
                <th className="pb-3">Volume & Users</th>
                <th className="pb-3 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
              {filteredTenants.map((t) => (
                <tr key={t.id} className="hover:bg-[#121212]/60 transition-colors">
                  <td className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#121212] border border-[#3A3A3A] flex items-center justify-center text-[#D4A017]">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-[#FAF7F0]">{t.name}</p>
                        <p className="text-[10px] text-[#9CA3AF]">{t.headquarters} • {t.currency}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5">
                    <code className="px-2 py-0.5 rounded bg-[#121212] text-[#E6C78B] border border-[#3A3A3A] text-[10px]">
                      {t.shortName || t.licenseNo}
                    </code>
                  </td>
                  <td className="py-3.5 text-[#9CA3AF]">{t.type}</td>
                  <td className="py-3.5">
                    <p className="font-semibold text-[#E6C78B]">{t.adminName}</p>
                    <p className="text-[10px] text-[#9CA3AF]">{t.adminEmail}</p>
                  </td>
                  <td className="py-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#121212] text-[#D4A017] border border-[#3A3A3A]">
                      {t.plan}
                    </span>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5">${(t.mrr).toLocaleString()} / mo</p>
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'Active'
                          ? 'bg-[#121212] text-[#E6C78B] border border-[#D4A017]/40 shadow-[0_0_8px_rgba(212,160,23,0.15)]'
                          : t.status === 'Suspended'
                          ? 'bg-[#121212] text-[#B87333] border border-[#B87333]'
                          : 'bg-[#121212] text-[#9CA3AF] border border-[#3A3A3A]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          t.status === 'Active' ? 'bg-[#D4A017]' : 'bg-[#B87333]'
                        }`}
                      />
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-[11px]">
                    <p className="font-semibold text-[#FAF7F0]">
                      {t.currencySymbol}{(t.transactionVolumeYTD / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">{t.usersCount.toLocaleString()} Users</p>
                  </td>
                  <td className="py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Inspect details */}
                      <button
                        onClick={() => setInspectedTenant(t)}
                        className="px-2.5 py-1 rounded-lg bg-[#121212] hover:bg-[#3A3A3A] text-[#FAF7F0] border border-[#3A3A3A] text-[10px] transition-colors"
                        title="View Tenant Dossier"
                      >
                        Inspect
                      </button>

                      {/* Edit details */}
                      <button
                        onClick={() => {
                          setEditingTenant(t);
                          setFormData({ ...t });
                          setOnboardModalOpen(true);
                        }}
                        className="p-1 rounded-lg bg-[#121212] hover:bg-[#3A3A3A] text-[#D4A017] border border-[#3A3A3A]"
                        title="Edit Subscription & Admin"
                      >
                        <Edit size={13} />
                      </button>

                      {/* Toggle status */}
                      <button
                        onClick={() => handleToggleStatus(t.id)}
                        className={`p-1 rounded-lg border transition-colors ${
                          t.status === 'Active'
                            ? 'bg-[#121212] hover:bg-[#262626] text-[#B87333] border-[#3A3A3A]'
                            : 'bg-[#121212] hover:bg-[#262626] text-[#D4A017] border-[#D4A017]/40'
                        }`}
                        title={t.status === 'Active' ? 'Suspend Workspace' : 'Reactivate Workspace'}
                      >
                        <Power size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tenant Dossier Inspector Modal */}
      {inspectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#262626] border border-[#3A3A3A] rounded-2xl p-6 max-w-xl w-full font-mono text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#3A3A3A]">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-[#D4A017]" />
                <div>
                  <h3 className="font-cinzel text-base font-bold text-[#FAF7F0]">
                    {inspectedTenant.name}
                  </h3>
                  <p className="text-[10px] text-[#9CA3AF]">
                    Institution Code: <code className="text-[#E6C78B]">{inspectedTenant.shortName || inspectedTenant.licenseNo}</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectedTenant(null)}
                className="w-7 h-7 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#9CA3AF] hover:text-[#FAF7F0] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
                <span className="text-[#9CA3AF] block text-[10px]">Institution Type</span>
                <span className="font-bold text-[#FAF7F0]">{inspectedTenant.type}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
                <span className="text-[#9CA3AF] block text-[10px]">Subscription Plan</span>
                <span className="font-bold text-[#D4A017]">{inspectedTenant.plan} (${inspectedTenant.mrr.toLocaleString()}/mo)</span>
              </div>
              <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
                <span className="text-[#9CA3AF] block text-[10px]">Regulatory License</span>
                <span className="font-bold text-[#E6C78B]">{inspectedTenant.licenseNo}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
                <span className="text-[#9CA3AF] block text-[10px]">Primary Company Admin</span>
                <span className="font-bold text-[#FAF7F0]">{inspectedTenant.adminName}</span>
                <span className="block text-[10px] text-[#9CA3AF]">{inspectedTenant.adminEmail}</span>
              </div>
            </div>

            <div>
              <span className="text-[#E6C78B] font-bold block mb-1.5">Active Platform Engines</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px]">
                {Object.entries(inspectedTenant.activeEngines).map(([key, enabled]) => (
                  <div
                    key={key}
                    className={`px-2 py-1 rounded-lg border flex items-center justify-between ${
                      enabled
                        ? 'bg-[#121212] text-[#FAF7F0] border-[#3A3A3A]'
                        : 'bg-[#121212]/40 text-[#9CA3AF]/40 border-transparent'
                    }`}
                  >
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className={enabled ? 'text-[#D4A017]' : 'text-[#3A3A3A]'}>
                      {enabled ? '✓' : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[10px] text-[#9CA3AF]">
              <strong>Multi-Tenant Isolation Guarantee:</strong> Database rows and queries are partitioned by institution using Row-Level Security (RLS) policies. Cross-company reads or mutations are prevented at the policy kernel layer.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setInspectedTenant(null)}
                className="px-4 py-2 rounded-xl bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboard / Edit Workspace Modal */}
      {onboardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#262626] border border-[#3A3A3A] rounded-2xl p-6 max-w-lg w-full font-mono text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#3A3A3A]">
              <div>
                <h3 className="font-cinzel text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017]">
                  {editingTenant ? 'Edit Company Workspace' : 'Onboard New Financial Workspace'}
                </h3>
                <p className="text-[11px] text-[#9CA3AF]">
                  Register a bank or NBFC into Finova AI multi-tenant SaaS architecture.
                </p>
              </div>
              <button
                onClick={() => {
                  setOnboardModalOpen(false);
                  setEditingTenant(null);
                }}
                className="w-7 h-7 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#9CA3AF] hover:text-[#FAF7F0] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOnboard} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#E6C78B] mb-1 font-semibold">Legal Company Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Apex Global Bank"
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
                  />
                </div>
                <div>
                  <label className="block text-[#E6C78B] mb-1 font-semibold">Short Brand Name</label>
                  <input
                    type="text"
                    value={formData.shortName || ''}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    placeholder="e.g. Apex Bank"
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#E6C78B] mb-1 font-semibold">Institution Type</label>
                  <select
                    value={formData.type || 'Commercial Bank'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
                  >
                    <option value="Commercial Bank">Commercial Bank</option>
                    <option value="NBFC & Lending">NBFC & Lending</option>
                    <option value="Wealth Management">Wealth Management</option>
                    <option value="Digital Neo-Bank">Digital Neo-Bank</option>
                    <option value="Credit Union">Credit Union</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#E6C78B] mb-1 font-semibold">Subscription Plan</label>
                  <select
                    value={formData.plan || 'Growth SaaS'}
                    onChange={(e) => {
                      const p = e.target.value as any;
                      const mrr = p === 'Enterprise Sovereign' ? 45000 : p === 'Starter Tier' ? 12000 : 28500;
                      setFormData({ ...formData, plan: p, mrr });
                    }}
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
                  >
                    <option value="Enterprise Sovereign">Enterprise Sovereign ($45k/mo)</option>
                    <option value="Growth SaaS">Growth SaaS ($28.5k/mo)</option>
                    <option value="Starter Tier">Starter Tier ($12k/mo)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#E6C78B] mb-1 font-semibold">Base Currency</label>
                  <select
                    value={formData.currency || 'USD'}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="CHF">CHF (CHF)</option>
                    <option value="SGD">SGD (S$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#E6C78B] mb-1 font-semibold">Headquarters</label>
                  <input
                    type="text"
                    value={formData.headquarters || ''}
                    onChange={(e) => setFormData({ ...formData, headquarters: e.target.value })}
                    placeholder="Zurich & New York"
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#E6C78B] mb-1 font-semibold">Regulatory License No</label>
                <input
                  type="text"
                  value={formData.licenseNo || ''}
                  onChange={(e) => setFormData({ ...formData, licenseNo: e.target.value })}
                  placeholder="OCC / FINMA / FCA Reg No..."
                  className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#E6C78B] mb-1 font-semibold">Initial Company Admin Name</label>
                  <input
                    type="text"
                    required
                    value={formData.adminName || ''}
                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                    placeholder="Eleanor Sterling"
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
                  />
                </div>
                <div>
                  <label className="block text-[#E6C78B] mb-1 font-semibold">Admin Corporate Email</label>
                  <input
                    type="email"
                    required
                    value={formData.adminEmail || ''}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    placeholder="admin@company.com"
                    className="w-full bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#3A3A3A]">
                <button
                  type="button"
                  onClick={() => {
                    setOnboardModalOpen(false);
                    setEditingTenant(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-lg"
                >
                  {editingTenant ? 'Save Changes' : 'Confirm Workspace Onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
