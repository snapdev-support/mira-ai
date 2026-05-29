"""
FastAPI auth dependencies for the admin console.

`require_admin` allows both `admin` and `super_admin`.
`require_super_admin` allows only `super_admin`.

Both return the loaded user dict (same shape as `get_current_user`), so
admin routes can use the user record directly without an extra DB lookup.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.db import get_db
from app.core.security import decode_access_token
from app.services.auth_service import get_user_by_id


# Mounted under the same /api/v1 prefix as the customer oauth scheme so a
# single token works for Swagger UI's "Authorize" dialog.
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


_ADMIN_ROLES = {"admin", "super_admin"}


async def _load_user_or_401(token: str) -> dict:
    db = get_db()
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await get_user_by_id(db, payload.get("sub"))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.get("deleted_at") is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account no longer exists")
    if user.get("is_disabled"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    # Stamp role from the live DB record onto the dict, ignoring the JWT
    # value — keeps role authoritative on the server even if a token was
    # issued before a role change. The 7-day session window is small enough
    # to live with for now; a token-revocation list comes in a later phase.
    user["role"] = user.get("role", "user")
    return user


async def require_admin(token: str = Depends(_oauth2_scheme)) -> dict:
    user = await _load_user_or_401(token)
    if user["role"] not in _ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


async def require_super_admin(token: str = Depends(_oauth2_scheme)) -> dict:
    user = await _load_user_or_401(token)
    if user["role"] != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super-admin access required")
    return user
