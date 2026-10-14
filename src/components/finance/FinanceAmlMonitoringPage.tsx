import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, FileCheck2, Search, Filter, Lock, Unlock } from 'lucide-react';
import { ThreeDTransactionHeatmap } from '../charts3d/ThreeDTransactionHeatmap';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';

export const FinanceAmlMonitoringPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const amlCases = [
    {
      id: 'AML-CASE-401',
      entity: 'Aegis Offshore Holdings Ltd',
      jurisdiction: 'Limassol / Nassau',
      alertType: 'Structuring & Layering',
      flowAmount: '$1,240,000 USD',
      riskTier: 'Critical Anomaly',
      sarStatus: 'SAR Draft Ready',
    },
    {
      id: 'AML-CASE-402',
      entity: 'Veloce Global Syndicate',
      jurisdiction: 'Seychelles Relay',
      alertType: 'Rapid Funds Movement (Zero Dwell Time)',
      flowAmount: '€890,000 EUR',
      riskTier: 'Elevated Threat',
      sarStatus: 'Under Surveillance',
    },
    {
      id: 'AML-CASE-403',
      entity: 'Alpha Orion Capital LLC',
      jurisdiction: 'Panama / Delaware',
      alertType: 'Ultimate Beneficial Ownership Obfuscation',
      flowAmount: '$675,000 USD',
      riskTier: 'High Suspicion',
      sarStatus: 'Enhanced Due Diligence',
    },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Regulatory Compliance
            </span>
            <span className="text-xs text-[#D4A017]">FinCEN / FINMA AML Protocol</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Anti-Money Laundering (AML) Monitoring
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Surveillance of layering patterns, shell entity clustering, Sanctions watchlists, and automated electronic Suspicious Activity Report (SAR) generation.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">SAR Filing Pipeline</span>
          <span className="text-sm font-bold text-[#F5C542]">42 Filed YTD (100% Cleared)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Active AML Inquiries"
          value="18 Cases"
          subValue="Cross-Border Velocity"
          change="3 Critical"
          trend="down"
          tag="Active"
          icon={<AlertTriangle size={20} />}
          sparkline={[12, 14, 15, 17, 18, 18, 18]}
        />
        <ThreeDKpiCard
          title="SARs Pending Review"
          value="4 Reports"
          subValue="Due in 48 Hours"
          change="SLA Green"
          trend="up"
          tag="Regulatory"
          variant="gold-accent"
          icon={<FileCheck2 size={20} />}
          sparkline={[1, 2, 2, 3, 3, 4, 4]}
        />
        <ThreeDKpiCard
          title="Escrow Freeze Volume"
          value="$2.8M USD"
          subValue="Court Orders Active"
          change="Secured"
          trend="up"
          tag="Custody"
          icon={<Lock size={20} />}
          sparkline={[1.2, 1.8, 2.2, 2.5, 2.8, 2.8, 2.8]}
        />
        <ThreeDKpiCard
          title="Sanction Matching"
          value="0.00% False Pos"
          subValue="OFAC, EU, UN, FINMA"
          change="Zero Drift"
          trend="up"
          tag="Certified"
          icon={<ShieldAlert size={20} />}
          sparkline={[0, 0, 0, 0, 0, 0, 0]}
        />
      </div>

      <ThreeDTransactionHeatmap
        title="3D Global AML Threat & Layering Velocity Heatmap"
        subtitle="Forensic analysis of funds dwell time between offshore transit nodes"
      />

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2 pb-3 border-b border-[#D4A017]/20">
          <ShieldAlert size={16} className="text-[#F5C542]" /> High-Priority AML Investigative Dossiers
        </h3>

        <div className="space-y-3">
          {amlCases.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#301B05] text-[#F5C542] font-bold text-[10px]">
                    {c.id}
                  </span>
                  <span className="font-bold text-[#FFF8E7]">{c.entity}</span>
                </div>
                <p className="text-[11px] text-[#D4A017] mt-1">{c.alertType}</p>
                <p className="text-[10px] text-[#6B7280]">Jurisdiction: {c.jurisdiction}</p>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="font-bold text-sm text-[#F5C542]">{c.flowAmount}</span>
                  <span className="text-[10px] text-[#C08A00] block">{c.riskTier}</span>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-[#301B05] text-[#F5C542] border border-[#D4A017]/40">
                  {c.sarStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
