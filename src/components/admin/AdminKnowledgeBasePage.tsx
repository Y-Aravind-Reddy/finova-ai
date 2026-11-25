import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Edit3,
  FileText,
  Lock,
  RefreshCw,
  RotateCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { UserAccount } from '../../data/finovaDatasets';
import {
  checkRagHealth,
  deleteKnowledgeDocument,
  DocumentCategory,
  getIngestionStatus,
  getKnowledgeBaseStatus,
  getKnowledgeDocuments,
  KnowledgeBaseStatusResponse,
  KnowledgeDocumentRecord,
  RagApiError,
  RagCanonicalRole,
  RagHealthResponse,
  RagIndexStatus,
  reindexKnowledgeDocument,
  updateKnowledgeDocument,
  uploadKnowledgeDocument,
  KB_ACCEPTED_EXTENSIONS,
} from '../../services/ragService';

interface AdminKnowledgeBasePageProps {
  currentUser: UserAccount;
}

interface QueuedPdfFile {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error';
  message?: string;
}

const ROLE_OPTIONS: Array<{ value: RagCanonicalRole; label: string }> = [
  { value: 'ADMIN', label: 'Operations Admin (Private)' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'FINANCE_ANALYST', label: 'Finance Analyst' },
  { value: 'SUPPORT_EXECUTIVE', label: 'Support Executive' },
  { value: 'CUSTOMER', label: 'Private Wealth Customer' },
];

const CATEGORY_OPTIONS: DocumentCategory[] = [
  'POLICY',
  'PROCEDURE',
  'REGULATION',
  'GUIDE',
  'MANUAL',
];

