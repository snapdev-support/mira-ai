"""
One-shot cleanup for the pre-existing duplicate-row billing bug.

Before this sprint, every successful purchase produced TWO rows in
`billing_transactions`: one `pending` (created at checkout-session creation)
and one `paid` (inserted by the webhook handler). The "best-effort" cleanup
that was supposed to retire the pending row often failed under retries or
race conditions, leaving orphan `pending` rows visible in the admin and
customer billing views.

The fix in `billing_service.py` makes this impossible going forward (one row
per checkout session, transitioned in place). This script retires the legacy
orphans:

  - For every `paid` row that carries a `checkout_session_id`,
  - delete any sibling `pending` row with the same `checkout_session_id`.

The orphan pending rows have no business value:
  - No payment was ever charged for them (no payment_intent_id, no money)
  - Their `paid` sibling holds the canonical state
  - They never gated a refund (the refund flow already filters them out)

Safe to re-run. Reports rows deleted and rows untouched.
"""
from __future__ import annotations

import asyncio
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.dirname(_HERE)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from app.core.db import connect_mongo, close_mongo, get_db


async def main() -> None:
    await connect_mongo()
    db = get_db()

    # Every distinct checkout_session_id that has a paid row.
    paid_session_ids: list[str] = await db.billing_transactions.distinct(
        "checkout_session_id",
        {"status": "paid", "checkout_session_id": {"$ne": None}},
    )

    print(f"[scan] {len(paid_session_ids)} distinct checkout_session_ids with a paid row")

    deleted = 0
    for cs_id in paid_session_ids:
        res = await db.billing_transactions.delete_many(
            {"checkout_session_id": cs_id, "status": "pending"}
        )
        if res.deleted_count:
            print(f"  - cs={cs_id!s:48s} deleted {res.deleted_count} orphan(s)")
            deleted += res.deleted_count

    # Also report (don't touch) any pending rows that DON'T have a paid sibling.
    # Those are legitimately abandoned checkouts — leaving them alone for now.
    abandoned = await db.billing_transactions.count_documents(
        {
            "status": "pending",
            "checkout_session_id": {"$nin": paid_session_ids},
        }
    )

    print()
    print(f"[done] deleted {deleted} orphan pending row(s)")
    print(
        f"[info] {abandoned} other pending row(s) remain — these are abandoned "
        "checkouts (no payment ever completed). Leaving them in place."
    )

    await close_mongo()


if __name__ == "__main__":
    asyncio.run(main())
