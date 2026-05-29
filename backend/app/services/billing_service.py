from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import stripe
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.core.config import settings

# ── Plan label helpers ─────────────────────────────────────────────────────

_CREDITS_TO_PLAN: Dict[int, str] = {
    1000: "credits_1000",
    5000: "credits_5000",
    12000: "credits_12000",
}

_PLAN_LABELS: Dict[str, str] = {
    "credits_1000": "Starter — 1,000 Credits",
    "credits_5000": "Growth — 5,000 Credits",
    "credits_12000": "Enterprise — 12,000 Credits",
}

_PLAN_NAMES: Dict[str, str] = {
    "credits_1000": "Starter",
    "credits_5000": "Growth",
    "credits_12000": "Enterprise",
}


def _configure_stripe() -> None:
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe secret key not configured")
    stripe.api_key = settings.stripe_secret_key


def get_billing_plans() -> Dict[str, Dict[str, Any]]:
    # Static mapping (one-time credit purchases)
    return {
        "credits_1000": {
            "id": "credits_1000",
            "priceUsd": 97,
            "credits": 1000,
            "stripePriceId": settings.stripe_price_id_1000,
        },
        "credits_5000": {
            "id": "credits_5000",
            "priceUsd": 499,
            "credits": 5000,
            "stripePriceId": settings.stripe_price_id_5000,
        },
        "credits_12000": {
            "id": "credits_12000",
            "priceUsd": 999,
            "credits": 12000,
            "stripePriceId": settings.stripe_price_id_12000,
        },
    }


def resolve_plan(plan_id: str) -> Dict[str, Any]:
    plans = get_billing_plans()
    plan = plans.get(plan_id)
    if not plan:
        raise ValueError("Unknown planId")
    return plan


async def _ensure_stripe_customer(db: AsyncIOMotorDatabase, user: dict) -> Optional[str]:
    customer_id: Optional[str] = user.get("stripe_customer_id")
    if not settings.stripe_secret_key:
        return None

    _configure_stripe()

    if customer_id:
        try:
            customer = stripe.Customer.retrieve(customer_id)
            if not getattr(customer, "deleted", False):
                return customer_id
        except stripe.error.InvalidRequestError:
            pass
        # Stale/deleted customer — clear from DB
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$unset": {"stripe_customer_id": ""}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        customer_id = None

    user_id = str(user["_id"])
    email: str = user.get("email")
    customer = stripe.Customer.create(email=email, metadata={"account_id": user_id})
    customer_id = customer["id"]
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"stripe_customer_id": customer_id, "updated_at": datetime.now(timezone.utc)}})
    return customer_id


async def create_checkout_session(db: AsyncIOMotorDatabase, user: dict, plan_id: str) -> Tuple[str, str]:
    plan = resolve_plan(plan_id)

    # If Stripe isn't configured yet, return a stable placeholder URL so the
    # frontend can still implement the flow locally.
    if not settings.stripe_secret_key or not plan.get("stripePriceId"):
        placeholder = f"{settings.stripe_frontend_base_url}/app/billing"
        return placeholder, ""

    _configure_stripe()

    user_id = str(user["_id"])
    credits = int(plan["credits"])
    price_id = str(plan["stripePriceId"])

    base_url = settings.stripe_frontend_base_url
    success_url = f"{base_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base_url}/app/billing?canceled=1"

    customer_id = await _ensure_stripe_customer(db, user)

    session_kwargs: Dict[str, Any] = {
        "mode": "payment",
        # Keep this in sync with webhook handling expectations.
        # Restrict to card to avoid delayed/asynchronous payment flows unless explicitly supported.
        "payment_method_types": ["card"],
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": user_id,
        "metadata": {
            "account_id": user_id,
            "credits": str(credits),
            "planId": plan_id,
        },
    }
    if customer_id:
        session_kwargs["customer"] = customer_id
    else:
        session_kwargs["customer_email"] = user.get("email")

    session = stripe.checkout.Session.create(**session_kwargs)
    return session["url"], session["id"]


