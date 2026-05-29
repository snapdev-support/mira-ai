import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { getProof } from "@/services/proofApi";
import type { ProofResponse, Verdict } from "@/types/backend";
import {
  ArrowLeft, CheckCircle, Clock, Copy, ExternalLink,
  HelpCircle, RefreshCw, ShieldAlert, XCircle,
  ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";

/* ── Verdict config using Phase 9 signal colors ── */
function verdictConfig(verdict: Verdict) {
  switch (verdict) {
    case "VALID":
      return {
        icon:        CheckCircle,
        color:       "#4CAF7D",
        bg:          "rgba(76,175,125,0.08)",
        borderLeft:  "3px solid #4CAF7D",
        badgeBg:     "rgba(76,175,125,0.12)",
        badgeColor:  "#4CAF7D",
      };
    case "EXPIRED":
      return {
        icon:        Clock,
        color:       "#E6A817",
        bg:          "rgba(230,168,23,0.08)",
        borderLeft:  "3px solid #E6A817",
        badgeBg:     "rgba(230,168,23,0.12)",
        badgeColor:  "#E6A817",
      };
    case "REVOKED":
      return {
        icon:        XCircle,
        color:       "#D95050",
        bg:          "rgba(217,80,80,0.08)",
        borderLeft:  "3px solid #D95050",
        badgeBg:     "rgba(217,80,80,0.12)",
        badgeColor:  "#D95050",
      };
    default:
      return {
        icon:        ShieldAlert,
        color:       "var(--color-muted)",
        bg:          "rgba(122,125,140,0.08)",
        borderLeft:  "3px solid var(--color-muted)",
        badgeBg:     "rgba(122,125,140,0.12)",
        badgeColor:  "var(--color-muted)",
      };
  }
}

export default function Proof() {
  const { toast } = useToast();
  const { jti } = useParams();
  const [searchParams] = useSearchParams();

  const checksum = searchParams.get("h") ?? "";
  const [isLoading, setIsLoading]   = useState(false);
  const [proof, setProof]           = useState<ProofResponse | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen]     = useState(false);
  const [claimOpen, setClaimOpen]         = useState(true);
  const [telemetryOpen, setTelemetryOpen] = useState(false);

  const canLoad = useMemo(() => !!jti && !!checksum, [jti, checksum]);

  const load = useCallback(async () => {
    if (!jti) return;
    if (!checksum) { setError("Missing checksum (h). This proof link is incomplete."); return; }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProof(jti, checksum);
      setProof(data);
    } catch (e) {
      console.error(e);
      setProof(null);
      setError("Proof not found or invalid.");
    } finally {
      setIsLoading(false);
    }
  }, [jti, checksum]);

  useEffect(() => { if (canLoad) void load(); }, [canLoad, load]);

  const copy = useCallback((label: string, value: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  }, [toast]);

  const proofUrl = useMemo(() => {
    if (!jti || !checksum) return "";
    const u = new URL(window.location.href);
    u.pathname = `/proof/${jti}`;
    u.search = new URLSearchParams({ h: checksum }).toString();
    return u.toString();
  }, [jti, checksum]);

  const crlUrl = useMemo(() => {
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/+$/, "");
    return `${apiBase.replace(/\/api\/v1$/, "")}/.well-known/mira/crl`;
  }, []);

  /* ── Shared panel style ── */
  const panel = { background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 };
  const collapseTrigger = "w-full flex justify-between items-center p-4 h-auto text-muted-foreground hover:text-foreground transition-colors duration-150";
  const labelCaps = { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--color-muted)" };

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", height: 56 }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link to="/verify" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150">
            <ArrowLeft className="h-4 w-4" />
            Back to Verify
          </Link>

          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div className="h-4 w-px bg-border hidden sm:block" />
            <span className="label-caps text-muted-foreground hidden sm:block">Proof Validator</span>
          </div>

          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 space-y-5">

        {/* Invalid link */}
        {!canLoad && (
          <div className="border p-8 text-center" style={panel}>
            <HelpCircle className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--color-muted)" }} />
            <div className="text-lg font-semibold text-foreground mb-2">Invalid Proof Link</div>
            <div className="text-sm text-muted-foreground max-w-md mx-auto">
              This page requires a valid proof identifier (<code className="font-mono">jti</code>) and checksum (<code className="font-mono">h</code>) to verify the authenticity of the claim.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="border-l-[3px] p-6" style={{ background: "rgba(217,80,80,0.08)", borderLeftColor: "#D95050", borderRadius: "0 3px 3px 0" }}>
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-[#D95050] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-base font-semibold text-foreground mb-3">{error}</div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" style={{ borderColor: "var(--color-border)", color: "var(--color-text)", background: "transparent", borderRadius: 4 }}
                    className="gap-2 hover:border-[#B5C45A] transition-colors duration-150" onClick={load}>
                    <RefreshCw className="h-3.5 w-3.5" /> Try Again
                  </Button>
                  <Button variant="outline" size="sm" style={{ borderColor: "var(--color-border)", color: "var(--color-text)", background: "transparent", borderRadius: 4 }}
                    className="gap-2 hover:border-[#B5C45A] transition-colors duration-150" asChild>
                    <a href={crlUrl} target="_blank" rel="noreferrer">
                      View CRL <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="border p-12 flex flex-col items-center gap-4" style={panel}>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">Verifying cryptographic proof...</div>
          </div>
        )}

        {/* Proof */}
        {proof && (() => {
          const v = proof.verify.verdict;
          const cfg = verdictConfig(v);
          const Icon = cfg.icon;

          return (
            <>
              {/* Verdict Card — Phase 9 styling */}
              <div className="border overflow-hidden" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderTop: cfg.borderLeft, borderRadius: 3 }}>
                <div className="p-6 sm:p-8 space-y-6">
                  {/* Verdict header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <Icon className="h-8 w-8 flex-shrink-0" style={{ color: cfg.color }} />
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-2xl font-bold" style={{ color: cfg.color }}>{proof.verify.verdict}</span>
                          <span className="text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 font-mono"
                            style={{ background: cfg.badgeBg, color: cfg.badgeColor, borderRadius: 2 }}>
                            {proof.verify.reason_code}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {new Date(proof.verify.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" style={{ borderColor: "var(--color-border)", color: "var(--color-text)", background: "transparent", borderRadius: 4 }}
                        className="gap-2 hover:border-[#B5C45A] transition-colors duration-150" onClick={() => copy("Proof URL", proofUrl)}>
                        <Copy className="h-3.5 w-3.5" /> Copy Link
                      </Button>
                      <Button variant="outline" size="sm" style={{ borderColor: "var(--color-border)", color: "var(--color-text)", background: "transparent", borderRadius: 4 }}
                        className="gap-2 hover:border-[#B5C45A] transition-colors duration-150" asChild>
                        <a href={crlUrl} target="_blank" rel="noreferrer">
                          CRL <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* Explanation — verdict detail row */}
                  <div className="p-4 border-l-[3px]" style={{ background: cfg.bg, borderLeftColor: cfg.color, borderRadius: "0 3px 3px 0" }}>
                    <div className="text-base font-medium text-foreground mb-1">{proof.verify.explanation[0]}</div>
                    {/* Rationale in serif per Phase 9 spec */}
                    <div className="text-sm text-foreground leading-relaxed" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}>
                      {proof.verify.explanation[1]}
                    </div>
                  </div>

                  {proof.revocation?.reason && (
                    <div className="p-4 border-l-[3px]" style={{ background: "rgba(217,80,80,0.08)", borderLeftColor: "#D95050", borderRadius: "0 3px 3px 0" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="h-4 w-4 text-[#D95050]" />
                        <span className="text-xs font-bold tracking-[0.08em] uppercase text-[#D95050]">Revocation Details</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="text-muted-foreground">Reason:</span> {proof.revocation.reason}
                        {proof.revocation.ts && <><br /><span className="text-muted-foreground">Time:</span> {new Date(proof.revocation.ts).toLocaleString()}</>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Claim details */}
              <Collapsible open={claimOpen} onOpenChange={setClaimOpen} className="space-y-1">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className={collapseTrigger} style={{ border: "1px solid var(--color-border)", borderRadius: 3 }}>
                    <span className="text-sm font-semibold">Claim Details</span>
                    {claimOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border p-6 sm:p-8 space-y-5" style={panel}>
                    {(() => {
                      const subj = proof.claim.subject ?? {};
                      const rawType = (subj as Record<string, unknown>)["type"];
                      const rawId   = (subj as Record<string, unknown>)["id"];
                      const subjectType = typeof rawType === "string" ? rawType : "—";
                      const subjectId   = typeof rawId   === "string" ? rawId   : "—";

                      return (
                        <div className="grid sm:grid-cols-2 gap-5">
                          {[
                            { label: "JTI",      value: proof.claim.jti,    mono: true },
                            { label: "Template", value: String(proof.claim.template ?? "—"), mono: false },
                            { label: "Status",   value: proof.claim.status,  mono: false, dot: proof.claim.status === "active" ? "#4CAF7D" : "var(--color-muted)" },
                            { label: "Subject",  value: `${subjectType} / ${subjectId}`, mono: false },
                            { label: "Issued at", value: proof.claim.iat ? new Date(proof.claim.iat).toLocaleString() : "—", mono: false },
                            { label: "Expires",   value: proof.claim.exp ? new Date(proof.claim.exp).toLocaleString() : "—", mono: false },
                          ].map((row) => (
                            <div key={row.label} className="space-y-1">
                              <div style={labelCaps}>{row.label}</div>
                              <div className="flex items-center gap-2">
                                {row.dot && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: row.dot }} />}
                                <div className={`text-sm text-foreground break-all px-2 py-1 ${row.mono ? "font-mono text-xs" : ""}`}
                                  style={{ background: "var(--color-bg)", borderRadius: 2 }}>
                                  {row.value}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {proof.claim.qr_payload && (
                      <div className="space-y-2 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
                        <div className="flex items-center justify-between">
                          <div style={labelCaps}>QR Payload</div>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => copy("QR Payload", String(proof.claim.qr_payload))}>
                            <Copy className="h-3 w-3 mr-1" /> Copy
                          </Button>
                        </div>
                        <div className="p-3 font-mono text-xs break-all text-muted-foreground" style={{ background: "var(--color-bg)", borderRadius: 2 }}>
                          {proof.claim.qr_payload}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
                      <div className="flex items-center justify-between">
                        <div style={labelCaps}>Facts</div>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => copy("Facts JSON", JSON.stringify(proof.claim.facts ?? {}, null, 2))}>
                          <Copy className="h-3 w-3 mr-1" /> Copy
                        </Button>
                      </div>
                      <pre className="p-3 text-xs text-muted-foreground overflow-x-auto custom-scrollbar" style={{ background: "var(--color-bg)", borderRadius: 2, fontFamily: "inherit" }}>
                        {JSON.stringify(proof.claim.facts ?? {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Telemetry */}
              <Collapsible open={telemetryOpen} onOpenChange={setTelemetryOpen} className="space-y-1">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className={collapseTrigger} style={{ border: "1px solid var(--color-border)", borderRadius: 3 }}>
                    <span className="text-sm font-semibold">Scan Telemetry</span>
                    {telemetryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border p-6 sm:p-8" style={panel}>
                    <div className="grid sm:grid-cols-3 gap-5">
                      {[
                        { label: "Total Scans",   value: String(proof.scan_stats?.scan_count ?? 0) },
                        { label: "Last Scan",     value: proof.scan_stats?.last_scan_ts ? new Date(proof.scan_stats.last_scan_ts).toLocaleString() : "—" },
                        { label: "Last Latency",  value: typeof proof.scan_stats?.last_latency_ms === "number" ? `${proof.scan_stats.last_latency_ms}ms` : "—", mono: true },
                      ].map((stat) => (
                        <div key={stat.label} className="p-4 text-center" style={{ background: "var(--color-bg)", borderRadius: 2 }}>
                          <div style={labelCaps} className="mb-2">{stat.label}</div>
                          <div className={`text-xl font-bold text-foreground ${stat.mono ? "font-mono" : ""}`}>{stat.value}</div>
                        </div>
                      ))}
                    </div>
                    {proof.scan_stats?.last_verdict && (
                      <div className="text-xs text-muted-foreground text-center pt-4">
                        Last verdict: <span className="text-foreground font-medium">{proof.scan_stats.last_verdict}</span>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Raw JSON */}
              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="space-y-1">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className={collapseTrigger} style={{ border: "1px solid var(--color-border)", borderRadius: 3 }}>
                    <span className="text-sm font-semibold">Raw Data</span>
                    {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border p-5 space-y-3" style={panel}>
                    <div className="flex items-center justify-between">
                      <div style={labelCaps}>Proof Response</div>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => copy("Proof JSON", JSON.stringify(proof, null, 2))}>
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                    <pre className="p-3 text-xs text-muted-foreground overflow-x-auto custom-scrollbar" style={{ background: "var(--color-bg)", borderRadius: 2 }}>
                      {JSON.stringify(proof, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          );
        })()}
      </main>
    </div>
  );
}
