from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter
from fastapi import Depends
from fastapi.responses import Response

from app.core.db import get_db
from app.models.ops import (
    OpsClaimItem,
    OpsClaimsResponse,
    OpsEventItem,
    OpsEventsResponse,
    OpsTilesResponse,
    OpsTrafficBucket,
    OpsTrafficResponse,
)
from app.routers.auth import get_current_user


router = APIRouter(prefix="/api/v1/ops", tags=["ops"])


def _start_of_day_utc(now: datetime) -> datetime:
    return datetime(now.year, now.month, now.day, tzinfo=timezone.utc)


def _percentile(values: List[int], p: float) -> Optional[int]:
    if not values:
        return None
    values_sorted = sorted(values)
    if len(values_sorted) == 1:
        return int(values_sorted[0])
    # Nearest-rank percentile with interpolation between ranks.
    # p in [0, 1]
    idx = (len(values_sorted) - 1) * p
    lo = int(idx)
    hi = min(lo + 1, len(values_sorted) - 1)
    if lo == hi:
        return int(values_sorted[lo])
    frac = idx - lo
    return int(round(values_sorted[lo] * (1 - frac) + values_sorted[hi] * frac))


def _event_status_for_verdict(verdict: Optional[str]) -> str:
    if verdict == "VALID":
        return "success"
    if verdict in {"EXPIRED", "REVOKED"}:
        return "warning"
    if verdict in {"UNKNOWN"}:
        return "error"
    return "info"


@router.get("/tiles", response_model=OpsTilesResponse)
async def tiles(current_user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc)
    oid = current_user["_id"]

    start_day = _start_of_day_utc(now)

    scans_today = await db.scan_events.count_documents({"issuer_account_id": oid, "ts": {"$gte": start_day}})
    total_scans = await db.scan_events.count_documents({"issuer_account_id": oid})

    claims_total = await db.claims.count_documents({"account_id": oid})
    claims_active = await db.claims.count_documents({"account_id": oid, "status": "active"})
    claims_revoked = await db.claims.count_documents({"account_id": oid, "status": "revoked"})

    # Percentiles for today's verify latency, based on stored scan_events.
    latencies: List[int] = []
    cursor = (
        db.scan_events.find(
            {"issuer_account_id": oid, "ts": {"$gte": start_day}, "latency_ms": {"$type": "number"}},
            {"_id": 0, "latency_ms": 1},
        )
        .sort("ts", -1)
        .limit(5000)
    )
    async for doc in cursor:
        try:
            latencies.append(int(doc.get("latency_ms")))
        except Exception:
            continue

    verify_p50_ms = _percentile(latencies, 0.50)
    verify_p95_ms = _percentile(latencies, 0.95)
    verify_avg_ms = int(round(sum(latencies) / len(latencies))) if latencies else None

    last_rev = await db.revocations.find_one({"by_account_id": oid}, {"_id": 0, "ts": 1}, sort=[("ts", -1)])
    last_revocation_age_s: Optional[int] = None
    if last_rev and last_rev.get("ts"):
        ts = last_rev["ts"]
        if ts.tzinfo is None or ts.tzinfo.utcoffset(ts) is None:
            ts = ts.replace(tzinfo=timezone.utc)
        last_revocation_age_s = int((now - ts).total_seconds())

    return OpsTilesResponse(
        updated_at=now,
        scans_today=scans_today,
        total_scans=total_scans,
        claims_total=claims_total,
        claims_active=claims_active,
        claims_revoked=claims_revoked,
        verify_p50_ms=verify_p50_ms,
        verify_p95_ms=verify_p95_ms,
        verify_avg_ms=verify_avg_ms,
        last_revocation_age_s=last_revocation_age_s,
    )


