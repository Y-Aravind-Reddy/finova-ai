import React, { useState } from 'react';
import { FinovaLogo } from './FinovaLogo';
import { ThreeDKpiCard } from './charts3d/ThreeDKpiCard';
import { ThreeDColumnChart } from './charts3d/ThreeDColumnChart';
import { ThreeDDonutChart } from './charts3d/ThreeDDonutChart';
import { ThreeDProgressRing } from './charts3d/ThreeDProgressRing';
import {
  RotateCcw,
  Shield,
  Wifi,
  Sparkles,
  Copy,
  Check,
  CreditCard,
  Lock,
  Unlock,
  Sliders,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Clock,
  ChevronRight,
  Globe,
  Zap,
} from 'lucide-react';

export interface CardData {
  id: string;
  name: string;
  type: 'Virtual Debit Card' | 'Credit Card' | 'Account Linked Card';
  tierLabel: string;
  cardNumberMasked: string;
  expiryDate: string;
  cvvMasked: string; // strictly '***'
  cardholderName: string;
  limit: number;
  spent: number;
  status: 'Active' | 'Frozen';
  contactlessEnabled: boolean;
  onlineEnabled: boolean;
  internationalEnabled: boolean;
  themeGradient: string;
  accentColor: string;
}

interface CustomerCardsViewProps {
  customerName?: string;
}

