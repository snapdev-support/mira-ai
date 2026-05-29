from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/api/v1/guest", tags=["guest"])

FREE_SCAN_LIMIT = 3


# ── Token helpers ─────────────────────────────────────────────────────────────

def _secret() -> str:
    return (settings.token_hmac_secret or settings.jwt_secret or "insecure-fallback")


def _sign(payload_b64: str) -> str:
    return hmac.new(_secret().encode(), payload_b64.encode(), hashlib.sha256).hexdigest()[:24]


def create_guest_token(scans_used: int) -> str:
    payload = {"s": scans_used, "t": int(time.time())}
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    sig = _sign(payload_b64)
    return f"{payload_b64}.{sig}"


def decode_guest_token(token: str) -> Optional[int]:
    """Return scans_used if token is valid, None if tampered/malformed."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        if not hmac.compare_digest(sig, _sign(payload_b64)):
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
        return int(payload["s"])
    except Exception:
        return None


# ── Endpoint ──────────────────────────────────────────────────────────────────

class GuestScanRequest(BaseModel):
    token: Optional[str] = None


class GuestScanResponse(BaseModel):
    allowed: bool
    token: str
    scans_used: int
    scans_remaining: int


@router.post("/scan", response_model=GuestScanResponse)
async def guest_scan_check(payload: GuestScanRequest) -> GuestScanResponse:
    """
    Called before each anonymous QR scan.
    Validates the signed guest token, increments the counter, and returns a new token.
    If the counter has reached the limit, returns allowed=False.
    Tampering with the token (e.g. resetting the count in localStorage) invalidates
    the signature and is treated as exhausted.
    """
    scans_used: int

    if payload.token:
        decoded = decode_guest_token(payload.token)
        if decoded is None:
            # Tampered or malformed token — treat as limit reached
            existing = create_guest_token(FREE_SCAN_LIMIT)
            return GuestScanResponse(
                allowed=False,
                token=existing,
                scans_used=FREE_SCAN_LIMIT,
                scans_remaining=0,
            )
        scans_used = decoded
    else:
        scans_used = 0

    if scans_used >= FREE_SCAN_LIMIT:
        return GuestScanResponse(
            allowed=False,
            token=payload.token or create_guest_token(FREE_SCAN_LIMIT),
            scans_used=scans_used,
            scans_remaining=0,
        )

    # Allow the scan and issue an updated token
    new_count = scans_used + 1
    new_token = create_guest_token(new_count)
    return GuestScanResponse(
        allowed=True,
        token=new_token,
        scans_used=new_count,
        scans_remaining=FREE_SCAN_LIMIT - new_count,
    )
