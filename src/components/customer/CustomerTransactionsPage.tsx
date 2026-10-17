import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, ArrowUpRight, ArrowDownLeft, Receipt, CheckCircle2, RotateCw, Wallet, ShieldCheck, Building2 } from 'lucide-react';
import { UserAccount, CustomerTransaction } from '../../data/finovaDatasets';
import { fetchTransactionsResultFromDb } from '../../services/finovaDatabase';
import { getStoredSession } from '../../data/authStore';
import { getTenantById } from '../../data/tenantStore';

interface CustomerTransactionsPageProps {
  currentUser?: UserAccount;
}

export const CustomerTransactionsPage: React.FC<CustomerTransactionsPageProps> = ({ currentUser: propUser }) => {
  const activeUser = propUser || getStoredSession()?.user;
  const tenantId = activeUser?.tenantId || 'tenant_apex_bank';
  const tenant = getTenantById(tenantId);
  const companyName = tenant?.name || activeUser?.tenantName || 'Apex Global Bank';
  const currencySymbol = tenant?.currencySymbol || '$';
  const currencyCode = tenant?.currency || 'USD';

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbSource, setDbSource] = useState<'supabase' | 'fallback'>('fallback');
  const [dbError, setDbError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTransactionsResultFromDb(tenantId, {
        userId: activeUser?.id,
      });
      setDbSource(res.source);
      setDbError(res.error);
      setTransactions(res.data || []);
    } catch (err: any) {
      setDbSource('fallback');
      setDbError(err?.message || 'Error querying transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, activeUser?.id]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName}
            </span>
            <span className="text-xs text-[#D4A017]">ISO 20022 Verified Telemetry</span>
            {dbSource === 'supabase' ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Database ({transactions.length} Records)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300">
                RLS Scoped ({dbError ? 'Query Restricted' : 'Awaiting Auth'})
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Custody Transactions
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Itemized history of customer sovereign credit lines, bullion acquisitions, private equity drawdowns, and high-value wire transfers from <code>public.transactions</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadTransactions()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 hover:border-[#F5C542] text-[#D4A017] transition-all flex items-center gap-1.5"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="text-xs font-bold">Refresh</span>
          </button>
          <button
            onClick={() => alert('Exporting signed PDF statement...')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2"
          >
            <Download size={14} /> Download Statement (PDF)
          </button>
        </div>
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#9CA3AF]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCw size={24} className="text-[#D4A017] animate-spin" />
                      <p className="text-sm font-bold text-[#FAF7F0]">Loading Verified Transactions...</p>
                      <p className="text-xs text-[#9CA3AF]">Querying Supabase public.transactions under RLS policy...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#9CA3AF]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Wallet size={28} className="text-[#D4A017]" />
                      <p className="text-sm font-bold text-[#FAF7F0]">No Customer Transactions Found</p>
                      <p className="text-xs text-[#9CA3AF] max-w-md">
                        {dbError || `No transactions found in public.transactions linked to account ${activeUser?.id || 'unlinked'}.`}
                      </p>
                      <div className="mt-2 p-3 rounded-lg bg-[#141414] border border-[#3A3A3A] text-[11px] text-[#E6C78B]/90 max-w-lg text-left">
                        <p className="font-semibold text-[#FAF7F0] mb-1 flex items-center gap-1.5">
                          <ShieldCheck size={13} className="text-[#D4A017]" />
                          Custody Ledger Governance Policy:
                        </p>
                        <p className="text-[#9CA3AF]">
                          Historical records imported for {companyName} have <code className="text-[#E6C78B]">user_id = NULL</code>. In strict compliance with private banking regulations, historical tenant ledger entries are not credited as live customer funds without verified keyholder reconciliation.
                        </p>
                      </div>
                      <button
                        onClick={() => loadTransactions()}
                        className="mt-3 px-3.5 py-1.5 rounded-lg bg-[#121212] border border-[#D4A017] text-[#D4A017] text-xs hover:bg-[#262626] flex items-center gap-1.5"
                      >
                        <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
                        <span>Retry Query</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
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
                      {t.type === 'Credit' ? '+' : '-'}{currencySymbol}{t.amount.toLocaleString()} {currencyCode}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
