# Finova AI — Railway Python RAG Backend Deployment Guide

This directory contains the complete FastAPI + LangChain + FAISS + Gemini RAG backend matching the Finova AI frontend (`src/services/ragService.ts`).

## 1. Railway Volume Setup (Required for Permanent PDF & FAISS Persistence)
1. In the Railway project dashboard for your RAG service (`finovaairag-production`), open **Volumes** -> **Add Volume**.
2. Set the mount path strictly to:
   `/app/storage`
3. Set the following Railway **Variables**:
   - `DOCUMENT_STORAGE_PATH=/app/storage/knowledge_base`
   - `VECTORSTORE_PATH=/app/storage/vectorstore`
   - `SUPABASE_URL=https://rjudrmnnpwlovpkbwnte.supabase.co`
   - `SUPABASE_ANON_KEY=<your-supabase-anon-key>`
   - `GEMINI_API_KEY=<your-gemini-api-key>`
   - `CORS_ORIGINS=https://ais-dev-dvm7cp37tu7ipktvhb6bmt-971598154639.asia-southeast1.run.app,https://ais-pre-dvm7cp37tu7ipktvhb6bmt-971598154639.asia-southeast1.run.app`

## 2. Start Command
Configured in `Procfile` and `railway.toml`:
```bash
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

## 3. Exposed Endpoints
- `GET /health`
- `GET /roles`
- `POST /chat`
- `POST /ingest/status`
- `POST /admin/knowledge-base/upload` (ADMIN-only)
- `GET /admin/knowledge-base/documents` (ADMIN-only)
- `GET /admin/knowledge-base/documents/{document_id}` (ADMIN-only)
- `PATCH /admin/knowledge-base/documents/{document_id}` (ADMIN-only)
- `DELETE /admin/knowledge-base/documents/{document_id}` (ADMIN-only)
- `POST /admin/knowledge-base/documents/{document_id}/reindex` (ADMIN-only)
- `GET /admin/knowledge-base/status` (ADMIN-only)
