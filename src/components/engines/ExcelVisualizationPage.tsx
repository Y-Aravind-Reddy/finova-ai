import React, { useState } from 'react';
import {
  Table2,
  BarChart3,
  Download,
  Filter,
  Search,
  Sparkles,
  PieChart,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import {
  ADMIN_DATASET,
  CUSTOMER_DATASET,
  FINANCE_ANALYST_DATASET,
  SUPPORT_DATASET,
} from '../../data/finovaDatasets';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDPieChart } from '../charts3d/ThreeDPieChart';

export const ExcelVisualizationPage: React.FC = () => {
  const [selectedSheet, setSelectedSheet] = useState<'finance' | 'customer' | 'admin' | 'support'>('finance');
  const [chartType, setChartType] = useState<'column' | 'pie'>('column');
  const [filterTerm, setFilterTerm] = useState('');

  // Datasets
  const financeRows = FINANCE_ANALYST_DATASET.transactions;
  const customerRows = CUSTOMER_DATASET.transactions;
  const adminRows = ADMIN_DATASET.systemAuditLogs;
  const supportRows = SUPPORT_DATASET.tickets;

  // Chart preparation
  const columnData =
    selectedSheet === 'finance'
      ? [
          { label: 'Multi-Hop', value: 1240, secondaryValue: 1100 },
          { label: 'Sanction IP', value: 890, secondaryValue: 820 },
          { label: 'Rapid Layer', value: 420, secondaryValue: 390 },
          { label: 'High-Value', value: 650, secondaryValue: 600, highlight: true },
        ]
      : selectedSheet === 'customer'
      ? [
          { label: 'Zurich Vault', value: 450, secondaryValue: 400 },
          { label: 'Treasury Coup', value: 82, secondaryValue: 80 },
          { label: 'Harrods Lux', value: 23, secondaryValue: 20 },
          { label: 'ESG Bonds', value: 131, secondaryValue: 120, highlight: true },
        ]
      : selectedSheet === 'admin'
      ? [
          { label: 'Role Kernel', value: 942, secondaryValue: 880 },
          { label: 'Wire Clear', value: 384, secondaryValue: 360 },
          { label: 'Auth Check', value: 121, secondaryValue: 110 },
          { label: 'DB Vacuum', value: 32, secondaryValue: 30, highlight: true },
        ]
      : [
          { label: 'Wire Auth', value: 420, secondaryValue: 400 },
          { label: 'Disputes', value: 180, secondaryValue: 160 },
          { label: 'KYC Resub', value: 240, secondaryValue: 220 },
          { label: 'Card Issue', value: 310, secondaryValue: 290, highlight: true },
        ];

  const pieData = [
    { label: 'Tier 3 Sovereign', value: 54, subtext: '54% allocation' },
    { label: 'Institutional Escrow', value: 26, subtext: '26% allocation' },
    { label: 'Treasury Repos', value: 14, subtext: '14% allocation' },
    { label: 'Forex Buffer', value: 6, subtext: '6% allocation' },
  ];

  const handleExportCsv = () => {
    let rows: Record<string, any>[] = [];
    if (selectedSheet === 'finance') rows = financeRows;
    else if (selectedSheet === 'customer') rows = customerRows;
    else if (selectedSheet === 'support') rows = supportRows;
    else rows = adminRows;

    const headers = Object.keys(rows[0] || {}).join(',');
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows.map((r) => Object.values(r).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Finova_${selectedSheet}_dataset.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
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
              <FileSpreadsheet size={12} className="text-[#F5C542]" /> Pandas & Excel Multi-Grid Engine
            </span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Excel Data Visualization
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Direct real-time rendering, pivot summaries, and 3D geometric chart compilation from Finova institutional Excel datasets.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all flex items-center gap-2"
        >
          <Download size={14} /> Export CSV / Excel
        </button>
      </div>

      {/* Dataset Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { key: 'finance', label: 'cleaned_finance_analyst&fraud_pandas.xls' },
          { key: 'customer', label: 'cleaned_customer_data_pandas.xls' },
          { key: 'admin', label: 'cleaned_admin_data_pandas.xls' },
          { key: 'support', label: 'cleaned_support_executive_pandas.xls' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setSelectedSheet(s.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedSheet === s.key
                ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] shadow-[0_0_15px_rgba(212,160,23,0.3)]'
                : 'bg-[#1E1E1E] text-[#D4A017] border border-[#D4A017]/30 hover:bg-[#301B05]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 3D Visualization Canvas */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between pb-4 border-b border-[#D4A017]/20">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-[#F5C542]" />
            <h3 className="text-sm font-bold text-[#FFF8E7]">3D Data Visualization Matrix</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setChartType('column')}
              className={`p-1.5 rounded-lg border transition-all ${
                chartType === 'column'
                  ? 'bg-[#F5C542] text-[#111111] border-[#F5C542]'
                  : 'bg-[#141414] text-[#D4A017] border-[#D4A017]/30'
              }`}
            >
              <BarChart3 size={15} />
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`p-1.5 rounded-lg border transition-all ${
                chartType === 'pie'
                  ? 'bg-[#F5C542] text-[#111111] border-[#F5C542]'
                  : 'bg-[#141414] text-[#D4A017] border-[#D4A017]/30'
              }`}
            >
              <PieChart size={15} />
            </button>
          </div>
        </div>

        <div className="mt-4">
          {chartType === 'column' ? (
            <ThreeDColumnChart
              title={`3D Aggregated Metrics (${selectedSheet.toUpperCase()} Dataset)`}
              subtitle="Comparison of Primary Volume against Historical Baseline"
              data={columnData}
              height={300}
              valuePrefix="$"
              valueSuffix="k"
              dualSeries={true}
              primaryLabel="Current Volume ($k)"
              secondaryLabel="Baseline Target"
            />
          ) : (
            <ThreeDPieChart
              title="3D Portfolio & Sovereign Allocation Partition"
              subtitle="Proportional weight from active spreadsheet slice"
              segments={pieData}
              height={300}
            />
          )}
        </div>
      </div>

      {/* Live Spreadsheet Table */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#D4A017]/20">
          <div className="flex items-center gap-2">
            <Table2 size={16} className="text-[#F5C542]" />
            <h3 className="text-sm font-bold text-[#FFF8E7]">Sheet View: {selectedSheet.toUpperCase()}</h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-3 text-[#D4A017]" />
            <input
              type="text"
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              placeholder="Search table rows..."
              className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          {selectedSheet === 'finance' && (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017]">
                  <th className="pb-3">ID</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Channel</th>
                  <th className="pb-3">Risk Score</th>
                  <th className="pb-3">AML Flag</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4A017]/10">
                {financeRows.map((r, idx: number) => (
                  <tr key={idx} className="hover:bg-[#141414]">
                    <td className="py-2.5 font-bold text-[#F5C542]">{r.id}</td>
                    <td className="py-2.5 text-[#FFF8E7]">{r.customerName}</td>
                    <td className="py-2.5 font-bold text-[#F5C542]">${r.amount.toLocaleString()} {r.currency}</td>
                    <td className="py-2.5 text-[#D4A017]">{r.paymentChannel}</td>
                    <td className="py-2.5">{r.riskScore} / 100</td>
                    <td className="py-2.5 text-[#C08A00]">{r.amlFlag}</td>
                    <td className="py-2.5 text-[#FAF7F0]">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedSheet === 'customer' && (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017]">
                  <th className="pb-3">Reference</th>
                  <th className="pb-3">Merchant</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4A017]/10">
                {customerRows.map((r, idx: number) => (
                  <tr key={idx} className="hover:bg-[#141414]">
                    <td className="py-2.5 font-bold text-[#F5C542]">{r.referenceNo}</td>
                    <td className="py-2.5 text-[#FFF8E7]">{r.merchant}</td>
                    <td className="py-2.5 text-[#D4A017]">{r.category}</td>
                    <td className="py-2.5 font-bold text-[#F5C542]">${r.amount.toLocaleString()}</td>
                    <td className="py-2.5 text-[#6B7280]">{r.date}</td>
                    <td className="py-2.5 text-[#C08A00]">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedSheet === 'admin' && (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017]">
                  <th className="pb-3">Log ID</th>
                  <th className="pb-3">Actor</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Target</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4A017]/10">
                {adminRows.map((r, idx: number) => (
                  <tr key={idx} className="hover:bg-[#141414]">
                    <td className="py-2.5 font-bold text-[#F5C542]">{r.id}</td>
                    <td className="py-2.5 text-[#FFF8E7]">{r.actor}</td>
                    <td className="py-2.5 text-[#D4A017]">{r.role}</td>
                    <td className="py-2.5 text-[#FAF7F0]">{r.action}</td>
                    <td className="py-2.5 text-[#6B7280]">{r.target}</td>
                    <td className="py-2.5 text-[#C08A00]">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedSheet === 'support' && (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017]">
                  <th className="pb-3">Ticket ID</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Priority</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Assigned RM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4A017]/10">
                {supportRows.map((r, idx: number) => (
                  <tr key={idx} className="hover:bg-[#141414]">
                    <td className="py-2.5 font-bold text-[#F5C542]">{r.ticketId}</td>
                    <td className="py-2.5 text-[#FFF8E7]">{r.customerName}</td>
                    <td className="py-2.5 text-[#D4A017]">{r.category}</td>
                    <td className="py-2.5 text-[#C08A00]">{r.priority}</td>
                    <td className="py-2.5 text-[#FAF7F0]">{r.status}</td>
                    <td className="py-2.5 text-[#F5C542]">{r.assignedExecutive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
