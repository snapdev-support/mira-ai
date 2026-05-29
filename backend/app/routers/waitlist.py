from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import Response
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel

from app.core.config import settings
from app.core.db import get_db
from app.core.logging import get_logger
from app.models.waitlist import WaitlistRequest, WaitlistResponse

router = APIRouter(prefix="/api/v1", tags=["waitlist"])
logger = get_logger("mira.waitlist")


def _require_ops_secret(x_ops_secret: Optional[str] = Header(default=None)):
    if not settings.ops_secret or x_ops_secret != settings.ops_secret:
        raise HTTPException(status_code=403, detail="Forbidden")


class WaitlistEntry(BaseModel):
    name: str
    email: str
    company: Optional[str] = None
    role: Optional[str] = None
    created_at: Optional[datetime] = None


class WaitlistListResponse(BaseModel):
    total: int
    entries: List[WaitlistEntry]


@router.post("/waitlist", response_model=WaitlistResponse)
async def join_waitlist(payload: WaitlistRequest) -> WaitlistResponse:
    db = get_db()
    doc = {
        "name": payload.name.strip(),
        "email": payload.email,  # already normalised by model validator
        "company": payload.company.strip() if payload.company else None,
        "role": payload.role,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await db.waitlist.insert_one(doc)
        logger.info("waitlist.joined email=%s", doc["email"])
        return WaitlistResponse(ok=True)
    except DuplicateKeyError:
        logger.info("waitlist.duplicate email=%s", doc["email"])
        return WaitlistResponse(ok=True, already_registered=True)


@router.get("/waitlist", response_model=WaitlistListResponse)
async def list_waitlist(x_ops_secret: Optional[str] = Header(default=None)) -> WaitlistListResponse:
    _require_ops_secret(x_ops_secret)
    db = get_db()
    entries = []
    async for doc in db.waitlist.find({}, {"_id": 0}).sort("created_at", -1):
        entries.append(WaitlistEntry(
            name=doc.get("name", ""),
            email=doc.get("email", ""),
            company=doc.get("company"),
            role=doc.get("role"),
            created_at=doc.get("created_at"),
        ))
    return WaitlistListResponse(total=len(entries), entries=entries)


@router.get("/waitlist.csv")
async def waitlist_csv(x_ops_secret: Optional[str] = Header(default=None)) -> Response:
    _require_ops_secret(x_ops_secret)
    db = get_db()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["name", "email", "company", "role", "joined_at"])
    async for doc in db.waitlist.find({}, {"_id": 0}).sort("created_at", -1):
        writer.writerow([
            doc.get("name", ""),
            doc.get("email", ""),
            doc.get("company") or "",
            doc.get("role") or "",
            doc.get("created_at", ""),
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=waitlist.csv"},
    )
