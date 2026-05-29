"""
Prepare a clean, well-known test bed for the full support + refund flow.

Outputs (printed to stdout, ready to copy into localStorage):
  CUSTOMER_TOKEN  → token key (customer-side app)
  ADMIN_TOKEN     → admin_token key (admin console)
  CUSTOMER_ID, ADMIN_ID — for sanity / direct API checks

Seeds:
  - 3 support tickets (fresh / mid-conversation / closed) for the customer
  - 5 billing transactions covering each refund policy edge case
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.dirname(_HERE)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from bson import ObjectId

from app.core.db import connect_mongo, close_mongo, get_db
from app.core.security import create_access_token, hash_password


CUSTOMER_EMAIL = "aliawan3032@gmail.com"
ADMIN_EMAIL = "e2e-admin@miratrust.test"
SEED_TAG = "e2e-test"


async def _upsert_user(db, email: str, role: str) -> dict:
    """Find or create a user, normalize role/state for the test."""
    existing = await db.users.find_one({"email": email})
    if existing:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "role": role,
                    "is_disabled": False,
                    "deleted_at": None,
                    "claim_credits_remaining": int(
                        existing.get("claim_credits_remaining") or 1000
                    ),
                }
            },
        )
        return await db.users.find_one({"_id": existing["_id"]})
    now = datetime.now(timezone.utc)
    doc = {
        "email": email,
        "password_hash": hash_password("e2e-fake"),
        "role": role,
        "is_disabled": False,
        "deleted_at": None,
        "first_name": "E2E",
        "last_name": "Tester",
        "plan": "paid",
        "issued_count": 0,
        "claim_credits_remaining": 1000,
        "created_at": now,
        "updated_at": now,
        "seed_tag": SEED_TAG,
    }
    res = await db.users.insert_one(doc)
    return await db.users.find_one({"_id": res.inserted_id})


async def _seed_tickets(db, customer_email: str, admin_email: str, admin_id) -> None:
    wiped = await db.support_tickets.delete_many(
        {"user_email": customer_email, "ticket_id": {"$regex": "^tkt_demo_"}}
    )
    print(f"[tickets] wiped {wiped.deleted_count} previous demo ticket(s)")

    now = datetime.now(timezone.utc)
    tickets = [
        {
            "ticket_id": "tkt_demo_FRESH01",
            "user_email": customer_email,
            "status": "open",
            "message": (
                "I tried to revoke a QR code I issued by mistake but the "
                "Revoke button just spins and never finishes."
            ),
            "conversation_history": [],
            "replies": [],
            "created_at": now - timedelta(minutes=18),
        },
        {
            "ticket_id": "tkt_demo_REPLY02",
            "user_email": customer_email,
            "status": "open",
            "message": (
                "I bought the 5,000-credit pack yesterday but only 4,950 credits "
                "showed up in my account."
            ),
            "conversation_history": [],
            "replies": [
                {
                    "role": "admin",
                    "author_id": admin_id,
                    "author_email": admin_email,
                    "admin_id": admin_id,
                    "admin_email": admin_email,
                    "content": (
                        "Thanks for flagging — I'm checking your billing history. "
                        "Looks like 50 credits were consumed by a verify run right "
                        "after the top-up. Reply if those weren't yours."
                    ),
                    "ts": now - timedelta(hours=2, minutes=12),
                }
            ],
            "created_at": now - timedelta(hours=6),
        },
        {
            "ticket_id": "tkt_demo_CLOSED3",
            "user_email": customer_email,
            "status": "closed",
            "message": "What's the difference between Studio and Console?",
            "conversation_history": [],
            "replies": [
                {
                    "role": "admin",
                    "author_id": admin_id,
                    "author_email": admin_email,
                    "admin_id": admin_id,
                    "admin_email": admin_email,
                    "content": (
                        "Studio is where you create tokens. Console is the "
                        "operational view. Closing this — thanks!"
                    ),
                    "ts": now - timedelta(days=3, hours=2),
                }
            ],
            "created_at": now - timedelta(days=3, hours=6),
            "closed_at": now - timedelta(days=3, hours=2),
            "closed_by": admin_id,
            "closed_by_email": admin_email,
        },
    ]
    await db.support_tickets.insert_many(tickets)
    print(f"[tickets] inserted {len(tickets)} ticket(s) for {customer_email}")


async def _seed_transactions(db, customer_id) -> None:
    wiped = await db.billing_transactions.delete_many(
        {"account_id": customer_id, "seed_tag": SEED_TAG}
    )
    print(f"[billing] wiped {wiped.deleted_count} previous demo transaction(s)")

    now = datetime.now(timezone.utc)
    txs = [
        # CASE 1: Fresh, refundable. Happy path.
        {
            "case": "fresh_refundable",
            "doc": {
                "account_id": customer_id,
                "stripe_event_id": "evt_e2e_fresh",
                "checkout_session_id": "cs_e2e_fresh",
                "payment_intent_id": "pi_e2e_FRESH",
                "price_id": "price_e2e_5000",
                "usd_amount": 499,
                "credits_added": 5000,
                "status": "paid",
                "created_at": now - timedelta(days=1),
                "updated_at": now - timedelta(days=1),
                "seed_tag": SEED_TAG,
            },
        },
        # CASE 2: Older than 60 days — should hit `too_old` unless forced.
        {
            "case": "too_old",
            "doc": {
                "account_id": customer_id,
                "stripe_event_id": "evt_e2e_old",
                "checkout_session_id": "cs_e2e_old",
                "payment_intent_id": "pi_e2e_OLD",
                "price_id": "price_e2e_5000",
                "usd_amount": 499,
                "credits_added": 5000,
                "status": "paid",
                "created_at": now - timedelta(days=75),
                "updated_at": now - timedelta(days=75),
                "seed_tag": SEED_TAG,
            },
        },
        # CASE 3: No payment_intent_id — structural decline.
        {
            "case": "no_payment_intent",
            "doc": {
                "account_id": customer_id,
                "stripe_event_id": "evt_e2e_nopi",
                "checkout_session_id": "cs_e2e_nopi",
                "payment_intent_id": None,
                "price_id": "price_e2e_1000",
                "usd_amount": 97,
                "credits_added": 1000,
                "status": "paid",
                "created_at": now - timedelta(days=2),
                "updated_at": now - timedelta(days=2),
                "seed_tag": SEED_TAG,
            },
        },
        # CASE 4: Already fully refunded — structural decline.
        {
            "case": "already_refunded",
            "doc": {
                "account_id": customer_id,
                "stripe_event_id": "evt_e2e_refunded",
                "checkout_session_id": "cs_e2e_refunded",
                "payment_intent_id": "pi_e2e_REFUNDED",
                "price_id": "price_e2e_1000",
                "usd_amount": 97,
                "credits_added": 1000,
                "status": "refunded",
                "refunded_amount_cents": 9700,
                "refunds": [
                    {
                        "stripe_refund_id": "re_e2e_PRIOR",
                        "amount_cents": 9700,
                        "currency": "usd",
                        "reason": "test seed — prior refund",
                        "forced": False,
                        "issued_by_email": "earlier-admin@miratrust.test",
                        "ts": now - timedelta(days=10),
                        "stripe_status": "succeeded",
                    }
                ],
                "created_at": now - timedelta(days=15),
                "updated_at": now - timedelta(days=10),
                "seed_tag": SEED_TAG,
            },
        },
        # CASE 5: Fresh & paid, but customer has another refund in the last 90d.
        # The `already_refunded` row above triggers the `recent_refund` block
        # on this row.
        {
            "case": "recent_refund_block",
            "doc": {
                "account_id": customer_id,
                "stripe_event_id": "evt_e2e_recent",
                "checkout_session_id": "cs_e2e_recent",
                "payment_intent_id": "pi_e2e_RECENT",
                "price_id": "price_e2e_12000",
                "usd_amount": 999,
                "credits_added": 12000,
                "status": "paid",
                "created_at": now - timedelta(days=3),
                "updated_at": now - timedelta(days=3),
                "seed_tag": SEED_TAG,
            },
        },
    ]

    await db.billing_transactions.insert_many([t["doc"] for t in txs])
    for t in txs:
        print(
            f"[billing] inserted {t['case']:25s} "
            f"pi={t['doc'].get('payment_intent_id') or '—':18s} "
            f"status={t['doc']['status']}"
        )


async def main() -> None:
    await connect_mongo()
    db = get_db()

    customer = await _upsert_user(db, CUSTOMER_EMAIL, "user")
    admin = await _upsert_user(db, ADMIN_EMAIL, "super_admin")

    print(f"[users] customer id={customer['_id']} email={customer['email']} role={customer['role']}")
    print(f"[users] admin    id={admin['_id']} email={admin['email']} role={admin['role']}")

    customer_token = create_access_token(
        subject=str(customer["_id"]), email=customer["email"], role=customer.get("role", "user")
    )
    admin_token = create_access_token(
        subject=str(admin["_id"]), email=admin["email"], role=admin["role"]
    )

    await _seed_tickets(db, CUSTOMER_EMAIL, ADMIN_EMAIL, admin["_id"])
    await _seed_transactions(db, customer["_id"])

    print()
    print("=" * 78)
    print("PASTE THESE INTO CHROME LOCALSTORAGE:")
    print("=" * 78)
    print(f"CUSTOMER_TOKEN = {customer_token}")
    print(f"ADMIN_TOKEN    = {admin_token}")
    print(f"CUSTOMER_ID    = {customer['_id']}")
    print(f"ADMIN_ID       = {admin['_id']}")
    print("=" * 78)

    await close_mongo()


if __name__ == "__main__":
    asyncio.run(main())
