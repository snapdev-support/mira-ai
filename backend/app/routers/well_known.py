from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.db import get_db


router = APIRouter(tags=["well-known"])


@router.get("/.well-known/jwks.json")
async def jwks():
    # Stage-1 seam: stable stub (Stage-2 will publish real EdDSA keys)
    return {"keys": []}


@router.get("/.well-known/mira/crl")
async def crl(limit: int = 500):
    db = get_db()
    cursor = db.revocations.find({}, {"_id": 0}).sort("ts", -1).limit(min(limit, 2000))

    revoked = []
    async for r in cursor:
        item = dict(r)
        # Ensure JSON-serializable output (ObjectId -> str, datetime stays RFC3339 via FastAPI)
        for key in ("by_account_id",):
            if item.get(key) is not None:
                item[key] = str(item[key])
        revoked.append(item)

    return {"ts": datetime.now(timezone.utc), "revoked": revoked}
