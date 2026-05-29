/**
 * Metrics dashboard.
 *
 * Layout:
 *   1. Headline tiles — 3x3 grid of platform-wide numbers
 *   2. Scans series — hand-rolled SVG terminal bar chart with
 *      granularity toggle (HOUR / DAY) and integrated axis labels
 *
 * Why not Recharts: Recharts has a strong default aesthetic that fights
 * the Operator Terminal theme (rounded bars, smooth tooltips, gradient
 * fills). An SVG of <rect>s in amber-on-graphite reads correctly as
 * "instrument readout" and matches the chassis without any wrestling.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import "../../admin/admin.css";
import {
  adminEndpoints,
  type ScanGranularity,
  type ScansBucket,
} from "../../admin/adminApi";
import { formatStamp } from "../../admin/util";

function formatUSD(n: number): string {
  // Compact-ish but never K/M for this small org, so just plain $X,XXX.XX
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

export default function AdminMetrics() {
  // Both queries refetch on the same 30s cadence so the chart can't lag
  // behind the overview tiles. When a new scan event lands, both will pick
  // it up in the next tick — eliminating the race where the overview shows
  // a higher count than the chart total.
  const overview = useQuery({
    queryKey: ["admin-metrics-overview"],
    queryFn: () => adminEndpoints.metricsOverview(),
    refetchInterval: 30_000,
  });

  const [gran, setGran] = useState<ScanGranularity>("day");
  const scans = useQuery({
    queryKey: ["admin-metrics-scans", gran],
    queryFn: () => adminEndpoints.scansSeries({ granularity: gran }),
    refetchInterval: 30_000,
  });

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <header
        className="t-reveal"
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}
      >
        <div>
          <div className="t-label">PLATFORM TELEMETRY</div>
          <h1 className="t-h1" style={{ marginTop: 4 }}>Metrics</h1>
        </div>
        <span className="t-mono-mute" style={{ fontSize: 11, letterSpacing: "0.1em" }}>
          {overview.data
            ? `GENERATED ${formatStamp(overview.data.generated_at)}`
            : overview.isError
            ? "ERROR"
            : "FETCHING…"}
        </span>
      </header>

      {/* ── Headline tiles ─────────────────────────────────────────────── */}
      <section
        className="t-reveal"
        data-delay="1"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0,
          border: "1px solid var(--term-rule)",
        }}
      >
        {overview.data ? (
          <>
            <Tile k="TOTAL USERS"        v={formatInt(overview.data.total_users)} />
            <Tile k="ACTIVE · 24H"        v={formatInt(overview.data.active_users_24h)} tone="amber" right />
            <Tile k="ACTIVE · 7D"         v={formatInt(overview.data.active_users_7d)} tone="amber" right last />

            <Tile k="CLAIMS · TOTAL"      v={formatInt(overview.data.total_claims_issued)} />
            <Tile k="CLAIMS · 24H"        v={formatInt(overview.data.claims_issued_24h)} tone="amber" right />
            <Tile k="OPEN TICKETS"        v={formatInt(overview.data.open_tickets)} tone={overview.data.open_tickets > 0 ? "red" : "green"} right last />

            <Tile k="SCANS · TOTAL"       v={formatInt(overview.data.total_scans)} bottom />
            <Tile k="SCANS · 24H"         v={formatInt(overview.data.scans_24h)} tone="amber" right bottom />
            <Tile k="REVENUE · 30D"       v={formatUSD(overview.data.revenue_last_30d_usd)} tone="green" right last bottom />
          </>
        ) : (
          <div style={{ gridColumn: "1 / -1", padding: 28, textAlign: "center" }}>
            <span className="t-loading t-label">LOADING METRICS…</span>
          </div>
        )}
      </section>

      {/* ── Scans series ───────────────────────────────────────────────── */}
      <section className="t-reveal" data-delay="2" style={{ marginTop: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div>
            <div className="t-label">SCAN-EVENT TIME-SERIES</div>
            <div style={{ fontSize: 13, marginTop: 4, color: "var(--term-fg)" }}>
              <span className="t-mono-amber">{scans.data ? formatInt(scans.data.total) : "·"}</span>{" "}
              <span className="t-mono-dim">events in window</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="t-btn"
              data-primary={gran === "hour" ? "true" : undefined}
              onClick={() => setGran("hour")}
              style={{ padding: "5px 14px", fontSize: 11 }}
            >
              HOUR · 48H
            </button>
            <button
              className="t-btn"
              data-primary={gran === "day" ? "true" : undefined}
              onClick={() => setGran("day")}
              style={{ padding: "5px 14px", fontSize: 11 }}
            >
              DAY · 30D
            </button>
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--term-rule)",
            background: "var(--term-bg)",
            padding: 24,
            minHeight: 280,
          }}
        >
          {scans.isLoading ? (
            <span className="t-loading t-label">LOADING SERIES…</span>
          ) : (scans.data?.buckets.length ?? 0) === 0 ? (
            <div
              style={{
                color: "var(--term-fg-mute)",
                fontSize: 12,
                letterSpacing: "0.06em",
                padding: "30px 0",
                textAlign: "center",
              }}
            >
              No scan events in this window. The chart will populate as activity arrives.
            </div>
          ) : (
            <BarChart buckets={scans.data!.buckets} granularity={gran} />
          )}
        </div>

        <div
          className="t-mono-mute"
          style={{ marginTop: 8, fontSize: 10, letterSpacing: "0.1em" }}
        >
          • Auto-refreshes every 30s · all timestamps UTC.
        </div>
      </section>
    </div>
  );
}

