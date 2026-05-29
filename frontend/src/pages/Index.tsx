import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { Logo } from "@/components/ui/Logo";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Shield, CheckCircle, Zap, Globe,
  ArrowRight, Menu, X,
  Terminal, Database, Fingerprint, Activity,
  Layers, Cpu,
  ChevronRight,
  Sun, Moon,
} from "lucide-react";

const Index = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { status } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden font-sans" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>

      {/* ── Navigation ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-colors duration-150"
        style={{
          height: 56,
          background: "var(--color-bg)",
          borderBottom: isScrolled ? "1px solid var(--color-border)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/verify"   className="text-sm font-medium transition-colors duration-150 text-muted-foreground hover:text-foreground">Verify</Link>
            <Link to="/docs"     className="text-sm font-medium transition-colors duration-150 text-muted-foreground hover:text-foreground">Developers</Link>
            <Link to="/pricing"  className="text-sm font-medium transition-colors duration-150 text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link to="/waitlist" className="text-sm font-medium transition-colors duration-150 text-muted-foreground hover:text-foreground">Early Access</Link>
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 4,
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-card)",
                color: "var(--color-muted)",
                cursor: "pointer",
              }}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {status === "authenticated" ? (
              <Link to="/app/dashboard">
                <Button size="sm" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none" }}
                  className="hover:opacity-90 transition-opacity duration-150">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium transition-colors duration-150 text-muted-foreground hover:text-foreground">
                  Log in
                </Link>
                <Link to="/signup">
                  <Button size="sm" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none" }}
                    className="hover:opacity-90 transition-opacity duration-150">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-14 left-0 right-0 border-b border-border p-4" style={{ background: "var(--color-bg)" }}>
            <nav className="flex flex-col gap-1">
              <Link to="/verify"   className="text-sm font-medium p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded" onClick={() => setMobileMenuOpen(false)}>Verify</Link>
              <Link to="/docs"     className="text-sm font-medium p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded" onClick={() => setMobileMenuOpen(false)}>Developers</Link>
              <Link to="/pricing"  className="text-sm font-medium p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <div className="h-px bg-border my-2" />
              {status === "authenticated" ? (
                <Link to="/app/dashboard" className="w-full" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none" }}>
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login"  className="text-sm font-medium p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
                  <Link to="/signup" className="w-full" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none" }}>
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* ── Hero Section ── */}
      <section className="relative pt-36 pb-24 lg:pt-48 lg:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            {/* Label */}
            <p className="mb-5 text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: "var(--color-accent)" }}>
              Proof at Scan
            </p>

            <h1 className="text-[62px] md:text-[76px] font-bold tracking-[-0.02em] mb-6 leading-[1.05]" style={{ color: "var(--color-text)" }}>
              Scan → Truth.
            </h1>

            <p className="text-[17px] mb-10 leading-relaxed max-w-[560px] mx-auto text-muted-foreground">
              Turn any QR into a human-readable verdict in under 2 seconds.
              Cryptographically signed trustmarks, verified instantly — no app, no upload.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none", height: 44, padding: "0 24px", fontSize: 14, letterSpacing: "0.01em" }}
                  className="hover:opacity-90 transition-opacity duration-150">
                  Start Building
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/docs">
                <Button size="lg" variant="outline" style={{ borderRadius: 4, height: 44, padding: "0 24px", fontSize: 14, background: "transparent", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  className="hover:border-[#B5C45A] hover:text-[#B5C45A] transition-colors duration-150">
                  Read Documentation
                  <Terminal className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="relative mx-auto max-w-5xl">
            <div className="relative border border-border overflow-hidden" style={{ borderRadius: 3, background: "var(--color-bg-card)" }}>
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border" style={{ background: "var(--color-bg)" }}>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-border" />
                  <div className="w-2.5 h-2.5 rounded-full bg-border" />
                  <div className="w-2.5 h-2.5 rounded-full bg-border" />
                </div>
                <div className="mx-auto px-3 py-1 border border-border text-xs font-mono text-muted-foreground" style={{ borderRadius: 2 }}>
                  mira.ai/console
                </div>
              </div>

              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left column */}
                <div className="col-span-2 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border border-border" style={{ borderRadius: 3, background: "var(--color-bg)" }}>
                      <div className="text-xs mb-1 label-caps">Total Verifications</div>
                      <div className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>2,543,901</div>
                      <div className="text-xs text-[#4CAF7D] flex items-center mt-1">
                        <Activity className="h-3 w-3 mr-1" /> +12.5% this week
                      </div>
                    </div>
                    <div className="p-4 border border-border" style={{ borderRadius: 3, background: "var(--color-bg)" }}>
                      <div className="text-xs mb-1 label-caps">Success Rate</div>
                      <div className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>99.99%</div>
                      <div className="text-xs text-[#4CAF7D] flex items-center mt-1">
                        <CheckCircle className="h-3 w-3 mr-1" /> Optimal
                      </div>
                    </div>
                  </div>
                  <div className="h-48 border border-border flex items-center justify-center relative overflow-hidden" style={{ borderRadius: 3, background: "var(--color-bg)" }}>
                    <div className="absolute inset-0 flex items-end justify-between px-4 pb-4 opacity-30">
                      {[40, 60, 45, 70, 65, 85, 80, 95, 90, 100].map((h, i) => (
                        <div key={i} className="w-full mx-1" style={{ height: `${h}%`, background: "var(--color-accent)", borderRadius: "2px 2px 0 0" }} />
                      ))}
                    </div>
                    <span className="text-sm font-medium relative z-10 text-muted-foreground">Real-time Traffic Analysis</span>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                  <div className="p-4 border border-border" style={{ borderRadius: 3, background: "var(--color-bg)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <Fingerprint className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
                      <div className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>Verdict Check</div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-1.5 w-full overflow-hidden" style={{ background: "var(--color-border)", borderRadius: 2 }}>
                        <div className="h-full w-[85%]" style={{ background: "var(--color-accent)" }} />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Processing</span>
                        <span>85%</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border border-border" style={{ borderRadius: 3, background: "var(--color-bg)" }}>
                    <div className="text-xs mb-3 label-caps">Recent Logs</div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#4CAF7D]" />
                          <span className="font-mono text-muted-foreground">GET /api/v1/verify</span>
                          <span className="ml-auto text-muted-foreground">24ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="py-24 border-y border-border" style={{ background: "var(--color-bg-card)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-[560px] mx-auto mb-16">
            <h2 className="text-[36px] font-bold mb-4" style={{ color: "var(--color-text)" }}>Enterprise-grade infrastructure</h2>
            <p className="text-base text-muted-foreground">
              Built for developers who demand the best. MiraTrust provides the tools
              you need to build secure, verifiable applications.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Shield,      title: "Bank-grade Security",   desc: "SOC 2 Type II certified infrastructure with end-to-end encryption and automated threat detection." },
              { icon: Zap,         title: "Verdict in Under 2s",   desc: "Scan a QR and get a human-readable verdict — green, amber, or red — in under 2 seconds, anywhere in the world." },
              { icon: Layers,      title: "Seamless Integration",  desc: "Drop-in SDKs for React, Node.js, Python, and Go. Get started with just a few lines of code." },
              { icon: Database,    title: "Immutable Logs",        desc: "Every verification is cryptographically signed and stored in a tamper-proof ledger." },
              { icon: Globe,       title: "Global Compliance",     desc: "GDPR, CCPA, and HIPAA compliant out of the box. We handle the regulatory complexity." },
              { icon: Cpu,         title: "AI-Powered Analysis",   desc: "Advanced machine learning models detect fraud patterns and anomalies in real-time." },
            ].map((feature, i) => (
              <div key={i} className="p-7 border border-border transition-colors duration-150 hover:border-[var(--color-accent)]" style={{ borderRadius: 3, background: "var(--color-bg)" }}>
                <feature.icon className="h-6 w-6 mb-4" style={{ color: "var(--color-accent)" }} />
                <h3 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Code Preview Section ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[11px] font-bold tracking-[0.1em] uppercase mb-4" style={{ color: "var(--color-accent)" }}>
                Developer First
              </p>
              <h2 className="text-[36px] font-bold mb-6" style={{ color: "var(--color-text)" }}>
                Designed for Developers
              </h2>
              <p className="text-base mb-8 leading-relaxed text-muted-foreground">
                Our API is designed to be intuitive and powerful. Integrate verification
                into your workflow in minutes, not days.
              </p>

              <div className="space-y-5">
                {[
                  { title: "Simple REST API",      desc: "Standard HTTP methods and JSON responses." },
                  { title: "Webhooks",             desc: "Real-time notifications for verification events." },
                  { title: "Detailed Documentation", desc: "Comprehensive guides and interactive examples." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: "var(--color-accent)" }} />
                    <div>
                      <h4 className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Link to="/docs">
                  <Button variant="outline" style={{ borderRadius: 4, background: "transparent", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                    className="gap-2 hover:border-[#B5C45A] hover:text-[#B5C45A] transition-colors duration-150">
                    Explore the API <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Code Block */}
            <div className="border border-border overflow-hidden" style={{ borderRadius: 3, background: "var(--color-bg-card)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ background: "var(--color-bg)" }}>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-border" />
                  <div className="w-2.5 h-2.5 rounded-full bg-border" />
                  <div className="w-2.5 h-2.5 rounded-full bg-border" />
                </div>
                <div className="text-xs font-mono text-muted-foreground">verify_token.py</div>
              </div>
              <div className="p-6 overflow-x-auto">
                <pre className="font-mono text-sm leading-relaxed">
                  <code className="text-muted-foreground">
                    <span style={{ color: "var(--color-accent)" }}>import</span> mira_sdk<br /><br />
                    <span className="text-muted-foreground"># Initialize the client</span><br />
                    client = mira_sdk.Client(api_key=<span className="text-[#4CAF7D]">"mira_..."</span>)<br /><br />
                    <span className="text-muted-foreground"># Verify a scanned Mira token</span><br />
                    result = client.verify(<br />
                    &nbsp;&nbsp;token=<span className="text-[#4CAF7D]">"mira:8f3c…e1.k9p2m4qz"</span><br />
                    )<br /><br />
                    <span style={{ color: "var(--color-accent)" }}>if</span> result.verdict == <span className="text-[#4CAF7D]">"VALID"</span>:<br />
                    &nbsp;&nbsp;<span style={{ color: "var(--color-text)" }}>print</span>(result.explanation[<span className="text-[#4CAF7D]">0</span>])<br />
                    <span style={{ color: "var(--color-accent)" }}>else</span>:<br />
                    &nbsp;&nbsp;<span style={{ color: "var(--color-text)" }}>print</span>(<span className="text-[#4CAF7D]">f"Not valid: &#123;result.verdict&#125;"</span>)
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pre-footer CTA Band ── */}
      <section className="border-y border-border py-24" style={{ background: "var(--color-bg-card)" }}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-[36px] font-bold mb-4" style={{ color: "var(--color-text)" }}>Ready to secure your platform?</h2>
          <p className="text-base mb-10 max-w-[560px] mx-auto text-muted-foreground">
            Join thousands of developers building the future of trust. Start for free, scale as you grow.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup">
              <Button size="lg" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none", height: 44, padding: "0 28px", fontSize: 14 }}
                className="hover:opacity-90 transition-opacity duration-150">
                Get Started for Free
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" style={{ borderRadius: 4, height: 44, padding: "0 28px", fontSize: 14, background: "transparent", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                className="hover:border-[#B5C45A] hover:text-[#B5C45A] transition-colors duration-150">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-16" style={{ background: "var(--color-bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 lg:col-span-2">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <Logo />
              </Link>
              <p className="text-sm mb-6 max-w-sm leading-relaxed text-muted-foreground">
                The standard for digital trust and verification. Building a safer internet, one validation at a time.
              </p>
              <div className="flex gap-3">
                <a href="#" aria-label="Twitter" className="transition-colors duration-150 text-muted-foreground hover:text-foreground">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </a>
                <a href="#" aria-label="GitHub" className="transition-colors duration-150 text-muted-foreground hover:text-foreground">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="label-caps mb-4" style={{ color: "var(--color-text)" }}>Product</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/verify"            className="transition-colors duration-150 text-muted-foreground hover:text-foreground">Verify</Link></li>
                <li><Link to="/app/studio"        className="transition-colors duration-150 text-muted-foreground hover:text-foreground">Studio</Link></li>
                <li><Link to="/solutions/invoices" className="transition-colors duration-150 text-muted-foreground hover:text-foreground">Solutions</Link></li>
                <li><Link to="/pricing"           className="transition-colors duration-150 text-muted-foreground hover:text-foreground">Pricing</Link></li>
                <li><Link to="/changelog"         className="transition-colors duration-150 text-muted-foreground hover:text-foreground">Changelog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="label-caps mb-4" style={{ color: "var(--color-text)" }}>Resources</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/docs"   className="transition-colors duration-150 text-muted-foreground hover:text-foreground">Documentation</Link></li>
                <li><Link to="/api"    className="transition-colors duration-150 text-muted-foreground hover:text-foreground">API Reference</Link></li>
                <li><Link to="/status" className="transition-colors duration-150 text-muted-foreground hover:text-foreground">System Status</Link></li>
                <li><Link to="/blog"   className="transition-colors duration-150 text-muted-foreground hover:text-foreground">Blog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="label-caps mb-4" style={{ color: "var(--color-text)" }}>Company</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/about"   className="transition-colors duration-150 text-muted-foreground hover:text-foreground">About</Link></li>
                <li><Link to="/careers" className="transition-colors duration-150 text-muted-foreground hover:text-foreground">Careers</Link></li>
                <li><Link to="/legal"   className="transition-colors duration-150 text-muted-foreground hover:text-foreground">Legal</Link></li>
                <li><Link to="/contact" className="transition-colors duration-150 text-muted-foreground hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <div>© 2025 MiraTrust Inc. All rights reserved.</div>
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-foreground transition-colors duration-150">Privacy Policy</Link>
              <Link to="/terms"   className="hover:text-foreground transition-colors duration-150">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
