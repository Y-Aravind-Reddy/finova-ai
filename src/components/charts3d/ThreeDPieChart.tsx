import React, { useState } from 'react';

export interface PieSegment {
  label: string;
  value: number;
  subtext?: string;
}

interface ThreeDPieChartProps {
  title?: string;
  subtitle?: string;
  segments: PieSegment[];
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
}

const GOLD_PIE_SHADES = [
  { top: '#FFF8E7', front: '#F5C542', dark: '#945C05' },
  { top: '#F5C542', front: '#D4A017', dark: '#6B3E00' },
  { top: '#D4A017', front: '#A87508', dark: '#4A2C0A' },
  { top: '#B88209', front: '#8A5400', dark: '#301B05' },
  { top: '#8A5400', front: '#633900', dark: '#1F1102' },
];

export const ThreeDPieChart: React.FC<ThreeDPieChartProps> = ({
  title,
  subtitle,
  segments,
  valuePrefix = '$',
  valueSuffix = '',
  height = 300,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = segments.reduce((acc, curr) => acc + curr.value, 0);

  const cx = 140;
  const cy = 100;
  const rx = 100;
  const ry = 55;
  const depth = 24;

  let currentAngle = -90;
  const parsedSlices = segments.map((item, idx) => {
    const angleSpan = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;
    currentAngle = endAngle;

    const midAngle = (startAngle + endAngle) / 2;
    const rad = (midAngle * Math.PI) / 180;
    const explodeX = Math.cos(rad) * 8;
    const explodeY = Math.sin(rad) * 5;

    return {
      ...item,
      idx,
      startAngle,
      endAngle,
      midAngle,
      explodeX,
      explodeY,
      pct: ((item.value / total) * 100).toFixed(1),
      colors: GOLD_PIE_SHADES[idx % GOLD_PIE_SHADES.length],
    };
  });

  const getPt = (deg: number, rX: number, rY: number, offX = 0, offY = 0) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + rX * Math.cos(rad) + offX,
      y: cy + rY * Math.sin(rad) + offY,
    };
  };

  return (
    <div className="relative w-full rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#D4A017]/15">
        <div>
          {title && (
            <h3 className="font-cinzel text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F5C542] shadow-[0_0_8px_#F5C542]" />
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="font-mono text-xs text-[#D4A017]/70 mt-0.5">{subtitle}</p>
          )}
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase bg-[#6B3E00]/30 text-[#F5C542] border border-[#D4A017]/30">
          3D Pie Analytics
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-3">
        {/* SVG 3D Pie */}
        <div className="relative flex-1 flex justify-center items-center w-full min-w-[260px]" style={{ height: `${height - 70}px` }}>
          <svg viewBox="0 0 280 210" className="w-full h-full max-w-[300px] overflow-visible">
            {/* Ground shadow */}
            <ellipse cx={cx} cy={cy + depth + 14} rx={rx + 10} ry={(ry + 10) * 0.75} fill="#000000" opacity="0.6" filter="blur(6px)" />

            {/* 3D Extruded Depth Walls */}
            <g>
              {parsedSlices.map((slice, i) => {
                const isHover = hoveredIdx === i;
                const ox = isHover ? slice.explodeX : 0;
                const oy = isHover ? slice.explodeY : 0;

                const p1 = getPt(slice.startAngle, rx, ry, ox, oy);
                const p2 = getPt(slice.endAngle, rx, ry, ox, oy);
                const p3 = getPt(slice.endAngle, rx, ry, ox, oy + depth);
                const p4 = getPt(slice.startAngle, rx, ry, ox, oy + depth);

                const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
                const wallPath = `M ${p1.x} ${p1.y} A ${rx} ${ry} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rx} ${ry} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;

                return (
                  <path
                    key={`wall-${i}`}
                    d={wallPath}
                    fill={slice.colors.dark}
                    stroke="#111111"
                    strokeWidth="0.5"
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </g>

            {/* 3D Top Slices */}
            <g>
              {parsedSlices.map((slice, i) => {
                const isHover = hoveredIdx === i;
                const ox = isHover ? slice.explodeX : 0;
                const oy = isHover ? slice.explodeY : 0;

                const p1 = getPt(slice.startAngle, rx, ry, ox, oy);
                const p2 = getPt(slice.endAngle, rx, ry, ox, oy);
                const center = { x: cx + ox, y: cy + oy };

                const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
                const topPath = `M ${center.x} ${center.y} L ${p1.x} ${p1.y} A ${rx} ${ry} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;

                return (
                  <path
                    key={`top-${i}`}
                    d={topPath}
                    fill={isHover ? '#FFFFFF' : slice.colors.top}
                    stroke={isHover ? '#F5C542' : '#6B3E00'}
                    strokeWidth={isHover ? 2 : 0.8}
                    className="cursor-pointer transition-all duration-300"
                    style={{
                      filter: isHover ? 'drop-shadow(0 0 12px rgba(245, 197, 66, 0.9))' : 'none',
                    }}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </g>
          </svg>
        </div>

        {/* Legend / Metrics List */}
        <div className="w-full sm:w-48 flex flex-col gap-2">
          {parsedSlices.map((slice, i) => {
            const isHover = hoveredIdx === i;
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isHover
                    ? 'bg-[#6B3E00]/40 border-[#F5C542] shadow-[0_0_12px_rgba(212,160,23,0.3)]'
                    : 'bg-[#111111]/70 border-[#D4A017]/20 hover:border-[#D4A017]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: slice.colors.top }}
                    />
                    <span className="font-medium text-xs text-[#FAF7F0] truncate max-w-[90px]">
                      {slice.label}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#F5C542]">{slice.pct}%</span>
                </div>
                <div className="flex justify-between items-center mt-1 text-[11px] font-mono text-[#D4A017]/80">
                  <span>{valuePrefix}{slice.value.toLocaleString()}{valueSuffix}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
