"""
Transactional email via SendGrid.

Trigger points today: admin reply, admin close on support tickets. The admin
HTTP request must NOT fail if email fails — all send paths swallow exceptions
and log them. The send is offloaded to FastAPI BackgroundTasks (or directly
called from `asyncio.create_task` in a pinch), so the HTTP response goes out
before SendGrid is contacted.

Degraded mode: if `settings.sendgrid_api_key` is unset, every call logs the
email at INFO and returns — useful in dev and as a safety net in prod if a
key gets rotated. No half-broken state.
"""
from __future__ import annotations

import asyncio
import html as _html
from datetime import datetime
from typing import Optional

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import (
    Category,
    CustomArg,
    From,
    Mail,
    ReplyTo,
    To,
)

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("mira.notifications")


# ── Low-level send ─────────────────────────────────────────────────────────


async def _send(
    *,
    to: str,
    subject: str,
    text_body: str,
    html_body: str,
    categories: list[str] | None = None,
    custom_args: dict[str, str] | None = None,
    reply_to: Optional[str] = None,
) -> bool:
    """
    Fire one transactional email via SendGrid. Returns True on 2xx, False on
    any other outcome (including misconfig). Never raises.

    The SendGrid SDK is synchronous, so we offload to a worker thread to keep
    the event loop unblocked — BackgroundTasks may run this within the
    response context, and a blocking call there would delay subsequent
    requests on the same worker.
    """
    if not settings.sendgrid_api_key:
        logger.info(
            "notifications.degraded reason=no_api_key to=%s subject=%r — would have sent",
            to,
            subject,
        )
        return False

    if not to:
        logger.warning("notifications.skip reason=empty_to subject=%r", subject)
        return False

    message = Mail(
        from_email=From(settings.sendgrid_from_email, settings.sendgrid_from_name),
        to_emails=[To(to)],
        subject=subject,
        plain_text_content=text_body,
        html_content=html_body,
    )
    message.reply_to = ReplyTo(reply_to or settings.support_reply_to)
    for cat in categories or []:
        message.add_category(Category(cat))
    for k, v in (custom_args or {}).items():
        message.add_custom_arg(CustomArg(k, v))

    def _do_send() -> int:
        client = SendGridAPIClient(settings.sendgrid_api_key)
        resp = client.send(message)
        return int(resp.status_code)

    try:
        status_code = await asyncio.to_thread(_do_send)
    except Exception as exc:  # network errors, auth errors, etc.
        logger.exception("notifications.send_error to=%s subject=%r err=%s", to, subject, exc)
        return False

    ok = 200 <= status_code < 300
    logger.info(
        "notifications.sent ok=%s status=%d to=%s subject=%r cats=%s",
        ok,
        status_code,
        to,
        subject,
        categories or [],
    )
    return ok


# ── Public helpers — one per trigger point ─────────────────────────────────


async def notify_ticket_reply(
    *,
    ticket_id: str,
    user_email: Optional[str],
    admin_email: str,
    reply_content: str,
    created_at: Optional[datetime] = None,
) -> None:
    """Email the ticket owner with the full admin reply text."""
    if not user_email:
        # Anonymous tickets — nothing to send. Common case: chat-widget user
        # opened a ticket before signing in.
        logger.info("notifications.skip reason=anon_ticket ticket_id=%s", ticket_id)
        return

    subject, html_body, text_body = _render_reply_email(
        ticket_id=ticket_id,
        admin_email=admin_email,
        reply_content=reply_content,
        created_at=created_at,
    )
    await _send(
        to=user_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        categories=["ticket-notification", "ticket-reply"],
        custom_args={"ticket_id": ticket_id, "event": "reply"},
    )


async def notify_refund_issued(
    *,
    user_email: Optional[str],
    amount_usd: float,
    transaction_id: str,
    reason: str,
    admin_email: str,
) -> None:
    """Email the customer that a refund has been processed against the
    original payment method. Async/best-effort like every other notifier."""
    if not user_email:
        logger.info("notifications.skip reason=no_user_email event=refund tx=%s", transaction_id)
        return

    subject = f"Your MiraTrust refund of ${amount_usd:.2f} has been processed"

    safe_amount = f"${amount_usd:.2f}"
    safe_reason = _html.escape(reason)
    safe_admin = _html.escape(admin_email)
    safe_tx = _html.escape(transaction_id)

    body_html = (
        f'<p style="margin:0 0 16px 0;">Hi there,</p>'
        f'<p style="margin:0 0 16px 0;">We\'ve processed a refund of '
        f'<strong>{safe_amount}</strong> on your MiraTrust account. The '
        f'money is on its way back to your original payment method — '
        f'you should see it on your statement within '
        f'<strong>5 to 10 business days</strong>.</p>'
        f'<div style="margin:0 0 20px 0;padding:14px 16px;background:#fafafa;border-left:3px solid #0f172a;border-radius:4px;color:#27272a;">'
        f'<div style="font-size:12px;color:#71717a;margin-bottom:6px;letter-spacing:0.04em;">REASON</div>'
        f'<div>{safe_reason}</div>'
        f'</div>'
        f'<p style="margin:0 0 16px 0;font-size:13px;color:#52525b;">If you have any questions, just reply to this email or reach out via the chat in your dashboard.</p>'
        f'<p style="margin:0 0 6px 0;font-size:13px;color:#71717a;">— {safe_admin}</p>'
    )
    html_body = _BASE_HTML.format(
        body=body_html,
        footer=(
            f'Refund reference: <span style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#52525b;">{safe_tx}</span>. '
            f'Or write us at <a href="mailto:{_html.escape(settings.support_reply_to)}" style="color:#0f172a;">{_html.escape(settings.support_reply_to)}</a>.'
        ),
    )
    text_body = (
        f"Hi there,\n\n"
        f"We've processed a refund of {safe_amount} on your MiraTrust account. "
        f"The money is on its way back to your original payment method — you should "
        f"see it on your statement within 5 to 10 business days.\n\n"
        f"Reason: {reason}\n\n"
        f"Refund reference: {transaction_id}\n\n"
        f"If you have any questions, just reply to this email.\n\n"
        f"— {admin_email}"
    )
    await _send(
        to=user_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        categories=["billing-notification", "refund"],
        custom_args={"transaction_id": transaction_id, "event": "refund"},
    )


