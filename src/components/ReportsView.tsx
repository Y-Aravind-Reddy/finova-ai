import React, { useState } from 'react';
import { FinovaLogo } from './FinovaLogo';
import {
  ADMIN_DATASET,
  CUSTOMER_DATASET,
  FINANCE_ANALYST_DATASET,
  SUPPORT_DATASET,
} from '../data/finovaDatasets';
import { ThreeDColumnChart } from './charts3d/ThreeDColumnChart';
import { ThreeDDonutChart } from './charts3d/ThreeDDonutChart';
import { ThreeDPieChart } from './charts3d/ThreeDPieChart';
import { ThreeDRevenueViz } from './charts3d/ThreeDRevenueViz';
import { Download, Printer, CheckCircle, ShieldCheck, Share2 } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [reportType, setReportType] = useState<'EXECUTIVE' | 'AML_RISK' | 'CUSTOMER_WEALTH'>(
    'EXECUTIVE'
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#D4A017]/25 gap-3">
        <div>
          <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
            Institutional Intelligence Reports
          </h2>
          <p className="font-mono text-xs text-[#D4A017]/70">
            Exportable regulatory audits mapped to 4 official pandas data stores
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[#111111] p-1 rounded-xl border border-[#D4A017]/30">
            <button
              onClick={() => setReportType('EXECUTIVE')}
              className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors ${
                reportType === 'EXECUTIVE'
                  ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold'
                  : 'text-[#D4A017] hover:text-[#FAF7F0]'
              }`}
            >
              Executive YTD
            </button>
            <button
              onClick={() => setReportType('AML_RISK')}
              className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors ${
                reportType === 'AML_RISK'
                  ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold'
                  : 'text-[#D4A017] hover:text-[#FAF7F0]'
              }`}
            >
              AML Forensic Audit
            </button>
            <button
              onClick={() => setReportType('CUSTOMER_WEALTH')}
              className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors ${
                reportType === 'CUSTOMER_WEALTH'
                  ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold'
                  : 'text-[#D4A017] hover:text-[#FAF7F0]'
              }`}
            >
              Private Wealth Dossier
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#111111] border border-[#D4A017]/40 text-[#F5C542] hover:bg-[#6B3E00]/40 text-xs font-mono transition-colors"
          >
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>

      {/* Printable Institutional Report Document */}
      <div className="rounded-2xl bg-[#1E1E1E] border border-[#F5C542]/40 p-6 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] space-y-8">
        {/* Official Header with Golden Logo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#D4A017]/30 gap-4">
          <FinovaLogo variant="full" size="lg" />

          <div className="text-right font-mono text-xs">
            <p className="font-bold text-[#F5C542]">DOC REF: FNV-REP-2026-Q4-AUDIT</p>
            <p className="text-[#6B7280]">Date: October 08, 2026 • 08:00 UTC</p>
            <p className="text-[#C08A00] flex items-center justify-end gap-1 font-semibold mt-1">
              <ShieldCheck size={14} /> Cryptographically Signed & Verified
            </p>
          </div>
        </div>

        {/* Executive YTD Report */}
        {reportType === 'EXECUTIVE' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-cinzel text-xl font-bold text-[#FFF8E7]">
                Executive Annual Performance & Resilience Summary
              </h3>
              <p className="font-mono text-xs text-[#D4A017]/80 mt-1">
                Data synthesized from cleaned_admin_data_pandas.xls
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">GROSS REVENUE</span>
                <p className="font-cinzel text-lg font-bold text-[#F5C542] mt-1">$84.62M USD</p>
                <span className="text-[#C08A00] text-[10px]">+34.8% YoY</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">SETTLED TXNS</span>
                <p className="font-cinzel text-lg font-bold text-[#FFF8E7] mt-1">2,841,920</p>
                <span className="text-[#C08A00] text-[10px]">Zero Defaults</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">SYSTEM HEALTH</span>
                <p className="font-cinzel text-lg font-bold text-[#F5C542] mt-1">99.992%</p>
                <span className="text-[#C08A00] text-[10px]">22ms Latency</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">CLIENT NETWORK</span>
                <p className="font-cinzel text-lg font-bold text-[#FFF8E7] mt-1">148,920</p>
                <span className="text-[#C08A00] text-[10px]">Accredited</span>
              </div>
            </div>

            <ThreeDRevenueViz
              title="3D Executive Revenue Trajectory"
              subtitle="Monthly Gross Inflow vs Net Retained Capital"
            />
          </div>
        )}

        {/* AML Forensic Report */}
        {reportType === 'AML_RISK' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-cinzel text-xl font-bold text-[#FFF8E7]">
                Forensic Anti-Money Laundering & Fraud Report
              </h3>
              <p className="font-mono text-xs text-[#D4A017]/80 mt-1">
                Data synthesized from cleaned_finance_analyst&fraud_pandas.xls
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">MONITORED ASSETS</span>
                <p className="font-cinzel text-lg font-bold text-[#F5C542] mt-1">$248.91M</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">PREVENTED LOSS</span>
                <p className="font-cinzel text-lg font-bold text-[#FFF8E7] mt-1">$4,821,500</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">FALSE POSITIVE RATE</span>
                <p className="font-cinzel text-lg font-bold text-[#C08A00] mt-1">0.12%</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">AML BREACHES</span>
                <p className="font-cinzel text-lg font-bold text-[#D97706] mt-1">18 Flagged</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ThreeDDonutChart
                title="3D Risk Tier Breakdown"
                subtitle="Distribution from Fraud Dataset"
                segments={FINANCE_ANALYST_DATASET.riskTiers.map((r) => ({
                  label: r.tier.split(' ')[0] + ' Risk',
                  value: r.count,
                }))}
                centerLabel="Total Cases"
                centerValue="842.1k"
              />
              <ThreeDColumnChart
                title="3D High-Risk Interceptions"
                subtitle="Quarterly Threat Prevention ($k USD)"
                data={[
                  { label: 'Q1', value: 920 },
                  { label: 'Q2', value: 1150 },
                  { label: 'Q3', value: 1380 },
                  { label: 'Q4', value: 1480, highlight: true },
                ]}
                valuePrefix="$"
                valueSuffix="k"
              />
            </div>
          </div>
        )}

        {/* Customer Wealth Dossier */}
        {reportType === 'CUSTOMER_WEALTH' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-cinzel text-xl font-bold text-[#FFF8E7]">
                Private Wealth Client Portfolio Dossier
              </h3>
              <p className="font-mono text-xs text-[#D4A017]/80 mt-1">
                Data synthesized from cleaned_customer_data_pandas.xls
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">CLIENT</span>
                <p className="font-cinzel text-base font-bold text-[#FFF8E7] mt-1">Harrison Croft</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">PORTFOLIO NAV</span>
                <p className="font-cinzel text-lg font-bold text-[#F5C542] mt-1">$4,892,300</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">CREDIT UTILIZATION</span>
                <p className="font-cinzel text-lg font-bold text-[#C08A00] mt-1">18.4%</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#D4A017]/30">
                <span className="text-[#6B7280]">KYC ATTESTATION</span>
                <p className="font-cinzel text-base font-bold text-[#C08A00] mt-1">Tier 3 Verified</p>
              </div>
            </div>

            <ThreeDPieChart
              title="3D Capital Allocation"
              subtitle="Breakdown across Asset Classes"
              segments={CUSTOMER_DATASET.spendingCategories.map((s) => ({
                label: s.category,
                value: s.amount,
              }))}
              valuePrefix="$"
              valueSuffix=""
            />
          </div>
        )}

        {/* Audit Signoff Footer */}
        <div className="pt-6 border-t border-[#D4A017]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs text-[#6B7280]">
          <div>
            <p>Finova AI Cryptographic Verification Signature: 0x8F9A2B44C1D9E8</p>
            <p className="text-[#D4A017]/80">Basel III Capital Adequacy Level: Compliant</p>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 rounded bg-[#C08A00]/20 text-[#F5C542] border border-[#C08A00] font-bold">
              Institutional Certified
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