async def record_pending_transaction(
    db: AsyncIOMotorDatabase,
    account_id: ObjectId,
    checkout_session_id: str,
    plan_id: str,
) -> None:
    """Reserve ONE billing_transactions row per checkout session, keyed by
    `checkout_session_id`. The row starts as `pending` and is later flipped
    to `paid` in place by `apply_checkout_session_completed`.

    Idempotent: re-calling with the same checkout_session_id is a no-op
    (only `updated_at` is touched). Safe under double-clicks on Buy.
    """
    now = datetime.now(timezone.utc)
    plan = resolve_plan(plan_id)
    await db.billing_transactions.update_one(
        {"checkout_session_id": checkout_session_id},
        {
            "$setOnInsert": {
                "account_id": account_id,
                "checkout_session_id": checkout_session_id,
                "payment_intent_id": None,
                "price_id": plan.get("stripePriceId"),
                "usd_amount": int(plan["priceUsd"]),
                "credits_added": int(plan["credits"]),
                "status": "pending",
                "created_at": now,
            },
            "$set": {"updated_at": now},
        },
        upsert=True,
    )


def _normalize_plan_value(value: Optional[str]) -> str:
    if value in ("paid", "pro"):
        return "paid"
    return "free"


async def apply_checkout_session_completed(db: AsyncIOMotorDatabase, stripe_event_id: str, session: Dict[str, Any]) -> None:
    """Flip the existing pending row for this checkout session to `paid` and
    grant credits exactly once.

    Idempotency model: the source of truth is the atomic conditional update
    `{checkout_session_id, status: pending} → status: paid`. Only ONE caller
    across all retries/webhooks/verify-session sees modified_count == 1, and
    that's the caller that gets to grant credits. Everyone else short-circuits.

    Edge case: if no pending row exists (e.g. `record_pending_transaction`
    was skipped — legacy data, or a flow that bypassed it), we insert a
    paid row directly. Then the same `stripe_event_id` unique index keeps
    the credit grant idempotent for that path too.
    """
    now = datetime.now(timezone.utc)

    # Only grant credits once payment is actually successful.
    # For card payments, `checkout.session.completed` will be paid.
    # If delayed payment methods are ever enabled, this prevents crediting on "unpaid" sessions.
    payment_status = (session.get("payment_status") or "").lower()
    if payment_status not in ("paid", "no_payment_required"):
        return

    metadata = session.get("metadata") or {}
    account_id = metadata.get("account_id")
    plan_id = metadata.get("planId")
    stripe_customer_id = session.get("customer")
    checkout_session_id = session.get("id")
    payment_intent_id = session.get("payment_intent")

    if not account_id:
        return

    try:
        oid = ObjectId(str(account_id))
    except Exception:
        return

    # Prefer server-side plan mapping over metadata.
    credits: Optional[int] = None
    if plan_id:
        try:
            credits = int(resolve_plan(str(plan_id))["credits"])
        except Exception:
            credits = None
    if credits is None:
        credits_raw = metadata.get("credits")
        if not credits_raw:
            return
        try:
            credits = int(credits_raw)
        except Exception:
            return

    plan = resolve_plan(str(plan_id)) if plan_id else None
    usd_amount = int((plan or {}).get("priceUsd") or 0)

    # ── The atomic transition. Only one caller wins. ─────────────────────
    granted_credits = False
    if checkout_session_id:
        transition = await db.billing_transactions.update_one(
            {"checkout_session_id": checkout_session_id, "status": "pending"},
            {
                "$set": {
                    "status": "paid",
                    "stripe_event_id": stripe_event_id,
                    "payment_intent_id": payment_intent_id,
                    "credits_added": int(credits),
                    "usd_amount": usd_amount,
                    "price_id": (plan or {}).get("stripePriceId"),
                    "updated_at": now,
                }
            },
        )
        if transition.modified_count > 0:
            granted_credits = True

    # No pending row matched. Either it's an idempotent replay (already paid)
    # or the pending row was never created. Disambiguate by looking up.
    if not granted_credits:
        existing = (
            await db.billing_transactions.find_one(
                {"checkout_session_id": checkout_session_id}
            )
            if checkout_session_id
            else None
        )
        if existing is not None:
            # Already applied — short-circuit. Don't double-credit, don't
            # double-update the customer record.
            return

        # No row at all → fresh insert. Use stripe_event_id unique index to
        # avoid double-inserts under simultaneous webhook + verify-session.
        try:
            await db.billing_transactions.insert_one(
                {
                    "account_id": oid,
                    "stripe_event_id": stripe_event_id,
                    "checkout_session_id": checkout_session_id,
                    "payment_intent_id": payment_intent_id,
                    "price_id": (plan or {}).get("stripePriceId"),
                    "usd_amount": usd_amount,
                    "credits_added": int(credits),
                    "status": "paid",
                    "created_at": now,
                    "updated_at": now,
                }
            )
        except DuplicateKeyError:
            # Race lost — another caller inserted first. Don't credit.
            return
        granted_credits = True

    # Credits + customer record. Only runs on the winning path.
    if not granted_credits:
        return

    user = await db.users.find_one({"_id": oid})
    existing_plan = _normalize_plan_value((user or {}).get("plan"))
    user_update: Dict[str, Any] = {
        "$inc": {"claim_credits_remaining": int(credits)},
        "$set": {"updated_at": now},
    }
    if stripe_customer_id:
        user_update["$set"]["stripe_customer_id"] = stripe_customer_id
    if existing_plan != "paid":
        user_update["$set"]["plan"] = "paid"
        user_update["$set"]["plan_updated_at"] = now

    await db.users.update_one({"_id": oid}, user_update)


