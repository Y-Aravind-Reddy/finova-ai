import React from 'react';
import { ThreeDAreaChart } from '../../charts3d/ThreeDAreaChart';
import { ThreeDColumnChart } from '../../charts3d/ThreeDColumnChart';
import { ThreeDDonutChart } from '../../charts3d/ThreeDDonutChart';
import { Building2, TrendingUp, Award, Activity } from 'lucide-react';

export const InstitutionHealth: React.FC = () => {
  const mrrData = [
    { label: 'Jul', value: 245000 },
    { label: 'Aug', value: 258000 },
    { label: 'Sep', value: 272000 },
    { label: 'Oct', value: 285000 },
  ];

  const tenantMix = [
    { label: 'Commercial Banks', value: 42, subtext: '74% Volume' },
    { label: 'NBFC / Lending', value: 28, subtext: '12% Volume' },
    { label: 'Wealth Managers', value: 15, subtext: '10% Volume' },
    { label: 'Neo-Banks', value: 10, subtext: '4% Volume' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDAreaChart
          title="Institutional MRR Growth"
          subtitle="Monthly Recurring Revenue (USD)"
          data={mrrData}
          valuePrefix="$"
          height={300}
        />
        
        <ThreeDDonutChart
          title="Institutional Segment Mix"
          subtitle="Distribution by license type"
          segments={tenantMix}
          centerLabel="Active Tenants"
          centerValue="95"
          height={320}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Compliance', value: '99.4%', icon: <Award className="text-[#D4A017]" /> },
          { label: 'User Adoption', value: '+12.4%', icon: <TrendingUp className="text-emerald-400" /> },
          { label: 'Platform Load', value: '18.2%', icon: <Activity className="text-blue-400" /> },
          { label: 'Active Licenses', value: '95/100', icon: <Building2 className="text-[#E6C78B]" /> },
        ].map((stat, idx) => (
          <div key={idx} className="rounded-xl bg-[#1A1A1A] border border-[#3A3A3A] p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#121212] border border-[#3A3A3A]">
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{stat.label}</p>
              <p className="font-mono text-lg font-bold text-[#FAF7F0]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const RevenueAnalytics: React.FC = () => {
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

export const TreasuryLiquidity: React.FC = () => {
  const liquidityMix = [
    { label: 'USD Balance', value: 420, subtext: '$420.5M' },
    { label: 'EUR Balance', value: 210, subtext: '€194.2M' },
    { label: 'INR Balance', value: 180, subtext: '₹15.2B' },
    { label: 'GBP Balance', value: 120, subtext: '£88.4M' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDDonutChart
          title="Multi-Currency Liquidity Pool"
          subtitle="Consolidated platform holdings (USD Base)"
          segments={liquidityMix}
          centerLabel="Net Balance"
          centerValue="$842.5M"
          height={340}
        />

        <ThreeDAreaChart
          title="Settlement Rail Latency"
          subtitle="Average wire clearance time (ms)"
          data={[
            { label: 'SWIFT', value: 4200 },
            { label: 'FEDWIRE', value: 850 },
            { label: 'SEPA', value: 1200 },
            { label: 'IMPS', value: 150 },
          ]}
          valueSuffix="ms"
          height={300}
        />
      </div>
    </div>
  );
};
