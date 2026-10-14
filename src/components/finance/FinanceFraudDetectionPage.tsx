import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Lock, Unlock, CheckCircle2, Search, DollarSign } from 'lucide-react';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';

export const FinanceFraudDetectionPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const fraudTrend = [
    { label: 'May', value: 680, secondaryValue: 720 },
    { label: 'Jun', value: 890, secondaryValue: 840 },
    { label: 'Jul', value: 1120, secondaryValue: 1050 },
    { label: 'Aug', value: 980, secondaryValue: 920 },
    { label: 'Sep', value: 1340, secondaryValue: 1200 },
    { label: 'Oct', value: 1480, secondaryValue: 1420, highlight: true },
  ];

  const flaggedIncidents = [
    {
      id: 'FRD-991',
      entity: 'Veloce Global Relay',
      amount: '$890,000 USD',
      vector: 'Velocity Burst (5 Wires in 12 Mins)',
      anomalyScore: 92,
      status: 'Escrow Frozen',
    },
    {
      id: 'FRD-992',
      entity: 'Aegis Offshore Holdings',
      amount: '$1,240,000 USD',
      vector: 'Layering via Non-Cooperative Port',
      anomalyScore: 96,
      status: 'Escrow Frozen',
    },
    {
      id: 'FRD-993',
      entity: 'Orion Meridian Capital',
      amount: '$420,000 EUR',
      vector: 'Device Fingerprint & Geo Spoofing',
      anomalyScore: 78,
      status: 'Analyst Review',
    },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Forensic Analytics
            </span>
            <span className="text-xs text-[#D4A017]">Threat Interception Center</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Fraud Detection & Prevention
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Predictive machine learning models intercepting zero-day fraudulent wire transfers, credential attacks, and transaction layering.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">False Positive Benchmark</span>
          <span className="text-sm font-bold text-[#F5C542]">0.12% (Gold Standard)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Prevented Losses"
          value="$4.82M"
          subValue="142 Fraudulent Transfers"
          change="+32.1%"
          trend="up"
          tag="Saved"
          icon={<DollarSign size={20} />}
          sparkline={[120, 180, 240, 310, 390, 440, 482]}
        />
        <ThreeDKpiCard
          title="Detection Latency"
          value="14.2 ms"
          subValue="Inline Wire Evaluation"
          change="-3.5ms"
          trend="up"
          tag="Real-Time"
          variant="gold-accent"
          icon={<ShieldAlert size={20} />}
          sparkline={[22, 20, 18, 17, 16, 15, 14]}
        />
        <ThreeDKpiCard
          title="Active Fraud Locks"
          value="7 Entities"
          subValue="Collateral Secured"
          change="Court Hold"
          trend="down"
          tag="Frozen"
          icon={<Lock size={20} />}
          sparkline={[5, 6, 6, 7, 7, 7, 7]}
        />
        <ThreeDKpiCard
          title="Model Confidence"
          value="99.88%"
          subValue="Random Forest & Neural"
          change="Calibrated"
          trend="up"
          tag="Ensemble"
          icon={<CheckCircle2 size={20} />}
          sparkline={[99.4, 99.5, 99.6, 99.7, 99.8, 99.8, 99.88]}
        />
      </div>

      <ThreeDColumnChart
        title="3D Prevented Fraud Volumes vs Intercepted Threats ($k USD)"
        subtitle="Historical fraud mitigation performance across sovereign and institutional accounts"
        data={fraudTrend}
        height={280}
        valuePrefix="$"
        valueSuffix="k"
        dualSeries={true}
        primaryLabel="Prevented ($k)"
        secondaryLabel="Threat Level"
      />

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2 pb-3 border-b border-[#D4A017]/20">
          <AlertTriangle size={16} className="text-[#F5C542]" /> Flagged High-Risk Fraud Vectors
        </h3>

        <div className="space-y-3">
          {flaggedIncidents.map((f) => (
            <div
              key={f.id}
              className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#301B05] text-[#F5C542] font-bold text-[10px]">
                    {f.id}
                  </span>
                  <span className="font-bold text-[#FFF8E7]">{f.entity}</span>
                </div>
                <p className="text-[11px] text-[#D4A017] mt-1">{f.vector}</p>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="font-bold text-sm text-[#F5C542]">{f.amount}</span>
                  <span className="text-[10px] text-[#6B7280] block">Score: {f.anomalyScore}/100</span>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-[#301B05] text-[#C08A00] border border-[#C08A00]">
                  {f.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