// ── Tile ───────────────────────────────────────────────────────────────────

function Tile({
  k,
  v,
  tone,
  right,
  bottom,
  last,
}: {
  k: string;
  v: React.ReactNode;
  tone?: "amber" | "green" | "red";
  right?: boolean;
  bottom?: boolean;
  last?: boolean;
}) {
  const color =
    tone === "amber" ? "var(--term-amber)" :
    tone === "green" ? "var(--term-green)" :
    tone === "red" ? "var(--term-red)" :
    "var(--term-fg)";
  return (
    <div
      style={{
        padding: "18px 22px",
        borderRight: last ? "none" : "1px solid var(--term-rule)",
        borderBottom: bottom ? "none" : "1px solid var(--term-rule)",
        background: right ? "var(--term-bg)" : "var(--term-bg-1)",
        minHeight: 90,
      }}
    >
      <div className="t-label" style={{ marginBottom: 8 }}>{k}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "0.02em",
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {v}
      </div>
    </div>
  );
}

// ── Hand-rolled terminal bar chart ─────────────────────────────────────────

function BarChart({ buckets, granularity }: { buckets: ScansBucket[]; granularity: ScanGranularity }) {
  const W = 1100;
  const H = 240;
  const PAD_L = 38;
  const PAD_R = 8;
  const PAD_T = 12;
  const PAD_B = 26;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const max = useMemo(() => Math.max(1, ...buckets.map((b) => b.count)), [buckets]);
  const ticks = useMemo(() => {
    // Three Y-axis ticks: 0, max/2, max
    return [0, Math.round(max / 2), max];
  }, [max]);

  const barW = innerW / buckets.length;
  const gap = Math.max(1, Math.min(3, barW * 0.18));
  const drawW = Math.max(2, barW - gap);

  // Label every Nth bucket so we don't overcrowd.
  const labelEvery = Math.max(1, Math.floor(buckets.length / 10));

  function fmtAxisLabel(iso: string): string {
    const d = new Date(iso);
    if (granularity === "hour") {
      // HH:00
      return `${String(d.getUTCHours()).padStart(2, "0")}`;
    }
    // MM/DD
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      {/* Y-axis grid */}
      {ticks.map((t, i) => {
        const y = PAD_T + innerH - (t / max) * innerH;
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke="var(--term-rule)"
              strokeDasharray={i === 0 ? "0" : "2 3"}
            />
            <text
              x={PAD_L - 6}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--term-fg-mute)"
              fontFamily="var(--term-font)"
              fontSize="9"
              letterSpacing="0.06em"
            >
              {t}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {buckets.map((b, i) => {
        const x = PAD_L + i * barW + gap / 2;
        const h = (b.count / max) * innerH;
        const y = PAD_T + innerH - h;
        return (
          <g key={b.ts}>
            <rect
              x={x}
              y={y}
              width={drawW}
              height={h}
              fill="var(--term-amber)"
              opacity={0.92}
            >
              <title>
                {formatStamp(b.ts)} · {b.count} scans
              </title>
            </rect>
            {i % labelEvery === 0 ? (
              <text
                x={x + drawW / 2}
                y={H - PAD_B + 14}
                textAnchor="middle"
                fill="var(--term-fg-mute)"
                fontFamily="var(--term-font)"
                fontSize="9"
                letterSpacing="0.06em"
              >
                {fmtAxisLabel(b.ts)}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* X axis line */}
      <line
        x1={PAD_L}
        x2={W - PAD_R}
        y1={PAD_T + innerH}
        y2={PAD_T + innerH}
        stroke="var(--term-rule-strong)"
      />
    </svg>
  );
}
