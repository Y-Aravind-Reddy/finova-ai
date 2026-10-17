import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, ShieldCheck, DollarSign, ArrowUpRight, ArrowDownLeft, Building2, RotateCw, AlertCircle } from 'lucide-react';
import { UserAccount, CustomerTransaction } from '../../data/finovaDatasets';
import { fetchTransactionsResultFromDb } from '../../services/finovaDatabase';
import { getStoredSession } from '../../data/authStore';
import { getTenantById } from '../../data/tenantStore';

interface CustomerAccountsPageProps {
  currentUser?: UserAccount;
}

export const CustomerAccountsPage: React.FC<CustomerAccountsPageProps> = ({ currentUser: propUser }) => {
  const activeUser = propUser || getStoredSession()?.user;
  const tenantId = activeUser?.tenantId || 'tenant_apex_bank';
  const tenant = getTenantById(tenantId);
  const companyName = tenant?.name || activeUser?.tenantName || 'Apex Global Bank';
  const currencySymbol = tenant?.currencySymbol || '$';
  const currencyCode = tenant?.currency || 'USD';

  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbSource, setDbSource] = useState<'supabase' | 'fallback'>('fallback');
  const [dbError, setDbError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
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
      setDbError(err?.message || 'Error querying accounts data');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, activeUser?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived account balances strictly calculated from verified database transactions
  const liquidBalance = Math.max(
    0,
    transactions
      .filter((t) => t.type === 'Credit' && t.status === 'Settled')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0) -
      transactions
        .filter((t) => t.type === 'Debit' && t.status === 'Settled')
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  );

  const accounts = [
    {
      id: 'ACC-VAULT-01',
      name: `${companyName} Liquid Operating Vault`,
      type: 'Primary Demand Custody Deposit',
      balance: `${currencySymbol}${liquidBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencyCode}`,
      status: liquidBalance > 0 ? 'Active Funds' : 'Awaiting Settlement',
      iban: `${tenant?.shortName ? tenant.shortName.slice(0, 4).toUpperCase() : 'APEX'} 0070 0110 0008 8490 1`,
      bic: `${tenant?.shortName ? tenant.shortName.slice(0, 4).toUpperCase() : 'APEX'}ZZ1XXX`,
      apy: '5.18% APY',
      clearing: 'ISO 20022 / SWIFT Direct',
    },
    {
      id: 'ACC-VAULT-02',
      name: `${companyName} Securities & Custody`,
      type: 'Prime Custody Allocation',
      balance: `${currencySymbol}0.00 ${currencyCode}`,
      status: 'Awaiting Allocation',
      iban: `${tenant?.shortName ? tenant.shortName.slice(0, 4).toUpperCase() : 'APEX'} 0070 0110 0008 8490 2`,
      bic: `${tenant?.shortName ? tenant.shortName.slice(0, 4).toUpperCase() : 'APEX'}ZZ1XXX`,
      apy: '2.14% APY',
      clearing: 'Central Securities Depository',
    },
    {
      id: 'ACC-VAULT-03',
      name: `${companyName} Escrow Facility`,
      type: 'Multi-Currency Settlement',
      balance: `${currencySymbol}0.00 ${currencyCode}`,
      status: 'Standby Escrow',
      iban: `${tenant?.shortName ? tenant.shortName.slice(0, 4).toUpperCase() : 'APEX'} 0070 0110 0008 8490 3`,
      bic: `${tenant?.shortName ? tenant.shortName.slice(0, 4).toUpperCase() : 'APEX'}ZZ1XXX`,
      apy: '3.85% APY',
      clearing: 'Instant Settlement Rail',
    },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName}
            </span>
            <span className="text-xs text-[#D4A017]">Accredited Sovereign Custody</span>
            {dbSource === 'supabase' ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                Live DB Connected
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300">
                RLS Scoped ({dbError ? 'Query Restricted' : 'Awaiting Auth'})
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Multi-Asset Accounts & Balances
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Global custody reserves and Treasury yield accounts held under sovereign accredited custody. Balances derived strictly from verified database records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 hover:border-[#F5C542] text-[#D4A017] transition-all flex items-center gap-1.5"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="text-xs font-bold">Refresh</span>
          </button>
          <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
            <span className="text-[10px] text-[#6B7280] block">Verified Liquid Assets</span>
            <span className="text-sm font-bold text-[#F5C542]">
              {currencySymbol}{liquidBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencyCode}
            </span>
          </div>
        </div>
      </div>

      {transactions.length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-[#141414] border border-[#3A3A3A] text-xs text-[#9CA3AF] flex items-start gap-3">
          <AlertCircle size={18} className="text-[#D4A017] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#FAF7F0]">Historical Ledger & Account Mapping Notice</p>
            <p className="mt-1">
              Historical transactions imported for {companyName} have <code className="text-[#E6C78B]">user_id = NULL</code>. In accordance with strict institutional banking governance, historical tenant ledger entries are not automatically credited as live funds to customer accounts without authenticated identity verification and dual-keyholder signoff.
            </p>
          </div>
        </div>
      )}

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
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#141414] text-[#E6C78B] border border-[#3A3A3A]">
                {acc.status}
              </span>
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
