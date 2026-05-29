import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Zap, CalendarDays, TrendingUp, ArrowUpRight } from "lucide-react";
import type { SubscriptionOverview } from "@/types/backend";
import { cancelPlan } from "@/services/billingApi";
import { useToast } from "@/hooks/use-toast";

interface Props {
  overview: SubscriptionOverview;
  onRefresh: () => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function statusLabel(status: SubscriptionOverview["status"]): {
  label: string;
  color: string;
  bg: string;
  border: string;
} {
  switch (status) {
    case "active":
      return {
        label: "Active",
        color: "var(--color-safe)",
        bg: "rgba(76,175,125,0.10)",
        border: "rgba(76,175,125,0.20)",
      };
    case "trialing":
      return {
        label: "Trial",
        color: "var(--color-warn)",
        bg: "rgba(230,168,23,0.10)",
        border: "rgba(230,168,23,0.20)",
      };
    case "past_due":
      return {
        label: "Past Due",
        color: "var(--color-danger)",
        bg: "rgba(217,80,80,0.10)",
        border: "rgba(217,80,80,0.20)",
      };
    case "canceled":
      return {
        label: "Canceled",
        color: "var(--color-muted)",
        bg: "var(--color-bg-light)",
        border: "var(--color-border)",
      };
    default:
      return {
        label: "Free",
        color: "var(--color-muted)",
        bg: "var(--color-bg-light)",
        border: "var(--color-border)",
      };
  }
}

export function PlanOverviewCard({ overview, onRefresh }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCancel, setShowCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const st = statusLabel(overview.status);
  const isPaid = overview.planId !== "free";

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await cancelPlan();
      toast({ title: "Plan cancelled", description: "You've been moved to the Free plan." });
      setShowCancel(false);
      onRefresh();
    } catch {
      toast({ title: "Failed to cancel", variant: "destructive" });
    } finally {
      setCanceling(false);
    }
  };
  const usedPct =
    overview.creditsTotal > 0
      ? Math.min(
          100,
          ((overview.creditsTotal - overview.creditsRemaining) /
            overview.creditsTotal) *
            100
        )
      : 0;

  return (
    <div
      className="p-6 border"
      style={{
        background: "var(--color-bg-card)",
        borderColor: "var(--color-border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p
            className="text-[11px] font-bold tracking-[0.1em] uppercase mb-1.5"
            style={{ color: "var(--color-muted)" }}
          >
            Current Plan
          </p>
          <div className="flex items-center gap-3">
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--color-text)" }}
            >
              {overview.planName}
            </h2>
            <span
              className="px-2 py-0.5 text-[11px] font-semibold border"
              style={{
                color: st.color,
                background: st.bg,
                borderColor: st.border,
                borderRadius: "var(--radius-sm)",
              }}
            >
              {st.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPaid && (
            <Button
              size="sm"
              variant="ghost"
              className="text-sm"
              style={{ color: "var(--color-danger)", borderRadius: "var(--radius-btn)" }}
              onClick={() => setShowCancel(true)}
            >
              Cancel Plan
            </Button>
          )}
          <Button
            size="sm"
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-accent-fg)",
              borderRadius: "var(--radius-btn)",
              border: "none",
            }}
            onClick={() => navigate("/pricing")}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Add Credits
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatItem
          icon={Zap}
          label="Credits Remaining"
          value={overview.creditsRemaining.toLocaleString()}
          sub={`of ${overview.creditsTotal.toLocaleString()} total`}
        />
        <StatItem
          icon={TrendingUp}
          label="Last Purchase"
          value={`$${overview.amountUsd}`}
          sub={overview.interval === "one_time" ? "One-time" : `per ${overview.interval}`}
        />
        <StatItem
          icon={CalendarDays}
          label="Credits Expire"
          value={
            overview.currentPeriodEnd
              ? formatDate(overview.currentPeriodEnd)
              : "Never"
          }
          sub={
            overview.currentPeriodEnd
              ? `Started ${formatDate(overview.currentPeriodStart)}`
              : "Credits never expire"
          }
        />
      </div>

      {/* Credit usage bar */}
      <div>
        <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--color-muted)" }}>
          <span>Credit Usage</span>
          <span>
            {(overview.creditsTotal - overview.creditsRemaining).toLocaleString()} used /{" "}
            {overview.creditsTotal.toLocaleString()} total
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden"
          style={{ background: "var(--color-bg-light)", borderRadius: 2 }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${usedPct}%`,
              background:
                usedPct > 90
                  ? "var(--color-danger)"
                  : usedPct > 70
                  ? "var(--color-warn)"
                  : "var(--color-accent)",
              borderRadius: 2,
            }}
          />
        </div>
        {usedPct > 90 && (
          <p className="text-xs mt-1.5" style={{ color: "var(--color-danger)" }}>
            Running low — consider topping up.
          </p>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog open={showCancel} onOpenChange={(v) => !v && setShowCancel(false)}>
        <DialogContent
          className="sm:max-w-sm"
          style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-text)" }}>Cancel Plan</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              Your plan will be downgraded to Free. Your remaining credits will be kept — you won't lose any unused credits.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              style={{ borderColor: "var(--color-border)", color: "var(--color-muted)", borderRadius: "var(--radius-btn)" }}
              onClick={() => setShowCancel(false)}
              disabled={canceling}
            >
              Keep Plan
            </Button>
            <Button
              className="flex-1 font-semibold"
              style={{ background: "var(--color-danger)", color: "#fff", borderRadius: "var(--radius-btn)", border: "none" }}
              onClick={handleCancel}
              disabled={canceling}
            >
              {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="p-4 border"
      style={{
        background: "var(--color-bg)",
        borderColor: "var(--color-border)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} />
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--color-muted)" }}
        >
          {label}
        </span>
      </div>
      <p className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
        {value}
      </p>
      <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
        {sub}
      </p>
    </div>
  );
}
