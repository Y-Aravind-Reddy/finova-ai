import React, { useState } from 'react';
import {
  CUSTOMER_DATASET,
  CustomerTransaction,
  CustomerDocument,
  UserAccount,
} from '../../data/finovaDatasets';
import { getTransactionsForTenant } from '../../data/tenantDatasets';
import { fetchTransactionsResultFromDb } from '../../services/finovaDatabase';
import { getTenantById } from '../../data/tenantStore';
import { ThreeDKpiCard } from '../charts3d/ThreeDKpiCard';
import { ThreeDPieChart } from '../charts3d/ThreeDPieChart';
import { ThreeDColumnChart } from '../charts3d/ThreeDColumnChart';
import { ThreeDProgressRing } from '../charts3d/ThreeDProgressRing';
import { Customer3DCard } from '../Customer3DCard';
import { CustomerCardsView } from '../CustomerCardsView';
import {
  Wallet,
  CreditCard,
  Award,
  FileCheck2,
  Download,
  Bot,
  ShieldCheck,
  Send,
  Building,
  UploadCloud,
  CheckCircle,
  Bell,
  Settings,
  HelpCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  Fingerprint,
  Key,
  Smartphone,
  Lock,
  Building2,
} from 'lucide-react';

interface CustomerDashboardProps {
  onOpenCopilot: () => void;
  currentUser?: UserAccount | { name: string; email: string; role?: string; tenantId?: string; tenantName?: string };
  activeSection?: string;
  onNavigateSection?: (section: string) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  onOpenCopilot,
  currentUser,
  activeSection = 'dashboard',
  onNavigateSection,
}) => {
  const { profile, documents, spendingCategories } = CUSTOMER_DATASET;

  const tenantId = currentUser && 'tenantId' in currentUser ? currentUser.tenantId || 'tenant_apex_bank' : 'tenant_apex_bank';
  const tenant = getTenantById(tenantId);
  const companyName = tenant?.name || (currentUser && 'tenantName' in currentUser ? currentUser.tenantName : undefined) || 'Apex Global Bank';

  // Load tenant-isolated transactions from Supabase or fallback
  const [tenantTransactions, setTenantTransactions] = useState<CustomerTransaction[]>(() =>
    getTransactionsForTenant(tenantId)
  );
  const [dbSource, setDbSource] = useState<'supabase' | 'fallback'>('fallback');
  const [dbError, setDbError] = useState<string | null>(null);

  React.useEffect(() => {
    fetchTransactionsResultFromDb(tenantId).then((result) => {
      setDbSource(result.source);
      setDbError(result.error);
      if (result.source === 'supabase') {
        setTenantTransactions(result.data);
      } else if (result.data && result.data.length > 0) {
        setTenantTransactions(result.data);
      }
    });
  }, [tenantId]);

  const [activeTab, setActiveTab] = useState<'transactions' | 'documents'>('transactions');
  const [uploadedDocs, setUploadedDocs] = useState<CustomerDocument[]>(documents);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const displayName = currentUser?.name || profile.fullName;
  const currencySymbol = tenant?.currencySymbol || '$';
  const currencyCode = tenant?.currency || 'USD';

  // Spending 3D Pie Data
  const spendingPieData = spendingCategories.map((s) => ({
    label: s.category.split(' ')[0] + ' ' + (s.category.split(' ')[1] || ''),
    value: s.amount,
    subtext: `${s.pct}% of total`,
  }));

  // Portfolio Monthly Growth 3D Columns
  const portfolioGrowth = [
    { label: 'May', value: 4120, secondaryValue: 3800 },
    { label: 'Jun', value: 4280, secondaryValue: 3950 },
    { label: 'Jul', value: 4450, secondaryValue: 4100 },
    { label: 'Aug', value: 4610, secondaryValue: 4250 },
    { label: 'Sep', value: 4780, secondaryValue: 4390 },
    { label: 'Oct', value: 4892, secondaryValue: 4500, highlight: true },
  ];

  const handleSimulateUpload = () => {
    const newDoc: CustomerDocument = {
      id: `DOC-${Math.floor(8806 + Math.random() * 1000)}`,
      title: 'Custody Account Supplemental Declaration',
      documentType: 'Custody Agreement',
      fileSize: '3.4 MB',
      uploadedAt: new Date().toISOString().split('T')[0],
      verifiedBy: 'Finova Gold Identity Guard',
      status: 'Verified',
      tenantId,
      tenantName: companyName,
    };
    setUploadedDocs([newDoc, ...uploadedDocs]);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  // Filtered transactions
  const filteredTransactions = tenantTransactions.filter(
    (t) =>
      t.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.referenceNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If activeSection is Cards
  if (activeSection === 'cust_cards') {
    return <CustomerCardsView customerName={displayName} />;
  }

  // If activeSection is Accounts
  if (activeSection === 'cust_accounts') {
    return (
      <div className="space-y-6 font-mono text-xs">
        <div className="rounded-2xl p-6 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1">
                <Building2 size={11} />
                {companyName}
              </span>
              <span className="text-xs text-[#E6C78B]">Sovereign Custody Accounts</span>
            </div>
            <h1 className="font-cinzel text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
              Multi-Asset Accounts & Balances
            </h1>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Relationship Manager: {profile.relationshipManager} • Primary Routing: SWIFT {(tenant?.shortName || companyName || 'APEX').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase()}-01
            </p>
          </div>
          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-md"
          >
            <Bot size={15} /> Liquidity Audit
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#262626] border border-[#3A3A3A] shadow-lg">
            <span className="text-xs text-[#D4A017] font-semibold">LIQUID OPERATING VAULT</span>
            <h3 className="font-cinzel text-2xl font-bold text-[#E6C78B] mt-1">
              {currencySymbol}{(profile.liquidityBalance / 1000000).toFixed(2)}M {currencyCode}
            </h3>
            <p className="text-xs text-[#9CA3AF] mt-2">Acct #{profile.accountNumber}-01</p>
            <div className="mt-4 pt-3 border-t border-[#3A3A3A] flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">Yield (APY): 5.18%</span>
              <span className="text-[#D4A017] font-bold">Insured</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#262626] border border-[#3A3A3A] shadow-lg">
            <span className="text-xs text-[#D4A017] font-semibold">SECURITIES & CUSTODY</span>
            <h3 className="font-cinzel text-2xl font-bold text-[#FAF7F0] mt-1">
              {currencySymbol}{((profile.portfolioTotalValue - profile.liquidityBalance) / 1000000).toFixed(2)}M {currencyCode}
            </h3>
            <p className="text-xs text-[#9CA3AF] mt-2">Custody: {companyName} Prime</p>
            <div className="mt-4 pt-3 border-t border-[#3A3A3A] flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">12 Prime Holdings</span>
              <span className="text-[#D4A017] font-bold">Tier 3 Accredited</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#262626] border border-[#3A3A3A] shadow-lg">
            <span className="text-xs text-[#D4A017] font-semibold">SOVEREIGN CREDIT FACILITY</span>
            <h3 className="font-cinzel text-2xl font-bold text-[#E6C78B] mt-1">
              {currencySymbol}{(profile.creditLimit / 1000).toFixed(0)}k Limit
            </h3>
            <p className="text-xs text-[#9CA3AF] mt-2">
              Used: {currencySymbol}{profile.creditBalanceUsed.toLocaleString()} (18.4%)
            </p>
            <div className="mt-4 pt-3 border-t border-[#3A3A3A] flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">Base - 0.75%</span>
              <span className="text-[#D4A017] font-bold">Unencumbered</span>
            </div>
          </div>
        </div>

        <ThreeDColumnChart
          title={`3D Portfolio Net Asset Value Trajectory (${currencyCode})`}
          subtitle="Monthly Settlement Volume vs Benchmark Projection"
          data={portfolioGrowth}
          height={280}
          valuePrefix={currencySymbol}
          valueSuffix="k"
          dualSeries={true}
          primaryLabel="Net Value ($k)"
          secondaryLabel="Benchmark"
        />
      </div>
    );
  }

  // DEFAULT VIEW
  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Sovereign Wealth Customer Header */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#121212] via-[#262626] to-[#121212] border border-[#3A3A3A] hover:border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1">
              <Building2 size={11} />
              {companyName}
            </span>
            <span className="text-xs text-[#E6C78B]">
              {currentUser?.email ? currentUser.email : `Custody Acct: ${profile.accountNumber}`}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#121212] text-[#9CA3AF] border border-[#3A3A3A]">
              Role: {currentUser && 'role' in currentUser && currentUser.role ? currentUser.role.replace('_', ' ') : 'CUSTOMER'}
            </span>
            {dbSource === 'supabase' ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Transactions: Live Supabase Database
              </span>
            ) : (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center gap-1"
                title={dbError || 'Transactions table pending or requires authentication'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                {dbError && dbError.includes('Demo') ? 'Transactions: Demo Dataset (RLS Active)' : 'Transactions: Fallback Data (DB Pending)'}
              </span>
            )}
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017] mt-1">
            Welcome, {displayName}
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mt-1">
            Institutional private banking portal at {companyName}. Portfolio analytics models displayed below.
          </p>
        </div>

        <button
          onClick={onOpenCopilot}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all shrink-0"
        >
          <Bot size={16} />
          Consult Finova Wealth Copilot
        </button>
      </div>

      {/* Modeled Custody KPI Overview */}
      <div className="flex items-center justify-between text-xs text-[#9CA3AF] px-1">
        <span className="font-semibold text-[#FAF7F0] flex items-center gap-1.5">
          <Wallet size={13} className="text-[#D4A017]" />
          Custody Liquidity & Portfolio Overview
        </span>
        <span className="text-[10px] text-[#E6C78B]/70 bg-[#121212] px-2.5 py-0.5 rounded-full border border-[#3A3A3A]">
          Custody Model Projections
        </span>
      </div>

      {/* 4 3D KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ThreeDKpiCard
          title="Liquid Cash Balance"
          value={`${currencySymbol}${(profile.liquidityBalance / 1000000).toFixed(2)}M`}
          subValue={`${currencySymbol}1,428,500.00 Settled`}
          change="+12.4%"
          trend="up"
          tag="Operating Cash"
          variant="gold-accent"
          icon={<Wallet size={20} />}
          sparkline={[80, 95, 110, 120, 128, 135, 142]}
        />
        <ThreeDKpiCard
          title="Total Portfolio NAV"
          value={`${currencySymbol}${(profile.portfolioTotalValue / 1000000).toFixed(2)}M`}
          subValue="Multi-Asset Custody"
          change="+18.8%"
          trend="up"
          tag="Securities & PE"
          icon={<Building size={20} />}
          sparkline={[320, 350, 390, 420, 450, 470, 489]}
        />
        <ThreeDKpiCard
          title="Sovereign Credit Line"
          value={`${currencySymbol}${(profile.creditLimit / 1000).toFixed(0)}k Limit`}
          subValue={`${currencySymbol}${profile.creditBalanceUsed.toLocaleString()} Used (18.4%)`}
          change="Optimal 18.4%"
          trend="up"
          tag="Zero Penalty"
          icon={<CreditCard size={20} />}
          sparkline={[20, 25, 30, 35, 38, 42, 46]}
        />
        <ThreeDKpiCard
          title="Credit Rating & KYC"
          value={`${profile.creditScore} FICO`}
          subValue="Tier 3 Accredited"
          change="Top 0.5%"
          trend="up"
          tag="Exceptional"
          icon={<Award size={20} />}
          sparkline={[790, 795, 800, 805, 810, 812, 815]}
        />
      </div>

      {/* 3D VIRTUAL CARD PREVIEW + 3D CREDIT RINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#3A3A3A]">
              <h3 className="font-cinzel text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FAF7F0] via-[#E6C78B] to-[#D4A017]">
                Institutional Sovereign Card
              </h3>
              {onNavigateSection && (
                <button
                  onClick={() => onNavigateSection('/customer/cards')}
                  className="text-[11px] text-[#D4A017] hover:underline"
                >
                  Manage All Cards →
                </button>
              )}
            </div>

            <Customer3DCard
              customerName={displayName.toUpperCase()}
              cardNumberMasked="•••• •••• •••• 8849"
              expiryDate="08/29"
              cardType={`${companyName.toUpperCase()} BLACK GOLD`}
            />
          </div>

          <div className="mt-4 p-3 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[11px] text-[#9CA3AF] flex items-center justify-between">
            <span>Daily ATM Limit: {currencySymbol}50,000</span>
            <span className="text-[#E6C78B] font-bold">Zero FX Fees</span>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex flex-col justify-between">
          <ThreeDProgressRing
            title="3D Credit Utilization & Covenant"
            subtitle="Tier 3 accredited threshold parameters"
            size={240}
            items={[
              {
                label: 'Credit Utilization',
                value: 18.4,
                displayValue: '18.4%',
                subtext: `${currencySymbol}46,000 used of ${currencySymbol}250,000 limit`,
              },
              {
                label: 'KYC Vault Verification',
                value: 100,
                displayValue: '100%',
                subtext: '5 of 5 Sovereign documents certified',
              },
              {
                label: 'Portfolio Net Yield',
                value: 86.5,
                displayValue: '+8.65%',
                subtext: 'Annualized net Treasury & equity yield',
              },
            ]}
          />
        </div>
      </div>

      {/* Visualizations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDPieChart
          title="3D Spending & Capital Allocation Analytics"
          subtitle={`Portfolio Outflows for ${displayName}`}
          segments={spendingPieData}
          valuePrefix={currencySymbol}
          valueSuffix=""
          height={320}
        />

        <ThreeDColumnChart
          title={`3D Portfolio Net Asset Value Trajectory (${currencyCode})`}
          subtitle="Institutional Custody Assets vs Benchmark Projection"
          data={portfolioGrowth}
          height={280}
          valuePrefix={currencySymbol}
          valueSuffix="k"
          dualSeries={true}
          primaryLabel="Net Value ($k)"
          secondaryLabel="Benchmark"
        />
      </div>

      {/* Transactions & Documents Vault Section */}
      <div className="rounded-2xl bg-[#262626]/95 border border-[#3A3A3A] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#3A3A3A] gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'transactions'
                  ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] shadow-md'
                  : 'bg-[#121212] text-[#9CA3AF] border border-[#3A3A3A] hover:text-[#FAF7F0]'
              }`}
            >
              Custody Transactions ({filteredTransactions.length})
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'documents'
                  ? 'bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] shadow-md'
                  : 'bg-[#121212] text-[#9CA3AF] border border-[#3A3A3A] hover:text-[#FAF7F0]'
              }`}
            >
              Sovereign Document Vault ({uploadedDocs.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'transactions' && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search merchant, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#121212] border border-[#3A3A3A] rounded-xl px-3 py-1.5 pl-8 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#D4A017] w-48"
                />
                <Search size={13} className="absolute left-2.5 top-2 text-[#D4A017]" />
              </div>
            )}

            {activeTab === 'documents' && (
              <button
                onClick={handleSimulateUpload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold text-xs hover:brightness-110"
              >
                <UploadCloud size={14} /> Upload KYC Document
              </button>
            )}
          </div>
        </div>

        {uploadSuccess && (
          <div className="mt-3 p-2.5 rounded-xl bg-[#121212] border border-[#D4A017] text-xs text-[#E6C78B] flex items-center gap-2">
            <CheckCircle size={14} className="text-[#D4A017]" />
            <span>Document securely encrypted and uploaded to {companyName} Sovereign Vault.</span>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#3A3A3A] text-[#E6C78B] text-[11px]">
                  <th className="pb-2">Date & Txn ID</th>
                  <th className="pb-2">Counterparty / Merchant</th>
                  <th className="pb-2">Asset Class</th>
                  <th className="pb-2">Settlement Type</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#121212]/50 transition-colors">
                    <td className="py-2.5">
                      <p className="font-bold text-[#E6C78B]">{tx.date}</p>
                      <p className="text-[10px] text-[#9CA3AF]">{tx.id}</p>
                    </td>
                    <td className="py-2.5">
                      <p className="font-semibold text-[#FAF7F0]">{tx.merchant}</p>
                      <p className="text-[10px] text-[#9CA3AF]">{tx.referenceNo}</p>
                    </td>
                    <td className="py-2.5 text-[11px] text-[#D4A017]">{tx.category}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === 'Credit'
                            ? 'bg-[#121212] text-[#E6C78B] border border-[#D4A017]/40'
                            : 'bg-[#121212] text-[#FAF7F0] border border-[#3A3A3A]'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-2.5 font-bold text-sm text-[#FAF7F0]">
                      {tx.type === 'Credit' ? '+' : '-'}{currencySymbol}{tx.amount.toLocaleString()} {currencyCode}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#121212] text-[#E6C78B] border border-[#3A3A3A]">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-xl bg-[#121212] border border-[#3A3A3A] flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[#262626] text-[#D4A017] border border-[#3A3A3A]">
                      {doc.documentType}
                    </span>
                    <span className="text-[10px] text-[#E6C78B] font-bold">
                      ✓ {doc.status}
                    </span>
                  </div>
                  <h4 className="font-cinzel text-xs font-bold text-[#FAF7F0] leading-tight">
                    {doc.title}
                  </h4>
                  <p className="text-[10px] text-[#9CA3AF] mt-1">
                    Uploaded: {doc.uploadedAt} • Size: {doc.fileSize}
                  </p>
                  <p className="text-[10px] text-[#D4A017] mt-0.5">
                    Verified By: {doc.verifiedBy}
                  </p>
                </div>

                <button
                  onClick={() => alert(`Downloading encrypted copy of ${doc.title}...`)}
                  className="mt-3 w-full py-1.5 rounded-lg bg-[#262626] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[11px] text-[#E6C78B] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download size={13} />
                  Download Encrypted PDF
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
