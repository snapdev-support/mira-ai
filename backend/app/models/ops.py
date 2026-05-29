from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


class OpsTilesResponse(BaseModel):
    updated_at: datetime

    scans_today: int
    total_scans: int

    claims_total: int
    claims_active: int
    claims_revoked: int

    verify_p50_ms: Optional[int]
    verify_p95_ms: Optional[int]
    verify_avg_ms: Optional[int]

    last_revocation_age_s: Optional[int]


class OpsTrafficBucket(BaseModel):
    date: str  # YYYY-MM-DD (UTC)
    scans: int
    avg_latency_ms: Optional[int] = None


class OpsTrafficResponse(BaseModel):
    items: List[OpsTrafficBucket]


OpsEventType = Literal["scan", "issue", "revoke"]
OpsEventStatus = Literal["success", "info", "warning", "error"]


class OpsEventItem(BaseModel):
    id: str
    type: OpsEventType
    status: OpsEventStatus
    message: str
    ts: datetime
    jti: Optional[str] = None
    verdict: Optional[str] = None


class OpsEventsResponse(BaseModel):
    items: List[OpsEventItem]


class OpsClaimItem(BaseModel):
    jti: str
    template: Optional[str] = None
    status: Literal["active", "revoked"]
    iat: datetime
    exp: Optional[Any] = None
    subject: Dict[str, Any] = {}
    qr_payload: str

    scan_count: int = 0
    last_scan_ts: Optional[datetime] = None


class OpsClaimsResponse(BaseModel):
    items: List[OpsClaimItem]
    next_cursor: Optional[str] = None
