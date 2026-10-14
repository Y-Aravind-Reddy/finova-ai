import React, { useState } from 'react';
import { FinovaLogo } from './FinovaLogo';
import { RotateCcw, Shield, Wifi, Sparkles, Copy, Check } from 'lucide-react';

interface Customer3DCardProps {
  customerName?: string;
  cardNumberMasked?: string;
  expiryDate?: string;
  cardType?: string;
}

export const Customer3DCard: React.FC<Customer3DCardProps> = ({
  customerName = 'HARRISON CROFT',
  cardNumberMasked = '•••• •••• •••• 8849',
  expiryDate = '08/29',
  cardType = 'BLACK GOLD SOVEREIGN',
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText('4892-8849-0092-8849');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-md mx-auto select-none">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#F5C542] shadow-[0_0_8px_#F5C542]" />
          <span className="font-cinzel text-xs font-bold text-[#F5C542] uppercase tracking-wider">
            3D Sovereign Virtual Card
          </span>
        </div>
        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E1E1E] border border-[#D4A017]/40 text-[#F5C542] hover:bg-[#6B3E00]/40 text-[11px] font-mono transition-colors"
        >
          <RotateCcw size={12} className={isFlipped ? 'rotate-180 transition-transform' : ''} />
          <span>Flip to {isFlipped ? 'Front' : 'Back'}</span>
        </button>
      </div>

      {/* 3D Card Container with Flip Animation */}
      <div
        className="relative w-full aspect-[1.586/1] cursor-pointer group"
        style={{ perspective: '1200px' }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className="relative w-full h-full transition-transform duration-700 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* ========================================================
              FRONT SIDE
              ======================================================== */}
          <div
            className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between overflow-hidden border border-[#F5C542]/60 shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
            style={{
              backfaceVisibility: 'hidden',
              background:
                'linear-gradient(135deg, #1C150A 0%, #38240A 35%, #5E3A0B 70%, #1A1208 100%)',
            }}
          >
            {/* Metallic Gold Brushed Texture Overlays */}
            <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay bg-[radial-gradient(#F5C542_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-[#F5C542]/25 via-[#D4A017]/10 to-transparent rounded-full blur-2xl pointer-events-none" />

            {/* Specular Diagonal Reflection Sheen */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#FFF8E7]/10 to-transparent pointer-events-none" />

            {/* Top Row: Logo & Contactless */}
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-2">
                <FinovaLogo variant="compact" size="sm" showTagline={false} />
              </div>
              <div className="flex items-center gap-2 text-[#F5C542]">
                <Wifi size={18} className="rotate-90 opacity-80" />
                <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-[#111111]/70 border border-[#D4A017]/40 font-bold">
                  {cardType}
                </span>
              </div>
            </div>

            {/* Middle Row: Gold Smart Chip */}
            <div className="relative z-10 flex items-center justify-between my-auto">
              <div className="w-12 h-9 rounded-md bg-gradient-to-br from-[#FFF8E7] via-[#F5C542] to-[#B88209] border border-[#6B3E00] shadow-[0_2px_8px_rgba(0,0,0,0.6)] relative overflow-hidden flex flex-col justify-around p-1">
                <div className="w-full h-px bg-[#4A2C0A]/40" />
                <div className="w-full h-px bg-[#4A2C0A]/40" />
                <div className="absolute inset-y-0 left-1/3 w-px bg-[#4A2C0A]/40" />
                <div className="absolute inset-y-0 right-1/3 w-px bg-[#4A2C0A]/40" />
              </div>

              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-[#111111]/60 border border-[#D4A017]/30 text-[#D4A017] hover:text-[#FFF8E7] hover:bg-[#111111] transition-colors text-[10px] font-mono flex items-center gap-1"
                title="Copy card number"
              >
                {copied ? <Check size={12} className="text-[#C08A00]" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Bottom Row: Masked Number, Name, Expiry */}
            <div className="relative z-10 space-y-2">
              <div className="font-mono text-base sm:text-lg font-bold tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {cardNumberMasked}
              </div>

              <div className="flex items-end justify-between font-mono">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-[#D4A017]/70 block">
                    Cardholder
                  </span>
                  <span className="font-cinzel text-xs sm:text-sm font-bold text-[#FAF7F0] tracking-wider">
                    {customerName}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-wider text-[#D4A017]/70 block">
                    Valid Thru
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#F5C542]">
                    {expiryDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              BACK SIDE
              ======================================================== */}
          <div
            className="absolute inset-0 rounded-2xl flex flex-col justify-between overflow-hidden border border-[#D4A017]/50 shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background:
                'linear-gradient(135deg, #111111 0%, #24180A 50%, #150F06 100%)',
            }}
          >
            {/* Top Magnetic Strip */}
            <div className="w-full h-11 bg-[#0A0A0A] border-y border-[#301B05] mt-5 relative">
              <div className="absolute inset-y-0 inset-x-0 bg-gradient-to-r from-[#1E1E1E] via-[#0A0A0A] to-[#1E1E1E]" />
            </div>

            {/* Middle Section: Signature & Security Area */}
            <div className="px-6 space-y-2">
              <div className="flex items-center gap-3">
                {/* Signature Panel */}
                <div className="flex-1 h-9 bg-[#FFF8E7]/90 rounded-sm flex items-center px-3 border border-[#6B3E00]/40">
                  <span className="font-serif italic text-xs text-[#1E1E1E] select-none font-semibold">
                    {customerName}
                  </span>
                </div>

                {/* Strictly Hidden CVV Area */}
                <div className="px-3 py-1.5 rounded bg-[#111111] border border-[#D4A017]/40 text-center">
                  <span className="text-[8px] font-mono text-[#D4A017]/70 block uppercase">
                    CVV
                  </span>
                  <span className="font-mono text-xs font-bold text-[#F5C542]">
                    Hidden (***)
                  </span>
                </div>
              </div>

              {/* Security Attestation Note */}
              <p className="text-[8px] font-mono text-[#6B7280] leading-tight pt-1">
                Authorized signature required. This card is backed by private sovereign vault custody under Finova AI master charter. Lost/stolen hotline: +1 (800) 555-FINOVA.
              </p>
            </div>

            {/* Bottom Row */}
            <div className="px-6 pb-5 flex items-center justify-between">
              <FinovaLogo variant="compact" size="sm" showTagline={false} />
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#D4A017]">
                <Shield size={12} className="text-[#F5C542]" />
                <span>256-Bit Hardware Token</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
