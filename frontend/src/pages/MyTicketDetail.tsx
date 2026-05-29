/**
 * Customer-facing ticket detail — the full conversation thread.
 *
 * Layout:
 *   ┌─────────────────────────────┬──────────────────┐
 *   │ Back link                   │                  │
 *   │ Status + ticket id          │   Meta sidebar   │
 *   │                             │   (status, dates)│
 *   │ Original message            │                  │
 *   │ [Bot transcript — collapsed]│                  │
 *   │ Admin reply #1              │                  │
 *   │ Admin reply #2              │                  │
 *   │ ...                         │                  │
 *   │ [closed banner if closed]   │                  │
 *   └─────────────────────────────┴──────────────────┘
 */

import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Mail,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";

import {
  getMyTicket,
  replyToMyTicket,
  type MyTicketChatTurn,
  type MyTicketDetail,
  type MyTicketReply,
  type TicketStatus,
} from "@/services/supportApi";
import { useAuth } from "@/auth/AuthContext";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} days ago`;
  return new Date(iso).toLocaleDateString();
}

function initialsOf(email: string): string {
  const [local] = email.split("@");
  if (!local) return "??";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

// ── Status dot (matches list page) ──────────────────────────────────────────

function StatusDot({ status, large }: { status: TicketStatus; large?: boolean }) {
  const isOpen = status === "open";
  const dot = large ? 9 : 7;
  const halo = large ? 4 : 3;
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{ color: isOpen ? "var(--color-accent)" : "var(--color-muted)" }}
    >
      <span
        aria-hidden
        className={isOpen ? "animate-pulse" : ""}
        style={{
          width: dot,
          height: dot,
          borderRadius: 999,
          background: isOpen ? "var(--color-accent)" : "var(--color-muted)",
          boxShadow: isOpen ? `0 0 0 ${halo}px var(--color-accent-8)` : "none",
          display: "inline-block",
        }}
      />
      <span
        className={`uppercase font-semibold ${
          large ? "text-[12px] tracking-[0.14em]" : "text-[11px] tracking-[0.12em]"
        }`}
      >
        {isOpen ? "Open" : "Closed"}
      </span>
    </span>
  );
}

// ── Original message ────────────────────────────────────────────────────────

function OriginalMessage({ ticket }: { ticket: MyTicketDetail }) {
  return (
    <section
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 4,
        padding: "20px 22px",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Mail
          className="h-3.5 w-3.5"
          style={{ color: "var(--color-muted)" }}
        />
        <span
          className="text-[11px] uppercase tracking-[0.12em] font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          Your message
        </span>
        <span
          aria-hidden
          style={{
            width: 1,
            height: 12,
            background: "var(--color-border)",
            display: "inline-block",
          }}
        />
        <span
          className="text-[11px]"
          style={{ color: "var(--color-muted)" }}
          title={formatStamp(ticket.created_at)}
        >
          {relativeTime(ticket.created_at)}
        </span>
      </div>
      <p
        className="text-sm whitespace-pre-wrap leading-relaxed"
        style={{ color: "var(--color-text)" }}
      >
        {ticket.message || (
          <span style={{ color: "var(--color-muted)", fontStyle: "italic" }}>
            (no message body)
          </span>
        )}
      </p>
    </section>
  );
}

// ── Bot conversation (collapsible) ──────────────────────────────────────────

function BotConversation({ history }: { history: MyTicketChatTurn[] }) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 transition-colors"
        style={{
          color: "var(--color-muted)",
          fontSize: 12,
          padding: "8px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <MessageSquare className="h-3.5 w-3.5" />
        <span className="uppercase tracking-[0.1em] font-semibold">
          {open ? "Hide" : "Show"} earlier bot conversation ({history.length})
        </span>
      </button>

      {open && (
        <div
          className="mt-2 space-y-2"
          style={{
            borderLeft: "2px solid var(--color-border)",
            paddingLeft: 16,
            marginLeft: 6,
          }}
        >
          {history.map((turn, i) => (
            <div
              key={i}
              style={{
                background:
                  turn.role === "user"
                    ? "var(--color-bg-light)"
                    : "var(--color-bg-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 4,
                padding: "10px 14px",
              }}
            >
              <div
                className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-1"
                style={{
                  color:
                    turn.role === "user"
                      ? "var(--color-text)"
                      : "var(--color-accent)",
                }}
              >
                {turn.role === "user" ? "You" : "Bot"}
              </div>
              <p
                className="text-[13px] whitespace-pre-wrap leading-relaxed"
                style={{
                  color:
                    turn.role === "user"
                      ? "var(--color-text)"
                      : "var(--color-muted)",
                }}
              >
                {turn.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Reply bubble (role-aware: admin vs user) ────────────────────────────────

function ReplyCard({ reply }: { reply: MyTicketReply }) {
  const isUser = reply.role === "user";
  const initials = initialsOf(reply.author_email);

  return (
    <article
      className="relative"
      style={{
        // User replies tilt right (margin-left) so the conversation reads
        // like a real thread; admin replies stay flush left.
        marginLeft: isUser ? 40 : 0,
        marginRight: isUser ? 0 : 40,
        background: isUser ? "var(--color-accent-8)" : "var(--color-bg-card)",
        border: isUser
          ? "1px solid var(--color-accent-20)"
          : "1px solid var(--color-accent-20)",
        borderRadius: 4,
        padding: "20px 22px",
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <span
          className="flex-shrink-0 flex items-center justify-center font-semibold"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: isUser
              ? "var(--color-bg-card)"
              : "var(--color-accent-8)",
            color: "var(--color-accent)",
            fontSize: 12,
            letterSpacing: "0.04em",
            border: "1px solid var(--color-accent-20)",
          }}
          aria-hidden
        >
          {initials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[11px] uppercase tracking-[0.12em] font-bold inline-flex items-center"
              style={{ color: "var(--color-accent)" }}
            >
              {isUser ? (
                <>
                  <User className="inline h-3 w-3 mr-1" />
                  You
                </>
              ) : (
                <>
                  <ShieldCheck className="inline h-3 w-3 mr-1" />
                  From the team
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--color-text)" }}
            >
              {reply.author_email}
            </span>
            <span
              aria-hidden
              style={{
                width: 1,
                height: 11,
                background: "var(--color-border)",
                display: "inline-block",
              }}
            />
            <span
              className="text-[12px]"
              style={{ color: "var(--color-muted)" }}
              title={formatStamp(reply.ts)}
            >
              {relativeTime(reply.ts)}
            </span>
          </div>
        </div>
      </div>

      <p
        className="text-sm whitespace-pre-wrap leading-relaxed"
        style={{ color: "var(--color-text)" }}
      >
        {reply.content}
      </p>
    </article>
  );
}

// ── Composer ────────────────────────────────────────────────────────────────

function Composer({
  ticketId,
  isClosed,
  onSent,
}: {
  ticketId: string;
  isClosed: boolean;
  onSent: (updated: MyTicketDetail) => void;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (text: string) => replyToMyTicket(ticketId, text),
    onSuccess: (data) => {
      setContent("");
      setError(null);
      onSent(data);
    },
    onError: (err: unknown) => {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail;
      setError(typeof msg === "string" ? msg : "Couldn't send your reply.");
    },
  });

  const canSend = content.trim().length > 0 && !mutation.isPending;

  const handleSubmit = () => {
    const text = content.trim();
    if (!text) return;
    mutation.mutate(text);
  };

  return (
    <section
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 4,
        padding: "18px 20px 16px 20px",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] uppercase tracking-[0.14em] font-bold"
            style={{ color: "var(--color-accent)" }}
          >
            Reply
          </span>
          {isClosed && (
            <span
              className="inline-flex items-center gap-1 text-[11px]"
              style={{ color: "var(--color-muted)" }}
            >
              <RotateCcw className="h-3 w-3" />
              <span className="uppercase tracking-[0.08em]">
                Sending will reopen this ticket
              </span>
            </span>
          )}
        </div>
        <span
          className="text-[11px]"
          style={{
            color:
              content.length > 3800
                ? "var(--color-accent)"
                : "var(--color-muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {content.length} / 4000
        </span>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, 4000))}
        placeholder={
          isClosed
            ? "Add anything we should know — we'll reopen and look into it."
            : "Write your reply…"
        }
        rows={4}
        disabled={mutation.isPending}
        style={{
          width: "100%",
          resize: "vertical",
          minHeight: 96,
          fontSize: 14,
          lineHeight: 1.55,
          padding: "12px 14px",
          borderRadius: 3,
          border: "1px solid var(--color-border)",
          background: "var(--color-bg)",
          color: "var(--color-text)",
          fontFamily: "inherit",
          outline: "none",
        }}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter to send — feels right for a chat surface.
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSend) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />

      {error && (
        <div
          className="text-[12px] mt-2"
          style={{
            color: "var(--color-accent)",
            padding: "6px 10px",
            border: "1px solid var(--color-accent-20)",
            borderRadius: 3,
            background: "var(--color-accent-8)",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <span
          className="text-[11px]"
          style={{ color: "var(--color-muted)" }}
        >
          ⌘ / Ctrl + Enter to send
        </span>
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className="inline-flex items-center gap-2 transition-opacity"
          style={{
            padding: "8px 16px",
            borderRadius: 3,
            border: "none",
            background: canSend
              ? "var(--color-accent)"
              : "var(--color-bg-light)",
            color: canSend
              ? "var(--color-accent-fg)"
              : "var(--color-muted)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: canSend ? "pointer" : "not-allowed",
          }}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Sending
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              {isClosed ? "Reopen & send" : "Send reply"}
            </>
          )}
        </button>
      </div>
    </section>
  );
}

// ── Closed banner ───────────────────────────────────────────────────────────

function ClosedBanner({ closedAt }: { closedAt: string | null }) {
  return (
    <div
      className="flex items-center gap-3"
      style={{
        background: "var(--color-bg-light)",
        border: "1px dashed var(--color-border)",
        borderRadius: 4,
        padding: "14px 18px",
        color: "var(--color-muted)",
      }}
    >
      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          This ticket was marked as resolved
        </p>
        <p className="text-[12px] mt-0.5">
          {closedAt
            ? `Closed ${relativeTime(closedAt)} · ${formatStamp(closedAt)}`
            : "Closed"}
        </p>
      </div>
    </div>
  );
}

// ── Meta sidebar ────────────────────────────────────────────────────────────

function MetaSidebar({ ticket }: { ticket: MyTicketDetail }) {
  const rows: Array<[string, React.ReactNode]> = [
    [
      "Ticket",
      <span
        style={{
          fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          fontSize: 12,
          color: "var(--color-text)",
          wordBreak: "break-all",
        }}
      >
        {ticket.ticket_id}
      </span>,
    ],
    ["Status", <StatusDot status={ticket.status} />],
    [
      "Opened",
      <span title={formatStamp(ticket.created_at)}>
        {relativeTime(ticket.created_at)}
      </span>,
    ],
    [
      "Replies",
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {ticket.replies.length}
      </span>,
    ],
  ];
  if (ticket.closed_at) {
    rows.push([
      "Closed",
      <span title={formatStamp(ticket.closed_at)}>
        {relativeTime(ticket.closed_at)}
      </span>,
    ]);
  }

  return (
    <aside
      className="space-y-4"
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 4,
        padding: "18px 20px",
        position: "sticky",
        top: 80,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.16em] font-bold pb-3"
        style={{
          color: "var(--color-muted)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        Ticket details
      </div>
      <dl className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt
              className="text-[10px] uppercase tracking-[0.1em] font-semibold mb-1"
              style={{ color: "var(--color-muted)" }}
            >
              {label}
            </dt>
            <dd
              className="text-[13px]"
              style={{ color: "var(--color-text)" }}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function MyTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const safeId = ticketId ?? "";
  const qc = useQueryClient();
  // useAuth is touched so the page re-renders on logout — the API call will
  // already 401 otherwise, but this keeps the gate explicit. Lint pacifier:
  useAuth();

  const query = useQuery({
    queryKey: ["my-ticket", safeId],
    queryFn: () => getMyTicket(safeId),
    enabled: !!ticketId,
  });

  const handleSent = (updated: MyTicketDetail) => {
    qc.setQueryData(["my-ticket", safeId], updated);
    // Bust the list query so the "last reply at" / reopen reflects everywhere.
    qc.invalidateQueries({ queryKey: ["my-tickets"] });
  };

  if (!ticketId) return <Navigate to="/app/support" replace />;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/app/support"
        className="inline-flex items-center gap-1.5 text-[12px] transition-colors hover:opacity-100"
        style={{ color: "var(--color-muted)", opacity: 0.85 }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="uppercase tracking-[0.1em] font-semibold">
          All tickets
        </span>
      </Link>

      {query.isLoading ? (
        <div
          className="flex items-center justify-center"
          style={{
            padding: "72px 24px",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            background: "var(--color-bg-card)",
            color: "var(--color-muted)",
          }}
        >
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Loading ticket…</span>
        </div>
      ) : query.isError || !query.data ? (
        <div
          style={{
            padding: "32px 24px",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            background: "var(--color-bg-card)",
            color: "var(--color-text)",
          }}
        >
          <p className="text-sm font-semibold mb-1">Ticket not found</p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            This ticket either doesn't exist or isn't on your account. If you
            believe this is a mistake, reach out via the chat widget.
          </p>
        </div>
      ) : (
        <TicketDetailBody ticket={query.data} onSent={handleSent} />
      )}
    </div>
  );
}

function TicketDetailBody({
  ticket,
  onSent,
}: {
  ticket: MyTicketDetail;
  onSent: (updated: MyTicketDetail) => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <StatusDot status={ticket.status} large />
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{
            color: "var(--color-text)",
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            letterSpacing: "-0.01em",
          }}
        >
          {ticket.ticket_id}
        </h1>
      </div>

      {/* Two-column layout: thread + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mt-6">
        {/* Main thread */}
        <div className="space-y-5 min-w-0">
          <OriginalMessage ticket={ticket} />
          <BotConversation history={ticket.conversation_history} />

          {ticket.replies.length === 0 ? (
            <div
              style={{
                padding: "32px 24px",
                border: "1px dashed var(--color-border)",
                borderRadius: 4,
                background: "var(--color-bg-card)",
                textAlign: "center",
              }}
            >
              <p
                className="text-[13px] font-semibold mb-1"
                style={{ color: "var(--color-text)" }}
              >
                Waiting on a reply from our team
              </p>
              <p className="text-[12px]" style={{ color: "var(--color-muted)" }}>
                We'll respond here as soon as possible. You can also add more
                detail below — anything you add comes through to us right
                away.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div
                className="text-[11px] uppercase tracking-[0.16em] font-bold pt-2"
                style={{ color: "var(--color-muted)" }}
              >
                Conversation · {ticket.replies.length}{" "}
                {ticket.replies.length === 1 ? "message" : "messages"}
              </div>
              {ticket.replies.map((r, i) => (
                <ReplyCard key={i} reply={r} />
              ))}
            </div>
          )}

          {ticket.status === "closed" && (
            <ClosedBanner closedAt={ticket.closed_at} />
          )}

          {/* Composer — always available; closed tickets reopen on send. */}
          <Composer
            ticketId={ticket.ticket_id}
            isClosed={ticket.status === "closed"}
            onSent={onSent}
          />
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block">
          <MetaSidebar ticket={ticket} />
        </div>
      </div>
    </>
  );
}
