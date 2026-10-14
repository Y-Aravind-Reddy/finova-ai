import React from 'react';

interface ProgressRingItem {
  label: string;
  value: number; // 0 - 100
  displayValue?: string;
  color?: string;
  subtext?: string;
}

interface ThreeDProgressRingProps {
  title?: string;
  subtitle?: string;
  items: ProgressRingItem[];
  size?: number;
}

export const ThreeDProgressRing: React.FC<ThreeDProgressRingProps> = ({
  title,
  subtitle,
  items,
  size = 280,
}) => {
  const center = size / 2;
  const strokeWidth = 14;

  const GOLD_RING_COLORS = [
    { main: '#F5C542', glow: 'rgba(245, 197, 66, 0.45)', shadow: '#8A5400' },
    { main: '#D4A017', glow: 'rgba(212, 160, 23, 0.35)', shadow: '#6B3E00' },
    { main: '#C08A00', glow: 'rgba(192, 138, 0, 0.25)', shadow: '#4A2C0A' },
  ];

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
        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase bg-[#D4A017]/10 text-[#F5C542] border border-[#D4A017]/30">
          3D Orbital Rings
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-4">
        {/* SVG Orbital Rings */}
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
            <defs>
              <filter id="ring3dBevel">
                <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.8" />
              </filter>
            </defs>

            {items.map((item, idx) => {
              const radius = center - 22 - idx * (strokeWidth + 10);
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (Math.min(item.value, 100) / 100) * circumference;
              const colorInfo = GOLD_RING_COLORS[idx % GOLD_RING_COLORS.length];

              return (
                <g key={idx}>
                  {/* Background Track 3D Groove */}
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="#141414"
                    strokeWidth={strokeWidth}
                    strokeDasharray="4 2"
                    opacity="0.8"
                  />
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="#301B05"
                    strokeWidth={strokeWidth - 4}
                    opacity="0.6"
                  />

                  {/* Active 3D Gold Extruded Arc */}
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={colorInfo.main}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${center} ${center})`}
                    style={{
                      filter: `drop-shadow(0 0 8px ${colorInfo.glow})`,
                      transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />

                  {/* Front Highlight Specular Line */}
                  <circle
                    cx={center}
                    cy={center}
                    r={radius - 2}
                    fill="none"
                    stroke="#FFF8E7"
                    strokeWidth={2}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset + 2}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${center} ${center})`}
                    opacity="0.6"
                  />
                </g>
              );
            })}

            {/* Inner Core Dial Plate */}
            <circle cx={center} cy={center} r={center - 22 - items.length * (strokeWidth + 10) + 4} fill="#141414" stroke="#D4A017" strokeWidth="1" />
            <circle cx={center} cy={center} r={center - 22 - items.length * (strokeWidth + 10) - 2} fill="#1E1E1E" stroke="#6B3E00" strokeWidth="0.5" />
          </svg>

          {/* Core Central Readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="font-cinzel text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
              {items[0]?.displayValue || `${items[0]?.value}%`}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#D4A017]/80 max-w-[70px]">
              {items[0]?.label}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 flex-1 w-full">
          {items.map((item, idx) => {
            const colorInfo = GOLD_RING_COLORS[idx % GOLD_RING_COLORS.length];
            return (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-[#111111]/80 border border-[#D4A017]/25 flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-[#FFF8E7]/50 shadow-[0_0_8px_currentColor]"
                    style={{ backgroundColor: colorInfo.main, color: colorInfo.main }}
                  />
                  <div>
                    <p className="font-medium text-xs text-[#FAF7F0]">{item.label}</p>
                    {item.subtext && <p className="text-[10px] text-[#6B7280]">{item.subtext}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-[#F5C542]">
                    {item.displayValue || `${item.value}%`}
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
