import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { fetchBillingPlans, createCheckoutSession } from "@/services/billingApi";
import type { BillingPlan } from "@/types/backend";
import { Check, Loader2, Shield, Zap, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export default function Pricing() {
  const { status: authStatus } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingPlanId, setBuyingPlanId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchBillingPlans();
        if (!alive) return;
        setPlans(data.plans ?? []);
      } catch {
        if (!alive) return;
        setPlans([
          { id: "credits_1000",  priceUsd: 97,  credits: 1000  },
          { id: "credits_5000",  priceUsd: 499, credits: 5000  },
          { id: "credits_12000", priceUsd: 999, credits: 12000 },
        ]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const sorted = useMemo(() => {
    const rank: Record<string, number> = { credits_1000: 1, credits_5000: 2, credits_12000: 3 };
    return [...plans].sort((a, b) => (rank[a.id] ?? 99) - (rank[b.id] ?? 99));
  }, [plans]);

  const onBuy = async (planId: string) => {
    if (authStatus !== "authenticated") {
      navigate("/login", { replace: false, state: { from: "/pricing" } });
      return;
    }
    setBuyingPlanId(planId);
    try {
      const { checkoutUrl } = await createCheckoutSession({ planId });
      window.location.href = checkoutUrl;
    } catch {
      toast({ title: "Checkout failed", description: "Could not start Stripe checkout.", variant: "destructive" });
    } finally {
      setBuyingPlanId(null);
    }
  };

  const getPlanFeatures = (credits: number) => [
    `${credits.toLocaleString()} Claim Credits`,
    "Never expires",
    "Instant allocation",
    "Priority support",
    "Access to all verification tools",
  ];

  const isPopular = (id: string) => id === "credits_5000";

  return (
    <div className="min-h-screen font-sans" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>

      {/* Navbar */}
      <nav className="border-b border-border" style={{ background: "var(--color-bg)", height: 56 }}>
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            {authStatus === "authenticated" ? (
              <Button variant="ghost" onClick={() => navigate("/app/dashboard")}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/login")}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Log in
                </Button>
                <Button onClick={() => navigate("/signup")}
                  style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none" }}
                  className="hover:opacity-90 transition-opacity duration-150 text-sm">
                  Sign up
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center max-w-[560px] mx-auto mb-20">
          <p className="text-[11px] font-bold tracking-[0.1em] uppercase mb-5" style={{ color: "var(--color-accent)" }}>
            Simple, transparent pricing
          </p>
          <h1 className="text-[48px] font-bold tracking-[-0.02em] mb-5 leading-[1.05]" style={{ color: "var(--color-text)" }}>
            Choose the right plan for your scale
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Purchase credits as you go. No monthly fees, no hidden costs.
            Credits never expire.
          </p>
        </div>

        {/* Pricing Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-accent)" }} />
            <p className="text-sm text-muted-foreground">Loading plans...</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3 items-start">
            {sorted.map((p) => {
              const popular = isPopular(p.id);
              return (
                <div
                  key={p.id}
                  className="relative flex flex-col h-full p-8 border transition-colors duration-150"
                  style={{
                    background:     popular ? "var(--color-bg-card)" : "var(--color-bg)",
                    borderColor:    popular ? "var(--color-accent)" : "var(--color-border)",
                    borderRadius:   3,
                    borderTopWidth: popular ? 3 : 1,
                    borderTopColor: popular ? "var(--color-accent)" : "var(--color-border)",
                  }}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[11px] font-bold tracking-[0.08em] uppercase"
                      style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 2 }}>
                      Most Popular
                    </div>
                  )}

                  <div className="mb-7">
                    <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
                      {p.credits === 1000 ? "Starter" : p.credits === 5000 ? "Growth" : "Enterprise"}
                    </h3>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[40px] font-bold leading-none" style={{ color: "var(--color-text)" }}>${p.priceUsd}</span>
                      <span className="text-sm text-muted-foreground">/ one-time</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      ${(p.priceUsd / p.credits).toFixed(3)} per credit
                    </p>
                  </div>

                  <div className="space-y-3.5 flex-1 mb-8">
                    {getPlanFeatures(p.credits).map((feature, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--color-accent)" }} />
                        {feature}
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-full h-10 text-sm font-semibold transition-opacity duration-150"
                    style={popular
                      ? { background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, border: "none" }
                      : { background: "transparent", color: "var(--color-text)", borderRadius: 4, border: "1px solid var(--color-border)" }
                    }
                    onClick={() => onBuy(p.id)}
                    disabled={!!buyingPlanId}
                  >
                    {buyingPlanId === p.id ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                    ) : (
                      "Get Started"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Trust Badges */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-border pt-14">
          {[
            { icon: Shield,   title: "Secure Payments",       desc: "Processed securely via Stripe. We never store your card details." },
            { icon: Zap,      title: "Instant Activation",     desc: "Credits are added to your account immediately after payment." },
            { icon: Sparkles, title: "Satisfaction Guaranteed", desc: "Questions? Contact our support team for assistance." },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-3">
              <item.icon className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
