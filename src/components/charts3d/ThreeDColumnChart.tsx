import React, { useState } from 'react';

export interface ColumnDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  highlight?: boolean;
  meta?: string;
}

interface ThreeDColumnChartProps {
  title?: string;
  subtitle?: string;
  data: ColumnDataPoint[];
  height?: number;
  valuePrefix?: string;
  valueSuffix?: string;
  dualSeries?: boolean;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export const ThreeDColumnChart: React.FC<ThreeDColumnChartProps> = ({
  title,
  subtitle,
  data,
  height = 280,
  valuePrefix = '$',
  valueSuffix = '',
  dualSeries = false,
  primaryLabel = 'Revenue',
  secondaryLabel = 'Target',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [viewAngle, setViewAngle] = useState<'isometric' | 'steep'>('isometric');

  const maxValue = Math.max(
    ...data.flatMap((d) => [d.value, d.secondaryValue || 0]),
    1
  );

  // Isometric projection constants
  const chartHeight = height;
  const colWidth = Math.min(34, Math.max(18, 480 / (data.length * (dualSeries ? 2.2 : 1.5))));
  const depthX = viewAngle === 'isometric' ? 14 : 9;
  const depthY = viewAngle === 'isometric' ? 10 : 14;

  return (
    <div className="relative w-full rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#D4A017]/15 gap-2">
        <div>
          {title && (
            <h3 className="font-cinzel text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#F5C542] shadow-[0_0_8px_#F5C542]" />
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="font-mono text-xs text-[#D4A017]/70 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-3 mr-2">
            <span className="flex items-center gap-1.5 text-xs text-[#FFF8E7]">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-b from-[#F5C542] to-[#D4A017] border border-[#FFF8E7]/40 inline-block shadow-[0_0_6px_#D4A017]" />
              {primaryLabel}
            </span>
            {dualSeries && (
              <span className="flex items-center gap-1.5 text-xs text-[#D4A017]/80">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#6B3E00] border border-[#D4A017]/40 inline-block" />
                {secondaryLabel}
              </span>
            )}
          </div>
          <button
            onClick={() => setViewAngle((prev) => (prev === 'isometric' ? 'steep' : 'isometric'))}
            className="px-2.5 py-1 rounded-lg border border-[#D4A017]/40 bg-[#111111] text-[#F5C542] text-[11px] hover:bg-[#6B3E00]/40 transition-colors"
          >
            3D Tilt: {viewAngle === 'isometric' ? 'Isometric' : 'Perspective'}
          </button>
        </div>
      </div>

      {/* 3D Visualization Canvas Area */}
      <div className="relative mt-4 overflow-visible" style={{ height: `${chartHeight}px` }}>
        {/* Dimensional Floor Grid */}
        <div className="absolute inset-x-0 bottom-6 h-12 pointer-events-none opacity-40">
          <svg className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <pattern id="floorGrid" width="24" height="12" patternUnits="userSpaceOnUse">
                <path d="M 0 12 L 12 0 L 24 12 Z" fill="none" stroke="#D4A017" strokeWidth="0.5" strokeOpacity="0.25" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#floorGrid)" />
          </svg>
        </div>

        {/* 3D Columns Rendering */}
        <div className="relative w-full h-full flex items-end justify-between px-3 sm:px-6 pb-7">
          {data.map((item, idx) => {
            const isHovered = hoveredIndex === idx;
            const primaryHeight = Math.max(16, (item.value / maxValue) * (chartHeight - 75));
            const secHeight = item.secondaryValue
              ? Math.max(16, (item.secondaryValue / maxValue) * (chartHeight - 75))
              : 0;

            return (
              <div
                key={idx}
                className="relative flex flex-col items-center group cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Hover 3D Tooltip */}
                {isHovered && (
                  <div className="absolute -top-16 z-30 transform -translate-x-1/2 left-1/2 pointer-events-none whitespace-nowrap bg-[#111111] border border-[#F5C542] rounded-xl px-3 py-1.5 shadow-[0_8px_20px_rgba(212,160,23,0.35)] animate-in fade-in zoom-in-95 duration-150">
                    <p className="font-cinzel text-xs font-bold text-[#F5C542]">{item.label}</p>
                    <p className="font-mono text-sm font-semibold text-[#FFF8E7]">
                      {primaryLabel}: {valuePrefix}{item.value.toLocaleString()}{valueSuffix}
                    </p>
                    {item.secondaryValue !== undefined && (
                      <p className="font-mono text-xs text-[#D4A017]">
                        {secondaryLabel}: {valuePrefix}{item.secondaryValue.toLocaleString()}{valueSuffix}
                      </p>
                    )}
                    {item.meta && (
                      <p className="text-[10px] text-[#6B7280]">{item.meta}</p>
                    )}
                  </div>
                )}

                {/* Isometric 3D Bar Group */}
                <div className="flex items-end gap-1.5 relative transition-transform duration-300 transform group-hover:-translate-y-2">
                  {/* Primary 3D Extruded Column */}
                  <div
                    className="relative transition-all duration-500"
                    style={{
                      width: `${colWidth}px`,
                      height: `${primaryHeight}px`,
                    }}
                  >
                    {/* Top Face (Cap) - Parallelogram */}
                    <div
                      className="absolute -top-[10px] left-[7px] w-full transition-colors duration-300"
                      style={{
                        height: `${depthY}px`,
                        transform: 'skewX(-45deg)',
                        transformOrigin: 'bottom left',
                        background: isHovered
                          ? '#FFFFFF'
                          : item.highlight
                          ? '#FFF8E7'
                          : 'linear-gradient(135deg, #FFF8E7 0%, #F5C542 100%)',
                        boxShadow: '0 0 10px rgba(245, 197, 66, 0.4)',
                      }}
                    />

                    {/* Right Face (Side Extrusion) - Parallelogram */}
                    <div
                      className="absolute top-0 -right-[10px] h-full transition-colors duration-300"
                      style={{
                        width: `${depthX}px`,
                        transform: 'skewY(-45deg)',
                        transformOrigin: 'top left',
                        background: isHovered
                          ? 'linear-gradient(180deg, #D4A017 0%, #4A2C0A 100%)'
                          : 'linear-gradient(180deg, #A87508 0%, #4A2C0A 100%)',
                      }}
                    />

                    {/* Front Face (Main Pillar) */}
                    <div
                      className="w-full h-full relative overflow-hidden transition-all duration-300 border-l border-t border-[#FFF8E7]/40"
                      style={{
                        background: isHovered
                          ? 'linear-gradient(180deg, #F5C542 0%, #D4A017 50%, #8A5400 100%)'
                          : item.highlight
                          ? 'linear-gradient(180deg, #FFEAB5 0%, #F5C542 50%, #A87508 100%)'
                          : 'linear-gradient(180deg, #F5C542 0%, #D4A017 65%, #6B3E00 100%)',
                        boxShadow: isHovered
                          ? '0 0 20px rgba(245, 197, 66, 0.6), inset 0 1px 0 rgba(255,255,255,0.7)'
                          : '0 4px 15px rgba(0,0,0,0.5)',
                      }}
                    >
                      {/* Specular Front Sheen */}
                      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-white/35 to-transparent pointer-events-none" />
                      {/* Sub-divider line */}
                      <div className="absolute top-1/2 inset-x-0 h-px bg-[#FFF8E7]/20" />
                    </div>

                    {/* Base Shadow Floor Contact */}
                    <div
                      className="absolute -bottom-2 -left-2 w-[130%] h-3 bg-[#000000]/70 rounded-full blur-[3px] pointer-events-none -z-10"
                    />
                  </div>

                  {/* Secondary 3D Column (if dualSeries) */}
                  {dualSeries && item.secondaryValue !== undefined && (
                    <div
                      className="relative transition-all duration-500 opacity-90"
                      style={{
                        width: `${colWidth * 0.85}px`,
                        height: `${secHeight}px`,
                      }}
                    >
                      {/* Top Cap */}
                      <div
                        className="absolute -top-[8px] left-[5px] w-full"
                        style={{
                          height: `${depthY * 0.8}px`,
                          transform: 'skewX(-45deg)',
                          transformOrigin: 'bottom left',
                          background: '#C08A00',
                        }}
                      />
                      {/* Right Face */}
                      <div
                        className="absolute top-0 -right-[8px] h-full"
                        style={{
                          width: `${depthX * 0.8}px`,
                          transform: 'skewY(-45deg)',
                          transformOrigin: 'top left',
                          background: '#301B05',
                        }}
                      />
                      {/* Front Face */}
                      <div
                        className="w-full h-full border-l border-t border-[#D4A017]/30"
                        style={{
                          background: 'linear-gradient(180deg, #8A5400 0%, #4A2C0A 100%)',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* X-Axis Label */}
                <div className="absolute -bottom-6 text-center whitespace-nowrap">
                  <span
                    className={`font-mono text-[11px] transition-colors duration-200 ${
                      isHovered
                        ? 'text-[#F5C542] font-bold underline'
                        : item.highlight
                        ? 'text-[#FFF8E7] font-semibold'
                        : 'text-[#D4A017]/70'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
