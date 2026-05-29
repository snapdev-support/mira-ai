from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

# NOTE: admin OUTPUT views use `str` for email rather than `EmailStr` so they
# can faithfully display whatever's in the DB — including legacy or
# RFC-reserved test TLDs that EmailStr rejects. EmailStr stays on INPUT
# models (login, signup) where strict validation is what we want.


# ── Admin profile ──────────────────────────────────────────────────────────


class AdminMe(BaseModel):
    id: str
    email: str  # output, see EmailStr note above
    role: Literal["admin", "super_admin"]
    first_name: Optional[str] = None
    last_name: Optional[str] = None


# ── KB article ─────────────────────────────────────────────────────────────


class KBArticleIn(BaseModel):
    """Payload for creating a new KB article."""

    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9][a-z0-9-]*$")
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1, max_length=8000)
    priority: int = Field(default=50, ge=0, le=1000)


class KBArticleUpdate(BaseModel):
    """Partial update — every field optional. Slug is immutable post-create."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category: Optional[str] = Field(default=None, min_length=1, max_length=80)
    content: Optional[str] = Field(default=None, min_length=1, max_length=8000)
    priority: Optional[int] = Field(default=None, ge=0, le=1000)


class KBArticleOut(BaseModel):
    slug: str
    title: str
    category: str
    content: str
    priority: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


class KBArticleListResponse(BaseModel):
    articles: list[KBArticleOut]
    total: int


# ── Support tickets ────────────────────────────────────────────────────────


TicketStatus = Literal["open", "closed"]


class TicketChatTurn(BaseModel):
    """A turn of the original bot conversation that produced the ticket."""

    role: Literal["user", "assistant"]
    content: str


class TicketReply(BaseModel):
    """One reply on the ticket — from the team or the customer."""

    role: Literal["admin", "user"]
    author_email: str  # output — admin email or user email depending on role
    # Legacy fields kept on the wire so existing frontends keep rendering.
    # Equals author_email when role=admin; null when role=user.
    admin_id: Optional[str] = None
    admin_email: Optional[str] = None
    content: str
    ts: datetime


class TicketSummary(BaseModel):
    """List-view shape — small, sortable."""

    ticket_id: str
    user_email: Optional[str] = None  # output
    status: TicketStatus
    message_preview: str = Field(description="First ~120 chars of the original message")
    created_at: datetime
    closed_at: Optional[datetime] = None
    reply_count: int = 0
    last_reply_at: Optional[datetime] = None


class TicketDetail(BaseModel):
    """Full ticket including bot transcript and admin replies."""

    ticket_id: str
    user_email: Optional[str] = None  # output
    status: TicketStatus
    message: str
    conversation_history: list[TicketChatTurn] = []
    replies: list[TicketReply] = []
    created_at: datetime
    closed_at: Optional[datetime] = None
    closed_by_email: Optional[str] = None  # output


class TicketListResponse(BaseModel):
    tickets: list[TicketSummary]
    total: int
    has_more: bool


class TicketReplyIn(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


# ── Users ──────────────────────────────────────────────────────────────────


UserRole = Literal["user", "admin", "super_admin"]


class UserSummary(BaseModel):
    id: str
    email: str  # output
    role: UserRole
    plan: str
    is_disabled: bool
    is_deleted: bool
    issued_count: int
    credits_remaining: int
    created_at: Optional[datetime] = None


class UserDetailStats(BaseModel):
    total_claims: int
    active_claims: int
    revoked_claims: int
    total_scans: int
    last_scan_at: Optional[datetime] = None
    last_claim_at: Optional[datetime] = None


class UserDetail(UserSummary):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    disabled_at: Optional[datetime] = None
    disabled_reason: Optional[str] = None
    deleted_at: Optional[datetime] = None
    stats: UserDetailStats


class UserListResponse(BaseModel):
    users: list[UserSummary]
    total: int
    has_more: bool


class CreditAdjustIn(BaseModel):
    delta: int = Field(description="Signed change. Negative reduces; absolute change > 0.")
    reason: str = Field(min_length=1, max_length=500)


class DisableUserIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class DeleteUserIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class RoleChangeIn(BaseModel):
    role: UserRole
    reason: Optional[str] = Field(default=None, max_length=500)


# ── Claims & scans subresources (admin views) ──────────────────────────────


class AdminClaimSummary(BaseModel):
    jti: str
    template: Optional[str] = None
    status: Optional[str] = None
    iat: Optional[datetime] = None
    # exp is stored as a datetime in live-issued claims but as an ISO string
    # in the seed script. Pydantic coerces strings to datetime automatically.
    exp: Optional[datetime] = None
    qr_payload: Optional[str] = None


class AdminClaimListResponse(BaseModel):
    claims: list[AdminClaimSummary]
    total: int
    has_more: bool


class AdminScanEvent(BaseModel):
    ts: datetime
    jti: Optional[str] = None
    verdict: Optional[str] = None
    reason_code: Optional[str] = None
    latency_ms: Optional[int] = None
    token_class: Optional[str] = None


class AdminScanListResponse(BaseModel):
    scans: list[AdminScanEvent]
    total: int
    has_more: bool


# ── Claim revocation (admin-initiated) ─────────────────────────────────────


class ClaimRevokeIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class ClaimRevokeResponse(BaseModel):
    jti: str
    status: str
    revoked_by_admin: bool
    admin_reason: Optional[str] = None
    revoked_at: Optional[datetime] = None


# ── Billing & refunds (admin views) ────────────────────────────────────────


class AdminRefundRecord(BaseModel):
    stripe_refund_id: str
    amount_cents: int
    currency: str = "usd"
    reason: Optional[str] = None
    forced: bool = False
    issued_by_email: Optional[str] = None
    ts: datetime
    stripe_status: Optional[str] = None


class AdminTransactionSummary(BaseModel):
    id: str
    created_at: Optional[datetime] = None
    description: str
    amount_usd: int
    credits_added: int
    status: str  # pending | paid | refunded | partially_refunded
    refunded_amount_cents: int = 0
    refunds: list[AdminRefundRecord] = []
    payment_intent_id: Optional[str] = None
    refundable: bool = Field(
        default=False,
        description="True when the tx is in a state that can be refunded "
        "by the policy without force=true (server-evaluated convenience).",
    )


class AdminTransactionListResponse(BaseModel):
    transactions: list[AdminTransactionSummary]
    total: int


class RefundIssueIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
    force: bool = Field(
        default=False,
        description="Super-admin only — bypasses the soft policy rules "
        "(time window, consumption cap, repeat-refund block).",
    )


class RefundIssueResponse(BaseModel):
    stripe_refund_id: str
    amount_cents: int
    transaction_id: str
    forced: bool


# ── Metrics ────────────────────────────────────────────────────────────────


class MetricsOverview(BaseModel):
    total_users: int
    active_users_24h: int = Field(description="Distinct users with a scan in the last 24h")
    active_users_7d: int
    total_claims_issued: int
    claims_issued_24h: int
    total_scans: int
    scans_24h: int
    open_tickets: int
    revenue_last_30d_usd: float
    # Snapshot timestamp so the caller knows how stale these numbers are.
    generated_at: datetime


class ScansBucket(BaseModel):
    ts: datetime
    count: int


class ScansSeriesResponse(BaseModel):
    granularity: Literal["hour", "day"]
    buckets: list[ScansBucket]
    total: int


# ── Audit log viewer ───────────────────────────────────────────────────────


class AuditLogEntry(BaseModel):
    id: str
    ts: datetime
    admin_email: str  # output
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    reason: Optional[str] = None
    before: Optional[dict] = None
    after: Optional[dict] = None
    ip: Optional[str] = None


class AuditLogResponse(BaseModel):
    entries: list[AuditLogEntry]
    total: int
    has_more: bool
