"""
Admin console API surface. All endpoints under /api/v1/admin/* require a
JWT carrying role=admin or role=super_admin. Sensitive endpoints additionally
require role=super_admin (e.g. KB delete).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from pymongo.errors import DuplicateKeyError

from app.core.admin_deps import require_admin, require_super_admin
from app.core.db import get_db
from app.core.logging import get_logger
from bson import ObjectId
from bson.errors import InvalidId

from app.models.admin import (
    AdminClaimListResponse,
    AdminClaimSummary,
    AdminMe,
    AdminRefundRecord,
    AdminScanEvent,
    AdminScanListResponse,
    AdminTransactionListResponse,
    AdminTransactionSummary,
    AuditLogEntry,
    AuditLogResponse,
    ClaimRevokeIn,
    ClaimRevokeResponse,
    CreditAdjustIn,
    DeleteUserIn,
    DisableUserIn,
    KBArticleIn,
    KBArticleListResponse,
    KBArticleOut,
    KBArticleUpdate,
    MetricsOverview,
    RefundIssueIn,
    RefundIssueResponse,
    RoleChangeIn,
    ScansBucket,
    ScansSeriesResponse,
    TicketDetail,
    TicketListResponse,
    TicketReplyIn,
    TicketSummary,
    UserDetail,
    UserDetailStats,
    UserListResponse,
    UserSummary,
)
from app.services.audit_service import AuditAction, log_admin_action
from app.services.notifications_service import (
    notify_refund_issued,
    notify_ticket_close,
    notify_ticket_reply,
)
from app.services.refund_service import RefundPolicyError, issue_refund

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
logger = get_logger("mira.admin")


# ── Profile ────────────────────────────────────────────────────────────────


@router.get("/me", response_model=AdminMe)
async def admin_me(admin: dict = Depends(require_admin)) -> AdminMe:
    return AdminMe(
        id=str(admin["_id"]),
        email=admin["email"],
        role=admin["role"],
        first_name=admin.get("first_name"),
        last_name=admin.get("last_name"),
    )


# ── KB articles ────────────────────────────────────────────────────────────


def _article_out(doc: dict) -> KBArticleOut:
    return KBArticleOut(
        slug=doc["slug"],
        title=doc["title"],
        category=doc.get("category", "General"),
        content=doc["content"],
        priority=int(doc.get("priority", 50)),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        created_by=str(doc["created_by"]) if doc.get("created_by") else None,
        updated_by=str(doc["updated_by"]) if doc.get("updated_by") else None,
    )


@router.get("/kb", response_model=KBArticleListResponse)
async def list_kb_articles(
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Substring search across title and content"),
    admin: dict = Depends(require_admin),
) -> KBArticleListResponse:
    db = get_db()
    query: dict = {}
    if category:
        query["category"] = category
    if q:
        # Case-insensitive search on title or content. Small KB → regex is fine.
        # Move to a text index once the KB outgrows it.
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"content": {"$regex": q, "$options": "i"}},
        ]

    cursor = db.kb_articles.find(query).sort([("priority", -1), ("slug", 1)])
    docs = await cursor.to_list(length=500)
    return KBArticleListResponse(
        articles=[_article_out(d) for d in docs],
        total=len(docs),
    )


@router.get("/kb/{slug}", response_model=KBArticleOut)
async def get_kb_article(slug: str, admin: dict = Depends(require_admin)) -> KBArticleOut:
    db = get_db()
    doc = await db.kb_articles.find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return _article_out(doc)


@router.post("/kb", response_model=KBArticleOut, status_code=status.HTTP_201_CREATED)
async def create_kb_article(
    payload: KBArticleIn,
    request: Request,
    admin: dict = Depends(require_admin),
) -> KBArticleOut:
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "slug": payload.slug,
        "title": payload.title,
        "category": payload.category,
        "content": payload.content,
        "priority": payload.priority,
        "created_at": now,
        "updated_at": now,
        "created_by": admin["_id"],
        "updated_by": admin["_id"],
    }
    try:
        await db.kb_articles.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An article with this slug already exists")

    await log_admin_action(
        admin=admin,
        action=AuditAction.KB_CREATE,
        target_type="kb_article",
        target_id=payload.slug,
        after={"title": payload.title, "category": payload.category, "priority": payload.priority},
        request=request,
    )
    return _article_out(doc)


@router.put("/kb/{slug}", response_model=KBArticleOut)
async def update_kb_article(
    slug: str,
    payload: KBArticleUpdate,
    request: Request,
    admin: dict = Depends(require_admin),
) -> KBArticleOut:
    db = get_db()
    existing = await db.kb_articles.find_one({"slug": slug})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    update_fields = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update_fields:
        # Nothing to do — return current state instead of an empty $set.
        return _article_out(existing)

    update_fields["updated_at"] = datetime.now(timezone.utc)
    update_fields["updated_by"] = admin["_id"]

    await db.kb_articles.update_one({"slug": slug}, {"$set": update_fields})
    doc = await db.kb_articles.find_one({"slug": slug})

    await log_admin_action(
        admin=admin,
        action=AuditAction.KB_UPDATE,
        target_type="kb_article",
        target_id=slug,
        before={k: existing.get(k) for k in update_fields if k not in ("updated_at", "updated_by")},
        after={k: v for k, v in update_fields.items() if k not in ("updated_at", "updated_by")},
        request=request,
    )
    return _article_out(doc)


@router.delete("/kb/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb_article(
    slug: str,
    request: Request,
    admin: dict = Depends(require_super_admin),
) -> None:
    db = get_db()
    existing = await db.kb_articles.find_one({"slug": slug})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    await db.kb_articles.delete_one({"slug": slug})

    await log_admin_action(
        admin=admin,
        action=AuditAction.KB_DELETE,
        target_type="kb_article",
        target_id=slug,
        before={
            "title": existing.get("title"),
            "category": existing.get("category"),
            "priority": existing.get("priority"),
        },
        request=request,
    )


# ── Support tickets ────────────────────────────────────────────────────────


_TICKET_PREVIEW_LEN = 160
_TICKET_LIST_DEFAULT = 25
_TICKET_LIST_MAX = 100


def _admin_reply_out(r: dict) -> dict:
    """Normalize a stored reply row to the wire shape.

    Schema split:
      - Legacy admin replies: {admin_id, admin_email, content, ts}
      - Two-way replies:      {role, author_id, author_email, content, ts}
    Output: a unified shape with `role` + `author_email`, plus admin_id/email
    populated only for admin replies (kept for back-compat with the existing
    admin frontend rendering).
    """
    role = r.get("role") or ("user" if r.get("user_email") else "admin")
    if role == "user":
        author = r.get("author_email") or r.get("user_email") or ""
        return {
            "role": "user",
            "author_email": author,
            "admin_id": None,
            "admin_email": None,
            "content": r["content"],
            "ts": r["ts"],
        }
    # admin
    author = r.get("author_email") or r.get("admin_email") or ""
    admin_id = r.get("author_id") or r.get("admin_id")
    return {
        "role": "admin",
        "author_email": author,
        "admin_id": str(admin_id) if admin_id else None,
        "admin_email": author,
        "content": r["content"],
        "ts": r["ts"],
    }


def _ticket_summary(doc: dict) -> TicketSummary:
    msg = doc.get("message") or ""
    replies = doc.get("replies") or []
    last_reply_at = replies[-1]["ts"] if replies else None
    return TicketSummary(
        ticket_id=doc["ticket_id"],
        user_email=doc.get("user_email"),
        status=doc.get("status", "open"),
        message_preview=(msg[:_TICKET_PREVIEW_LEN] + "…") if len(msg) > _TICKET_PREVIEW_LEN else msg,
        created_at=doc["created_at"],
        closed_at=doc.get("closed_at"),
        reply_count=len(replies),
        last_reply_at=last_reply_at,
    )


def _ticket_detail(doc: dict) -> TicketDetail:
    return TicketDetail(
        ticket_id=doc["ticket_id"],
        user_email=doc.get("user_email"),
        status=doc.get("status", "open"),
        message=doc.get("message") or "",
        conversation_history=[
            {"role": t.get("role", "user"), "content": t.get("content", "")}
            for t in (doc.get("conversation_history") or [])
        ],
        replies=[_admin_reply_out(r) for r in (doc.get("replies") or [])],
        created_at=doc["created_at"],
        closed_at=doc.get("closed_at"),
        closed_by_email=doc.get("closed_by_email"),
    )


@router.get("/tickets", response_model=TicketListResponse)
async def list_tickets(
    status_filter: Optional[str] = Query(None, alias="status", description="open | closed"),
    q: Optional[str] = Query(None, description="Substring search across message and email"),
    limit: int = Query(_TICKET_LIST_DEFAULT, ge=1, le=_TICKET_LIST_MAX),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_admin),
) -> TicketListResponse:
    db = get_db()
    query: dict = {}
    if status_filter in ("open", "closed"):
        query["status"] = status_filter
    if q:
        query["$or"] = [
            {"message": {"$regex": q, "$options": "i"}},
            {"user_email": {"$regex": q, "$options": "i"}},
            {"ticket_id": q},  # exact match for ticket_id since they're unique
        ]

    total = await db.support_tickets.count_documents(query)
    cursor = (
        db.support_tickets.find(query)
        # status DESC so "open" sorts before "closed" lexicographically.
        # Within each bucket, newest first.
        .sort([("status", -1), ("created_at", -1)])
        .skip(offset)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return TicketListResponse(
        tickets=[_ticket_summary(d) for d in docs],
        total=total,
        has_more=(offset + len(docs)) < total,
    )


@router.get("/tickets/{ticket_id}", response_model=TicketDetail)
async def get_ticket(ticket_id: str, admin: dict = Depends(require_admin)) -> TicketDetail:
    db = get_db()
    doc = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return _ticket_detail(doc)


@router.post("/tickets/{ticket_id}/reply", response_model=TicketDetail)
async def reply_to_ticket(
    ticket_id: str,
    payload: TicketReplyIn,
    request: Request,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(require_admin),
) -> TicketDetail:
    db = get_db()
    doc = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    reply = {
        "role": "admin",
        "author_id": admin["_id"],
        "author_email": admin["email"],
        # Legacy fields kept on the stored doc so any older reader (and
        # SendGrid templates that reference admin_email) keeps working.
        "admin_id": admin["_id"],
        "admin_email": admin["email"],
        "content": payload.content,
        "ts": datetime.now(timezone.utc),
    }
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$push": {"replies": reply}, "$set": {"updated_at": reply["ts"]}},
    )

    await log_admin_action(
        admin=admin,
        action=AuditAction.TICKET_REPLY,
        target_type="ticket",
        target_id=ticket_id,
        after={"content_length": len(payload.content)},
        request=request,
    )

    # Notify the ticket owner. Runs after the response is sent so SendGrid
    # latency / failure can't block the admin's UI. Anonymous tickets are
    # silently skipped inside the notifier.
    background_tasks.add_task(
        notify_ticket_reply,
        ticket_id=ticket_id,
        user_email=doc.get("user_email"),
        admin_email=admin["email"],
        reply_content=payload.content,
        created_at=reply["ts"],
    )

    updated = await db.support_tickets.find_one({"ticket_id": ticket_id})
    return _ticket_detail(updated)


@router.post("/tickets/{ticket_id}/close", response_model=TicketDetail)
async def close_ticket(
    ticket_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(require_admin),
) -> TicketDetail:
    db = get_db()
    doc = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if doc.get("status") == "closed":
        # Idempotent close — no audit-log entry, no notification on the
        # no-op case (we don't want a second email if Close is clicked twice).
        return _ticket_detail(doc)

    now = datetime.now(timezone.utc)
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": {
                "status": "closed",
                "closed_at": now,
                "closed_by": admin["_id"],
                "closed_by_email": admin["email"],
            }
        },
    )

    await log_admin_action(
        admin=admin,
        action=AuditAction.TICKET_CLOSE,
        target_type="ticket",
        target_id=ticket_id,
        before={"status": "open"},
        after={"status": "closed"},
        request=request,
    )

    # Notify the ticket owner that their ticket was closed. Anonymous tickets
    # are silently skipped inside the notifier.
    background_tasks.add_task(
        notify_ticket_close,
        ticket_id=ticket_id,
        user_email=doc.get("user_email"),
        admin_email=admin["email"],
    )

    updated = await db.support_tickets.find_one({"ticket_id": ticket_id})
    return _ticket_detail(updated)


# ── Users ──────────────────────────────────────────────────────────────────


_USER_LIST_DEFAULT = 25
_USER_LIST_MAX = 100
_CLAIM_LIST_MAX = 100
_SCAN_LIST_MAX = 100


def _parse_oid(user_id: str) -> ObjectId:
    try:
        return ObjectId(user_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")


def _user_summary(doc: dict) -> UserSummary:
    return UserSummary(
        id=str(doc["_id"]),
        email=doc["email"],
        role=doc.get("role", "user"),
        plan=doc.get("plan", "free"),
        is_disabled=bool(doc.get("is_disabled", False)),
        is_deleted=doc.get("deleted_at") is not None,
        issued_count=int(doc.get("issued_count", 0) or 0),
        credits_remaining=int(doc.get("claim_credits_remaining", 0) or 0),
        created_at=doc.get("created_at"),
    )


async def _user_detail(doc: dict) -> UserDetail:
    db = get_db()
    uid = doc["_id"]

    # Stats are computed on demand. Cheap on small datasets; revisit when
    # claim/scan counts get large (move to aggregation or denormalized counters).
    total_claims = await db.claims.count_documents({"account_id": uid})
    active_claims = await db.claims.count_documents({"account_id": uid, "status": "active"})
    revoked_claims = await db.claims.count_documents({"account_id": uid, "status": "revoked"})
    total_scans = await db.scan_events.count_documents({"issuer_account_id": uid})

    last_scan_doc = await db.scan_events.find_one(
        {"issuer_account_id": uid}, sort=[("ts", -1)], projection={"ts": 1}
    )
    last_claim_doc = await db.claims.find_one(
        {"account_id": uid}, sort=[("iat", -1)], projection={"iat": 1}
    )

    stats = UserDetailStats(
        total_claims=total_claims,
        active_claims=active_claims,
        revoked_claims=revoked_claims,
        total_scans=total_scans,
        last_scan_at=last_scan_doc["ts"] if last_scan_doc else None,
        last_claim_at=last_claim_doc["iat"] if last_claim_doc else None,
    )

    return UserDetail(
        **_user_summary(doc).model_dump(),
        first_name=doc.get("first_name"),
        last_name=doc.get("last_name"),
        stripe_customer_id=doc.get("stripe_customer_id"),
        disabled_at=doc.get("disabled_at"),
        disabled_reason=doc.get("disabled_reason"),
        deleted_at=doc.get("deleted_at"),
        stats=stats,
    )


@router.get("/users", response_model=UserListResponse)
async def list_users(
    q: Optional[str] = Query(None, description="Substring search on email"),
    role: Optional[str] = Query(None, description="Filter: user | admin | super_admin"),
    is_disabled: Optional[bool] = Query(None),
    include_deleted: bool = Query(False, description="Include soft-deleted users"),
    limit: int = Query(_USER_LIST_DEFAULT, ge=1, le=_USER_LIST_MAX),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_admin),
) -> UserListResponse:
    db = get_db()
    query: dict = {}
    if not include_deleted:
        query["deleted_at"] = None
    if q:
        query["email"] = {"$regex": q, "$options": "i"}
    if role in ("user", "admin", "super_admin"):
        query["role"] = role
    if is_disabled is not None:
        # Legacy users (created before the admin model existed) don't have an
        # is_disabled field at all, so {is_disabled: false} would silently
        # exclude them. Use $ne / $eq to match the field's logical value
        # regardless of whether it's stored as false, missing, or null.
        query["is_disabled"] = {"$eq": True} if is_disabled else {"$ne": True}

    total = await db.users.count_documents(query)
    cursor = (
        db.users.find(query)
        .sort([("created_at", -1)])
        .skip(offset)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return UserListResponse(
        users=[_user_summary(d) for d in docs],
        total=total,
        has_more=(offset + len(docs)) < total,
    )


@router.get("/users/{user_id}", response_model=UserDetail)
async def get_user(user_id: str, admin: dict = Depends(require_admin)) -> UserDetail:
    db = get_db()
    doc = await db.users.find_one({"_id": _parse_oid(user_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return await _user_detail(doc)


@router.get("/users/{user_id}/claims", response_model=AdminClaimListResponse)
async def list_user_claims(
    user_id: str,
    status_filter: Optional[str] = Query(None, alias="status", description="active | revoked"),
    limit: int = Query(25, ge=1, le=_CLAIM_LIST_MAX),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_admin),
) -> AdminClaimListResponse:
    db = get_db()
    uid = _parse_oid(user_id)
    if not await db.users.find_one({"_id": uid}, projection={"_id": 1}):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    query: dict = {"account_id": uid}
    if status_filter:
        query["status"] = status_filter

    total = await db.claims.count_documents(query)
    docs = await (
        db.claims.find(query, projection={"jti": 1, "template": 1, "status": 1, "iat": 1, "exp": 1, "qr_payload": 1})
        .sort([("iat", -1)])
        .skip(offset)
        .limit(limit)
        .to_list(length=limit)
    )
    return AdminClaimListResponse(
        claims=[
            AdminClaimSummary(
                jti=d["jti"],
                template=d.get("template"),
                status=d.get("status"),
                iat=d.get("iat"),
                exp=d.get("exp"),
                qr_payload=d.get("qr_payload"),
            )
            for d in docs
        ],
        total=total,
        has_more=(offset + len(docs)) < total,
    )


@router.get("/users/{user_id}/scans", response_model=AdminScanListResponse)
async def list_user_scans(
    user_id: str,
    verdict: Optional[str] = Query(None, description="Filter on verdict (VALID, EXPIRED, ...)"),
    limit: int = Query(25, ge=1, le=_SCAN_LIST_MAX),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_admin),
) -> AdminScanListResponse:
    db = get_db()
    uid = _parse_oid(user_id)
    if not await db.users.find_one({"_id": uid}, projection={"_id": 1}):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    query: dict = {"issuer_account_id": uid}
    if verdict:
        query["verdict"] = verdict.upper()

    total = await db.scan_events.count_documents(query)
    docs = await (
        db.scan_events.find(
            query,
            projection={"ts": 1, "jti": 1, "verdict": 1, "reason_code": 1, "latency_ms": 1, "token_class": 1},
        )
        .sort([("ts", -1)])
        .skip(offset)
        .limit(limit)
        .to_list(length=limit)
    )
    return AdminScanListResponse(
        scans=[
            AdminScanEvent(
                ts=d["ts"],
                jti=d.get("jti"),
                verdict=d.get("verdict"),
                reason_code=d.get("reason_code"),
                latency_ms=d.get("latency_ms"),
                token_class=d.get("token_class"),
            )
            for d in docs
        ],
        total=total,
        has_more=(offset + len(docs)) < total,
    )


# ── User write actions ────────────────────────────────────────────────────


def _block_self_action(admin: dict, target_id: ObjectId, action_name: str) -> None:
    """Prevent admins from acting destructively on themselves."""
    if admin["_id"] == target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot {action_name} your own account",
        )


@router.post("/users/{user_id}/credits/adjust", response_model=UserDetail)
async def adjust_credits(
    user_id: str,
    payload: CreditAdjustIn,
    request: Request,
    admin: dict = Depends(require_admin),
) -> UserDetail:
    if payload.delta == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="delta must be non-zero")

    db = get_db()
    uid = _parse_oid(user_id)
    doc = await db.users.find_one({"_id": uid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if doc.get("deleted_at") is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot adjust deleted user")

    before_credits = int(doc.get("claim_credits_remaining", 0) or 0)
    new_credits = max(before_credits + payload.delta, 0)

    await db.users.update_one(
        {"_id": uid},
        {"$set": {"claim_credits_remaining": new_credits, "updated_at": datetime.now(timezone.utc)}},
    )

    await log_admin_action(
        admin=admin,
        action=AuditAction.USER_CREDITS_ADJUST,
        target_type="user",
        target_id=str(uid),
        before={"claim_credits_remaining": before_credits},
        after={"claim_credits_remaining": new_credits, "delta_requested": payload.delta},
        reason=payload.reason,
        request=request,
    )

    updated = await db.users.find_one({"_id": uid})
    return await _user_detail(updated)


@router.post("/users/{user_id}/disable", response_model=UserDetail)
async def disable_user(
    user_id: str,
    payload: DisableUserIn,
    request: Request,
    admin: dict = Depends(require_admin),
) -> UserDetail:
    db = get_db()
    uid = _parse_oid(user_id)
    _block_self_action(admin, uid, "disable")

    doc = await db.users.find_one({"_id": uid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if doc.get("is_disabled"):
        return await _user_detail(doc)  # idempotent

    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": uid},
        {
            "$set": {
                "is_disabled": True,
                "disabled_at": now,
                "disabled_by": admin["_id"],
                "disabled_reason": payload.reason,
                "updated_at": now,
            }
        },
    )

    await log_admin_action(
        admin=admin,
        action=AuditAction.USER_DISABLE,
        target_type="user",
        target_id=str(uid),
        before={"is_disabled": False},
        after={"is_disabled": True},
        reason=payload.reason,
        request=request,
    )

    return await _user_detail(await db.users.find_one({"_id": uid}))


@router.post("/users/{user_id}/enable", response_model=UserDetail)
async def enable_user(
    user_id: str,
    request: Request,
    admin: dict = Depends(require_admin),
) -> UserDetail:
    db = get_db()
    uid = _parse_oid(user_id)
    doc = await db.users.find_one({"_id": uid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not doc.get("is_disabled"):
        return await _user_detail(doc)  # idempotent

    await db.users.update_one(
        {"_id": uid},
        {
            "$set": {
                "is_disabled": False,
                "disabled_at": None,
                "disabled_by": None,
                "disabled_reason": None,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    await log_admin_action(
        admin=admin,
        action=AuditAction.USER_ENABLE,
        target_type="user",
        target_id=str(uid),
        before={"is_disabled": True},
        after={"is_disabled": False},
        request=request,
    )

    return await _user_detail(await db.users.find_one({"_id": uid}))


@router.delete("/users/{user_id}", response_model=UserDetail)
async def delete_user(
    user_id: str,
    payload: DeleteUserIn,
    request: Request,
    admin: dict = Depends(require_super_admin),
) -> UserDetail:
    """Soft-delete. Sets deleted_at; record stays for audit trail."""
    db = get_db()
    uid = _parse_oid(user_id)
    _block_self_action(admin, uid, "delete")

    doc = await db.users.find_one({"_id": uid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if doc.get("deleted_at") is not None:
        return await _user_detail(doc)  # idempotent

    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": uid},
        {
            "$set": {
                "deleted_at": now,
                "deleted_by": admin["_id"],
                "is_disabled": True,  # belt-and-suspenders — also blocks login
                "updated_at": now,
            }
        },
    )

    await log_admin_action(
        admin=admin,
        action=AuditAction.USER_DELETE,
        target_type="user",
        target_id=str(uid),
        before={"deleted_at": None, "email": doc["email"]},
        after={"deleted_at": now.isoformat()},
        reason=payload.reason,
        request=request,
    )

    return await _user_detail(await db.users.find_one({"_id": uid}))


@router.post("/users/{user_id}/role", response_model=UserDetail)
async def change_user_role(
    user_id: str,
    payload: RoleChangeIn,
    request: Request,
    admin: dict = Depends(require_super_admin),
) -> UserDetail:
    db = get_db()
    uid = _parse_oid(user_id)

    # Block self-demotion — would lock the org out if this is the only super_admin.
    if admin["_id"] == uid and payload.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote your own super_admin role",
        )

    doc = await db.users.find_one({"_id": uid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if doc.get("deleted_at") is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change role of deleted user")

    old_role = doc.get("role", "user")
    if old_role == payload.role:
        return await _user_detail(doc)  # idempotent

    await db.users.update_one(
        {"_id": uid},
        {"$set": {"role": payload.role, "updated_at": datetime.now(timezone.utc)}},
    )

    # Differentiate grant vs revoke based on the privilege direction.
    rank = {"user": 0, "admin": 1, "super_admin": 2}
    action = (
        AuditAction.USER_ROLE_GRANT
        if rank[payload.role] > rank[old_role]
        else AuditAction.USER_ROLE_REVOKE
    )

    await log_admin_action(
        admin=admin,
        action=action,
        target_type="user",
        target_id=str(uid),
        before={"role": old_role},
        after={"role": payload.role},
        reason=payload.reason,
        request=request,
    )

    return await _user_detail(await db.users.find_one({"_id": uid}))


# ── Claim revocation (admin-initiated) ─────────────────────────────────────


@router.post("/claims/{jti}/revoke", response_model=ClaimRevokeResponse)
async def admin_revoke_claim(
    jti: str,
    payload: ClaimRevokeIn,
    request: Request,
    admin: dict = Depends(require_admin),
) -> ClaimRevokeResponse:
    """
    Admin-initiated claim revocation, on behalf of a customer. Unlike the
    customer-side revoke flow, this isn't scoped to a user — admins can
    revoke any active claim. The revocation row carries `revoked_by_admin`
    so customer-side audit reports can tell the difference.
    """
    db = get_db()
    claim = await db.claims.find_one({"jti": jti})
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")

    now = datetime.now(timezone.utc)
    if claim.get("status") == "revoked":
        # Idempotent — return the existing revocation if there is one. No new audit entry.
        existing_rev = await db.revocations.find_one({"jti": jti})
        return ClaimRevokeResponse(
            jti=jti,
            status="revoked",
            revoked_by_admin=bool((existing_rev or {}).get("revoked_by_admin", False)),
            admin_reason=(existing_rev or {}).get("admin_reason"),
            revoked_at=(existing_rev or {}).get("ts"),
        )

    await db.claims.update_one({"jti": jti}, {"$set": {"status": "revoked"}})
    await db.revocations.update_one(
        {"jti": jti},
        {
            "$setOnInsert": {
                "jti": jti,
                "reason": payload.reason,
                "ts": now,
                "by_account_id": claim.get("account_id"),
                "revoked_by_admin": True,
                "admin_id": admin["_id"],
                "admin_reason": payload.reason,
            }
        },
        upsert=True,
    )

    await log_admin_action(
        admin=admin,
        action=AuditAction.CLAIM_REVOKE,
        target_type="claim",
        target_id=jti,
        before={"status": claim.get("status", "active")},
        after={"status": "revoked"},
        reason=payload.reason,
        request=request,
    )

    return ClaimRevokeResponse(
        jti=jti,
        status="revoked",
        revoked_by_admin=True,
        admin_reason=payload.reason,
        revoked_at=now,
    )


# ── Billing — transactions & refunds ───────────────────────────────────────


_PLAN_LABELS = {
    1000: "Starter — 1,000 Credits",
    5000: "Growth — 5,000 Credits",
    12000: "Enterprise — 12,000 Credits",
}


def _tx_description(credits: int) -> str:
    return _PLAN_LABELS.get(credits, f"{credits:,} Credits")


def _refund_record_out(r: dict) -> AdminRefundRecord:
    return AdminRefundRecord(
        stripe_refund_id=r["stripe_refund_id"],
        amount_cents=int(r.get("amount_cents", 0)),
        currency=(r.get("currency") or "usd"),
        reason=r.get("reason"),
        forced=bool(r.get("forced", False)),
        issued_by_email=r.get("issued_by_email"),
        ts=r["ts"],
        stripe_status=r.get("stripe_status"),
    )


async def _is_refundable(tx: dict) -> bool:
    """Cheap, structural check only — server skips the expensive
    consumption-ratio calc here and lets the actual refund call do it.
    UI uses this as a hint, not gospel."""
    if tx.get("status") not in ("paid", "partially_refunded"):
        return False
    if not tx.get("payment_intent_id"):
        return False
    refunded = int(tx.get("refunded_amount_cents", 0))
    original = int(tx.get("usd_amount", 0)) * 100
    return refunded < original


@router.get(
    "/users/{user_id}/transactions",
    response_model=AdminTransactionListResponse,
)
async def list_user_transactions(
    user_id: str,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_admin),
) -> AdminTransactionListResponse:
    db = get_db()
    uid = _parse_oid(user_id)
    if not await db.users.find_one({"_id": uid}, projection={"_id": 1}):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    query = {"account_id": uid}
    total = await db.billing_transactions.count_documents(query)
    cursor = (
        db.billing_transactions.find(query)
        .sort([("created_at", -1)])
        .skip(offset)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)

    items: list[AdminTransactionSummary] = []
    for tx in docs:
        items.append(
            AdminTransactionSummary(
                id=str(tx["_id"]),
                created_at=tx.get("created_at"),
                description=_tx_description(int(tx.get("credits_added", 0) or 0)),
                amount_usd=int(tx.get("usd_amount", 0)),
                credits_added=int(tx.get("credits_added", 0)),
                status=tx.get("status", "pending"),
                refunded_amount_cents=int(tx.get("refunded_amount_cents", 0)),
                refunds=[_refund_record_out(r) for r in (tx.get("refunds") or [])],
                payment_intent_id=tx.get("payment_intent_id"),
                refundable=await _is_refundable(tx),
            )
        )
    return AdminTransactionListResponse(transactions=items, total=total)


@router.post(
    "/billing/transactions/{tx_id}/refund",
    response_model=RefundIssueResponse,
)
async def admin_issue_refund(
    tx_id: str,
    payload: RefundIssueIn,
    request: Request,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(require_admin),
) -> RefundIssueResponse:
    """Admin issues a full refund against a transaction. Super-admin can pass
    `force=true` to bypass the soft policy rules (time window, consumption,
    repeat-refund block). Stripe call is synchronous; customer email is
    offloaded to a BackgroundTask."""
    # force=true is a destructive override gated behind super_admin.
    if payload.force and admin.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super-admins can force-override the refund policy.",
        )

    db = get_db()

    try:
        result = await issue_refund(
            db,
            tx_id,
            admin_id=admin["_id"],
            admin_email=admin["email"],
            reason=payload.reason,
            force=payload.force,
        )
    except RefundPolicyError as exc:
        # Forced attempts leave an audit trail even when they fail. Without
        # this, a super-admin could probe overrides repeatedly with no
        # record — exactly the kind of activity we want surfaced in audit
        # review. Non-forced failures are routine policy declines and
        # don't merit a log entry.
        if payload.force:
            try:
                await log_admin_action(
                    admin=admin,
                    action=AuditAction.BILLING_REFUND_FORCED,
                    target_type="billing_transaction",
                    target_id=tx_id,
                    after={
                        "outcome": "failed",
                        "policy_code": exc.code,
                        "policy_message": exc.message,
                    },
                    reason=payload.reason,
                    request=request,
                )
            except Exception:
                # Audit failure must never mask the real error to the client.
                logger.exception("audit log write failed for forced refund attempt tx=%s", tx_id)
        # Encode the policy code in the detail so the frontend can branch UI.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": exc.code, "message": exc.message},
        )

    # Lookup customer email for the notification + audit log
    tx = await db.billing_transactions.find_one({"_id": ObjectId(tx_id)})
    customer = await db.users.find_one(
        {"_id": tx["account_id"]}, projection={"email": 1}
    )
    customer_email = (customer or {}).get("email")

    await log_admin_action(
        admin=admin,
        action=(
            AuditAction.BILLING_REFUND_FORCED
            if payload.force
            else AuditAction.BILLING_REFUND
        ),
        target_type="billing_transaction",
        target_id=tx_id,
        before={"status": "paid"},
        after={
            "status": "refunded" if result.amount_cents >= int(tx.get("usd_amount", 0)) * 100 else "partially_refunded",
            "amount_cents": result.amount_cents,
            "stripe_refund_id": result.stripe_refund_id,
        },
        reason=payload.reason,
        request=request,
    )

    # Email the customer. Best-effort; admin action persists regardless.
    background_tasks.add_task(
        notify_refund_issued,
        user_email=customer_email,
        amount_usd=result.amount_cents / 100.0,
        transaction_id=tx_id,
        reason=payload.reason,
        admin_email=admin["email"],
    )

    return RefundIssueResponse(
        stripe_refund_id=result.stripe_refund_id,
        amount_cents=result.amount_cents,
        transaction_id=result.transaction_id,
        forced=result.forced,
    )


# ── Metrics ────────────────────────────────────────────────────────────────


@router.get("/metrics/overview", response_model=MetricsOverview)
async def metrics_overview(admin: dict = Depends(require_admin)) -> MetricsOverview:
    db = get_db()
    now = datetime.now(timezone.utc)
    h24_ago = now - timedelta(hours=24)
    d7_ago = now - timedelta(days=7)
    d30_ago = now - timedelta(days=30)

    # A user counts as "active" in a window if they show ANY signal of life
    # in that window — a new signup, an issued claim, or a scan event. The
    # earlier scan-only definition silently zeroed out for orgs that hadn't
    # printed/scanned any QR codes yet.
    async def _distinct_active(since: datetime) -> int:
        active_ids: set = set()
        # Authors of scan events in window
        active_ids.update(
            await db.scan_events.distinct("issuer_account_id", {"ts": {"$gte": since}})
        )
        # Accounts that issued a claim in window
        active_ids.update(
            await db.claims.distinct("account_id", {"iat": {"$gte": since}})
        )
        # Accounts created in window
        active_ids.update(
            [u["_id"] async for u in db.users.find(
                {"created_at": {"$gte": since}, "deleted_at": None},
                projection={"_id": 1},
            )]
        )
        return len(active_ids)

    # Revenue: sum usd_amount on succeeded transactions in the last 30 days.
    # Stripe webhooks write `status: "paid"`; older code wrote "succeeded".
    # Accept both — never lose money to a vocabulary mismatch.
    rev_pipeline = [
        {"$match": {"created_at": {"$gte": d30_ago}, "status": {"$in": ["paid", "succeeded", "complete"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$usd_amount"}}},
    ]
    rev_doc = await db.billing_transactions.aggregate(rev_pipeline).to_list(length=1)
    revenue_usd = float(rev_doc[0]["total"]) if rev_doc else 0.0

    return MetricsOverview(
        total_users=await db.users.count_documents({"deleted_at": None}),
        active_users_24h=await _distinct_active(h24_ago),
        active_users_7d=await _distinct_active(d7_ago),
        total_claims_issued=await db.claims.count_documents({}),
        claims_issued_24h=await db.claims.count_documents({"iat": {"$gte": h24_ago}}),
        total_scans=await db.scan_events.count_documents({}),
        scans_24h=await db.scan_events.count_documents({"ts": {"$gte": h24_ago}}),
        open_tickets=await db.support_tickets.count_documents({"status": "open"}),
        revenue_last_30d_usd=revenue_usd,
        generated_at=now,
    )


@router.get("/metrics/scans", response_model=ScansSeriesResponse)
async def metrics_scans_series(
    from_: Optional[datetime] = Query(None, alias="from"),
    to: Optional[datetime] = Query(None),
    granularity: str = Query("day", regex="^(hour|day)$"),
    admin: dict = Depends(require_admin),
) -> ScansSeriesResponse:
    """
    Scan-event counts bucketed by hour or day. Defaults to the last 30 days
    (or 48 hours when granularity=hour) ending now.
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    if not to:
        to = now
    if not from_:
        from_ = to - (timedelta(hours=48) if granularity == "hour" else timedelta(days=30))

    if from_ >= to:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="'from' must precede 'to'")

    fmt = "%Y-%m-%dT%H" if granularity == "hour" else "%Y-%m-%d"
    pipeline = [
        {"$match": {"ts": {"$gte": from_, "$lte": to}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": fmt, "date": "$ts", "timezone": "UTC"}},
                "count": {"$sum": 1},
            }
        },
    ]
    rows = await db.scan_events.aggregate(pipeline).to_list(length=None)

    # Pad the response so every period in the window appears, even with count=0.
    # Without this, a single active day stretches into one chart-wide bar and
    # the operator can't see the surrounding context. We generate the full
    # bucket key list, then fill counts in from the aggregation result.
    counts_by_key: dict[str, int] = {r["_id"]: int(r["count"]) for r in rows if r.get("_id")}

    step = timedelta(hours=1) if granularity == "hour" else timedelta(days=1)
    # Floor the start to its bucket boundary so each row maps cleanly.
    if granularity == "hour":
        cursor_ts = from_.replace(minute=0, second=0, microsecond=0)
    else:
        cursor_ts = from_.replace(hour=0, minute=0, second=0, microsecond=0)

    buckets: list[ScansBucket] = []
    total = 0
    while cursor_ts <= to:
        key = cursor_ts.strftime(fmt)
        count = counts_by_key.get(key, 0)
        buckets.append(ScansBucket(ts=cursor_ts, count=count))
        total += count
        cursor_ts += step

    return ScansSeriesResponse(granularity=granularity, buckets=buckets, total=total)


