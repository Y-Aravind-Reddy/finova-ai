import React, { useState } from 'react';
import { Lock, Shield, Key, Smartphone, Save, Check } from 'lucide-react';
import { UserAccount } from '../../data/finovaDatasets';
import { getStoredSession } from '../../data/authStore';

interface CustomerSettingsPageProps {
  currentUser?: UserAccount;
}

export const CustomerSettingsPage: React.FC<CustomerSettingsPageProps> = ({ currentUser: propUser }) => {
  const activeUser = propUser || getStoredSession()?.user;
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [hardwareKey, setHardwareKey] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Enclave Security
            </span>
            <span className="text-xs text-[#D4A017]">{activeUser?.email || 'Verified Account'}</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Account & Security Settings
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Manage hardware authentication tokens, biometric cryptographic enclaves, and transaction limit thresholds.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2"
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          <span>{saved ? 'Settings Saved' : 'Save Preferences'}</span>
        </button>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-6 shadow-lg space-y-5 max-w-2xl">
        <div className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#301B05]">
          <div>
            <span className="font-bold text-[#FFF8E7] block">Apple TouchID / FaceID Biometric Enclave</span>
            <span className="text-[11px] text-[#6B7280]">
              Unlock private wealth vaults and sign transactions with device biometrics.
            </span>
          </div>
          <input
            type="checkbox"
            checked={biometricEnabled}
            onChange={(e) => setBiometricEnabled(e.target.checked)}
            className="w-4 h-4 accent-[#F5C542]"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#301B05]">
          <div>
            <span className="font-bold text-[#FFF8E7] block">FIDO2 YubiKey Hardware Security Token</span>
            <span className="text-[11px] text-[#6B7280]">
              Mandatory hardware key tap for wire transfers exceeding $250,000 USD.
            </span>
          </div>
          <input
            type="checkbox"
            checked={hardwareKey}
            onChange={(e) => setHardwareKey(e.target.checked)}
            className="w-4 h-4 accent-[#F5C542]"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#301B05]">
          <div>
            <span className="font-bold text-[#FFF8E7] block">Encrypted Wire SMS Bulletins</span>
            <span className="text-[11px] text-[#6B7280]">
              Instant text notification to {activeUser?.phone || '+1 (212) 555-0100'} on wire releases.
            </span>
          </div>
          <input
            type="checkbox"
            checked={smsAlerts}
            onChange={(e) => setSmsAlerts(e.target.checked)}
            className="w-4 h-4 accent-[#F5C542]"
          />
        </div>

        <div className="pt-3 border-t border-[#D4A017]/20 space-y-2">
          <span className="text-[10px] text-[#D4A017] uppercase font-bold block">Assigned Security Clearance</span>
          <p className="text-[11px] text-[#FAF7F0]">
            Tier: <strong className="text-[#F5C542]">Tier 3 Sovereign Wealth Clearance</strong>
          </p>
          <p className="text-[11px] text-[#FAF7F0]">
            Custody Relationship Bank: <strong className="text-[#FFF8E7]">Finova Custody SA, Geneva</strong>
          </p>
        </div>
      </div>
    </div>
  );
};
