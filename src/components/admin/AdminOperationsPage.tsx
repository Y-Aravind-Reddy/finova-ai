import React, { useState } from 'react';
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Zap,
  Globe,
  Database,
  Building2,
} from 'lucide-react';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';

interface SettlementQueueItem {
  batchId: string;
  rail: string;
  volume: string;
  transactionsCount: number;
  status: 'Clearing' | 'Settled' | 'Scheduled' | 'Pending Dual-Auth';
  slaCountdown: string;
  clearingBank: string;
}

export const AdminOperationsPage: React.FC = () => {
  const [queues, setQueues] = useState<SettlementQueueItem[]>([
    {
      batchId: 'BATCH-FEDNOW-0914',
      rail: 'FedNow Instant',
      volume: '$14,250,000 USD',
      transactionsCount: 342,
      status: 'Clearing',
      slaCountdown: '00:01:42 (Real-Time)',
      clearingBank: 'Federal Reserve Bank of New York',
    },
    {
      batchId: 'BATCH-SWIFT-GPI-480',
      rail: 'SWIFT GPI Cross-Border',
      volume: '$48,900,000 USD',
      transactionsCount: 89,
      status: 'Clearing',
      slaCountdown: '00:14:20',
      clearingBank: 'UBS Switzerland AG / J.P. Morgan',
    },
    {
      batchId: 'BATCH-SEPA-INST-112',
      rail: 'SEPA Instant Credit Transfer',
      volume: '€9,400,000 EUR',
      transactionsCount: 154,
      status: 'Settled',
      slaCountdown: 'Completed',
      clearingBank: 'Deutsche Bundesbank',
    },
    {
      batchId: 'BATCH-CHAPS-HIGH-99',
      rail: 'CHAPS Sterling High-Value',
      volume: '£12,800,000 GBP',
      transactionsCount: 22,
      status: 'Pending Dual-Auth',
      slaCountdown: '00:29:10',
      clearingBank: 'Bank of England Wholesale',
    },
  ]);

  const [executing, setExecuting] = useState(false);

  const handleForceClearBatch = (batchId: string) => {
    setExecuting(true);
    setTimeout(() => {
      setQueues((prev) =>
        prev.map((q) =>
          q.batchId === batchId
            ? { ...q, status: 'Settled', slaCountdown: 'Completed' }
            : q
        )
      );
      setExecuting(false);
    }, 800);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider">
              Operations Control
            </span>
            <span className="text-xs text-[#E6C78B]">Clearing & Settlement Gateway</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            Operations Management
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Monitor real-time payment rails, batch liquidity matching, SWIFT GPI pacs messaging, and instant FedNow settlements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A] text-right">
            <span className="text-[10px] text-[#9CA3AF] block">Central Clearing Buffer</span>
            <span className="text-sm font-bold text-[#E6C78B]">$450.0M Reserved</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Intraday Volume"
          value="$85.35M"
          subValue="607 Total Wires"
          change="+21.4%"
          trend="up"
          tag="Active"
          icon={<Globe size={20} />}
          sparkline={[40, 52, 60, 68, 74, 80, 85]}
        />
        <ThreeDKpiCard
          title="FedNow Instant"
          value="1.82s"
          subValue="Average Settlement"
          change="Real-Time"
          trend="up"
          tag="FedNow"
          variant="gold-accent"
          icon={<Zap size={20} />}
          sparkline={[2, 2, 2, 1.9, 1.8, 1.8, 1.8]}
        />
        <ThreeDKpiCard
          title="SWIFT GPI Uptime"
          value="100%"
          subValue="0 Schema Faults"
          change="Zero Dropped"
          trend="up"
          tag="Nominal"
          icon={<CheckCircle2 size={20} />}
          sparkline={[100, 100, 100, 100, 100, 100, 100]}
        />
        <ThreeDKpiCard
          title="Escrow Lock Buffer"
          value="$38.4M"
          subValue="14 Pending Dual-Sign"
          change="Locked"
          trend="up"
          tag="Escrow"
          icon={<Database size={20} />}
          sparkline={[22, 25, 29, 32, 35, 36, 38]}
        />
      </div>

      {/* Settlement Batches Table */}
      <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#3A3A3A]">
          <div>
            <h3 className="font-cinzel text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] flex items-center gap-2">
              <Layers size={16} className="text-[#D4A017]" />
              Active Payment Rail Batch Queues
            </h3>
            <p className="text-xs text-[#9CA3AF]">Real-time ISO 20022 clearing queue monitoring</p>
          </div>
          <span className="text-[10px] text-[#9CA3AF]">
            {executing ? 'Clearing in progress...' : 'Auto-Sync: 1500ms'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#3A3A3A] text-[10px] uppercase text-[#E6C78B]">
                <th className="pb-3">Batch ID</th>
                <th className="pb-3">Clearing Rail</th>
                <th className="pb-3">Gross Liquidity</th>
                <th className="pb-3">Correspondent Bank</th>
                <th className="pb-3">SLA Countdown</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Operations Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
              {queues.map((q) => (
                <tr key={q.batchId} className="hover:bg-[#121212]/50 transition-colors">
                  <td className="py-3 font-bold text-[#E6C78B]">{q.batchId}</td>
                  <td className="py-3 text-[#FAF7F0] font-semibold">{q.rail}</td>
                  <td className="py-3 font-mono text-[#D4A017]">
                    {q.volume} <span className="text-[10px] text-[#9CA3AF]">({q.transactionsCount} tx)</span>
                  </td>
                  <td className="py-3 text-[11px] text-[#9CA3AF]">{q.clearingBank}</td>
                  <td className="py-3 text-[11px] font-mono text-[#E6C78B]">{q.slaCountdown}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        q.status === 'Settled'
                          ? 'bg-[#121212] text-[#E6C78B] border border-[#D4A017]/40'
                          : q.status === 'Clearing'
                          ? 'bg-[#121212] text-[#D4A017] border border-[#D4A017]'
                          : 'bg-[#121212] text-[#B87333] border border-[#B87333]'
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {q.status !== 'Settled' ? (
                      <button
                        onClick={() => handleForceClearBatch(q.batchId)}
                        disabled={executing}
                        className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold text-[10px] hover:brightness-110 shadow-md transition-all disabled:opacity-50"
                      >
                        Force Settle Now
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#9CA3AF]">Settlement Reconciled ✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
