from __future__ import annotations

from typing import Any, Dict, Optional

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.core.config import settings
from app.core.db import get_db
from app.routers.auth import get_current_user
from app.services.billing_service import (
    apply_checkout_session_completed,
    attach_payment_method,
    cancel_plan,
    create_billing_portal,
    create_checkout_session,
    create_setup_intent,
    delete_payment_method,
    get_billing_plans,
    get_payment_methods,
    get_subscription_overview,
    get_transactions,
    record_pending_transaction,
    set_default_payment_method,
    verify_checkout_session,
)
from app.services.refund_service import reconcile_refund_from_webhook


router = APIRouter(prefix="/api/v1", tags=["billing"])


class CheckoutSessionRequest(BaseModel):
    planId: str


class AttachPaymentMethodRequest(BaseModel):
    paymentMethodId: str
    setDefault: bool = False


@router.get("/billing/plans")
async def billing_plans() -> Dict[str, Any]:
    plans = list(get_billing_plans().values())
    return {"currency": "usd", "plans": plans}


@router.post("/billing/checkout-session")
async def billing_checkout_session(payload: CheckoutSessionRequest, current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    checkout_url, session_id = await create_checkout_session(db, current_user, payload.planId)
    # If Stripe isn't configured, we return a placeholder URL and skip recording.
    if session_id:
        await record_pending_transaction(db, current_user["_id"], session_id, payload.planId)
    return {"checkoutUrl": checkout_url}


@router.get("/billing/subscription")
async def billing_subscription(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    return await get_subscription_overview(db, current_user)


@router.get("/billing/transactions")
async def billing_transactions_list(
    page: int = 1,
    pageSize: int = 10,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    db = get_db()
    return await get_transactions(db, current_user["_id"], page, pageSize)


@router.get("/billing/payment-methods")
async def billing_list_payment_methods(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    return await get_payment_methods(db, current_user)


@router.post("/billing/payment-methods")
async def billing_attach_payment_method(
    payload: AttachPaymentMethodRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    db = get_db()
    try:
        return await attach_payment_method(db, current_user, payload.paymentMethodId, payload.setDefault)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/billing/payment-methods/{pm_id}")
async def billing_delete_payment_method(
    pm_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        await delete_payment_method(pm_id)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/billing/payment-methods/{pm_id}/default")
async def billing_set_default_payment_method(
    pm_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    db = get_db()
    try:
        await set_default_payment_method(db, current_user, pm_id)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/billing/cancel")
async def billing_cancel_plan(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    await cancel_plan(db, current_user)
    return {"ok": True}


@router.post("/billing/verify-session/{session_id}")
async def billing_verify_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    db = get_db()
    try:
        return await verify_checkout_session(db, current_user, session_id)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/billing/setup-intent")
async def billing_setup_intent(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    try:
        return await create_setup_intent(db, current_user)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/billing/portal")
async def billing_portal_session(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    return_url = f"{settings.stripe_frontend_base_url}/app/billing"
    try:
        return await create_billing_portal(db, current_user, return_url)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


async def _stripe_webhook_impl(
    request: Request,
    stripe_signature: Optional[str],
):
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=500, detail="Stripe webhook secret not configured")
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe secret key not configured")

    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()
    sig_header = stripe_signature
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")

    try:
        event = stripe.Webhook.construct_event(payload=payload, sig_header=sig_header, secret=settings.stripe_webhook_secret)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid webhook: {e}")

    event_type = event.get("type")

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        db = get_db()
        await apply_checkout_session_completed(db, stripe_event_id=str(event.get("id")), session=session)
    elif event_type in ("charge.refunded", "refund.created", "refund.updated"):
        # `charge.refunded` carries the full charge with `refunds.data[]`.
        # `refund.created` / `refund.updated` carry a single refund object.
        # Normalize into one path: feed the refund object to the reconciler.
        obj = event["data"]["object"]
        db = get_db()
        if event_type == "charge.refunded":
            for refund in (obj.get("refunds") or {}).get("data") or []:
                await reconcile_refund_from_webhook(db, refund)
        else:
            await reconcile_refund_from_webhook(db, obj)

    return {"ok": True}


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(default=None, alias="Stripe-Signature"),
):
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")
    return await _stripe_webhook_impl(request, stripe_signature)


# Backwards-compatible route (older docs / clients)
@router.post("/billing/webhook")
async def billing_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(default=None, alias="Stripe-Signature"),
):
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")
    return await _stripe_webhook_impl(request, stripe_signature)