const MAX_CLIENT_PDF_BYTES = 10 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const AdminKnowledgeBasePage: React.FC<AdminKnowledgeBasePageProps> = ({ currentUser }) => {
  // Strict ADMIN-only UI guard (server also enforces backend-verified role === 'ADMIN')
  const isAdmin = currentUser.role === 'ADMIN';

  const [documents, setDocuments] = useState<KnowledgeDocumentRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // Knowledge Base health, storage diagnostics & per-role coverage
  const [ragHealth, setRagHealth] = useState<RagHealthResponse | null>(null);
  const [ragHealthError, setRagHealthError] = useState<string | null>(null);
  const [kbStatus, setKbStatus] = useState<KnowledgeBaseStatusResponse | null>(null);
  const [ragIndexes, setRagIndexes] = useState<RagIndexStatus[]>([]);

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | RagCanonicalRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PROCESSING' | 'FAILED'>('ALL');

  // Upload queue & metadata form (default allowedRoles strictly private: ['ADMIN'])
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedPdfFile[]>([]);
  const [titleInput, setTitleInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<DocumentCategory>('POLICY');
  const [allowedRoles, setAllowedRoles] = useState<RagCanonicalRole[]>(['ADMIN']);
  const [isUploading, setIsUploading] = useState(false);

  // Edit metadata modal
  const [editingDoc, setEditingDoc] = useState<KnowledgeDocumentRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('POLICY');
  const [editRoles, setEditRoles] = useState<RagCanonicalRole[]>(['ADMIN']);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete confirmation modal
  const [deletingDoc, setDeletingDoc] = useState<KnowledgeDocumentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Re-index tracking
  const [reindexingId, setReindexingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingDocs(true);
    setDocsError(null);

    const [docsOutcome, healthOutcome, ingestOutcome, kbStatusOutcome] = await Promise.allSettled([
      getKnowledgeDocuments(),
      checkRagHealth(),
      getIngestionStatus(),
      getKnowledgeBaseStatus(),
    ]);

    if (docsOutcome.status === 'fulfilled') {
      setDocuments(docsOutcome.value);
    } else {
      const err = docsOutcome.reason;
      setDocsError(
        err instanceof RagApiError
          ? err.detail
          : (err as Error)?.message || 'Unable to load Knowledge Base documents.'
      );
    }

    if (healthOutcome.status === 'fulfilled') {
      setRagHealth(healthOutcome.value);
      setRagHealthError(null);
    } else {
      setRagHealth(null);
      setRagHealthError((healthOutcome.reason as Error)?.message || 'RAG service unreachable');
    }

    if (kbStatusOutcome.status === 'fulfilled') {
      setKbStatus(kbStatusOutcome.value);
      if (kbStatusOutcome.value.indexes?.length) {
        setRagIndexes(kbStatusOutcome.value.indexes);
      }
    } else {
      setKbStatus(null);
    }

    if (ingestOutcome.status === 'fulfilled' && ingestOutcome.value.indexes?.length) {
      setRagIndexes(ingestOutcome.value.indexes);
    }

    setLoadingDocs(false);
  }, [isAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      if (statusFilter !== 'ALL' && doc.status.toUpperCase() !== statusFilter) return false;
      if (roleFilter !== 'ALL' && !doc.allowedRoles.includes(roleFilter)) return false;
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.filename.toLowerCase().includes(q) ||
        (doc.description || '').toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q)
      );
    });
  }, [documents, searchQuery, roleFilter, statusFilter]);

  const totalPages = useMemo(
    () => documents.reduce((acc, doc) => acc + (doc.pageCount || 0), 0),
    [documents]
  );
  const totalChunks = useMemo(
    () => documents.reduce((acc, doc) => acc + (doc.chunkCount || 0), 0),
    [documents]
  );

  if (!isAdmin) {
    return (
      <div className="rounded-xl p-8 bg-[#1A1A1A] border border-[#C08A00]/60 max-w-xl mx-auto my-12 text-center space-y-4 font-mono">
        <div className="w-14 h-14 rounded-full bg-[#301B05] border border-[#D4A017]/50 text-[#F5C542] flex items-center justify-center mx-auto">
          <Lock size={24} />
        </div>
        <h2 className="font-cinzel text-xl font-bold text-[#FAF7F0]">
          Knowledge Base Administration Restricted
        </h2>
        <p className="text-xs text-[#9CA3AF] leading-relaxed">
          Document upload, role visibility updates, and deletion are restricted exclusively to verified <span className="text-[#F5C542] font-bold">ADMIN</span> operators. Your role (<span className="text-[#FAF7F0]">{currentUser.role}</span>) does not have document management privileges.
        </p>
      </div>
    );
  }

  const enqueueFiles = (fileList: FileList | File[]) => {
    setNotice(null);
    const incoming = Array.from(fileList);
    const additions: QueuedPdfFile[] = [];
    const errors: string[] = [];

    for (const file of incoming) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!(KB_ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
        errors.push(`"${file.name}" rejected: supported formats are ${KB_ACCEPTED_EXTENSIONS.map((e) => '.' + e).join(', ')}.`);
        continue;
      }
      if (file.size === 0) {
        errors.push(`"${file.name}" rejected: file is empty (0 bytes).`);
        continue;
      }
      if (file.size > MAX_CLIENT_PDF_BYTES) {
        errors.push(`"${file.name}" exceeds the 10 MB upload limit (${formatBytes(file.size)}).`);
        continue;
      }
      additions.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        progress: 0,
        status: 'queued',
      });
    }

    if (errors.length > 0) {
      setNotice({ type: 'error', text: errors.join(' ') });
    }

    if (additions.length > 0) {
      setQueuedFiles((prev) => {
        const next = [...prev, ...additions];
        if (next.length === 1 && !titleInput.trim()) {
          setTitleInput(next[0].file.name.replace(/\.[^.]+$/, ''));
        }
        return next;
      });
    }
  };

  const handleToggleRole = (role: RagCanonicalRole, isEdit = false) => {
    const setter = isEdit ? setEditRoles : setAllowedRoles;
    setter((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role);
      }
      return [...prev, role];
    });
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (queuedFiles.length === 0) {
      setNotice({ type: 'error', text: 'Select or drop at least one document first.' });
      return;
    }
    if (allowedRoles.length === 0) {
      setNotice({ type: 'error', text: 'Select at least one authorized role (default private: ADMIN).' });
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let warnCount = 0;
    let failCount = 0;

    for (const item of queuedFiles) {
      if (item.status === 'done') continue;

      setQueuedFiles((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading', progress: 5, message: undefined } : q))
      );

      const resolvedTitle =
        queuedFiles.length === 1 && titleInput.trim().length >= 3
          ? titleInput.trim()
          : item.file.name.replace(/\.[^.]+$/, '');

      try {
        const result = await uploadKnowledgeDocument(
          item.file,
          {
            title: resolvedTitle,
            description: descriptionInput.trim() || undefined,
            category: categoryInput,
            allowedRoles,
          },
          (pct) => {
            setQueuedFiles((prev) =>
              prev.map((q) => (q.id === item.id ? { ...q, progress: pct } : q))
            );
          }
        );

        if (result.warning) {
          warnCount++;
        } else {
          successCount++;
        }

        setQueuedFiles((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: result.warning ? 'error' : 'done',
                  progress: 100,
                  message: result.warning || 'Indexed cleanly',
                }
              : q
          )
        );
      } catch (err) {
        failCount++;
        const msg = err instanceof RagApiError ? err.detail : (err as Error)?.message || 'Upload failed';
        setQueuedFiles((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'error', message: msg } : q))
        );
      }
    }

    setIsUploading(false);

    if (failCount === 0 && warnCount === 0) {
      setNotice({
        type: 'success',
        text: `Uploaded and indexed ${successCount} document${successCount === 1 ? '' : 's'} for roles: ${allowedRoles.join(', ')}.`,
      });
      setTitleInput('');
      setDescriptionInput('');
      setQueuedFiles([]);
    } else if (warnCount > 0 && failCount === 0) {
      setNotice({
        type: 'warning',
        text: `${warnCount} document stored awaiting embedding re-index. Check chunk warning details below.`,
      });
    } else {
      setNotice({
        type: 'error',
        text: `${successCount} succeeded, ${failCount + warnCount} flagged errors. Inspect the upload queue for details.`,
      });
    }

    await loadAll();
  };

  const openEditModal = (doc: KnowledgeDocumentRecord) => {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditDescription(doc.description || '');
    setEditCategory(doc.category);
    setEditRoles(doc.allowedRoles.length > 0 ? doc.allowedRoles : ['ADMIN']);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    if (editRoles.length === 0) {
      setNotice({ type: 'error', text: 'At least one authorized role is required.' });
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateKnowledgeDocument(editingDoc.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        allowedRoles: editRoles,
      });
      setEditingDoc(null);
      setNotice({ type: 'success', text: `Updated access policy & metadata for "${editTitle.trim()}".` });
      await loadAll();
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof RagApiError ? err.detail : (err as Error)?.message || 'Update failed.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    setIsDeleting(true);
    try {
      await deleteKnowledgeDocument(deletingDoc.id);
      const removedTitle = deletingDoc.title;
      setDeletingDoc(null);
      setNotice({ type: 'success', text: `Deleted "${removedTitle}" and purged its vector chunks.` });
      await loadAll();
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof RagApiError ? err.detail : (err as Error)?.message || 'Delete failed.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReindex = async (doc: KnowledgeDocumentRecord) => {
    setReindexingId(doc.id);
    setNotice(null);
    try {
      await reindexKnowledgeDocument(doc.id);
      setNotice({ type: 'success', text: `Re-indexed vector chunks for "${doc.title}".` });
      await loadAll();
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof RagApiError ? err.detail : (err as Error)?.message || 'Re-index failed.',
      });
    } finally {
      setReindexingId(null);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs text-[#FAF7F0]">
      {/* Page Header & Single Primary Refresh Action */}
      <div className="rounded-xl p-6 bg-[#181818] border border-[#3A3A3A] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9CA3AF]">
            <span className="text-[#F5C542] font-bold">Admin Restricted</span>
            <span aria-hidden="true">·</span>
            <span>Tenant: {currentUser.tenantName || currentUser.tenantId}</span>
            <span aria-hidden="true">·</span>
            <span>
              {ragHealth
                ? `Railway RAG v${ragHealth.version} (${ragHealth.indexes_built}/${ragHealth.indexes_total} role indexes built)`
                : ragHealthError
                ? `Knowledge Base Notice: ${ragHealthError}`
                : 'Checking Knowledge Base'}
            </span>
          </div>
          <h1 className="font-cinzel text-2xl font-bold text-[#FAF7F0]">
            Knowledge Base Management
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-2xl leading-relaxed">
            Upload PDF banking policies to the Railway Policy RAG, choose which roles may see each document, and audit indexing readiness for the Finova AI Assistant.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAll}
          disabled={loadingDocs}
          className="px-4 py-2 rounded-lg bg-[#262626] border border-[#D4A017]/50 text-[#E6C78B] hover:border-[#F5C542] hover:text-[#FAF7F0] flex items-center gap-2 font-bold whitespace-nowrap shrink-0 transition-colors"
        >
          <RefreshCw size={14} className={loadingDocs ? 'animate-spin' : ''} />
          Refresh Corpus
        </button>
      </div>

      {/* Summary Metrics Strip (Tabular Numerals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 bg-[#181818] border border-[#3A3A3A]">
          <span className="text-[11px] text-[#9CA3AF]">Tenant Document Corpus</span>
          <div className="mt-1 text-2xl font-bold text-[#F5C542] tabular-nums">{documents.length}</div>
          <span className="text-[10px] text-[#9CA3AF]">Indexed documents</span>
        </div>
        <div className="rounded-xl p-4 bg-[#181818] border border-[#3A3A3A]">
          <span className="text-[11px] text-[#9CA3AF]">Extracted Pages</span>
          <div className="mt-1 text-2xl font-bold text-[#FAF7F0] tabular-nums">{totalPages}</div>
          <span className="text-[10px] text-[#9CA3AF]">1-based citation targets</span>
        </div>
        <div className="rounded-xl p-4 bg-[#181818] border border-[#3A3A3A]">
          <span className="text-[11px] text-[#9CA3AF]">Vector Chunks</span>
          <div className="mt-1 text-2xl font-bold text-[#FAF7F0] tabular-nums">{totalChunks}</div>
          <span className="text-[10px] text-[#9CA3AF]">768-dim page segments</span>
        </div>
        <div className="rounded-xl p-4 bg-[#181818] border border-[#3A3A3A]">
          <span className="text-[11px] text-[#9CA3AF]">Role Coverage</span>
          <div className="mt-1 text-2xl font-bold text-[#E6C78B] tabular-nums">
            {ragHealth ? `${ragHealth.indexes_built} / ${ragHealth.indexes_total}` : '—'}
          </div>
          <span className="text-[10px] text-[#9CA3AF]">
            {ragIndexes.length > 0 ? `${ragIndexes.filter((i) => i.index_built).length} role indexes active on Railway` : 'No role indexes built yet'}
          </span>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 ${
            notice.type === 'error'
              ? 'bg-[#2D0A0A] border-[#EF4444]/60 text-[#FCA5A5]'
              : notice.type === 'warning'
              ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
              : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle size={15} className="shrink-0 text-amber-400" />
            )}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-[11px] underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split: Upload Form + Document Inventory */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Document Upload & Role Authorization Panel (5 cols) */}
        <form
          onSubmit={handleUploadSubmit}
          className="xl:col-span-5 rounded-xl bg-[#181818] border border-[#3A3A3A] p-5 space-y-4"
        >
          <div className="pb-3 border-b border-[#2E2E2E] flex items-center justify-between">
            <h2 className="font-cinzel text-base font-bold text-[#E6C78B] flex items-center gap-2">
              <Upload size={16} className="text-[#D4A017]" />
              Upload PDF Documents
            </h2>
            <span className="text-[10px] text-[#9CA3AF]">Max 10 MB / PDF</span>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files?.length) {
                enqueueFiles(e.dataTransfer.files);
              }
            }}
            className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
              dragActive
                ? 'border-[#F5C542] bg-[#301B05]/30'
                : 'border-[#3A3A3A] bg-[#121212] hover:border-[#D4A017]/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) enqueueFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <FileText size={24} className="mx-auto mb-2 text-[#D4A017]" />
            <p className="text-xs font-bold text-[#FAF7F0]">
              Drag &amp; drop one or more PDF files here
            </p>
            <p className="text-[11px] text-[#9CA3AF] mt-1">
              PDFs are indexed page by page on Railway for page-number citations
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 px-4 py-2 rounded-lg bg-[#262626] border border-[#D4A017]/50 text-[#F5C542] hover:bg-[#301B05] font-bold transition-colors"
            >
              Browse PDF Files
            </button>
          </div>

          {/* Selected File Queue with Progress */}
          {queuedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                <span>Queued Files ({queuedFiles.length})</span>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => setQueuedFiles([])}
                    className="text-[#D4A017] hover:underline"
                  >
                    Clear Queue
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {queuedFiles.map((q) => (
                  <div
                    key={q.id}
                    className="p-2.5 rounded-lg bg-[#121212] border border-[#2E2E2E] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-[#FAF7F0]">{q.file.name}</span>
                      <div className="flex items-center gap-2 shrink-0 text-[10px] text-[#9CA3AF] tabular-nums">
                        <span>{formatBytes(q.file.size)}</span>
                        {!isUploading && (
                          <button
                            type="button"
                            onClick={() => setQueuedFiles((prev) => prev.filter((item) => item.id !== q.id))}
                            className="text-[#9CA3AF] hover:text-[#FAF7F0]"
                            aria-label={`Remove ${q.file.name}`}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    {(q.status === 'uploading' || q.progress > 0) && (
                      <div className="w-full h-1.5 rounded bg-[#262626] overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            q.status === 'error' ? 'bg-red-500' : 'bg-[#D4A017]'
                          }`}
                          style={{ width: `${q.progress}%` }}
                        />
                      </div>
                    )}
                    {q.message && (
                      <p className={`text-[10px] ${q.status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
                        {q.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#E6C78B] font-bold mb-1">
                Document Title {queuedFiles.length > 1 ? '(Per-file fallback)' : ''}
              </label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                disabled={queuedFiles.length > 1}
                placeholder={queuedFiles.length > 1 ? 'Derived from filenames' : 'e.g. Basel III Credit Policy'}
                className="w-full bg-[#121212] border border-[#3A3A3A] focus:border-[#D4A017] rounded-lg px-3 py-2 text-[#FAF7F0] outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[#E6C78B] font-bold mb-1">Category</label>
              <select
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value as DocumentCategory)}
                className="w-full bg-[#121212] border border-[#3A3A3A] focus:border-[#D4A017] rounded-lg px-3 py-2 text-[#FAF7F0] outline-none"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#E6C78B] font-bold mb-1">Description / Scope Note</label>
            <textarea
              rows={2}
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="Policy scope, compliance jurisdiction, or revision summary..."
              className="w-full bg-[#121212] border border-[#3A3A3A] focus:border-[#D4A017] rounded-lg px-3 py-2 text-[#FAF7F0] outline-none"
            />
          </div>

          {/* Explicit Authorized Role Checkboxes (Default strictly private: ['ADMIN']) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[#E6C78B] font-bold flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#D4A017]" />
                Authorized Roles
              </label>
              <span className="text-[10px] text-[#9CA3AF]">Default private: ADMIN only</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const checked = allowedRoles.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#301B05]/40 border-[#D4A017] text-[#FAF7F0]'
                        : 'bg-[#121212] border-[#2E2E2E] text-[#9CA3AF] hover:border-[#3A3A3A]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleRole(opt.value, false)}
                      className="accent-[#D4A017]"
                    />
                    <span className="text-[11px] truncate">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isUploading || queuedFiles.length === 0 || allowedRoles.length === 0}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold hover:brightness-110 disabled:opacity-40 transition-all"
          >
            {isUploading
              ? 'Uploading & Indexing...'
              : `Upload ${queuedFiles.length > 0 ? queuedFiles.length : ''} Document${queuedFiles.length === 1 ? '' : 's'}`}
          </button>
        </form>

        {/* Right: Searchable Document Table & Role Coverage Panel (7 cols) */}
        <div className="xl:col-span-7 space-y-6">
          <div className="rounded-xl bg-[#181818] border border-[#3A3A3A] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2E2E2E]">
              <h2 className="font-cinzel text-base font-bold text-[#E6C78B] flex items-center gap-2">
                <Database size={16} className="text-[#D4A017]" />
                Uploaded Knowledge Documents ({filteredDocuments.length})
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search title or filename..."
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-[#121212] border border-[#3A3A3A] focus:border-[#D4A017] text-[#FAF7F0] outline-none text-[11px] w-48"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as 'ALL' | RagCanonicalRole)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#FAF7F0] text-[11px] outline-none"
                >
                  <option value="ALL">All Roles</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.value}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'PROCESSING' | 'FAILED')}
                  className="px-2.5 py-1.5 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#FAF7F0] text-[11px] outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>
            </div>

            {docsError && (
              <div className="p-3 rounded-lg bg-[#2D0A0A] border border-[#EF4444]/60 text-[#FCA5A5] flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{docsError}</span>
              </div>
            )}

            {loadingDocs ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="h-14 rounded-lg bg-[#121212] border border-[#2E2E2E] animate-pulse" />
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-12 text-center space-y-2 text-[#9CA3AF]">
                <FileText size={28} className="mx-auto text-[#D4A017]/50" />
                <p className="text-xs font-bold text-[#FAF7F0]">
                  {documents.length === 0
                    ? 'No documents uploaded yet'
                    : 'No documents match your active filter criteria'}
                </p>
                <p className="text-[11px]">
                  {documents.length === 0
                    ? 'Upload a banking policy using the panel on the left to populate this workspace Knowledge Base.'
                    : 'Try clearing the search query or switching role/status filters.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#2E2E2E] text-[10px] text-[#9CA3AF] uppercase">
                      <th className="py-2.5 pr-3">Document</th>
                      <th className="py-2.5 px-2">Authorized Roles</th>
                      <th className="py-2.5 px-2 text-right">Pages</th>
                      <th className="py-2.5 px-2 text-right">Chunks</th>
                      <th className="py-2.5 px-2">Status</th>
                      <th className="py-2.5 pl-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262626]">
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#1E1E1E]/60 transition-colors">
                        <td className="py-3 pr-3 align-top max-w-[220px]">
                          <div className="font-bold text-[#FAF7F0] truncate" title={doc.title}>
                            {doc.title}
                          </div>
                          <div className="text-[10px] text-[#9CA3AF] flex items-center gap-1.5 mt-0.5 truncate">
                            <span className="truncate">{doc.filename}</span>
                            <span aria-hidden="true">·</span>
                            <span>{doc.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{formatBytes(doc.fileSizeBytes)}</span>
                          </div>
                          {doc.errorMessage && (
                            <p className="text-[10px] text-amber-300 mt-1 break-words">
                              {doc.errorMessage}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-2 align-top">
                          <div className="text-[11px] text-[#E6C78B]">
                            {doc.allowedRoles.join(' · ')}
                          </div>
                        </td>
                        <td className="py-3 px-2 align-top text-right tabular-nums text-[#FAF7F0]">
                          {doc.pageCount}
                        </td>
                        <td className="py-3 px-2 align-top text-right tabular-nums text-[#FAF7F0]">
                          {doc.chunkCount}
                        </td>
                        <td className="py-3 px-2 align-top">
                          <span
                            className={`text-[11px] font-bold ${
                              doc.status === 'ACTIVE'
                                ? 'text-emerald-400'
                                : doc.status === 'FAILED'
                                ? 'text-red-400'
                                : 'text-amber-300'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3 pl-2 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(doc)}
                              className="p-1.5 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#E6C78B] hover:border-[#D4A017]"
                              title="Edit metadata & role visibility"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReindex(doc)}
                              disabled={reindexingId === doc.id}
                              className="p-1.5 rounded-lg bg-[#121212] border border-[#3A3A3A] text-[#D4A017] hover:border-[#F5C542] disabled:opacity-40"
                              title="Re-index vector chunks"
                            >
                              <RotateCw size={13} className={reindexingId === doc.id ? 'animate-spin' : ''} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDoc(doc)}
                              className="p-1.5 rounded-lg bg-[#121212] border border-[#3A3A3A] text-red-400 hover:border-red-500"
                              title="Delete document"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Knowledge Base Storage & Role Coverage */}
          {(kbStatus || ragIndexes.length > 0) && (
            <div className="rounded-xl bg-[#181818] border border-[#3A3A3A] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2E2E2E]">
                <h3 className="font-cinzel text-sm font-bold text-[#E6C78B]">
                  Railway Storage &amp; Role Index Status
                </h3>
                <span className="text-[10px] text-[#9CA3AF]">
                  Railway Policy RAG · role-scoped FAISS indexes
                </span>
              </div>

              {kbStatus && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                  <div className="p-3 rounded-lg bg-[#121212] border border-[#2E2E2E] space-y-1">
                    <span className="text-[10px] text-[#9CA3AF]">Persistent Volume</span>
                    <div
                      className={`font-bold ${
                        kbStatus.storage.storage_root_is_mount
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {kbStatus.storage.storage_root_is_mount
                        ? 'Mounted (/app/storage)'
                        : kbStatus.storage.writable
                        ? 'Writable Local Storage'
                        : 'Storage Not Writable'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#121212] border border-[#2E2E2E] space-y-1">
                    <span className="text-[10px] text-[#9CA3AF]">Document Path</span>
                    <div className="font-mono text-[#FAF7F0] truncate" title={kbStatus.storage.document_storage_path}>
                      {kbStatus.storage.document_storage_path}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#121212] border border-[#2E2E2E] space-y-1">
                    <span className="text-[10px] text-[#9CA3AF]">Vector Store</span>
                    <div className="font-mono text-[#FAF7F0] truncate" title={kbStatus.storage.vectorstore_path}>
                      {kbStatus.storage.vectorstore_path}
                    </div>
                  </div>
                </div>
              )}

              {ragIndexes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {ragIndexes.map((idx) => (
                    <div
                      key={idx.role}
                      className="p-3 rounded-lg bg-[#121212] border border-[#2E2E2E] space-y-1"
                    >
                      <div className="text-[10px] font-bold text-[#E6C78B] truncate">{idx.role}</div>
                      <div className={`text-[11px] font-bold ${idx.index_built ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {idx.index_built ? 'Index Built' : 'Not Built'}
                      </div>
                      <div className="text-[10px] text-[#9CA3AF] tabular-nums">
                        Chunks: {idx.chunk_count ?? 0}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Document Metadata & Role Access Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg rounded-xl bg-[#181818] border border-[#D4A017]/60 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2E2E2E]">
              <h3 className="font-cinzel text-lg font-bold text-[#E6C78B]">
                Edit Knowledge Document Access
              </h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="text-[#9CA3AF] hover:text-[#FAF7F0]"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-[#E6C78B] font-bold mb-1">Document Title</label>
              <input
                type="text"
                required
                minLength={3}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-lg px-3 py-2 text-[#FAF7F0]"
              />
            </div>

            <div>
              <label className="block text-[#E6C78B] font-bold mb-1">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-lg px-3 py-2 text-[#FAF7F0]"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#E6C78B] font-bold mb-1">Description</label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full bg-[#121212] border border-[#3A3A3A] rounded-lg px-3 py-2 text-[#FAF7F0]"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[#E6C78B] font-bold">Authorized Roles</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((opt) => {
                  const checked = editRoles.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                        checked
                          ? 'bg-[#301B05]/40 border-[#D4A017] text-[#FAF7F0]'
                          : 'bg-[#121212] border-[#2E2E2E] text-[#9CA3AF]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleRole(opt.value, true)}
                        className="accent-[#D4A017]"
                      />
                      <span className="text-[11px] truncate">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2 rounded-lg bg-[#262626] border border-[#3A3A3A] text-[#FAF7F0]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit || editRoles.length === 0}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#D4A017] to-[#F5C542] text-[#111111] font-bold disabled:opacity-40"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[#181818] border border-red-500/60 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-cinzel text-lg font-bold">
              <AlertTriangle size={18} />
              <span>Confirm Document Deletion</span>
            </div>
            <p className="text-xs text-[#FAF7F0]/90 leading-relaxed">
              Permanently delete <span className="font-bold text-[#F5C542]">{deletingDoc.title}</span> ({deletingDoc.filename}) and all {deletingDoc.chunkCount} indexed vector chunks? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDoc(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-[#262626] border border-[#3A3A3A] text-[#FAF7F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold disabled:opacity-40"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminKnowledgeBasePage;
