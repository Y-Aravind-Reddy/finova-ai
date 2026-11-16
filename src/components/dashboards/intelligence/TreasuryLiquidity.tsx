import React from 'react';
import { ThreeDAreaChart } from '../../charts3d/ThreeDAreaChart';
import { ThreeDDonutChart } from '../../charts3d/ThreeDDonutChart';

const TreasuryLiquidity: React.FC = () => {
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

export default TreasuryLiquidity;
