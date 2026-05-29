from __future__ import annotations

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.db import get_db
from app.core.logging import get_logger
from app.core.security import create_access_token, decode_access_token
from app.models.auth import AuthResponse, LoginRequest, SignupRequest, TokenResponse, UserPublic
from app.services.auth_service import authenticate_user, create_user, get_user_by_id


router = APIRouter(prefix="/api/v1", tags=["auth"])

logger = get_logger("mira.auth")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def _user_public(user: dict) -> UserPublic:
    return UserPublic(
        id=str(user["_id"]),
        email=user["email"],
        plan=user.get("plan", "free"),
        role=user.get("role", "user"),
        is_disabled=bool(user.get("is_disabled", False)),
        issued_count=int(user.get("issued_count", 0) or 0),
        stripe_customer_id=user.get("stripe_customer_id"),
        plan_updated_at=user.get("plan_updated_at"),
        first_name=user.get("first_name"),
        last_name=user.get("last_name"),
    )


def _issue_token(user: dict) -> str:
    return create_access_token(
        subject=str(user["_id"]),
        email=user["email"],
        role=user.get("role", "user"),
    )


def _handle_auth_block(exc: PermissionError) -> HTTPException:
    code = str(exc)
    if code == "account_disabled":
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    if code == "account_deleted":
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account no longer exists")
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


@router.post("/auth/signup", response_model=AuthResponse)
async def signup(payload: SignupRequest):
    db = get_db()
    try:
        user = await create_user(db, payload.email, payload.password)
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
    except Exception as e:
        logger.exception("signup_failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Signup failed due to a server error",
        ) from e
    token = _issue_token(user)
    return AuthResponse(access_token=token, user=_user_public(user))


@router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    db = get_db()
    try:
        user = await authenticate_user(db, payload.email, payload.password)
    except PermissionError as exc:
        raise _handle_auth_block(exc)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = _issue_token(user)
    return AuthResponse(access_token=token, user=_user_public(user))

@router.post("/auth/token", response_model=TokenResponse)
async def token(form_data: OAuth2PasswordRequestForm = Depends()):
    # Swagger UI uses this endpoint for the "Authorize" dialog.
    # We treat "username" as the user's email.
    db = get_db()
    try:
        user = await authenticate_user(db, form_data.username, form_data.password)
    except PermissionError as exc:
        raise _handle_auth_block(exc)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=_issue_token(user))


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    db = get_db()
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await get_user_by_id(db, payload.get("sub"))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.get("deleted_at") is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account no longer exists")
    if user.get("is_disabled"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    return user


@router.get("/profile/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return _user_public(current_user)


class GoogleAuthRequest(BaseModel):
    access_token: str  # OAuth2 access token from the frontend (useGoogleLogin)


@router.post("/auth/google", response_model=AuthResponse)
async def google_auth(payload: GoogleAuthRequest):
    """
    Verify a Google access token via the userinfo endpoint,
    then find-or-create the user and return a JWT.
    Works for both login and signup — one endpoint handles both.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {payload.access_token}"},
        )

    if res.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    info = res.json()

    email: str = info.get("email", "").lower().strip()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No email in Google token")

    first_name: str = info.get("given_name", "")
    last_name: str = info.get("family_name", "")
    google_sub: str = info.get("sub", "")

    db = get_db()
    user = await db.users.find_one({"email": email})

    if user:
        if user.get("deleted_at") is not None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account no longer exists")
        if user.get("is_disabled"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
        # Existing user — update Google sub if not already set
        if not user.get("google_sub"):
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"google_sub": google_sub, "updated_at": datetime.now(timezone.utc)}},
            )
    else:
        # New user — create without password
        now = datetime.now(timezone.utc)
        doc = {
            "email": email,
            "password_hash": None,
            "google_sub": google_sub,
            "first_name": first_name,
            "last_name": last_name,
            "plan": "free",
            "role": "user",
            "is_disabled": False,
            "deleted_at": None,
            "issued_count": 0,
            "claim_credits_remaining": settings.free_tier_issue_cap,
            "created_at": now,
            "updated_at": now,
            "stripe_customer_id": None,
            "plan_updated_at": None,
        }
        try:
            result = await db.users.insert_one(doc)
            doc["_id"] = result.inserted_id
            user = doc
        except DuplicateKeyError:
            # Race condition — fetch the user that was just created
            user = await db.users.find_one({"email": email})
            if not user:
                raise HTTPException(status_code=500, detail="User creation failed")

    token = _issue_token(user)
    logger.info("google_auth.success email=%s", email)
    return AuthResponse(access_token=token, user=_user_public(user))
