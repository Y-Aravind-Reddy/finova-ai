import React, { useState } from 'react';
import {
  FileSearch,
  Scan,
  CheckCircle2,
  Download,
  Upload,
  AlertCircle,
  FileText,
  ShieldCheck,
  Eye,
  RefreshCw,
  Cpu,
} from 'lucide-react';

interface DocumentPreset {
  id: string;
  name: string;
  type: string;
  size: string;
  resolution: string;
  issuer: string;
  fields: Record<string, string>;
  confidence: number;
}

export const DocumentOcrPage: React.FC = () => {
  const sampleDocs: DocumentPreset[] = [
    {
      id: 'doc-1',
      name: 'swiss_canton_trust_declaration_2026.pdf',
      type: 'Certified Trust Indenture',
      size: '4.82 MB',
      resolution: '600 DPI Native Optical',
      issuer: 'Canton of Zurich Notary Chamber',
      confidence: 99.84,
      fields: {
        'Document ID': 'ZUR-NOT-2026-98104',
        'Settlor / Grantor': 'Harrison Croft (Tier 3 Sovereign)',
        'Trustee Institution': 'Finova Geneva Custody SA',
        'Jurisdiction': 'Zurich, Switzerland',
        'Notary Stamp': 'Dr. Hansel V. Meyer (Oct 02, 2026)',
        'Asset Valuation': '$4,892,100 USD Equivalent',
        'Anti-Tampering Hash': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    },
    {
      id: 'doc-2',
      name: 'irs_form_w8ben_notarized.pdf',
      type: 'Certificate of Foreign Status of Beneficial Owner',
      size: '2.15 MB',
      resolution: '400 DPI Gray + OCR',
      issuer: 'Internal Revenue Service (US Dept of the Treasury)',
      confidence: 99.62,
      fields: {
        'Beneficial Owner': 'Victoria Habsburg-Lorraine',
        'Country of Citizenship': 'Austria / European Union',
        'Permanent Residence': 'Am Hof 4, 1010 Wien, Austria',
        'Foreign Tax ID (TIN)': 'AT-U982104-FIN',
        'Treaty Article': 'Article 10(2)(b) - 15% Withholding Rate',
        'Signature Status': 'Cryptographically Certified Digital Seal',
      },
    },
    {
      id: 'doc-3',
      name: 'monaco_diplomatic_passport_scan.jpg',
      type: 'Sovereign Biometric Passport',
      size: '6.40 MB',
      resolution: '1200 DPI Micro-Lens',
      issuer: 'Principality of Monaco Civil Registry',
      confidence: 99.91,
      fields: {
        'Document Number': 'MCO-P-8829104',
        'Full Name': 'Sterling, Marcus Aurelius',
        'Date of Birth': '14 AUG 1978',
        'Machine Readable Zone (MRZ)': 'P<MCOSTERLING<<MARCUS<AURELIUS<<<<<<<<<<<<8829104<6MCO7808144M2908148<<<<<<<<<<<<<<02',
        'MRZ Checksum': 'VALID (0 Error Bits)',
        'Facial Match Confidence': '99.88% against Finova Biometric Vault',
      },
    },
  ];

  const [selectedDoc, setSelectedDoc] = useState<DocumentPreset>(sampleDocs[0]);
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(true);
  const [activeTab, setActiveTab] = useState<'extracted' | 'json' | 'preview'>('extracted');

  const handleTriggerScan = () => {
    setScanning(true);
    setScanComplete(false);
    setTimeout(() => {
      setScanning(false);
      setScanComplete(true);
    }, 1200);
  };

  const handleDownloadTelemetry = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(selectedDoc, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${selectedDoc.name}_ocr_telemetry.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              Dedicated Platform Engine
            </span>
            <span className="text-xs font-mono text-[#D4A017]">
              Engine: Finova Neural Vision OCR v6.1
            </span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            Document OCR Intelligence
          </h1>
          <p className="font-mono text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Automated optical character recognition, MRZ passport verification, apostille seal detection, and IRS tax document key-value extraction with 99.8% precision.
          </p>
        </div>

        <button
          onClick={handleTriggerScan}
          disabled={scanning}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-[0_0_20px_rgba(212,160,23,0.35)] transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {scanning ? <RefreshCw size={15} className="animate-spin" /> : <Scan size={15} />}
          <span>{scanning ? 'Running Neural Scan...' : 'Re-Analyze Document'}</span>
        </button>
      </div>

      {/* Main Content: Document Selector + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono text-xs">
        {/* Left: Document Vault Queue */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg">
            <h3 className="text-sm font-bold text-[#F5C542] flex items-center gap-2 mb-3">
              <FileText size={16} /> Sample Inspection Queue
            </h3>
            <p className="text-[11px] text-[#6B7280] mb-3">
              Select a certified sovereign document to inspect neural extraction layers:
            </p>

            <div className="space-y-2">
              {sampleDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setScanComplete(true);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    selectedDoc.id === doc.id
                      ? 'bg-gradient-to-br from-[#301B05] to-[#4A2C0A] border-[#F5C542] shadow-[0_0_15px_rgba(212,160,23,0.25)]'
                      : 'bg-[#141414] border-[#D4A017]/20 hover:border-[#D4A017]/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-[#FFF8E7] font-semibold">
                    <span className="truncate pr-2">{doc.name}</span>
                    <span className="text-[10px] text-[#F5C542] bg-[#111111] px-2 py-0.5 rounded border border-[#D4A017]/30">
                      {doc.confidence}%
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-[#D4A017]/80">
                    <span>{doc.type}</span>
                    <span>{doc.size}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Engine Health Stats */}
          <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-lg space-y-3">
            <h4 className="font-bold text-[#F5C542] flex items-center gap-2">
              <Cpu size={15} /> OCR Pipeline Telemetry
            </h4>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Model:</span>
                <span className="text-[#FFF8E7]">Finova Vision OCR v6.1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Average Latency:</span>
                <span className="text-[#FFF8E7]">214 ms per page</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Anti-Fraud Verification:</span>
                <span className="text-[#C08A00] font-bold">SHA-256 Validated</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Supported Formats:</span>
                <span className="text-[#FFF8E7]">PDF, TIFF, JPEG, PNG, DICOM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Extracted Results & Visual Inspector (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex flex-col justify-between">
          <div>
            {/* Tab header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#D4A017]/20 gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('extracted')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                    activeTab === 'extracted'
                      ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111]'
                      : 'bg-[#141414] text-[#D4A017] hover:text-[#FFF8E7]'
                  }`}
                >
                  Extracted Entities
                </button>
                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                    activeTab === 'json'
                      ? 'bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111]'
                      : 'bg-[#141414] text-[#D4A017] hover:text-[#FFF8E7]'
                  }`}
                >
                  Raw JSON Telemetry
                </button>
              </div>

              <button
                onClick={handleDownloadTelemetry}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141414] border border-[#D4A017]/40 text-[#F5C542] hover:bg-[#301B05] transition-colors"
              >
                <Download size={13} /> Export Extraction
              </button>
            </div>

            {/* Document Info Card */}
            <div className="mt-4 p-4 rounded-xl bg-[#141414] border border-[#D4A017]/25 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase text-[#D4A017] font-bold">Active Document</span>
                <p className="text-sm font-bold text-[#FFF8E7]">{selectedDoc.name}</p>
                <p className="text-[11px] text-[#6B7280]">
                  {selectedDoc.type} • {selectedDoc.resolution}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-[#6B7280] block">Optical Confidence</span>
                  <span className="text-base font-bold text-[#F5C542]">{selectedDoc.confidence}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#301B05] border border-[#D4A017]/40 text-[#F5C542]">
                  <CheckCircle2 size={20} />
                </div>
              </div>
            </div>

            {/* Scanning Progress or Content */}
            {scanning ? (
              <div className="my-12 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full border-4 border-[#D4A017]/20 border-t-[#F5C542] animate-spin" />
                <p className="text-[#D4A017] font-bold">Scanning Optical Neural Layers...</p>
                <p className="text-[11px] text-[#6B7280]">
                  Calibrating font kernels, deskewing page layout, and extracting entity bounding boxes.
                </p>
              </div>
            ) : (
              <div className="mt-4">
                {activeTab === 'extracted' && (
                  <div className="space-y-2.5">
                    {Object.entries(selectedDoc.fields).map(([k, v], idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#111111] border border-[#301B05] hover:border-[#D4A017]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <span className="text-[#D4A017] font-semibold text-[11px]">{k}</span>
                        <span className="text-[#FFF8E7] font-mono break-all text-right sm:max-w-md">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'json' && (
                  <pre className="p-4 rounded-xl bg-[#111111] border border-[#D4A017]/25 text-[11px] text-[#D4A017] overflow-x-auto max-h-[420px] font-mono">
                    {JSON.stringify(selectedDoc, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-[#D4A017]/20 flex items-center justify-between text-[11px] text-[#6B7280]">
            <span>Verified with Finova Sovereign Document Standard</span>
            <span className="text-[#D4A017]">Issuer: {selectedDoc.issuer}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
