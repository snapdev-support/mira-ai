import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Code, Play, Copy, Download, QrCode, Zap, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";

interface EndpointConfig {
  method: string;
  path: string;
  description: string;
  example: Record<string, unknown>;
}

interface PlaygroundResponse {
  qrData?: string;
  [key: string]: unknown;
}

const Playground = () => {
  const { toast } = useToast();
  const [selectedEndpoint, setSelectedEndpoint] = useState("sign");
  const [requestBody, setRequestBody] = useState("");
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const endpoints: Record<string, EndpointConfig> = {
    sign: {
      method: "POST",
      path: "/api/v1/claims/sign",
      description: "Create a cryptographically signed claim",
      example: {
        type: "invoice",
        issuer: "ACME Corp",
        data: {
          invoiceNumber: "INV-2024-001",
          amount: 4200,
          currency: "USD",
          dueDate: "2025-10-10"
        },
        expiry: "2025-10-10T23:59:59Z"
      }
    },
    verify: {
      method: "POST",
      path: "/api/v1/claims/verify",
      description: "Verify a signed claim and get human-readable verdict",
      example: {
        token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9...",
        context: "scan"
      }
    },
    revoke: {
      method: "POST",
      path: "/api/v1/claims/revoke",
      description: "Revoke a previously issued claim",
      example: {
        claimId: "claim_abc123",
        reason: "Invoice cancelled"
      }
    },
    batch: {
      method: "POST",
      path: "/api/v1/claims/batch",
      description: "Create multiple signed claims in one request",
      example: {
        claims: [
          {
            type: "batch",
            issuer: "ACME Manufacturing",
            data: {
              batchNumber: "B2024001",
              product: "Widget Pro",
              mfgDate: "2024-09-01"
            }
          }
        ]
      }
    }
  };

  const mockResponses: Record<string, PlaygroundResponse> = {
    sign: {
      success: true,
      claimId: "claim_abc123",
      token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.eyJpc3MiOiJBQ01FIENvcnAiLCJzdWIiOiJjbGFpbV9hYmMxMjMiLCJpYXQiOjE2OTQ1MjQ4MDAsImV4cCI6MTY5NzExNjgwMCwiZGF0YSI6eyJpbnZvaWNlTnVtYmVyIjoiSU5WLTIwMjQtMDAxIiwiYW1vdW50Ijo0MjAwLCJjdXJyZW5jeSI6IlVTRCIsImR1ZURhdGUiOiIyMDI1LTEwLTEwIn19.signature_here",
      qrData: "mira://verify/claim_abc123",
      signature: "ed25519:8c9f2a1b3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
      hash: "sha256:7d4e1f8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9",
      timestamp: "2025-09-12T14:30:00Z"
    },
    verify: {
      valid: true,
      status: "valid",
      verdict: "Valid — Issued by ACME Corp on Sep 10 for $4,200",
      explanation: "Invoice verified successfully. All signatures valid.",
      issuer: {
        name: "ACME Corp",
        verified: true
      },
      verifyTime: 0.8,
      proof: {
        signature: "ed25519:8c9f2a1b...",
        hash: "sha256:7d4e1f8a...",
        timestamp: "2025-09-10T14:30:00Z"
      }
    },
    revoke: {
      success: true,
      claimId: "claim_abc123",
      revoked: true,
      propagationTime: 42,
      timestamp: "2025-09-12T14:35:00Z"
    },
    batch: {
      success: true,
      created: 1,
      claims: [
        {
          claimId: "claim_def456",
          token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9...",
          qrData: "mira://verify/claim_def456"
        }
      ]
    }
  };

  const handleSendRequest = async () => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setResponse(mockResponses[selectedEndpoint]);
      setIsLoading(false);
      toast({
        title: "Request sent",
        description: `${endpoints[selectedEndpoint].method} ${endpoints[selectedEndpoint].path}`,
      });
    }, 1000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Code snippet copied successfully",
    });
  };

  const generateCurlCommand = () => {
    const endpoint = endpoints[selectedEndpoint];
    const body = requestBody || JSON.stringify(endpoint.example, null, 2);

    return `curl -X ${endpoint.method} \\
  https://api.miratrust.ai${endpoint.path} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${body.replace(/\n/g, '\\n').replace(/'/g, "\\'")}'`;
  };

  const generateSDKSnippet = (language: string) => {
    const endpoint = endpoints[selectedEndpoint];
    const data = requestBody ? JSON.parse(requestBody) : endpoint.example;

    switch (language) {
      case "javascript":
        return `import { MiraClient } from '@mira-ai/sdk';

const mira = new MiraClient('YOUR_API_KEY');

const result = await mira.claims.${selectedEndpoint}(${JSON.stringify(data, null, 2)});
console.log(result);`;

      case "python":
        return `from mira import MiraClient

mira = MiraClient('YOUR_API_KEY')

result = mira.claims.${selectedEndpoint}(${JSON.stringify(data, null, 2).replace(/"/g, "'")})
print(result)`;

      case "go":
        return `package main

import (
    "fmt"
    "github.com/mira-ai/go-sdk"
)

func main() {
    client := mira.NewClient("YOUR_API_KEY")

    result, err := client.Claims.${selectedEndpoint.charAt(0).toUpperCase() + selectedEndpoint.slice(1)}(context.Background(), &mira.${selectedEndpoint.charAt(0).toUpperCase() + selectedEndpoint.slice(1)}Request{
        // Add your data here
    })

    if err != nil {
        panic(err)
    }

    fmt.Println(result)
}`;

      default:
        return generateCurlCommand();
    }
  };

  return (
    <div className="min-h-screen text-foreground" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-50" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Back</span>
              </Link>
              <div className="h-4 w-px bg-white/10 hidden sm:block" />
              <Logo size="sm" />
              <Badge variant="outline" className="text-primary text-[10px] px-2 py-0 h-5" style={{ background: "rgba(181,196,90,0.06)", borderColor: "rgba(181,196,90,0.2)", borderRadius: 3 }}>
                PLAYGROUND
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center space-x-2 text-xs text-muted-foreground mr-2">
                <span className="flex items-center"><div className="w-1.5 h-1.5 mr-2" style={{ background: "#4CAF7D", borderRadius: 1 }}></div> System Operational</span>
              </div>
              <Link to="/docs">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.02)] h-8">
                  Documentation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-12 gap-8 h-[calc(100vh-12rem)]">

          {/* Left Panel - Endpoint Selector */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="border-border h-full">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Endpoints
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1">
                {Object.entries(endpoints).map(([key, endpoint]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedEndpoint(key);
                      setRequestBody(JSON.stringify(endpoint.example, null, 2));
                      setResponse(null);
                    }}
                    className={`w-full text-left p-3 transition-all duration-150 group ${
                      selectedEndpoint === key
                        ? 'bg-[rgba(181,196,90,0.08)] border border-[rgba(181,196,90,0.2)]'
                        : 'hover:bg-white/[0.02] border border-transparent'
                    }`} style={{ borderRadius: 3 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                        endpoint.method === 'POST' ? 'bg-[rgba(181,196,90,0.08)] text-primary' : 'bg-[rgba(76,175,125,0.08)] text-[#4CAF7D]'
                      }`}>
                        {endpoint.method}
                      </span>
                      {selectedEndpoint === key && <div className="w-1.5 h-1.5 bg-[#B5C45A]" style={{ borderRadius: 1 }} />}
                    </div>
                    <p className={`font-medium text-sm ${selectedEndpoint === key ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                      {endpoint.path.replace('/api/v1', '')}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - Request/Response */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <Card className="border-border flex-1 flex flex-col overflow-hidden">
              <CardHeader className="border-b border-border py-3 px-4 bg-[rgba(255,255,255,0.02)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-primary font-mono" style={{ background: "rgba(181,196,90,0.08)", borderColor: "rgba(181,196,90,0.2)", borderRadius: 3 }}>
                      {endpoints[selectedEndpoint].method}
                    </Badge>
                    <span className="font-mono text-sm text-muted-foreground">{endpoints[selectedEndpoint].path}</span>
                  </div>
                  <Button
                    onClick={handleSendRequest}
                    disabled={isLoading}
                    size="sm"
                    className="text-[var(--color-accent-fg)] font-semibold hover:opacity-90"
                    style={{ background: "var(--color-accent)", borderRadius: 4, border: "none" }}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin h-3 w-3 border-2 border-[var(--color-accent-fg)] border-t-transparent mr-2" style={{ borderRadius: "50%" }}></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-2 fill-current" />
                        Send Request
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>

              <div className="flex-1 flex flex-col min-h-0">
                {/* Request Body */}
                <div className="flex-1 border-b border-border flex flex-col min-h-0">
                  <div className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border-b border-border flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Request Body</span>
                    <span className="text-xs text-muted-foreground">JSON</span>
                  </div>
                  <Textarea
                    value={requestBody || JSON.stringify(endpoints[selectedEndpoint].example, null, 2)}
                    onChange={(e) => setRequestBody(e.target.value)}
                    className="flex-1 font-mono text-sm bg-transparent border-0 resize-none focus-visible:ring-0 p-4 text-foreground placeholder:text-muted-foreground"
                    spellCheck={false}
                  />
                </div>

                {/* Response Body */}
                <div className="flex-1 flex flex-col min-h-0" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div className="px-4 py-2 border-b border-border flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Response</span>
                    {response && (
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" className="text-[#4CAF7D] text-[10px] h-5" style={{ background: "rgba(76,175,125,0.08)", borderColor: "rgba(76,175,125,0.25)", borderRadius: 3 }}>
                          200 OK
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Zap className="h-3 w-3 mr-1 text-[#E6A817]" />
                          {Math.floor(Math.random() * 100 + 50)}ms
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    {response ? (
                      <pre className="font-mono text-sm text-[#4CAF7D]">
                        {JSON.stringify(response, null, 2)}
                      </pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <Code className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-sm">Ready to send request</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Panel - Tools & Snippets */}
          <div className="lg:col-span-4 space-y-6">
            {/* QR Preview */}
            {response && response.qrData && (
              <Card className="border-border animate-fade-in">
                <CardHeader className="pb-2">
                  <CardTitle className="text-foreground text-sm flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />
                    Generated QR Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center pt-4">
                  <div className="p-4 inline-block mb-4 border border-border" style={{ background: "var(--color-text)", borderRadius: 3 }}>
                    <QrCode className="h-32 w-32 text-black" />
                  </div>
                  <div className="p-3 mb-4 border border-border" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                    <p className="text-xs text-muted-foreground font-mono break-all line-clamp-2">
                      {response.qrData}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" size="sm" className="border-white/20 hover:bg-white/10 text-foreground bg-transparent">
                      <Download className="h-3 w-3 mr-2" />
                      Save
                    </Button>
                    <Link to="/verify">
                      <Button size="sm" className="w-full text-[var(--color-accent-fg)] font-semibold hover:opacity-90" style={{ background: "var(--color-accent)", borderRadius: 4, border: "none" }}>
                        Test Scan
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Code Snippets */}
            <Card className="border-border h-[400px] flex flex-col">
              <CardHeader className="border-b border-border pb-0">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-foreground text-sm flex items-center gap-2">
                    <Code className="h-4 w-4 text-primary" />
                    Integration Code
                  </CardTitle>
                </div>
                <Tabs defaultValue="curl" className="w-full">
                  <TabsList className="w-full border-b border-border rounded-none p-0 h-auto" style={{ background: "rgba(255,255,255,0.02)" }}>
                    {['curl', 'javascript', 'python', 'go'].map((lang) => (
                      <TabsTrigger
                        key={lang}
                        value={lang}
                        className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-[#B5C45A] data-[state=active]:bg-transparent data-[state=active]:text-primary text-xs py-2 capitalize text-muted-foreground"
                      >
                        {lang}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <div className="relative flex-1 bg-black/50">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground z-10"
                      onClick={() => copyToClipboard(generateCurlCommand())}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>

                    {['curl', 'javascript', 'python', 'go'].map((lang) => (
                      <TabsContent key={lang} value={lang} className="m-0 h-[300px]">
                        <pre className="p-4 text-xs font-mono text-foreground/80 overflow-auto h-full custom-scrollbar">
                          {lang === 'curl' ? generateCurlCommand() : generateSDKSnippet(lang)}
                        </pre>
                      </TabsContent>
                    ))}
                  </div>
                </Tabs>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Playground;
