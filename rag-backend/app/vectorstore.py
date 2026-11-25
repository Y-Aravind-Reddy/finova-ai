"""
Persistent PDF storage, SQLite metadata registry, and multi-tenant FAISS vectorstore.

Security & persistence invariants:
- PDF files are stored under DOCUMENT_STORAGE_PATH/<tenant_id>/<document_id>.pdf
  with strict Path.resolve() confinement.
- FAISS per-role indexes live under VECTORSTORE_PATH/<ROLE>/.
- Retrieval ALWAYS filters candidates by BOTH tenant_id and caller.role in metadata,
  so separate role indexes alone are never relied upon for tenant isolation.
- Re-indexing removes existing vectors for document_id before adding new vectors
  to prevent duplicate chunks.
- Deleting a document purges its vectors from all FAISS indexes, removes the file
  from disk, and deletes its registry row.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .config import ALLOWED_CATEGORIES, CANONICAL_ROLES, Settings

_INDEX_LOCK = threading.RLock()

_INJECTION_PATTERNS = (
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(the\s+)?system\s+prompt", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(in\s+)?developer\s+mode", re.IGNORECASE),
    re.compile(r"<\|im_start\|>|<\|system\|>", re.IGNORECASE),
    re.compile(r"override\s+role\s+permissions?", re.IGNORECASE),
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _detect_prompt_injection(texts: Sequence[str]) -> bool:
    for text in texts:
        for pattern in _INJECTION_PATTERNS:
            if pattern.search(text or ""):
                return True
    return False


def _sanitize_filename(filename: str) -> str:
    name = Path(filename or "document.pdf").name
    cleaned = re.sub(r"[^\w.\- ()]", "_", name).strip()
    return cleaned or "document.pdf"


def parse_allowed_roles(raw_roles: Optional[str | Sequence[str]]) -> List[str]:
    if raw_roles is None or raw_roles == "":
        return ["ADMIN"]  # Strict private default: never all 5 roles automatically

    items: List[Any]
    if isinstance(raw_roles, str):
        cleaned = raw_roles.strip()
        if not cleaned:
            return ["ADMIN"]
        if cleaned.startswith("["):
            parsed = json.loads(cleaned)
            if not isinstance(parsed, list):
                raise ValueError("allowed_roles JSON must be an array.")
            items = parsed
        else:
            items = [part.strip() for part in cleaned.split(",") if part.strip()]
    else:
        items = list(raw_roles)

    normalized: List[str] = []
    for item in items:
        role = str(item or "").strip().upper()
        if role not in CANONICAL_ROLES:
            raise ValueError(
                f"Invalid role '{item}'. Permitted roles: {', '.join(CANONICAL_ROLES)}."
            )
        if role not in normalized:
            normalized.append(role)

    if not normalized:
        raise ValueError("At least one authorized role must be selected.")
    return normalized


class KnowledgeBaseStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.doc_root = settings.document_storage_path
        self.vec_root = settings.vectorstore_path
        self.doc_root.mkdir(parents=True, exist_ok=True)
        self.vec_root.mkdir(parents=True, exist_ok=True)
        self.db_path = (self.doc_root / "registry.db").resolve()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        return conn

    def _init_db(self) -> None:
        with _INDEX_LOCK, self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    filename TEXT NOT NULL,
                    category TEXT NOT NULL,
                    allowed_roles TEXT NOT NULL,
                    page_count INTEGER NOT NULL DEFAULT 0,
                    chunk_count INTEGER NOT NULL DEFAULT 0,
                    file_size_bytes INTEGER NOT NULL DEFAULT 0,
                    content_hash TEXT NOT NULL,
                    status TEXT NOT NULL,
                    error_message TEXT,
                    storage_path TEXT NOT NULL,
                    created_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_tenant_hash
                ON documents(tenant_id, content_hash)
                """
            )
            conn.commit()

    def _row_to_dto(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "tenantId": row["tenant_id"],
            "title": row["title"],
            "description": row["description"],
            "filename": row["filename"],
            "category": row["category"],
            "allowedRoles": json.loads(row["allowed_roles"]),
            "pageCount": int(row["page_count"]),
            "chunkCount": int(row["chunk_count"]),
            "fileSizeBytes": int(row["file_size_bytes"]),
            "status": row["status"],
            "errorMessage": row["error_message"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def _build_embeddings(self):
        if not self.settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured on the RAG backend.")
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        return GoogleGenerativeAIEmbeddings(
            model=self.settings.embedding_model,
            google_api_key=self.settings.gemini_api_key,
        )

    def _safe_tenant_pdf_path(self, tenant_id: str, document_id: str) -> Path:
        safe_tenant = re.sub(r"[^\w.\-]", "_", tenant_id.strip())
        if not safe_tenant:
            raise ValueError("Invalid tenant_id.")
        tenant_dir = (self.doc_root / safe_tenant).resolve()
        if not tenant_dir.is_relative_to(self.doc_root):
            raise ValueError("Path traversal detected in tenant_id.")
        tenant_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = (tenant_dir / f"{document_id}.pdf").resolve()
        if not pdf_path.is_relative_to(tenant_dir):
            raise ValueError("Path traversal detected in document path.")
        return pdf_path

    def _extract_pdf_chunks(
        self,
        pdf_path: Path,
        doc_id: str,
        tenant_id: str,
        filename: str,
        title: str,
        category: str,
        allowed_roles: List[str],
    ) -> Tuple[int, List[Any]]:
        from langchain_core.documents import Document
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        from pypdf import PdfReader

        reader = PdfReader(str(pdf_path))
        total_pages = len(reader.pages)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=150,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

        docs: List[Document] = []
        for idx, page in enumerate(reader.pages):
            page_num = idx + 1
            text = (page.extract_text() or "").replace("\x00", "").strip()
            if not text:
                continue
            pieces = splitter.split_text(text)
            for piece_idx, piece in enumerate(pieces):
                cleaned_piece = piece.strip()
                if not cleaned_piece:
                    continue
                docs.append(
                    Document(
                        page_content=cleaned_piece,
                        metadata={
                            "document_id": doc_id,
                            "tenant_id": tenant_id,
                            "filename": filename,
                            "title": title,
                            "category": category,
                            "allowed_roles": list(allowed_roles),
                            "page": page_num,
                            "chunk_index": piece_idx,
                        },
                    )
                )

        if total_pages == 0 or len(docs) == 0:
            raise ValueError(
                "PDF contains no extractable text (scanned image-only PDFs require OCR before indexing)."
            )
        return total_pages, docs

    def _role_index_dir(self, role: str) -> Path:
        if role not in CANONICAL_ROLES:
            raise ValueError(f"Unsupported role '{role}'.")
        target = (self.vec_root / role).resolve()
        if not target.is_relative_to(self.vec_root):
            raise ValueError("Invalid vectorstore path.")
        return target

    def _write_role_meta(self, role: str, store: Any) -> None:
        role_dir = self._role_index_dir(role)
        docs_in_store = list(store.docstore._dict.values())
        filenames = sorted(
            {
                str(d.metadata.get("filename") or d.metadata.get("title") or "")
                for d in docs_in_store
                if d.metadata.get("filename") or d.metadata.get("title")
            }
        )
        tenants = sorted(
            {
                str(d.metadata.get("tenant_id") or "")
                for d in docs_in_store
                if d.metadata.get("tenant_id")
            }
        )
        meta = {
            "role": role,
            "built_at": _utc_now(),
            "embedding_model": self.settings.embedding_model,
            "chunk_count": len(docs_in_store),
            "documents": filenames,
            "tenants": tenants,
        }
        (role_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    def _remove_document_from_role_index(self, role: str, document_id: str) -> None:
        role_dir = self._role_index_dir(role)
        faiss_file = role_dir / "index.faiss"
        if not faiss_file.exists():
            return

        from langchain_community.vectorstores import FAISS

        embeddings = self._build_embeddings()
        store = FAISS.load_local(
            str(role_dir),
            embeddings,
            allow_dangerous_deserialization=True,
        )
        matching_ids = [
            doc_key
            for doc_key, doc_obj in store.docstore._dict.items()
            if str(doc_obj.metadata.get("document_id") or "") == document_id
        ]
        if not matching_ids:
            return

        remaining = len(store.docstore._dict) - len(matching_ids)
        if remaining <= 0:
            shutil.rmtree(role_dir, ignore_errors=True)
            return

        store.delete(matching_ids)
        store.save_local(str(role_dir))
        self._write_role_meta(role, store)

    def _upsert_document_into_roles(
        self,
        document_id: str,
        target_roles: List[str],
        chunks: List[Any],
    ) -> None:
        from langchain_community.vectorstores import FAISS

        embeddings = self._build_embeddings()

        # First purge document vectors from ALL role indexes so re-indexing or shrinking
        # role permissions never leaves stale or duplicate vectors behind.
        for role in CANONICAL_ROLES:
            self._remove_document_from_role_index(role, document_id)

        for role in target_roles:
            role_dir = self._role_index_dir(role)
            role_dir.mkdir(parents=True, exist_ok=True)
            faiss_file = role_dir / "index.faiss"

            if faiss_file.exists():
                store = FAISS.load_local(
                    str(role_dir),
                    embeddings,
                    allow_dangerous_deserialization=True,
                )
                store.add_documents(chunks)
            else:
                store = FAISS.from_documents(chunks, embeddings)

            store.save_local(str(role_dir))
            self._write_role_meta(role, store)

    def upload_pdf(
        self,
        *,
        raw_bytes: bytes,
        original_filename: str,
        tenant_id: str,
        caller_id: str,
        title: Optional[str],
        description: Optional[str],
        category: str,
        allowed_roles_raw: Optional[str | Sequence[str]],
    ) -> Dict[str, Any]:
        clean_filename = _sanitize_filename(original_filename)
        if not clean_filename.lower().endswith(".pdf"):
            raise ValueError("Invalid file extension: only .pdf files are accepted.")
        if len(raw_bytes) == 0:
            raise ValueError("Uploaded PDF file is empty (0 bytes).")
        if len(raw_bytes) > self.settings.max_pdf_bytes:
            raise OverflowError(
                f"PDF exceeds maximum size limit ({self.settings.max_pdf_bytes // (1024 * 1024)} MB)."
            )
        if b"%PDF-" not in raw_bytes[:1024]:
            raise ValueError("File failed %PDF- signature validation.")

        allowed_roles = parse_allowed_roles(allowed_roles_raw)
        norm_category = (category or "POLICY").strip().upper()
        if norm_category not in ALLOWED_CATEGORIES:
            norm_category = "POLICY"

        doc_title = (title or clean_filename.rsplit(".", 1)[0]).strip()
        if len(doc_title) < 3 or len(doc_title) > 180:
            raise ValueError("Document title must be between 3 and 180 characters.")

        clean_desc = description.strip()[:500] if description and description.strip() else None
        content_hash = hashlib.sha256(raw_bytes).hexdigest()

        with _INDEX_LOCK:
            with self._connect() as conn:
                dup = conn.execute(
                    "SELECT id, title FROM documents WHERE tenant_id = ? AND content_hash = ?",
                    (tenant_id, content_hash),
                ).fetchone()
                if dup:
                    raise ValueError(
                        f"Duplicate PDF detected: '{dup['title']}' already exists in this tenant Knowledge Base."
                    )

            doc_id = str(uuid.uuid4())
            pdf_path = self._safe_tenant_pdf_path(tenant_id, doc_id)
            pdf_path.write_bytes(raw_bytes)

            now = _utc_now()
            try:
                page_count, chunks = self._extract_pdf_chunks(
                    pdf_path=pdf_path,
                    doc_id=doc_id,
                    tenant_id=tenant_id,
                    filename=clean_filename,
                    title=doc_title,
                    category=norm_category,
                    allowed_roles=allowed_roles,
                )
            except Exception:
                pdf_path.unlink(missing_ok=True)
                raise

            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO documents (
                        id, tenant_id, title, description, filename, category,
                        allowed_roles, page_count, chunk_count, file_size_bytes,
                        content_hash, status, error_message, storage_path,
                        created_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        doc_id,
                        tenant_id,
                        doc_title,
                        clean_desc,
                        clean_filename,
                        norm_category,
                        json.dumps(allowed_roles),
                        page_count,
                        len(chunks),
                        len(raw_bytes),
                        content_hash,
                        "PROCESSING",
                        None,
                        str(pdf_path),
                        caller_id,
                        now,
                        now,
                    ),
                )
                conn.commit()

            status_val = "ACTIVE"
            err_msg: Optional[str] = None
            try:
                self._upsert_document_into_roles(doc_id, allowed_roles, chunks)
            except Exception as exc:
                status_val = "FAILED"
                err_msg = str(exc)[:500]

            with self._connect() as conn:
                conn.execute(
                    "UPDATE documents SET status = ?, error_message = ?, updated_at = ? WHERE id = ?",
                    (status_val, err_msg, _utc_now(), doc_id),
                )
                conn.commit()
                row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
                return self._row_to_dto(row)

    def list_documents(
        self,
        tenant_id: str,
        search: Optional[str] = None,
        role_filter: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        with _INDEX_LOCK, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM documents WHERE tenant_id = ? ORDER BY updated_at DESC",
                (tenant_id,),
            ).fetchall()

        results = [self._row_to_dto(r) for r in rows]
        if search and search.strip():
            q = search.strip().lower()
            results = [
                d
                for d in results
                if q in d["title"].lower()
                or q in d["filename"].lower()
                or q in (d["description"] or "").lower()
                or q in d["category"].lower()
            ]
        if role_filter and role_filter.strip().upper() != "ALL":
            rf = role_filter.strip().upper()
            results = [d for d in results if rf in d["allowedRoles"]]
        if status_filter and status_filter.strip().upper() != "ALL":
            sf = status_filter.strip().upper()
            results = [d for d in results if d["status"].upper() == sf]
        return results

    def get_document(self, tenant_id: str, document_id: str) -> Optional[Dict[str, Any]]:
        with _INDEX_LOCK, self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM documents WHERE id = ? AND tenant_id = ?",
                (document_id, tenant_id),
            ).fetchone()
        return self._row_to_dto(row) if row else None

    def update_document(
        self,
        *,
        tenant_id: str,
        document_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
        allowed_roles_raw: Optional[str | Sequence[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        with _INDEX_LOCK:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT * FROM documents WHERE id = ? AND tenant_id = ?",
                    (document_id, tenant_id),
                ).fetchone()
                if not row:
                    return None

            next_title = title.strip() if title is not None else row["title"]
            if len(next_title) < 3 or len(next_title) > 180:
                raise ValueError("Document title must be between 3 and 180 characters.")

            next_desc = (
                (description.strip()[:500] or None)
                if description is not None
                else row["description"]
            )
            next_cat = (
                category.strip().upper()
                if category and category.strip().upper() in ALLOWED_CATEGORIES
                else row["category"]
            )
            next_roles = (
                parse_allowed_roles(allowed_roles_raw)
                if allowed_roles_raw is not None
                else json.loads(row["allowed_roles"])
            )

            pdf_path = Path(row["storage_path"])
            if not pdf_path.exists():
                raise FileNotFoundError("Stored PDF binary missing from persistent volume.")

            page_count, chunks = self._extract_pdf_chunks(
                pdf_path=pdf_path,
                doc_id=document_id,
                tenant_id=tenant_id,
                filename=row["filename"],
                title=next_title,
                category=next_cat,
                allowed_roles=next_roles,
            )
            self._upsert_document_into_roles(document_id, next_roles, chunks)

            with self._connect() as conn:
                conn.execute(
                    """
                    UPDATE documents
                    SET title = ?, description = ?, category = ?, allowed_roles = ?,
                        page_count = ?, chunk_count = ?, status = 'ACTIVE',
                        error_message = NULL, updated_at = ?
                    WHERE id = ? AND tenant_id = ?
                    """,
                    (
                        next_title,
                        next_desc,
                        next_cat,
                        json.dumps(next_roles),
                        page_count,
                        len(chunks),
                        _utc_now(),
                        document_id,
                        tenant_id,
                    ),
                )
                conn.commit()
                updated = conn.execute(
                    "SELECT * FROM documents WHERE id = ? AND tenant_id = ?",
                    (document_id, tenant_id),
                ).fetchone()
                return self._row_to_dto(updated)

    def reindex_document(self, tenant_id: str, document_id: str) -> Optional[Dict[str, Any]]:
        with _INDEX_LOCK:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT * FROM documents WHERE id = ? AND tenant_id = ?",
                    (document_id, tenant_id),
                ).fetchone()
                if not row:
                    return None

                conn.execute(
                    "UPDATE documents SET status = 'PROCESSING', error_message = NULL, updated_at = ? WHERE id = ?",
                    (_utc_now(), document_id),
                )
                conn.commit()

            pdf_path = Path(row["storage_path"])
            if not pdf_path.exists():
                with self._connect() as conn:
                    conn.execute(
                        "UPDATE documents SET status = 'FAILED', error_message = ?, updated_at = ? WHERE id = ?",
                        ("PDF file missing on persistent volume.", _utc_now(), document_id),
                    )
                    conn.commit()
                raise FileNotFoundError("PDF file missing from persistent volume.")

            allowed_roles = json.loads(row["allowed_roles"])
            try:
                page_count, chunks = self._extract_pdf_chunks(
                    pdf_path=pdf_path,
                    doc_id=document_id,
                    tenant_id=tenant_id,
                    filename=row["filename"],
                    title=row["title"],
                    category=row["category"],
                    allowed_roles=allowed_roles,
                )
                self._upsert_document_into_roles(document_id, allowed_roles, chunks)
                status_val = "ACTIVE"
                err_msg = None
            except Exception as exc:
                page_count = int(row["page_count"])
                chunks = []
                status_val = "FAILED"
                err_msg = str(exc)[:500]

            with self._connect() as conn:
                conn.execute(
                    """
                    UPDATE documents
                    SET page_count = ?, chunk_count = ?, status = ?, error_message = ?, updated_at = ?
                    WHERE id = ? AND tenant_id = ?
                    """,
                    (
                        page_count,
                        len(chunks) if chunks else int(row["chunk_count"]),
                        status_val,
                        err_msg,
                        _utc_now(),
                        document_id,
                        tenant_id,
                    ),
                )
                conn.commit()
                updated = conn.execute(
                    "SELECT * FROM documents WHERE id = ? AND tenant_id = ?",
                    (document_id, tenant_id),
                ).fetchone()
                return self._row_to_dto(updated)

    def delete_document(self, tenant_id: str, document_id: str) -> Optional[Dict[str, Any]]:
        with _INDEX_LOCK:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT * FROM documents WHERE id = ? AND tenant_id = ?",
                    (document_id, tenant_id),
                ).fetchone()
                if not row:
                    return None

            # Purge vectors from every role index first so deleted documents are immediately unretrievable.
            for role in CANONICAL_ROLES:
                self._remove_document_from_role_index(role, document_id)

            pdf_path = Path(row["storage_path"])
            pdf_path.unlink(missing_ok=True)

            with self._connect() as conn:
                conn.execute(
                    "DELETE FROM documents WHERE id = ? AND tenant_id = ?",
                    (document_id, tenant_id),
                )
                conn.commit()

            return {"deletedId": document_id, "title": row["title"]}

    def get_index_statuses(
        self,
        *,
        roles_filter: Optional[Sequence[str]] = None,
        caller_role: str = "ADMIN",
        caller_tenant_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        target_roles = list(roles_filter) if roles_filter else list(CANONICAL_ROLES)
        statuses: List[Dict[str, Any]] = []

        for role in target_roles:
            if role not in CANONICAL_ROLES:
                continue
            role_dir = self._role_index_dir(role)
            dir_exists = role_dir.exists()
            faiss_exists = (role_dir / "index.faiss").exists() and (role_dir / "index.pkl").exists()
            meta_file = role_dir / "meta.json"
            meta: Dict[str, Any] = {}
            if meta_file.exists():
                try:
                    meta = json.loads(meta_file.read_text(encoding="utf-8"))
                except Exception:
                    meta = {}

            emb_model = meta.get("embedding_model")
            emb_matches = bool(faiss_exists and emb_model == self.settings.embedding_model)

            # Restrict document filenames and cross-tenant list strictly to SUPER_ADMIN or caller's own tenant
            if caller_role == "SUPER_ADMIN":
                docs_list = list(meta.get("documents") or [])
                tenants_list = list(meta.get("tenants") or [])
            else:
                docs_list = []
                tenants_list = [caller_tenant_id] if caller_tenant_id else []

            statuses.append(
                {
                    "role": role,
                    "directory_exists": dir_exists,
                    "index_built": faiss_exists,
                    "embedding_model_matches": emb_matches,
                    "built_at": meta.get("built_at"),
                    "embedding_model": emb_model,
                    "chunk_count": meta.get("chunk_count") if faiss_exists else 0,
                    "documents": docs_list,
                    "tenants": tenants_list,
                }
            )
        return statuses

    def count_built_indexes(self) -> int:
        count = 0
        for role in CANONICAL_ROLES:
            role_dir = self._role_index_dir(role)
            if (role_dir / "index.faiss").exists() and (role_dir / "index.pkl").exists():
                count += 1
        return count

    def retrieve_for_caller(
        self,
        *,
        question: str,
        caller_role: str,
        caller_tenant_id: str,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """
        Execute similarity search on caller's role FAISS index and enforce
        retrieval-time multi-tenant & role filtering on every chunk.
        """
        role_dir = self._role_index_dir(caller_role)
        if not ((role_dir / "index.faiss").exists() and (role_dir / "index.pkl").exists()):
            raise LookupError(f"Index for role '{caller_role}' has not been built yet.")

        from langchain_community.vectorstores import FAISS

        embeddings = self._build_embeddings()
        store = FAISS.load_local(
            str(role_dir),
            embeddings,
            allow_dangerous_deserialization=True,
        )

        # Fetch wider candidate pool, then strictly filter by tenant_id + allowed_roles
        candidates = store.similarity_search_with_score(question, k=max(top_k * 6, 20))
        filtered_docs: List[Any] = []
        for doc_obj, _score in candidates:
            meta = doc_obj.metadata or {}
            doc_tenant = str(meta.get("tenant_id") or "")
            allowed_roles = [str(r).upper() for r in (meta.get("allowed_roles") or [])]

            # Multi-tenant enforcement at retrieval time (never rely solely on role index)
            if doc_tenant != caller_tenant_id:
                continue
            if caller_role not in allowed_roles:
                continue

            filtered_docs.append(doc_obj)
            if len(filtered_docs) >= top_k:
                break

        if not filtered_docs:
            return {
                "found": False,
                "chunks": [],
                "sources": [],
                "source_documents": [],
                "source_pages": [],
                "context_warning": False,
            }

        context_warning = _detect_prompt_injection([d.page_content for d in filtered_docs])

        pages_by_doc: Dict[str, set[int]] = {}
        for d in filtered_docs:
            doc_name = str(d.metadata.get("filename") or d.metadata.get("title") or "policy.pdf")
            page_num = int(d.metadata.get("page") or 1)
            pages_by_doc.setdefault(doc_name, set()).add(page_num)

        sources = [
            {"document": name, "pages": sorted(pages)}
            for name, pages in pages_by_doc.items()
        ]
        all_pages = sorted({p for pages in pages_by_doc.values() for p in pages})

        return {
            "found": True,
            "chunks": filtered_docs,
            "sources": sources,
            "source_documents": list(pages_by_doc.keys()),
            "source_pages": all_pages,
            "context_warning": context_warning,
        }