# ── New billing endpoints ──────────────────────────────────────────────────

async def get_subscription_overview(db: AsyncIOMotorDatabase, user: dict) -> Dict[str, Any]:
    account_id = user["_id"]
    credits_remaining = int(user.get("claim_credits_remaining", 0))

    latest = await db.billing_transactions.find_one(
        {"account_id": account_id, "status": "paid"},
        sort=[("created_at", -1)],
    )

    pipeline: List[Dict[str, Any]] = [
        {"$match": {"account_id": account_id, "status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$credits_added"}}},
    ]
    agg = await db.billing_transactions.aggregate(pipeline).to_list(1)
    credits_total = int(agg[0]["total"]) if agg else 0
    free_limit = int(settings.free_tier_issue_cap)
    credits_total = max(credits_total, free_limit, credits_remaining)

    user_plan = _normalize_plan_value(user.get("plan"))

    # Last purchase info always comes from transactions regardless of plan status
    if latest:
        last_amount_usd = int(latest.get("usd_amount", 0))
        last_purchase_date: Optional[str] = latest["created_at"].isoformat()
    else:
        last_amount_usd = 0
        last_purchase_date = None

    if user_plan == "paid" and latest:
        credits_added = int(latest.get("credits_added", 0))
        plan_id = _CREDITS_TO_PLAN.get(credits_added, "credits_custom")
        plan_name = _PLAN_NAMES.get(plan_id, "Credits")
        period_start: Optional[str] = last_purchase_date
    else:
        plan_id = "free"
        plan_name = "Free"
        created_at = user.get("created_at")
        period_start = created_at.isoformat() if isinstance(created_at, datetime) else None

    return {
        "planName": plan_name,
        "planId": plan_id,
        "amountUsd": last_amount_usd,
        "interval": "one_time",
        "status": "active",
        "currentPeriodStart": period_start,
        "currentPeriodEnd": None,
        "cancelAtPeriodEnd": False,
        "creditsRemaining": credits_remaining,
        "creditsTotal": credits_total,
    }


async def get_transactions(
    db: AsyncIOMotorDatabase,
    account_id: ObjectId,
    page: int = 1,
    page_size: int = 10,
) -> Dict[str, Any]:
    skip = (page - 1) * page_size
    total = await db.billing_transactions.count_documents({"account_id": account_id})

    cursor = (
        db.billing_transactions.find({"account_id": account_id})
        .sort("created_at", -1)
        .skip(skip)
        .limit(page_size)
    )
    docs = await cursor.to_list(page_size)

    items = []
    for tx in docs:
        credits_added = int(tx.get("credits_added", 0))
        plan_id = _CREDITS_TO_PLAN.get(credits_added, "credits_custom")
        label = _PLAN_LABELS.get(plan_id, f"{credits_added:,} Credits")
        created = tx.get("created_at")
        items.append({
            "id": str(tx["_id"]),
            "date": created.isoformat() if isinstance(created, datetime) else "",
            "description": label,
            "amountUsd": int(tx.get("usd_amount", 0)),
            "credits": credits_added,
            "status": tx.get("status", "pending"),
            "invoiceUrl": None,
            "planId": plan_id,
        })

    return {"items": items, "total": total, "page": page, "pageSize": page_size}