# ── Audit log viewer (super_admin) ─────────────────────────────────────────


_AUDIT_LIST_DEFAULT = 50
_AUDIT_LIST_MAX = 200


def _audit_out(doc: dict) -> AuditLogEntry:
    return AuditLogEntry(
        id=str(doc["_id"]),
        ts=doc["ts"],
        admin_email=doc.get("admin_email") or "",
        action=doc["action"],
        target_type=doc.get("target_type"),
        target_id=doc.get("target_id"),
        reason=doc.get("reason"),
        before=doc.get("before"),
        after=doc.get("after"),
        ip=doc.get("ip"),
    )


@router.get("/audit-log", response_model=AuditLogResponse)
async def list_audit_log(
    action: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
    admin_email: Optional[str] = Query(None),
    from_: Optional[datetime] = Query(None, alias="from"),
    to: Optional[datetime] = Query(None),
    limit: int = Query(_AUDIT_LIST_DEFAULT, ge=1, le=_AUDIT_LIST_MAX),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_super_admin),
) -> AuditLogResponse:
    db = get_db()
    query: dict = {}
    if action:
        query["action"] = action
    if target_type:
        query["target_type"] = target_type
    if target_id:
        query["target_id"] = target_id
    if admin_email:
        query["admin_email"] = {"$regex": admin_email, "$options": "i"}
    if from_ or to:
        ts_filter: dict = {}
        if from_:
            ts_filter["$gte"] = from_
        if to:
            ts_filter["$lte"] = to
        query["ts"] = ts_filter

    total = await db.admin_audit_log.count_documents(query)
    cursor = (
        db.admin_audit_log.find(query)
        .sort([("ts", -1)])
        .skip(offset)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return AuditLogResponse(
        entries=[_audit_out(d) for d in docs],
        total=total,
        has_more=(offset + len(docs)) < total,
    )
