import React, { useState } from 'react';
import {
  SUPPORT_DATASET,
  SupportTicket,
  UserAccount,
  UserRole,
} from '../../data/finovaDatasets';
import { getTicketsForTenant } from '../../data/tenantDatasets';
import { fetchSupportTicketsResultFromDb } from '../../services/finovaDatabase';
import { getTenantById } from '../../data/tenantStore';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { ThreeDProgressRing } from '../charts3d/ThreeDProgressRing';
import { UserManagementModal } from '../UserManagementModal';
import {
  Headphones,
  CheckCircle,
  Clock,
  Star,
  UserPlus,
  MessageSquare,
  FileText,
  AlertCircle,
  Building2,
} from 'lucide-react';

interface SupportExecutiveDashboardProps {
  currentRole: UserRole;
  users: UserAccount[];
  onUpdateUsers: (newUsers: UserAccount[]) => void;
  activeSection?: string;
  currentUser?: UserAccount;
}

export const SupportExecutiveDashboard: React.FC<SupportExecutiveDashboardProps> = ({
  currentRole,
  users,
  onUpdateUsers,
  activeSection = 'dashboard',
  currentUser,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const tenantId = currentUser?.tenantId || 'tenant_apex_bank';
  const tenant = getTenantById(tenantId);
  const companyName = tenant?.name || currentUser?.tenantName || 'Apex Global Bank';

  // Load tenant-isolated tickets
  const [tickets, setTickets] = useState<SupportTicket[]>(() =>
    getTicketsForTenant(tenantId)
  );
  const [dbSource, setDbSource] = useState<'supabase' | 'fallback'>('fallback');
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeTableTab, setActiveTableTab] = useState<'requests' | 'followups' | 'complaints'>('requests');

  React.useEffect(() => {
    fetchSupportTicketsResultFromDb(tenantId).then((result) => {
      setDbSource(result.source);
      setDbError(result.error);
      if (result.source === 'supabase') {
        setTickets(result.data);
      } else if (result.data && result.data.length > 0) {
        setTickets(result.data);
      }
    });
  }, [tenantId]);

  React.useEffect(() => {
    if (activeSection === 'support_followups') {
      setActiveTableTab('followups');
    } else if (activeSection === 'support_complaints') {
      setActiveTableTab('complaints');
    } else if (activeSection === 'support_queries' || activeSection === 'support_cases') {
      setActiveTableTab('requests');
    }
  }, [activeSection]);

  const { metrics, ticketCategories } = SUPPORT_DATASET;

  // 3D Chart Data
  const categoryDonutData = ticketCategories.map((c) => ({
    label: c.category.split(' ')[0] + ' ' + (c.category.split(' ')[1] || ''),
    value: c.count,
    subtext: `${c.resolvedPct}% SLA Cleared`,
  }));

  const resolutionTimeData = [
    { label: 'High-Value Wires', value: 12, secondaryValue: 15 },
    { label: 'Card Issuance', value: 14, secondaryValue: 20 },
    { label: 'KYC Verification', value: 22, secondaryValue: 30 },
    { label: 'Tax Document', value: 18, secondaryValue: 25 },
    { label: 'Disputes', value: 26, secondaryValue: 35, highlight: true },
  ];

  // Follow-ups queue for this tenant
  const followUpQueue = [
    {
      id: `FOL-${tenantId.slice(7, 10).toUpperCase()}-8821`,
      client: tenantId === 'tenant_crest_capital' ? 'Elena Rostova' : tenantId === 'tenant_vanguard_wealth' ? 'Lucian Sterling' : 'Harrison Croft',
      subject: `Courier delivery confirmation of Black Sovereign Card to client residence`,
      dueDate: 'Today, 14:00 UTC',
      priority: 'Urgent',
      status: 'In Transit',
    },
    {
      id: `FOL-${tenantId.slice(7, 10).toUpperCase()}-8822`,
      client: 'Marcus Aurelius Sterling',
      subject: 'IRS W-8BEN notarized document resubmission verification check',
      dueDate: 'Today, 17:30 UTC',
      priority: 'High',
      status: 'Awaiting Client',
    },
    {
      id: `FOL-${tenantId.slice(7, 10).toUpperCase()}-8823`,
      client: 'Victoria Habsburg',
      subject: `High-value wire dual authorization callback verification (${tenant?.currencySymbol || '$'}1.8M)`,
      dueDate: 'Tomorrow, 09:00 UTC',
      priority: 'Urgent',
      status: 'Callback Scheduled',
    },
  ];

  // Complaints queue
  const complaintQueue = [
    {
      id: `CMP-${tenantId.slice(7, 10).toUpperCase()}-104`,
      client: 'Genevieve Dupont',
      subject: 'Delayed SWIFT GPI notification on Paris real estate escrow release',
      severity: 'Medium',
      openedAt: 'Yesterday 16:20',
      status: 'Under Investigation',
      assigned: currentUser?.name || 'Claire Montgomery',
    },
    {
      id: `CMP-${tenantId.slice(7, 10).toUpperCase()}-105`,
      client: 'Kenji Takahashi',
      subject: 'International roaming dual-factor SMS delay at Tokyo Narita',
      severity: 'Low',
      openedAt: '2 days ago',
      status: 'Resolved via Hardware Key',
      assigned: currentUser?.name || 'Claire Montgomery',
    },
  ];

  const handleResolveTicket = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.ticketId === ticketId ? { ...t, status: 'Resolved', csatRating: 5.0 } : t))
    );
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header with Tenant Scoping */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName} Desk
            </span>
            <span className="text-xs text-[#E6C78B]">Clearance: Support Executive</span>
            {dbSource === 'supabase' ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Supabase Database
              </span>
            ) : (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center gap-1"
                title={dbError || 'Support tickets table pending or requires authentication'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                {dbError && dbError.includes('Demo') ? 'Demo Dataset (RLS Active)' : 'Fallback Data (DB Table Pending)'}
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            {companyName} Client Concierge & Support
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Managing client tickets, wire authorizations, follow-ups, and complaint resolutions strictly scoped to {companyName}.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all shrink-0"
        >
          <UserPlus size={16} />
          Create Client Account
        </button>
      </div>

      {/* 4 3D KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Open Tickets"
          value={tickets.filter((t) => t.status !== 'Resolved').length.toString()}
          subValue="Active Desk Queue"
          change="3 Urgent"
          trend="up"
          tag="Queue"
          icon={<Headphones size={20} />}
          sparkline={[30, 28, 25, 22, 26, 25, 24]}
        />
        <ThreeDKpiCard
          title="Avg Resolution Time"
          value="18.4 min"
          subValue="Target < 30 min SLA"
          change="-4.2 min"
          trend="up"
          tag="Fast Track"
          variant="gold-accent"
          icon={<Clock size={20} />}
          sparkline={[28, 25, 24, 22, 20, 19, 18]}
        />
        <ThreeDKpiCard
          title="CSAT Rating"
          value="4.94 / 5.0"
          subValue="Client Satisfaction"
          change="+0.06 pts"
          trend="up"
          tag="Top Tier"
          icon={<Star size={20} />}
          sparkline={[4.8, 4.82, 4.85, 4.88, 4.9, 4.92, 4.94]}
        />
        <ThreeDKpiCard
          title="SLA Compliance"
          value="99.2%"
          subValue="Sovereign Grade"
          change="Optimal"
          trend="up"
          tag="Compliance"
          icon={<CheckCircle size={20} />}
          sparkline={[98, 98.4, 98.8, 99.0, 99.1, 99.2, 99.2]}
        />
      </div>

      {/* 3D Visualizations: 3D Donut Categories & 3D Column Resolution SLA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDDonutChart
          title="3D Ticket Classification Distribution"
          subtitle={`Ticket Types Managed for ${companyName}`}
          segments={categoryDonutData}
          centerLabel="Total Tickets"
          centerValue="3,420"
          height={320}
        />
        <ThreeDColumnChart
          title="3D Average Resolution Time by Inquiry Channel"
          subtitle="Actual Minutes vs SLA Benchmark (Minutes)"
          data={resolutionTimeData}
          height={280}
          valuePrefix=""
          valueSuffix=" min"
          dualSeries={true}
          primaryLabel="Actual Resolution"
          secondaryLabel="SLA Benchmark"
        />
      </div>

      {/* Support SLA Progress Ring & Main Ticket Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
          <ThreeDProgressRing
            title="3D Concierge SLA Compliance"
            subtitle={`${companyName} Service Level Agreement`}
            size={220}
            items={[
              { label: 'Wire SLA', value: 99.2, displayValue: '99.2%', subtext: 'Target: < 2 hours' },
              { label: 'Card Delivery', value: 98.6, displayValue: '98.6%', subtext: 'Global diplomatic courier' },
              { label: 'Tax Filings', value: 99.8, displayValue: '99.8%', subtext: 'W-8BEN accuracy' },
            ]}
          />
        </div>

        {/* Tabbed Ticket Queue */}
        <div className="lg:col-span-2 rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#3A3A3A] gap-3">
            <div className="flex items-center gap-2">
              {[
                { id: 'requests', label: `Active Tickets (${tickets.length})` },
                { id: 'followups', label: 'Follow-ups' },
                { id: 'complaints', label: 'Escalations' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTableTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                    activeTableTab === tab.id
                      ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] shadow-md'
                      : 'bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-[10px] text-[#9CA3AF]">
              Workspace: {companyName}
            </span>
          </div>

          {/* Active Tickets Tab */}
          {activeTableTab === 'requests' && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                    <th className="pb-2">Ticket ID</th>
                    <th className="pb-2">Client Name</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Assigned</th>
                    <th className="pb-2 text-right">Concierge Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                  {tickets.map((t) => (
                    <tr key={t.ticketId} className="hover:bg-[#121212]/50 transition-colors">
                      <td className="py-2.5 font-bold text-[#E6C78B]">{t.ticketId}</td>
                      <td className="py-2.5">
                        <p className="font-semibold text-[#FAF7F0]">{t.customerName}</p>
                        <p className="text-[10px] text-[#9CA3AF]">{t.accountTier}</p>
                      </td>
                      <td className="py-2.5 text-[#D4A017]">{t.category}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.priority === 'Urgent'
                              ? 'bg-[#121212] text-[#B87333] border border-[#B87333]'
                              : t.priority === 'High'
                              ? 'bg-[#121212] text-[#D4A017] border border-[#D4A017]'
                              : 'bg-[#121212] text-[#9CA3AF] border border-[#3A3A3A]'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'Resolved'
                              ? 'bg-[#121212] text-[#E6C78B] border border-[#D4A017]/40'
                              : 'bg-[#121212] text-[#FAF7F0] border border-[#3A3A3A]'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-[11px] text-[#9CA3AF]">{t.assignedExecutive}</td>
                      <td className="py-2.5 text-right">
                        {t.status !== 'Resolved' ? (
                          <button
                            onClick={() => handleResolveTicket(t.ticketId)}
                            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold text-[10px] hover:brightness-110 shadow-sm"
                          >
                            Resolve & Sign Off
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#E6C78B] font-bold">Resolved (5.0 ★)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Follow-ups Tab */}
          {activeTableTab === 'followups' && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                    <th className="pb-2">Task ID</th>
                    <th className="pb-2">Client</th>
                    <th className="pb-2">Action Description</th>
                    <th className="pb-2">Target Time</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                  {followUpQueue.map((f) => (
                    <tr key={f.id} className="hover:bg-[#121212]/50">
                      <td className="py-2.5 font-bold text-[#E6C78B]">{f.id}</td>
                      <td className="py-2.5 font-semibold text-[#FAF7F0]">{f.client}</td>
                      <td className="py-2.5 text-[#9CA3AF]">{f.subject}</td>
                      <td className="py-2.5 text-[#D4A017]">{f.dueDate}</td>
                      <td className="py-2.5 text-right font-bold text-[#E6C78B]">{f.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Complaints Tab */}
          {activeTableTab === 'complaints' && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                    <th className="pb-2">Case ID</th>
                    <th className="pb-2">Client</th>
                    <th className="pb-2">Inquiry / Escalation</th>
                    <th className="pb-2">Severity</th>
                    <th className="pb-2 text-right">Resolution Desk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                  {complaintQueue.map((c) => (
                    <tr key={c.id} className="hover:bg-[#121212]/50">
                      <td className="py-2.5 font-bold text-[#E6C78B]">{c.id}</td>
                      <td className="py-2.5 font-semibold text-[#FAF7F0]">{c.client}</td>
                      <td className="py-2.5 text-[#9CA3AF]">{c.subject}</td>
                      <td className="py-2.5 text-[#B87333] font-bold">{c.severity}</td>
                      <td className="py-2.5 text-right font-semibold text-[#FAF7F0]">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <UserManagementModal
        currentRole={currentRole}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(newUserData) => {
          const newUser: UserAccount = {
            id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
            name: newUserData.name || 'New Client',
            email: newUserData.email || '',
            role: 'CUSTOMER',
            status: 'Active',
            tier: newUserData.tier || 'Private Wealth Tier 3',
            createdDate: new Date().toISOString().split('T')[0],
            lastActive: 'Just now',
            phone: newUserData.phone || '+1 (212) 555-0100',
            country: newUserData.country || 'Switzerland',
            twoFactorEnabled: true,
            tenantId,
            tenantName: companyName,
            notes: newUserData.notes || `Created via ${companyName} Support Concierge Desk`,
          };
          onUpdateUsers([newUser, ...users]);
        }}
        adminTenantId={tenantId}
      />
    </div>
  );
};
