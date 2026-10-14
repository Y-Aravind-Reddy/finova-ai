import React from 'react';

interface FinovaLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  theme?: 'dark' | 'cream' | 'gold';
  className?: string;
  showTagline?: boolean;
}

export const FinovaLogo: React.FC<FinovaLogoProps> = ({
  variant = 'full',
  size = 'md',
  theme = 'dark',
  className = '',
  showTagline = true,
}) => {
  // Sizing dimensions
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
    hero: 'w-28 h-28',
  };

  const titleSizes = {
    sm: 'text-sm font-bold tracking-wider',
    md: 'text-lg font-bold tracking-widest',
    lg: 'text-2xl font-extrabold tracking-widest',
    xl: 'text-3xl font-extrabold tracking-widest',
    hero: 'text-4xl md:text-5xl font-black tracking-widest',
  };

  const taglineSizes = {
    sm: 'text-[9px] tracking-widest',
    md: 'text-[11px] tracking-[0.2em]',
    lg: 'text-xs tracking-[0.25em]',
    xl: 'text-sm tracking-[0.3em]',
    hero: 'text-base tracking-[0.35em]',
  };

  return (
    <div className={`inline-flex items-center gap-3.5 select-none ${className}`}>
      {/* 3D Golden Premium Logo Emblem */}
      <div className={`relative ${iconSizes[size]} flex-shrink-0 group`}>
        {/* Ambient Gold Halo Glow */}
        <div className="absolute -inset-1.5 bg-gradient-to-tr from-[#6B3E00] via-[#D4A017] to-[#F5C542] rounded-2xl opacity-60 blur-md group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Main Emblem SVG */}
        <svg
          viewBox="0 0 100 100"
          className="relative w-full h-full drop-shadow-[0_8px_16px_rgba(107,62,0,0.6)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Luxury Gold Gradients */}
            <linearGradient id="goldShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF8E7" />
              <stop offset="25%" stopColor="#F5C542" />
              <stop offset="60%" stopColor="#D4A017" />
              <stop offset="85%" stopColor="#6B3E00" />
              <stop offset="100%" stopColor="#4A2C0A" />
            </linearGradient>

            <linearGradient id="goldBevelGrad" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F5C542" />
              <stop offset="45%" stopColor="#D4A017" />
              <stop offset="80%" stopColor="#4A2C0A" />
              <stop offset="100%" stopColor="#111111" />
            </linearGradient>

            <linearGradient id="innerCrownGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF8E7" />
              <stop offset="50%" stopColor="#F5C542" />
              <stop offset="100%" stopColor="#6B3E00" />
            </linearGradient>

            <linearGradient id="goldCoreGlow" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#F5C542" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#D4A017" stopOpacity="0.2" />
            </linearGradient>

            <radialGradient id="centerGemLight" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#FFF8E7" />
              <stop offset="50%" stopColor="#F5C542" />
              <stop offset="85%" stopColor="#D4A017" />
              <stop offset="100%" stopColor="#4A2C0A" />
            </radialGradient>

            <filter id="goldEmboss" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodColor="#111111" floodOpacity="0.8" />
              <feDropShadow dx="-1" dy="-1" stdDeviation="1" floodColor="#FFF8E7" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Outer Octagonal / Shield Beveled Plate */}
          <polygon
            points="50,4 88,20 96,62 72,92 50,98 28,92 4,62 12,20"
            fill="#161616"
            stroke="url(#goldShieldGrad)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Secondary Inset Facet */}
          <polygon
            points="50,11 81,25 88,59 68,85 50,90 32,85 12,59 19,25"
            fill="#1E1E1E"
            stroke="url(#goldBevelGrad)"
            strokeWidth="1.8"
            strokeLinejoin="round"
            opacity="0.9"
          />

          {/* Radial Sheen in Backing */}
          <circle cx="50" cy="50" r="32" fill="url(#centerGemLight)" opacity="0.12" />

          {/* 3D Interlocking "F" & Diamond Apex Finova Geometry */}
          {/* Top Diamond Crown / Apex */}
          <polygon
            points="50,16 66,28 50,38 34,28"
            fill="url(#innerCrownGrad)"
            stroke="#FFF8E7"
            strokeWidth="0.8"
            filter="url(#goldEmboss)"
          />

          {/* Central Monogram Finova "F" Primary Pillar */}
          <path
            d="M36,28 L46,28 L46,74 L36,74 Z"
            fill="url(#goldShieldGrad)"
            stroke="#F5C542"
            strokeWidth="0.8"
          />

          {/* Upper Wing of "F" */}
          <polygon
            points="46,31 74,31 66,41 46,41"
            fill="url(#goldShieldGrad)"
            stroke="#FFF8E7"
            strokeWidth="0.6"
          />

          {/* Middle Neural Bridge of "F" */}
          <polygon
            points="46,47 66,47 60,56 46,56"
            fill="url(#innerCrownGrad)"
            stroke="#F5C542"
            strokeWidth="0.6"
          />

          {/* Dynamic 3D Chevron Accents (Intelligence Rays) */}
          <polygon
            points="50,60 62,69 50,78 44,73 53,69 44,65"
            fill="url(#goldShieldGrad)"
            stroke="#D4A017"
            strokeWidth="0.5"
          />

          {/* Bottom Precision Diamond Pivot */}
          <polygon
            points="50,81 56,86 50,91 44,86"
            fill="#FFF8E7"
            stroke="#D4A017"
            strokeWidth="0.5"
          />

          {/* Specular Light Flare */}
          <circle cx="50" cy="22" r="2.2" fill="#FFFFFF" />
          <circle cx="48" cy="33" r="1.5" fill="#FFFFFF" opacity="0.8" />
        </svg>
      </div>

      {/* Brand Typography */}
      {variant !== 'icon' && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-cinzel ${titleSizes[size]} ${
                theme === 'cream'
                  ? 'text-[#4A2C0A]'
                  : 'text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]'
              }`}
            >
              FINOVA
            </span>
            <span
              className={`font-mono text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded border ${
                theme === 'cream'
                  ? 'bg-[#6B3E00] text-[#FFF8E7] border-[#4A2C0A]'
                  : 'bg-[#D4A017]/15 text-[#F5C542] border-[#D4A017]/40 shadow-[0_0_10px_rgba(212,160,23,0.3)]'
              }`}
            >
              AI
            </span>
          </div>

          {showTagline && variant === 'full' && (
            <p
              className={`font-mono uppercase ${taglineSizes[size]} mt-0.5 ${
                theme === 'cream' ? 'text-[#6B3E00]/80' : 'text-[#D4A017]/80'
              }`}
            >
              Data. Intelligence. Better Decisions.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
