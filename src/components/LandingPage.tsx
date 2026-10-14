import React, { useState } from 'react';
import { FinovaLogo } from './FinovaLogo';
import {
  ShieldCheck,
  TrendingUp,
  Bot,
  FileCheck2,
  Lock,
  ArrowRight,
  Database,
  Building2,
  Users,
  Headphones,
  FileText,
  Send,
  Sparkles,
  Server,
  Layers,
  ChevronRight,
  Activity,
  CheckCircle2,
  Eye,
  Menu,
  X,
  CreditCard,
  Search,
  Key,
  FolderGit2,
  ExternalLink,
  Cpu,
  BarChart3,
  HelpCircle,
  FileCode2,
  ArrowUpRight,
} from 'lucide-react';
import { getStoredTenants, getPlatformSaaSMetrics } from '../data/tenantStore';

interface LandingPageProps {
  onGoToLogin: () => void;
  onGoToSignup: () => void;
}

interface CapabilityItem {
  id: string;
  title: string;
  shortDesc: string;
  details: string;
  icon: React.ReactNode;
  category: string;
  portalRoute: string;
  metricsLabel: string;
  metricsValue: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGoToLogin,
  onGoToSignup,
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState<CapabilityItem | null>(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState<number>(0);

  // Contact Form State
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    inquiryType: 'Enterprise Evaluation',
    message: '',
  });

  // Pull real multi-tenant configuration for demonstration platform preview
  const tenants = getStoredTenants();
  const saasMetrics = getPlatformSaaSMetrics();

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitted(true);
    setTimeout(() => {
      setContactForm({
        name: '',
        email: '',
        company: '',
        inquiryType: 'Enterprise Evaluation',
        message: '',
      });
      setContactSubmitted(false);
    }, 4500);
  };

  const scrollToSection = (id: string) => {
    setMobileNavOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 6 Core Platform Capabilities
  const capabilities: CapabilityItem[] = [
    {
      id: 'ai-assistant',
      title: 'Finova AI Assistant',
      shortDesc: 'Context-aware financial reasoning engine assisting compliance, operations, and analytical teams.',
      details: 'Evaluates transaction histories, ledger reconciliations, cross-border settlement rails, and automated compliance policy checklists in sub-second inference speed.',
      icon: <Bot className="text-[#D4A017]" size={24} />,
      category: 'Intelligence Engine',
      portalRoute: '/customer/ai-assistant',
      metricsLabel: 'Avg Response Latency',
      metricsValue: '18ms Engine Latency',
    },
    {
      id: 'transaction-classification',
      title: 'Transaction Classification',
      shortDesc: 'Automated categorical tagging and multi-dimensional analysis for high-volume banking transaction streams.',
      details: 'Deconstructs wire flows, merchant categories, counterparty risk ratings, and cash flow anomalies with granular auditing trails across accounts.',
      icon: <Layers className="text-[#B87333]" size={24} />,
      category: 'Operations Rail',
      portalRoute: '/finance/transaction-analytics',
      metricsLabel: 'Classification Speed',
      metricsValue: '48,000 tx/sec Peak',
    },
    {
      id: 'fraud-aml',
      title: 'Fraud Detection & AML',
      shortDesc: 'Multi-layer transaction surveillance detecting structuring, velocity spikes, and high-risk sanctions violations.',
      details: 'Continuously audits transactional behavior against anti-money laundering rule bases, PEP watchlists, and suspicious pattern heuristics with immediate risk scoring.',
      icon: <ShieldCheck className="text-[#D4A017]" size={24} />,
      category: 'Risk & Surveillance',
      portalRoute: '/finance/fraud-detection',
      metricsLabel: 'Precision Rate',
      metricsValue: '99.4% Verified Precision',
    },
    {
      id: 'kyc-verification',
      title: 'KYC Verification',
      shortDesc: 'Streamlined corporate and retail customer due diligence with tiered verification status tracking.',
      details: 'Automates identity document intake, beneficial ownership screening, watchlist cross-referencing, and multi-tier accreditation workflows from onboarding to review.',
      icon: <FileCheck2 className="text-[#B87333]" size={24} />,
      category: 'Compliance Desk',
      portalRoute: '/finance/kyc-verification',
      metricsLabel: 'Verification SLA',
      metricsValue: 'Under 4 Minutes',
    },
    {
      id: 'document-ocr',
      title: 'Document OCR Intelligence',
      shortDesc: 'Machine vision data extraction for passports, financial statements, tax filings, and corporate licenses.',
      details: 'Extracts tabular accounting data, dates, identification numbers, and cryptographic signatures directly from PDFs and scans with confidence indexing.',
      icon: <FileText className="text-[#D4A017]" size={24} />,
      category: 'Data Processing',
      portalRoute: '/support/document-ocr',
      metricsLabel: 'Extraction Confidence',
      metricsValue: '98.9% OCR Accuracy',
    },
    {
      id: 'case-management',
      title: 'Case Management',
      shortDesc: 'End-to-end incident investigation, evidence dossiers, regulatory audit trails, and collaborative reviews.',
      details: 'Enables cross-departmental coordination between analysts, support agents, and compliance officers with complete time-stamped evidentiary logs and escalation protocols.',
      icon: <FolderGit2 className="text-[#B87333]" size={24} />,
      category: 'Governance & Resolution',
      portalRoute: '/support/case-management',
      metricsLabel: 'Mean Resolution Time',
      metricsValue: '2.4 Hour Mean SLA',
    },
  ];

  // 5 Operational Roles
  const roles = [
    {
      title: 'Platform Super Admin',
      badge: 'Operator Level',
      desc: 'Manages the Finova AI platform, company onboarding, platform users and service health.',
      permissions: [
        'Register and configure company tenant workspaces',
        'Activate, suspend, and monitor company subscriptions',
        'Provision platform-level security credentials and admin accounts',
        'Global system uptime, API health, and audit trail oversight',
      ],
      icon: <Server size={20} className="text-[#D4A017]" />,
      color: 'border-[#D4A017] bg-[#262626]',
    },
    {
      title: 'Company Admin',
      badge: 'Institutional Level',
      desc: 'Manages authorised staff, customers and operations within one company workspace.',
      permissions: [
        'Onboard and manage company finance analysts and support agents',
        'Review company customer registrations and KYC compliance queues',
        'Configure institutional payment routing and local settlement rules',
        'Access company operations dashboards and performance reports',
      ],
      icon: <Building2 size={20} className="text-[#E6C78B]" />,
      color: 'border-[#3A3A3A] bg-[#262626]',
    },
    {
      title: 'Finance Analyst',
      badge: 'Operations Desk',
      desc: 'Performs authorised financial analytics, fraud monitoring and KYC work.',
      permissions: [
        'Execute multi-hop AML anomaly audits and threat investigations',
        'Analyze transaction classification flows and settlement volumes',
        'Process customer KYC verifications and risk scoring assessments',
        'Generate institutional compliance and financial audit reports',
      ],
      icon: <BarChart3 size={20} className="text-[#B87333]" />,
      color: 'border-[#3A3A3A] bg-[#262626]',
    },
    {
      title: 'Support Executive',
      badge: 'Customer Operations',
      desc: 'Handles assigned customer requests, tickets and complaints.',
      permissions: [
        'Manage incoming customer tickets and operational inquiries',
        'Assist clients with KYC document resubmissions and status checks',
        'Resolve disputed transactions and customer follow-up actions',
        'Collaborate with analysts via integrated case dossiers',
      ],
      icon: <Headphones size={20} className="text-[#D4A017]" />,
      color: 'border-[#3A3A3A] bg-[#262626]',
    },
    {
      title: 'Customer',
      badge: 'Client Portal',
      desc: 'Views their own permitted information and accesses customer services.',
      permissions: [
        'Inspect personal account balances, transactions, and payment cards',
        'Upload verified identity documents for secure KYC processing',
        'Engage directly with customer support and open assistance tickets',
        'Interact with the dedicated Finova AI financial assistant',
      ],
      icon: <Users size={20} className="text-[#FAF7F0]" />,
      color: 'border-[#3A3A3A] bg-[#262626]',
    },
  ];

  // Security & Trust Capabilities
  const securityFeatures = [
    {
      title: 'Role-Based Access Control',
      status: 'Implemented',
      desc: 'Strict authorization boundaries ensure users can only view routes and data permitted by their institutional role.',
      icon: <Lock size={20} className="text-[#D4A017]" />,
    },
    {
      title: 'Company-Level Data Isolation',
      status: 'Implemented',
      desc: 'Verified tenant partitioning prevents cross-company data leakage; each organization access is hermetically scoped.',
      icon: <Building2 size={20} className="text-[#B87333]" />,
    },
    {
      title: 'Controlled Authentication',
      status: 'Implemented',
      desc: 'Cryptographic session tokens, secure password hashing, and active session verification guard every entry point.',
      icon: <Key size={20} className="text-[#D4A017]" />,
    },
    {
      title: 'Immutable Audit Logging',
      status: 'Implemented',
      desc: 'Every configuration change, permission elevation, and compliance review generates an unalterable timestamped event log.',
      icon: <FileText size={20} className="text-[#E6C78B]" />,
    },
    {
      title: 'Protected API Gateways',
      status: 'Architecture Active',
      desc: 'Backend communication requires valid bearer tokens with strict tenant scoping checks on all endpoints.',
      icon: <Server size={20} className="text-[#D4A017]" />,
    },
    {
      title: 'Secure Document Handling',
      status: 'Architecture Active',
      desc: 'Sensitive KYC records and identity paperwork are processed through isolated intake pipelines with verified integrity.',
      icon: <ShieldCheck size={20} className="text-[#B87333]" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#121212] text-[#FAF7F0] selection:bg-[#D4A017] selection:text-[#1A1A1A] font-sans">
      {/* ========================================================
          3. RESPONSIVE NAVIGATION BAR
          ======================================================== */}
      <nav className="sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-md border-b border-[#3A3A3A] px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo with Home Scroll */}
          <button
            onClick={() => scrollToSection('home')}
            className="flex items-center gap-2 group text-left focus:outline-none"
            aria-label="Finova AI Home"
          >
            <FinovaLogo variant="full" size="md" />
          </button>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-8 text-xs font-mono text-[#FAF7F0]/80">
            <button
              onClick={() => scrollToSection('home')}
              className="text-[#FAF7F0] hover:text-[#D4A017] transition-colors py-1 border-b-2 border-transparent hover:border-[#D4A017]"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('platform')}
              className="hover:text-[#D4A017] transition-colors py-1 border-b-2 border-transparent hover:border-[#D4A017]"
            >
              Platform
            </button>
            <button
              onClick={() => scrollToSection('solutions')}
              className="hover:text-[#D4A017] transition-colors py-1 border-b-2 border-transparent hover:border-[#D4A017]"
            >
              Solutions
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="hover:text-[#D4A017] transition-colors py-1 border-b-2 border-transparent hover:border-[#D4A017]"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="hover:text-[#D4A017] transition-colors py-1 border-b-2 border-transparent hover:border-[#D4A017]"
            >
              Contact
            </button>
          </div>

          {/* Desktop CTA Controls */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={onGoToLogin}
              className="px-4 py-2 rounded-xl text-xs font-mono text-[#FAF7F0] hover:text-[#E6C78B] bg-[#262626] hover:bg-[#3A3A3A] border border-[#3A3A3A] transition-all"
            >
              Login
            </button>
            <button
              onClick={onGoToSignup}
              className="px-4.5 py-2 rounded-xl text-xs font-bold font-mono text-[#1A1A1A] bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] hover:brightness-110 shadow-[0_0_15px_rgba(212,160,23,0.3)] transition-all flex items-center gap-1.5"
            >
              Get Started <ArrowRight size={13} />
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden p-2 rounded-xl bg-[#262626] border border-[#3A3A3A] text-[#FAF7F0] hover:text-[#D4A017] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-[#3A3A3A] px-2 pb-4 space-y-3 font-mono text-xs">
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => scrollToSection('home')}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#262626] text-[#FAF7F0]"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('platform')}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#262626] text-[#FAF7F0]"
              >
                Platform Capabilities
              </button>
              <button
                onClick={() => scrollToSection('solutions')}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#262626] text-[#FAF7F0]"
              >
                Solutions & Architecture
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#262626] text-[#FAF7F0]"
              >
                About Finova AI
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#262626] text-[#FAF7F0]"
              >
                Contact
              </button>
            </div>
            <div className="pt-2 border-t border-[#3A3A3A] flex flex-col gap-2">
              <button
                onClick={onGoToLogin}
                className="w-full py-2.5 text-center rounded-xl bg-[#262626] border border-[#3A3A3A] text-[#FAF7F0]"
              >
                Login
              </button>
              <button
                onClick={onGoToSignup}
                className="w-full py-2.5 text-center rounded-xl font-bold text-[#1A1A1A] bg-gradient-to-r from-[#D4A017] to-[#E6C78B]"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ========================================================
          4. HERO SECTION
          ======================================================== */}
      <section
        id="home"
        className="relative pt-16 sm:pt-24 pb-20 px-4 sm:px-8 max-w-7xl mx-auto overflow-hidden"
      >
        {/* Subtle Architectural Glow Background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[360px] bg-[#D4A017]/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="text-center max-w-4xl mx-auto relative z-10">
          {/* Unboxed Brand Sub-Kicker */}
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#D4A017] tracking-wider uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4A017] animate-pulse" />
            <span>Finova AI Platform</span>
            <span className="text-[#3A3A3A]">/</span>
            <span className="text-[#E6C78B]">Financial Operations SaaS</span>
          </div>

          {/* Headline - Exact User Spec */}
          <h1 className="font-cinzel text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FAF7F0] via-[#FAF7F0] to-[#E6C78B] leading-[1.15]">
            Smarter Finance. Faster Operations. Better Decisions.
          </h1>

          {/* Supporting Text - Exact User Spec */}
          <p className="mt-6 text-sm sm:text-base md:text-lg text-[#FAF7F0]/85 font-sans max-w-3xl mx-auto leading-relaxed">
            An AI-powered financial operations platform that helps financial organisations streamline transaction analytics, fraud monitoring, document processing, KYC workflows and customer support.
          </p>

          {/* Call to Actions - Exact Spec */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4 font-mono text-xs">
            <button
              onClick={() => scrollToSection('platform')}
              className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold hover:brightness-110 shadow-[0_0_25px_rgba(212,160,23,0.35)] transition-all flex items-center gap-2"
            >
              <span>Explore Platform</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={onGoToSignup}
              className="px-7 py-3.5 rounded-xl bg-[#262626] hover:bg-[#3A3A3A] border border-[#3A3A3A] hover:border-[#D4A017]/40 text-[#FAF7F0] transition-all flex items-center gap-2"
            >
              <span>Get Started</span>
            </button>
          </div>
        </div>

        {/* Hero Interactive Analytics Preview Graphic (Graphite + Gold + Copper) */}
        <div className="mt-14 sm:mt-16 relative z-10 max-w-5xl mx-auto">
          {/* Mandatory Demo Label */}
          <div className="flex items-center justify-between pb-2 px-2 text-[11px] font-mono text-[#9CA3AF]">
            <span className="flex items-center gap-1.5 text-[#E6C78B]">
              <Activity size={12} className="text-[#D4A017]" />
              Demonstration Environment · Sample Platform Analytics
            </span>
            <span className="hidden sm:inline text-[#9CA3AF]">
              Simulated Operational Metrics · Not Real Company Financial Results
            </span>
          </div>

          <div className="rounded-2xl bg-[#262626] border border-[#3A3A3A] p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
            {/* Top Toolbar of the Simulated Interface */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[#3A3A3A]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#121212] border border-[#3A3A3A] flex items-center justify-center text-[#D4A017] font-bold text-xs">
                  FA
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-[#FAF7F0] flex items-center gap-2">
                    <span>Operations Control Center</span>
                    <span className="text-[10px] text-[#D4A017] font-normal">v4.2</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#9CA3AF]">
                    Cross-Tenant Sentinel Feed · 18ms Query Velocity
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="px-2.5 py-1 rounded-md bg-[#121212] border border-[#3A3A3A] text-[#E6C78B]">
                  3 Active Workspaces
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#121212] border border-[#3A3A3A] text-[#FAF7F0]">
                  Core Health: 99.99%
                </span>
              </div>
            </div>

            {/* 4 Metric Columns */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-5">
              <div className="p-3.5 rounded-xl bg-[#121212] border border-[#3A3A3A]">
                <span className="text-[10px] font-mono text-[#9CA3AF] block uppercase">
                  Processed Volume (24h)
                </span>
                <span className="font-cinzel text-lg sm:text-xl font-bold text-[#FAF7F0] mt-1 block">
                  $142.8M
                </span>
                <div className="flex items-center gap-1 text-[10px] font-mono text-[#D4A017] mt-1">
                  <TrendingUp size={11} />
                  <span>+18.4% daily flow</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#121212] border border-[#3A3A3A]">
                <span className="text-[10px] font-mono text-[#9CA3AF] block uppercase">
                  AML Exceptions Flagged
                </span>
                <span className="font-cinzel text-lg sm:text-xl font-bold text-[#E6C78B] mt-1 block">
                  95 Cleared
                </span>
                <div className="flex items-center gap-1 text-[10px] font-mono text-[#B87333] mt-1">
                  <ShieldCheck size={11} />
                  <span>0.08% False Positives</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#121212] border border-[#3A3A3A]">
                <span className="text-[10px] font-mono text-[#9CA3AF] block uppercase">
                  KYC Verified Rate
                </span>
                <span className="font-cinzel text-lg sm:text-xl font-bold text-[#FAF7F0] mt-1 block">
                  98.6%
                </span>
                <div className="flex items-center gap-1 text-[10px] font-mono text-[#D4A017] mt-1">
                  <CheckCircle2 size={11} />
                  <span>Auto-Audited Dossiers</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#121212] border border-[#3A3A3A]">
                <span className="text-[10px] font-mono text-[#9CA3AF] block uppercase">
                  AI Inference Cycles
                </span>
                <span className="font-cinzel text-lg sm:text-xl font-bold text-[#E6C78B] mt-1 block">
                  34.2K
                </span>
                <div className="flex items-center gap-1 text-[10px] font-mono text-[#E6C78B] mt-1">
                  <Cpu size={11} />
                  <span>Multi-Model Parallel</span>
                </div>
              </div>
            </div>

            {/* Visual Gold & Copper Chart Bars Simulation */}
            <div className="p-4 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <div className="flex items-center justify-between text-xs font-mono mb-3">
                <span className="text-[#FAF7F0] font-bold">
                  Intra-Day Settlement Flow & Risk Vector Telemetry
                </span>
                <div className="flex items-center gap-4 text-[10px] text-[#9CA3AF]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#D4A017]" />
                    Cleared Settlement Flow
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#B87333]" />
                    Surveillance Checks
                  </span>
                </div>
              </div>

              {/* Chart Series Simulation with Pure CSS */}
              <div className="h-32 flex items-end gap-2 sm:gap-4 pt-4 border-b border-[#3A3A3A]">
                {[
                  { hour: '04:00', gold: 35, copper: 20 },
                  { hour: '07:00', gold: 58, copper: 35 },
                  { hour: '10:00', gold: 92, copper: 60 },
                  { hour: '13:00', gold: 84, copper: 50 },
                  { hour: '16:00', gold: 98, copper: 72 },
                  { hour: '19:00', gold: 64, copper: 40 },
                  { hour: '22:00', gold: 46, copper: 28 },
                ].map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      <div
                        style={{ height: `${item.gold}%` }}
                        className="w-1/2 bg-[#D4A017] rounded-t-sm group-hover:brightness-125 transition-all"
                        title={`Cleared: ${item.gold}%`}
                      />
                      <div
                        style={{ height: `${item.copper}%` }}
                        className="w-1/2 bg-[#B87333] rounded-t-sm group-hover:brightness-125 transition-all"
                        title={`Surveillance: ${item.copper}%`}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-[#9CA3AF] mt-1.5">{item.hour}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] font-mono text-[#9CA3AF]">
                <span>Sample Live Feeds: SWIFT GPI · FedNow Rails · SEPA Instant</span>
                <span className="text-[#D4A017]">Zero Transaction Bottlenecks</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          5. PLATFORM CAPABILITIES (6 CARDS)
          ======================================================== */}
      <section
        id="platform"
        className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t border-[#3A3A3A]"
      >
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-mono uppercase tracking-widest text-[#D4A017] block mb-2">
            Integrated Operations Suite
          </span>
          <h2 className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-bold text-[#FAF7F0]">
            Core Platform Capabilities
          </h2>
          <p className="mt-3 text-sm text-[#9CA3AF] max-w-2xl mx-auto font-sans leading-relaxed">
            Six specialized engines designed to handle high-volume banking workloads, regulatory oversight, and complex customer journeys.
          </p>
        </div>

        {/* 6 Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap) => (
            <div
              key={cap.id}
              className="p-6 rounded-2xl bg-[#262626] border border-[#3A3A3A] hover:border-[#D4A017]/60 transition-all duration-200 flex flex-col justify-between group shadow-lg hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#121212] border border-[#3A3A3A] flex items-center justify-center group-hover:border-[#D4A017]/40 transition-colors">
                    {cap.icon}
                  </div>
                  <span className="text-[11px] font-mono text-[#9CA3AF]">{cap.category}</span>
                </div>

                <h3 className="font-cinzel text-lg font-bold text-[#FAF7F0] group-hover:text-[#E6C78B] transition-colors">
                  {cap.title}
                </h3>

                <p className="mt-2 text-xs text-[#FAF7F0]/80 font-sans leading-relaxed">
                  {cap.shortDesc}
                </p>

                <div className="mt-4 pt-3 border-t border-[#3A3A3A] flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#9CA3AF]">{cap.metricsLabel}</span>
                  <span className="text-[#E6C78B] font-semibold">{cap.metricsValue}</span>
                </div>
              </div>

              <div className="mt-6 pt-2">
                <button
                  onClick={() => setSelectedCapability(cap)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#121212] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-xs font-mono text-[#FAF7F0] hover:text-[#D4A017] transition-all"
                >
                  <span>Explore Architecture</span>
                  <ArrowUpRight size={14} className="text-[#D4A017]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================
          6. MULTI-COMPANY ARCHITECTURE (WARM CONTRAST SECTION)
          ======================================================== */}
      <section
        id="solutions"
        className="py-20 px-4 sm:px-8 bg-[#FAF7F0] text-[#1A1A1A] border-t border-b border-[#3A3A3A]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-[#B87333] font-bold block mb-2">
              Multi-Tenant Financial Isolation
            </span>
            <h2 className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1A1A1A]">
              One Platform. Separate Financial Workspaces.
            </h2>
            <p className="mt-3 text-sm text-[#3A3A3A] max-w-2xl mx-auto font-sans leading-relaxed">
              Finova AI is designed to serve multiple financial companies, each with its own authorised users, operations, reports and financial records. Each company's private data is isolated from other companies.
            </p>
          </div>

          {/* Architecture Hierarchy Diagram */}
          <div className="bg-[#F3EBDD] border border-[#D4A017]/30 rounded-2xl p-6 sm:p-10 shadow-md max-w-5xl mx-auto">
            <div className="space-y-6">
              {/* Level 1: Platform Administration */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#FAF7F0] border border-[#B87333]/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#121212] text-[#D4A017] flex items-center justify-center shrink-0">
                    <Server size={20} />
                  </div>
                  <div>
                    <h4 className="font-cinzel text-sm sm:text-base font-bold text-[#1A1A1A]">
                      Finova AI Platform Administration
                    </h4>
                    <p className="text-xs text-[#3A3A3A]">
                      Global SaaS infrastructure, tenant registration, platform user governance, and system-wide service health.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-3 py-1 rounded bg-[#F3EBDD] text-[#B87333] font-bold border border-[#B87333]/30 shrink-0">
                  Platform Root
                </span>
              </div>

              {/* Connector Arrow */}
              <div className="flex justify-center -my-2 text-[#B87333]">
                <ChevronRight size={20} className="rotate-90" />
              </div>

              {/* Level 2: Company Workspaces */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tenants.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-[#FAF7F0] border border-[#D4A017]/40 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs font-mono mb-2">
                      <span className="text-[#B87333] font-bold">{t.type}</span>
                      <span className="text-[10px] text-[#3A3A3A] px-1.5 py-0.5 rounded bg-[#F3EBDD]">
                        {t.status}
                      </span>
                    </div>
                    <h5 className="font-cinzel text-sm font-bold text-[#1A1A1A]">{t.name}</h5>
                    <p className="text-[11px] text-[#3A3A3A] mt-1 font-mono">
                      License: <code>{t.licenseNo}</code>
                    </p>
                    <div className="mt-3 pt-2 border-t border-[#3A3A3A]/10 text-[11px] text-[#3A3A3A] space-y-1">
                      <div className="flex justify-between">
                        <span>Currency Rail:</span>
                        <span className="font-bold text-[#1A1A1A]">{t.currency} ({t.currencySymbol})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Jurisdiction:</span>
                        <span>{t.headquarters.split(',')[0]}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Connector Arrow */}
              <div className="flex justify-center -my-2 text-[#B87333]">
                <ChevronRight size={20} className="rotate-90" />
              </div>

              {/* Level 3: Company Roles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#3A3A3A]/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Building2 size={16} className="text-[#B87333]" />
                    <span className="font-cinzel text-xs font-bold text-[#1A1A1A]">Company Admin</span>
                  </div>
                  <p className="text-[11px] text-[#3A3A3A]">
                    Manages company operations, internal teams, and tenant configurations.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#3A3A3A]/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <BarChart3 size={16} className="text-[#D4A017]" />
                    <span className="font-cinzel text-xs font-bold text-[#1A1A1A]">
                      Finance & Support Staff
                    </span>
                  </div>
                  <p className="text-[11px] text-[#3A3A3A]">
                    Performs AML monitoring, transaction analysis, and customer ticket resolution.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#3A3A3A]/20 sm:col-span-2 md:col-span-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Users size={16} className="text-[#1A1A1A]" />
                    <span className="font-cinzel text-xs font-bold text-[#1A1A1A]">
                      Company Customers
                    </span>
                  </div>
                  <p className="text-[11px] text-[#3A3A3A]">
                    Accesses isolated balances, accounts, verified documents, and client services.
                  </p>
                </div>
              </div>
            </div>

            {/* Isolation Guarantee Footnote */}
            <div className="mt-6 pt-4 border-t border-[#D4A017]/30 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#3A3A3A] gap-2">
              <span className="flex items-center gap-1.5 font-bold text-[#1A1A1A]">
                <ShieldCheck size={15} className="text-[#B87333]" />
                Enforced Tenant Partitioning
              </span>
              <span>
                Verified tenant identifiers ensure zero cross-institution data exposure.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          7. ROLE-BASED ACCESS
          ======================================================== */}
      <section className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t border-[#3A3A3A]">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-mono uppercase tracking-widest text-[#D4A017] block mb-2">
            Clearance Governance
          </span>
          <h2 className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-bold text-[#FAF7F0]">
            Granular Role-Based Access Control
          </h2>
          <p className="mt-3 text-sm text-[#9CA3AF] max-w-2xl mx-auto font-sans leading-relaxed">
            Every operational action and data view is protected by strict role boundaries. Public visitors do not have access to privileged systems.
          </p>
        </div>

        {/* 5 Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role, idx) => (
            <div
              key={idx}
              className={`p-6 rounded-2xl border ${role.color} flex flex-col justify-between shadow-lg`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#121212] border border-[#3A3A3A] flex items-center justify-center">
                    {role.icon}
                  </div>
                  <span className="text-[10px] font-mono text-[#E6C78B] uppercase tracking-wider">
                    {role.badge}
                  </span>
                </div>

                <h3 className="font-cinzel text-base font-bold text-[#FAF7F0]">
                  {role.title}
                </h3>

                <p className="mt-2 text-xs text-[#FAF7F0]/80 font-sans leading-relaxed">
                  {role.desc}
                </p>

                <div className="mt-4 pt-3 border-t border-[#3A3A3A] space-y-2">
                  <span className="text-[10px] font-mono text-[#9CA3AF] uppercase block">
                    Authorised Capabilities:
                  </span>
                  <ul className="space-y-1.5 text-xs text-[#FAF7F0]/85 font-mono">
                    {role.permissions.map((p, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-2">
                        <span className="text-[#D4A017] mt-0.5">·</span>
                        <span className="text-[11px] leading-tight">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================
          8. SECURITY AND TRUST SECTION
          ======================================================== */}
      <section className="py-20 px-4 sm:px-8 bg-[#262626] border-t border-[#3A3A3A]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-mono uppercase tracking-widest text-[#D4A017] block mb-2">
              Architecture & Integrity
            </span>
            <h2 className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-bold text-[#FAF7F0]">
              Enterprise Security & Trust
            </h2>
            <p className="mt-3 text-sm text-[#9CA3AF] max-w-2xl mx-auto font-sans leading-relaxed">
              Designed from first principles to meet the security and data isolation requirements of financial organizations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityFeatures.map((sec, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#121212] border border-[#3A3A3A] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#262626] border border-[#3A3A3A] flex items-center justify-center">
                      {sec.icon}
                    </div>
                    <span className="text-[10px] font-mono text-[#D4A017]">
                      {sec.status}
                    </span>
                  </div>

                  <h3 className="font-cinzel text-base font-bold text-[#FAF7F0]">
                    {sec.title}
                  </h3>

                  <p className="mt-2 text-xs text-[#9CA3AF] font-sans leading-relaxed">
                    {sec.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          9. DASHBOARD PREVIEW (SUPER ADMIN PLATFORM PREVIEW)
          ======================================================== */}
      <section className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t border-[#3A3A3A]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-mono uppercase tracking-widest text-[#D4A017] block mb-2">
            Platform Operator Console
          </span>
          <h2 className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-bold text-[#FAF7F0]">
            Super Admin Platform Overview
          </h2>
          <p className="mt-3 text-sm text-[#9CA3AF] max-w-2xl mx-auto font-sans leading-relaxed">
            Live preview of platform-level management metrics across all registered financial institutions.
          </p>
        </div>

        {/* Dashboard Preview Container */}
        <div className="rounded-2xl bg-[#262626] border border-[#3A3A3A] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-[#3A3A3A]">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[#D4A017] animate-pulse" />
              <span className="text-xs font-mono font-bold text-[#FAF7F0]">
                Super Admin Operator Dashboard
              </span>
              <span className="text-[11px] font-mono text-[#E6C78B]">
                (Demonstration Platform Data)
              </span>
            </div>

            <button
              onClick={onGoToLogin}
              className="text-xs font-mono text-[#D4A017] hover:text-[#E6C78B] flex items-center gap-1.5 transition-colors"
            >
              <span>Access Operator Login</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* 6 Platform SaaS Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 font-mono text-xs">
            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <span className="text-[10px] text-[#9CA3AF] block uppercase">Registered Workspaces</span>
              <span className="font-cinzel text-lg font-bold text-[#FAF7F0] mt-1 block">
                {saasMetrics.totalTenants} Companies
              </span>
              <span className="text-[10px] text-[#D4A017]">3 Active in Platform</span>
            </div>

            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <span className="text-[10px] text-[#9CA3AF] block uppercase">Aggregate Users</span>
              <span className="font-cinzel text-lg font-bold text-[#FAF7F0] mt-1 block">
                {saasMetrics.aggregateUsers.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#E6C78B]">Across all tenants</span>
            </div>

            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <span className="text-[10px] text-[#9CA3AF] block uppercase">SaaS MRR (Simulated)</span>
              <span className="font-cinzel text-lg font-bold text-[#FAF7F0] mt-1 block">
                ${(saasMetrics.totalMrr / 1000).toFixed(1)}k
              </span>
              <span className="text-[10px] text-[#B87333]">Subscription fees</span>
            </div>

            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <span className="text-[10px] text-[#9CA3AF] block uppercase">Uptime Reliability</span>
              <span className="font-cinzel text-lg font-bold text-[#FAF7F0] mt-1 block">
                {saasMetrics.systemUptime}
              </span>
              <span className="text-[10px] text-[#D4A017]">All regions green</span>
            </div>

            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <span className="text-[10px] text-[#9CA3AF] block uppercase">AI Query Volume</span>
              <span className="font-cinzel text-lg font-bold text-[#FAF7F0] mt-1 block">
                {saasMetrics.aiQueriesToday.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#E6C78B]">Inferences today</span>
            </div>

            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A]">
              <span className="text-[10px] text-[#9CA3AF] block uppercase">API Error Rate</span>
              <span className="font-cinzel text-lg font-bold text-[#FAF7F0] mt-1 block">
                {saasMetrics.apiErrorRate}
              </span>
              <span className="text-[10px] text-[#D4A017]">Well within SLA</span>
            </div>
          </div>

          {/* Table of Onboarded Workspaces Preview */}
          <div className="overflow-x-auto rounded-xl border border-[#3A3A3A] bg-[#121212]">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#262626] border-b border-[#3A3A3A] text-[#9CA3AF]">
                <tr>
                  <th className="py-2.5 px-4 font-normal">Company Workspace</th>
                  <th className="py-2.5 px-4 font-normal">Institution Type</th>
                  <th className="py-2.5 px-4 font-normal">Assigned Plan</th>
                  <th className="py-2.5 px-4 font-normal">Status</th>
                  <th className="py-2.5 px-4 font-normal">Clearance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A] text-[#FAF7F0]">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-[#262626]/50">
                    <td className="py-3 px-4 font-bold text-[#FAF7F0] flex items-center gap-2">
                      <Building2 size={14} className="text-[#D4A017]" />
                      <span>{t.name}</span>
                    </td>
                    <td className="py-3 px-4 text-[#9CA3AF]">{t.type}</td>
                    <td className="py-3 px-4 text-[#E6C78B]">{t.plan}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#262626] text-[#D4A017] border border-[#D4A017]/30">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={onGoToLogin}
                        className="text-[11px] text-[#D4A017] hover:text-[#E6C78B] underline flex items-center gap-1"
                      >
                        <span>Inspect in Portal</span>
                        <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ========================================================
          10. ABOUT SECTION
          ======================================================== */}
      <section
        id="about"
        className="py-20 px-4 sm:px-8 bg-[#FAF7F0] text-[#1A1A1A] border-t border-[#3A3A3A]"
      >
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[#B87333] font-bold block mb-2">
                Mission & Philosophy
              </span>
              <h2 className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1A1A1A]">
                Financial Operations, Enhanced by AI.
              </h2>
              <p className="mt-4 text-sm text-[#3A3A3A] font-sans leading-relaxed">
                Finova AI aims to bring financial analytics, document intelligence, fraud monitoring and customer operations into one integrated workspace.
              </p>
              <p className="mt-3 text-sm text-[#3A3A3A] font-sans leading-relaxed">
                Traditional financial institutions often struggle with fragmented software stacks—navigating separate platforms for transaction screening, identity verification, document handling, and customer ticketing. Finova AI unifies these critical operational components under a coherent multi-tenant architecture.
              </p>

              <div className="mt-6 pt-6 border-t border-[#3A3A3A]/20 grid grid-cols-2 gap-4 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-[#B87333] uppercase block font-bold">Design Principle</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">Zero-Pill Restraint</span>
                  <p className="text-[11px] text-[#3A3A3A] mt-0.5">Focus on readability and data clarity.</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#B87333] uppercase block font-bold">System Principle</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">Tenant Partitioning</span>
                  <p className="text-[11px] text-[#3A3A3A] mt-0.5">Guaranteed privacy between firms.</p>
                </div>
              </div>
            </div>

            {/* Visual Brand Card */}
            <div className="p-8 rounded-2xl bg-[#F3EBDD] border border-[#D4A017]/40 shadow-lg flex flex-col items-center text-center">
              <FinovaLogo variant="icon" size="xl" className="mb-4" />
              <h3 className="font-cinzel text-xl font-bold text-[#1A1A1A]">
                Finova AI Platform
              </h3>
              <p className="text-xs font-mono text-[#B87333] mt-1 font-semibold">
                Smarter Finance. Faster Operations. Better Decisions.
              </p>
              <p className="text-xs text-[#3A3A3A] mt-4 max-w-sm leading-relaxed">
                Engineered to equip operations, risk, compliance, and customer teams with real-time financial intelligence.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => scrollToSection('contact')}
                  className="px-5 py-2 rounded-xl bg-[#1A1A1A] text-[#FAF7F0] text-xs font-mono hover:bg-[#3A3A3A] transition-colors"
                >
                  Contact Desk
                </button>
                <button
                  onClick={onGoToSignup}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold text-xs font-mono hover:brightness-110 transition-all"
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          11. FINAL CALL TO ACTION
          ======================================================== */}
      <section className="py-20 px-4 sm:px-8 max-w-7xl mx-auto text-center border-t border-[#3A3A3A]">
        <div className="max-w-3xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-widest text-[#D4A017] block mb-2">
            Get Started
          </span>
          <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-black text-[#FAF7F0] leading-tight">
            Build a Smarter Financial Operations Workflow.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#9CA3AF] max-w-2xl mx-auto font-sans leading-relaxed">
            Discover how Finova AI unifies transaction intelligence, fraud surveillance, document OCR, and customer workflows.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 font-mono text-xs">
            <button
              onClick={() => scrollToSection('platform')}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all flex items-center gap-2"
            >
              <span>Explore the Platform</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="px-8 py-3.5 rounded-xl bg-[#262626] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#FAF7F0] transition-all"
            >
              <span>Contact Us</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          CONTACT FORM SECTION
          ======================================================== */}
      <section id="contact" className="py-16 px-4 sm:px-8 bg-[#262626] border-t border-[#3A3A3A]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-[#D4A017] block mb-1">
              Institutional Communications
            </span>
            <h3 className="font-cinzel text-2xl font-bold text-[#FAF7F0]">
              Connect With Finova AI
            </h3>
            <p className="text-xs text-[#9CA3AF] font-sans mt-1">
              Inquire about enterprise workspace setup, customized integration, or request platform technical documentation.
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl bg-[#121212] border border-[#3A3A3A] shadow-xl">
            {contactSubmitted ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle2 size={40} className="text-[#D4A017] mx-auto" />
                <h4 className="font-cinzel text-lg font-bold text-[#FAF7F0]">Inquiry Submitted Successfully</h4>
                <p className="text-xs font-mono text-[#9CA3AF]">
                  Thank you for contacting Finova AI. Our platform engineering team will respond to your inquiry shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#FAF7F0] mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="e.g. Elena Rostova"
                      className="w-full bg-[#262626] border border-[#3A3A3A] focus:border-[#D4A017] rounded-xl px-3.5 py-2.5 text-[#FAF7F0] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[#FAF7F0] mb-1">Corporate Email</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="e.rostova@institution.com"
                      className="w-full bg-[#262626] border border-[#3A3A3A] focus:border-[#D4A017] rounded-xl px-3.5 py-2.5 text-[#FAF7F0] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#FAF7F0] mb-1">Organization / Institution Name</label>
                    <input
                      type="text"
                      required
                      value={contactForm.company}
                      onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                      placeholder="e.g. Apex Global Bank"
                      className="w-full bg-[#262626] border border-[#3A3A3A] focus:border-[#D4A017] rounded-xl px-3.5 py-2.5 text-[#FAF7F0] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[#FAF7F0] mb-1">Inquiry Purpose</label>
                    <select
                      value={contactForm.inquiryType}
                      onChange={(e) => setContactForm({ ...contactForm, inquiryType: e.target.value })}
                      className="w-full bg-[#262626] border border-[#3A3A3A] focus:border-[#D4A017] rounded-xl px-3.5 py-2.5 text-[#FAF7F0] focus:outline-none transition-colors cursor-pointer"
                    >
                      <option value="Enterprise Evaluation">Enterprise Workspace Evaluation</option>
                      <option value="AML Integration">AML & Surveillance Inquiry</option>
                      <option value="KYC Workflows">KYC & Document Processing</option>
                      <option value="Technical Partnership">Technical Integration Support</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[#FAF7F0] mb-1">Message Details</label>
                  <textarea
                    rows={3}
                    required
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Specify volume requirements, desired workspace features, or integration timeline..."
                    className="w-full bg-[#262626] border border-[#3A3A3A] focus:border-[#D4A017] rounded-xl px-3.5 py-2.5 text-[#FAF7F0] focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#E6C78B] to-[#D4A017] text-[#1A1A1A] font-bold text-xs hover:brightness-110 shadow-[0_0_15px_rgba(212,160,23,0.3)] transition-all flex items-center justify-center gap-2"
                >
                  <Send size={14} />
                  <span>Send Institutional Message</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================
          12. FOOTER
          ======================================================== */}
      <footer className="py-12 px-4 sm:px-8 max-w-7xl mx-auto border-t border-[#3A3A3A] font-mono text-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[#3A3A3A]">
          <div>
            <FinovaLogo variant="full" size="md" />
            <p className="text-[11px] text-[#9CA3AF] mt-1.5 font-sans">
              Smarter Finance. Faster Operations. Better Decisions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[#9CA3AF]">
            <button onClick={() => scrollToSection('platform')} className="hover:text-[#D4A017] transition-colors">
              Platform
            </button>
            <button onClick={() => scrollToSection('solutions')} className="hover:text-[#D4A017] transition-colors">
              Solutions
            </button>
            <button onClick={() => scrollToSection('about')} className="hover:text-[#D4A017] transition-colors">
              About
            </button>
            <button onClick={() => scrollToSection('contact')} className="hover:text-[#D4A017] transition-colors">
              Contact
            </button>
            <button onClick={() => setPrivacyModalOpen(true)} className="hover:text-[#D4A017] transition-colors">
              Privacy Policy
            </button>
            <button onClick={() => setTermsModalOpen(true)} className="hover:text-[#D4A017] transition-colors">
              Terms of Service
            </button>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#9CA3AF]">
          <p>© 2026 Finova AI Systems. All rights reserved.</p>
          <p className="text-[#D4A017]/80">Multi-Tenant Financial Operations Platform</p>
        </div>
      </footer>

      {/* ========================================================
          CAPABILITY DETAIL MODAL (Working interactive preview)
          ======================================================== */}
      {selectedCapability && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-xl w-full rounded-2xl bg-[#262626] border border-[#3A3A3A] p-6 shadow-2xl relative font-sans">
            <button
              onClick={() => setSelectedCapability(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A] transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#121212] border border-[#3A3A3A] flex items-center justify-center">
                {selectedCapability.icon}
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#D4A017] uppercase tracking-wider">
                  {selectedCapability.category}
                </span>
                <h3 className="font-cinzel text-xl font-bold text-[#FAF7F0]">
                  {selectedCapability.title}
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#FAF7F0]/90 leading-relaxed mb-4">
              {selectedCapability.details}
            </p>

            <div className="p-3 rounded-xl bg-[#121212] border border-[#3A3A3A] mb-5 font-mono text-xs flex justify-between items-center">
              <span className="text-[#9CA3AF]">{selectedCapability.metricsLabel}:</span>
              <span className="text-[#E6C78B] font-bold">{selectedCapability.metricsValue}</span>
            </div>

            <div className="flex items-center justify-end gap-3 font-mono text-xs">
              <button
                onClick={() => setSelectedCapability(null)}
                className="px-4 py-2 rounded-xl bg-[#121212] border border-[#3A3A3A] text-[#FAF7F0] hover:bg-[#3A3A3A]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedCapability(null);
                  onGoToLogin();
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold hover:brightness-110 flex items-center gap-1.5"
              >
                <span>Launch in Portal</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PRIVACY POLICY MODAL
          ======================================================== */}
      {privacyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-2xl w-full rounded-2xl bg-[#262626] border border-[#3A3A3A] p-6 shadow-2xl relative font-sans max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setPrivacyModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <h3 className="font-cinzel text-xl font-bold text-[#FAF7F0] mb-2">
              Privacy Policy · Finova AI
            </h3>
            <p className="text-xs font-mono text-[#D4A017] mb-4">
              Effective Date: October 2026
            </p>

            <div className="space-y-4 text-xs text-[#FAF7F0]/80 leading-relaxed font-sans">
              <p>
                Finova AI is an enterprise financial operations SaaS platform. This Privacy Policy outlines our procedures regarding the collection, processing, and protection of company customer records and operational telemetry.
              </p>
              <div>
                <h4 className="font-bold text-[#FAF7F0] mb-1">1. Tenant Data Isolation</h4>
                <p>
                  All transactional, identity, and customer records uploaded into an individual company workspace remain isolated within that tenant's verified partition. Finova AI does not aggregate private banking records across separate customer companies.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#FAF7F0] mb-1">2. Role-Based Access Enforcement</h4>
                <p>
                  Access to financial records is strictly restricted to authenticated users bearing authorized clearance levels assigned by the company administrator.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#FAF7F0] mb-1">3. Immutable Audit Trails</h4>
                <p>
                  To comply with standard financial governance practices, all authentication events, administrative role changes, and compliance queries are logged with timestamped signatures.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#3A3A3A] flex justify-end">
              <button
                onClick={() => setPrivacyModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold text-xs font-mono hover:brightness-110"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TERMS OF SERVICE MODAL
          ======================================================== */}
      {termsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-2xl w-full rounded-2xl bg-[#262626] border border-[#3A3A3A] p-6 shadow-2xl relative font-sans max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setTermsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#121212] text-[#9CA3AF] hover:text-[#FAF7F0] border border-[#3A3A3A]"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <h3 className="font-cinzel text-xl font-bold text-[#FAF7F0] mb-2">
              Terms of Service · Finova AI
            </h3>
            <p className="text-xs font-mono text-[#D4A017] mb-4">
              Version 4.2 · Enterprise Agreement
            </p>

            <div className="space-y-4 text-xs text-[#FAF7F0]/80 leading-relaxed font-sans">
              <p>
                These Terms of Service govern the access and use of Finova AI's multi-tenant financial operations platform, API gateways, document OCR engines, and analytics interfaces.
              </p>
              <div>
                <h4 className="font-bold text-[#FAF7F0] mb-1">1. Authorized Institutional Use</h4>
                <p>
                  Each company workspace must be operated in accordance with applicable financial regulations, compliance mandates, and AML/KYC requirements.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#FAF7F0] mb-1">2. Credential Security</h4>
                <p>
                  Company Administrators are responsible for managing access credentials for their staff. Public visitors are not granted access to privileged institutional dashboards without verified authentication.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#FAF7F0] mb-1">3. Demonstration & Simulated Metrics</h4>
                <p>
                  Sample dashboard figures on public pages are demonstration simulations intended to illustrate UI architecture and do not constitute actual financial institution results.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#3A3A3A] flex justify-end">
              <button
                onClick={() => setTermsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#E6C78B] text-[#1A1A1A] font-bold text-xs font-mono hover:brightness-110"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