@router.get("/traffic", response_model=OpsTrafficResponse)
async def traffic(days: int = 7, current_user: dict = Depends(get_current_user)):
    db = get_db()
    oid = current_user["_id"]
    now = datetime.now(timezone.utc)

    days = max(1, min(int(days), 30))
    start = _start_of_day_utc(now - timedelta(days=days - 1))

    pipeline = [
        {"$match": {"issuer_account_id": oid, "ts": {"$gte": start}}},
        {
            "$project": {
                "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ts", "timezone": "UTC"}},
                "latency_ms": "$latency_ms",
            }
        },
        {
            "$group": {
                "_id": "$day",
                "scans": {"$sum": 1},
                "avg_latency_ms": {"$avg": "$latency_ms"},
            }
        },
        {"$sort": {"_id": 1}},
    ]

    buckets: Dict[str, OpsTrafficBucket] = {}
    async for row in db.scan_events.aggregate(pipeline):
        day = row.get("_id")
        if not day:
            continue
        avg = row.get("avg_latency_ms")
        buckets[day] = OpsTrafficBucket(
            date=day,
            scans=int(row.get("scans", 0) or 0),
            avg_latency_ms=int(round(avg)) if isinstance(avg, (int, float)) else None,
        )

    # Fill missing days with zeros
    items: List[OpsTrafficBucket] = []
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        items.append(buckets.get(d) or OpsTrafficBucket(date=d, scans=0, avg_latency_ms=None))

    return OpsTrafficResponse(items=items)


@router.get("/events", response_model=OpsEventsResponse)
async def events(limit: int = 50, current_user: dict = Depends(get_current_user)):
    db = get_db()
    oid = current_user["_id"]
    limit = max(1, min(int(limit), 200))

    items: List[OpsEventItem] = []

    # Recent scans
    scan_cursor = (
        db.scan_events.find(
            {"issuer_account_id": oid},
            {"_id": 1, "ts": 1, "jti": 1, "verdict": 1, "reason_code": 1, "token_class": 1},
        )
        .sort("ts", -1)
        .limit(limit)
    )
    scans = [doc async for doc in scan_cursor]
    jtis = [s.get("jti") for s in scans if s.get("jti")]

    subject_by_jti: Dict[str, Dict] = {}
    if jtis:
        claim_cursor = db.claims.find({"jti": {"$in": jtis}}, {"_id": 0, "jti": 1, "subject": 1})
        async for c in claim_cursor:
            if c.get("jti"):
                subject_by_jti[c["jti"]] = c.get("subject") or {}

    for s in scans:
        ts = s.get("ts")
        if ts is None:
            continue
        if ts.tzinfo is None or ts.tzinfo.utcoffset(ts) is None:
            ts = ts.replace(tzinfo=timezone.utc)

        jti = s.get("jti")
        verdict = s.get("verdict")
        subj = subject_by_jti.get(jti or "", {})
        subject_id = (subj or {}).get("id")
        base = "Scan"
        if verdict:
            base = f"Scan {verdict}"
        if subject_id:
            msg = f"{base} • {subject_id}"
        elif jti:
            msg = f"{base} • {jti[:8]}"
        else:
            msg = base

        items.append(
            OpsEventItem(
                id=str(s.get("_id")),
                type="scan",
                status=_event_status_for_verdict(verdict),
                message=msg,
                ts=ts,
                jti=jti,
                verdict=verdict,
            )
        )

    # Recent revocations (merge in)
    rev_cursor = (
        db.revocations.find(
            {"by_account_id": oid},
            {"_id": 1, "jti": 1, "ts": 1, "reason": 1},
        )
        .sort("ts", -1)
        .limit(limit)
    )
    async for r in rev_cursor:
        ts = r.get("ts")
        if ts is None:
            continue
        if ts.tzinfo is None or ts.tzinfo.utcoffset(ts) is None:
            ts = ts.replace(tzinfo=timezone.utc)
        jti = r.get("jti")
        reason = (r.get("reason") or "").strip()
        msg = f"Revoked • {jti[:8] if jti else ''}"
        if reason:
            msg = f"Revoked • {jti[:8] if jti else ''} • {reason}"
        items.append(
            OpsEventItem(
                id=str(r.get("_id")),
                type="revoke",
                status="warning",
                message=msg,
                ts=ts,
                jti=jti,
            )
        )

    # Recent issues derived from claims iat
    issue_cursor = (
        db.claims.find({"account_id": oid}, {"_id": 1, "jti": 1, "iat": 1, "subject": 1})
        .sort("iat", -1)
        .limit(limit)
    )
    async for c in issue_cursor:
        ts = c.get("iat")
        if ts is None:
            continue
        if ts.tzinfo is None or ts.tzinfo.utcoffset(ts) is None:
            ts = ts.replace(tzinfo=timezone.utc)
        subj = c.get("subject") or {}
        subject_id = subj.get("id")
        jti = c.get("jti")
        msg = f"Issued • {subject_id}" if subject_id else f"Issued • {jti[:8] if jti else ''}"
        items.append(
            OpsEventItem(
                id=str(c.get("_id")),
                type="issue",
                status="info",
                message=msg,
                ts=ts,
                jti=jti,
            )
        )

    items_sorted = sorted(items, key=lambda x: x.ts, reverse=True)[:limit]
    return OpsEventsResponse(items=items_sorted)


