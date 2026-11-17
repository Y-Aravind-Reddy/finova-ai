import React from 'react';
import { ThreeDDonutChart } from '../../charts3d/ThreeDDonutChart';
import { ThreeDProgressRing } from '../../charts3d/ThreeDProgressRing';
import { KycAggregates } from '../../../services/finovaDatabase';
import { FileCheck, Users, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';

interface KYCComplianceProps {
  aggregates: KycAggregates;
  isLoading: boolean;
}

const KYCCompliance: React.FC<KYCComplianceProps> = ({
  aggregates,
  isLoading,
}) => {
  const statusItems = React.useMemo(() => [
    { label: 'Verified', value: (aggregates.verifiedCount / (aggregates.totalRecords || 1)) * 100, displayValue: `${aggregates.verifiedCount.toLocaleString()}`, subtext: 'Policy Compliant' },
    { label: 'Pending', value: (aggregates.pendingCount / (aggregates.totalRecords || 1)) * 100, displayValue: `${aggregates.pendingCount.toLocaleString()}`, subtext: 'Queue Backlog' },
    { label: 'In Review', value: (aggregates.reviewCount / (aggregates.totalRecords || 1)) * 100, displayValue: `${aggregates.reviewCount.toLocaleString()}`, subtext: 'Analyst Assigned' },
  ], [aggregates]);

  const totalDocumentTypesCount = React.useMemo(
    () => aggregates.docTypeDistribution.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
    [aggregates.docTypeDistribution]
  );

  const verificationRate =
    aggregates.totalRecords > 0
      ? `${((aggregates.verifiedCount / aggregates.totalRecords) * 100).toFixed(1)}%`
      : '0.0%';

  return (
    <div className={`space-y-6 ${isLoading ? 'opacity-70 transition-opacity' : ''}`}>
      {aggregates.error && (
        <div className="rounded-xl p-3.5 bg-amber-950/50 border border-amber-500/40 text-amber-200 flex items-center gap-2 text-xs">
          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          <span>KYC Telemetry Notice: {aggregates.error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operations Health */}
        <div className="rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] p-6 shadow-xl">
          <ThreeDProgressRing
            title="KYC Operational Health"
            subtitle="Queue status vs throughput target"
            items={statusItems}
            size={240}
          />
        </div>

        {/* Funnel/Tier Distribution */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <ThreeDDonutChart
            title="Institutional Wealth Tiers"
            subtitle="Client segmentation distribution"
            segments={aggregates.tierDistribution.map(t => ({ label: t.label, value: t.value }))}
            centerLabel="Total Records"
            centerValue={aggregates.totalRecords.toLocaleString()}
            height={320}
          />
          <ThreeDDonutChart
            title="Document Intelligence"
            subtitle="Proof of identity/address mix"
            segments={aggregates.docTypeDistribution.map(d => ({ label: d.label, value: d.value }))}
            centerLabel="Documents"
            centerValue={totalDocumentTypesCount.toLocaleString()}
            height={320}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Verified Records', value: aggregates.verifiedCount.toLocaleString(), icon: <FileCheck className="text-emerald-400" /> },
          { label: 'Verification Rate', value: verificationRate, icon: <ShieldCheck className="text-blue-400" /> },
          { label: 'Pending / Review Queue', value: (aggregates.pendingCount + aggregates.reviewCount).toLocaleString(), icon: <Users className="text-[#E6C78B]" /> },
          { label: 'Avg Clearance Time', value: 'Unavailable (not in schema)', icon: <Clock className="text-[#D4A017]" /> },
        ].map((stat, idx) => (
          <div key={idx} className="rounded-xl bg-[#1A1A1A]/80 border border-[#3A3A3A] p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#121212] border border-[#3A3A3A]">
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{stat.label}</p>
              <p className="font-mono text-base font-bold text-[#FAF7F0]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KYCCompliance;
