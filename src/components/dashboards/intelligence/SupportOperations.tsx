import React from 'react';
import { ThreeDColumnChart } from '../../charts3d/ThreeDColumnChart';
import { ThreeDDonutChart } from '../../charts3d/ThreeDDonutChart';
import { SupportAggregates } from '../../../services/finovaDatabase';
import { Headphones, CheckCircle, Clock, BarChart } from 'lucide-react';

interface SupportOperationsProps {
  aggregates: SupportAggregates;
  isLoading: boolean;
}

export const SupportOperations: React.FC<SupportOperationsProps> = ({
  aggregates,
  isLoading,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDColumnChart
          title="Executive Desk Workload"
          subtitle="Active vs Resolved cases by officer"
          data={aggregates.executiveWorkload.map(e => ({
            label: e.executive.split(' ')[0],
            value: e.activeTickets,
            secondaryValue: e.resolvedTickets
          }))}
          height={300}
          dualSeries={true}
          primaryLabel="Active"
          secondaryLabel="Resolved"
        />

        <ThreeDDonutChart
          title="Escalation Categories"
          subtitle="Distribution of support queries"
          segments={aggregates.categoryDistribution.map(c => ({
            label: c.category,
            value: c.count,
            subtext: `${c.percentage}%`
          }))}
          centerLabel="Total Inquiries"
          centerValue={aggregates.totalTickets.toLocaleString()}
          height={320}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] p-6 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-1">SLA Compliance</p>
            <p className="font-mono text-3xl font-black text-emerald-400">{aggregates.slaCompliancePct}%</p>
            <p className="text-[9px] text-emerald-400/60 mt-1">Target: &gt; 98.0%</p>
          </div>
          <CheckCircle size={40} className="text-emerald-500/20" />
        </div>

        <div className="rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] p-6 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-1">Avg Resolution</p>
            <p className="font-mono text-3xl font-black text-[#D4A017]">2.8 Hrs</p>
            <p className="text-[9px] text-[#D4A017]/60 mt-1">Institutional standard</p>
          </div>
          <Clock size={40} className="text-[#D4A017]/20" />
        </div>

        <div className="rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] p-6 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-1">Client CSAT</p>
            <p className="font-mono text-3xl font-black text-blue-400">{aggregates.averageCsat}/5</p>
            <p className="text-[9px] text-blue-400/60 mt-1">Verified survey average</p>
          </div>
          <BarChart size={40} className="text-blue-500/20" />
        </div>
      </div>
    </div>
  );
};
