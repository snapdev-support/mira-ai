from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, field_validator


class WaitlistRequest(BaseModel):
    name: str
    email: str
    company: Optional[str] = None
    role: Optional[str] = None  # "developer" | "brand_owner" | "retailer" | "enterprise" | "other"

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v


class WaitlistResponse(BaseModel):
    ok: bool
    already_registered: bool = False
