import React from 'react';
import { Wallet, ShieldCheck, DollarSign, ArrowUpRight, ArrowDownLeft, Building2 } from 'lucide-react';
import { CUSTOMER_DATASET } from '../../data/finovaDatasets';

export const CustomerAccountsPage: React.FC = () => {
  const profile = CUSTOMER_DATASET.profile;

  const accounts = [
    {
      id: 'FNV-ACC-USD-01',
      name: 'Sovereign Liquid Operating Vault (USD)',
      type: 'Primary Demand Deposit',
      balance: '$1,250,000.00 USD',
      iban: 'CH93 0070 0110 0008 8490 1',
      bic: 'FNVCHZZ1XXX',
      apy: '5.18% APY',
      clearing: 'FedNow / SWIFT Direct',
    },
    {
      id: 'FNV-ACC-CHF-02',
      name: 'Zurich Cantonal Escrow & Custody (CHF)',
      type: 'Sovereign Gold & Safe Haven Vault',
      balance: '₣2,480,000.00 CHF',
      iban: 'CH44 0070 0110 0008 8490 2',
      bic: 'FNVCHZZ1XXX',
      apy: '2.14% APY',
      clearing: 'Swiss SIC Instant',
    },
    {
      id: 'FNV-ACC-EUR-03',
      name: 'European Private Equity Settlement (EUR)',
      type: 'SEPA Multi-Currency Invoicing',
      balance: '€1,162,100.00 EUR',
      iban: 'FR76 3000 6000 0110 0008 8490 3',
      bic: 'FNVFR21XXX',
      apy: '3.85% APY',
      clearing: 'SEPA Instant Credit',
    },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Private Wealth Vaults
            </span>
            <span className="text-xs text-[#D4A017]">Relationship Manager: {profile.relationshipManager}</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Multi-Asset Accounts & Balances
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Global custody reserves, multi-currency IBANs, and Treasury yield accounts held under sovereign accredited custody.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Consolidated Net Worth</span>
          <span className="text-sm font-bold text-[#F5C542]">
            ${(profile.portfolioTotalValue / 1000000).toFixed(2)}M USD
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="p-5 rounded-2xl bg-[#1E1E1E] border border-[#D4A017]/35 shadow-lg space-y-3 flex flex-col justify-between"
          >
            <div>
              <span className="text-[10px] uppercase text-[#D4A017] font-bold block">{acc.type}</span>
              <h3 className="font-bold text-[#FFF8E7] text-sm mt-1">{acc.name}</h3>
              <p className="font-cinzel text-xl font-bold text-[#F5C542] mt-3">{acc.balance}</p>
            </div>

            <div className="pt-3 border-t border-[#D4A017]/20 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">IBAN:</span>
                <span className="text-[#FAF7F0] font-mono text-[10px]">{acc.iban}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">BIC / SWIFT:</span>
                <span className="text-[#FFF8E7]">{acc.bic}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Yield (APY):</span>
                <span className="text-[#C08A00] font-bold">{acc.apy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Rail:</span>
                <span className="text-[#D4A017]">{acc.clearing}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
