import React from 'react';
import { Search, Filter, RotateCw, Calendar, Globe, Building2, ShieldAlert } from 'lucide-react';

export interface DataTransferFilters {
  startDate: string;
  endDate: string;
  currency: string;
  type: 'Credit' | 'Debit' | 'ALL';
  channel: string;
  status: string;
  search: string;
  tenantId: string;
}

interface DataTransferFilterBarProps {
  filters: DataTransferFilters;
  onFilterChange: (filters: DataTransferFilters) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const DataTransferFilterBar: React.FC<DataTransferFilterBarProps> = ({
  filters,
  onFilterChange,
  onRefresh,
  isLoading
}) => {
  const handleChange = (key: keyof DataTransferFilters, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="rounded-2xl p-5 bg-[#1A1A1A]/80 border border-[#D4A017]/30 shadow-2xl backdrop-blur-xl space-y-4">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#D4A017]/10 border border-[#D4A017]/30 text-[#D4A017]">
            <Filter size={18} />
          </div>
          <div>
            <h3 className="font-cinzel text-sm font-bold text-[#FFF8E7]">Intelligence Filters</h3>
            <p className="text-[10px] text-[#9CA3AF] font-mono">Parameters for real-time telemetry analysis</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#121212] border border-[#3A3A3A] hover:border-[#D4A017] text-[#FAF7F0] text-[11px] font-bold transition-all group"
          >
            <RotateCw size={14} className={isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
            REFRESH NODE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Date Range */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-[#D4A017] uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={10} /> Temporal Window
          </label>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              className="w-full bg-[#121212] border border-[#3A3A3A] rounded-lg px-2 py-1.5 text-[10px] text-[#FAF7F0] focus:border-[#D4A017] outline-none"
            />
            <span className="text-[#9CA3AF]">→</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              className="w-full bg-[#121212] border border-[#3A3A3A] rounded-lg px-2 py-1.5 text-[10px] text-[#FAF7F0] focus:border-[#D4A017] outline-none"
            />
          </div>
        </div>

        {/* Currency */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-[#D4A017] uppercase tracking-widest flex items-center gap-1.5">
            <Globe size={10} /> Currency Rail
          </label>
          <select
            value={filters.currency}
            onChange={(e) => handleChange('currency', e.target.value)}
            className="w-full bg-[#121212] border border-[#3A3A3A] rounded-lg px-3 py-1.5 text-[10px] text-[#FAF7F0] focus:border-[#D4A017] outline-none"
          >
            <option value="ALL">All Currencies</option>
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="INR">INR - Indian Rupee</option>
          </select>
        </div>

        {/* Channel */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-[#D4A017] uppercase tracking-widest flex items-center gap-1.5">
            <Building2 size={10} /> Settlement Rail
          </label>
          <select
            value={filters.channel}
            onChange={(e) => handleChange('channel', e.target.value)}
            className="w-full bg-[#121212] border border-[#3A3A3A] rounded-lg px-3 py-1.5 text-[10px] text-[#FAF7F0] focus:border-[#D4A017] outline-none"
          >
            <option value="ALL">All Channels</option>
            <option value="SWIFT">SWIFT GPI</option>
            <option value="FedNow">FedNow Instant</option>
            <option value="SEPA">SEPA Instant</option>
            <option value="CHAPS">CHAPS / RTGS</option>
          </select>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-[#D4A017] uppercase tracking-widest flex items-center gap-1.5">
            <ShieldAlert size={10} /> Clearing Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full bg-[#121212] border border-[#3A3A3A] rounded-lg px-3 py-1.5 text-[10px] text-[#FAF7F0] focus:border-[#D4A017] outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Settled">Confirmed / Settled</option>
            <option value="Pending">Pending / Clearing</option>
            <option value="Failed">Failed / Rejected</option>
            <option value="Reversed">Reversed / Refunded</option>
          </select>
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-[#D4A017] uppercase tracking-widest flex items-center gap-1.5">
            <Filter size={10} /> Transaction Type
          </label>
          <select
            value={filters.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="w-full bg-[#121212] border border-[#3A3A3A] rounded-lg px-3 py-1.5 text-[10px] text-[#FAF7F0] focus:border-[#D4A017] outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="Credit">Credit / Inbound</option>
            <option value="Debit">Debit / Outbound</option>
          </select>
        </div>

        {/* Search */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-[#D4A017] uppercase tracking-widest flex items-center gap-1.5">
            <Search size={10} /> Search Record
          </label>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2 text-[#D4A017]" />
            <input
              type="text"
              placeholder="TXN ID / Account / Customer..."
              value={filters.search}
              onChange={(e) => handleChange('search', e.target.value)}
              className="w-full bg-[#121212] border border-[#3A3A3A] rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-[#FAF7F0] focus:border-[#D4A017] outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
