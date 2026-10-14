import React, { useState } from 'react';
import { DollarSign, Globe, TrendingUp, Filter, Search, ArrowUpRight } from 'lucide-react';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';

export const FinanceTransactionAnalyticsPage: React.FC = () => {
  const [currencyFilter, setCurrencyFilter] = useState('ALL');

  const hourlyFlowData = [
    { label: '08:00', value: 24500 },
    { label: '10:00', value: 68200 },
    { label: '12:00', value: 94800 },
    { label: '14:00', value: 89100 },
    { label: '16:00', value: 112400 },
    { label: '18:00', value: 64200 },
  ];

  const currencySplitData = [
    { label: 'USD Clearing', value: 1840, secondaryValue: 1700 },
    { label: 'EUR SEPA', value: 890, secondaryValue: 840 },
    { label: 'CHF Sovereign', value: 650, secondaryValue: 610 },
    { label: 'GBP CHAPS', value: 420, secondaryValue: 390, highlight: true },
    { label: 'JPY FX Relay', value: 210, secondaryValue: 195 },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Financial Intelligence
            </span>
            <span className="text-xs text-[#D4A017]">Liquidity & Velocity Analytics</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Transaction Analytics
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Forensic breakdown of gross settlement volumes, cross-border currency pairs, intraday peak liquidity velocities, and clearing fee yields.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Gross Daily Clearing Volume</span>
          <span className="text-sm font-bold text-[#F5C542]">$248.9M USD</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Monitored Transactions"
          value="842,190"
          subValue="Cross-Border & Domestic"
          change="+18.5%"
          trend="up"
          tag="Volume"
          icon={<DollarSign size={20} />}
          sparkline={[500, 600, 680, 740, 790, 820, 842]}
        />
        <ThreeDKpiCard
          title="Average Ticket Size"
          value="$295,500"
          subValue="Institutional Wires"
          change="+4.2%"
          trend="up"
          tag="Ticket"
          variant="gold-accent"
          icon={<TrendingUp size={20} />}
          sparkline={[240, 260, 275, 280, 290, 292, 295]}
        />
        <ThreeDKpiCard
          title="Velocity Rate"
          value="1,420 txn/min"
          subValue="Peak at NY/London Overlap"
          change="Max Surge"
          trend="up"
          tag="Velocity"
          icon={<ArrowUpRight size={20} />}
          sparkline={[800, 950, 1100, 1250, 1340, 1400, 1420]}
        />
        <ThreeDKpiCard
          title="Cross-Border Ratio"
          value="68.4%"
          subValue="SWIFT GPI Validated"
          change="Compliant"
          trend="up"
          tag="Global"
          icon={<Globe size={20} />}
          sparkline={[60, 62, 64, 65, 66, 67, 68]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDAreaChart
          title="3D Intraday Settlement Volume Curve ($)"
          subtitle="Hourly funds transfer distribution across global correspondent rails"
          data={hourlyFlowData}
          valuePrefix="$"
          valueSuffix=""
          height={300}
        />

        <ThreeDColumnChart
          title="3D Currency Reserve & Flow Breakdown ($M USD)"
          subtitle="Primary multi-currency settlement volumes vs Basel capital allocations"
          data={currencySplitData}
          height={300}
          valuePrefix="$"
          valueSuffix="M"
          dualSeries={true}
          primaryLabel="Flow ($M)"
          secondaryLabel="Reserve Target"
        />
      </div>
    </div>
  );
};
