import React from 'react';
import { ThreeDAreaChart } from '../../charts3d/ThreeDAreaChart';
import { ThreeDDonutChart } from '../../charts3d/ThreeDDonutChart';
import { ThreeDColumnChart } from '../../charts3d/ThreeDColumnChart';
import { TransactionAggregates } from '../../../services/finovaDatabase';
import { TrendingUp, DollarSign, Activity, Globe } from 'lucide-react';

interface TransactionIntelligenceProps {
  aggregates: TransactionAggregates;
  isLoading: boolean;
}

export const TransactionIntelligence: React.FC<TransactionIntelligenceProps> = ({
  aggregates,
  isLoading,
}) => {
  const categoryData = React.useMemo(() => {
    if (!aggregates.categoryBreakdown) return [];
    return Object.entries(aggregates.categoryBreakdown).map(([label, val]) => ({
      label,
      value: val.count,
      subtext: `₹${(val.volumeInr / 1000000).toFixed(1)}M`,
    }));
  }, [aggregates.categoryBreakdown]);

  const currencyData = React.useMemo(() => {
    if (!aggregates.volumeByCurrency) return [];
    return Object.entries(aggregates.volumeByCurrency).map(([label, val]) => ({
      label,
      value: val.inr,
      subtext: `${label} Base`,
    }));
  }, [aggregates.volumeByCurrency]);

  const merchantData = React.useMemo(() => {
    if (!aggregates.topMerchants) return [];
    return aggregates.topMerchants.map((m) => ({
      label: m.merchant,
      value: m.volumeInr / 1000000,
    }));
  }, [aggregates.topMerchants]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDAreaChart
          title="3D Settlement Velocity"
          subtitle="Real-time Intraday Clearing Volume (INR Base)"
          data={aggregates.volumeByDay?.map(d => ({ label: d.date.split('-')[2], value: d.volumeInr / 1000000 })) || []}
          valuePrefix="₹"
          valueSuffix="M"
          height={300}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ThreeDDonutChart
            title="Category Mix"
            subtitle="Volume by Asset Class"
            segments={categoryData.slice(0, 5)}
            centerLabel="Total Tx"
            centerValue={aggregates.totalCount.toLocaleString()}
            height={300}
          />
          <ThreeDDonutChart
            title="Currency Exposure"
            subtitle="Global Settlement Rail Mix"
            segments={currencyData}
            centerLabel="FX Load"
            centerValue={Object.keys(aggregates.volumeByCurrency || {}).length.toString()}
            height={300}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-[#1A1A1A]/50 border border-[#3A3A3A] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-cinzel text-lg font-bold text-[#E6C78B]">Top Institutional Counterparties</h3>
            <p className="text-xs text-[#9CA3AF]">Merchant and exchange clearing volumes</p>
          </div>
          <Activity size={20} className="text-[#D4A017]" />
        </div>
        
        <ThreeDColumnChart
          data={merchantData}
          height={300}
          valuePrefix="₹"
          valueSuffix="M"
          primaryLabel="Settled Volume"
        />
      </div>
    </div>
  );
};
