import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Clock, Shield, Bot, TrendingUp, Users, Building2, CheckCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const Invoices = () => {
  return (
    <div className="min-h-screen font-sans" style={{ background: "#0E0F13", color: "#F5F4F0" }}>

      {/* Header */}
      <header className="border-b sticky top-0 z-50" style={{ background: "#0E0F13", borderColor: "#2A2D3A", height: 56 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-[#7A7D8C] hover:text-[#F5F4F0] transition-colors duration-150">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div className="h-4 w-px bg-[#2A2D3A] hidden sm:block" />
            <span className="text-xs text-[#7A7D8C] hidden sm:block">Invoice Solutions</span>
          </div>

          <Link to="/verify">
            <Button size="sm" style={{ background: "#B5C45A", color: "#0E0F13", borderRadius: 4, fontWeight: 600, border: "none" }}
              className="hover:opacity-90 transition-opacity duration-150">
              Try Demo
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Hero */}
        <div className="text-center mb-20">
          <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#B5C45A] mb-5">
            AgenticAI Invoice Processing
          </p>
          <h1 className="text-[48px] md:text-[56px] font-bold tracking-[-0.02em] text-[#F5F4F0] mb-6 leading-[1.05]">
            Transform Invoice Processing with AgenticAI
          </h1>
          <p className="text-base text-[#7A7D8C] max-w-[560px] mx-auto mb-10 leading-relaxed">
            Reduce AP processing time from 3 days to 30 seconds. Cryptographically signed invoices with instant verification.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/app/studio">
              <Button size="lg" style={{ background: "#B5C45A", color: "#0E0F13", borderRadius: 4, fontWeight: 600, border: "none", height: 44, padding: "0 24px", fontSize: 14 }}
                className="hover:opacity-90 transition-opacity duration-150">
                <Bot className="h-4 w-4 mr-2" />
                Create Signed Invoice
              </Button>
            </Link>
            <Link to="/verify">
              <Button size="lg" variant="outline" style={{ borderRadius: 4, height: 44, padding: "0 24px", fontSize: 14, background: "transparent", borderColor: "#2A2D3A", color: "#F5F4F0" }}
                className="hover:border-[#B5C45A] hover:text-[#B5C45A] transition-colors duration-150">
                <FileText className="h-4 w-4 mr-2" />
                Verify Invoice
              </Button>
            </Link>
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {[
            { icon: Clock,      title: "Instant Processing",    desc: "AgenticAI processes invoices in under 2 seconds, eliminating manual data entry and approval delays.", badge: "99.7% Accuracy" },
            { icon: Shield,     title: "Tamper-Proof Security", desc: "Ed25519 cryptographic signatures ensure invoices cannot be modified after creation.", badge: "Military-Grade" },
            { icon: TrendingUp, title: "Cost Reduction",        desc: "Reduce AP processing costs by 80% while improving accuracy and compliance.", badge: "ROI: 300%" },
          ].map((item, i) => (
            <div key={i} className="p-7 text-center border hover:border-[#B5C45A]/30 transition-colors duration-150" style={{ background: "#16181F", borderColor: "#2A2D3A", borderRadius: 3 }}>
              <item.icon className="h-6 w-6 text-[#B5C45A] mx-auto mb-5" />
              <h3 className="text-base font-semibold mb-3 text-[#F5F4F0]">{item.title}</h3>
              <p className="text-sm text-[#7A7D8C] mb-4 leading-relaxed">{item.desc}</p>
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase px-2.5 py-1" style={{ background: "rgba(181,196,90,0.1)", color: "#B5C45A", borderRadius: 2 }}>
                {item.badge}
              </span>
            </div>
          ))}
        </div>

        {/* Use Cases */}
        <div className="mb-20">
          <h2 className="text-[32px] font-bold text-center mb-12 text-[#F5F4F0]">Invoice Use Cases</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Building2, title: "B2B Invoice Processing",
                desc: "CFOs and AP teams can instantly verify supplier invoices, check authenticity, and approve payments with confidence.",
                items: ["Instant supplier verification", "Automated 3-way matching", "Fraud prevention", "Compliance tracking"],
              },
              {
                icon: Users, title: "Multi-Entity Organizations",
                desc: "Large organizations with multiple subsidiaries can standardize invoice processing across all entities.",
                items: ["Centralized verification", "Standardized workflows", "Cross-entity visibility", "Audit trail maintenance"],
              },
            ].map((card, i) => (
              <div key={i} className="p-7 border hover:border-[#B5C45A]/30 transition-colors duration-150" style={{ background: "#16181F", borderColor: "#2A2D3A", borderRadius: 3 }}>
                <div className="flex items-center gap-3 mb-4">
                  <card.icon className="h-5 w-5 text-[#B5C45A]" />
                  <h3 className="text-base font-semibold text-[#F5F4F0]">{card.title}</h3>
                </div>
                <p className="text-sm text-[#7A7D8C] mb-5 leading-relaxed">{card.desc}</p>
                <ul className="space-y-2.5">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-[#7A7D8C]">
                      <CheckCircle className="h-3.5 w-3.5 text-[#4CAF7D] flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center p-14 border" style={{ background: "#16181F", borderColor: "#2A2D3A", borderRadius: 3 }}>
          <h2 className="text-[30px] font-bold mb-4 text-[#F5F4F0]">Ready to Transform Your Invoice Processing?</h2>
          <p className="text-base mb-8 text-[#7A7D8C] max-w-[480px] mx-auto leading-relaxed">
            Join leading companies using AgenticAI for instant, secure invoice verification.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/app/studio">
              <Button size="lg" style={{ background: "#B5C45A", color: "#0E0F13", borderRadius: 4, fontWeight: 600, border: "none", height: 44, padding: "0 24px", fontSize: 14 }}
                className="hover:opacity-90 transition-opacity duration-150">
                <Bot className="h-4 w-4 mr-2" />
                Start Free Trial
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" style={{ borderRadius: 4, height: 44, padding: "0 24px", fontSize: 14, background: "transparent", borderColor: "#2A2D3A", color: "#F5F4F0" }}
                className="hover:border-[#B5C45A] hover:text-[#B5C45A] transition-colors duration-150">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
