from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


Verdict = Literal["VALID", "EXPIRED", "REVOKED", "UNVERIFIED", "UNKNOWN"]


class VerifyRequest(BaseModel):
    token: str
    include_safety: bool = False


class Issuer(BaseModel):
    type: Literal["mira"] = "mira"
    account_id: Optional[str] = None
    display: Optional[str] = None


class Subject(BaseModel):
    type: Optional[str] = None
    id: Optional[str] = None


class VerifyResponse(BaseModel):
    verdict: Verdict
    explanation: List[str]
    reason_code: str
    subject: Subject
    issuer: Issuer
    timestamp: datetime
    proofUrl: Optional[str] = None
    safety: Optional[Dict[str, Any]] = None
