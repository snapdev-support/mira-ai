/**
 * Small shared atoms used across admin pages. Kept here so they don't have
 * to be re-implemented per page. None of these introduce new aesthetics —
 * they just compose the existing `t-*` classes from admin.css.
 */

import { Link } from "react-router-dom";

/** Compact age label: 5m / 3h / 2d. Falls back to the iso string on bad input. */
// react-refresh wants this in a .ts file since it's not a component, but the
// helpers are tiny and co-located with the components that consume them.
// eslint-disable-next-line react-refresh/only-export-components
export function ageLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

/** Long timestamp suitable for tooltips. */
// eslint-disable-next-line react-refresh/only-export-components
export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

/** A small left-aligned back link styled to match the terminal HUD. */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="t-mono-dim"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        textDecoration: "none",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "2px 0",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--term-amber)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--term-fg-dim)")}
    >
      ← {label}
    </Link>
  );
}

/** Horizontal key/value strip, used in detail-page headers. */
export function MetaStrip({ items }: { items: { k: string; v: React.ReactNode; tone?: "amber" | "red" | "green" | "mute" }[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        flexWrap: "wrap",
        border: "1px solid var(--term-rule)",
      }}
    >
      {items.map((item, i) => (
        <div
          key={item.k}
          style={{
            padding: "10px 16px",
            borderRight: i === items.length - 1 ? "none" : "1px solid var(--term-rule)",
            minWidth: 120,
          }}
        >
          <div className="t-label" style={{ marginBottom: 4 }}>
            {item.k}
          </div>
          <div
            style={{
              fontSize: 12,
              color:
                item.tone === "amber"
                  ? "var(--term-amber)"
                  : item.tone === "red"
                  ? "var(--term-red)"
                  : item.tone === "green"
                  ? "var(--term-green)"
                  : item.tone === "mute"
                  ? "var(--term-fg-mute)"
                  : "var(--term-fg)",
            }}
          >
            {item.v}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Inline confirmation: a small bar that asks for a reason and provides Confirm/Cancel. */
export function ConfirmReason({
  title,
  confirmLabel,
  tone = "amber",
  onConfirm,
  onCancel,
  submitting = false,
}: {
  title: string;
  confirmLabel: string;
  tone?: "amber" | "red";
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        border: `1px solid ${tone === "red" ? "var(--term-red)" : "var(--term-amber)"}`,
        background: tone === "red" ? "var(--term-red-faint)" : "var(--term-amber-faint)",
      }}
    >
      <div
        className="t-label"
        style={{ color: tone === "red" ? "var(--term-red)" : "var(--term-amber)", marginBottom: 10 }}
      >
        CONFIRM · {title}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="t-btn" data-tone={tone === "red" ? "red" : undefined} data-primary={tone === "amber" ? "true" : undefined} onClick={onConfirm} disabled={submitting}>
          {submitting ? "…" : confirmLabel}
        </button>
        <button className="t-btn" onClick={onCancel} disabled={submitting}>
          CANCEL
        </button>
      </div>
    </div>
  );
}
