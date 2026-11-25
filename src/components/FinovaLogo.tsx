import React, { useId } from 'react';

interface FinovaLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  theme?: 'dark' | 'cream' | 'gold';
  className?: string;
  showTagline?: boolean;
}

// Brand mark: gold shield with orbit, silver "F" and rising growth bars.
// Wordmark: geometric FINOVA with an AI spark in the "O", gold "AI".
// Standalone files live in public/brand/ (full logo, icon) and public/favicon.svg.

const ICON_HEIGHT = { sm: 'h-8', md: 'h-11', lg: 'h-16', xl: 'h-20', hero: 'h-28' };
const WORDMARK_HEIGHT = { sm: 'h-3.5', md: 'h-5', lg: 'h-7', xl: 'h-9', hero: 'h-10 md:h-14' };
const TAGLINE_SIZE = {
  sm: 'text-[8px] tracking-wide',
  md: 'text-[10px] tracking-wide',
  lg: 'text-xs tracking-wider',
  xl: 'text-sm tracking-wider',
  hero: 'text-sm md:text-base tracking-wider',
};

export const FinovaLogo: React.FC<FinovaLogoProps> = ({
  variant = 'full',
  size = 'md',
  theme = 'dark',
  className = '',
  showTagline = true,
}) => {
  // Unique gradient ids so several logos on one page don't clash
  const uid = useId().replace(/:/g, '');
  const gold = `fl-gold-${uid}`;
  const silver = `fl-silver-${uid}`;
  const white = `fl-white-${uid}`;
  const glow = `fl-glow-${uid}`;
  const onLight = theme === 'cream';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <svg
        viewBox="0 0 120 132"
        className={`${ICON_HEIGHT[size]} w-auto flex-shrink-0 drop-shadow-[0_4px_14px_rgba(212,160,23,0.35)]`}
        role="img"
        aria-label="Finova AI"
      >
        <defs>
          <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFE08A" />
            <stop offset="0.45" stopColor="#F5C542" />
            <stop offset="0.8" stopColor="#D4A017" />
            <stop offset="1" stopColor="#A86A12" />
          </linearGradient>
          <linearGradient id={silver} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.6" stopColor="#E9E9EC" />
            <stop offset="1" stopColor="#B9BAC0" />
          </linearGradient>
        </defs>
        <path d="M11.1 93.8 A60 15 -32 0 1 112.9 30.2" fill="none" stroke={`url(#${gold})`} strokeWidth="3" strokeLinecap="round" />
        <path
          d="M60 6 L106 23 V60 C106 93 86 113 60 126 C34 113 14 93 14 60 V23 Z"
          fill="#121212"
          stroke={`url(#${gold})`}
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path d="M35 33 H88 L80 47 H49 V100 L35 108 Z" fill={`url(#${silver})`} />
        <path d="M49 57 H74 L67 70 H49 Z" fill={`url(#${silver})`} />
        <rect x="56" y="88" width="7" height="17" rx="1.5" fill={`url(#${gold})`} />
        <rect x="66" y="80" width="7" height="22" rx="1.5" fill={`url(#${gold})`} />
        <rect x="76" y="71" width="7" height="27" rx="1.5" fill={`url(#${gold})`} />
        <path d="M11.1 93.8 A60 15 -32 0 0 112.9 30.2" fill="none" stroke={`url(#${gold})`} strokeWidth="3.5" strokeLinecap="round" />
      </svg>

      {variant !== 'icon' && (
        <div className="flex flex-col items-start justify-center gap-1">
          <svg viewBox="0 0 415 60" className={`${WORDMARK_HEIGHT[size]} w-auto self-start`} role="img" aria-label="FINOVA AI">
            <defs>
              <linearGradient id={white} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={onLight ? '#2A2A2A' : '#FFFFFF'} />
                <stop offset="1" stopColor={onLight ? '#121212' : '#DADBE0'} />
              </linearGradient>
              <radialGradient id={glow}>
                <stop offset="0" stopColor="#F5C542" stopOpacity="0.75" />
                <stop offset="1" stopColor="#F5C542" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g fill={`url(#${white})`}>
              <path d="M0 0 H42 V13 H14 V24 H36 V37 H14 V60 H0 Z" />
              <rect x="52" y="0" width="14" height="60" />
              <path d="M76 0 H90 L114 38 V0 H128 V60 H114 L90 22 V60 H76 Z" />
              <path fillRule="evenodd" d="M168 0 A30 30 0 1 1 167.99 0 Z M168 14 A16 16 0 1 0 168.01 14 Z" />
              <path d="M206 0 H221 L234 41 L247 0 H262 L241 60 H227 Z" />
              <path fillRule="evenodd" d="M284 0 H298 L319 60 H305 L300.5 47 H281.5 L277 60 H263 Z M291 20 L296.6 36 H285.4 Z" />
            </g>
            <circle cx="168" cy="30" r="15" fill={`url(#${glow})`} />
            <path
              d="M168 19 Q169.5 28.5 179 30 Q169.5 31.5 168 41 Q166.5 31.5 157 30 Q166.5 28.5 168 19 Z"
              fill={onLight ? '#B8860B' : '#F5C542'}
            />
            <g fill={onLight ? '#B8860B' : '#F5C542'}>
              <path fillRule="evenodd" d="M358 0 H372 L393 60 H379 L374.5 47 H355.5 L351 60 H337 Z M365 20 L370.6 36 H359.4 Z" />
              <rect x="401" y="0" width="14" height="60" />
            </g>
          </svg>

          {showTagline && variant === 'full' && (
            <p className={`font-medium ${TAGLINE_SIZE[size]} ${onLight ? 'text-[#4A2C0A]/80' : 'text-[#E6E6EA]/80'}`}>
              Smarter Finance. Faster Operations. Better Decisions.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FinovaLogo;
