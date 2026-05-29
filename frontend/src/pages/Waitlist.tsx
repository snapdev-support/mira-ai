import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/Logo";
import { useToast } from "@/hooks/use-toast";
import { joinWaitlist } from "@/services/waitlistApi";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  Zap,
  Shield,
  Building2,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const ROLES = [
  { value: "developer",    label: "Developer / Engineer" },
  { value: "brand_owner",  label: "Brand Owner / Manufacturer" },
  { value: "retailer",     label: "Retailer / Distributor" },
  { value: "enterprise",   label: "Enterprise / Operations" },
  { value: "other",        label: "Other" },
];

const BENEFITS = [
  {
    icon: Shield,
    color: "#6366f1",
    bg: "rgba(99,102,241,0.1)",
    title: "Unforgeable Verification",
    text: "QR codes backed by cryptographic proofs customers can check in seconds.",
  },
  {
    icon: Zap,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    title: "Priority Onboarding",
    text: "Dedicated setup support so your first products go live within days.",
  },
  {
    icon: Building2,
    color: "#10b981",
    bg: "rgba(16,185,129,0.1)",
    title: "Shape the Product",
    text: "Your feedback directly influences what we build next.",
  },
];

export default function Waitlist() {
  const { toast } = useToast();

  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [company, setCompany] = useState("");
  const [role,    setRole]    = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await joinWaitlist({
        name:    name.trim(),
        email:   email.trim(),
        company: company.trim(),
        role:    role || undefined,
      });
      setAlreadyRegistered(res.already_registered);
      setSubmitted(true);
    } catch {
      toast({ title: "Something went wrong", description: "Please try again in a moment.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen font-sans overflow-x-hidden"
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{ zIndex: 0 }}
      >
        <div
          style={{
            position: "absolute",
            top: "-10%",
            left: "60%",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: "radial-gradient(circle, var(--color-accent-8) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-5%",
            left: "-5%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, var(--color-accent-8) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* Header */}
      <header
        className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between border-b"
        style={{ borderColor: "var(--color-border)", zIndex: 1 }}
      >
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium transition-colors duration-150"
          style={{ color: "var(--color-muted)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--color-muted)")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <Logo size="sm" />
        <div className="w-16" />
      </header>

      {/* Main */}
      <main
        className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24"
        style={{ zIndex: 1 }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-center">

          {/* ── Left: copy ────────────────────────────────────────────── */}
          <div className="space-y-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 border text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{
                borderColor: "var(--color-accent-20)",
                background: "var(--color-accent-8)",
                color: "var(--color-accent)",
                borderRadius: 999,
              }}
            >
              <Sparkles className="h-3 w-3" />
              Limited Early Access
            </div>

            {/* Heading */}
            <div className="space-y-5">
              <h1 className="text-[42px] sm:text-[52px] font-bold tracking-[-0.025em] leading-[1.04]"
                style={{ color: "var(--color-text)" }}
              >
                Protect your brand.{" "}
                <span style={{ color: "var(--color-accent)" }}>
                  Earn customer trust.
                </span>
              </h1>
              <p className="text-base leading-relaxed" style={{ color: "var(--color-muted)" }}>
                MiraTrust lets brands embed unforgeable QR codes into products — so customers can verify authenticity instantly, anywhere in the world.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)", opacity: 0.65 }}>
                We're inviting a small group of early partners to shape the platform. Join the waitlist and we'll reach out personally.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-4">
              {BENEFITS.map(({ icon: Icon, color, bg, title, text }) => (
                <div key={title} className="flex items-start gap-4">
                  <div
                    className="flex items-center justify-center w-9 h-9 flex-shrink-0"
                    style={{ background: bg, borderRadius: 10 }}
                  >
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                      {title}
                    </p>
                    <p className="text-sm mt-0.5 leading-relaxed" style={{ color: "var(--color-muted)" }}>
                      {text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div
              className="flex items-center gap-3 px-4 py-3 border"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-bg-card)",
                borderRadius: 10,
              }}
            >
              <div className="flex -space-x-2">
                {["#6366f1", "#f59e0b", "#10b981", "#ec4899"].map((c) => (
                  <div
                    key={c}
                    className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ borderColor: "var(--color-bg-card)", background: c }}
                  />
                ))}
              </div>
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                <span className="font-semibold" style={{ color: "var(--color-text)" }}>
                  50+ companies
                </span>{" "}
                already on the waitlist
              </p>
            </div>

            <p className="text-xs" style={{ color: "var(--color-muted)", opacity: 0.45 }}>
              No spam. No sales cadence. We'll only contact you when your spot is ready.
            </p>
          </div>

          {/* ── Right: form or success ─────────────────────────────────── */}
          <div>
            {submitted ? (
              <SuccessCard name={name} alreadyRegistered={alreadyRegistered} />
            ) : (
              <div
                className="border shadow-xl"
                style={{
                  background: "var(--color-bg-card)",
                  borderColor: "var(--color-border)",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                {/* Card top accent bar */}
                <div style={{ height: 3, background: "var(--color-accent)" }} />

                <div className="p-7 sm:p-9">
                  <div className="mb-7">
                    <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
                      Request early access
                    </h2>
                    <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
                      Takes 30 seconds. We'll review and reach out personally.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FieldGroup label="Full name" required>
                        <Input
                          id="name"
                          placeholder="Jane Smith"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          style={inputStyle}
                        />
                      </FieldGroup>
                      <FieldGroup label="Work email" required>
                        <Input
                          id="email"
                          type="email"
                          placeholder="jane@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          style={inputStyle}
                        />
                      </FieldGroup>
                    </div>

                    {/* Company — now required */}
                    <FieldGroup label="Company" required>
                      <Input
                        id="company"
                        placeholder="Acme Inc."
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        required
                        style={inputStyle}
                      />
                    </FieldGroup>

                    {/* Role */}
                    <FieldGroup label="What best describes you?" optional>
                      <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full h-10 border px-3 text-sm focus:outline-none focus:ring-2 transition-shadow"
                        style={{
                          ...inputStyle,
                          height: 40,
                          appearance: "none",
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 12px center",
                          paddingRight: 36,
                        }}
                      >
                        <option value="" style={{ background: "var(--color-bg)" }}>Select a role…</option>
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value} style={{ background: "var(--color-bg)" }}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </FieldGroup>

                    {/* Divider */}
                    <div style={{ borderTop: "1px solid var(--color-border)", margin: "4px 0" }} />

                    {/* Submit */}
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2"
                      style={{
                        background: "var(--color-accent)",
                        color: "var(--color-accent-fg)",
                        borderRadius: 10,
                        border: "none",
                      }}
                    >
                      {isLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                      ) : (
                        <>Request Early Access <ArrowRight className="h-4 w-4" /></>
                      )}
                    </Button>

                    {/* Trust line */}
                    <div className="flex items-center justify-center gap-1.5">
                      <Lock className="h-3 w-3" style={{ color: "var(--color-muted)", opacity: 0.5 }} />
                      <p className="text-center text-xs" style={{ color: "var(--color-muted)", opacity: 0.5 }}>
                        Your data is never sold or shared.
                      </p>
                    </div>

                    <p className="text-center text-xs" style={{ color: "var(--color-muted)" }}>
                      Already have an account?{" "}
                      <Link
                        to="/login"
                        className="font-medium transition-colors duration-150"
                        style={{ color: "var(--color-accent)" }}
                      >
                        Sign in
                      </Link>
                    </p>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Field group ────────────────────────────────────────────────────────────

function FieldGroup({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--color-muted)" }}>
        {label}
        {required && <span style={{ color: "var(--color-accent)" }}>*</span>}
        {optional && <span className="font-normal" style={{ opacity: 0.5 }}>(optional)</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-bg)",
  borderColor: "var(--color-border)",
  color: "var(--color-text)",
  borderRadius: 8,
  fontSize: 14,
};

// ── Success card ───────────────────────────────────────────────────────────

function SuccessCard({ name, alreadyRegistered }: { name: string; alreadyRegistered: boolean }) {
  const firstName = name.split(" ")[0];
  return (
    <div
      className="border shadow-xl overflow-hidden"
      style={{
        background: "var(--color-bg-card)",
        borderColor: "var(--color-border)",
        borderRadius: 16,
      }}
    >
      <div style={{ height: 3, background: "#10b981" }} />
      <div className="p-8 sm:p-10 text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className="w-16 h-16 flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.1)", borderRadius: 999 }}
          >
            <CheckCircle className="h-8 w-8" style={{ color: "#10b981" }} />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            {alreadyRegistered ? "You're already on the list!" : `You're in, ${firstName}!`}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
            {alreadyRegistered
              ? "We already have your details. We'll be in touch when your spot opens up."
              : "Thanks for your interest in MiraTrust. We'll reach out personally when we're ready to onboard you — usually within a few days."}
          </p>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--color-border)" }} />

        <div className="space-y-2.5">
          <Link to="/">
            <Button
              variant="outline"
              className="w-full text-sm font-medium transition-colors duration-150"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
                background: "transparent",
                borderRadius: 10,
              }}
            >
              Back to Home
            </Button>
          </Link>
          <Link to="/verify">
            <Button
              variant="ghost"
              className="w-full text-sm transition-colors duration-150"
              style={{ color: "var(--color-muted)" }}
            >
              Try the free QR scanner
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
