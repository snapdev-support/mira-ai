import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Globe, Users, Award, Lock, Zap } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const About = () => {
  return (
    <div className="min-h-screen font-sans" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>

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
            <span className="text-xs text-muted-foreground hidden sm:block">About</span>
          </div>

          <Link to="/contact">
            <Button size="sm" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none" }}
              className="hover:opacity-90 transition-opacity duration-150">
              Contact Us
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Hero */}
        <div className="text-center mb-20">
          <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-primary mb-5">
            Powered by AgenticAI
          </p>
          <h1 className="text-[48px] md:text-[56px] font-bold tracking-[-0.02em] text-foreground mb-6 leading-[1.05]">
            Transforming Trust with AgenticAI
          </h1>
          <p className="text-base text-muted-foreground max-w-[560px] mx-auto leading-relaxed">
            MiraTrust turns any QR code into a human-readable verdict in under 2 seconds.
            We're building the future of instant, cryptographic verification for a world that demands truth.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-6 mb-20">
          <div className="p-8 border hover:border-[#B5C45A]/30 transition-colors duration-150" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
            <Shield className="h-6 w-6 text-primary mb-6" />
            <h2 className="text-[22px] font-bold mb-4 text-foreground">Our Mission</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To eliminate fraud and build trust in digital transactions through AgenticAI-powered
              cryptographic verification. We believe every QR code should carry proof, not just links.
            </p>
          </div>

          <div className="p-8 border hover:border-[#B5C45A]/30 transition-colors duration-150" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
            <Globe className="h-6 w-6 text-primary mb-6" />
            <h2 className="text-[22px] font-bold mb-4 text-foreground">Our Vision</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A world where trust is instant and verifiable. Where businesses can process invoices
              in seconds, consumers can verify product authenticity, and fraud becomes impossible.
            </p>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-20 border" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
          {[
            { value: "127K+", label: "Verifications",    color: "var(--color-accent)" },
            { value: "99.7%", label: "AI Accuracy",      color: "#4CAF7D" },
            { value: "<2s",   label: "Verification Time", color: "var(--color-text)" },
            { value: "342",   label: "Active Issuers",    color: "var(--color-text)" },
          ].map((stat, i) => (
            <div key={i} className="text-center p-8 border-r last:border-r-0" style={{ borderColor: "var(--color-border)" }}>
              <div className="text-[36px] font-bold mb-1" style={{ color: stat.color }}>{stat.value}</div>
              <div className="label-caps text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Technology */}
        <div className="mb-20">
          <h2 className="text-[32px] font-bold text-center mb-12 text-foreground">Built on Cutting-Edge Technology</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Zap,   title: "AgenticAI",          desc: "Advanced AI agents that extract, sign, and verify claims with 99.7% accuracy." },
              { icon: Lock,  title: "Ed25519 Cryptography", desc: "Military-grade cryptographic signatures ensure tamper-proof verification." },
              { icon: Award, title: "Enterprise Security",  desc: "SOC 2 Type II compliance with 99.9% uptime and global CDN distribution." },
            ].map((item, i) => (
              <div key={i} className="p-8 text-center border hover:border-[#B5C45A]/30 transition-colors duration-150" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                <item.icon className="h-6 w-6 text-primary mx-auto mb-5" />
                <h3 className="text-base font-semibold mb-3 text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center p-14 border" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
          <h2 className="text-[30px] font-bold mb-4 text-foreground">Ready to Build the Future of Trust?</h2>
          <p className="text-base mb-8 text-muted-foreground max-w-[480px] mx-auto">
            Join our team of innovators building AgenticAI-powered verification systems.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/careers">
              <Button size="lg" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, fontWeight: 600, border: "none", height: 44, padding: "0 24px", fontSize: 14 }}
                className="hover:opacity-90 transition-opacity duration-150">
                <Users className="h-4 w-4 mr-2" />
                View Careers
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" style={{ borderRadius: 4, height: 44, padding: "0 24px", fontSize: 14, background: "transparent", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                className="hover:border-[#B5C45A] hover:text-[#B5C45A] transition-colors duration-150">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
