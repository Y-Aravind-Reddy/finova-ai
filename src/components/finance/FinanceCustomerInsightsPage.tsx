import React, { useState } from 'react';
import { DollarSign, TrendingUp, Users, ArrowUpRight, Search } from 'lucide-react';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';

export const FinanceCustomerInsightsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const wealthGrowth = [
    { label: 'Q1', value: 4120 },
    { label: 'Q2', value: 4380 },
    { label: 'Q3', value: 4620 },
    { label: 'Q4', value: 4892 },
  ];

  const clientSegments = [
    {
      id: 'HNW-01',
      name: 'Harrison Croft',
      tier: 'Private Wealth Tier 3 (Sovereign)',
      netWorth: '$4.89M USD',
      liquidityPct: '25.6% Liquid',
      primaryYield: '5.18% APY',
      relationshipManager: 'Claire Montgomery',
    },
    {
      id: 'HNW-02',
      name: 'Victoria Habsburg',
      tier: 'Private Wealth Tier 3 (Sovereign)',
      netWorth: '$8.42M USD',
      liquidityPct: '32.1% Liquid',
      primaryYield: '5.24% APY',
      relationshipManager: 'Claire Montgomery',
    },
    {
      id: 'HNW-03',
      name: 'Marcus Aurelius Sterling',
      tier: 'Private Wealth Tier 3 (Sovereign)',
      netWorth: '$12.80M USD',
      liquidityPct: '18.4% Liquid',
      primaryYield: '5.15% APY',
      relationshipManager: 'James Sterling',
    },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Wealth Intelligence
            </span>
            <span className="text-xs text-[#D4A017]">HNW Portfolio Trajectory</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Customer Financial Insights
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Macroscopic asset health, sovereign cash yield optimization, and liquidity runway analytics across accredited private wealth clients.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Average Client Portfolio Value</span>
          <span className="text-sm font-bold text-[#F5C542]">$6.74M USD</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Total Custody NAV"
          value="$942.5M"
          subValue="Tier 3 Accredited Assets"
          change="+14.8%"
          trend="up"
          tag="Custody"
          icon={<DollarSign size={20} />}
          sparkline={[800, 830, 860, 890, 915, 930, 942]}
        />
        <ThreeDKpiCard
          title="Weighted Avg Yield"
          value="5.19% APY"
          subValue="Net Sovereign & Treasuries"
          change="+42 bps"
          trend="up"
          tag="Yield"
          variant="gold-accent"
          icon={<TrendingUp size={20} />}
          sparkline={[4.5, 4.7, 4.85, 5.0, 5.1, 5.15, 5.19]}
        />
        <ThreeDKpiCard
          title="Cash Allocation"
          value="24.2%"
          subValue="Instant Operating Vault"
          change="Healthy"
          trend="up"
          tag="Liquidity"
          icon={<ArrowUpRight size={20} />}
          sparkline={[20, 21, 22, 23, 23.5, 24, 24.2]}
        />
        <ThreeDKpiCard
          title="Client Retention"
          value="99.7%"
          subValue="Multi-Generational"
          change="Peerless"
          trend="up"
          tag="Tenure"
          icon={<Users size={20} />}
          sparkline={[99, 99.2, 99.4, 99.5, 99.6, 99.7, 99.7]}
        />
      </div>

      <ThreeDAreaChart
        title="3D Client Net Asset Value Trajectory ($M USD)"
        subtitle="Quarterly compounding growth of institutional custody assets under Finova management"
        data={wealthGrowth}
        valuePrefix="$"
        valueSuffix="M"
        height={300}
      />

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2 pb-3 border-b border-[#D4A017]/20">
          <Users size={16} className="text-[#F5C542]" /> High Net Worth Client Portfolio Dossiers
        </h3>

        <div className="space-y-3">
          {clientSegments.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <span className="font-bold text-[#FFF8E7] text-sm">{c.name}</span>
                <p className="text-[11px] text-[#D4A017]">{c.tier}</p>
                <p className="text-[10px] text-[#6B7280]">RM: {c.relationshipManager}</p>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div>
                  <span className="text-[10px] text-[#6B7280] block">Portfolio NAV</span>
                  <span className="font-bold text-sm text-[#F5C542]">{c.netWorth}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7280] block">Liquidity</span>
                  <span className="font-semibold text-xs text-[#FAF7F0]">{c.liquidityPct}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7280] block">Yield</span>
                  <span className="font-bold text-xs text-[#C08A00]">{c.primaryYield}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
