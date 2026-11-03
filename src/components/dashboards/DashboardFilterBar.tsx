import React from 'react';
import { Calendar, Globe, MapPin, Filter, X, ChevronDown } from 'lucide-react';

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  currency: string;
  branchCity: string;
}

interface DashboardFilterBarProps {
  filters: DashboardFilters;
  onFilterChange: (filters: DashboardFilters) => void;
  availableCities?: string[];
  isLoading?: boolean;
}

export const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
  filters,
  onFilterChange,
  availableCities = ['Global Operations', 'New York', 'London', 'Zurich', 'Singapore', 'Mumbai'],
  isLoading = false,
}) => {
  const handleChange = (key: keyof DashboardFilters, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      startDate: '',
      endDate: '',
      currency: 'ALL',
      branchCity: 'Global Operations',
    });
  };

  return (
    <div className="rounded-2xl bg-[#121212]/80 backdrop-blur-xl border border-[#3A3A3A] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 text-[#D4A017]">
        <Filter size={16} />
        <span className="font-cinzel text-[10px] font-bold uppercase tracking-widest">Intelligence Filters</span>
      </div>

      <div className="h-8 w-px bg-[#3A3A3A] hidden md:block" />

      {/* Date Range */}
      <div className="flex items-center gap-3 bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3 py-1.5 hover:border-[#D4A017]/50 transition-all">
        <Calendar size={14} className="text-[#9CA3AF]" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            className="bg-transparent border-none text-[10px] font-mono text-[#FAF7F0] focus:ring-0 w-28"
          />
          <span className="text-[#3A3A3A]">—</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
            className="bg-transparent border-none text-[10px] font-mono text-[#FAF7F0] focus:ring-0 w-28"
          />
        </div>
      </div>

      {/* Currency */}
      <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3 py-1.5 hover:border-[#D4A017]/50 transition-all group">
        <Globe size={14} className="text-[#9CA3AF] group-hover:text-[#D4A017] transition-colors" />
        <select
          value={filters.currency}
          onChange={(e) => handleChange('currency', e.target.value)}
          className="bg-transparent border-none text-[10px] font-mono text-[#FAF7F0] focus:ring-0 cursor-pointer pr-8"
        >
          <option value="ALL">All Currencies</option>
          <option value="USD">USD - US Dollar</option>
          <option value="INR">INR - Indian Rupee</option>
          <option value="EUR">EUR - Euro</option>
          <option value="GBP">GBP - British Pound</option>
          <option value="CHF">CHF - Swiss Franc</option>
        </select>
      </div>

      {/* Branch / City */}
      <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3 py-1.5 hover:border-[#D4A017]/50 transition-all group">
        <MapPin size={14} className="text-[#9CA3AF] group-hover:text-[#D4A017] transition-colors" />
        <select
          value={filters.branchCity}
          onChange={(e) => handleChange('branchCity', e.target.value)}
          className="bg-transparent border-none text-[10px] font-mono text-[#FAF7F0] focus:ring-0 cursor-pointer pr-8"
        >
          {availableCities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-grow" />

      <div className="flex items-center gap-2">
        <button
          onClick={clearFilters}
          className="p-2 rounded-lg hover:bg-[#262626] text-[#9CA3AF] hover:text-[#FAF7F0] transition-all"
          title="Reset Filters"
        >
          <X size={16} />
        </button>
        
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-bold animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            SYNCHRONIZING...
          </div>
        )}
      </div>
    </div>
  );
};
