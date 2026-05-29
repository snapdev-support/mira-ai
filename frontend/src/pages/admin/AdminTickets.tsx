/**
 * Tickets list — first real working surface. Open/closed toggle, search box,
 * status-tagged rows. Clicking a row will navigate to the detail view
 * (built in a later turn).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import "../../admin/admin.css";
import { adminEndpoints, type TicketSummary } from "../../admin/adminApi";

const PAGE_SIZE = 25;

type StatusFilter = "open" | "closed" | "all";

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function AdminTickets() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const statusFilter = (params.get("status") as StatusFilter | null) ?? "open";
  const offset = parseInt(params.get("offset") ?? "0", 10) || 0;
  const [searchInput, setSearchInput] = useState(params.get("q") ?? "");
  const q = params.get("q") ?? "";

  // Debounce search input -> url
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== q) {
        const next = new URLSearchParams(params);
        if (searchInput) next.set("q", searchInput);
        else next.delete("q");
        next.delete("offset");
        setParams(next, { replace: true });
      }
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const query = useQuery({
    queryKey: ["admin-tickets", statusFilter, q, offset],
    queryFn: () =>
      adminEndpoints.listTickets({
        status: statusFilter === "all" ? undefined : statusFilter,
        q: q || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    keepPreviousData: true,
  });

  const data = query.data;
  const tickets = useMemo<TicketSummary[]>(() => data?.tickets ?? [], [data]);

  function setStatus(s: StatusFilter) {
    const next = new URLSearchParams(params);
    if (s === "open") next.delete("status");
    else next.set("status", s);
    next.delete("offset");
    setParams(next, { replace: true });
  }

  function setOffset(n: number) {
    const next = new URLSearchParams(params);
    if (n <= 0) next.delete("offset");
    else next.set("offset", String(n));
    setParams(next);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <div className="t-reveal">
          <div className="t-label">SUPPORT QUEUE</div>
          <h1 className="t-h1" style={{ marginTop: 4 }}>
            Tickets
          </h1>
        </div>
        <div className="t-mono-dim t-reveal" data-delay="1" style={{ fontSize: 11, letterSpacing: "0.1em" }}>
          {query.isFetching && !data ? "LOADING…" : data ? `${data.total} TOTAL` : ""}
        </div>
      </header>

      {/* Filters bar */}
      <div
        className="t-reveal"
        data-delay="1"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          padding: "10px 14px",
          border: "1px solid var(--term-rule)",
          background: "var(--term-bg-1)",
        }}
      >
        <span className="t-label" style={{ marginRight: 6 }}>FILTER</span>
        <button
          className="t-btn"
          data-primary={statusFilter === "open" ? "true" : undefined}
          onClick={() => setStatus("open")}
          style={{ padding: "5px 12px", fontSize: 11 }}
        >
          OPEN
        </button>
        <button
          className="t-btn"
          data-primary={statusFilter === "closed" ? "true" : undefined}
          onClick={() => setStatus("closed")}
          style={{ padding: "5px 12px", fontSize: 11 }}
        >
          CLOSED
        </button>
        <button
          className="t-btn"
          data-primary={statusFilter === "all" ? "true" : undefined}
          onClick={() => setStatus("all")}
          style={{ padding: "5px 12px", fontSize: 11 }}
        >
          ALL
        </button>

        <span style={{ width: 1, height: 18, background: "var(--term-rule)", margin: "0 8px" }} />

        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search messages, emails, or ticket ID…"
          className="t-input"
          style={{ flex: 1, padding: "6px 10px", fontSize: 12 }}
        />
      </div>

      {/* Table */}
      <div className="t-reveal" data-delay="2" style={{ border: "1px solid var(--term-rule)" }}>
        <table className="t-table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>STATUS</th>
              <th style={{ width: 180 }}>ID</th>
              <th style={{ width: 240 }}>USER</th>
              <th>MESSAGE</th>
              <th style={{ width: 80, textAlign: "right" }}>AGE</th>
              <th style={{ width: 90, textAlign: "right" }}>REPLIES</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 && !query.isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--term-fg-mute)" }}>
                  {q ? `No tickets matching "${q}".` : "No tickets in this view."}
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr
                  key={t.ticket_id}
                  data-href={`/admin/tickets/${t.ticket_id}`}
                  onClick={() => navigate(`/admin/tickets/${t.ticket_id}`)}
                >
                  <td>
                    <span
                      className="t-tag"
                      data-tone={t.status === "open" ? "amber" : "mute"}
                    >
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="t-mono-amber" style={{ fontFamily: "var(--term-font)" }}>
                    {t.ticket_id}
                  </td>
                  <td className="t-mono-dim" style={{ wordBreak: "break-all" }}>
                    {t.user_email ?? <span className="t-mono-mute">anonymous</span>}
                  </td>
                  <td style={{ color: "var(--term-fg)" }}>
                    {t.message_preview || <span className="t-mono-mute">—</span>}
                  </td>
                  <td className="t-mono-dim" style={{ textAlign: "right" }} title={t.created_at}>
                    {ageLabel(t.created_at)}
                  </td>
                  <td className="t-mono-dim" style={{ textAlign: "right" }}>
                    {t.reply_count}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > PAGE_SIZE ? (
        <div
          className="t-reveal"
          data-delay="2"
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--term-fg-mute)",
            letterSpacing: "0.08em",
          }}
        >
          <span>
            SHOWING {offset + 1}–{Math.min(offset + tickets.length, data.total)} OF {data.total}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="t-btn"
              style={{ padding: "4px 10px", fontSize: 10 }}
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              ← PREV
            </button>
            <button
              className="t-btn"
              style={{ padding: "4px 10px", fontSize: 10 }}
              disabled={!data.has_more}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              NEXT →
            </button>
          </div>
        </div>
      ) : null}

      {query.isError ? (
        <div
          className="t-reveal"
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid var(--term-red)",
            background: "var(--term-red-faint)",
            color: "var(--term-red)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          ⚠ Failed to load tickets. Check the API and try again.
        </div>
      ) : null}
    </div>
  );
}
