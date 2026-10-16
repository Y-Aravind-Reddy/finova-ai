import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, CheckCircle2, FileText, Fingerprint, Award, Lock, RotateCw, Loader2, UploadCloud } from 'lucide-react';
import { CustomerDocument } from '../../data/finovaDatasets';
import { fetchKycRecordsResultFromDb } from '../../services/finovaDatabase';

interface CustomerKycPageProps {
  tenantId?: string;
  onNavigateSection?: (section: string) => void;
}

export const CustomerKycPage: React.FC<CustomerKycPageProps> = ({
  tenantId = 'tenant_apex_bank',
  onNavigateSection,
}) => {
  const [records, setRecords] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const loadKyc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchKycRecordsResultFromDb(tenantId);
      setRecords(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadKyc();
  }, [loadKyc]);

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
            Sovereign identity verification certificates, biometric passports, and global compliance credentials from <code>public.kyc_records</code>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadKyc()}
            disabled={loading}
            title="Refresh KYC records"
            className="p-2.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 text-[#F5C542] hover:bg-[#301B05] transition-all"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="p-3 bg-[#141414] rounded-xl border border-[#D4A017]/30 text-right">
            <span className="text-[10px] text-[#6B7280] block">Compliance Ingestion</span>
            <span className="text-sm font-bold text-[#F5C542]">
              {records.length > 0 ? `${records.length} Documents Verified` : '0 Documents On File'}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2 pb-3 border-b border-[#D4A017]/20">
          <ShieldCheck size={16} className="text-[#F5C542]" /> Verified Compliance Credentials ({records.length})
        </h3>

        {loading ? (
          <div className="py-12 text-center text-[#9CA3AF]">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-[#D4A017]" />
            <p>Querying public.kyc_records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-[#9CA3AF] border border-dashed border-[#D4A017]/20 rounded-xl">
            <ShieldCheck size={36} className="mx-auto mb-3 text-[#D4A017] opacity-60" />
            <p className="text-sm font-bold text-[#FAF7F0]">No KYC Records Ingested</p>
            <p className="text-[11px] text-[#6B7280] mt-1 max-w-md mx-auto">
              Per strict compliance rules, <code>public.kyc_records</code> remains empty in the UI until genuine customer accreditation files are uploaded and indexed.
            </p>
            {onNavigateSection && (
              <button
                onClick={() => onNavigateSection('/customer/documents')}
                className="mt-4 px-4 py-2 rounded-lg bg-[#301B05] border border-[#D4A017]/40 text-[#F5C542] text-[11px] font-bold hover:bg-[#4A2C0A] inline-flex items-center gap-1.5"
              >
                <UploadCloud size={13} />
                Upload Sovereign Documents
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((v) => (
              <div
                key={v.id}
                className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <span className="font-bold text-[#FFF8E7] text-sm">{v.title}</span>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">{v.documentType} • Size: {v.fileSize}</p>
                  <p className="text-[10px] text-[#D4A017] mt-1">Uploaded: {v.uploadedAt} • By: {v.verifiedBy}</p>
                </div>

                <span className="px-3 py-1.5 rounded-full text-[10px] font-bold bg-[#301B05] text-[#F5C542] border border-[#D4A017]/40 flex items-center gap-1.5 self-start sm:self-auto">
                  <CheckCircle2 size={13} /> {v.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
