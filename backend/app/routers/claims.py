from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.core.db import get_db
from app.models.claim import (
    IssueClaimRequest,
    IssueClaimResponse,
    OkResponse,
    PaymentRequiredResponse,
    RevokeClaimRequest,
)
from app.routers.auth import get_current_user
from app.services.claim_service import PaymentRequiredError, issue_claim, revoke_claim


router = APIRouter(prefix="/api/v1", tags=["claims"])


@router.post(
    "/claims/issue",
    response_model=IssueClaimResponse,
    responses={402: {"model": PaymentRequiredResponse}},
)
async def claims_issue(payload: IssueClaimRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        result = await issue_claim(db, str(current_user["_id"]), payload.model_dump())
        return result
    except PaymentRequiredError as e:
        return JSONResponse(
            status_code=402,
            content=e.payload,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/claims/revoke", response_model=OkResponse)
async def claims_revoke(payload: RevokeClaimRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await revoke_claim(db, str(current_user["_id"]), payload.jti, payload.reason)
    return OkResponse(ok=True)
