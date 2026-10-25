import React, { useState, useEffect, useMemo } from 'react';
import {
  Table2,
  BarChart3,
  Download,
  Filter,
  Search,
  PieChart,
  FileSpreadsheet,
  TrendingUp,
  RotateCw,
  AlertCircle,
} from 'lucide-react';
import {
  fetchTransactionsResultFromDb,
  fetchFraudCasesResultFromDb,
  fetchAuditLogsResultFromDb,
  fetchSupportTicketsResultFromDb,
} from '../../services/finovaDatabase';
import { CustomerTransaction, FinanceFraudTransaction, SupportTicket } from '../../data/finovaDatasets';
import { AuditLogEntry } from '../../services/finovaDatabase';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDPieChart } from '../charts3d/ThreeDPieChart';

export const ExcelVisualizationPage: React.FC = () => {
  const [selectedSheet, setSelectedSheet] = useState<'finance' | 'customer' | 'admin' | 'support'>('finance');
  const [chartType, setChartType] = useState<'column' | 'pie'>('column');
  const [filterTerm, setFilterTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Live database records
  const [financeRows, setFinanceRows] = useState<FinanceFraudTransaction[]>([]);
  const [customerRows, setCustomerRows] = useState<CustomerTransaction[]>([]);
  const [adminRows, setAdminRows] = useState<AuditLogEntry[]>([]);
  const [supportRows, setSupportRows] = useState<SupportTicket[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fraudRes, txnRes, auditRes, ticketRes] = await Promise.all([
        fetchFraudCasesResultFromDb('tenant_apex_bank'),
        fetchTransactionsResultFromDb('tenant_apex_bank'),
        fetchAuditLogsResultFromDb('tenant_apex_bank'),
        fetchSupportTicketsResultFromDb('tenant_apex_bank'),
      ]);

      setFinanceRows(fraudRes.data || []);
      setCustomerRows(txnRes.data || []);
      setAdminRows(auditRes.logs || []);
      setSupportRows(ticketRes.data || []);
    } catch (e) {
      console.warn('Failed querying export records:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered rows
  const filteredFinance = useMemo(() => {
    return financeRows.filter(
      (r) =>
        r.id.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.customerName.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.paymentChannel.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.status.toLowerCase().includes(filterTerm.toLowerCase())
    );
  }, [financeRows, filterTerm]);

  const filteredCustomer = useMemo(() => {
    return customerRows.filter(
      (r) =>
        r.referenceNo.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.merchant.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.category.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.status.toLowerCase().includes(filterTerm.toLowerCase())
    );
  }, [customerRows, filterTerm]);

  const filteredAdmin = useMemo(() => {
    return adminRows.filter(
      (r) =>
        r.id.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.actor.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.action.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.target.toLowerCase().includes(filterTerm.toLowerCase())
    );
  }, [adminRows, filterTerm]);

  const filteredSupport = useMemo(() => {
    return supportRows.filter(
      (r) =>
        r.ticketId.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.customerName.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.category.toLowerCase().includes(filterTerm.toLowerCase()) ||
        r.status.toLowerCase().includes(filterTerm.toLowerCase())
    );
  }, [supportRows, filterTerm]);

  // Chart preparation computed from genuine database rows
  const columnData = useMemo(() => {
    if (selectedSheet === 'finance') {
      if (filteredFinance.length === 0) return [{ label: 'No Cases', value: 0 }];
      const channelCounts: Record<string, number> = {};
      filteredFinance.forEach((r) => {
        channelCounts[r.paymentChannel] = (channelCounts[r.paymentChannel] || 0) + 1;
      });
      return Object.entries(channelCounts).map(([label, value]) => ({
        label,
        value,
      }));
    } else if (selectedSheet === 'customer') {
      if (filteredCustomer.length === 0) return [{ label: 'No Txns', value: 0 }];
      const catCounts: Record<string, number> = {};
      filteredCustomer.forEach((r) => {
        catCounts[r.category] = (catCounts[r.category] || 0) + 1;
      });
      return Object.entries(catCounts).map(([label, value]) => ({
        label: label.split(' ')[0],
        value,
      }));
    } else if (selectedSheet === 'admin') {
      if (filteredAdmin.length === 0) return [{ label: 'No Logs', value: 0 }];
      const roleCounts: Record<string, number> = {};
      filteredAdmin.forEach((r) => {
        roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
      });
      return Object.entries(roleCounts).map(([label, value]) => ({
        label,
        value,
      }));
    } else {
      if (filteredSupport.length === 0) return [{ label: 'No Tickets', value: 0 }];
      const catCounts: Record<string, number> = {};
      filteredSupport.forEach((r) => {
        catCounts[r.category] = (catCounts[r.category] || 0) + 1;
      });
      return Object.entries(catCounts).map(([label, value]) => ({
        label: label.split(' ')[0],
        value,
      }));
    }
  }, [selectedSheet, filteredFinance, filteredCustomer, filteredAdmin, filteredSupport]);

  const pieData = useMemo(() => {
    if (selectedSheet === 'finance') {
      if (filteredFinance.length === 0) return [{ label: 'No Cases', value: 1, subtext: '0 records' }];
      const statusCounts: Record<string, number> = {};
      filteredFinance.forEach((r) => {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      });
      const total = filteredFinance.length;
      return Object.entries(statusCounts).map(([label, count]) => ({
        label,
        value: count,
        subtext: `${Math.round((count / total) * 100)}% of total`,
      }));
    } else if (selectedSheet === 'customer') {
      if (filteredCustomer.length === 0) return [{ label: 'No Txns', value: 1, subtext: '0 records' }];
      const statusCounts: Record<string, number> = {};
      filteredCustomer.forEach((r) => {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      });
      const total = filteredCustomer.length;
      return Object.entries(statusCounts).map(([label, count]) => ({
        label,
        value: count,
        subtext: `${Math.round((count / total) * 100)}% of total`,
      }));
    } else if (selectedSheet === 'admin') {
      if (filteredAdmin.length === 0) return [{ label: 'No Logs', value: 1, subtext: '0 records' }];
      const statusCounts: Record<string, number> = {};
      filteredAdmin.forEach((r) => {
        const key = r.status || 'Nominal';
        statusCounts[key] = (statusCounts[key] || 0) + 1;
      });
      const total = filteredAdmin.length;
      return Object.entries(statusCounts).map(([label, count]) => ({
        label,
        value: count,
        subtext: `${Math.round((count / total) * 100)}% of total`,
      }));
    } else {
      if (filteredSupport.length === 0) return [{ label: 'No Tickets', value: 1, subtext: '0 records' }];
      const statusCounts: Record<string, number> = {};
      filteredSupport.forEach((r) => {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      });
      const total = filteredSupport.length;
      return Object.entries(statusCounts).map(([label, count]) => ({
        label,
        value: count,
        subtext: `${Math.round((count / total) * 100)}% of total`,
      }));
    }
  }, [selectedSheet, filteredFinance, filteredCustomer, filteredAdmin, filteredSupport]);

  const handleExportCsv = () => {
    let rows: Record<string, any>[] = [];
    if (selectedSheet === 'finance') rows = filteredFinance;
    else if (selectedSheet === 'customer') rows = filteredCustomer;
    else if (selectedSheet === 'support') rows = filteredSupport;
    else rows = filteredAdmin;

    if (rows.length === 0) {
      alert('No database records available to export.');
      return;
    }

    const headers = Object.keys(rows[0] || {}).join(',');
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Finova_${selectedSheet}_records.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getSheetCount = () => {
    if (selectedSheet === 'finance') return filteredFinance.length;
    if (selectedSheet === 'customer') return filteredCustomer.length;
    if (selectedSheet === 'admin') return filteredAdmin.length;
    return filteredSupport.length;
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Verified Platform Engine
            </span>
            <span className="text-xs text-[#D4A017] flex items-center gap-1">
              <FileSpreadsheet size={12} className="text-[#F5C542]" /> Institutional Query & Data Export Engine
            </span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Database Export & Visualization
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Direct real-time query rendering, pivot summaries, and 3D geometric chart compilation from verified PostgreSQL database records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 text-[#D4A017] hover:border-[#D4A017] transition-all flex items-center gap-1.5"
            title="Refresh database records"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={getSheetCount() === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} /> Export CSV ({getSheetCount()})
          </button>
        </div>
      </div>

      {/* Dataset Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { key: 'finance', label: `Fraud & AML Cases (${financeRows.length})` },
          { key: 'customer', label: `Customer Transactions (${customerRows.length})` },
          { key: 'admin', label: `System Audit Logs (${adminRows.length})` },
          { key: 'support', label: `Support Tickets (${supportRows.length})` },
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
          {getSheetCount() === 0 ? (
            <div className="p-8 text-center text-[#9CA3AF]">
              <AlertCircle size={28} className="mx-auto text-[#D4A017]/50 mb-2" />
              <p className="text-xs font-bold text-[#FAF7F0]">No verified records available for 3D visualization</p>
              <p className="text-[11px] text-[#6B7280] mt-1">Metric unavailable — verified data not available.</p>
            </div>
          ) : chartType === 'column' ? (
            <ThreeDColumnChart
              title={`3D Aggregated Distribution (${selectedSheet.toUpperCase()} Database Records)`}
              subtitle="Breakdown calculated from verified database queries"
              data={columnData}
              height={300}
              valuePrefix=""
              valueSuffix=" records"
              primaryLabel="Record Count"
            />
          ) : (
            <ThreeDPieChart
              title={`3D Proportional Status Breakdown (${selectedSheet.toUpperCase()})`}
              subtitle="Status distribution from verified live database rows"
              segments={pieData}
              height={300}
            />
          )}
        </div>
      </div>

      {/* Live Database Table */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#D4A017]/20">
          <div className="flex items-center gap-2">
            <Table2 size={16} className="text-[#F5C542]" />
            <h3 className="text-sm font-bold text-[#FFF8E7]">Verified Records: {selectedSheet.toUpperCase()}</h3>
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
            filteredFinance.length === 0 ? (
              <div className="p-8 text-center text-[#9CA3AF]">
                <p className="font-bold text-[#FAF7F0]">No fraud cases found.</p>
                <p className="text-[11px] text-[#6B7280] mt-1">Zero fraud or AML cases reported for this workspace.</p>
              </div>
            ) : (
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
                  {filteredFinance.map((r, idx: number) => (
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
            )
          )}

          {selectedSheet === 'customer' && (
            filteredCustomer.length === 0 ? (
              <div className="p-8 text-center text-[#9CA3AF]">
                <p className="font-bold text-[#FAF7F0]">No transactions available yet.</p>
                <p className="text-[11px] text-[#6B7280] mt-1">Transactions recorded in PostgreSQL will appear here in real time.</p>
              </div>
            ) : (
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
                  {filteredCustomer.map((r, idx: number) => (
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
            )
          )}

          {selectedSheet === 'admin' && (
            filteredAdmin.length === 0 ? (
              <div className="p-8 text-center text-[#9CA3AF]">
                <p className="font-bold text-[#FAF7F0]">No audit logs recorded yet.</p>
                <p className="text-[11px] text-[#6B7280] mt-1">Audit logs from security events and operations will be recorded here.</p>
              </div>
            ) : (
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
                  {filteredAdmin.map((r, idx: number) => (
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
            )
          )}

          {selectedSheet === 'support' && (
            filteredSupport.length === 0 ? (
              <div className="p-8 text-center text-[#9CA3AF]">
                <p className="font-bold text-[#FAF7F0]">No support tickets found.</p>
                <p className="text-[11px] text-[#6B7280] mt-1">Inbound client tickets and concierge inquiries will appear here.</p>
              </div>
            ) : (
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
                  {filteredSupport.map((r, idx: number) => (
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
            )
          )}
        </div>
      </div>
    </div>
  );
};