@router.get("/claims", response_model=OpsClaimsResponse)
async def claims(limit: int = 50, current_user: dict = Depends(get_current_user)):
    db = get_db()
    oid: ObjectId = current_user["_id"]
    limit = max(1, min(int(limit), 200))

    claim_docs = [
        c
        async for c in db.claims.find({"account_id": oid}).sort("iat", -1).limit(limit)
    ]
    jtis = [c.get("jti") for c in claim_docs if c.get("jti")]

    stats_by_jti: Dict[str, Dict[str, object]] = {}
    if jtis:
        pipeline = [
            {"$match": {"issuer_account_id": oid, "jti": {"$in": jtis}}},
            {"$group": {"_id": "$jti", "scan_count": {"$sum": 1}, "last_scan_ts": {"$max": "$ts"}}},
        ]
        async for row in db.scan_events.aggregate(pipeline):
            jti = row.get("_id")
            if not jti:
                continue
            stats_by_jti[jti] = {
                "scan_count": int(row.get("scan_count", 0) or 0),
                "last_scan_ts": row.get("last_scan_ts"),
            }

    items: List[OpsClaimItem] = []
    for c in claim_docs:
        jti = c.get("jti")
        if not jti:
            continue
        s = stats_by_jti.get(jti) or {}
        last_scan_ts = s.get("last_scan_ts")
        if isinstance(last_scan_ts, datetime) and (last_scan_ts.tzinfo is None or last_scan_ts.tzinfo.utcoffset(last_scan_ts) is None):
            last_scan_ts = last_scan_ts.replace(tzinfo=timezone.utc)

        iat = c.get("iat")
        if isinstance(iat, datetime) and (iat.tzinfo is None or iat.tzinfo.utcoffset(iat) is None):
            iat = iat.replace(tzinfo=timezone.utc)

        items.append(
            OpsClaimItem(
                jti=jti,
                template=c.get("template"),
                status=c.get("status") or "active",
                iat=iat,
                exp=c.get("exp"),
                subject=c.get("subject") or {},
                qr_payload=c.get("qr_payload") or "",
                scan_count=int(s.get("scan_count", 0) or 0),
                last_scan_ts=last_scan_ts if isinstance(last_scan_ts, datetime) else None,
            )
        )

    return OpsClaimsResponse(items=items, next_cursor=None)


@router.get("/claims.csv")
async def claims_csv(current_user: dict = Depends(get_current_user)):
    db = get_db()
    oid = current_user["_id"]

    claim_docs = [
        c
        async for c in db.claims.find({"account_id": oid}, {"_id": 0}).sort("iat", -1).limit(2000)
    ]
    jtis = [c.get("jti") for c in claim_docs if c.get("jti")]

    stats_by_jti: Dict[str, Dict[str, object]] = {}
    if jtis:
        pipeline = [
            {"$match": {"issuer_account_id": oid, "jti": {"$in": jtis}}},
            {"$group": {"_id": "$jti", "scan_count": {"$sum": 1}, "last_scan_ts": {"$max": "$ts"}}},
        ]
        async for row in db.scan_events.aggregate(pipeline):
            jti = row.get("_id")
            if not jti:
                continue
            stats_by_jti[jti] = {
                "scan_count": int(row.get("scan_count", 0) or 0),
                "last_scan_ts": row.get("last_scan_ts"),
            }

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["jti", "status", "iat", "exp", "template", "subject_id", "scan_count", "last_scan_ts", "qr_payload"])

    for c in claim_docs:
        jti = c.get("jti")
        if not jti:
            continue
        s = stats_by_jti.get(jti) or {}
        subj = c.get("subject") or {}
        writer.writerow(
            [
                jti,
                c.get("status") or "active",
                c.get("iat"),
                c.get("exp"),
                c.get("template") or "",
                subj.get("id") or "",
                int(s.get("scan_count", 0) or 0),
                s.get("last_scan_ts"),
                c.get("qr_payload") or "",
            ]
        )

    return Response(buf.getvalue(), media_type="text/csv")
