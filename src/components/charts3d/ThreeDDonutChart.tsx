import React, { useState } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
  sideColor?: string;
  topColor?: string;
  subtext?: string;
}

interface ThreeDDonutChartProps {
  title?: string;
  subtitle?: string;
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
}

const LUXURY_GOLD_PALETTE = [
  { top: '#FFF8E7', side: '#D4A017', base: '#8A5400' },
  { top: '#F5C542', side: '#B88209', base: '#6B3E00' },
  { top: '#D4A017', side: '#945C05', base: '#4A2C0A' },
  { top: '#C08A00', side: '#734600', base: '#301B05' },
  { top: '#8A5400', side: '#502D00', base: '#1A0E02' },
];

export const ThreeDDonutChart: React.FC<ThreeDDonutChartProps> = ({
  title,
  subtitle,
  segments,
  centerLabel = 'Total Volume',
  centerValue,
  height = 320,
}) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // SVG Geometry for 3D Angled Ring
  const cx = 150;
  const cy = 110;
  const rx = 100; // horizontal radius
  const ry = 58;  // vertical radius for ~30 degree isometric pitch
  const depth = 28; // 3D extrusion thickness
  const innerRatio = 0.58;
  const irx = rx * innerRatio;
  const iry = ry * innerRatio;

  // Compute angles
  let currentAngle = -90; // start at 12 o'clock
  const slices = segments.map((seg, i) => {
    const angleSpan = (seg.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;
    currentAngle = endAngle;

    const palette = LUXURY_GOLD_PALETTE[i % LUXURY_GOLD_PALETTE.length];

    return {
      ...seg,
      index: i,
      startAngle,
      endAngle,
      angleSpan,
      pct: ((seg.value / total) * 100).toFixed(1),
      colors: palette,
    };
  });

  // Helper to convert polar to cartesian on ellipse
  const getEllipsePoint = (angleDeg: number, radX: number, radY: number, offsetY = 0) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radX * Math.cos(rad),
      y: cy + radY * Math.sin(rad) + offsetY,
    };
  };

  // Helper to create top face arc path
  const makeTopSlicePath = (startDeg: number, endDeg: number, isLifted = false) => {
    const liftY = isLifted ? -6 : 0;
    const p1 = getEllipsePoint(startDeg, rx, ry, liftY);
    const p2 = getEllipsePoint(endDeg, rx, ry, liftY);
    const p3 = getEllipsePoint(endDeg, irx, iry, liftY);
    const p4 = getEllipsePoint(startDeg, irx, iry, liftY);

    const largeArc = endDeg - startDeg > 180 ? 1 : 0;

    return `M ${p1.x} ${p1.y} A ${rx} ${ry} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${irx} ${iry} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
  };

  return (
    <div className="relative w-full rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#D4A017]/15">
        <div>
          {title && (
            <h3 className="font-cinzel text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D4A017] shadow-[0_0_8px_#D4A017]" />
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="font-mono text-xs text-[#D4A017]/70 mt-0.5">{subtitle}</p>
          )}
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-[#D4A017]/10 text-[#F5C542] border border-[#D4A017]/30">
          Isometric 3D
        </span>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mt-3">
        {/* 3D SVG Donut */}
        <div className="relative flex-1 flex justify-center items-center w-full min-w-[280px]" style={{ height: `${height - 70}px` }}>
          <svg viewBox="0 0 300 230" className="w-full h-full max-w-[340px] overflow-visible">
            <defs>
              {/* Floor Shadow Filter */}
              <radialGradient id="ringFloorShadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#000000" stopOpacity="0.4" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>

              {/* Shading Gradients for Side Extrusions */}
              {slices.map((slice, i) => (
                <linearGradient key={`sideGrad-${i}`} id={`sideGrad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={slice.colors.side} />
                  <stop offset="100%" stopColor={slice.colors.base} />
                </linearGradient>
              ))}
            </defs>

            {/* Base Contact Shadow */}
            <ellipse cx={cx} cy={cy + depth + 14} rx={rx + 12} ry={(ry + 12) * 0.8} fill="url(#ringFloorShadow)" />

            {/* 3D Lower Extruded Rim */}
            <g className="cursor-pointer">
              {slices.map((slice, i) => {
                const isHover = activeIdx === i;
                const p1 = getEllipsePoint(slice.startAngle, rx, ry);
                const p2 = getEllipsePoint(slice.endAngle, rx, ry);
                const p3 = getEllipsePoint(slice.endAngle, rx, ry, depth);
                const p4 = getEllipsePoint(slice.startAngle, rx, ry, depth);

                // Only draw outer wall if visible from front view (angles roughly between -10 and 190)
                const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
                const wallPath = `M ${p1.x} ${p1.y} A ${rx} ${ry} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rx} ${ry} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;

                return (
                  <path
                    key={`wall-${i}`}
                    d={wallPath}
                    fill={`url(#sideGrad-${i})`}
                    opacity={isHover ? 1 : 0.85}
                    stroke="#111111"
                    strokeWidth="0.5"
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseLeave={() => setActiveIdx(null)}
                  />
                );
              })}
            </g>

            {/* 3D Top Faces */}
            <g className="cursor-pointer">
              {slices.map((slice, i) => {
                const isHover = activeIdx === i;
                return (
                  <path
                    key={`top-${i}`}
                    d={makeTopSlicePath(slice.startAngle, slice.endAngle, isHover)}
                    fill={isHover ? '#FFFFFF' : slice.colors.top}
                    stroke={isHover ? '#F5C542' : '#6B3E00'}
                    strokeWidth={isHover ? 1.5 : 0.8}
                    className="transition-all duration-300"
                    style={{
                      filter: isHover ? 'drop-shadow(0 0 10px rgba(245, 197, 66, 0.9))' : 'none',
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseLeave={() => setActiveIdx(null)}
                  />
                );
              })}
            </g>

            {/* Central 3D Pedestal Readout */}
            <g transform={`translate(${cx}, ${cy})`}>
              <ellipse cx="0" cy="0" rx={irx - 4} ry={iry - 4} fill="#141414" stroke="#D4A017" strokeWidth="1.5" />
              <ellipse cx="0" cy="0" rx={irx - 10} ry={iry - 10} fill="#1E1E1E" stroke="#6B3E00" strokeWidth="0.5" />
            </g>
          </svg>

          {/* Central Overlay Typography */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-4">
            <span className="font-mono text-[10px] tracking-widest text-[#D4A017] uppercase">
              {activeIdx !== null ? slices[activeIdx].label : centerLabel}
            </span>
            <span className="font-cinzel text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
              {activeIdx !== null
                ? `${slices[activeIdx].pct}%`
                : centerValue || total.toLocaleString()}
            </span>
            {activeIdx !== null && (
              <span className="font-mono text-[11px] text-[#FAF7F0] mt-0.5">
                {slices[activeIdx].value.toLocaleString()} units
              </span>
            )}
          </div>
        </div>

        {/* Interactive Luxury Segment Legend */}
        <div className="w-full lg:w-48 flex flex-col gap-2">
          {slices.map((slice, i) => {
            const isHover = activeIdx === i;
            return (
              <div
                key={i}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                  isHover
                    ? 'bg-[#6B3E00]/40 border-[#F5C542] shadow-[0_0_12px_rgba(212,160,23,0.3)] translate-x-1'
                    : 'bg-[#111111]/70 border-[#D4A017]/20 hover:border-[#D4A017]/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border border-[#FFF8E7]/40"
                    style={{ backgroundColor: slice.colors.top }}
                  />
                  <div>
                    <p className="font-medium text-xs text-[#FAF7F0] leading-tight">{slice.label}</p>
                    {slice.subtext && (
                      <p className="text-[10px] text-[#6B7280]">{slice.subtext}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-[#F5C542]">{slice.pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
