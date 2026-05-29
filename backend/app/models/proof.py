from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel

from app.models.verify import VerifyResponse


class ProofClaim(BaseModel):
    jti: str
    template: Optional[str] = None
    status: str
    iat: Optional[datetime] = None
    exp: Optional[datetime] = None
    subject: Dict[str, Any]
    facts: Dict[str, Any]
    qr_payload: Optional[str] = None
    account_id: Optional[str] = None


class ProofRevocation(BaseModel):
    jti: str
    reason: Optional[str] = None
    ts: Optional[datetime] = None
    by_account_id: Optional[str] = None


class ProofScanStats(BaseModel):
    scan_count: int
    last_scan_ts: Optional[datetime] = None
    last_latency_ms: Optional[int] = None
    last_verdict: Optional[str] = None


class ProofResponse(BaseModel):
    claim: ProofClaim
    verify: VerifyResponse
    revocation: Optional[ProofRevocation] = None
    scan_stats: Optional[ProofScanStats] = None
