import React, { useState } from 'react';
import { Bell, Shield, DollarSign, Clock, Check, Trash2 } from 'lucide-react';

interface AlertNotice {
  id: string;
  title: string;
  description: string;
  date: string;
  read: boolean;
  type: 'security' | 'transaction' | 'system';
}

export const CustomerNotificationsPage: React.FC = () => {
  const [notices, setNotices] = useState<AlertNotice[]>([
    {
      id: 'NOT-01',
      title: 'SWIFT Wire Outflow Confirmation ($450,000 USD)',
      description: 'Your wire instruction to Geneva Private Bank was verified via biometric authorization and settled via pacs.008.',
      date: 'Today, 09:14 UTC',
      read: false,
      type: 'transaction',
    },
    {
      id: 'NOT-02',
      title: 'Biometric Login from St. Moritz IP Enclave',
      description: 'Secure session initiated via Apple TouchID / FIDO2 security token at IP 84.115.190.12.',
      date: 'Today, 08:30 UTC',
      read: false,
      type: 'security',
    },
    {
      id: 'NOT-03',
      title: 'Treasury Coupon Credit Added to Liquid Vault ($82,410 USD)',
      description: 'Semi-annual Treasury reinvestment coupon credited directly to Acct #FNV-ACC-USD-01.',
      date: 'Yesterday, 17:00 UTC',
      read: true,
      type: 'transaction',
    },
    {
      id: 'NOT-04',
      title: 'Apostille Foreign Tax Verification Completed',
      description: 'Your IRS W-8BEN document was certified by the Finova Gold Identity Guard and archived in Sovereign Vault.',
      date: 'Oct 02, 2026',
      read: true,
      type: 'system',
    },
  ]);

  const markAllRead = () => {
    setNotices((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Security Stream
            </span>
            <span className="text-xs text-[#D4A017]">Encrypted Telemetry Dispatch</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Notifications & Alerts
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Real-time wire confirmations, biometric login telemetry, and compliance status bulletins.
          </p>
        </div>

        <button
          onClick={markAllRead}
          className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-[#301B05] text-[#D4A017] hover:text-[#FFF8E7] border border-[#D4A017]/30 text-xs font-bold transition-all"
        >
          Mark All As Read
        </button>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-3">
        {notices.map((n) => (
          <div
            key={n.id}
            className={`p-4 rounded-xl border transition-all ${
              n.read
                ? 'bg-[#141414] border-[#D4A017]/20 opacity-80'
                : 'bg-gradient-to-br from-[#301B05]/60 to-[#141414] border-[#F5C542]/50 shadow-md'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#F5C542] animate-pulse" />}
                <span className="font-bold text-[#FFF8E7] text-sm">{n.title}</span>
              </div>
              <span className="text-[10px] text-[#6B7280]">{n.date}</span>
            </div>
            <p className="text-[11px] text-[#FAF7F0]/80 mt-1 pl-4">{n.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
