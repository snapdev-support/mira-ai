from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    plan: Literal["free", "paid", "pro"] = "free"
    role: Literal["user", "admin", "super_admin"] = "user"
    is_disabled: bool = False
    issued_count: int = 0
    stripe_customer_id: Optional[str] = None
    plan_updated_at: Optional[datetime] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
    
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
