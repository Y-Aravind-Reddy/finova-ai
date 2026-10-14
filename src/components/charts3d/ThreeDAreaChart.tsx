import React, { useState } from 'react';

interface AreaPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface ThreeDAreaChartProps {
  title?: string;
  subtitle?: string;
  data: AreaPoint[];
  height?: number;
  valuePrefix?: string;
  valueSuffix?: string;
}

export const ThreeDAreaChart: React.FC<ThreeDAreaChartProps> = ({
  title,
  subtitle,
  data,
  height = 240,
  valuePrefix = '',
  valueSuffix = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartHeight = height - 60;
  const chartWidth = 520;
  const paddingX = 20;

  // Compute points
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - (d.value / maxValue) * (chartHeight - 40);
    return { x, y, ...d, i };
  });

  const linePath = points.reduce(
    (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ''
  );

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  // 3D Extrusion projection offset
  const depthOffset = 12;
  const depthAreaPath = `${points.reduce(
    (acc, pt, i) => (i === 0 ? `M ${pt.x + depthOffset} ${pt.y - depthOffset}` : `${acc} L ${pt.x + depthOffset} ${pt.y - depthOffset}`),
    ''
  )} L ${points[points.length - 1].x + depthOffset} ${chartHeight - depthOffset} L ${points[0].x + depthOffset} ${chartHeight - depthOffset} Z`;

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
          3D Ribbon Surface
        </span>
      </div>

      {/* 3D SVG Canvas */}
      <div className="relative mt-4 w-full" style={{ height: `${height}px` }}>
        <svg
          viewBox={`0 0 ${chartWidth + 20} ${chartHeight + 30}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            {/* Front gold gradient */}
            <linearGradient id="areaFrontGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F5C542" stopOpacity="0.65" />
              <stop offset="60%" stopColor="#D4A017" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4A2C0A" stopOpacity="0.02" />
            </linearGradient>

            {/* Depth extruded gradient */}
            <linearGradient id="areaDepthGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6B3E00" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#1E1E1E" stopOpacity="0" />
            </linearGradient>

            <filter id="goldLineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#F5C542" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Isometric Depth Layer */}
          <path d={depthAreaPath} fill="url(#areaDepthGrad)" />

          {/* Front Area Fill */}
          <path d={areaPath} fill="url(#areaFrontGrad)" />

          {/* Main Gold Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#F5C542"
            strokeWidth="3"
            filter="url(#goldLineGlow)"
          />

          {/* Interactive Nodes */}
          {points.map((pt, i) => {
            const isHover = hoveredIdx === i;
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* 3D Node Pillar */}
                <line
                  x1={pt.x}
                  y1={pt.y}
                  x2={pt.x}
                  y2={chartHeight}
                  stroke="#D4A017"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity={isHover ? 0.9 : 0.25}
                />

                {/* Node Outer Ring */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHover ? 7 : 4}
                  fill="#111111"
                  stroke="#F5C542"
                  strokeWidth={isHover ? 3 : 2}
                  className="transition-all duration-200"
                />

                {/* Inner Specular Core */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHover ? 3 : 1.5}
                  fill="#FFF8E7"
                />

                {/* X-axis Label */}
                <text
                  x={pt.x}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fill={isHover ? '#F5C542' : '#D4A017'}
                  fontSize="11"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={isHover ? 'bold' : 'normal'}
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredIdx !== null && (
          <div
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 bg-[#111111] border border-[#F5C542] rounded-xl px-3 py-1.5 shadow-[0_8px_20px_rgba(212,160,23,0.4)] animate-in fade-in zoom-in-95"
            style={{
              left: `${(points[hoveredIdx].x / (chartWidth + 20)) * 100}%`,
              top: `${Math.max(10, points[hoveredIdx].y - 30)}px`,
            }}
          >
            <p className="font-cinzel text-xs font-bold text-[#F5C542]">
              {data[hoveredIdx].label}
            </p>
            <p className="font-mono text-sm font-semibold text-[#FFF8E7]">
              {valuePrefix}{data[hoveredIdx].value.toLocaleString()}{valueSuffix}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
