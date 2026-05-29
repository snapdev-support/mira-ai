import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, Shield, Clock, Key, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProofViewerProps {
  proof?: unknown;
  onClose: () => void;
}

export const ProofViewer = ({ onClose }: ProofViewerProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard", description: `${label} copied successfully` });
  };

  const mockProofData = {
    claimId: "claim_abc123def456",
    signature: "ed25519:8c9f2a1b3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
    publicKey: "ed25519:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    contentHash: "sha256:7d4e1f8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9",
    timestamp: "2025-09-12T14:30:00.000Z",
    expiry: "2025-10-12T23:59:59.000Z",
    issuer: { name: "ACME Corp", keyId: "key_acme_2024_001", verified: true, trustLevel: "Enterprise" },
    chainOfTrust: [
      { level: "Root CA", issuer: "MiraTrust Root Certificate Authority", validFrom: "2024-01-01T00:00:00.000Z", validTo: "2034-01-01T00:00:00.000Z", status: "valid" },
      { level: "Intermediate CA", issuer: "MiraTrust Enterprise CA", validFrom: "2024-01-01T00:00:00.000Z", validTo: "2029-01-01T00:00:00.000Z", status: "valid" },
      { level: "End Entity", issuer: "ACME Corp", validFrom: "2024-09-01T00:00:00.000Z", validTo: "2025-09-01T00:00:00.000Z", status: "valid" }
    ],
    verificationSteps: [
      { step: "Signature Verification", status: "passed", time: "0.12s" },
      { step: "Certificate Chain Validation", status: "passed", time: "0.08s" },
      { step: "Expiry Check", status: "passed", time: "0.01s" },
      { step: "Revocation Status", status: "passed", time: "0.15s" },
      { step: "Content Integrity", status: "passed", time: "0.03s" }
    ],
    metadata: {
      algorithm: "Ed25519", hashFunction: "SHA-256", keySize: "256 bits",
      created: "2025-09-12T14:30:00.000Z", lastVerified: new Date().toISOString(), verificationCount: 47
    }
  };

  const cardStyle = { background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 };
  const monoBoxStyle = { background: "var(--color-bg)", borderColor: "var(--color-border)", borderRadius: 3 };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden border" style={cardStyle}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Cryptographic Proof Details</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[#4CAF7D] text-xs"
              style={{ background: "rgba(76,175,125,0.08)", borderColor: "rgba(76,175,125,0.25)", borderRadius: 3 }}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Verified
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</Button>
          </div>
        </div>

        <div className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-4 m-4 mb-0 rounded-none border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "var(--color-border)" }}>
              {["overview", "signature", "chain", "raw"].map(tab => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground capitalize"
                >
                  {tab === "raw" ? "Raw Data" : tab === "chain" ? "Trust Chain" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              <TabsContent value="overview" className="p-6 space-y-6">
                {/* Verified status */}
                <div className="p-4 border" style={{ background: "rgba(76,175,125,0.06)", borderColor: "rgba(76,175,125,0.2)", borderRadius: 3 }}>
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="h-7 w-7 text-[#4CAF7D]" />
                    <div>
                      <h3 className="font-semibold text-[#4CAF7D]">Proof Verified Successfully</h3>
                      <p className="text-sm" style={{ color: "rgba(76,175,125,0.7)" }}>All cryptographic checks passed</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {mockProofData.verificationSteps.map((step, idx) => (
                      <div key={idx} className="text-center">
                        <CheckCircle className="h-5 w-5 text-[#4CAF7D] mx-auto mb-1" />
                        <p className="text-xs font-medium text-[#4CAF7D]">{step.step}</p>
                        <p className="text-xs" style={{ color: "rgba(76,175,125,0.6)" }}>{step.time}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="border p-5 space-y-3" style={cardStyle}>
                    <div className="flex items-center gap-2 mb-1">
                      <Key className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">Issuer Information</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Organization</p>
                      <p className="font-semibold text-foreground">{mockProofData.issuer.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Trust Level</p>
                      <Badge variant="outline" className="text-primary text-xs" style={{ background: "rgba(181,196,90,0.08)", borderColor: "rgba(181,196,90,0.2)", borderRadius: 3 }}>
                        {mockProofData.issuer.trustLevel}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Key ID</p>
                      <p className="font-mono text-sm text-foreground">{mockProofData.issuer.keyId}</p>
                    </div>
                  </div>

                  <div className="border p-5 space-y-3" style={cardStyle}>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">Temporal Information</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                      <p className="font-semibold text-foreground">{new Date(mockProofData.timestamp).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Expires</p>
                      <p className="font-semibold text-foreground">{new Date(mockProofData.expiry).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Verification Count</p>
                      <p className="font-semibold text-foreground">{mockProofData.metadata.verificationCount} times</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="signature" className="p-6 space-y-4">
                {[
                  { label: "Digital Signature", value: mockProofData.signature, copyLabel: "Signature" },
                  { label: "Public Key", value: mockProofData.publicKey, copyLabel: "Public Key" },
                  { label: "Content Hash", value: mockProofData.contentHash, copyLabel: "Content Hash" },
                ].map(({ label, value, copyLabel }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-foreground">{label}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        style={{ borderColor: "var(--color-border)", borderRadius: 4 }}
                        onClick={() => copyToClipboard(value, copyLabel)}
                      >
                        <Copy className="h-3 w-3 mr-1" />Copy
                      </Button>
                    </div>
                    <div className="border p-3" style={monoBoxStyle}>
                      <p className="font-mono text-xs break-all text-muted-foreground">{value}</p>
                    </div>
                  </div>
                ))}

                <div className="border p-4" style={{ background: "rgba(181,196,90,0.05)", borderColor: "rgba(181,196,90,0.15)", borderRadius: 3 }}>
                  <h4 className="font-medium text-primary mb-3">Cryptographic Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { k: "Algorithm", v: mockProofData.metadata.algorithm },
                      { k: "Hash Function", v: mockProofData.metadata.hashFunction },
                      { k: "Key Size", v: mockProofData.metadata.keySize },
                      { k: "Security Level", v: "128-bit equivalent" },
                    ].map(({ k, v }) => (
                      <div key={k}>
                        <p className="text-muted-foreground">{k}</p>
                        <p className="font-semibold text-foreground">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="chain" className="p-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-foreground">Certificate Chain of Trust</h3>
                  {mockProofData.chainOfTrust.map((cert, idx) => (
                    <div key={idx} className="border p-4" style={cardStyle}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 border" style={{ background: "rgba(76,175,125,0.08)", borderColor: "rgba(76,175,125,0.2)", borderRadius: 3 }}>
                            <Shield className="h-4 w-4 text-[#4CAF7D]" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{cert.level}</p>
                            <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[#4CAF7D] text-xs" style={{ background: "rgba(76,175,125,0.08)", borderColor: "rgba(76,175,125,0.25)", borderRadius: 3 }}>
                          <CheckCircle className="h-3 w-3 mr-1" />{cert.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Valid From</p>
                          <p className="font-medium text-foreground">{new Date(cert.validFrom).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valid To</p>
                          <p className="font-medium text-foreground">{new Date(cert.validTo).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="raw" className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg text-foreground">Raw Proof Data</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        style={{ borderColor: "var(--color-border)", borderRadius: 4 }}
                        onClick={() => copyToClipboard(JSON.stringify(mockProofData, null, 2), "Raw proof data")}
                      >
                        <Copy className="h-3 w-3 mr-1" />Copy JSON
                      </Button>
                      <Button variant="outline" size="sm" className="text-muted-foreground hover:text-foreground" style={{ borderColor: "var(--color-border)", borderRadius: 4 }}>
                        <Download className="h-3 w-3 mr-1" />Export
                      </Button>
                    </div>
                  </div>
                  <div className="border p-4 overflow-auto max-h-96" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                    <pre className="text-xs font-mono text-[#4CAF7D]">
                      {JSON.stringify(mockProofData, null, 2)}
                    </pre>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ProofViewer;