async def get_payment_methods(db: AsyncIOMotorDatabase, user: dict) -> Dict[str, Any]:
    customer_id: Optional[str] = user.get("stripe_customer_id")
    if not customer_id or not settings.stripe_secret_key:
        return {"items": []}

    _configure_stripe()
    try:
        stripe_customer = stripe.Customer.retrieve(customer_id)
        if getattr(stripe_customer, "deleted", False):
            raise stripe.error.InvalidRequestError("Customer deleted", param="customer")
        methods = stripe.PaymentMethod.list(customer=customer_id, type="card")
        default_pm_id = getattr(
            getattr(stripe_customer, "invoice_settings", None), "default_payment_method", None
        )
        items = []
        for pm in methods.data:
            card = pm.get("card") or {}
            items.append({
                "id": pm["id"],
                "type": "card",
                "isDefault": pm["id"] == default_pm_id,
                "card": {
                    "brand": card.get("brand", "unknown"),
                    "last4": card.get("last4", "0000"),
                    "expMonth": card.get("exp_month", 1),
                    "expYear": card.get("exp_year", 2099),
                },
                "createdAt": datetime.fromtimestamp(pm["created"], tz=timezone.utc).isoformat(),
            })
        return {"items": items}
    except stripe.error.InvalidRequestError:
        # Customer deleted or not found — clear stale ID from DB
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$unset": {"stripe_customer_id": ""}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        return {"items": []}
    except stripe.error.StripeError:
        return {"items": []}


async def delete_payment_method(pm_id: str) -> None:
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe not configured")
    _configure_stripe()
    stripe.PaymentMethod.detach(pm_id)


async def set_default_payment_method(
    db: AsyncIOMotorDatabase, user: dict, pm_id: str
) -> None:
    customer_id: Optional[str] = user.get("stripe_customer_id")
    if not customer_id or not settings.stripe_secret_key:
        raise RuntimeError("Stripe not configured")
    _configure_stripe()
    stripe.Customer.modify(
        customer_id,
        invoice_settings={"default_payment_method": pm_id},
    )


async def create_setup_intent(db: AsyncIOMotorDatabase, user: dict) -> Dict[str, Any]:
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe not configured")
    _configure_stripe()
    customer_id = await _ensure_stripe_customer(db, user)
    si = stripe.SetupIntent.create(
        customer=customer_id,
        usage="off_session",
        payment_method_types=["card"],
    )
    return {"clientSecret": si["client_secret"]}


async def attach_payment_method(
    db: AsyncIOMotorDatabase,
    user: dict,
    pm_id: str,
    set_default: bool = False,
) -> Dict[str, Any]:
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe not configured")
    _configure_stripe()

    customer_id: Optional[str] = user.get("stripe_customer_id")
    if not customer_id:
        customer_id = await _ensure_stripe_customer(db, user)

    # Attach (idempotent — Stripe returns the PM even if already attached)
    try:
        pm = stripe.PaymentMethod.attach(pm_id, customer=customer_id)
    except stripe.error.InvalidRequestError:
        pm = stripe.PaymentMethod.retrieve(pm_id)

    if set_default:
        stripe.Customer.modify(
            customer_id,
            invoice_settings={"default_payment_method": pm_id},
        )

    customer = stripe.Customer.retrieve(customer_id)
    default_pm_id = (
        (customer.get("invoice_settings") or {}).get("default_payment_method")
    )

    card = pm.get("card") or {}
    return {
        "id": pm["id"],
        "type": "card",
        "isDefault": pm["id"] == default_pm_id,
        "card": {
            "brand": card.get("brand", "unknown"),
            "last4": card.get("last4", "0000"),
            "expMonth": card.get("exp_month", 1),
            "expYear": card.get("exp_year", 2099),
        },
        "createdAt": datetime.fromtimestamp(pm["created"], tz=timezone.utc).isoformat(),
    }


async def cancel_plan(db: AsyncIOMotorDatabase, user: dict) -> None:
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"plan": "free", "plan_updated_at": now, "updated_at": now}},
    )


async def verify_checkout_session(
    db: AsyncIOMotorDatabase, user: dict, session_id: str
) -> Dict[str, Any]:
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe not configured")
    _configure_stripe()

    session = stripe.checkout.Session.retrieve(session_id)
    session_account_id = getattr(session.metadata, "account_id", None) if session.metadata else None
    if str(session_account_id) != str(user["_id"]):
        raise RuntimeError("Session does not belong to this user")

    await apply_checkout_session_completed(
        db,
        stripe_event_id=f"manual_verify_{session_id}",
        session=session.to_dict(),
    )

    return await get_subscription_overview(
        db, await db.users.find_one({"_id": user["_id"]})
    )


async def create_billing_portal(
    db: AsyncIOMotorDatabase, user: dict, return_url: str
) -> Dict[str, Any]:
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe not configured")
    _configure_stripe()
    customer_id = await _ensure_stripe_customer(db, user)
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return {"url": session["url"]}
