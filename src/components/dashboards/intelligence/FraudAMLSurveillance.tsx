import React from 'react';
import { ThreeDColumnChart } from '../../charts3d/ThreeDColumnChart';
import { ThreeDDonutChart } from '../../charts3d/ThreeDDonutChart';
import { FraudAggregates } from '../../../services/finovaDatabase';
import { ShieldAlert, AlertTriangle, Zap, ShieldCheck } from 'lucide-react';

interface FraudAMLSurveillanceProps {
  aggregates: FraudAggregates;
  isLoading: boolean;
}

export const FraudAMLSurveillance: React.FC<FraudAMLSurveillanceProps> = ({
  aggregates,
  isLoading,
}) => {
  const riskData = React.useMemo(() => {
    return aggregates.riskTierDistribution?.map(r => ({
      label: r.tier.split('(')[0].trim(),
      value: r.count,
      subtext: `₹${(r.volumeInr / 1000000).toFixed(1)}M`,
    })) || [];
  }, [aggregates.riskTierDistribution]);

  const ruleData = React.useMemo(() => {
    return aggregates.ruleDistribution?.map(r => ({
      label: r.rule,
      value: r.count,
    })) || [];
  }, [aggregates.ruleDistribution]);

  const channelData = React.useMemo(() => {
    return aggregates.channelDistribution?.map(c => ({
      label: c.channel,
      value: c.count,
    })) || [];
  }, [aggregates.channelDistribution]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Distribution */}
        <div className="lg:col-span-2">
          <ThreeDColumnChart
            title="Surveillance Risk Distribution"
            subtitle="Incident density by severity tier"
            data={riskData}
            height={300}
            valuePrefix=""
            valueSuffix=" cases"
            primaryLabel="Incidents"
          />
        </div>

        {/* Status Metrics */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#1E1A10] border border-[#D4A017]/30 p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert className="text-[#D4A017]" size={20} />
              <h4 className="font-cinzel text-xs font-bold text-[#E6C78B]">Active Prevention</h4>
            </div>
            <p className="font-mono text-2xl font-black text-[#FAF7F0]">
              ₹{(aggregates.preventedVolumeInr / 1000000).toFixed(2)}M
            </p>
            <p className="text-[10px] text-[#9CA3AF] mt-1">Capital saved via frozen escrow</p>
          </div>

          <div className="rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="text-emerald-400" size={20} />
              <h4 className="font-cinzel text-xs font-bold text-[#FAF7F0]">Cleared Rate</h4>
            </div>
            <p className="font-mono text-2xl font-black text-emerald-400">
              {((aggregates.clearedCount / (aggregates.totalCases || 1)) * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-[#9CA3AF] mt-1">False positive resolution velocity</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ThreeDDonutChart
          title="Rule Trigger Mix"
          subtitle="Top automated surveillance flags"
          segments={ruleData.slice(0, 5)}
          centerLabel="Total Rules"
          centerValue={aggregates.ruleDistribution?.length.toString() || '0'}
          height={300}
        />
        <ThreeDDonutChart
          title="Payment Channel Risk"
          subtitle="Incident volume by settlement rail"
          segments={channelData}
          centerLabel="Rails"
          centerValue={aggregates.channelDistribution?.length.toString() || '0'}
          height={300}
        />
      </div>
    </div>
  );
};
