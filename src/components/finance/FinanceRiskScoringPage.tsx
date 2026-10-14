import React, { useState } from 'react';
import { Activity, ShieldCheck, TrendingDown, DollarSign, PieChart, CheckCircle2 } from 'lucide-react';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDPieChart } from '../charts3d/ThreeDPieChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';

export const FinanceRiskScoringPage: React.FC = () => {
  const riskPieData = [
    { label: 'Tier 3 Sovereign', value: 58, subtext: '58% Low Risk (Score <15)' },
    { label: 'Tier 2 Institutional', value: 28, subtext: '28% Moderate (Score 15-40)' },
    { label: 'Tier 1 Standard', value: 11, subtext: '11% Monitored (Score 40-70)' },
    { label: 'High Risk Watchlist', value: 3, subtext: '3% Critical (Score >70)' },
  ];

  const exposureCurve = [
    { label: 'US Treasuries', value: 1420, secondaryValue: 1350 },
    { label: 'Swiss Confed Bonds', value: 890, secondaryValue: 840 },
    { label: 'Private Credit', value: 420, secondaryValue: 390 },
    { label: 'Gold Bullion Vault', value: 650, secondaryValue: 600, highlight: true },
    { label: 'Overnight Repos', value: 310, secondaryValue: 300 },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Quantitative Risk Modeling
            </span>
            <span className="text-xs text-[#D4A017]">Basel III & Solvency II Engine</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Institutional Risk Scoring
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Dynamic counterparty exposure quantification, Liquidity Coverage Ratio (LCR) buffers, and Value at Risk (VaR 99.9%) simulations.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Aggregate Composite Risk</span>
          <span className="text-sm font-bold text-[#F5C542]">16.4 / 100 (Optimal Tier)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Composite Risk"
          value="16.4 / 100"
          subValue="Low Exposure Tier"
          change="-2.1 pts"
          trend="up"
          tag="Resilient"
          icon={<ShieldCheck size={20} />}
          sparkline={[22, 20, 19, 18, 17, 16, 16]}
        />
        <ThreeDKpiCard
          title="Liquidity Ratio (LCR)"
          value="168.4%"
          subValue="Threshold: >100%"
          change="+14.2%"
          trend="up"
          tag="Basel III"
          variant="gold-accent"
          icon={<Activity size={20} />}
          sparkline={[140, 145, 150, 155, 160, 165, 168]}
        />
        <ThreeDKpiCard
          title="1-Day 99.9% VaR"
          value="$1.42M USD"
          subValue="0.29% of Net Assets"
          change="Safe Boundary"
          trend="up"
          tag="VaR"
          icon={<TrendingDown size={20} />}
          sparkline={[1.8, 1.7, 1.6, 1.5, 1.45, 1.42, 1.42]}
        />
        <ThreeDKpiCard
          title="Collateral Quality"
          value="AAA / AA+"
          subValue="94.2% Sovereign Tier 1"
          change="Prime"
          trend="up"
          tag="Collateral"
          icon={<DollarSign size={20} />}
          sparkline={[90, 91, 92, 93, 93, 94, 94.2]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDPieChart
          title="3D Risk Partition by Account Wealth Tier"
          subtitle="Proportional credit risk and exposure distribution across client segments"
          segments={riskPieData}
          height={300}
        />

        <ThreeDColumnChart
          title="3D Asset Class Counterparty Exposure ($M USD)"
          subtitle="Direct custody asset allocation vs mandated stress thresholds"
          data={exposureCurve}
          height={300}
          valuePrefix="$"
          valueSuffix="M"
          dualSeries={true}
          primaryLabel="Allocation ($M)"
          secondaryLabel="Risk Limit"
        />
      </div>
    </div>
  );
};