export const CustomerCardsView: React.FC<CustomerCardsViewProps> = ({
  customerName = 'Harrison Croft',
}) => {
  const [cards, setCards] = useState<CardData[]>(() => {
    try {
      const raw = localStorage.getItem('finova_institutional_cards');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [freezeNotice, setFreezeNotice] = useState<string | null>(null);

  const currentCard = cards[selectedCardIndex] || cards[0];

  const handleCopyCard = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCard) return;
    navigator.clipboard?.writeText(currentCard.cardNumberMasked);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCardFreeze = () => {
    if (!currentCard) return;
    const newStatus: 'Active' | 'Frozen' = currentCard.status === 'Active' ? 'Frozen' : 'Active';
    const updated: CardData[] = cards.map((c, idx) => (idx === selectedCardIndex ? { ...c, status: newStatus } : c));
    setCards(updated);
    try {
      localStorage.setItem('finova_institutional_cards', JSON.stringify(updated));
    } catch {}
    setFreezeNotice(
      newStatus === 'Frozen'
        ? `Card ${currentCard.cardNumberMasked} has been instantly locked. Authorization attempts will be rejected.`
        : `Card ${currentCard.cardNumberMasked} is now active and ready for transactions.`
    );
    setTimeout(() => setFreezeNotice(null), 4000);
  };

  const toggleFeature = (feature: 'contactless' | 'online' | 'international') => {
    if (!currentCard) return;
    const updated = cards.map((c, idx) => {
      if (idx !== selectedCardIndex) return c;
      if (feature === 'contactless') return { ...c, contactlessEnabled: !c.contactlessEnabled };
      if (feature === 'online') return { ...c, onlineEnabled: !c.onlineEnabled };
      if (feature === 'international') return { ...c, internationalEnabled: !c.internationalEnabled };
      return c;
    });
    setCards(updated);
    try {
      localStorage.setItem('finova_institutional_cards', JSON.stringify(updated));
    } catch {}
  };

  const handleIssueInitialCard = () => {
    const newCard: CardData = {
      id: `CARD-VDEBIT-${Math.floor(1000 + Math.random() * 9000)}`,
      name: 'Sovereign Virtual Debit',
      type: 'Virtual Debit Card',
      tierLabel: 'BLACK GOLD DEBIT',
      cardNumberMasked: `•••• •••• •••• ${Math.floor(1000 + Math.random() * 9000)}`,
      expiryDate: '09/29',
      cvvMasked: '***',
      cardholderName: customerName.toUpperCase(),
      limit: 50000,
      spent: 0,
      status: 'Active',
      contactlessEnabled: true,
      onlineEnabled: true,
      internationalEnabled: true,
      themeGradient: 'linear-gradient(135deg, #1C150A 0%, #38240A 35%, #5E3A0B 70%, #1A1208 100%)',
      accentColor: '#F5C542',
    };
    const updated = [newCard];
    setCards(updated);
    try {
      localStorage.setItem('finova_institutional_cards', JSON.stringify(updated));
    } catch {}
  };

  // 3D Chart Data: Spending by Month for selected card
  const cardMonthlySpend = [
    { label: 'May', value: 8400, secondaryValue: 7200 },
    { label: 'Jun', value: 11200, secondaryValue: 9800 },
    { label: 'Jul', value: 14800, secondaryValue: 12400 },
    { label: 'Aug', value: 12900, secondaryValue: 11000 },
    { label: 'Sep', value: 16400, secondaryValue: 14200 },
    { label: 'Oct', value: 18900, secondaryValue: 16500, highlight: true },
  ];

  // Spending by Category
  const cardCategories = [
    { label: 'Private Aviation', value: 6800, subtext: '36% of monthly' },
    { label: 'Fine Arts & Auctions', value: 4200, subtext: '22% of monthly' },
    { label: 'Prime Hospitality', value: 3900, subtext: '21% of monthly' },
    { label: 'Security & Escrow', value: 2400, subtext: '13% of monthly' },
    { label: 'Concierge Services', value: 1600, subtext: '8% of monthly' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#F5C542]/50 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Sovereign Card Vault
            </span>
            <span className="text-xs font-mono text-[#D4A017]">Protected by 256-Bit HSM Key</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Private Wealth Cards & Spending Analytics
          </h1>
          <p className="font-mono text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Manage your Virtual Debit Card, Credit Card, and Account Linked Card with real-time biometric controls and 3D spending telemetry.
          </p>
        </div>

        {/* Card Selector Pills or Request Action */}
        {cards.length > 0 ? (
          <div className="flex items-center bg-[#111111] p-1.5 rounded-xl border border-[#D4A017]/30">
            {cards.map((c, index) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedCardIndex(index);
                  setIsFlipped(false);
                }}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${
                  selectedCardIndex === index
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold shadow-[0_0_12px_rgba(212,160,23,0.35)]'
                    : 'text-[#D4A017] hover:text-[#FFF8E7]'
                }`}
              >
                {c.type.replace(' Card', '')}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={handleIssueInitialCard}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg"
          >
            <Sparkles size={14} /> Request Virtual Debit Card
          </button>
        )}
      </div>

      {cards.length === 0 || !currentCard ? (
        <div className="rounded-2xl bg-[#1E1E1E]/80 border border-[#D4A017]/30 p-12 text-center space-y-4">
          <CreditCard size={48} className="mx-auto text-[#D4A017]/40" />
          <h3 className="font-cinzel text-lg font-bold text-[#FFF8E7]">No Institutional Cards Issued Yet</h3>
          <p className="text-xs text-[#9CA3AF] max-w-md mx-auto">
            No virtual debit or prime reserve credit cards have been linked to this account yet. Contact your relationship manager or private wealth desk to issue sovereign payment cards.
          </p>
          <button
            onClick={handleIssueInitialCard}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg inline-flex items-center gap-2"
          >
            <Sparkles size={14} /> Request Virtual Debit Card
          </button>
        </div>
      ) : (
        <>
      {freezeNotice && (
        <div className="p-3.5 rounded-xl bg-[#6B3E00]/40 border border-[#F5C542] text-[#FFF8E7] text-xs font-mono flex items-center justify-between shadow-[0_0_15px_rgba(212,160,23,0.25)]">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[#F5C542]" />
            <span>{freezeNotice}</span>
          </div>
          <button
            onClick={() => setFreezeNotice(null)}
            className="text-[#F5C542] hover:text-[#FFF8E7] text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 3D KPI Cards for the selected card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Monthly Card Spending"
          value={`$${currentCard.spent.toLocaleString()}`}
          subValue={`Limit: $${currentCard.limit.toLocaleString()}`}
          change={`${((currentCard.spent / currentCard.limit) * 100).toFixed(1)}% of limit`}
          trend="up"
          tag={currentCard.type}
          variant="gold-accent"
          icon={<DollarSign size={20} />}
          sparkline={[84, 112, 148, 129, 164, 189, 210]}
        />
        <ThreeDKpiCard
          title="Remaining Balance"
          value={`$${(currentCard.limit - currentCard.spent).toLocaleString()}`}
          subValue="Available Immediately"
          change="Real-time SWIFT"
          trend="up"
          tag="Liquid"
          icon={<CreditCard size={20} />}
          sparkline={[250, 240, 235, 230, 220, 210, 203]}
        />
        <ThreeDKpiCard
          title="Card Status"
          value={currentCard.status === 'Active' ? 'Active & Protected' : 'Instantly Frozen'}
          subValue={currentCard.status === 'Active' ? 'Zero fraud detected' : 'Declines all authorizations'}
          change="HSM Secured"
          trend={currentCard.status === 'Active' ? 'up' : 'down'}
          tag="256-Bit Key"
          icon={<Shield size={20} />}
          sparkline={[100, 100, 100, 100, 100, 100, 100]}
        />
        <ThreeDKpiCard
          title="Sovereign Rewards"
          value="48,920 pts"
          subValue="2.5x Multiplier on Aviation"
          change="+3,420 pts"
          trend="up"
          tag="Tier 3 Wealth"
          icon={<Sparkles size={20} />}
          sparkline={[38, 40, 42, 44, 46, 47, 48]}
        />
      </div>

      {/* Main Row: 3D Flippable Card + Controls & Limits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: 3D Flip Card Container */}
        <div className="lg:col-span-6 rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#D4A017]/20">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F5C542] shadow-[0_0_8px_#F5C542]" />
                <h3 className="font-cinzel text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
                  {currentCard.name}
                </h3>
              </div>

              {/* Flip Button */}
              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111111] border border-[#D4A017]/40 text-[#F5C542] hover:bg-[#6B3E00]/40 text-xs font-mono transition-colors shadow-sm"
              >
                <RotateCcw size={13} className={isFlipped ? 'rotate-180 transition-transform' : ''} />
                <span>Flip to {isFlipped ? 'Front' : 'Back'}</span>
              </button>
            </div>

            {/* 3D Card Interactive Component */}
            <div
              className="relative w-full aspect-[1.586/1] cursor-pointer max-w-lg mx-auto"
              style={{ perspective: '1400px' }}
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
                    FRONT SIDE:
                    Customer Name, Card Type, Masked Card Number, Expiry Date, Finova AI Logo
                    ======================================================== */}
                <div
                  className="absolute inset-0 rounded-2xl p-6 sm:p-7 flex flex-col justify-between overflow-hidden border border-[#F5C542]/60 shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
                  style={{
                    backfaceVisibility: 'hidden',
                    background: currentCard.themeGradient,
                  }}
                >
                  {/* Luxury Brushed Gold Radial Accent */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay bg-[radial-gradient(#F5C542_1px,transparent_1px)] [background-size:16px_16px]" />
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-[#F5C542]/25 via-[#D4A017]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#FFF8E7]/10 to-transparent pointer-events-none" />

                  {/* Top Row: Official Finova Logo & Card Type / Contactless */}
                  <div className="flex items-start justify-between relative z-10">
                    <FinovaLogo variant="compact" size="sm" showTagline={false} />
                    <div className="flex items-center gap-2.5 text-[#F5C542]">
                      <Wifi size={18} className="rotate-90 opacity-90" />
                      <span className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded bg-[#111111]/80 border border-[#D4A017]/40 font-bold text-[#F5C542]">
                        {currentCard.type}
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Gold Smart Chip & Copy Button */}
                  <div className="relative z-10 flex items-center justify-between my-auto">
                    <div className="w-12 h-9 rounded-md bg-gradient-to-br from-[#FFF8E7] via-[#F5C542] to-[#B88209] border border-[#6B3E00] shadow-[0_2px_8px_rgba(0,0,0,0.6)] relative overflow-hidden flex flex-col justify-around p-1">
                      <div className="w-full h-px bg-[#4A2C0A]/40" />
                      <div className="w-full h-px bg-[#4A2C0A]/40" />
                      <div className="absolute inset-y-0 left-1/3 w-px bg-[#4A2C0A]/40" />
                      <div className="absolute inset-y-0 right-1/3 w-px bg-[#4A2C0A]/40" />
                    </div>

                    <button
                      onClick={handleCopyCard}
                      className="p-1.5 px-2.5 rounded-lg bg-[#111111]/70 border border-[#D4A017]/40 text-[#D4A017] hover:text-[#FFF8E7] hover:bg-[#111111] transition-colors text-[10px] font-mono flex items-center gap-1.5"
                      title="Copy Card Number"
                    >
                      {copied ? <Check size={12} className="text-[#C08A00]" /> : <Copy size={12} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* Bottom Row: Masked Card Number, Customer Name, Expiry Date */}
                  <div className="relative z-10 space-y-2">
                    <div className="font-mono text-lg sm:text-xl font-bold tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {currentCard.cardNumberMasked}
                    </div>

                    <div className="flex items-end justify-between font-mono">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-[#D4A017]/80 block">
                          Customer Name
                        </span>
                        <span className="font-cinzel text-xs sm:text-sm font-bold text-[#FAF7F0] tracking-wider">
                          {currentCard.cardholderName}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider text-[#D4A017]/80 block">
                          Expiry Date
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-[#F5C542]">
                          {currentCard.expiryDate}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========================================================
                    BACK SIDE:
                    Magnetic Strip, Signature Area, Security Area, CVV (***)
                    ======================================================== */}
                <div
                  className="absolute inset-0 rounded-2xl flex flex-col justify-between overflow-hidden border border-[#D4A017]/50 shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: 'linear-gradient(135deg, #0F0F0F 0%, #22170A 50%, #150F06 100%)',
                  }}
                >
                  {/* Top Magnetic Strip */}
                  <div className="w-full h-12 bg-[#080808] border-y border-[#301B05] mt-5 relative">
                    <div className="absolute inset-y-0 inset-x-0 bg-gradient-to-r from-[#181818] via-[#0A0A0A] to-[#181818]" />
                  </div>

                  {/* Middle Section: Signature Area & Security Area with CVV *** */}
                  <div className="px-6 space-y-2.5">
                    <div className="flex items-center gap-3">
                      {/* Signature Area */}
                      <div className="flex-1 h-10 bg-[#FFF8E7]/90 rounded-sm flex items-center px-3 border border-[#6B3E00]/40">
                        <span className="font-serif italic text-xs text-[#1E1E1E] select-none font-bold">
                          {currentCard.cardholderName}
                        </span>
                      </div>

                      {/* Security Area / Masked CVV (Strictly Display as ***) */}
                      <div className="px-3.5 py-1.5 rounded-lg bg-[#111111] border border-[#D4A017]/50 text-center">
                        <span className="text-[8px] font-mono text-[#D4A017]/80 block uppercase font-bold">
                          CVV
                        </span>
                        <span className="font-mono text-sm font-extrabold text-[#F5C542] tracking-widest">
                          {currentCard.cvvMasked}
                        </span>
                      </div>
                    </div>

                    {/* Security Area Note */}
                    <div className="p-2 rounded bg-[#141414] border border-[#D4A017]/20">
                      <p className="text-[8px] font-mono text-[#D4A017]/80 leading-relaxed">
                        <strong>Security Area:</strong> CVV is cryptographically masked (***) to protect private wealth credentials. Valid only with authorized biometric token. Finova Sentinel 24/7 fraud monitoring active.
                      </p>
                    </div>
                  </div>

                  {/* Bottom Row */}
                  <div className="px-6 pb-5 flex items-center justify-between">
                    <FinovaLogo variant="compact" size="sm" showTagline={false} />
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#D4A017]">
                      <Shield size={13} className="text-[#F5C542]" />
                      <span>256-Bit Hardware Token</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Helper text */}
          <div className="mt-4 pt-3 border-t border-[#D4A017]/15 flex items-center justify-between text-[11px] font-mono text-[#D4A017]/80">
            <span>Click card or use button to flip</span>
            <span className="text-[#C08A00] font-bold">CVV Masked (***)</span>
          </div>
        </div>

        {/* Right Column: Card Usage Controls & Limits */}
        <div className="lg:col-span-6 rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#D4A017]/20">
              <h3 className="font-cinzel text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] flex items-center gap-2">
                <Sliders size={16} className="text-[#F5C542]" />
                Card Management & Controls
              </h3>
              <button
                onClick={toggleCardFreeze}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                  currentCard.status === 'Active'
                    ? 'bg-[#111111] border border-[#B45309] text-[#D97706] hover:bg-[#B45309]/30'
                    : 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] shadow-[0_0_12px_rgba(212,160,23,0.3)]'
                }`}
              >
                {currentCard.status === 'Active' ? (
                  <>
                    <Lock size={13} /> Freeze Card
                  </>
                ) : (
                  <>
                    <Unlock size={13} /> Unfreeze Card
                  </>
                )}
              </button>
            </div>

            {/* Toggle Features List */}
            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-[#141414] border border-[#D4A017]/25 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#301B05] border border-[#D4A017]/30 flex items-center justify-center text-[#F5C542]">
                    <Wifi size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-[#FFF8E7]">Contactless (NFC) Payments</p>
                    <p className="text-[10px] text-[#6B7280]">Point-of-sale tap transactions</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleFeature('contactless')}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    currentCard.contactlessEnabled ? 'bg-[#D4A017]' : 'bg-[#333333]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-[#111111] transition-transform ${
                      currentCard.contactlessEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-[#D4A017]/25 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#301B05] border border-[#D4A017]/30 flex items-center justify-center text-[#F5C542]">
                    <Zap size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-[#FFF8E7]">Online & In-App Purchases</p>
                    <p className="text-[10px] text-[#6B7280]">E-commerce and cloud services</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleFeature('online')}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    currentCard.onlineEnabled ? 'bg-[#D4A017]' : 'bg-[#333333]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-[#111111] transition-transform ${
                      currentCard.onlineEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-[#D4A017]/25 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#301B05] border border-[#D4A017]/30 flex items-center justify-center text-[#F5C542]">
                    <Globe size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-[#FFF8E7]">International Wire & POS</p>
                    <p className="text-[10px] text-[#6B7280]">Overseas multi-currency processing</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleFeature('international')}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    currentCard.internationalEnabled ? 'bg-[#D4A017]' : 'bg-[#333333]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-[#111111] transition-transform ${
                      currentCard.internationalEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Spend Limit Gauge */}
          <div className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/30 font-mono text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#D4A017]">Credit / Spending Limit Utilization</span>
              <span className="font-bold text-[#F5C542]">
                ${currentCard.spent.toLocaleString()} / ${currentCard.limit.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#111111] border border-[#D4A017]/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, (currentCard.spent / currentCard.limit) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-[#6B7280] mt-1.5 flex items-center justify-between">
              <span>Auto-resets on the 1st of every month</span>
              <span className="text-[#C08A00] font-bold">Optimal Tier 3</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3D Visualizations: Card Usage Analytics & Spending Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDColumnChart
          title="3D Card Usage Analytics ($k USD)"
          subtitle="Monthly Invoiced Settlement Volume vs Historical Average"
          data={cardMonthlySpend}
          height={280}
          valuePrefix="$"
          valueSuffix="k"
          dualSeries={true}
          primaryLabel="Actual Spend"
          secondaryLabel="Budget Benchmark"
        />

        <ThreeDDonutChart
          title="3D Spending Overview"
          subtitle="Categorical Allocation for Selected Sovereign Card"
          segments={cardCategories}
          centerLabel="Monthly Spend"
          centerValue={`$${(currentCard.spent / 1000).toFixed(1)}k`}
          height={320}
        />
      </div>
      </>
      )}
    </div>
  );
};
