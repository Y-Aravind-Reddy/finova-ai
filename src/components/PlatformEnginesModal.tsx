import React, { useState } from 'react';
import { FinovaLogo } from './FinovaLogo';
import {
  Cpu,
  FileSearch,
  Tag,
  ShieldCheck,
  AlertTriangle,
  FolderGit2,
  Table2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Database,
  Search,
  Download,
  Terminal,
} from 'lucide-react';

export type PlatformEngineType =
  | 'ai_assistant'
  | 'ocr_intelligence'
  | 'txn_classification'
  | 'kyc_verification'
  | 'fraud_aml'
  | 'case_management'
  | 'excel_visualization';

interface PlatformEnginesModalProps {
  engineType: PlatformEngineType;
  isOpen: boolean;
  onClose: () => void;
  onOpenCopilot?: () => void;
}

export const PlatformEnginesModal: React.FC<PlatformEnginesModalProps> = ({
  engineType,
  isOpen,
  onClose,
  onOpenCopilot,
}) => {
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);

  const [classifyText, setClassifyText] = useState('SWIFT GPI Outgoing Wire to Geneva Private Bank for $450,000 USD');
  const [classifiedResult, setClassifiedResult] = useState<string | null>(null);

  const [kycSearch, setKycSearch] = useState('Harrison Croft');
  const [kycScore, setKycScore] = useState<number | null>(98);

  const [datasetView, setDatasetView] = useState<'admin' | 'customer' | 'finance' | 'support'>('admin');

  if (!isOpen) return null;

  const handleRunOcr = () => {
    setOcrScanning(true);
    setOcrSuccess(false);
    setTimeout(() => {
      setOcrScanning(false);
      setOcrSuccess(true);
    }, 1200);
  };

  const handleClassify = (e: React.FormEvent) => {
    e.preventDefault();
    setClassifiedResult(
      'ISO 20022 Code: pacs.008.001.09 (Customer Credit Transfer) • Category: Tier 3 Private Wealth Escrow • Confidence: 99.4%'
    );
  };

  const renderEngineContent = () => {
    switch (engineType) {
      case 'ocr_intelligence':
        return (
          <div className="space-y-5 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-[#FFF8E7] text-sm">
                  Neural Document OCR & Biometric Extraction Engine
                </p>
                <p className="text-[11px] text-[#D4A017]/80 mt-1">
                  Extracts passports, corporate charters, IRS W-8BEN forms, and notary seals at 99.8% optical precision.
                </p>
              </div>
              <button
                onClick={handleRunOcr}
                disabled={ocrScanning}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-xs hover:brightness-110 shadow-[0_0_15px_rgba(212,160,23,0.3)] transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <FileSearch size={14} />
                {ocrScanning ? 'Scanning Layers...' : 'Run OCR Simulation'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 space-y-2">
                <span className="text-[10px] uppercase text-[#D4A017] font-bold block">
                  Document Under Inspection
                </span>
                <div className="p-3 rounded-lg bg-[#111111] border border-[#301B05] text-[11px] text-[#FAF7F0] space-y-1">
                  <p><strong>File:</strong> swiss_canton_trust_declaration_2026.pdf</p>
                  <p><strong>Type:</strong> Certified Trust Indenture</p>
                  <p><strong>File Size:</strong> 4.82 MB (Encrypted 4096-bit SHA-256)</p>
                  <p><strong>Optical DPI:</strong> 600 DPI Native</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 space-y-2">
                <span className="text-[10px] uppercase text-[#D4A017] font-bold block">
                  OCR Extracted Telemetry
                </span>
                {ocrSuccess ? (
                  <div className="p-3 rounded-lg bg-[#111111] border border-[#C08A00] text-[11px] text-[#F5C542] space-y-1">
                    <p className="text-[#FFF8E7] font-bold">✓ Optical Confidence: 99.84%</p>
                    <p>• Principal Beneficiary: Harrison Croft</p>
                    <p>• Settlor Jurisdiction: Zurich, Switzerland</p>
                    <p>• Apostille Notary Verified: Dr. Hansel V. Meyer (Oct 2026)</p>
                    <p>• Anti-Tampering Check: Valid Watermark Signature</p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#111111] border border-[#301B05] text-[11px] text-[#6B7280] italic">
                    {ocrScanning ? 'Analyzing neural token grid...' : 'Click "Run OCR Simulation" to inspect optical output.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'txn_classification':
        return (
          <div className="space-y-5 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/30">
              <p className="font-semibold text-[#FFF8E7] text-sm">
                ISO 20022 Neural Transaction Classifier
              </p>
              <p className="text-[11px] text-[#D4A017]/80 mt-1">
                Deep learning model categorizing financial telemetry across FedNow, CHIPS, and SWIFT GPI message blocks.
              </p>
            </div>

            <form onSubmit={handleClassify} className="space-y-3">
              <div>
                <label className="block text-[#D4A017] mb-1 font-semibold">
                  Raw Transaction Memo / SWIFT String
                </label>
                <input
                  type="text"
                  value={classifyText}
                  onChange={(e) => setClassifyText(e.target.value)}
                  className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-3.5 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold text-xs"
              >
                Classify Message Syntax
              </button>
            </form>

            {classifiedResult && (
              <div className="p-4 rounded-xl bg-[#141414] border border-[#C08A00] text-[#F5C542] space-y-1">
                <span className="font-bold text-[#FFF8E7] block">✓ Classification Result:</span>
                <p>{classifiedResult}</p>
              </div>
            )}
          </div>
        );

      case 'kyc_verification':
        return (
          <div className="space-y-5 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/30">
              <p className="font-semibold text-[#FFF8E7] text-sm">
                Autonomous KYC & Sanctions Scanning Engine
              </p>
              <p className="text-[11px] text-[#D4A017]/80 mt-1">
                Real-time cross-referencing with OFAC, EU Consolidated Sanctions, INTERPOL Red Notices, and PEP lists.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280] block text-[10px]">SANCTIONS WATCHLISTS</span>
                <span className="font-bold text-[#F5C542] text-sm mt-1 block">184 Sources Synchronized</span>
                <span className="text-[#C08A00] text-[10px]">Updated 3 mins ago</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280] block text-[10px]">PEP SENSITIVITY</span>
                <span className="font-bold text-[#FFF8E7] text-sm mt-1 block">Zero Tolerance Threshold</span>
                <span className="text-[#C08A00] text-[10px]">Tier 3 Basel Compliant</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280] block text-[10px]">BIOMETRIC MATCH</span>
                <span className="font-bold text-[#F5C542] text-sm mt-1 block">99.98% Facial Liveness</span>
                <span className="text-[#C08A00] text-[10px]">Anti-Spoofing Level 2</span>
              </div>
            </div>
          </div>
        );

      case 'fraud_aml':
        return (
          <div className="space-y-5 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/30">
              <p className="font-semibold text-[#FFF8E7] text-sm">
                Finova Sentinel v4.2 Fraud & AML Surveillance Core
              </p>
              <p className="text-[11px] text-[#D4A017]/80 mt-1">
                Direct heuristic engine preventing multi-hop layering, smurfing, and unauthorized velocity bursts.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D4A017]/15">
                <span className="text-[#F5C542] font-bold">Active Surveillance Rules:</span>
                <span className="text-[10px] text-[#C08A00]">All 14 Neural Weights Active</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-[#FAF7F0]">
                <li>• Multi-Jurisdiction Velocity &gt; $2,000,000 in 60 minutes → Instant Escrow Freeze</li>
                <li>• Geolocation IP Mismatch vs Device Enclave → Biometric Challenge Trigger</li>
                <li>• Structuring detection (Multiple transfers under $10,000 threshold) → Automated SAR draft</li>
              </ul>
            </div>
          </div>
        );

      case 'case_management':
        return (
          <div className="space-y-5 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/30">
              <p className="font-semibold text-[#FFF8E7] text-sm">
                Enterprise Case & Dispute Resolution Engine
              </p>
              <p className="text-[11px] text-[#D4A017]/80 mt-1">
                End-to-end incident orchestration, evidentiary logs, and automated regulatory reporting dispatch.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#D4A017]/20 text-[#D4A017]/80 text-[11px]">
                    <th className="pb-2">Case ID</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Principal Entity</th>
                    <th className="pb-2">SLA Clock</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4A017]/10 text-[#FAF7F0]">
                  <tr>
                    <td className="py-2.5 font-bold text-[#F5C542]">CASE-AML-902</td>
                    <td className="py-2.5 text-[11px]">Velocity Anomaly</td>
                    <td className="py-2.5">Aegis Offshore Holdings</td>
                    <td className="py-2.5 text-[#C08A00]">12m remaining</td>
                    <td className="py-2.5 text-right"><span className="px-2 py-0.5 rounded bg-[#C08A00]/20 text-[#F5C542]">Escrow Locked</span></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-[#F5C542]">CASE-OPS-418</td>
                    <td className="py-2.5 text-[11px]">High-Value Wire Release</td>
                    <td className="py-2.5">Croft Capital Management</td>
                    <td className="py-2.5 text-[#C08A00]">Under SLA</td>
                    <td className="py-2.5 text-right"><span className="px-2 py-0.5 rounded bg-[#C08A00]/20 text-[#F5C542]">Dual-Key Approved</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'excel_visualization':
        return (
          <div className="space-y-5 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-[#FFF8E7] text-sm">
                  PostgreSQL Data Engine & Telemetry Inspector
                </p>
                <p className="text-[11px] text-[#D4A017]/80 mt-1">
                  Active connection to verified database tables: profiles, transactions, fraud_cases, audit_logs, support_tickets.
                </p>
              </div>

              {/* Data source switch */}
              <div className="flex bg-[#111111] p-1 rounded-xl border border-[#D4A017]/30">
                <button
                  onClick={() => setDatasetView('admin')}
                  className={`px-2.5 py-1 text-[11px] rounded-lg ${
                    datasetView === 'admin' ? 'bg-[#D4A017] text-[#111111] font-bold' : 'text-[#D4A017]'
                  }`}
                >
                  Admin Logs
                </button>
                <button
                  onClick={() => setDatasetView('customer')}
                  className={`px-2.5 py-1 text-[11px] rounded-lg ${
                    datasetView === 'customer' ? 'bg-[#D4A017] text-[#111111] font-bold' : 'text-[#D4A017]'
                  }`}
                >
                  Transactions
                </button>
                <button
                  onClick={() => setDatasetView('finance')}
                  className={`px-2.5 py-1 text-[11px] rounded-lg ${
                    datasetView === 'finance' ? 'bg-[#D4A017] text-[#111111] font-bold' : 'text-[#D4A017]'
                  }`}
                >
                  Fraud / AML
                </button>
                <button
                  onClick={() => setDatasetView('support')}
                  className={`px-2.5 py-1 text-[11px] rounded-lg ${
                    datasetView === 'support' ? 'bg-[#D4A017] text-[#111111] font-bold' : 'text-[#D4A017]'
                  }`}
                >
                  Support Desk
                </button>
              </div>
            </div>

            {/* Quick telemetry preview */}
            <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 max-h-60 overflow-y-auto">
              {datasetView === 'admin' && (
                <div className="space-y-2">
                  <p className="text-[#F5C542] font-bold">public.audit_logs & public.profiles:</p>
                  <p>• Multi-Tenant Isolation: Active</p>
                  <p>• Cryptographic Hashing: SHA-256 Verified</p>
                  <p>• RLS Enforcement: Enabled for all tenant scopes</p>
                </div>
              )}
              {datasetView === 'customer' && (
                <div className="space-y-2">
                  <p className="text-[#F5C542] font-bold">public.transactions (Customer Vault):</p>
                  <p>• Multi-Currency Base: Converted to USD Base</p>
                  <p>• Aggregation Mode: Server-side unpaginated aggregation</p>
                  <p>• Real-time Settlement: SWIFT GPI & FedNow supported</p>
                </div>
              )}
              {datasetView === 'finance' && (
                <div className="space-y-2">
                  <p className="text-[#F5C542] font-bold">public.fraud_cases (Risk & AML Sentinel):</p>
                  <p>• Real-time Sanctions Screening: Active</p>
                  <p>• Multi-Hop Velocity Analysis: Active</p>
                  <p>• False Positive Governance: Strict threshold verification</p>
                </div>
              )}
              {datasetView === 'support' && (
                <div className="space-y-2">
                  <p className="text-[#F5C542] font-bold">public.support_tickets (Concierge Service):</p>
                  <p>• Institutional SLA Monitoring: Active</p>
                  <p>• Urgent Callback Routing: Enabled</p>
                  <p>• Priority Queues: Private Wealth Escalations</p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (engineType) {
      case 'ocr_intelligence':
        return 'Document OCR Intelligence Engine';
      case 'txn_classification':
        return 'Transaction Classification Engine';
      case 'kyc_verification':
        return 'KYC Verification & Screening Engine';
      case 'fraud_aml':
        return 'Fraud Detection & AML Engine';
      case 'case_management':
        return 'Case Management & Dispute Engine';
      case 'excel_visualization':
        return 'Excel Data Visualization & Analytics Engine';
      default:
        return 'Finova Platform Engine';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#1E1E1E] border border-[#F5C542]/50 rounded-2xl shadow-[0_20px_60px_rgba(212,160,23,0.35)] overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#111111] via-[#1E1E1E] to-[#111111] border-b border-[#D4A017]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5C542] to-[#6B3E00] flex items-center justify-center text-[#111111]">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
                {getTitle()}
              </h3>
              <p className="font-mono text-[11px] text-[#D4A017]/80">
                Finova AI Institutional Core Platform Architecture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#111111] border border-[#D4A017]/30 text-[#D4A017] hover:text-[#FFF8E7] flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {renderEngineContent()}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141414] border-t border-[#D4A017]/20 flex items-center justify-between font-mono text-xs">
          <span className="text-[#6B7280] text-[11px]">
            Engine Execution: Sub-second Latency • Finova Sentinel Verified
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#1E1E1E] border border-[#D4A017]/40 text-[#F5C542] hover:bg-[#6B3E00]/30 font-bold"
          >
            Close Engine Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
