"""
User-facing pydantic shapes for the support inbox (`/api/v1/support/tickets`).

These are deliberately a thinner cut of what admins see: no admin_id, no IP,
no audit metadata. The customer sees the conversation, the admin's display
identity (email is fine — admins are staff), and timestamps.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


TicketStatus = Literal["open", "closed"]


class MyTicketChatTurn(BaseModel):
    """A turn of the original bot conversation that produced the ticket."""

    role: Literal["user", "assistant"]
    content: str


class MyTicketReply(BaseModel):
    """One reply on the ticket — could be from the team or from the user."""

    role: Literal["admin", "user"]
    author_email: str  # output — admin email for admin replies, user email for own replies
    content: str
    ts: datetime


class MyTicketReplyIn(BaseModel):
    """Customer's reply payload."""

    content: str = Field(min_length=1, max_length=4000)


class MyTicketSummary(BaseModel):
    """Row in the user's ticket list."""

    ticket_id: str
    status: TicketStatus
    message_preview: str = Field(description="First ~120 chars of the original message")
    created_at: datetime
    closed_at: Optional[datetime] = None
    reply_count: int = 0
    last_reply_at: Optional[datetime] = None


class MyTicketDetail(BaseModel):
    """Full thread for a single ticket — what the customer sees."""

    ticket_id: str
    status: TicketStatus
    message: str
    conversation_history: list[MyTicketChatTurn] = []
    replies: list[MyTicketReply] = []
    created_at: datetime
    closed_at: Optional[datetime] = None


class MyTicketListResponse(BaseModel):
    tickets: list[MyTicketSummary]
    total: int
    has_more: bool
