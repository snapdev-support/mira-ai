import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUsage } from "@/usage/UsageContext";

type Level = "critical" | "low";

// Thresholds: show banner when credits fall below these percentages
const CRITICAL_PCT = 0.10; // ≤ 10% remaining
const LOW_PCT      = 0.25; // ≤ 25% remaining

function getLevel(remaining: number, total: number): Level | null {
  if (remaining <= 0 || total <= 0) return null; // handled by CreditsExhaustedBanner
  const pct = remaining / total;
  if (pct <= CRITICAL_PCT) return "critical";
  if (pct <= LOW_PCT)      return "low";
  return null;
}

function dismissKey(level: Level) {
  return `credits_banner_dismissed_${level}`;
}

export function CreditsLowBanner() {
  const navigate = useNavigate();
  const { usage } = useUsage();
  const [dismissed, setDismissed] = useState<Level | null>(null);

  const remaining = usage?.creditsRemaining ?? 0;
  const total     = usage?.creditsTotal ?? 0;
  const level     = getLevel(remaining, total);

  // Load dismissed state from localStorage
  useEffect(() => {
    if (!level) return;
    const stored = localStorage.getItem(dismissKey(level));
    // Only honour the dismissal if credits haven't dropped to a worse level since
    if (stored === "true") setDismissed(level);
    else setDismissed(null);
  }, [level]);

  const handleDismiss = () => {
    if (!level) return;
    localStorage.setItem(dismissKey(level), "true");
    setDismissed(level);
  };

  // Re-show if credits drop to critical even if "low" was dismissed
  if (!level || dismissed === level) return null;

  const pct     = total > 0 ? Math.round((remaining / total) * 100) : 0;
  const isCrit  = level === "critical";

  const bg      = isCrit ? "rgba(217,80,80,0.08)"   : "rgba(230,168,23,0.08)";
  const border  = isCrit ? "rgba(217,80,80,0.2)"    : "rgba(230,168,23,0.2)";
  const color   = isCrit ? "#D95050"                : "#E6A817";
  const Icon    = isCrit ? AlertTriangle            : Zap;
  const label   = isCrit
    ? `Critical: only ${remaining.toLocaleString()} credits left (${pct}%). Top up to avoid interruptions.`
    : `Low credits: ${remaining.toLocaleString()} remaining (${pct}% of ${total.toLocaleString()}).`;

  return (
    <div
      className="w-full px-6 py-2 z-[59] border-b relative"
      style={{ background: bg, borderColor: border }}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 text-center">
        <div className="flex items-center justify-center gap-1.5 text-sm font-medium" style={{ color }}>
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          {label}
        </div>
        <Button
          onClick={() => navigate("/pricing")}
          variant="outline"
          size="sm"
          className="shrink-0 h-8 hover:text-foreground"
          style={{ borderColor: border, color, borderRadius: 4 }}
        >
          Add Credits
        </Button>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded transition-colors"
        style={{ color }}
        onMouseEnter={e => (e.currentTarget.style.background = isCrit ? "rgba(217,80,80,0.12)" : "rgba(230,168,23,0.12)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
