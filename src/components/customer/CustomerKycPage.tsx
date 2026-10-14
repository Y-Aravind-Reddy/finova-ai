import React from 'react';
import { ShieldCheck, CheckCircle2, FileText, Fingerprint, Award, Lock } from 'lucide-react';
import { CUSTOMER_DATASET } from '../../data/finovaDatasets';

export const CustomerKycPage: React.FC = () => {
  const profile = CUSTOMER_DATASET.profile;

  const verifications = [
    {
      title: 'Biometric Face & Liveness Match',
      standard: 'ISO 30107-3 Level 2 Compliant',
      status: 'Verified (99.8% Confidence)',
      date: 'Aug 14, 2026',
    },
    {
      title: 'Monaco Diplomatic Passport',
      standard: 'ICAO Doc 9303 MRZ Certified',
      status: 'Valid until Aug 2029',
      date: 'Aug 14, 2026',
    },
    {
      title: 'IRS Form W-8BEN Apostille',
      standard: 'US Treasury Withholding Treaty',
      status: 'Certified Active (15% Rate)',
      date: 'Sep 02, 2026',
    },
    {
      title: 'Zurich Cantonal Indenture of Trust',
      standard: 'Swiss Civil Code Art. 335',
      status: 'Notarized & Registered',
      date: 'Oct 02, 2026',
    },
    {
      title: 'Source of Sovereign Wealth Verification',
      standard: 'FATF Recommendation 10 Standard',
      status: 'Tier 3 Sovereign Clearance',
      date: 'Aug 20, 2026',
    },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Accredited Status
            </span>
            <span className="text-xs text-[#D4A017]">Tier 3 Sovereign Clearance</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            KYC & Accreditation Standing
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Sovereign identity verification certificates, biometric passports, and global compliance passports maintained in encrypted enclaves.
          </p>
        </div>

        <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
          <span className="text-[10px] text-[#6B7280] block">Compliance Rating</span>
          <span className="text-sm font-bold text-[#F5C542]">100% Fully Verified</span>
        </div>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2 pb-3 border-b border-[#D4A017]/20">
          <ShieldCheck size={16} className="text-[#F5C542]" /> Verified Compliance Credentials
        </h3>

        <div className="space-y-3">
          {verifications.map((v, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <span className="font-bold text-[#FFF8E7] text-sm">{v.title}</span>
                <p className="text-[11px] text-[#6B7280] mt-0.5">{v.standard}</p>
                <p className="text-[10px] text-[#D4A017] mt-1">Verified on: {v.date}</p>
              </div>

              <span className="px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#301B05] text-[#F5C542] border border-[#D4A017]/40 flex items-center gap-1.5 self-start sm:self-auto">
                <CheckCircle2 size={13} /> {v.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
