import React from 'react';
import { ThreeDAreaChart } from '../../charts3d/ThreeDAreaChart';
import { ThreeDDonutChart } from '../../charts3d/ThreeDDonutChart';
import { Building2, TrendingUp, Award, Activity } from 'lucide-react';

const InstitutionHealth: React.FC = () => {
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

export default InstitutionHealth;
