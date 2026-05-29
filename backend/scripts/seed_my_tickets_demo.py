"""
Seed demo tickets against the live Mongo for a target user email so the
user-facing "My Tickets" UI has something to render.

Idempotent for re-runs: wipes any earlier seed-tagged tickets first.
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


TARGET_EMAIL = os.environ.get("DEMO_USER_EMAIL", "aliawan3032@gmail.com")
SEED_TAG = "demo-mytickets-seed"


async def main() -> None:
    await connect_mongo()
    db = get_db()

    # Find or fabricate a stable admin id for the replies. If there's no
    # super_admin yet, just create a synthetic ObjectId — the UI only uses
    # the admin email, not the id.
    admin_doc = await db.users.find_one({"role": {"$in": ["admin", "super_admin"]}})
    admin_oid = admin_doc["_id"] if admin_doc else ObjectId()
    admin_email = (admin_doc or {}).get("email") or "support@miratrust.ai"

    # Wipe previous seed rows
    wiped = await db.support_tickets.delete_many({"seed_tag": SEED_TAG})
    print(f"[seed] wiped {wiped.deleted_count} previous demo ticket(s)")

    now = datetime.now(timezone.utc)
    tickets = [
        # Open, no replies yet — fresh ticket
        {
            "ticket_id": "tkt_demo_FRESH01",
            "user_email": TARGET_EMAIL,
            "status": "open",
            "message": (
                "I tried to revoke a QR code I issued by mistake but the "
                "Revoke button just spins and never finishes. The code is "
                "still showing as active when I scan it. Can you help me "
                "kill it remotely?"
            ),
            "conversation_history": [
                {"role": "user", "content": "How do I revoke a QR code I issued by mistake?"},
                {
                    "role": "assistant",
                    "content": (
                        "You can revoke a token from the Studio page — open the claim "
                        "and click Revoke. If it isn't completing, it may need a "
                        "manual reset from our side."
                    ),
                },
            ],
            "replies": [],
            "created_at": now - timedelta(minutes=18),
            "seed_tag": SEED_TAG,
        },
        # Open, with one admin reply — mid-conversation
        {
            "ticket_id": "tkt_demo_REPLY02",
            "user_email": TARGET_EMAIL,
            "status": "open",
            "message": (
                "I bought the 5,000-credit pack yesterday but only 4,950 credits "
                "showed up in my account. Did something go wrong with the top-up?"
            ),
            "conversation_history": [],
            "replies": [
                {
                    "admin_id": admin_oid,
                    "admin_email": admin_email,
                    "content": (
                        "Hey — thanks for flagging this. I just checked your "
                        "billing history and I can see the 5,000-credit purchase "
                        "on the Stripe side. Looks like 50 credits were consumed "
                        "right after the top-up by a verify run at 2:14am — that "
                        "checks out on the scan logs.\n\nLet me know if those "
                        "scans weren't yours and I'll dig deeper. Happy to "
                        "refund the 50 either way if it was a mistake."
                    ),
                    "ts": now - timedelta(hours=2, minutes=12),
                }
            ],
            "created_at": now - timedelta(hours=6),
            "updated_at": now - timedelta(hours=2, minutes=12),
            "seed_tag": SEED_TAG,
        },
        # Closed, fully resolved
        {
            "ticket_id": "tkt_demo_CLOSED3",
            "user_email": TARGET_EMAIL,
            "status": "closed",
            "message": (
                "What's the difference between the Studio and Console pages? "
                "I keep switching back and forth and I'm not sure which one I'm "
                "supposed to use to mint a new QR code."
            ),
            "conversation_history": [
                {
                    "role": "user",
                    "content": "What does the Studio page do vs the Console?",
                },
                {
                    "role": "assistant",
                    "content": (
                        "Studio is where you create and manage individual claims. "
                        "Console is the operational view — recent scans, active "
                        "claims, audit. For minting a new QR you want Studio."
                    ),
                },
            ],
            "replies": [
                {
                    "admin_id": admin_oid,
                    "admin_email": admin_email,
                    "content": (
                        "The bot's right — Studio is where you create new "
                        "tokens. Console is read-only and shows what's already "
                        "out in the wild. We're working on rolling these into "
                        "a single workspace, FYI."
                    ),
                    "ts": now - timedelta(days=3, hours=4),
                },
                {
                    "admin_id": admin_oid,
                    "admin_email": admin_email,
                    "content": (
                        "Closing this out — let us know if anything else comes up. "
                        "Thanks for the feedback!"
                    ),
                    "ts": now - timedelta(days=3, hours=2),
                },
            ],
            "created_at": now - timedelta(days=3, hours=6),
            "closed_at": now - timedelta(days=3, hours=2),
            "closed_by": admin_oid,
            "closed_by_email": admin_email,
            "seed_tag": SEED_TAG,
        },
    ]

    res = await db.support_tickets.insert_many(tickets)
    print(f"[seed] inserted {len(res.inserted_ids)} demo ticket(s) for {TARGET_EMAIL}")
    for t in tickets:
        print(f"  - {t['ticket_id']:28s} status={t['status']:6s} replies={len(t['replies'])}")

    await close_mongo()


if __name__ == "__main__":
    asyncio.run(main())
