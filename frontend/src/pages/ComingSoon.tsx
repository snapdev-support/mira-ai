import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

function titleFromPath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  const map: Record<string, string> = {
    "/contact":   "Contact",
    "/careers":   "Careers",
    "/legal":     "Legal",
    "/privacy":   "Privacy Policy",
    "/terms":     "Terms of Service",
    "/blog":      "Blog",
    "/status":    "System Status",
    "/api":       "API Reference",
    "/changelog": "Changelog",
    "/pricing":   "Pricing",
  };
  return map[p] ?? "Coming Soon";
}

export default function ComingSoon() {
  const { pathname } = useLocation();
  const title = titleFromPath(pathname);

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>

      {/* Header */}
      <header className="border-b sticky top-0 z-50" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", height: 56 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div className="h-4 w-px bg-border hidden sm:block" />
            <span className="text-xs text-muted-foreground hidden sm:block">{title}</span>
          </div>

          <Link to="/verify">
            <Button size="sm" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none" }}
              className="hover:opacity-90 transition-opacity duration-150">
              Try Demo
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md p-8 text-center border" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
          <h1 className="text-xl font-bold text-foreground mb-3">{title}</h1>
          <p className="text-sm text-muted-foreground mb-6">This page isn't part of Stage 1 yet.</p>
          <Link to="/">
            <Button variant="outline" style={{ borderColor: "var(--color-border)", color: "var(--color-text)", background: "transparent", borderRadius: 4 }}
              className="hover:border-[#B5C45A] hover:text-[#B5C45A] transition-colors duration-150">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
