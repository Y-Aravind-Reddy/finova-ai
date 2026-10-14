import React, { useState } from 'react';

interface HeatmapCell {
  hour: string;
  day: string;
  riskScore: number; // 0 - 100
  txCount: number;
  flaggedCount: number;
  volume: number;
}

interface ThreeDTransactionHeatmapProps {
  title?: string;
  subtitle?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_BLOCKS = ['00-04h', '04-08h', '08-12h', '12-16h', '16-20h', '20-24h'];

// Generate authentic patterned heat data for financial volume & risk
const GENERATED_HEATMAP_DATA: HeatmapCell[] = [];
DAYS.forEach((day, dayIdx) => {
  TIME_BLOCKS.forEach((hour, hourIdx) => {
    // Weekday trading hours have high volume, late nights have anomalous risk spikes
    const isPeakMarket = (hourIdx === 2 || hourIdx === 3) && dayIdx < 5;
    const isOffshoreNight = (hourIdx === 0 || hourIdx === 5);
    const riskScore = isOffshoreNight ? Math.floor(65 + Math.random() * 32) : Math.floor(8 + Math.random() * 25);
    const txCount = isPeakMarket ? Math.floor(4500 + Math.random() * 3000) : Math.floor(350 + Math.random() * 900);
    const flaggedCount = riskScore > 75 ? Math.floor(6 + Math.random() * 14) : Math.floor(Math.random() * 3);
    const volume = Math.floor(txCount * (12000 + Math.random() * 24000));

    GENERATED_HEATMAP_DATA.push({
      day,
      hour,
      riskScore,
      txCount,
      flaggedCount,
      volume,
    });
  });
});

export const ThreeDTransactionHeatmap: React.FC<ThreeDTransactionHeatmapProps> = ({
  title = '3D Real-Time Transaction & AML Threat Heatmap',
  subtitle = 'Institutional Liquidity Flow vs Anomaly Frequency Matrix',
}) => {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const getHeatColors = (risk: number) => {
    if (risk > 75) {
      // Danger / High Threat in strict gold/bronze palette (#B45309 danger amber)
      return {
        bg: '#B45309',
        border: '#F5C542',
        height: '24px',
        glow: 'rgba(180, 83, 9, 0.7)',
        level: 'Critical Anomaly',
      };
    }
    if (risk > 45) {
      // Warning in strict palette (#D97706)
      return {
        bg: '#D97706',
        border: '#F5C542',
        height: '18px',
        glow: 'rgba(217, 119, 6, 0.5)',
        level: 'Elevated Risk',
      };
    }
    if (risk > 20) {
      // Normal gold / bronze (#D4A017)
      return {
        bg: '#D4A017',
        border: '#FFF8E7',
        height: '12px',
        glow: 'rgba(212, 160, 23, 0.3)',
        level: 'Standard Liquidity',
      };
    }
    // Deep bronze nominal (#6B3E00)
    return {
      bg: '#6B3E00',
      border: '#D4A017',
      height: '8px',
      glow: 'none',
      level: 'Nominal Cleared',
    };
  };

  return (
    <div className="relative w-full rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#D4A017]/15 gap-2">
        <div>
          <h3 className="font-cinzel text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4A017] shadow-[0_0_8px_#D4A017]" />
            {title}
          </h3>
          <p className="font-mono text-xs text-[#D4A017]/70 mt-0.5">{subtitle}</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="text-[#6B7280]">Risk Elevation:</span>
          <span className="flex items-center gap-1 text-[#D4A017]">
            <span className="w-2 h-2 rounded-sm bg-[#6B3E00]" />
            Nominal
          </span>
          <span className="flex items-center gap-1 text-[#F5C542]">
            <span className="w-2 h-2 rounded-sm bg-[#D4A017]" />
            Moderate
          </span>
          <span className="flex items-center gap-1 text-[#D97706]">
            <span className="w-2 h-2 rounded-sm bg-[#D97706]" />
            Warning
          </span>
          <span className="flex items-center gap-1 text-[#B45309]">
            <span className="w-2 h-2 rounded-sm bg-[#B45309]" />
            Critical Threat
          </span>
        </div>
      </div>

      {/* 3D Isometric Tile Grid */}
      <div className="mt-4 overflow-x-auto pb-2">
        <div className="min-w-[560px]">
          {/* Time Block Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2 font-mono text-xs text-center text-[#D4A017]/80">
            <div className="text-left pl-2">Day \ Time</div>
            {TIME_BLOCKS.map((t, idx) => (
              <div key={idx} className="font-semibold">{t}</div>
            ))}
          </div>

          {/* Rows */}
          {DAYS.map((day) => {
            const dayCells = GENERATED_HEATMAP_DATA.filter((c) => c.day === day);
            return (
              <div key={day} className="grid grid-cols-7 gap-2 mb-2 items-center">
                <div className="font-mono text-xs font-bold text-[#FFF8E7] pl-2">
                  {day}
                </div>
                {dayCells.map((cell, idx) => {
                  const style = getHeatColors(cell.riskScore);
                  const isHovered =
                    hoveredCell?.day === cell.day && hoveredCell?.hour === cell.hour;

                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                      className="relative h-11 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center group"
                      style={{
                        perspective: '400px',
                      }}
                    >
                      {/* 3D Extruded Tile Block */}
                      <div
                        className="w-full h-full rounded-lg transition-transform duration-200 border flex flex-col items-center justify-center relative"
                        style={{
                          backgroundColor: cell.riskScore > 75 ? '#8A3204' : cell.riskScore > 45 ? '#6B3E00' : '#1E1E1E',
                          borderColor: style.border,
                          transform: isHovered ? 'translateY(-4px) scale(1.05)' : 'translateY(0)',
                          boxShadow: isHovered
                            ? `0 8px 16px ${style.glow}, 0 0 12px #F5C542`
                            : '0 2px 6px rgba(0,0,0,0.6)',
                        }}
                      >
                        {/* 3D Top Cap */}
                        <div
                          className="absolute inset-x-1 top-1 h-1.5 rounded-sm opacity-80"
                          style={{ backgroundColor: style.bg }}
                        />
                        <span className="font-mono text-[11px] font-bold text-[#FAF7F0] mt-1">
                          {cell.riskScore}
                        </span>
                        <span className="text-[9px] font-mono text-[#D4A017]/70">
                          {cell.txCount} tx
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover Inspection Drawer */}
      {hoveredCell && (
        <div className="mt-3 p-3 rounded-xl bg-[#111111] border border-[#F5C542] flex flex-wrap items-center justify-between gap-4 text-xs font-mono shadow-[0_6px_20px_rgba(212,160,23,0.3)] animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-[#D4A017]/20 text-[#F5C542] font-bold">
              {hoveredCell.day} {hoveredCell.hour}
            </span>
            <span className="text-[#FFF8E7]">
              Risk Score: <strong className="text-[#F5C542]">{hoveredCell.riskScore} / 100</strong>
            </span>
            <span className="text-[#6B7280]">
              Classification: <span className="text-[#FFF8E7]">{getHeatColors(hoveredCell.riskScore).level}</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#D4A017]">
              Volume: ${(hoveredCell.volume / 1000000).toFixed(2)}M USD
            </span>
            <span className="text-[#FFF8E7]">
              Transactions: {hoveredCell.txCount.toLocaleString()}
            </span>
            {hoveredCell.flaggedCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-[#B45309]/30 text-[#D97706] font-bold border border-[#B45309]">
                ⚠ {hoveredCell.flaggedCount} Suspicious Cases Flagged
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
