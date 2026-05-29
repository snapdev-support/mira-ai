from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Literal, Optional

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_FALLBACK_JWT_SECRET = secrets.token_urlsafe(48)

Role = Literal["user", "admin", "super_admin"]


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def _jwt_secret() -> str:
    if settings.jwt_secret:
        return settings.jwt_secret
    # Dev fallback only. Set JWT_SECRET in .env for stable tokens across restarts.
    return _FALLBACK_JWT_SECRET


def create_access_token(subject: str, email: str, role: Optional[str] = None) -> str:
    """
    Issue a JWT for the user. `role` defaults to "user" when omitted (legacy
    call sites). Admin login flows pass the actual role from the DB.
    """
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=settings.jwt_expires_in_seconds)
    payload: Dict[str, Any] = {
        "sub": subject,
        "email": email,
        "role": role or "user",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and verify. Tokens issued before the `role` field existed default
    to "user" so this is fully backward-compatible.
    """
    payload = jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
    payload.setdefault("role", "user")
    return payload
