import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Receipt,
} from "lucide-react";
import type { Transaction, TransactionStatus } from "@/types/backend";

interface Props {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  const map: Record<
    TransactionStatus,
    { label: string; color: string; bg: string; border: string }
  > = {
    paid: {
      label: "Paid",
      color: "var(--color-safe)",
      bg: "rgba(76,175,125,0.10)",
      border: "rgba(76,175,125,0.20)",
    },
    pending: {
      label: "Pending",
      color: "var(--color-warn)",
      bg: "rgba(230,168,23,0.10)",
      border: "rgba(230,168,23,0.20)",
    },
    failed: {
      label: "Failed",
      color: "var(--color-danger)",
      bg: "rgba(217,80,80,0.10)",
      border: "rgba(217,80,80,0.20)",
    },
    refunded: {
      label: "Refunded",
      color: "var(--color-muted)",
      bg: "var(--color-bg-light)",
      border: "var(--color-border)",
    },
  };

  const s = map[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold border"
      style={{
        color: s.color,
        background: s.bg,
        borderColor: s.border,
        borderRadius: "var(--radius-sm)",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Desktop table ───────────────────────────────────────────────────────────

function DesktopTable({ items }: { items: Transaction[] }) {
  return (
    <div
      className="hidden sm:block overflow-x-auto border"
      style={{
        background: "var(--color-bg-card)",
        borderColor: "var(--color-border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {["Date", "Description", "Credits", "Amount", "Status", ""].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{ color: "var(--color-muted)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((tx, i) => (
            <tr
              key={tx.id}
              style={{
                borderBottom:
                  i < items.length - 1
                    ? "1px solid var(--color-divider)"
                    : "none",
              }}
            >
              <td
                className="px-4 py-3.5 text-sm whitespace-nowrap"
                style={{ color: "var(--color-muted)" }}
              >
                {formatDate(tx.date)}
              </td>
              <td
                className="px-4 py-3.5 text-sm font-medium"
                style={{ color: "var(--color-text)" }}
              >
                {tx.description}
              </td>
              <td
                className="px-4 py-3.5 text-sm whitespace-nowrap"
                style={{ color: "var(--color-muted)" }}
              >
                {tx.credits ? `+${tx.credits.toLocaleString()}` : "—"}
              </td>
              <td
                className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap"
                style={{
                  color:
                    tx.status === "refunded"
                      ? "var(--color-muted)"
                      : "var(--color-text)",
                  textDecoration:
                    tx.status === "refunded" ? "line-through" : "none",
                }}
              >
                ${tx.amountUsd.toLocaleString()}
              </td>
              <td className="px-4 py-3.5">
                <StatusBadge status={tx.status} />
              </td>
              <td className="px-4 py-3.5 text-right">
                {tx.invoiceUrl ? (
                  <a
                    href={tx.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity"
                    style={{ color: "var(--color-accent)" }}
                  >
                    <Download className="w-3 h-3" />
                    Invoice
                  </a>
                ) : (
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-muted)" }}
                  >
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Mobile card list ────────────────────────────────────────────────────────

function MobileList({ items }: { items: Transaction[] }) {
  return (
    <div className="sm:hidden space-y-3">
      {items.map((tx) => (
        <div
          key={tx.id}
          className="p-4 border"
          style={{
            background: "var(--color-bg-card)",
            borderColor: "var(--color-border)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--color-text)" }}
              >
                {tx.description}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                {formatDate(tx.date)}
                {tx.credits ? ` · +${tx.credits.toLocaleString()} credits` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span
                className="text-sm font-bold"
                style={{ color: "var(--color-text)" }}
              >
                ${tx.amountUsd}
              </span>
              <StatusBadge status={tx.status} />
            </div>
          </div>
          {tx.invoiceUrl && (
            <a
              href={tx.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium mt-3 hover:opacity-80 transition-opacity"
              style={{ color: "var(--color-accent)" }}
            >
              <Download className="w-3 h-3" />
              Download Invoice
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
        Showing {start}–{end} of {total} transactions
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-muted)",
            background: "transparent",
            borderRadius: "var(--radius-btn)",
          }}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm" style={{ color: "var(--color-text)" }}>
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-muted)",
            background: "transparent",
            borderRadius: "var(--radius-btn)",
          }}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Main Tab ────────────────────────────────────────────────────────────────

export function TransactionHistoryTab({
  items,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3
          className="text-base font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          Transaction History
        </h3>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-muted)" }}>
          A record of all your payments and credit purchases.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div
          className="flex items-center justify-center py-16 border"
          style={{
            background: "var(--color-bg-card)",
            borderColor: "var(--color-border)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <Loader2
            className="w-6 h-6 animate-spin"
            style={{ color: "var(--color-accent)" }}
          />
        </div>
      ) : items.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-14 gap-3 border"
          style={{
            background: "var(--color-bg-card)",
            borderColor: "var(--color-border)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <Receipt className="w-8 h-8" style={{ color: "var(--color-muted)" }} />
          <p
            className="text-sm font-medium"
            style={{ color: "var(--color-text)" }}
          >
            No transactions yet
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Your payment history will appear here once you make a purchase.
          </p>
        </div>
      ) : (
        <>
          <DesktopTable items={items} />
          <MobileList items={items} />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
