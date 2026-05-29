from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.db import get_db
from app.routers.auth import get_current_user


router = APIRouter(prefix="/api/v1", tags=["account"])


def _normalize_plan(value: str | None) -> str:
    if value in ("paid", "pro"):
        return "paid"
    return "free"


@router.get("/account/usage")
async def account_usage(current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()

    issued_count = int(current_user.get("issued_count", 0) or 0)
    free_limit = int(settings.free_tier_issue_cap)

    credits_remaining = current_user.get("claim_credits_remaining")
    if credits_remaining is None:
        credits_remaining = max(free_limit - issued_count, 0)
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"claim_credits_remaining": int(credits_remaining), "updated_at": datetime.now(timezone.utc)}},
        )

    credits_remaining = int(credits_remaining or 0)

    # Sum all paid credits for percentage-based threshold calculation
    pipeline = [
        {"$match": {"account_id": current_user["_id"], "status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$credits_added"}}},
    ]
    agg = await db.billing_transactions.aggregate(pipeline).to_list(1)
    credits_total = int(agg[0]["total"]) if agg else 0
    credits_total = max(credits_total, free_limit, credits_remaining)

    return {
        "plan": _normalize_plan(current_user.get("plan")),
        "issuedCount": issued_count,
        "creditsRemaining": credits_remaining,
        "creditsTotal": credits_total,
        "freeLimit": free_limit,
    }
