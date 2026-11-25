"""
ADMIN-only Knowledge Base Document Management Router.

Exposed routes (all enforce backend-verified role == 'ADMIN'):
- POST   /admin/knowledge-base/upload
- GET    /admin/knowledge-base/documents
- GET    /admin/knowledge-base/documents/{document_id}
- PATCH  /admin/knowledge-base/documents/{document_id}
- DELETE /admin/knowledge-base/documents/{document_id}
- POST   /admin/knowledge-base/documents/{document_id}/reindex
- GET    /admin/knowledge-base/status
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from .auth import VerifiedCaller, require_admin_only
from .config import ensure_storage_directories, load_settings
from .vectorstore import KnowledgeBaseStore

router = APIRouter(prefix="/admin/knowledge-base", tags=["admin-knowledge-base"])


def _get_store() -> KnowledgeBaseStore:
    return KnowledgeBaseStore(load_settings())


class UpdateDocumentRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=180)
    description: Optional[str] = Field(default=None, max_length=500)
    category: Optional[str] = None
    allowedRoles: Optional[List[str]] = None


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_knowledge_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    category: str = Form(default="POLICY"),
    allowedRoles: Optional[str] = Form(default=None),
    allowed_roles: Optional[str] = Form(default=None),
    caller: VerifiedCaller = Depends(require_admin_only),
) -> dict:
    raw_bytes = await file.read()
    roles_input = allowedRoles if allowedRoles is not None else allowed_roles
    store = _get_store()

    try:
        doc = store.upload_pdf(
            raw_bytes=raw_bytes,
            original_filename=file.filename or "document.pdf",
            tenant_id=caller.tenant_id,
            caller_id=caller.user_id,
            title=title,
            description=description,
            category=category,
            allowed_roles_raw=roles_input,
        )
    except OverflowError as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    return {
        "success": doc["status"] == "ACTIVE",
        "document": doc,
        "warning": doc.get("errorMessage"),
    }


@router.get("/documents")
async def list_knowledge_documents(
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    caller: VerifiedCaller = Depends(require_admin_only),
) -> dict:
    store = _get_store()
    docs = store.list_documents(
        tenant_id=caller.tenant_id,
        search=search,
        role_filter=role,
        status_filter=status_filter,
    )
    return {"documents": docs, "total": len(docs)}


@router.get("/documents/{document_id}")
async def get_knowledge_document(
    document_id: str,
    caller: VerifiedCaller = Depends(require_admin_only),
) -> dict:
    store = _get_store()
    doc = store.get_document(caller.tenant_id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge Base document not found in this tenant workspace.",
        )
    return {"document": doc}


@router.patch("/documents/{document_id}")
async def update_knowledge_document(
    document_id: str,
    payload: UpdateDocumentRequest,
    caller: VerifiedCaller = Depends(require_admin_only),
) -> dict:
    store = _get_store()
    try:
        doc = store.update_document(
            tenant_id=caller.tenant_id,
            document_id=document_id,
            title=payload.title,
            description=payload.description,
            category=payload.category,
            allowed_roles_raw=payload.allowedRoles,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge Base document not found in this tenant workspace.",
        )
    return {"success": True, "document": doc}


@router.delete("/documents/{document_id}")
async def delete_knowledge_document(
    document_id: str,
    caller: VerifiedCaller = Depends(require_admin_only),
) -> dict:
    store = _get_store()
    try:
        removed = store.delete_document(caller.tenant_id, document_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge Base document not found in this tenant workspace.",
        )
    return {"success": True, **removed}


@router.post("/documents/{document_id}/reindex")
async def reindex_knowledge_document(
    document_id: str,
    caller: VerifiedCaller = Depends(require_admin_only),
) -> dict:
    store = _get_store()
    try:
        doc = store.reindex_document(caller.tenant_id, document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge Base document not found in this tenant workspace.",
        )
    if doc["status"] == "FAILED":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=doc.get("errorMessage") or "Document re-indexing failed.",
        )
    return {"success": True, "document": doc}


@router.get("/status")
async def knowledge_base_status(
    caller: VerifiedCaller = Depends(require_admin_only),
) -> dict:
    settings = load_settings()
    storage_info = ensure_storage_directories(settings)
    store = KnowledgeBaseStore(settings)
    docs = store.list_documents(tenant_id=caller.tenant_id)
    indexes = store.get_index_statuses(
        caller_role=caller.role,
        caller_tenant_id=caller.tenant_id,
    )
    return {
        "tenantId": caller.tenant_id,
        "storage": storage_info,
        "documentStats": {
            "total": len(docs),
            "active": sum(1 for d in docs if d["status"] == "ACTIVE"),
            "processing": sum(1 for d in docs if d["status"] == "PROCESSING"),
            "failed": sum(1 for d in docs if d["status"] == "FAILED"),
            "totalPages": sum(int(d["pageCount"]) for d in docs),
            "totalChunks": sum(int(d["chunkCount"]) for d in docs),
        },
        "indexes": indexes,
    }
