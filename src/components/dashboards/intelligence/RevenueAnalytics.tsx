import React from 'react';
import { ThreeDColumnChart } from '../../charts3d/ThreeDColumnChart';
import { ThreeDDonutChart } from '../../charts3d/ThreeDDonutChart';

const RevenueAnalytics: React.FC = () => {
  const revenueMix = [
    { label: 'Subscription', value: 285000, subtext: 'Fixed MRR' },
    { label: 'Processing Fees', value: 142000, subtext: '0.15% per tx' },
    { label: 'KYC Val.', value: 42000, subtext: '$2 per check' },
    { label: 'FX Margin', value: 89000, subtext: 'Spot spread' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ThreeDColumnChart
            title="Revenue Component Analysis"
            subtitle="Current month projected earnings (USD)"
            data={revenueMix.map(r => ({ label: r.label, value: r.value / 1000 }))}
            height={320}
            valuePrefix="$"
            valueSuffix="K"
            primaryLabel="Revenue"
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/30 p-6 shadow-xl">
            <h4 className="font-cinzel text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Gross Margin</h4>
            <p className="font-mono text-4xl font-black text-[#FAF7F0]">84.2%</p>
            <div className="w-full h-1.5 bg-[#121212] rounded-full mt-4 overflow-hidden border border-[#262626]">
              <div className="h-full bg-emerald-400 w-[84.2%]" />
            </div>
          </div>

          <div className="rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] p-6 shadow-xl">
            <h4 className="font-cinzel text-xs font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">Net Burn Rate</h4>
            <p className="font-mono text-2xl font-black text-[#FAF7F0]">$12,400/mo</p>
            <p className="text-[10px] text-[#9CA3AF] mt-2">Cloud infrastructure + operations</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueAnalytics;
