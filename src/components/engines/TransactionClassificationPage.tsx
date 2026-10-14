import React, { useState } from 'react';
import {
  Tag,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Plus,
} from 'lucide-react';

interface ClassifiedTxn {
  id: string;
  rawText: string;
  merchant: string;
  amount: string;
  category: string;
  subCategory: string;
  isoCode: string;
  confidence: number;
  clearedBy: string;
  timestamp: string;
}

export const TransactionClassificationPage: React.FC = () => {
  const [inputText, setInputText] = useState(
    'SWIFT GPI Outgoing Wire to Geneva Private Bank for $450,000 USD via pacs.008'
  );
  const [isClassifying, setIsClassifying] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const [transactions, setTransactions] = useState<ClassifiedTxn[]>([
    {
      id: 'TXN-CLS-901',
      rawText: 'SWIFT GPI Outgoing Wire to Geneva Private Bank for $450,000 USD via pacs.008',
      merchant: 'Geneva Private Bank SA',
      amount: '$450,000.00 USD',
      category: 'Private Wealth Escrow',
      subCategory: 'Cross-Border Sovereign Settlement',
      isoCode: 'pacs.008.001.09',
      confidence: 99.4,
      clearedBy: 'Finova ML Classifier v5',
      timestamp: 'Today, 09:14:02 UTC',
    },
    {
      id: 'TXN-CLS-902',
      rawText: 'ACH CREDIT DIRECT DEPOSIT FEDNOW TREASURY REINVESTMENT COUPON $82,410',
      merchant: 'US Treasury Bureau of Public Debt',
      amount: '$82,410.00 USD',
      category: 'Treasury Yield',
      subCategory: 'Fixed Income Coupon Settlement',
      isoCode: 'camt.053.001.08',
      confidence: 99.8,
      clearedBy: 'Finova ML Classifier v5',
      timestamp: 'Today, 08:30:15 UTC',
    },
    {
      id: 'TXN-CLS-903',
      rawText: 'POS CARD AUTH HARRODS KNIGHTSBRIDGE LUXURY GOODS LONDON UK £18,400',
      merchant: 'Harrods Luxury Retail London',
      amount: '$23,450.00 USD (GBP Eq.)',
      category: 'HNW Card Spending',
      subCategory: 'High-Value Merchant Authorization',
      isoCode: 'pain.001.001.09',
      confidence: 98.7,
      clearedBy: 'Finova ML Classifier v5',
      timestamp: 'Yesterday, 17:44:20 UTC',
    },
    {
      id: 'TXN-CLS-904',
      rawText: 'SEPA INSTANT TRANSFER BERLIN SUSTAINABLE INFRASTRUCTURE BOND €120,000',
      merchant: 'Deutsche Bundesbank Clearing Relay',
      amount: '$131,400.00 USD (EUR Eq.)',
      category: 'Private Equity & Bonds',
      subCategory: 'Green Energy ESG Allocation',
      isoCode: 'pacs.002.001.10',
      confidence: 99.2,
      clearedBy: 'Finova ML Classifier v5',
      timestamp: 'Yesterday, 14:12:00 UTC',
    },
  ]);

  const handleClassifyNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isClassifying) return;

    setIsClassifying(true);
    setTimeout(() => {
      const newTxn: ClassifiedTxn = {
        id: `TXN-CLS-${Math.floor(910 + Math.random() * 900)}`,
        rawText: inputText,
        merchant: inputText.includes('Geneva')
          ? 'Geneva Custody Bank'
          : inputText.includes('Harrods')
          ? 'Harrods London'
          : 'Institutional Counterparty',
        amount: '$175,000.00 USD',
        category: 'Tier 3 Private Wealth Escrow',
        subCategory: 'Automated ML Ingestion',
        isoCode: 'pacs.008.001.09',
        confidence: 99.6,
        clearedBy: 'Finova ML Classifier v5',
        timestamp: 'Just now',
      };
      setTransactions([newTxn, ...transactions]);
      setIsClassifying(false);
    }, 800);
  };

  const filtered = transactions.filter((t) => {
    if (categoryFilter === 'ALL') return true;
    return t.category.toLowerCase().includes(categoryFilter.toLowerCase());
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Dedicated Platform Engine
            </span>
            <span className="text-xs text-[#D4A017] flex items-center gap-1">
              <Sparkles size={12} className="text-[#F5C542]" /> ISO 20022 Neural Categorizer
            </span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Transaction Classification
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            High-throughput deep learning categorization of institutional wire payloads, FedNow instant transfers, merchant MCC codes, and SWIFT GPI pacs messages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#141414] border border-[#D4A017]/30 text-right">
            <span className="text-[10px] text-[#6B7280] block">Average Accuracy</span>
            <span className="text-sm font-bold text-[#F5C542]">99.64%</span>
          </div>
        </div>
      </div>

      {/* Interactive Classification Tester */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <h3 className="text-sm font-bold text-[#F5C542] flex items-center gap-2 mb-2">
          <Cpu size={16} /> Real-Time Payload Classifier Sandbox
        </h3>
        <p className="text-[11px] text-[#6B7280] mb-4">
          Type or paste raw banking narrative, payment rail string, or remittance slip to simulate instant classification:
        </p>

        <form onSubmit={handleClassifyNew} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g. SWIFT WIRE TO BERLIN ESG BOND REINVESTMENT €500,000..."
            className="flex-1 bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-3 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
          />
          <button
            type="submit"
            disabled={isClassifying || !inputText.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold hover:brightness-110 shadow-[0_0_15px_rgba(212,160,23,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isClassifying ? (
              <span>Classifying...</span>
            ) : (
              <>
                <Tag size={14} /> <span>Classify Payload</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Classified Ledger Stream */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#D4A017]/20 gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2">
              <Layers size={16} className="text-[#F5C542]" /> Classified Transaction Stream
            </h3>
            <p className="text-[11px] text-[#6B7280]">
              Showing {filtered.length} ISO 20022 standardized records
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#6B7280]">Filter:</span>
            {['ALL', 'Escrow', 'Treasury', 'Card'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  categoryFilter === cat
                    ? 'bg-[#F5C542] text-[#111111]'
                    : 'bg-[#141414] text-[#D4A017] hover:bg-[#301B05]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 hover:border-[#F5C542]/50 transition-all space-y-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#301B05] text-[#F5C542] font-bold text-[10px] border border-[#D4A017]/30">
                    {item.id}
                  </span>
                  <span className="font-semibold text-[#FFF8E7]">{item.merchant}</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="text-sm font-bold text-[#F5C542]">{item.amount}</span>
                  <span className="text-[10px] bg-[#111111] px-2 py-0.5 rounded text-[#C08A00] border border-[#D4A017]/20">
                    {item.confidence}% Match
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#FAF7F0]/70 bg-[#111111] p-2 rounded-lg border border-[#301B05]">
                {item.rawText}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-[#6B7280]">
                <div className="flex items-center gap-3">
                  <span className="text-[#D4A017]">Category: {item.category}</span>
                  <span>• Sub: {item.subCategory}</span>
                  <span className="text-[#F5C542]">ISO Code: {item.isoCode}</span>
                </div>
                <span>{item.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
