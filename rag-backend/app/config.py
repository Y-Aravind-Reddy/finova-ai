"""Environment and persistent storage configuration for the Finova AI RAG backend."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

CANONICAL_ROLES: Tuple[str, ...] = (
    "SUPER_ADMIN",
    "ADMIN",
    "FINANCE_ANALYST",
    "SUPPORT_EXECUTIVE",
    "CUSTOMER",
)

ROLE_DESCRIPTIONS = {
    "SUPER_ADMIN": "Platform owner: governance, platform-wide security and incident policies.",
    "ADMIN": "Tenant/bank administrator: user administration and operational controls.",
    "FINANCE_ANALYST": "Finance team: credit, treasury and reporting policies.",
    "SUPPORT_EXECUTIVE": "Customer support: complaint handling and service procedures.",
    "CUSTOMER": "End customer: published account and service terms.",
}

ALLOWED_CATEGORIES = ("POLICY", "PROCEDURE", "REGULATION", "GUIDE", "MANUAL")

DEFAULT_FINOVA_ORIGINS: Tuple[str, ...] = (
    "https://ais-dev-dvm7cp37tu7ipktvhb6bmt-971598154639.asia-southeast1.run.app",
    "https://ais-pre-dvm7cp37tu7ipktvhb6bmt-971598154639.asia-southeast1.run.app",
    "http://localhost:3000",
    "http://localhost:5173",
)


@dataclass(frozen=True)
class Settings:
    app_version: str
    port: int
    document_storage_path: Path
    vectorstore_path: Path
    supabase_url: str
    supabase_anon_key: str
    gemini_api_key: str
    embedding_model: str
    chat_model: str
    chat_fallback_models: List[str]
    max_pdf_bytes: int
    cors_origins: List[str]
    cors_origin_regex: str


def load_settings() -> Settings:
    doc_dir = Path(
        os.getenv("DOCUMENT_STORAGE_PATH", "/app/storage/knowledge_base")
    ).resolve()
    vec_dir = Path(
        os.getenv("VECTORSTORE_PATH", "/app/storage/vectorstore")
    ).resolve()

    extra_origins = [
        o.strip().rstrip("/")
        for o in os.getenv("CORS_ORIGINS", "").split(",")
        if o.strip()
    ]
    origins: List[str] = list(dict.fromkeys([*DEFAULT_FINOVA_ORIGINS, *extra_origins]))

    return Settings(
        app_version=os.getenv("RAG_APP_VERSION", "1.1.0"),
        port=int(os.getenv("PORT", "8000")),
        document_storage_path=doc_dir,
        vectorstore_path=vec_dir,
        supabase_url=os.getenv("SUPABASE_URL", "").strip().rstrip("/"),
        supabase_anon_key=(
            os.getenv("SUPABASE_ANON_KEY", "").strip()
            or os.getenv("SUPABASE_KEY", "").strip()
        ),
        gemini_api_key=(
            os.getenv("GEMINI_API_KEY", "").strip()
            or os.getenv("GOOGLE_API_KEY", "").strip()
        ),
        embedding_model=os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001").strip(),
        # gemini-2.5-flash was retired by Google (404); default to a current model.
        chat_model=os.getenv("CHAT_MODEL", "gemini-3.5-flash-lite").strip(),
        # Tried in order when the primary model is overloaded (503) or retired (404).
        chat_fallback_models=[
            m.strip()
            for m in os.getenv(
                "CHAT_FALLBACK_MODELS", "gemini-3.1-flash-lite,gemini-3.8-flash"
            ).split(",")
            if m.strip()
        ],
        max_pdf_bytes=int(os.getenv("MAX_PDF_BYTES", str(10 * 1024 * 1024))),
        cors_origins=origins,
        cors_origin_regex=os.getenv(
            "CORS_ORIGIN_REGEX",
            r"^https://ais-(dev|pre)-[a-z0-9\-]+\.run\.app$",
        ),
    )


def ensure_storage_directories(settings: Settings) -> dict:
    """Create persistent storage directories and report volume mount status."""
    settings.document_storage_path.mkdir(parents=True, exist_ok=True)
    settings.vectorstore_path.mkdir(parents=True, exist_ok=True)

    storage_root = Path("/app/storage")
    mount_detected = False
    try:
        mount_detected = os.path.ismount(storage_root) or (
            storage_root.exists() and str(settings.document_storage_path).startswith(str(storage_root))
        )
    except OSError:
        mount_detected = False

    return {
        "document_storage_path": str(settings.document_storage_path),
        "vectorstore_path": str(settings.vectorstore_path),
        "storage_root_is_mount": os.path.ismount(storage_root) if storage_root.exists() else False,
        "configured_under_app_storage": mount_detected,
        "writable": os.access(settings.document_storage_path, os.W_OK)
        and os.access(settings.vectorstore_path, os.W_OK),
    }
