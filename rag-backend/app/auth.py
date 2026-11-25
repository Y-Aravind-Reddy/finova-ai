"""Strict Supabase JWT authentication and backend role verification."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import Depends, Header, HTTPException, status

from .config import CANONICAL_ROLES, load_settings


@dataclass(frozen=True)
class VerifiedCaller:
    user_id: str
    email: str
    role: str
    tenant_id: str
    status: str


async def verify_supabase_bearer(
    authorization: Optional[str] = Header(default=None),
) -> VerifiedCaller:
    """
    Validate Supabase access token via Supabase Auth + public.profiles.
    Never trusts role or tenant values supplied by the client.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization Bearer token.",
        )

    token = authorization[len("Bearer ") :].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token is empty.",
        )

    settings = load_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication environment variables are not configured.",
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            user_resp = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {token}",
                },
            )
            if user_resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Supabase access token invalid or expired.",
                )

            user_data = user_resp.json()
            user_id = str(user_data.get("id") or "").strip()
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authenticated user id missing from Supabase token.",
                )

            profile_resp = await client.get(
                f"{settings.supabase_url}/rest/v1/profiles",
                params={
                    "id": f"eq.{user_id}",
                    "select": "id,email,role,tenant_id,status",
                },
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {token}",
                },
            )
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to reach Supabase authentication service: {exc}",
        ) from exc

    if profile_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to query caller profile in Supabase.",
        )

    rows = profile_resp.json()
    if not isinstance(rows, list) or len(rows) == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Financial profile not found in directory.",
        )

    profile = rows[0]
    role = str(profile.get("role") or "").strip().upper()
    tenant_id = str(profile.get("tenant_id") or "").strip()
    acct_status = str(profile.get("status") or "").strip()
    email = str(profile.get("email") or user_data.get("email") or "").strip().lower()

    if acct_status != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account status '{acct_status}' is not permitted.",
        )

    if role not in CANONICAL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unrecognized caller role '{role}'.",
        )

    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Caller profile is missing tenant_id isolation context.",
        )

    return VerifiedCaller(
        user_id=user_id,
        email=email,
        role=role,
        tenant_id=tenant_id,
        status=acct_status,
    )


async def require_admin_only(
    caller: VerifiedCaller = Depends(verify_supabase_bearer),
) -> VerifiedCaller:
    """
    Strictly allow ONLY backend-verified ADMIN role.
    SUPER_ADMIN, FINANCE_ANALYST, SUPPORT_EXECUTIVE, and CUSTOMER receive HTTP 403.
    """
    if caller.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Forbidden: Knowledge Base document management is restricted strictly to ADMIN. "
                f"Role '{caller.role}' is not permitted."
            ),
        )
    return caller


async def require_ingest_status_role(
    caller: VerifiedCaller = Depends(verify_supabase_bearer),
) -> VerifiedCaller:
    """Preserve /ingest/status access for SUPER_ADMIN and ADMIN."""
    if caller.role not in ("SUPER_ADMIN", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Role '{caller.role}' cannot inspect ingestion index status.",
        )
    return caller
