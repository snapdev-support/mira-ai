import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUsage } from "@/usage/UsageContext";

export const CreditsExhaustedBanner = () => {
  const navigate = useNavigate();
  const { usage } = useUsage();
  const [dismissed, setDismissed] = useState(false);

  if (!usage || usage.creditsRemaining > 0 || dismissed) {
    return null;
  }

  return (
    <div className="w-full px-6 py-2 z-[60] border-b relative" style={{ background: "rgba(217,80,80,0.08)", borderColor: "rgba(217,80,80,0.2)" }}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 text-center">
        <div className="text-sm text-[#D95050] font-medium">
          You’ve used all claim credits. Purchase more to issue new claims.
        </div>
        <Button
          onClick={() => navigate("/pricing")}
          variant="outline"
          size="sm"
          className="shrink-0 h-8 text-[#D95050] hover:text-foreground"
          style={{ borderColor: "rgba(217,80,80,0.3)", borderRadius: 4 }}
        >
          Go to Pricing
        </Button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded transition-colors"
        style={{ color: "#D95050" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(217,80,80,0.12)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
