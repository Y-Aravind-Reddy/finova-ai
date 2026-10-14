import React, { useState } from 'react';

interface RevenueMonth {
  month: string;
  inflow: number;     // e.g. in Millions
  outflow: number;    // e.g. in Millions
  netProfit: number;  // e.g. in Millions
}

interface ThreeDRevenueVizProps {
  title?: string;
  subtitle?: string;
  data?: RevenueMonth[];
  timeframe?: string;
}

const DEFAULT_REVENUE_DATA: RevenueMonth[] = [
  { month: 'Jan', inflow: 6.4, outflow: 2.1, netProfit: 4.3 },
  { month: 'Feb', inflow: 7.2, outflow: 2.4, netProfit: 4.8 },
  { month: 'Mar', inflow: 8.8, outflow: 2.8, netProfit: 6.0 },
  { month: 'Apr', inflow: 9.1, outflow: 3.1, netProfit: 6.0 },
  { month: 'May', inflow: 10.5, outflow: 3.3, netProfit: 7.2 },
  { month: 'Jun', inflow: 11.2, outflow: 3.6, netProfit: 7.6 },
  { month: 'Jul', inflow: 12.8, outflow: 4.0, netProfit: 8.8 },
  { month: 'Aug', inflow: 13.9, outflow: 4.2, netProfit: 9.7 },
  { month: 'Sep', inflow: 15.1, outflow: 4.6, netProfit: 10.5 },
  { month: 'Oct', inflow: 16.8, outflow: 4.9, netProfit: 11.9 },
];

