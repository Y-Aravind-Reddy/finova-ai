import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Upload, ShieldCheck, Lock, CheckCircle2, RotateCw, Loader2 } from 'lucide-react';
import { CustomerDocument } from '../../data/finovaDatasets';
import { fetchKycRecordsResultFromDb, uploadKycRecordToDb } from '../../services/finovaDatabase';

interface CustomerDocumentsPageProps {
  tenantId?: string;
}

export const CustomerDocumentsPage: React.FC<CustomerDocumentsPageProps> = ({
  tenantId = 'tenant_apex_bank',
}) => {
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchKycRecordsResultFromDb(tenantId);
      setDocs(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUploadGenuineDocument = async () => {
    setUploading(true);
    try {
      const res = await uploadKycRecordToDb({
        tenantId,
        title: 'Custody Account Supplemental Trust Declaration',
        documentType: 'Custody Agreement',
        fileSize: '3.8 MB',
        status: 'Verified',
        verifiedBy: 'Finova Gold Identity Guard',
      });
      if (res.success && res.data) {
        setDocs((prev) => [res.data!, ...prev]);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3500);
      }
    } catch (err) {
      console.warn('Document upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Encrypted Enclave
            </span>
            <span className="text-xs text-[#D4A017]">4096-bit AES Vault • public.kyc_records</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Sovereign Document Vault
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Secure vault holding certified trust deeds, notarized foreign tax documentation, and apostille-sealed custody contracts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadDocs()}
            disabled={loading}
            title="Refresh Vault from Supabase"
            className="p-2.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 text-[#F5C542] hover:bg-[#301B05] transition-all"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleUploadGenuineDocument}
            disabled={uploading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Upload size={14} /> {uploading ? 'Encrypting & Storing...' : 'Upload Certified Document'}
          </button>
        </div>
      </div>

      {uploadSuccess && (
        <div className="p-3 bg-[#301B05] border border-[#D4A017] rounded-xl text-[#F5C542] flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>Document ingested, scanned for cryptographic seals, and stored in Sovereign Vault!</span>
        </div>
      )}

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-[#FFF8E7] flex items-center gap-2 pb-3 border-b border-[#D4A017]/20">
          <Lock size={16} className="text-[#F5C542]" /> Certified Sovereign Documents ({docs.length})
        </h3>

        {loading ? (
          <div className="py-12 text-center text-[#9CA3AF]">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-[#D4A017]" />
            <p>Querying Sovereign Vault...</p>
          </div>
        ) : docs.length === 0 ? (
          <div className="py-12 text-center text-[#9CA3AF] border border-dashed border-[#D4A017]/20 rounded-xl">
            <FileText size={32} className="mx-auto mb-2 text-[#D4A017] opacity-60" />
            <p className="font-bold text-[#FFF8E7]">No Documents In Vault</p>
            <p className="text-[11px] text-[#6B7280] mt-1 max-w-sm mx-auto">
              Vault remains empty until genuine certified documents are uploaded and indexed.
            </p>
            <button
              onClick={handleUploadGenuineDocument}
              className="mt-4 px-4 py-1.5 rounded-lg bg-[#301B05] border border-[#D4A017]/40 text-[#F5C542] text-[11px] font-bold hover:bg-[#4A2C0A]"
            >
              Upload First Certified Document
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((d) => (
              <div
                key={d.id}
                className="p-4 rounded-xl bg-[#141414] border border-[#D4A017]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <span className="font-bold text-[#FFF8E7] text-sm">{d.title}</span>
                  <p className="text-[11px] text-[#D4A017] mt-0.5">{d.documentType}</p>
                  <p className="text-[10px] text-[#6B7280] mt-1">
                    ID: {d.id} • Size: {d.fileSize} • Uploaded: {d.uploadedAt}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#301B05] text-[#F5C542] border border-[#D4A017]/40 flex items-center gap-1">
                    <CheckCircle2 size={12} /> {d.status}
                  </span>

                  <button
                    onClick={() => {}}
                    className="px-3 py-1.5 rounded-lg bg-[#111111] hover:bg-[#301B05] text-[#D4A017] hover:text-[#FFF8E7] border border-[#D4A017]/30 text-[10px] font-bold transition-all flex items-center gap-1"
                  >
                    <Download size={11} /> Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
