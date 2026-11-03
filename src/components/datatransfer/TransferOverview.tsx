import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transferIntelligenceService } from '../../services/transferIntelligenceService';
import { DataTransferFilterBar, DataTransferFilters } from './DataTransferFilterBar';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDDonutChart } from '../charts3d/ThreeDDonutChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { KpiSkeleton, ModuleSkeleton } from '../dashboards/DashboardSkeletons';
import { 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RotateCw, 
  ShieldAlert,
  ArrowUpRight,
  Activity,
  CreditCard
} from 'lucide-react';

export const TransferOverview: React.FC = () => {
  const [filters, setFilters] = useState<DataTransferFilters>({
    startDate: '',
    endDate: '',
    currency: 'ALL',
    type: 'ALL',
    channel: 'ALL',
    status: 'ALL',
    search: '',
    tenantId: 'ALL'
  });

  const { data: aggregates, isLoading, refetch } = useQuery({
    queryKey: ['transfer-overview', filters],
    queryFn: () => transferIntelligenceService.fetchOverviewAggregates(filters.tenantId, filters),
  });

  if (isLoading && !aggregates) {
    return (
      <div className="space-y-6">
        <div className="h-40 rounded-2xl bg-[#1A1A1A] animate-pulse" />
        <ModuleSkeleton />
      </div>
    );
  }

  const kpis = [
    { 
      title: 'Total Transfers', 
      value: aggregates?.totalTransfers.toLocaleString() || '0', 
      sub: 'Historical volume', 
      icon: <CreditCard size={20} />, 
      trend: 'up', 
      change: '+12.4%', 
      tag: 'Volume' 
    },
    { 
      title: 'Transfer Volume', 
      value: `$${((aggregates?.totalVolume || 0) / 1000000).toFixed(1)}M`, 
      sub: 'Consolidated value', 
      icon: <DollarSign size={20} />, 
      trend: 'up', 
      change: '+8.2%', 
      tag: 'Liquidity',
      variant: 'gold-accent' as const
    },
    { 
      title: 'Settled Transfers', 
      value: aggregates?.successCount.toLocaleString() || '0', 
      sub: 'Confirmed throughput', 
      icon: <CheckCircle2 size={20} />, 
      trend: 'up', 
      change: '92.4%', 
      tag: 'SLA' 
    },
    { 
      title: 'Pending Clearing', 
      value: aggregates?.pendingCount.toLocaleString() || '0', 
      sub: 'Active in rail', 
      icon: <Clock size={20} />, 
      trend: 'down', 
      change: '-4.1%', 
      tag: 'Active' 
    },
    { 
      title: 'Failed / Rejected', 
      value: aggregates?.failedCount.toLocaleString() || '0', 
      sub: 'Exception rate', 
      icon: <AlertCircle size={20} />, 
      trend: 'down', 
      change: '2.4%', 
      tag: 'Risk' 
    },
    { 
      title: 'Reversed Funds', 
      value: aggregates?.reversedCount.toLocaleString() || '0', 
      sub: 'Refunds & Returns', 
      icon: <RotateCw size={20} />, 
      trend: 'up', 
      change: '0.8%', 
      tag: 'Returns' 
    },
    { 
      title: 'Avg. Transfer', 
      value: `$${Math.round(aggregates?.avgAmount || 0).toLocaleString()}`, 
      sub: 'Ticket size', 
      icon: <ArrowUpRight size={20} />, 
      trend: 'up', 
      change: 'Stable', 
      tag: 'Ticket' 
    },
    { 
      title: 'Fraud Flags', 
      value: aggregates?.fraudFlaggedCount.toLocaleString() || '0', 
      sub: 'Surveillance hits', 
      icon: <ShieldAlert size={20} />, 
      trend: 'down', 
      change: '-12%', 
      tag: 'Security' 
    },
  ];

  const currencySegments = Object.entries(aggregates?.currencyExposure || {}).map(([label, value]) => ({
    label,
    value,
    subtext: `${label} Rail`
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
            Transfer Intelligence Center
          </h1>
          <p className="text-xs text-[#9CA3AF] font-mono mt-1 uppercase tracking-widest flex items-center gap-2">
            Institutional Telemetry • Node {aggregates?.source === 'supabase' ? 'Live' : 'Fallback'} • Secure Environment
            {aggregates?.isPartial && (
              <span className="px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-500/30 text-[10px] animate-pulse">
                Partial Data
              </span>
            )}
            {(aggregates?.rejectedRecordsCount ?? 0) > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-500/30 text-[10px]">
                {aggregates?.rejectedRecordsCount} Rejected Records
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Global Filter Bar */}
      <DataTransferFilterBar 
        filters={filters} 
        onFilterChange={setFilters} 
        onRefresh={() => refetch()} 
        isLoading={isLoading} 
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <ThreeDKpiCard
            key={idx}
            title={kpi.title}
            value={kpi.value}
            subValue={kpi.sub}
            icon={kpi.icon}
            trend={kpi.trend as any}
            change={kpi.change}
            tag={kpi.tag}
            variant={kpi.variant}
            isEstimated={aggregates?.isPartial}
          />
        ))}
      </div>

      {/* Primary Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3D Settlement Velocity */}
        <ThreeDAreaChart
          title="3D Settlement Velocity"
          subtitle="Real-time Intraday clearing volume (Nominal USD)"
          data={aggregates?.hourlyVelocity.map(v => ({ label: v.hour, value: v.volume })) || []}
          valuePrefix="$"
          height={350}
        />

        {/* 3D Transfer Status Distribution */}
        <ThreeDDonutChart
          title="Status Distribution"
          subtitle="Volume mix by clearing state"
          segments={aggregates?.statusDistribution.slice(0, 5) || []}
          centerLabel="Total TX"
          centerValue={aggregates?.totalTransfers.toLocaleString() || '0'}
          height={350}
        />
      </div>

      {/* Secondary Visualizations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Category Mix */}
        <ThreeDDonutChart
          title="Category Intelligence"
          subtitle="Portfolio allocation"
          segments={aggregates?.categoryMix.slice(0, 5) || []}
          centerLabel="Classes"
          centerValue={aggregates?.categoryMix.length.toString() || '0'}
          height={320}
        />

        {/* Currency Exposure */}
        <ThreeDDonutChart
          title="Currency Rail Mix"
          subtitle="Global liquidity distribution"
          segments={currencySegments.slice(0, 5)}
          centerLabel="FX Pairs"
          centerValue={currencySegments.length.toString()}
          height={320}
        />

        {/* Channel Performance */}
        <div className="md:col-span-1 rounded-2xl bg-[#1A1A1A]/50 border border-[#3A3A3A] p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-cinzel text-base font-bold text-[#E6C78B]">Rail Performance</h3>
              <p className="text-[10px] text-[#9CA3AF] font-mono">Channel utilization rates</p>
            </div>
            <Activity size={18} className="text-[#D4A017]" />
          </div>
          
          <div className="flex-1">
            <ThreeDColumnChart
              data={aggregates?.channelPerformance || []}
              height={220}
              primaryLabel="TX Count"
            />
          </div>
        </div>
      </div>

      {/* Insights Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Peak Settlement Window', value: '14:00 - 16:00 UTC', color: 'text-[#D4A017]' },
          { label: 'Highest Volume Channel', value: 'SWIFT GPI', color: 'text-emerald-400' },
          { label: 'Pending Liquidity', value: `$${((aggregates?.pendingCount || 0) * 4.2).toFixed(1)}M`, color: 'text-amber-400' },
          { label: 'High-Risk Alerts', value: aggregates?.fraudFlaggedCount.toString() || '0', color: 'text-red-400' },
        ].map((insight, idx) => (
          <div key={idx} className="rounded-xl bg-[#121212] border border-[#3A3A3A] p-4 flex flex-col gap-1 shadow-inner">
            <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">{insight.label}</span>
            <span className={`font-mono text-sm font-bold ${insight.color}`}>{insight.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
