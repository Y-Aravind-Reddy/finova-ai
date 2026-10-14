import React, { useState } from 'react';
import { Settings, Shield, Bell, Lock, Server, Save, Check } from 'lucide-react';

export const SuperAdminSystemConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'platform' | 'security' | 'notifications'>('platform');
  const [saved, setSaved] = useState(false);

  // Form states
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [twoFactorEnforce, setTwoFactorEnforce] = useState(true);
  const [ipWhitelist, setIpWhitelist] = useState('194.209.12.0/24, 185.122.10.45');
  const [hardwareKeyRequired, setHardwareKeyRequired] = useState(true);

  const [slackAlerts, setSlackAlerts] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsCriticalOnly, setSmsCriticalOnly] = useState(true);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Super Admin Exclusive
            </span>
            <span className="text-xs text-[#D4A017]">Core Configuration</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            System & Security Configuration
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Configure institutional platform parameters, hardware security key enforcement, IP whitelisting, and critical operational alert channels.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all flex items-center gap-2"
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          <span>{saved ? 'Configurations Saved!' : 'Commit Changes'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#D4A017]/20 pb-2">
        {[
          { key: 'platform', label: 'Platform Settings', icon: <Server size={14} /> },
          { key: 'security', label: 'Security & Auth Settings', icon: <Lock size={14} /> },
          { key: 'notifications', label: 'Notification Settings', icon: <Bell size={14} /> },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
              activeTab === t.key
                ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] shadow-lg'
                : 'bg-[#1E1E1E] text-[#D4A017] border border-[#D4A017]/30 hover:bg-[#301B05]'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Form Body */}
      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.6)] space-y-5">
        {activeTab === 'platform' && (
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="text-[#D4A017] font-bold block mb-1">
                Settlement Clearing Rails
              </label>
              <div className="p-3 bg-[#111111] rounded-xl border border-[#301B05] text-[#FAF7F0] space-y-1">
                <p>• SWIFT GPI Integration: <span className="text-[#F5C542] font-bold">Enabled (Live)</span></p>
                <p>• FedNow Real-Time Settlement: <span className="text-[#F5C542] font-bold">Enabled (Active)</span></p>
                <p>• SEPA Instant Rail: <span className="text-[#F5C542] font-bold">Enabled (Active)</span></p>
              </div>
            </div>

            <div>
              <label className="text-[#D4A017] font-bold block mb-1">
                Session Idle Timeout (Minutes)
              </label>
              <input
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
              />
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#301B05]">
              <div>
                <span className="font-bold text-[#FFF8E7] block">Enforce Universal Multi-Factor (2FA)</span>
                <span className="text-[11px] text-[#6B7280]">Requires TOTP or hardware security key for all institutional roles.</span>
              </div>
              <input
                type="checkbox"
                checked={twoFactorEnforce}
                onChange={(e) => setTwoFactorEnforce(e.target.checked)}
                className="w-4 h-4 accent-[#F5C542]"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#301B05]">
              <div>
                <span className="font-bold text-[#FFF8E7] block">Hardware Key Required for Wire Clearance</span>
                <span className="text-[11px] text-[#6B7280]">FIDO2 WebAuthn key required for settlements over $1,000,000 USD.</span>
              </div>
              <input
                type="checkbox"
                checked={hardwareKeyRequired}
                onChange={(e) => setHardwareKeyRequired(e.target.checked)}
                className="w-4 h-4 accent-[#F5C542]"
              />
            </div>

            <div>
              <label className="text-[#D4A017] font-bold block mb-1">
                Institutional IP Whitelist CIDR
              </label>
              <input
                type="text"
                value={ipWhitelist}
                onChange={(e) => setIpWhitelist(e.target.value)}
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
              />
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#301B05]">
              <div>
                <span className="font-bold text-[#FFF8E7] block">Security Operations Slack Webhook</span>
                <span className="text-[11px] text-[#6B7280]">Post real-time P1 fraud and structuring incidents to #finova-secops.</span>
              </div>
              <input
                type="checkbox"
                checked={slackAlerts}
                onChange={(e) => setSlackAlerts(e.target.checked)}
                className="w-4 h-4 accent-[#F5C542]"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#301B05]">
              <div>
                <span className="font-bold text-[#FFF8E7] block">Critical SMS Dispatch for Lead Risk Officers</span>
                <span className="text-[11px] text-[#6B7280]">Send encrypted SMS alerts for freeze protocols over $5M USD.</span>
              </div>
              <input
                type="checkbox"
                checked={smsCriticalOnly}
                onChange={(e) => setSmsCriticalOnly(e.target.checked)}
                className="w-4 h-4 accent-[#F5C542]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