async def notify_ticket_close(
    *,
    ticket_id: str,
    user_email: Optional[str],
    admin_email: str,
) -> None:
    """Email the ticket owner that their ticket was closed."""
    if not user_email:
        logger.info("notifications.skip reason=anon_ticket ticket_id=%s", ticket_id)
        return

    subject, html_body, text_body = _render_close_email(
        ticket_id=ticket_id,
        admin_email=admin_email,
    )
    await _send(
        to=user_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        categories=["ticket-notification", "ticket-close"],
        custom_args={"ticket_id": ticket_id, "event": "close"},
    )


# ── Templates ──────────────────────────────────────────────────────────────


# Inline templates keep render+send in one file for now — small surface and
# no need for Jinja yet. The HTML is intentionally minimal: a single column,
# system font stack, no images, so it renders cleanly in every client.

_BASE_HTML = """\
<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #f1f1f3;">
              <div style="font-weight:700;font-size:15px;color:#0f172a;letter-spacing:0.2px;">MiraTrust Support</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:#27272a;font-size:15px;line-height:1.55;">
              {body}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#fafafa;border-top:1px solid #f1f1f3;font-size:12px;color:#71717a;">
              {footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _footer_html(ticket_id: str) -> str:
    safe_reply_to = _html.escape(settings.support_reply_to)
    safe_ticket = _html.escape(ticket_id)
    return (
        f'Reply to this email and we\'ll continue on ticket '
        f'<span style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#52525b;">{safe_ticket}</span>. '
        f'Or write us at <a href="mailto:{safe_reply_to}" style="color:#0f172a;">{safe_reply_to}</a>.'
    )


def _render_reply_email(
    *,
    ticket_id: str,
    admin_email: str,
    reply_content: str,
    created_at: Optional[datetime],
) -> tuple[str, str, str]:
    subject = f"Re: your MiraTrust support ticket {ticket_id}"

    # HTML body: preserve user-entered line breaks; escape everything else to
    # prevent the admin's reply from injecting arbitrary HTML into the email.
    safe_reply = _html.escape(reply_content).replace("\n", "<br>")
    safe_admin = _html.escape(admin_email)
    safe_ticket = _html.escape(ticket_id)

    body_html = (
        f'<p style="margin:0 0 16px 0;">Hi there,</p>'
        f'<p style="margin:0 0 16px 0;">A teammate replied to your support ticket '
        f'<span style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#52525b;">{safe_ticket}</span>:</p>'
        f'<div style="margin:0 0 20px 0;padding:14px 16px;background:#fafafa;border-left:3px solid #0f172a;border-radius:4px;color:#27272a;">'
        f'{safe_reply}'
        f'</div>'
        f'<p style="margin:0 0 6px 0;font-size:13px;color:#71717a;">— {safe_admin}</p>'
    )
    html_body = _BASE_HTML.format(body=body_html, footer=_footer_html(ticket_id))

    text_body = (
        f"Hi there,\n\n"
        f"A teammate replied to your support ticket {ticket_id}:\n\n"
        f"---\n{reply_content}\n---\n\n"
        f"— {admin_email}\n\n"
        f"Reply to this email and we'll continue on ticket {ticket_id}, "
        f"or write us at {settings.support_reply_to}."
    )
    return subject, html_body, text_body


def _render_close_email(*, ticket_id: str, admin_email: str) -> tuple[str, str, str]:
    subject = f"Your MiraTrust support ticket {ticket_id} was closed"

    safe_admin = _html.escape(admin_email)
    safe_ticket = _html.escape(ticket_id)

    body_html = (
        f'<p style="margin:0 0 16px 0;">Hi there,</p>'
        f'<p style="margin:0 0 16px 0;">Your support ticket '
        f'<span style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#52525b;">{safe_ticket}</span> '
        f'has been marked as resolved.</p>'
        f'<p style="margin:0 0 16px 0;">If you still need help or this was closed in error, '
        f'just reply to this email — we\'ll reopen the thread.</p>'
        f'<p style="margin:0 0 0 0;font-size:13px;color:#71717a;">— {safe_admin}</p>'
    )
    html_body = _BASE_HTML.format(body=body_html, footer=_footer_html(ticket_id))

    text_body = (
        f"Hi there,\n\n"
        f"Your support ticket {ticket_id} has been marked as resolved.\n\n"
        f"If you still need help or this was closed in error, just reply to this "
        f"email and we'll reopen the thread.\n\n"
        f"— {admin_email}"
    )
    return subject, html_body, text_body
