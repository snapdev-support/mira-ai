import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUsage } from "@/usage/UsageContext";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { verifyCheckoutSession } from "@/services/billingApi";

export default function BillingSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const navigate = useNavigate();
  const { refresh } = useUsage();
  const [status, setStatus] = useState<"verifying" | "success">("verifying");

  useEffect(() => {
    let mounted = true;

    const verifyPayment = async () => {
      if (sessionId) {
        try {
          await verifyCheckoutSession(sessionId);
        } catch {
          // webhook may have already processed it — that's fine
        }
      }
      if (!mounted) return;
      await refresh();
      if (!mounted) return;
      setStatus("success");
      setTimeout(() => {
        if (mounted) navigate("/app/billing");
      }, 2000);
    };

    verifyPayment();
    return () => { mounted = false; };
  }, [sessionId, refresh, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md">
        <div className="border p-8 text-center" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>

          <div className="mb-6 flex justify-center">
            {status === "verifying" ? (
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: "var(--color-accent)" }} />
            ) : (
              <CheckCircle2 className="w-12 h-12" style={{ color: "#4CAF7D" }} />
            )}
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            {status === "verifying" ? "Verifying Payment..." : "Payment Successful!"}
          </h1>

          <p className="text-muted-foreground mb-8">
            {status === "verifying"
              ? "Please wait while we confirm your transaction and update your credits."
              : "Your credits have been added to your account. Redirecting you to the dashboard..."}
          </p>

          {sessionId && (
            <div className="text-xs text-muted-foreground/50 font-mono mb-6 truncate">
              ID: {sessionId}
            </div>
          )}

          {status === "success" && (
            <Button
              onClick={() => navigate("/app/billing")}
              className="w-full font-semibold hover:opacity-90 transition-opacity"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, border: "none" }}
            >
              Go to Billing <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
