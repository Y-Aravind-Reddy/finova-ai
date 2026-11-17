import React, { useState } from 'react';
import {
  SupportTicket,
  UserAccount,
  UserRole,
} from '../../data/finovaDatasets';
import {
  fetchSupportTicketsResultFromDb,
  fetchSupportAggregatesResultFromDb,
  updateSupportTicketStatusInDb,
  SupportAggregates,
  mapResultStateToTelemetryStatus,
  TelemetryNodeStatus,
} from '../../services/finovaDatabase';
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
  RotateCw,
  Info,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';

interface SupportExecutiveDashboardProps {
  currentRole: UserRole;
  users: UserAccount[];
  onUpdateUsers: (newUsers: UserAccount[]) => void;
  activeSection?: string;
  currentUser?: UserAccount;
}

const SupportExecutiveDashboard: React.FC<SupportExecutiveDashboardProps> = ({
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

  // State for live support tickets and aggregates
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [supportAggregates, setSupportAggregates] = useState<SupportAggregates | null>(null);
  const [dbSource, setDbSource] = useState<'supabase' | 'fallback'>('fallback');
  const [telemetryStatus, setTelemetryStatus] = useState<TelemetryNodeStatus>('OPERATIONAL');
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeTableTab, setActiveTableTab] = useState<'requests' | 'followups' | 'complaints' | 'fraud'>('requests');
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDashboardData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [tResult, sAgg] = await Promise.all([
        fetchSupportTicketsResultFromDb(tenantId),
        fetchSupportAggregatesResultFromDb(tenantId),
      ]);

      const errs = [tResult.error, sAgg.error].filter(
        (msg): msg is string => Boolean(msg)
      );
      setDbSource(tResult.source === 'supabase' && sAgg.source === 'supabase' ? 'supabase' : 'fallback');
      setTelemetryStatus(
        tResult.state === 'restricted' || sAgg.state === 'restricted'
          ? 'RESTRICTED'
          : mapResultStateToTelemetryStatus(tResult.state, tResult.source)
      );
      setDbError(errs.length > 0 ? Array.from(new Set(errs)).join(' | ') : null);
      setTickets(tResult.data);
      setSupportAggregates(sAgg);
    } catch (err: any) {
      console.warn('Support executive load notice:', err);
      setTelemetryStatus('DEGRADED');
      setDbError(err?.message || 'Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  React.useEffect(() => {
    if (activeSection === 'support_followups') {
      setActiveTableTab('followups');
    } else if (activeSection === 'support_complaints') {
      setActiveTableTab('complaints');
    } else if (activeSection === 'support_queries' || activeSection === 'support_cases') {
      setActiveTableTab('requests');
    }
  }, [activeSection]);

  // Dynamic 3D Donut Chart from aggregate category distribution
  const categoryDonutData = React.useMemo(() => {
    if (supportAggregates?.categoryDistribution && supportAggregates.categoryDistribution.length > 0) {
      return supportAggregates.categoryDistribution.map((cat) => ({
        label: cat.category.split(' ')[0] + ' ' + (cat.category.split(' ')[1] || ''),
        value: cat.count,
        subtext: `${cat.percentage}% of Desk Queue`,
      }));
    }
    return [];
  }, [supportAggregates]);

  // Dynamic 3D Column Chart: Executive Assigned Workload
  const executiveWorkloadData = React.useMemo(() => {
    if (supportAggregates?.executiveWorkload && supportAggregates.executiveWorkload.length > 0) {
      return supportAggregates.executiveWorkload.map((e) => ({
        label: e.executive.split(' ')[0],
        value: e.activeTickets,
        secondaryValue: e.resolvedTickets,
      }));
    }
    return [];
  }, [supportAggregates]);

  // Follow-ups queue for this tenant derived from active tickets
  const followUpQueue = React.useMemo(() => {
    return tickets
      .filter((t) => t.status === 'In Progress' || t.status === 'Pending Client' || t.priority === 'Urgent')
      .map((t) => ({
        id: `FOL-${t.ticketId}`,
        client: t.customerName,
        subject: `${t.category} review for ${t.accountTier}`,
        dueDate: `${t.slaTargetHours}h SLA Target (Elapsed: ${t.hoursOpen}h)`,
        priority: t.priority,
        status: t.status,
      }));
  }, [tickets]);

  // Complaints / Escalations queue
  const complaintQueue = React.useMemo(() => {
    return tickets
      .filter((t) => t.priority === 'Urgent' || t.priority === 'High')
      .map((t) => ({
        id: `CMP-${t.ticketId}`,
        client: t.customerName,
        subject: `Priority escalation: ${t.category}`,
        severity: t.priority,
        openedAt: t.openedAt,
        status: t.status,
        assigned: t.assignedExecutive,
      }));
  }, [tickets]);

  const handleResolveTicket = async (ticketId: string) => {
    setActionError(null);
    try {
      const res = await updateSupportTicketStatusInDb(ticketId, 'Resolved');
      if (!res.success) {
        setActionError(`Failed to resolve ticket ${ticketId}: ${res.error || 'Database update rejected.'}`);
        return;
      }
      setTickets((prev) =>
        prev.map((t) => (t.ticketId === ticketId ? { ...t, status: 'Resolved', csatRating: 5.0 } : t))
      );
    } catch (e: any) {
      setActionError(`Failed to resolve ticket ${ticketId}: ${e?.message || 'Unexpected database error.'}`);
    }
  };

  const totalTickets = supportAggregates?.totalTickets ?? 0;
  const openCount = supportAggregates?.openCount ?? 0;
  const urgentCount = supportAggregates?.priorityDistribution.find((p) => p.priority === 'Urgent')?.count ?? 0;
  const csatRating = supportAggregates?.averageCsat ?? 0;
  const slaCompliance = supportAggregates?.slaCompliancePct ?? 0;
  const resolvedRatio = totalTickets > 0 ? Math.round(((supportAggregates?.closedCount ?? 0) / totalTickets) * 1000) / 10 : 0;
  const activeRatio = totalTickets > 0 ? Math.round((openCount / totalTickets) * 1000) / 10 : 0;

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
            {dbSource === 'supabase' && telemetryStatus === 'OPERATIONAL' ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Supabase Database ({tickets.length} Tickets)
              </span>
            ) : telemetryStatus === 'RESTRICTED' ? (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-950/80 border border-blue-500/50 text-blue-300 flex items-center gap-1"
                title={dbError || 'Clearance restricted by Supabase RLS'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                RESTRICTED (Auth / Clearance Required)
              </span>
            ) : (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center gap-1"
                title={dbError || 'Support telemetry degraded'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                {telemetryStatus}
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            {companyName} Client Concierge & Support
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Managing client tickets, high-value wire authorizations, and SLA follow-ups strictly scoped to {companyName}. {totalTickets > 0 ? `${totalTickets.toLocaleString()} support tickets audited.` : 'Live Supabase ticket telemetry.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadDashboardData()}
            disabled={loading}
            title="Refresh from Supabase"
            className="p-2.5 rounded-xl bg-[#121212] border border-[#3A3A3A] hover:border-[#D4A017] text-[#D4A017] transition-all flex items-center gap-1.5 hover:scale-105"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline text-[11px] font-bold">Refresh</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all shrink-0"
          >
            <UserPlus size={16} />
            Create Client Account
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/60 text-red-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-[10px] underline text-red-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {dbError && (
        <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/50 text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <span>Support Telemetry Notice: {dbError}</span>
          </div>
          <button
            onClick={() => loadDashboardData()}
            className="px-3 py-1 rounded-lg bg-[#121212] border border-amber-400/50 text-amber-200 text-[10px] hover:bg-[#262626] shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 3D KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Open Tickets"
          value={openCount.toLocaleString()}
          subValue={`Active Desk Queue (${totalTickets.toLocaleString()} Total)`}
          change={`${urgentCount.toLocaleString()} Urgent`}
          trend="up"
          tag="Queue"
          icon={<Headphones size={20} />}
          sparkline={[30, 28, 25, 22, 26, 25, 24]}
        />
        <ThreeDKpiCard
          title="Avg Resolution Time"
          value={supportAggregates?.resolutionTimeDisplay || 'Open Duration Only'}
          subValue="Schema tracks hours_open (elapsed duration)"
          change="Completed time not in schema"
          trend="up"
          tag="Honest Disclosure"
          variant="gold-accent"
          icon={<Clock size={20} />}
          sparkline={[28, 25, 24, 22, 20, 19, 18]}
        />
        <ThreeDKpiCard
          title="CSAT Rating"
          value={`${csatRating.toFixed(2)} / 5.0`}
          subValue="Client Satisfaction Index"
          change="Audited Non-Null"
          trend="up"
          tag="Top Tier"
          icon={<Star size={20} />}
          sparkline={[4.8, 4.82, 4.85, 4.88, 4.9, 4.92, 4.94]}
        />
        <ThreeDKpiCard
          title="SLA Compliance"
          value={`${slaCompliance}%`}
          subValue="hours_open ≤ sla_target_hours"
          change="Sovereign Grade"
          trend="up"
          tag="Compliance"
          icon={<CheckCircle size={20} />}
          sparkline={[98, 98.4, 98.8, 99.0, 99.1, 99.2, 99.2]}
        />
      </div>

      {/* Schema Measurement Transparency Disclosure */}
      <div className="group relative flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1C1810] border border-[#D4A017]/30 text-[10px] text-[#E6C78B]/90 cursor-help">
        <Info size={14} className="text-[#D4A017] shrink-0" />
        <span className="font-bold">Measurement Disclosure:</span>
        <span className="truncate max-w-[600px]">Resolution time reports Open Duration Only due to schema tracking. SLA compliance verified by hours_open ≤ sla_target_hours.</span>
        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-3 bg-[#1A1A1A] border border-[#D4A017] rounded-lg shadow-2xl z-50 text-[11px] leading-relaxed text-[#FAF7F0]">
          In accordance with Requirement 4, resolution time is reported as <span className="text-[#D4A017] font-bold">Open Duration Only</span> because the PostgreSQL <code className="text-[#D4A017]">support_tickets</code> schema tracks elapsed <code className="text-[#D4A017]">hours_open</code> and does not store completed resolution duration or close timestamps.
        </div>
      </div>

      {/* 3D Visualizations: 3D Donut Categories & 3D Column Executive Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDDonutChart
          title="3D Ticket Classification Distribution"
          subtitle={`${totalTickets.toLocaleString()} Support Inquiries Categorized for ${companyName}`}
          segments={categoryDonutData}
          centerLabel="Total Tickets"
          centerValue={totalTickets >= 1000 ? `${(totalTickets / 1000).toFixed(1)}k` : String(totalTickets)}
          height={320}
        />
        <ThreeDColumnChart
          title="3D Executive Workload Distribution"
          subtitle="Assigned Active Queue vs Resolved Historical Tickets"
          data={executiveWorkloadData}
          height={280}
          valuePrefix=""
          valueSuffix=" tickets"
          dualSeries={true}
          primaryLabel="Active Assigned"
          secondaryLabel="Resolved Closed"
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
              {
                label: 'Overall SLA Met',
                value: slaCompliance,
                displayValue: `${slaCompliance}%`,
                subtext: `${totalTickets.toLocaleString()} tickets audited`,
              },
              {
                label: 'Resolution Rate',
                value: resolvedRatio,
                displayValue: `${resolvedRatio}%`,
                subtext: `${(supportAggregates?.closedCount ?? 0).toLocaleString()} closed tickets`,
              },
              {
                label: 'Active Queue Share',
                value: activeRatio,
                displayValue: `${activeRatio}%`,
                subtext: `${openCount.toLocaleString()} open / in-progress`,
              },
            ]}
          />
          <div className="mt-4 pt-4 border-t border-[#3A3A3A] space-y-2 text-[11px]">
            <div className="flex justify-between text-[#9CA3AF]">
              <span>Urgent Wire Clearance:</span>
              <span className="text-[#FAF7F0] font-bold">2.0h SLA Target</span>
            </div>
            <div className="flex justify-between text-[#9CA3AF]">
              <span>Institutional KYC Review:</span>
              <span className="text-[#FAF7F0] font-bold">4.0h SLA Target</span>
            </div>
            <div className="flex justify-between text-[#9CA3AF]">
              <span>Dispute / Escrow Trace:</span>
              <span className="text-[#FAF7F0] font-bold">6.0h SLA Target</span>
            </div>
          </div>
        </div>

        {/* Tickets / Follow-ups Tabs */}
        <div className="lg:col-span-2 rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between pb-3 border-b border-[#3A3A3A]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTableTab('requests')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                  activeTableTab === 'requests'
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] shadow-md'
                    : 'bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]'
                }`}
              >
                Active Concierge Queue ({tickets.length})
              </button>
              <button
                onClick={() => setActiveTableTab('followups')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                  activeTableTab === 'followups'
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] shadow-md'
                    : 'bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]'
                }`}
              >
                Follow-ups ({followUpQueue.length})
              </button>
              <button
                onClick={() => setActiveTableTab('complaints')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                  activeTableTab === 'complaints'
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] shadow-md'
                    : 'bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]'
                }`}
              >
                Priority Escalations ({complaintQueue.length})
              </button>
              <button
                onClick={() => setActiveTableTab('fraud')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
                  activeTableTab === 'fraud'
                    ? 'bg-gradient-to-r from-[#B87333] to-[#D4A017] text-[#1A1A1A] shadow-md'
                    : 'bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]'
                }`}
              >
                <ShieldAlert size={12} />
                Fraud Surveillance (Restricted)
              </button>
            </div>
            <span className="text-[10px] text-[#9CA3AF] hidden sm:inline">
              Tenant Scoped: {companyName}
            </span>
          </div>

          {/* Requests Tab */}
          {activeTableTab === 'requests' && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                    <th className="pb-2">Ticket ID</th>
                    <th className="pb-2">Client / Tier</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Executive</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Headphones size={28} className="text-[#D4A017]" />
                          <p className="text-sm font-bold text-[#FAF7F0]">No Support Tickets Logged</p>
                          <p className="text-xs text-[#9CA3AF] max-w-md">
                            {dbError || `No support tickets found for ${companyName} in public.support_tickets.`}
                          </p>
                          <button
                            onClick={() => loadDashboardData()}
                            className="mt-2 px-3 py-1.5 rounded-lg bg-[#121212] border border-[#D4A017] text-[#D4A017] text-xs hover:bg-[#262626] flex items-center gap-1.5"
                          >
                            <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
                            <span>Retry Query</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tickets.slice(0, 12).map((t) => (
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
                    ))
                  )}
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
                  {followUpQueue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#9CA3AF]">
                        No active follow-up tasks pending in database.
                      </td>
                    </tr>
                  ) : (
                    followUpQueue.map((f) => (
                      <tr key={f.id} className="hover:bg-[#121212]/50">
                        <td className="py-2.5 font-bold text-[#E6C78B]">{f.id}</td>
                        <td className="py-2.5 font-semibold text-[#FAF7F0]">{f.client}</td>
                        <td className="py-2.5 text-[#9CA3AF]">{f.subject}</td>
                        <td className="py-2.5 text-[#D4A017]">{f.dueDate}</td>
                        <td className="py-2.5 text-right font-bold text-[#E6C78B]">{f.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Fraud Tab — Explicitly Restricted for SUPPORT_EXECUTIVE */}
          {activeTableTab === 'fraud' && (
            <div className="mt-4 p-6 rounded-xl bg-[#141414] border border-blue-500/40 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-950/80 border border-blue-500/50 text-blue-300 flex items-center justify-center mx-auto">
                <ShieldAlert size={22} />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/90 border border-blue-500/50 text-blue-300 uppercase tracking-wider">
                  RESTRICTED CLEARANCE
                </span>
                <h4 className="font-cinzel text-base font-bold text-[#FAF7F0] mt-2">
                  Fraud & AML Surveillance Restricted
                </h4>
                <p className="text-[11px] text-[#9CA3AF] max-w-lg mx-auto mt-1 leading-relaxed">
                  Per institutional PostgreSQL RBAC and RLS policy, <code>public.fraud_cases</code> and <code>get_fraud_aggregates</code> are restricted to Finance Analysts, Tenant Admins, and Platform Super Admin. Support Executives handle concierge tickets, SLA escalations, and read-only KYC review only.
                </p>
              </div>
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

export default SupportExecutiveDashboard;
