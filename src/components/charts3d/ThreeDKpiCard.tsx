import React, { useState } from 'react';

interface ThreeDKpiCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  tag?: string;
  sparkline?: number[];
  variant?: 'cream' | 'dark' | 'gold-accent';
  onClick?: () => void;
}

export const ThreeDKpiCard: React.FC<ThreeDKpiCardProps> = ({
  title,
  value,
  subValue,
  change,
  trend = 'up',
  icon,
  tag,
  sparkline,
  variant = 'dark',
  onClick,
}) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -9;
    const rotateY = ((x - centerX) / centerX) * 9;
    setTilt({ x: rotateX, y: rotateY, active: true });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, active: false });
  };

  const isCream = variant === 'cream';

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        perspective: '900px',
      }}
      className="relative select-none group cursor-pointer"
    >
      <div
        style={{
          transform: tilt.active
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-4px)`
            : 'rotateX(0deg) rotateY(0deg) translateY(0px)',
          transition: tilt.active ? 'transform 0.08s ease-out' : 'transform 0.4s ease-out',
          transformStyle: 'preserve-3d',
        }}
        className={`relative rounded-2xl p-5 border transition-all duration-300 ${
          isCream
            ? 'bg-[#FFF8E7] border-[#D4A017]/40 shadow-[0_14px_30px_rgba(107,62,0,0.18)] hover:shadow-[0_20px_45px_rgba(212,160,23,0.3)]'
            : 'bg-[#1E1E1E]/95 border-[#D4A017]/30 shadow-[0_14px_35px_rgba(0,0,0,0.7)] hover:border-[#F5C542]/70 hover:shadow-[0_18px_45px_rgba(212,160,23,0.25)]'
        }`}
      >
        {/* Specular Light Flare Reflection Overlay */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, rgba(245, 197, 66, 0.18), transparent 70%)',
          }}
        />

        {/* 3D Top Bevel Edge Highlight */}
        <div className="absolute inset-x-3 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#F5C542] to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3" style={{ transform: 'translateZ(18px)' }}>
          <div className="flex-1">
            <span
              className={`font-mono text-xs font-semibold uppercase tracking-wider block ${
                isCream ? 'text-[#6B3E00]' : 'text-[#D4A017]'
              }`}
            >
              {title}
            </span>
            {tag && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#D4A017]/15 text-[#F5C542] border border-[#D4A017]/30">
                {tag}
              </span>
            )}
          </div>

          {/* 3D Metallic Emblem Badge */}
          <div
            style={{ transform: 'translateZ(26px)' }}
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 relative shadow-[0_6px_14px_rgba(0,0,0,0.4)] ${
              isCream
                ? 'bg-gradient-to-br from-[#F5C542] via-[#D4A017] to-[#6B3E00] text-[#111111]'
                : 'bg-gradient-to-br from-[#301B05] via-[#4A2C0A] to-[#1E1E1E] text-[#F5C542] border border-[#D4A017]/50'
            }`}
          >
            {/* Inner Ring Glow */}
            <div className="absolute inset-0 rounded-xl bg-[#F5C542]/10 pointer-events-none" />
            <div className="relative transform group-hover:scale-110 transition-transform duration-300 text-lg">
              {icon}
            </div>
          </div>
        </div>

        {/* 3D Value Layer */}
        <div className="mt-4" style={{ transform: 'translateZ(22px)' }}>
          <div className="flex items-baseline gap-2">
            <span
              className={`font-cinzel text-2xl sm:text-3xl font-black tracking-tight ${
                isCream
                  ? 'text-[#2A1804]'
                  : 'text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]'
              }`}
            >
              {value}
            </span>
            {subValue && (
              <span
                className={`text-xs font-mono font-medium ${
                  isCream ? 'text-[#6B3E00]/70' : 'text-[#6B7280]'
                }`}
              >
                {subValue}
              </span>
            )}
          </div>
        </div>

        {/* Trend / Bottom Bar */}
        {(change || sparkline) && (
          <div
            className="mt-3 pt-3 border-t flex items-center justify-between text-xs font-mono"
            style={{
              borderColor: isCream ? 'rgba(107, 62, 0, 0.15)' : 'rgba(212, 160, 23, 0.2)',
              transform: 'translateZ(14px)',
            }}
          >
            {change && (
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    trend === 'up'
                      ? 'bg-[#C08A00]/20 text-[#F5C542] border border-[#C08A00]/40'
                      : trend === 'down'
                      ? 'bg-[#B45309]/20 text-[#D97706] border border-[#B45309]/40'
                      : 'bg-[#6B3E00]/20 text-[#D4A017] border border-[#6B3E00]/30'
                  }`}
                >
                  {trend === 'up' ? '▲ ' : trend === 'down' ? '▼ ' : '• '}
                  {change}
                </span>
                <span
                  className={`text-[10px] ${isCream ? 'text-[#6B3E00]/70' : 'text-[#6B7280]'}`}
                >
                  vs last cycle
                </span>
              </div>
            )}

            {/* Micro 3D Gold Sparkline */}
            {sparkline && sparkline.length > 0 && (
              <div className="h-4 w-20 flex items-end gap-1">
                {sparkline.map((val, idx) => {
                  const maxSp = Math.max(...sparkline, 1);
                  const h = Math.max(3, (val / maxSp) * 16);
                  return (
                    <div
                      key={idx}
                      className="flex-1 rounded-t-sm transition-all duration-300"
                      style={{
                        height: `${h}px`,
                        background:
                          idx === sparkline.length - 1
                            ? '#FFF8E7'
                            : 'linear-gradient(180deg, #F5C542 0%, #6B3E00 100%)',
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
