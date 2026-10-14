import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Lock,
  Unlock,
  FileCheck2,
  Download,
  Search,
  Filter,
  CheckCircle2,
  DollarSign,
  Activity,
  Flame,
} from 'lucide-react';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDTransactionHeatmap } from '../charts3d/ThreeDTransactionHeatmap';

interface SuspiciousAlert {
  id: string;
  txHash: string;
  sender: string;
  receiver: string;
  amount: string;
  ruleViolated: string;
  anomalyScore: number;
  status: 'Investigating' | 'SAR Filed' | 'Frozen' | 'Cleared';
  timestamp: string;
}

export const FraudAmlPage: React.FC = () => {
  const [sarModalAlert, setSarModalAlert] = useState<SuspiciousAlert | null>(null);

  const [alerts, setAlerts] = useState<SuspiciousAlert[]>([
    {
      id: 'AML-ALT-8801',
      txHash: '0x9fa8...3b21 (SWIFT pacs.008)',
      sender: 'Aegis Offshore Holdings (Limassol)',
      receiver: 'Alpha Orion Capital (Panama)',
      amount: '$1,240,000 USD',
      ruleViolated: 'Rule 402: Layering via Non-Cooperative Jurisdiction',
      anomalyScore: 94,
      status: 'Frozen',
      timestamp: 'Today, 09:12 UTC',
    },
    {
      id: 'AML-ALT-8802',
      txHash: '0x3c11...7a90 (FedNow Real-Time)',
      sender: 'Veloce Global Syndicate (Seychelles)',
      receiver: 'Zurich Vault Escrow Account #09',
      amount: '€890,000 EUR',
      ruleViolated: 'Rule 103: Micro-Structuring Below $10k Aggregate Velocity',
      anomalyScore: 88,
      status: 'Investigating',
      timestamp: 'Today, 07:44 UTC',
    },
    {
      id: 'AML-ALT-8803',
      txHash: '0xaa42...108b (CHAPS High Value)',
      sender: 'Vanguard Sterling Trust (London)',
      receiver: 'Geneva Sovereign Relays',
      amount: '£420,000 GBP',
      ruleViolated: 'Rule 205: Geolocation IP Mismatch during 2FA Confirmation',
      anomalyScore: 72,
      status: 'Investigating',
      timestamp: 'Yesterday, 18:22 UTC',
    },
    {
      id: 'AML-ALT-8804',
      txHash: '0x551a...99cf (SEPA Instant)',
      sender: 'Helios Commodity Trading AG',
      receiver: 'Rotterdam Terminal Port Logistics',
      amount: '$650,000 USD',
      ruleViolated: 'Rule 301: Sanction Dual-Use Cargo Keyword Detection',
      anomalyScore: 65,
      status: 'SAR Filed',
      timestamp: 'Yesterday, 11:05 UTC',
    },
  ]);

  const handleAction = (id: string, action: SuspiciousAlert['status']) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: action } : a))
    );
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Dedicated Platform Engine
            </span>
            <span className="text-xs text-[#D4A017] flex items-center gap-1">
              <ShieldAlert size={12} className="text-[#F5C542]" /> Sentinel Forensic AML Engine v5.0
            </span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Fraud Detection & AML Surveillance
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Autonomous fraud pattern recognition, high-velocity wire anomaly detection, FINMA/FinCEN SAR filing workflows, and escrow freezing protocols.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#141414] border border-[#D4A017]/30 text-right">
            <span className="text-[10px] text-[#6B7280] block">SAR Filing Pipeline</span>
            <span className="text-sm font-bold text-[#F5C542]">FinCEN / FINMA Direct</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Active AML Alerts"
          value="18 Alerts"
          subValue="4 High Threat"
          change="+2 today"
          trend="down"
          tag="Surveillance"
          icon={<ShieldAlert size={20} />}
          sparkline={[12, 14, 15, 16, 17, 18, 18]}
        />
        <ThreeDKpiCard
          title="Intercepted Volume"
          value="$4,821,500"
          subValue="142 Fraud Txns Blocked"
          change="0.12% FP Rate"
          trend="up"
          tag="Protected"
          variant="gold-accent"
          icon={<DollarSign size={20} />}
          sparkline={[120, 160, 200, 250, 310, 380, 482]}
        />
        <ThreeDKpiCard
          title="Frozen Escrow"
          value="$1,240,000"
          subValue="Aegis Offshore"
          change="Court Hold"
          trend="up"
          tag="Custody"
          icon={<Lock size={20} />}
          sparkline={[10, 10, 10, 12, 12, 12, 12]}
        />
        <ThreeDKpiCard
          title="SAR Filings (YTD)"
          value="42 Reports"
          subValue="100% Regulatory Cleared"
          change="Zero Fines"
          trend="up"
          tag="Compliant"
          icon={<FileCheck2 size={20} />}
          sparkline={[20, 25, 29, 34, 38, 40, 42]}
        />
      </div>

      {/* 3D Anomaly Heatmap */}
      <ThreeDTransactionHeatmap
        title="3D Global Settlement Anomaly & Threat Radar"
        subtitle="Intraday Correlation of Rapid Funds Movement vs Geographical Relays"
      />

      {/* Alerts Investigation Queue */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#D4A017]/20 gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2">
              <Flame size={16} className="text-[#F5C542]" /> High-Priority AML Anomaly Incidents
            </h3>
            <p className="text-[11px] text-[#6B7280]">
              Real-time forensic triage requiring analyst clearance or SAR filing
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {alerts.map((alt) => (
            <div
              key={alt.id}
              className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 hover:border-[#F5C542]/50 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#301B05] text-[#F5C542] font-bold text-[10px] border border-[#D4A017]/30">
                    {alt.id}
                  </span>
                  <span className="font-bold text-[#FFF8E7] text-[12px]">{alt.ruleViolated}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#F5C542]">{alt.amount}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      alt.status === 'Frozen'
                        ? 'bg-[#301B05] text-[#C08A00] border border-[#C08A00]'
                        : alt.status === 'SAR Filed'
                        ? 'bg-[#141414] text-[#F5C542] border border-[#D4A017]'
                        : 'bg-[#111111] text-[#FAF7F0] border border-[#D4A017]/30'
                    }`}
                  >
                    {alt.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-[#111111] p-2.5 rounded-lg border border-[#301B05]">
                <div>
                  <span className="text-[#6B7280]">Sender Entity:</span>{' '}
                  <span className="text-[#FAF7F0] font-semibold">{alt.sender}</span>
                </div>
                <div>
                  <span className="text-[#6B7280]">Beneficiary:</span>{' '}
                  <span className="text-[#FAF7F0] font-semibold">{alt.receiver}</span>
                </div>
                <div>
                  <span className="text-[#6B7280]">Payload Hash:</span>{' '}
                  <span className="text-[#D4A017]">{alt.txHash}</span>
                </div>
                <div>
                  <span className="text-[#6B7280]">Anomaly Threat Score:</span>{' '}
                  <span className="text-[#F5C542] font-bold">{alt.anomalyScore} / 100</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[10px] text-[#6B7280]">Logged: {alt.timestamp}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSarModalAlert(alt)}
                    className="px-3 py-1 rounded-lg bg-[#301B05] text-[#F5C542] hover:bg-[#4A2C0A] border border-[#D4A017]/40 text-[10px] font-bold transition-all flex items-center gap-1"
                  >
                    <FileCheck2 size={12} /> File SAR Report
                  </button>
                  <button
                    onClick={() => handleAction(alt.id, 'Frozen')}
                    className="px-3 py-1 rounded-lg bg-[#111111] text-[#C08A00] hover:bg-[#301B05] border border-[#C08A00]/40 text-[10px] font-bold transition-all flex items-center gap-1"
                  >
                    <Lock size={12} /> Freeze Escrow
                  </button>
                  <button
                    onClick={() => handleAction(alt.id, 'Cleared')}
                    className="px-3 py-1 rounded-lg bg-[#141414] text-[#FAF7F0] hover:text-[#F5C542] border border-[#D4A017]/20 text-[10px] transition-all flex items-center gap-1"
                  >
                    <Unlock size={12} /> Clear Anomaly
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SAR Report Modal */}
      {sarModalAlert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-[#1E1E1E] border border-[#D4A017] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D4A017]/30">
              <h3 className="font-cinzel text-lg font-bold text-[#F5C542] flex items-center gap-2">
                <FileCheck2 size={18} /> Official Suspicious Activity Report (SAR)
              </h3>
              <button
                onClick={() => setSarModalAlert(null)}
                className="text-[#6B7280] hover:text-[#FFF8E7]"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-[#FFF8E7]/80">
              Preparing FinCEN Form 111 / FINMA Electronic Filing Dossier for incident{' '}
              <strong className="text-[#F5C542]">{sarModalAlert.id}</strong>.
            </p>

            <div className="p-3 bg-[#111111] rounded-xl border border-[#301B05] space-y-1 text-[11px]">
              <p>• <strong>Subject:</strong> {sarModalAlert.sender}</p>
              <p>• <strong>Transaction Volume:</strong> {sarModalAlert.amount}</p>
              <p>• <strong>Violation Code:</strong> {sarModalAlert.ruleViolated}</p>
              <p>• <strong>Cryptographic Proof:</strong> {sarModalAlert.txHash}</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#D4A017]/20">
              <button
                onClick={() => setSarModalAlert(null)}
                className="px-4 py-2 rounded-xl bg-[#141414] text-[#D4A017] border border-[#D4A017]/30 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleAction(sarModalAlert.id, 'SAR Filed');
                  setSarModalAlert(null);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg"
              >
                Transmit SAR to Regulator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
