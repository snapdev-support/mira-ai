import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Book, Code, Zap, Shield, Copy, CheckCircle, Terminal, ChevronRight, Search, Hash, Key, Lock } from "lucide-react";

const Docs = () => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeSection, setActiveSection] = useState("introduction");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const sections = [
    { id: "introduction",  title: "Introduction",   icon: Book },
    { id: "quick-start",   title: "Quick Start",    icon: Zap },
    { id: "authentication", title: "Authentication", icon: Key },
    { id: "signing",       title: "Signing Claims",  icon: Hash },
    { id: "verification",  title: "Verification",   icon: Shield },
    { id: "sdks",          title: "SDKs & Tools",   icon: Terminal },
  ];

  return (
    <div className="min-h-screen font-sans" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>

      {/* Header */}
      <header className="border-b sticky top-0 z-50" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", height: 56 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="h-4 w-px bg-border hidden md:block" />
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/docs"       className="text-sm font-medium text-foreground">Documentation</Link>
              <Link to="/playground" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150">API Reference</Link>
              <Link to="/solutions"  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150">Guides</Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search documentation..."
                className="py-1.5 pl-9 pr-4 text-sm focus:outline-none"
                style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text)", borderRadius: 3, width: 240 }}
              />
            </div>
            <Link to="/playground">
              <Button size="sm" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none" }}
                className="hover:opacity-90 transition-opacity duration-150">
                <Code className="h-3.5 w-3.5 mr-2" />
                API Playground
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-12 gap-8">

          {/* Sidebar */}
          <div className="hidden lg:block lg:col-span-3 sticky top-20 h-[calc(100vh-6rem)]">
            <div className="space-y-0.5">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors duration-150"
                  style={{
                    borderRadius: 3,
                    background: activeSection === section.id ? "rgba(181,196,90,0.08)" : "transparent",
                    color:       activeSection === section.id ? "var(--color-accent)" : "var(--color-muted)",
                  }}
                >
                  <section.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{section.title}</span>
                  {activeSection === section.id && <ChevronRight className="h-3 w-3 ml-auto" />}
                </button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t" style={{ borderColor: "var(--color-border)" }}>
              <h4 className="label-caps text-muted-foreground mb-3 px-3">Resources</h4>
              <div className="space-y-0.5">
                <a href="#" className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">Status Page</a>
                <a href="#" className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">Changelog</a>
                <a href="#" className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">Community Support</a>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9 space-y-12 pb-24">

            {/* Hero */}
            <div className="space-y-5 border-b pb-12" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center gap-2 text-primary">
                <Terminal className="h-4 w-4" />
                <span className="text-xs font-mono">developer.miratrust.ai</span>
              </div>
              <h1 className="text-[44px] font-bold tracking-[-0.02em] text-foreground leading-[1.05]">
                Build Trust with AgenticAI
              </h1>
              <p className="text-base text-muted-foreground max-w-[560px] leading-relaxed">
                Integrate cryptographic verification into your applications with our RESTful API,
                SDKs, and comprehensive documentation. Secure your data with military-grade encryption.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="default" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none" }}
                  className="hover:opacity-90 transition-opacity duration-150">
                  Get API Keys
                </Button>
                <Button size="default" variant="outline" style={{ borderRadius: 4, background: "transparent", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  className="hover:border-[#B5C45A] hover:text-[#B5C45A] transition-colors duration-150">
                  View on GitHub
                </Button>
              </div>
            </div>

            {/* Quick Start */}
            <section id="quick-start" className="space-y-5 scroll-mt-24">
              <div className="flex items-center gap-3 mb-5">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="text-[26px] font-bold text-foreground">Quick Start</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                {[
                  {
                    title: "1. Sign a Claim",
                    subtitle: "Create a cryptographically signed claim",
                    endpoint: "POST /api/v1/claims/sign",
                    endpointColor: "var(--color-accent)",
                    code: `{\n  "type": "invoice",\n  "issuer": "ACME Corp",\n  "data": {\n    "invoiceNumber": "INV-001",\n    "amount": 4200\n  }\n}`,
                    onCopy: () => copyToClipboard("curl -X POST https://api.miratrust.ai/v1/claims/sign"),
                    copied: copiedCode,
                  },
                  {
                    title: "2. Verify a Claim",
                    subtitle: "Get instant human-readable verification",
                    endpoint: "POST /api/v1/claims/verify",
                    endpointColor: "#4CAF7D",
                    code: `{\n  "valid": true,\n  "verdict": "Valid — Issued by ACME",\n  "aiConfidence": 99.7,\n  "verifyTime": "0.8s"\n}`,
                    onCopy: undefined,
                    copied: false,
                  },
                ].map((card, i) => (
                  <div key={i} className="border" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                    <div className="p-5 border-b" style={{ borderColor: "var(--color-border)" }}>
                      <h3 className="text-sm font-semibold text-foreground mb-1">{card.title}</h3>
                      <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}>
                        <span className="text-xs font-mono" style={{ color: card.endpointColor }}>{card.endpoint}</span>
                        {card.onCopy && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" style={{ color: "var(--color-muted)" }} onClick={card.onCopy}>
                            {card.copied ? <CheckCircle className="h-3 w-3 text-[#4CAF7D]" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                      <pre className="p-4 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">{card.code}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Authentication */}
            <section id="authentication" className="space-y-5 scroll-mt-24">
              <div className="flex items-center gap-3 mb-5">
                <Key className="h-5 w-5 text-primary" />
                <h2 className="text-[26px] font-bold text-foreground">Authentication</h2>
              </div>

              <div className="border p-6" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  Authenticate your requests by including your API key in the{" "}
                  <code className="text-primary font-mono text-xs px-1.5 py-0.5" style={{ background: "rgba(181,196,90,0.1)", borderRadius: 2 }}>Authorization</code>{" "}
                  header. Manage your keys in the{" "}
                  <Link to="/app/console" className="text-foreground hover:text-[#B5C45A] transition-colors">Developer Console</Link>.
                </p>

                <div className="border p-4" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                  <div className="text-xs font-mono text-muted-foreground mb-2">Header Format</div>
                  <code className="text-[#4CAF7D] font-mono text-sm block">
                    Authorization: Bearer mira_live_sk_...
                  </code>
                </div>

                {/* Warning — verdict-style */}
                <div className="mt-5 flex items-start gap-3 p-4 border-l-[3px]" style={{ background: "rgba(230,168,23,0.08)", borderLeftColor: "#E6A817", borderRadius: "0 3px 3px 0" }}>
                  <Lock className="h-4 w-4 text-[#E6A817] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold tracking-[0.06em] uppercase text-[#E6A817] mb-1">Security Notice</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Never share your secret keys. Keep them secure and only use them in server-side code.
                      For client-side implementations, use publishable keys.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* SDKs */}
            <section id="sdks" className="space-y-5 scroll-mt-24">
              <div className="flex items-center gap-3 mb-5">
                <Terminal className="h-5 w-5 text-primary" />
                <h2 className="text-[26px] font-bold text-foreground">Official SDKs</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                {[
                  { lang: "JS",  name: "Node.js", version: "v2.1.0", desc: "Full-featured SDK with TypeScript support and React hooks.", install: "npm install @mira-ai/sdk" },
                  { lang: "PY",  name: "Python",  version: "v1.4.2", desc: "Async-ready client with Pydantic models and Django integration.", install: "pip install mira-ai" },
                  { lang: "GO",  name: "Go",      version: "v1.0.0", desc: "High-performance Go client with context support and middleware.", install: "go get github.com/mira-ai/go" },
                ].map((sdk, i) => (
                  <div key={i} className="p-5 border hover:border-[#B5C45A]/30 transition-colors duration-150 cursor-pointer" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-lg font-bold text-foreground font-mono">{sdk.lang}</div>
                      <span className="text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5" style={{ background: "rgba(181,196,90,0.1)", color: "var(--color-accent)", borderRadius: 2 }}>
                        {sdk.version}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">{sdk.name}</h3>
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{sdk.desc}</p>
                    <code className="text-xs font-mono text-muted-foreground block px-2 py-1.5" style={{ background: "var(--color-bg)", borderRadius: 2 }}>
                      {sdk.install}
                    </code>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <div className="p-8 text-center border" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
              <h2 className="text-[26px] font-bold text-foreground mb-4">Ready to start building?</h2>
              <p className="text-sm text-muted-foreground mb-8 max-w-[480px] mx-auto leading-relaxed">
                Get your API keys and start integrating cryptographic verification in minutes.
                Our free tier includes 1,000 verifications per month.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/signup">
                  <Button size="default" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none" }}
                    className="hover:opacity-90 transition-opacity duration-150">
                    Create Free Account
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button size="default" variant="outline" style={{ borderRadius: 4, background: "transparent", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                    className="hover:border-[#B5C45A] hover:text-[#B5C45A] transition-colors duration-150">
                    Contact Sales
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Docs;
