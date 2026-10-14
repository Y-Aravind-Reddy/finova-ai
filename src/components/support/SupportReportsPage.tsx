import React from 'react';
import { Headphones, CheckCircle2, Award, Clock, Star, Download } from 'lucide-react';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDPieChart } from '../charts3d/ThreeDPieChart';

export const SupportReportsPage: React.FC = () => {
  const resolutionData = [
    { label: 'High-Value Wires', value: 12, secondaryValue: 15 },
    { label: 'Card Issuance', value: 14, secondaryValue: 20 },
    { label: 'KYC Verification', value: 22, secondaryValue: 30 },
    { label: 'Tax Document', value: 18, secondaryValue: 25 },
    { label: 'Disputes', value: 26, secondaryValue: 35, highlight: true },
  ];

  const categoryPieData = [
    { label: 'High-Value Wire Clearance', value: 38, subtext: '38% of volume' },
    { label: 'Card & Hardware Key Logistics', value: 24, subtext: '24% of volume' },
    { label: 'KYC & Sanctions Verification', value: 20, subtext: '20% of volume' },
    { label: 'Foreign Tax Apostille', value: 18, subtext: '18% of volume' },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Quality Assurance
            </span>
            <span className="text-xs text-[#D4A017]">Client CSAT & SLA Reporting</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Support Operations Reports
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Institutional concierge performance audits, client satisfaction index (CSAT), and First Contact Resolution (FCR) analytics.
          </p>
        </div>

        <button
          onClick={() => alert('Support SLA audit report exported.')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2"
        >
          <Download size={14} /> Export SLA Report
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Average CSAT Score"
          value="4.94 / 5.0"
          subValue="98.2% 5-Star Ratings"
          change="+0.08"
          trend="up"
          tag="Top Tier"
          icon={<Star size={20} />}
          sparkline={[4.8, 4.82, 4.85, 4.89, 4.9, 4.92, 4.94]}
        />
        <ThreeDKpiCard
          title="First Contact Resolution"
          value="92.4%"
          subValue="Resolved on First Touch"
          change="+3.1%"
          trend="up"
          tag="Efficiency"
          variant="gold-accent"
          icon={<CheckCircle2 size={20} />}
          sparkline={[86, 88, 89, 90, 91, 92, 92.4]}
        />
        <ThreeDKpiCard
          title="Average Resolution"
          value="18.2 min"
          subValue="SLA Threshold <60m"
          change="-4.5 min"
          trend="up"
          tag="Rapid"
          icon={<Clock size={20} />}
          sparkline={[25, 23, 21, 20, 19, 18.5, 18.2]}
        />
        <ThreeDKpiCard
          title="SLA Compliance Rate"
          value="99.6%"
          subValue="Zero SLA Breaches"
          change="Optimal"
          trend="up"
          tag="Guaranteed"
          icon={<Award size={20} />}
          sparkline={[99.1, 99.2, 99.3, 99.4, 99.5, 99.6, 99.6]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDColumnChart
          title="3D Average Resolution Time by Inquiry Domain (Minutes)"
          subtitle="Measured turnaround vs contractual service level agreement (SLA)"
          data={resolutionData}
          height={300}
          valuePrefix=""
          valueSuffix="m"
          dualSeries={true}
          primaryLabel="Actual Time (m)"
          secondaryLabel="SLA Ceiling"
        />

        <ThreeDPieChart
          title="3D Support Inquiries by Service Category"
          subtitle="Inbound inquiry distribution from cleaned_support_executive_pandas.xls"
          segments={categoryPieData}
          height={300}
        />
      </div>
    </div>
  );
};
