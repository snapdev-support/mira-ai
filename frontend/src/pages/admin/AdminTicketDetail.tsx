/**
 * Ticket detail — the operator's single view of a support escalation.
 *
 * Layout, top to bottom:
 *   1. Back link + heading row (ticket id, status tag, age, age tooltip)
 *   2. Meta strip (user, created, replies, closed-by — if applicable)
 *   3. Original message panel
 *   4. Bot conversation transcript (read-only, dimmed — context for the admin)
 *   5. Admin reply thread (each reply with admin email + ts)
 *   6. Composer (textarea + Send + Close-ticket on the right)
 *
 * Closing is gated behind an inline confirmation — `t-tag` color flips to
 * mute and Close becomes "Reopen?" (not yet — backend supports close only).
 */

import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import "../../admin/admin.css";
import { adminEndpoints } from "../../admin/adminApi";
import { BackLink, MetaStrip, ageLabel, formatStamp, ConfirmReason } from "../../admin/util";

export default function AdminTicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // React requires hooks to be called in the same order every render, so the
  // !ticketId guard MUST come AFTER hook declarations. We pass a fallback so
  // the deps are stable and gate the query with `enabled` to avoid wasted
  // network calls. `<Navigate>` runs below before any hook output is used.
  const safeTicketId = ticketId ?? "";

  const query = useQuery({
    queryKey: ["admin-ticket", safeTicketId],
    queryFn: () => adminEndpoints.getTicket(safeTicketId),
    enabled: !!ticketId,
  });

  const [reply, setReply] = useState("");
  const [confirmingClose, setConfirmingClose] = useState(false);

  const replyMut = useMutation({
    mutationFn: (content: string) => adminEndpoints.replyToTicket(safeTicketId, content),
    onSuccess: (data) => {
      qc.setQueryData(["admin-ticket", safeTicketId], data);
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });

  const closeMut = useMutation({
    mutationFn: () => adminEndpoints.closeTicket(safeTicketId),
    onSuccess: (data) => {
      qc.setQueryData(["admin-ticket", safeTicketId], data);
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      setConfirmingClose(false);
    },
  });

  const ticket = query.data;
  const transcript = useMemo(() => ticket?.conversation_history ?? [], [ticket]);

  if (!ticketId) return <Navigate to="/admin/tickets" replace />;

  if (query.isLoading) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <span className="t-loading t-label">LOADING TICKET…</span>
      </div>
    );
  }

  if (query.isError || !ticket) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <BackLink to="/admin/tickets" label="back to tickets" />
        <div
          style={{
            marginTop: 16,
            padding: 14,
            border: "1px solid var(--term-red)",
            background: "var(--term-red-faint)",
            color: "var(--term-red)",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          ⚠ Ticket not found or failed to load.
        </div>
      </div>
    );
  }

  const isOpen = ticket.status === "open";

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <div className="t-reveal" style={{ marginBottom: 6 }}>
        <BackLink to="/admin/tickets" label="back to tickets" />
      </div>

      {/* Heading row */}
      <header
        className="t-reveal"
        data-delay="1"
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          margin: "8px 0 14px",
        }}
      >
        <div>
          <div className="t-label">TICKET</div>
          <h1 className="t-h1" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 12 }}>
            <span className="t-mono-amber">{ticket.ticket_id}</span>
            <span className="t-tag" data-tone={isOpen ? "amber" : "mute"}>
              {ticket.status.toUpperCase()}
            </span>
          </h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="t-label" style={{ marginBottom: 2 }}>OPENED</div>
          <span className="t-mono-dim" title={formatStamp(ticket.created_at)}>
            {ageLabel(ticket.created_at)} ago
          </span>
        </div>
      </header>

      {/* Meta strip */}
      <div className="t-reveal" data-delay="1">
        <MetaStrip
          items={[
            {
              k: "USER",
              v: ticket.user_email ? <span>{ticket.user_email}</span> : <span className="t-mono-mute">anonymous</span>,
              tone: ticket.user_email ? undefined : "mute",
            },
            { k: "REPLIES", v: ticket.replies.length, tone: ticket.replies.length > 0 ? "amber" : "mute" },
            { k: "CREATED", v: formatStamp(ticket.created_at), tone: "mute" },
            ticket.closed_at
              ? { k: "CLOSED", v: `${formatStamp(ticket.closed_at)} · by ${ticket.closed_by_email ?? "—"}`, tone: "mute" }
              : { k: "CLOSED", v: "—", tone: "mute" },
          ]}
        />
      </div>

      {/* Original message */}
      <section className="t-reveal" data-delay="2" style={{ marginTop: 22 }}>
        <div className="t-label" style={{ marginBottom: 8 }}>ORIGINAL MESSAGE</div>
        <div
          style={{
            border: "1px solid var(--term-rule)",
            background: "var(--term-bg-1)",
            padding: 16,
            fontSize: 13,
            color: "var(--term-fg)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            borderLeft: "3px solid var(--term-amber)",
          }}
        >
          {ticket.message}
        </div>
      </section>

      {/* Bot transcript (dimmed context) */}
      {transcript.length > 0 ? (
        <section className="t-reveal" data-delay="2" style={{ marginTop: 22 }}>
          <div className="t-label" style={{ marginBottom: 8 }}>
            BOT TRANSCRIPT · context for this escalation
          </div>
          <div style={{ border: "1px solid var(--term-rule)", background: "var(--term-bg)" }}>
            {transcript.map((turn, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "10px 14px",
                  borderBottom: i === transcript.length - 1 ? "none" : "1px dashed var(--term-rule)",
                  fontSize: 12,
                }}
              >
                <span
                  className="t-mono-mute"
                  style={{
                    minWidth: 90,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: turn.role === "user" ? "var(--term-fg-dim)" : "var(--term-amber-soft)",
                  }}
                >
                  {turn.role === "user" ? "▍ USER" : "▍ BOT"}
                </span>
                <div className="t-mono-dim" style={{ whiteSpace: "pre-wrap", flex: 1 }}>
                  {turn.content}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Conversation thread — admin + customer replies in order */}
      <section className="t-reveal" data-delay="3" style={{ marginTop: 22 }}>
        <div className="t-label" style={{ marginBottom: 8 }}>
          CONVERSATION · {ticket.replies.length}{" "}
          {ticket.replies.length === 1 ? "MESSAGE" : "MESSAGES"}
        </div>
        {ticket.replies.length === 0 ? (
          <div
            className="t-mono-mute"
            style={{
              border: "1px dashed var(--term-rule)",
              padding: "14px 16px",
              fontSize: 12,
              letterSpacing: "0.06em",
            }}
          >
            No replies yet. The composer below adds the first one.
          </div>
        ) : (
          <div style={{ border: "1px solid var(--term-rule)" }}>
            {ticket.replies.map((r, i) => {
              const isUser = r.role === "user";
              return (
                <div
                  key={i}
                  style={{
                    padding: "12px 14px",
                    borderBottom:
                      i === ticket.replies.length - 1
                        ? "none"
                        : "1px solid var(--term-rule)",
                    background: isUser ? "var(--term-bg)" : "var(--term-bg-1)",
                    borderLeft: isUser
                      ? "3px solid var(--term-fg-dim)"
                      : "3px solid transparent",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                      color: "var(--term-fg-mute)",
                    }}
                  >
                    <span
                      className={isUser ? "t-mono-dim" : "t-mono-amber"}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      {isUser ? "◀ CUSTOMER" : "▶ TEAM"} · {r.author_email}
                    </span>
                    <span title={formatStamp(r.ts)}>{ageLabel(r.ts)} ago</span>
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
                    {r.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Composer */}
      <section className="t-reveal" data-delay="4" style={{ marginTop: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span className="t-label">COMPOSE REPLY</span>
          {isOpen ? (
            <button
              className="t-btn"
              data-tone="red"
              onClick={() => setConfirmingClose((v) => !v)}
              style={{ fontSize: 10, padding: "5px 12px" }}
              disabled={closeMut.isPending}
            >
              CLOSE TICKET
            </button>
          ) : (
            <span className="t-tag" data-tone="mute">CLOSED · read-only</span>
          )}
        </div>

        <textarea
          className="t-input"
          placeholder={isOpen ? "Write a reply…" : "This ticket is closed."}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          disabled={!isOpen || replyMut.isPending}
        />

        {replyMut.isError ? (
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              border: "1px solid var(--term-red)",
              background: "var(--term-red-faint)",
              color: "var(--term-red)",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            ⚠ Reply failed. Try again.
          </div>
        ) : null}

        {confirmingClose ? (
          <ConfirmReason
            title={`Close ${ticket.ticket_id}?`}
            confirmLabel="CONFIRM CLOSE"
            tone="red"
            onConfirm={() => closeMut.mutate()}
            onCancel={() => setConfirmingClose(false)}
            submitting={closeMut.isPending}
          />
        ) : (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="t-btn"
              data-primary="true"
              disabled={!isOpen || replyMut.isPending || reply.trim().length === 0}
              onClick={() =>
                replyMut.mutate(reply.trim(), {
                  onSuccess: () => setReply(""),
                })
              }
            >
              {replyMut.isPending ? "SENDING…" : "SEND REPLY →"}
            </button>
            <span className="t-mono-mute" style={{ fontSize: 10, letterSpacing: "0.12em" }}>
              {isOpen
                ? "Plain text. Customer sees this in /app/support and gets an email."
                : "Closed. Customer can reopen by replying from /app/support."}
            </span>
            <span style={{ flex: 1 }} />
            <button
              className="t-btn"
              onClick={() => navigate("/admin/tickets")}
              style={{ fontSize: 10, padding: "5px 12px" }}
            >
              ← BACK
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
