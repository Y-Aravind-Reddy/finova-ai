import React from 'react';
import { BarChart3, Activity, Server, Zap, Shield, Globe } from 'lucide-react';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDAreaChart } from '../charts3d/ThreeDAreaChart';
import { ThreeDTransactionHeatmap } from '../charts3d/ThreeDTransactionHeatmap';

export const SuperAdminEnterpriseAnalyticsPage: React.FC = () => {
  const throughputData = [
    { label: '00:00', value: 18400 },
    { label: '04:00', value: 24200 },
    { label: '08:00', value: 89400 },
    { label: '12:00', value: 142000 },
    { label: '16:00', value: 168500 },
    { label: '20:00', value: 92100 },
  ];

  const nodeLatencyData = [
    { label: 'Zurich Cluster', value: 12, secondaryValue: 15 },
    { label: 'London LD4', value: 14, secondaryValue: 18 },
    { label: 'New York NY4', value: 19, secondaryValue: 22 },
    { label: 'Tokyo Equinix', value: 34, secondaryValue: 40, highlight: true },
    { label: 'Frankfurt FR2', value: 11, secondaryValue: 14 },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Super Admin Executive
            </span>
            <span className="text-xs text-[#D4A017]">Global Infrastructure Core</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Enterprise System Analytics
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Multi-region cluster telemetry, payment rail gateway latency, distributed ledger throughput, and fault tolerance monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#141414] px-3.5 py-2 rounded-xl border border-[#D4A017]/30 text-[#F5C542]">
          <Activity size={16} className="text-[#F5C542] animate-pulse" />
          <span>System Uptime: 99.992%</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Daily Settlements"
          value="$4.89B USD"
          subValue="SWIFT & FedNow"
          change="+14.2%"
          trend="up"
          tag="Clearing"
          icon={<Globe size={20} />}
          sparkline={[310, 340, 390, 420, 450, 480, 489]}
        />
        <ThreeDKpiCard
          title="Avg API Latency"
          value="18.4 ms"
          subValue="Global Edge Target <50ms"
          change="-2.1ms"
          trend="up"
          tag="Optimal"
          variant="gold-accent"
          icon={<Zap size={20} />}
          sparkline={[24, 22, 21, 20, 19, 18, 18]}
        />
        <ThreeDKpiCard
          title="Active Microservices"
          value="48 / 48"
          subValue="100% Operational"
          change="0 Faults"
          trend="up"
          tag="Nominal"
          icon={<Server size={20} />}
          sparkline={[48, 48, 48, 48, 48, 48, 48]}
        />
        <ThreeDKpiCard
          title="Sentinel AI Throughput"
          value="142k req/min"
          subValue="4096-bit Secure Enclave"
          change="+8.9%"
          trend="up"
          tag="High Load"
          icon={<BarChart3 size={20} />}
          sparkline={[90, 105, 118, 125, 134, 140, 142]}
        />
      </div>

      {/* 3D Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDAreaChart
          title="3D Global Settlement Throughput Volume (Txn/hr)"
          subtitle="Real-time message traffic across SWIFT GPI, FedNow, and SEPA"
          data={throughputData}
          valuePrefix=""
          valueSuffix=" txn"
          height={300}
        />

        <ThreeDColumnChart
          title="3D Financial Edge Node Latency (ms)"
          subtitle="Round-trip network latency between Finova and exchange co-locations"
          data={nodeLatencyData}
          height={300}
          valuePrefix=""
          valueSuffix=" ms"
          dualSeries={true}
          primaryLabel="Measured Latency (ms)"
          secondaryLabel="SLA Threshold"
        />
      </div>

      {/* Anomaly Heatmap */}
      <ThreeDTransactionHeatmap
        title="3D Interbank Settlement Flow Density"
        subtitle="Hourly transaction concentration mapped across worldwide trading sessions"
      />
    </div>
  );
};
