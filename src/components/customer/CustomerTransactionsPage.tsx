import React, { useState } from 'react';
import { Search, Filter, Download, ArrowUpRight, ArrowDownLeft, Receipt, CheckCircle2 } from 'lucide-react';
import { CUSTOMER_DATASET } from '../../data/finovaDatasets';

export const CustomerTransactionsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const transactions = CUSTOMER_DATASET.transactions;

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      t.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || t.category.includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Custody Ledger
            </span>
            <span className="text-xs text-[#D4A017]">ISO 20022 Verified Telemetry</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Custody Transactions
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Itemized history of sovereign credit lines, bullion acquisitions, private equity drawdowns, and high-value wire transfers.
          </p>
        </div>

        <button
          onClick={() => alert('Exporting signed PDF statement...')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2"
        >
          <Download size={14} /> Download Statement (PDF)
        </button>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#D4A017]/20">
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-3 text-[#D4A017]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search merchant, reference..."
              className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl pl-9 pr-3 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {['ALL', 'Real Estate', 'Bonds', 'Luxury', 'Private Wealth'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  categoryFilter === cat
                    ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111]'
                    : 'bg-[#141414] text-[#D4A017]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#D4A017]/20 text-[10px] uppercase text-[#D4A017]">
                <th className="pb-3">Reference No</th>
                <th className="pb-3">Merchant / Counterparty</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Settled Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4A017]/10">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-[#141414]">
                  <td className="py-3 font-bold text-[#F5C542]">{t.referenceNo}</td>
                  <td className="py-3 font-semibold text-[#FFF8E7]">{t.merchant}</td>
                  <td className="py-3 text-[#D4A017]">{t.category}</td>
                  <td className="py-3 text-[#6B7280]">{t.date}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#141414] text-[#F5C542] border border-[#D4A017]/40">
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 text-right font-bold text-[#F5C542]">
                    ${t.amount.toLocaleString()} USD
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
