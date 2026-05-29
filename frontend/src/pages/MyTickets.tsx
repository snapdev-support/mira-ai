/**
 * Customer-facing support inbox.
 *
 * Lists the signed-in user's tickets. Click into one to read the full thread
 * including admin replies. This is the in-app counterpart to the email
 * notifications — same data, but reliable (never lands in spam).
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Inbox,
  Loader2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  listMyTickets,
  type MyTicketSummary,
  type TicketStatus,
} from "@/services/supportApi";

type FilterValue = "all" | TicketStatus;

const PAGE_SIZE = 25;

// ── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function absoluteTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

// ── Status dot ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: TicketStatus }) {
  const isOpen = status === "open";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ color: isOpen ? "var(--color-accent)" : "var(--color-muted)" }}
    >
      <span
        aria-hidden
        className={isOpen ? "animate-pulse" : ""}
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: isOpen ? "var(--color-accent)" : "var(--color-muted)",
          boxShadow: isOpen ? "0 0 0 3px var(--color-accent-8)" : "none",
          display: "inline-block",
        }}
      />
      <span className="text-[11px] uppercase tracking-[0.12em] font-semibold">
        {isOpen ? "Open" : "Closed"}
      </span>
    </span>
  );
}

// ── Filter pill ─────────────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="transition-colors"
      style={{
        padding: "6px 12px",
        borderRadius: 3,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.04em",
        border: "1px solid var(--color-border)",
        background: active ? "var(--color-accent-8)" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-muted)",
        borderColor: active ? "var(--color-accent-20)" : "var(--color-border)",
        cursor: "pointer",
      }}
    >
      <span className="uppercase tracking-[0.08em]">{children}</span>
      {typeof count === "number" && (
        <span
          className="ml-1.5"
          style={{
            fontSize: 11,
            opacity: 0.7,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── Ticket row ──────────────────────────────────────────────────────────────

function TicketRow({ ticket }: { ticket: MyTicketSummary }) {
  const isOpen = ticket.status === "open";
  const hasReplies = ticket.reply_count > 0;

  return (
    <Link
      to={`/app/support/${ticket.ticket_id}`}
      className="block transition-all group"
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 4,
        padding: "18px 20px 18px 22px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent stripe on the left edge for open tickets */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: isOpen ? "var(--color-accent)" : "transparent",
        }}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Top meta line: status, ticket id, age */}
          <div className="flex items-center gap-3 mb-2.5">
            <StatusDot status={ticket.status} />
            <span
              className="text-[11px]"
              style={{
                color: "var(--color-muted)",
                fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                letterSpacing: "0.04em",
              }}
              title={ticket.ticket_id}
            >
              {ticket.ticket_id}
            </span>
            <span
              className="text-[11px]"
              style={{ color: "var(--color-muted)" }}
              title={absoluteTime(ticket.created_at)}
            >
              opened {relativeTime(ticket.created_at)}
            </span>
          </div>

          {/* Message preview */}
          <p
            className="text-sm leading-relaxed line-clamp-2 mb-2"
            style={{ color: "var(--color-text)" }}
          >
            {ticket.message_preview || (
              <span style={{ color: "var(--color-muted)", fontStyle: "italic" }}>
                (no message)
              </span>
            )}
          </p>

          {/* Bottom strip: replies + last activity */}
          <div className="flex items-center gap-4">
            <span
              className="inline-flex items-center gap-1.5 text-[12px]"
              style={{
                color: hasReplies ? "var(--color-text)" : "var(--color-muted)",
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {ticket.reply_count} {ticket.reply_count === 1 ? "reply" : "replies"}
              </span>
            </span>
            {ticket.last_reply_at && (
              <span
                className="text-[12px]"
                style={{ color: "var(--color-muted)" }}
                title={absoluteTime(ticket.last_reply_at)}
              >
                last reply {relativeTime(ticket.last_reply_at)}
              </span>
            )}
            {ticket.status === "closed" && ticket.closed_at && (
              <span
                className="text-[12px]"
                style={{ color: "var(--color-muted)" }}
                title={absoluteTime(ticket.closed_at)}
              >
                closed {relativeTime(ticket.closed_at)}
              </span>
            )}
          </div>
        </div>

        {/* Affordance chevron */}
        <span
          className="flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: "var(--color-muted)" }}
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterValue }) {
  const heading =
    filter === "open"
      ? "No open tickets"
      : filter === "closed"
      ? "No closed tickets"
      : "Your inbox is empty";
  const body =
    filter === "all"
      ? "When you open a support ticket through the help widget, the conversation will live here. Replies from our team show up the moment they're sent — no email refresh needed."
      : filter === "open"
      ? "Nothing currently waiting on a reply. Anything we've already wrapped up is under the Closed filter."
      : "You haven't had any tickets resolved yet.";

  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        padding: "72px 24px",
        border: "1px dashed var(--color-border)",
        borderRadius: 4,
        background: "var(--color-bg-card)",
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          background: "var(--color-bg-light)",
          color: "var(--color-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Inbox className="h-5 w-5" />
      </span>
      <h3
        className="text-base font-semibold mb-2"
        style={{ color: "var(--color-text)" }}
      >
        {heading}
      </h3>
      <p
        className="text-sm max-w-md leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        {body}
      </p>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function MyTickets() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["my-tickets", filter, page],
    queryFn: () =>
      listMyTickets({
        status: filter === "all" ? undefined : filter,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    keepPreviousData: true,
  });

  const tickets = query.data?.tickets ?? [];
  const total = query.data?.total ?? 0;
  const hasMore = query.data?.has_more ?? false;

  const summary = useMemo(() => {
    if (!query.data) return null;
    const start = page * PAGE_SIZE + 1;
    const end = Math.min(start + tickets.length - 1, total);
    return total === 0 ? null : `${start}–${end} of ${total}`;
  }, [query.data, page, tickets.length, total]);

  const onFilter = (next: FilterValue) => {
    setFilter(next);
    setPage(0);
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.16em] font-semibold mb-2"
            style={{ color: "var(--color-accent)" }}
          >
            Support
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            Your tickets
          </h1>
          <p
            className="mt-1.5 text-sm leading-relaxed max-w-xl"
            style={{ color: "var(--color-muted)" }}
          >
            Every reply from our team is recorded here in real time. If an
            email lands in spam, this is still the source of truth.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="border-border hover:bg-accent"
          style={{ color: "var(--color-text)", borderRadius: 3 }}
        >
          {query.isFetching ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FilterPill active={filter === "all"} onClick={() => onFilter("all")}>
            All
          </FilterPill>
          <FilterPill
            active={filter === "open"}
            onClick={() => onFilter("open")}
          >
            Open
          </FilterPill>
          <FilterPill
            active={filter === "closed"}
            onClick={() => onFilter("closed")}
          >
            Closed
          </FilterPill>
        </div>

        {summary && (
          <span
            className="text-[12px]"
            style={{
              color: "var(--color-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {summary}
          </span>
        )}
      </div>

      {/* List */}
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
          <span className="text-sm">Loading tickets…</span>
        </div>
      ) : query.isError ? (
        <div
          style={{
            padding: "32px 24px",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            background: "var(--color-bg-card)",
            color: "var(--color-text)",
          }}
        >
          <p className="text-sm font-semibold mb-1">
            Couldn't load your tickets
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Try the Refresh button above. If this keeps happening, sign out and
            back in.
          </p>
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-2.5">
          {tickets.map((t) => (
            <TicketRow key={t.ticket_id} ticket={t} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {tickets.length > 0 && (page > 0 || hasMore) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="border-border"
            style={{ color: "var(--color-text)", borderRadius: 3 }}
          >
            ← Newer
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            className="border-border"
            style={{ color: "var(--color-text)", borderRadius: 3 }}
          >
            Older →
          </Button>
        </div>
      )}
    </div>
  );
}
