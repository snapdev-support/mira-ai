"""
End-to-end smoke test for the SendGrid wiring.

Exercises the *real* FastAPI code path:
  POST /api/v1/admin/tickets/{ticket_id}/reply
    → require_admin (real JWT decode + DB lookup)
    → ticket update in Mongo
    → BackgroundTasks → notifications_service.notify_ticket_reply
    → SendGrid v3 mail/send

Inserts a throwaway admin + ticket, fires the reply, then cleans up.
Run from backend/:  python scripts/sendgrid_e2e_smoke.py
"""
from __future__ import annotations

import asyncio
import os
import secrets
import sys
from datetime import datetime, timezone

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.dirname(_HERE)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

import httpx

from app.core.config import settings
from app.core.db import connect_mongo, close_mongo, get_db
from app.core.security import create_access_token
from app.main import app


_TARGET_INBOX = "aliawan3032@gmail.com"


async def main() -> None:
    await connect_mongo()
    db = get_db()

    admin_email = f"sendgrid-smoke-{secrets.token_hex(4)}@miratrust.test"
    ticket_id = f"SMOKE-{secrets.token_hex(4).upper()}"

    admin_doc = {
        "email": admin_email,
        "password_hash": "smoke-test-no-login",
        "role": "admin",
        "first_name": "Smoke",
        "last_name": "Test",
        "is_disabled": False,
        "deleted_at": None,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(admin_doc)
    admin_id = res.inserted_id
    print(f"[setup] admin user inserted id={admin_id} email={admin_email}")

    ticket_doc = {
        "ticket_id": ticket_id,
        "user_email": _TARGET_INBOX,
        "status": "open",
        "message": "Smoke test — please ignore.",
        "conversation_history": [],
        "replies": [],
        "created_at": datetime.now(timezone.utc),
    }
    await db.support_tickets.insert_one(ticket_doc)
    print(f"[setup] ticket inserted ticket_id={ticket_id} owner={_TARGET_INBOX}")

    token = create_access_token(subject=str(admin_id), email=admin_email, role="admin")
    print(f"[setup] minted admin JWT (len={len(token)})")

    print(f"[config] sendgrid_api_key set={bool(settings.sendgrid_api_key)}")
    print(f"[config] sendgrid_from_email={settings.sendgrid_from_email}")
    print(f"[config] sendgrid_from_name={settings.sendgrid_from_name}")
    print(f"[config] support_reply_to={settings.support_reply_to}")

    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://smoke") as client:
            resp = await client.post(
                f"/api/v1/admin/tickets/{ticket_id}/reply",
                headers={"Authorization": f"Bearer {token}"},
                json={"content": (
                    "Hi! This is an automated end-to-end test of the MiraTrust support "
                    "ticket notification flow. If you received this in your inbox, the "
                    "full chain FastAPI → BackgroundTasks → SendGrid is working."
                )},
            )
            print(f"[http] POST /api/v1/admin/tickets/{ticket_id}/reply -> {resp.status_code}")
            if resp.status_code != 200:
                print(f"[http] body: {resp.text[:500]}")

        # Re-read the ticket to confirm the reply landed in Mongo
        updated = await db.support_tickets.find_one({"ticket_id": ticket_id})
        replies = (updated or {}).get("replies") or []
        print(f"[db] ticket now has {len(replies)} reply(ies)")
        if replies:
            print(f"[db] last reply admin_email={replies[-1].get('admin_email')}")
    finally:
        # Cleanup so we don't leave smoke-test rows around
        await db.support_tickets.delete_one({"ticket_id": ticket_id})
        await db.users.delete_one({"_id": admin_id})
        print("[cleanup] removed smoke admin + ticket")
        await close_mongo()


if __name__ == "__main__":
    asyncio.run(main())
