import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Package, RotateCcw, Award, Play, CheckCircle } from "lucide-react";

interface Scenario {
  id: string;
  title: string;
  type: string;
  icon: React.ElementType;
  description: string;
  story: string;
  data: Record<string, unknown>;
  expectedVerdict: string;
  businessImpact: string;
}

interface DemoScenariosProps {
  onSelectScenario: (scenario: Scenario) => void;
}

export const DemoScenarios = ({ onSelectScenario }: DemoScenariosProps) => {
  const scenarios: Scenario[] = [
    {
      id: "acme-invoice",
      title: "ACME Corp Invoice Verification",
      type: "invoice",
      icon: FileText,
      description: "B2B invoice processing with automatic AP approval",
      story: "ACME Corp sends invoice to TechStart Inc. CFO needs instant verification before approval.",
      data: { invoiceNumber: "INV-2024-001", issuer: "ACME Corp", amount: 4200, currency: "USD", dueDate: "2025-10-10", description: "Professional consulting services Q3 2024" },
      expectedVerdict: "Valid — Issued by ACME Corp on Sep 10 for $4,200",
      businessImpact: "Reduces AP processing time from 3 days to 30 seconds"
    },
    {
      id: "pharma-batch",
      title: "Pharmaceutical Batch Tracking",
      type: "batch",
      icon: Package,
      description: "Drug authenticity verification at pharmacy",
      story: "Patient brings prescription. Pharmacist scans batch code to verify authenticity and expiry.",
      data: { batchNumber: "PH2024-0892", product: "Amoxicillin 500mg", manufacturer: "PharmaCorp Ltd", mfgDate: "2024-08-15", expiryDate: "2026-08-15", origin: "FDA-approved facility, New Jersey" },
      expectedVerdict: "Genuine — Batch #PH2024-0892, expires Aug 2026; FDA certified",
      businessImpact: "Prevents counterfeit drugs, ensures patient safety"
    },
    {
      id: "ecommerce-return",
      title: "E-commerce Return SLA",
      type: "return",
      icon: RotateCcw,
      description: "Automated refund processing with milestone tracking",
      story: "Customer returns defective laptop. System tracks return journey and automates refund.",
      data: { returnId: "RET-2024-5678", issuer: "TechMart Marketplace", slaHours: 72, refundAmount: 1299.99, conditions: "Item must be in original packaging, undamaged" },
      expectedVerdict: "Active — Return window open, refund due by Sep 15",
      businessImpact: "Reduces customer service tickets by 60%, improves satisfaction"
    },
    {
      id: "quality-cert",
      title: "ISO Quality Certificate",
      type: "approval",
      icon: Award,
      description: "Manufacturing quality compliance verification",
      story: "Supplier claims ISO 9001 certification. Buyer instantly verifies authenticity and validity.",
      data: { documentTitle: "ISO 9001:2015 Quality Management Certificate", approver: "Jane Smith", approverTitle: "Lead Quality Auditor", version: "v3.2", validUntil: "2025-12-31" },
      expectedVerdict: "Valid — Certified by Jane Smith on Aug 20, expires Dec 2025",
      businessImpact: "Eliminates fraudulent certifications, ensures compliance"
    }
  ];

  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  const handleSelectScenario = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    onSelectScenario(scenario);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground mb-2">Real Business Scenarios</h3>
        <p className="text-muted-foreground">See how MiraTrust solves actual enterprise problems</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {scenarios.map((scenario) => {
          const IconComponent = scenario.icon;
          const isSelected = selectedScenario?.id === scenario.id;

          return (
            <div
              key={scenario.id}
              className="cursor-pointer transition-colors duration-150 border"
              style={{
                background: isSelected ? "var(--color-bg-light)" : "var(--color-bg-card)",
                borderColor: isSelected ? "rgba(181,196,90,0.4)" : "var(--color-border)",
                borderRadius: 3,
              }}
              onClick={() => handleSelectScenario(scenario)}
            >
              <div className="p-5 border-b" style={{ borderColor: isSelected ? "rgba(181,196,90,0.15)" : "var(--color-border)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 border" style={{ background: isSelected ? "rgba(181,196,90,0.08)" : "rgba(255,255,255,0.03)", borderColor: isSelected ? "rgba(181,196,90,0.2)" : "var(--color-border)", borderRadius: 3 }}>
                      <IconComponent className="h-5 w-5" style={{ color: isSelected ? "var(--color-accent)" : "var(--color-muted)" }} />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-foreground">{scenario.title}</div>
                      <Badge
                        variant="outline"
                        className="text-xs mt-1 text-muted-foreground"
                        style={{ borderColor: "var(--color-border)", background: "transparent", borderRadius: 3 }}
                      >
                        {scenario.type}
                      </Badge>
                    </div>
                  </div>
                  <Play className="h-4 w-4" style={{ color: isSelected ? "var(--color-accent)" : "var(--color-muted)" }} />
                </div>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-muted-foreground text-sm">{scenario.description}</p>
                <div className="border p-3" style={{ background: "rgba(255,255,255,0.02)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                  <p className="text-xs text-muted-foreground italic">"{scenario.story}"</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-[#4CAF7D] shrink-0" />
                    <span className="text-sm text-[#4CAF7D] font-medium">{scenario.expectedVerdict}</span>
                  </div>
                  <p className="text-xs text-primary font-medium pl-6">{scenario.businessImpact}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedScenario && (
        <div className="border p-6" style={{ background: "rgba(76,175,125,0.05)", borderColor: "rgba(76,175,125,0.2)", borderRadius: 3 }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-[#4CAF7D]" />
            <h4 className="font-semibold text-[#4CAF7D]">Scenario Selected</h4>
          </div>
          <p className="text-muted-foreground mb-4">
            Ready to demonstrate: <strong className="text-foreground">{selectedScenario.title}</strong>
          </p>
          <div className="flex gap-3">
            <Button
              className="font-semibold hover:opacity-90"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, border: "none" }}
            >
              Run in Studio
            </Button>
            <Button
              variant="outline"
              className="text-[#4CAF7D] hover:text-foreground"
              style={{ borderColor: "rgba(76,175,125,0.3)", borderRadius: 4 }}
            >
              Test in Verify
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoScenarios;