export const ThreeDRevenueViz: React.FC<ThreeDRevenueVizProps> = ({
  title = '3D Executive Revenue Architecture',
  subtitle = 'Institutional Net Margin & Capital Velocity (FY2026)',
  data = DEFAULT_REVENUE_DATA,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [metricMode, setMetricMode] = useState<'all' | 'inflow' | 'profit'>('all');

  const maxVal = Math.max(...data.map((d) => d.inflow), 1);
  const chartHeight = 240;

  return (
    <div className="relative w-full rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#D4A017]/15 gap-2">
        <div>
          <h3 className="font-cinzel text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F5C542] shadow-[0_0_8px_#F5C542]" />
            {title}
          </h3>
          <p className="font-mono text-xs text-[#D4A017]/70 mt-0.5">{subtitle}</p>
        </div>

        {/* View Switches */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#111111] p-0.5 rounded-lg border border-[#D4A017]/30">
            <button
              onClick={() => setMetricMode('all')}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-colors ${
                metricMode === 'all'
                  ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold'
                  : 'text-[#D4A017] hover:text-[#FAF7F0]'
              }`}
            >
              Full Stack
            </button>
            <button
              onClick={() => setMetricMode('inflow')}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-colors ${
                metricMode === 'inflow'
                  ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold'
                  : 'text-[#D4A017] hover:text-[#FAF7F0]'
              }`}
            >
              Gross Inflow
            </button>
            <button
              onClick={() => setMetricMode('profit')}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-colors ${
                metricMode === 'profit'
                  ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold'
                  : 'text-[#D4A017] hover:text-[#FAF7F0]'
              }`}
            >
              Net Margin
            </button>
          </div>
        </div>
      </div>

      {/* 3D Visual Stage */}
      <div className="relative mt-5 pt-4 pb-8" style={{ height: `${chartHeight}px` }}>
        {/* Isometric Grid Surface */}
        <div className="absolute inset-x-0 bottom-4 h-20 opacity-30 pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4A017" stopOpacity="0.4" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </linearGradient>
            </defs>
            {Array.from({ length: 6 }).map((_, i) => (
              <line
                key={i}
                x1="0%"
                y1={`${i * 20}%`}
                x2="100%"
                y2={`${i * 20}%`}
                stroke="#D4A017"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
            ))}
          </svg>
        </div>

        {/* 3D Pillars Row */}
        <div className="relative w-full h-full flex items-end justify-between px-2 sm:px-6">
          {data.map((item, idx) => {
            const isHover = selectedIdx === idx;
            const primaryH = Math.max(20, (item.inflow / maxVal) * (chartHeight - 65));
            const profitH = Math.max(14, (item.netProfit / maxVal) * (chartHeight - 65));

            return (
              <div
                key={idx}
                className="relative flex flex-col items-center group cursor-pointer"
                onMouseEnter={() => setSelectedIdx(idx)}
                onMouseLeave={() => setSelectedIdx(null)}
              >
                {/* 3D Hover Card */}
                {isHover && (
                  <div className="absolute -top-20 z-30 transform -translate-x-1/2 left-1/2 bg-[#111111] border border-[#F5C542] rounded-xl p-2.5 shadow-[0_10px_25px_rgba(212,160,23,0.4)] pointer-events-none whitespace-nowrap">
                    <p className="font-cinzel text-xs font-bold text-[#F5C542]">{item.month} 2026 Performance</p>
                    <p className="font-mono text-xs text-[#FFF8E7]">Inflow: ${item.inflow.toFixed(1)}M USD</p>
                    <p className="font-mono text-xs text-[#D4A017]">Net Profit: ${item.netProfit.toFixed(1)}M USD</p>
                    <p className="font-mono text-[10px] text-[#6B7280]">Outflow: ${item.outflow.toFixed(1)}M USD</p>
                  </div>
                )}

                {/* 3D Extruded Columns */}
                <div className="relative flex items-end gap-1 transform transition-transform duration-300 group-hover:-translate-y-2.5">
                  {/* Gross Inflow Pillar */}
                  {(metricMode === 'all' || metricMode === 'inflow') && (
                    <div
                      className="relative transition-all duration-300"
                      style={{
                        width: '24px',
                        height: `${primaryH}px`,
                      }}
                    >
                      {/* Top Cap */}
                      <div
                        className="absolute -top-[7px] left-[5px] w-full"
                        style={{
                          height: '8px',
                          transform: 'skewX(-45deg)',
                          transformOrigin: 'bottom left',
                          background: isHover ? '#FFFFFF' : '#FFF8E7',
                          boxShadow: '0 0 8px rgba(245, 197, 66, 0.5)',
                        }}
                      />
                      {/* Right Extrusion */}
                      <div
                        className="absolute top-0 -right-[7px] h-full"
                        style={{
                          width: '7px',
                          transform: 'skewY(-45deg)',
                          transformOrigin: 'top left',
                          background: 'linear-gradient(180deg, #A87508 0%, #4A2C0A 100%)',
                        }}
                      />
                      {/* Front Face */}
                      <div
                        className="w-full h-full border-l border-t border-[#FFF8E7]/50"
                        style={{
                          background: isHover
                            ? 'linear-gradient(180deg, #FFF8E7 0%, #F5C542 40%, #6B3E00 100%)'
                            : 'linear-gradient(180deg, #F5C542 0%, #D4A017 50%, #4A2C0A 100%)',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
                        }}
                      >
                        <div className="w-1 h-full bg-white/30" />
                      </div>
                    </div>
                  )}

                  {/* Net Margin Pillar */}
                  {(metricMode === 'all' || metricMode === 'profit') && (
                    <div
                      className="relative transition-all duration-300"
                      style={{
                        width: '18px',
                        height: `${profitH}px`,
                      }}
                    >
                      {/* Top Cap */}
                      <div
                        className="absolute -top-[6px] left-[4px] w-full"
                        style={{
                          height: '7px',
                          transform: 'skewX(-45deg)',
                          transformOrigin: 'bottom left',
                          background: '#F5C542',
                        }}
                      />
                      {/* Right Extrusion */}
                      <div
                        className="absolute top-0 -right-[6px] h-full"
                        style={{
                          width: '6px',
                          transform: 'skewY(-45deg)',
                          transformOrigin: 'top left',
                          background: '#301B05',
                        }}
                      />
                      {/* Front Face */}
                      <div
                        className="w-full h-full border-l border-t border-[#D4A017]/40"
                        style={{
                          background: 'linear-gradient(180deg, #D4A017 0%, #8A5400 60%, #301B05 100%)',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* X Label */}
                <div className="absolute -bottom-6 text-center">
                  <span
                    className={`font-mono text-[10px] sm:text-xs transition-colors ${
                      isHover ? 'text-[#F5C542] font-bold' : 'text-[#D4A017]/70'
                    }`}
                  >
                    {item.month}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div className="mt-4 pt-3 border-t border-[#D4A017]/15 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[#FFF8E7]">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-b from-[#F5C542] to-[#D4A017] inline-block shadow-[0_0_6px_#D4A017]" />
            Gross Capital Inflows
          </span>
          <span className="flex items-center gap-1.5 text-[#D4A017]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#8A5400] inline-block" />
            Net Retained Margin
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#FAF7F0]">
          <span className="text-[#6B7280]">YTD Net Margin:</span>
          <span className="text-sm font-bold text-[#F5C542]">$74.8M USD</span>
          <span className="px-1.5 py-0.5 rounded bg-[#C08A00]/20 text-[#F5C542] text-[10px] border border-[#C08A00]/30 font-bold">
            +38.4% YoY
          </span>
        </div>
      </div>
    </div>
  );
};
