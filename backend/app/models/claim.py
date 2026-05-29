from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field
from pydantic import model_validator


TemplateType = Literal["invoice", "package", "return_sla"]


class Subject(BaseModel):
    type: str
    id: str


class Policy(BaseModel):
    replay_window_s: int = Field(default=300, ge=0, le=3600)


class IssueClaimRequest(BaseModel):
    template: TemplateType
    subject: Subject
    facts: Dict[str, Any] = Field(default_factory=dict)
    exp: datetime
    policy: Policy = Field(default_factory=Policy)

    @model_validator(mode="after")
    def _validate_subject_and_exp(self) -> "IssueClaimRequest":
        if self.subject.type != self.template:
            raise ValueError("subject.type must match template")
        # Require explicit timezone to avoid ambiguous local-time expirations.
        if self.exp.tzinfo is None or self.exp.tzinfo.utcoffset(self.exp) is None:
            raise ValueError("exp must be timezone-aware (include 'Z' or an offset)")
        return self


class IssueClaimResponse(BaseModel):
    jti: str
    qrPayload: str
    exp: datetime
    status: Literal["active", "revoked"] = "active"


class RevokeClaimRequest(BaseModel):
    jti: str
    reason: str


class OkResponse(BaseModel):
    ok: bool = True


class PaymentRequiredResponse(BaseModel):
    # Legacy fields kept for backwards compatibility with older frontend code.
    detail: Optional[str] = None
    checkoutUrl: Optional[str] = None

    error: Optional[Dict[str, Any]] = None
    quota: Optional[Dict[str, Any]] = None
    actions: Optional[Dict[str, Any]] = None
