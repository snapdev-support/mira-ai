import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { verifyToken } from "@/services/verifyApi";
import type { Verdict, VerifyResponse } from "@/types/backend";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  ExternalLink,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  ShieldAlert,
  XCircle,
  ScanLine,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Code,
  RefreshCw,
  Zap,
  X,
  Copy,
  Check,
  Lock,
  Shield,
  Globe,
  Calendar,
  Search
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from "html5-qrcode";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/auth/AuthContext";
import { checkGuestScan } from "@/services/guestApi";

function ScanGateModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-sm mx-4 p-6 space-y-5" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 3 }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-3" style={{ background: "rgba(230,168,23,0.08)", border: "1px solid rgba(230,168,23,0.3)", borderRadius: 2 }}>
            <Lock className="h-6 w-6" style={{ color: "#E6A817" }} />
          </div>
          <h2 className="text-lg font-bold text-foreground">Free Limit Reached</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You've used your <span className="text-foreground font-medium">3 free scans</span>.
            Create a free account to keep verifying QR codes.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full font-semibold text-sm transition-opacity duration-150"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, border: "none" }}
            onClick={() => navigate("/signup")}
          >
            Create Free Account
          </Button>
          <Button
            variant="outline"
            className="w-full text-sm transition-colors duration-150"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text)", background: "transparent", borderRadius: 4 }}
            onClick={() => navigate("/login")}
          >
            Sign In
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground/30">
          Free accounts include unlimited scans
        </p>
      </div>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function getString(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function getNumber(obj: Record<string, unknown> | null, key: string): number | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function getBoolean(obj: Record<string, unknown> | null, key: string): boolean | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === "boolean" ? v : null;
}

function SafetyItem({ label, value, icon: Icon, status = "neutral" }: { label: string, value: string, icon: React.ElementType, status?: "success" | "warning" | "error" | "neutral" }) {
  const colors = {
    success: "text-[#4CAF7D]",
    warning: "text-[#E6A817]",
    error:   "text-[#D95050]",
    neutral: "text-muted-foreground",
  };

  return (
    <div className="flex items-center gap-3 p-2.5 border transition-colors" style={{ background: "var(--color-bg-light)", borderColor: "var(--color-border)", borderRadius: 3 }}>
      <div className={`p-1.5 ${colors[status]}`} style={{ background: "var(--color-bg)", borderRadius: 2 }}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-muted)" }}>{label}</div>
        <div className={`text-sm font-medium ${colors[status]}`}>{value}</div>
      </div>
    </div>
  );
}

type VerdictConfig = {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  badge: string;
  box: string;
  headline: string;
  tagline: string;
  nextSteps: string[] | null;
};

function verdictConfig(verdict: Verdict): VerdictConfig {
  switch (verdict) {
    case "VALID":
      return {
        icon: CheckCircle,
        color: "text-[#4CAF7D]",
        bg: "bg-[rgba(76,175,125,0.08)]",
        border: "border-[rgba(76,175,125,0.25)]",
        badge: "bg-[rgba(76,175,125,0.12)] text-[#4CAF7D] border-[rgba(76,175,125,0.3)]",
        box: "bg-card border-[rgba(76,175,125,0.15)]",
        headline: "This product is genuine",
        tagline: "The QR code has been verified. This product is authentic and its details match what the manufacturer registered.",
        nextSteps: null,
      };
    case "EXPIRED":
      return {
        icon: Clock,
        color: "text-[#E6A817]",
        bg: "bg-[rgba(230,168,23,0.08)]",
        border: "border-[rgba(230,168,23,0.25)]",
        badge: "bg-[rgba(230,168,23,0.12)] text-[#E6A817] border-[rgba(230,168,23,0.3)]",
        box: "bg-card border-[rgba(230,168,23,0.15)]",
        headline: "This QR code has expired",
        tagline: "The verification period for this product has ended. This may be old stock or the manufacturer has not renewed the certificate.",
        nextSteps: [
          "Ask the seller when this product was manufactured or stocked.",
          "Request an up-to-date product with a valid QR code.",
          "If you already purchased it, contact the seller for clarification.",
        ],
      };
    case "REVOKED":
      return {
        icon: XCircle,
        color: "text-[#D95050]",
        bg: "bg-[rgba(217,80,80,0.08)]",
        border: "border-[rgba(217,80,80,0.25)]",
        badge: "bg-[rgba(217,80,80,0.12)] text-[#D95050] border-[rgba(217,80,80,0.3)]",
        box: "bg-card border-[rgba(217,80,80,0.15)]",
        headline: "This product's verification has been revoked",
        tagline: "The manufacturer or issuer has cancelled this product's verification.",
        nextSteps: [
          "Do not use or purchase this item until you have more information.",
          "Contact the seller and ask why the verification is showing as revoked.",
        ],
      };
    case "UNVERIFIED":
      return {
        icon: ShieldAlert,
        color: "text-muted-foreground",
        bg: "bg-[rgba(122,125,140,0.08)]",
        border: "border-[rgba(122,125,140,0.25)]",
        badge: "bg-[rgba(122,125,140,0.12)] text-muted-foreground border-[rgba(122,125,140,0.3)]",
        box: "bg-card border-[rgba(122,125,140,0.15)]",
        headline: "We couldn't verify this product",
        tagline: "This QR code isn't linked to any product in our system. It could be a counterfeit, an unsupported product, or a code that points to an external website.",
        nextSteps: [
          "Do not open any links from this QR code until you've run a safety check below.",
          "Be cautious — if the price seemed too good to be true, it may be a fake.",
          "Ask the seller for alternative proof of authenticity.",
        ],
      };
    default:
      return {
        icon: HelpCircle,
        color: "text-muted-foreground",
        bg: "bg-[rgba(122,125,140,0.08)]",
        border: "border-[rgba(122,125,140,0.25)]",
        badge: "bg-[rgba(122,125,140,0.12)] text-muted-foreground border-[rgba(122,125,140,0.3)]",
        box: "bg-card border-[rgba(122,125,140,0.15)]",
        headline: "Unknown result",
        tagline: "We received an unexpected response. Please try scanning again.",
        nextSteps: null,
      };
  }
}

export default function Verify() {
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isApp = location.pathname.startsWith("/app/");
  const { status } = useAuth();

  type Mode = "scan" | "upload";

  const [isLoading, setIsLoading] = useState(false);
  const [showScanGate, setShowScanGate] = useState(false);
  const [isSafetyLoading, setIsSafetyLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [isNonMira, setIsNonMira] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const autoSubmittedRef = useRef(false);

  const [mode, setMode] = useState<Mode>("scan");
  const [isScanningEnabled, setIsScanningEnabled] = useState(true);

  const scannerHostId = "mira-verify-scanner";
  const html5Ref = useRef<Html5Qrcode | null>(null);
  const startingRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
  }, []);

  const copyToClipboard = useCallback(() => {
    if (!scannedData) return;
    navigator.clipboard.writeText(scannedData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "Raw data copied to clipboard." });
  }, [scannedData, toast]);

  const resetState = useCallback(() => {
    setResult(null);
    setScannedData(null);
    setIsNonMira(false);
    setIsDetailsOpen(false);
  }, []);

  const doVerify = useCallback(async (t: string, includeSafety: boolean = false) => {
    const trimmed = t.trim();
    if (!trimmed) {
      toast({ title: "Invalid Scan", description: "No data found in QR code." });
      return;
    }

    // 3-try gate: only enforce for new scans (not safety re-checks) and anonymous users
    if (!includeSafety && status !== "authenticated") {
      try {
        const gate = await checkGuestScan();
        if (!gate.allowed) {
          setShowScanGate(true);
          return;
        }
      } catch {
        // If the backend is unreachable, fail open so users aren't blocked unfairly
      }
    }

    setScannedData(trimmed);
    setIsNonMira(false);

    if (!includeSafety) {
      setResult(null);
      setIsLoading(true);
    } else {
      setIsSafetyLoading(true);
    }

    try {
      const data = await verifyToken(trimmed, includeSafety);
      setResult(data);
    } catch (error) {
      console.error("Verification failed", error);
      if (includeSafety) {
        toast({
          title: "Could not load safety details",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      } else {
        setIsNonMira(true);
      }
    } finally {
      setIsLoading(false);
      setIsSafetyLoading(false);
    }
  }, [toast, status]);

  const handleShowSafetyDetails = useCallback(() => {
    if (scannedData) {
      void doVerify(scannedData, true);
    }
  }, [scannedData, doVerify]);

  const stopScanner = useCallback(async () => {
    const instance = html5Ref.current;
    if (!instance) return;
    try {
      const state = instance.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await instance.stop();
      }
      await instance.clear();
    } catch (e) {
      console.warn("Failed to stop scanner", e);
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      // Ensure clean state
      await stopScanner();

      const instance = new Html5Qrcode(scannerHostId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      html5Ref.current = instance;

      await instance.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
          disableFlip: true,
        },
        (decodedText) => {
          // Stop scanning immediately upon success
          void stopScanner();
          void doVerify(decodedText);
        },
        () => {
          // ignore scan errors/noise
        },
      );
    } catch (err) {
      console.error("Camera start error", err);
      toast({
        title: "Camera unavailable",
        description: "Please ensure camera permissions are granted.",
        variant: "destructive",
      });
      setIsScanningEnabled(false);
    } finally {
      startingRef.current = false;
    }
  }, [doVerify, stopScanner, toast]);

  // Handle URL token param
  useEffect(() => {
    const t = searchParams.get("token");
    if (t && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      setIsScanningEnabled(false); // Disable scanner if token provided
      void doVerify(t);
    }
  }, [searchParams, doVerify]);

  // Manage Scanner Lifecycle
  useEffect(() => {
    const hasResult = !!result || isNonMira;
    const shouldScan = mode === "scan" && isScanningEnabled && !hasResult && !isLoading;

    if (shouldScan) {
      void startScanner();
    } else {
      void stopScanner();
    }

    return () => {
      void stopScanner();
    };
  }, [mode, isScanningEnabled, result, isNonMira, isLoading, startScanner, stopScanner]);

  const scanSelectedFile = useCallback(async () => {
    if (!selectedFile) return;
    await stopScanner();
    setIsDecoding(true);
    resetState();

    try {
      if (!html5Ref.current) {
        html5Ref.current = new Html5Qrcode(scannerHostId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
      }
      const decoded = await html5Ref.current.scanFile(selectedFile, true);
      void doVerify(decoded);
    } catch {
      toast({
        title: "Could not read QR",
        description: "Try a clearer image or use camera scan.",
        variant: "destructive",
      });
    } finally {
      setIsDecoding(false);
    }
  }, [doVerify, selectedFile, stopScanner, toast, resetState]);

  const header = (
    <header className="border-b sticky top-0 z-40" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", height: 56 }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <div className="h-4 w-px bg-border hidden sm:block" />
          <span className="label-caps text-muted-foreground hidden sm:block">Verify</span>
        </div>

        <div className="w-16" />
      </div>
    </header>
  );

  const renderResult = () => {
    if (result) {
      const config = verdictConfig(result.verdict);
      const Icon = config.icon;

      const safety = asRecord(result.safety);
      const safetyUrl = getString(safety, "normalized_url") ?? getString(safety, "url");
      const https = getBoolean(safety, "https");
      const certValid = getBoolean(safety, "cert_valid");
      const hsts = getBoolean(safety, "hsts");
      const ct = getString(safety, "ct");
      const domainAgeDays = getNumber(safety, "domain_age_days");
      const domainCategory = getString(safety, "domain_category");
      const safeBrowsing = getString(safety, "safe_browsing");

      // Compute an overall safety verdict once deep check data is available
      const safetyScore = safety
        ? (() => {
            const flags = [
              https === false,
              certValid === false,
              safeBrowsing !== null && safeBrowsing !== "unknown" && safeBrowsing !== "clean",
            ].filter(Boolean).length;
            const warnings = [
              hsts === false,
              domainAgeDays !== null && domainAgeDays < 30,
            ].filter(Boolean).length;
            if (flags > 0) return "danger" as const;
            if (warnings > 0) return "caution" as const;
            return "safe" as const;
          })()
        : null;

      const safetySummary = {
        safe:    { label: "This link appears safe",     color: "text-[#4CAF7D]", bg: "bg-[rgba(76,175,125,0.08)]",  border: "border-[rgba(76,175,125,0.25)]",  icon: CheckCircle },
        caution: { label: "Use caution before opening", color: "text-[#E6A817]", bg: "bg-[rgba(230,168,23,0.08)]",  border: "border-[rgba(230,168,23,0.25)]",  icon: AlertTriangle },
        danger:  { label: "This link looks suspicious", color: "text-[#D95050]", bg: "bg-[rgba(217,80,80,0.08)]",   border: "border-[rgba(217,80,80,0.25)]",   icon: XCircle },
      };

      return (
        <>
        <div className="animate-fade-in">
          <div className={`border ${config.border} ${config.bg} overflow-hidden`} style={{ borderRadius: 3 }}>
            <div className="p-5 sm:p-8 space-y-6">

              {/* ── Verdict Header ── */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4 w-full">
                  <div className={`p-3 ${config.bg} border ${config.border} shrink-0`} style={{ borderRadius: 3 }}>
                    <Icon className={`h-8 w-8 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-xl sm:text-2xl font-bold tracking-tight ${config.color} mb-1`}>
                      {config.headline}
                    </h3>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3 shrink-0" />
                      {new Date(result.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>

                {result.proofUrl && (() => {
                  // Rewrite to current origin so the new tab inherits the user's theme
                  let localProofUrl = result.proofUrl;
                  try {
                    const parsed = new URL(result.proofUrl);
                    localProofUrl = window.location.origin + parsed.pathname + parsed.search;
                  } catch { /* keep original if URL is malformed */ }
                  return (
                    <Button variant="outline" className="border-border hover:bg-muted text-foreground gap-2 w-full sm:w-auto shrink-0" asChild>
                      <a href={localProofUrl} target="_blank" rel="noreferrer">
                        View Proof
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  );
                })()}
              </div>

              {/* ── Plain-English explanation ── */}
              <div className={`space-y-2 p-4 border ${config.box}`} style={{ borderRadius: 3 }}>
                <div className="text-base font-medium text-foreground">{config.tagline}</div>
                {(result.explanation[0] || result.explanation[1]) && (
                  <div className="pt-1 border-t border-border mt-2 space-y-1">
                    {result.explanation[0] && (
                      <div className="text-sm text-muted-foreground leading-relaxed">{result.explanation[0]}</div>
                    )}
                    {result.explanation[1] && (
                      <div className="text-sm text-muted-foreground leading-relaxed">{result.explanation[1]}</div>
                    )}
                  </div>
                )}
              </div>

              {/* ── What to do next (negative/uncertain verdicts) ── */}
              {config.nextSteps && (
                <div className="border border-border p-4 space-y-3" style={{ background: "var(--color-bg-light)", borderRadius: 3 }}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <HelpCircle className="h-4 w-4 shrink-0" />
                    What should you do?
                  </div>
                  <ul className="space-y-2">
                    {config.nextSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <span className={`mt-0.5 shrink-0 h-5 w-5 flex items-center justify-center text-[11px] font-bold ${config.bg} border ${config.border} ${config.color}`} style={{ borderRadius: 3 }}>
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Link Safety Check (UNVERIFIED only) ── */}
              {result.verdict === "UNVERIFIED" && (
                <div className={`overflow-hidden border ${config.border}`} style={{ background: "var(--color-bg-card)", borderRadius: 3 }}>
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 border" style={{ background: "var(--color-bg-light)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                        <Shield className="h-4 w-4 text-foreground/70" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">Is the link safe to open?</div>
                        <div className="text-xs text-muted-foreground">
                          {safety ? "Safety check complete" : "We'll check the connection, certificate, and domain reputation"}
                        </div>
                      </div>
                    </div>

                    {!safety && !isSafetyLoading && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-3 text-xs text-foreground transition-all shrink-0 border"
                        style={{ background: "var(--color-bg-light)", borderColor: "var(--color-border)", borderRadius: 3 }}
                        onClick={handleShowSafetyDetails}
                      >
                        <Search className="h-3 w-3 mr-1.5" />
                        Check Link
                      </Button>
                    )}

                    {isSafetyLoading && (
                      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border" style={{ background: "var(--color-bg-light)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Checking…</span>
                      </div>
                    )}
                  </div>

                  {safety && safetyScore && (
                    <div className="border-t p-4 animate-fade-in space-y-4" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>

                      {/* Overall verdict banner */}
                      {(() => {
                        const s = safetySummary[safetyScore];
                        const SIcon = s.icon;
                        return (
                          <div className={`flex items-center gap-3 p-3 border ${s.border} ${s.bg}`} style={{ borderRadius: 3 }}>
                            <SIcon className={`h-5 w-5 shrink-0 ${s.color}`} />
                            <span className={`text-sm font-semibold ${s.color}`}>{s.label}</span>
                          </div>
                        );
                      })()}

                      {/* URL */}
                      {safetyUrl && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono p-2 border break-all" style={{ background: "var(--color-bg-light)", borderColor: "var(--color-border)", borderRadius: 2 }}>
                          <Globe className="h-3 w-3 shrink-0" />
                          {safetyUrl}
                        </div>
                      )}

                      {/* Individual checks */}
                      <div className="grid grid-cols-2 gap-3">
                        <SafetyItem
                          label="Encrypted connection"
                          value={https === null ? "Unknown" : https ? "Yes — secure" : "No — insecure"}
                          icon={Lock}
                          status={https ? "success" : https === false ? "warning" : "neutral"}
                        />
                        <SafetyItem
                          label="Security certificate"
                          value={certValid === null ? "Unknown" : certValid ? "Trusted" : "Untrusted"}
                          icon={Shield}
                          status={certValid ? "success" : certValid === false ? "error" : "neutral"}
                        />
                        <SafetyItem
                          label="Domain age"
                          value={
                            domainAgeDays === null
                              ? "Unknown"
                              : domainAgeDays < 30
                              ? `${domainAgeDays} days — very new`
                              : domainAgeDays < 180
                              ? `${domainAgeDays} days`
                              : `${Math.round(domainAgeDays / 30)} months — established`
                          }
                          icon={Calendar}
                          status={
                            domainAgeDays === null
                              ? "neutral"
                              : domainAgeDays < 30
                              ? "warning"
                              : "success"
                          }
                        />
                        {safeBrowsing && safeBrowsing !== "unknown" && (
                          <SafetyItem
                            label="Google Safe Browsing"
                            value={safeBrowsing === "clean" ? "No threats found" : `Flagged: ${safeBrowsing}`}
                            icon={Search}
                            status={safeBrowsing === "clean" ? "success" : "error"}
                          />
                        )}
                      </div>

                      {/* Secondary badges */}
                      {(ct || (domainCategory && domainCategory !== "unknown")) && (
                        <div className="flex flex-wrap gap-2">
                          {domainCategory && domainCategory !== "unknown" && (
                            <Badge variant="outline" className="border-border text-muted-foreground" style={{ background: "var(--color-bg-light)" }}>
                              Category: {domainCategory}
                            </Badge>
                          )}
                          {ct && (
                            <Badge variant="outline" className="border-border text-muted-foreground text-[10px]" style={{ background: "var(--color-bg-light)" }}>
                              CT log: {ct}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {scannedData && (
            <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen} className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted p-0 h-auto font-normal">
                    <span className="flex items-center gap-2">
                      {isDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {isDetailsOpen ? "Hide Raw Data" : "View Raw Data"}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                {isDetailsOpen && (
                  <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">
                    {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                )}
              </div>
              <CollapsibleContent className="space-y-2">
                <div className="border p-4 overflow-x-auto relative group" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: "var(--color-muted)" }}>
                    {scannedData}
                  </pre>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Code className="h-3 w-3" />
                  <span>Raw decoded content</span>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <div className="mt-5 flex justify-center">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 gap-2 text-sm"
            onClick={resetState}
          >
            <RefreshCw className="h-4 w-4" />
            Scan Again
          </Button>
        </div>
        </>
      );
    }

    if (isNonMira && scannedData) {
      return (
        <div className="animate-fade-in">
          <div className="border overflow-hidden" style={{ background: "rgba(230,168,23,0.08)", borderColor: "rgba(230,168,23,0.25)", borderRadius: 3 }}>
            <div className="p-5 sm:p-8 space-y-6">

              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="p-3 shrink-0" style={{ background: "rgba(230,168,23,0.08)", border: "1px solid rgba(230,168,23,0.3)", borderRadius: 2 }}>
                  <AlertTriangle className="h-7 w-7 text-[#E6A817]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-[#E6A817]">Not a Mira-tracked product</h3>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3 shrink-0" />
                    {new Date().toLocaleString()}
                  </div>
                </div>
              </div>

              {/* What it means */}
              <div className="p-4 space-y-2" style={{ background: "var(--color-bg)", border: "1px solid rgba(230,168,23,0.15)", borderRadius: 2 }}>
                <div className="text-base font-medium text-foreground">
                  This QR code isn't linked to any product in our system.
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  This doesn't automatically mean the product is fake — it may be a regular QR code for a website, coupon, or a product brand that hasn't registered with Mira. However, if you expected this to be a verified product, that's worth looking into.
                </div>
              </div>

              {/* What to do */}
              <div className="border border-border p-4 space-y-3" style={{ background: "var(--color-bg-light)", borderRadius: 3 }}>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <HelpCircle className="h-4 w-4 shrink-0" />
                  What should you do?
                </div>
                <ul className="space-y-2">
                  {[
                    "If you expected this product to be verified, ask the seller for proof of authenticity.",
                    "Don't open any links from this QR code unless you trust the source.",
                    "If the price seemed unusually low, this product may not be genuine.",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                      <span className="mt-0.5 shrink-0 h-5 w-5 flex items-center justify-center text-[11px] font-bold text-[#E6A817]" style={{ background: "rgba(230,168,23,0.1)", border: "1px solid rgba(230,168,23,0.25)", borderRadius: 3 }}>
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Raw data (collapsed) */}
              <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen} className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted p-0 h-auto font-normal">
                      <span className="flex items-center gap-2">
                        {isDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {isDetailsOpen ? "Hide Raw Data" : "View Raw Data"}
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  {isDetailsOpen && (
                    <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">
                      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  )}
                </div>
                <CollapsibleContent className="space-y-2">
                  <div className="border p-4 overflow-x-auto" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: "var(--color-muted)" }}>
                      {scannedData}
                    </pre>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Code className="h-3 w-3" />
                    <span>Raw decoded content</span>
                  </div>
                </CollapsibleContent>
              </Collapsible>

            </div>
          </div>

          <div className="mt-5 flex justify-center">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground transition-colors duration-150 gap-2 text-sm"
              onClick={resetState}
            >
              <RefreshCw className="h-4 w-4" />
              Scan Another
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  const body = (
    <div className={isApp ? "space-y-6 sm:space-y-8" : "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 sm:space-y-8"}>
      {!result && !isNonMira && (
        <div className="space-y-2 text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Verify Authenticity</h2>
          <p className="text-muted-foreground text-base sm:text-lg">Scan a Mira QR code to instantly verify its validity.</p>
        </div>
      )}

      {!result && !isNonMira && (
        <div className="border overflow-hidden" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
          <div className="p-0">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="flex flex-col">
              <div className="border-b border-border" style={{ background: "var(--color-bg-light)" }}>
                <TabsList className="w-full justify-start rounded-none bg-transparent p-0 h-auto">
                  <TabsTrigger
                    value="scan"
                    className="flex-1 py-3 sm:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <ScanLine className="h-4 w-4" />
                      <span>Scanner</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger
                    value="upload"
                    className="flex-1 py-3 sm:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      <span>Upload Image</span>
                    </div>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="scan" className="p-6 sm:p-10 flex flex-col items-center justify-center gap-6 animate-fade-in">
                <div className="relative w-full max-w-[260px] sm:max-w-[300px] aspect-square mx-auto overflow-hidden border border-border" style={{ background: "#000", borderRadius: 3 }}>
                  {/* Scanner Container */}
                    <div id={scannerHostId} className="w-full h-full object-cover" />

                    {/* Scanning Overlay UI */}
                    {isScanningEnabled && !isLoading && (
                      <>
                        <div className="absolute inset-0 border-[24px] sm:border-[32px] border-black/40 pointer-events-none z-10"></div>
                        <div className="absolute inset-0 z-20 pointer-events-none">
                          <div className="absolute top-0 left-0 w-full h-0.5 animate-[scan_2s_ease-in-out_infinite]" style={{ background: "linear-gradient(to right, transparent, var(--color-accent), transparent)", opacity: 0.6 }} />
                        </div>
                        {/* Corner Markers */}
                        <div className="absolute top-5 left-5 sm:top-7 sm:left-7 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-l-4 border-primary rounded-tl-lg z-20" />
                        <div className="absolute top-5 right-5 sm:top-7 sm:right-7 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-r-4 border-primary rounded-tr-lg z-20" />
                        <div className="absolute bottom-5 left-5 sm:bottom-7 sm:left-7 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-l-4 border-primary rounded-bl-lg z-20" />
                        <div className="absolute bottom-5 right-5 sm:bottom-7 sm:right-7 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-r-4 border-primary rounded-br-lg z-20" />
                      </>
                    )}
                </div>

                <div className="flex items-center gap-3 px-5 py-2.5 border border-border" style={{ background: "var(--color-bg-light)", borderRadius: 4 }}>
                  <Switch
                    id="scanner-active"
                    checked={isScanningEnabled}
                    onCheckedChange={setIsScanningEnabled}
                    className="data-[state=checked]:bg-primary scale-90 sm:scale-100"
                  />
                  <Label htmlFor="scanner-active" className="text-xs sm:text-sm font-medium text-foreground/80 cursor-pointer flex items-center gap-2">
                    {isScanningEnabled ? (
                      <>
                        <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary fill-primary" />
                        Camera Active
                      </>
                    ) : (
                      "Camera Paused"
                    )}
                  </Label>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="p-6 sm:p-10 flex flex-col items-center justify-center animate-fade-in">
                <div className="w-full max-w-sm space-y-4">
                  {!selectedFile ? (
                    <div className="border border-dashed border-border p-8 sm:p-10 text-center hover:bg-muted transition-colors cursor-pointer relative group" style={{ borderRadius: 3 }}>
                      <Input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      />
                      <div className="flex flex-col items-center gap-4 text-muted-foreground group-hover:text-foreground transition-colors">
                        <div className="p-4 transition-colors border border-border group-hover:border-primary/30" style={{ background: "var(--color-bg-light)", borderRadius: 3 }}>
                          <ImageIcon className="h-8 w-8 sm:h-10 sm:w-10" />
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-medium text-sm sm:text-base">Click to upload or drag and drop</p>
                          <p className="text-xs text-muted-foreground/60">PNG, JPG or JPEG</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative overflow-hidden border border-border group" style={{ background: "var(--color-bg)", borderRadius: 3 }}>
                      <img
                        src={previewUrl || ""}
                        alt="Preview"
                        className="w-full h-auto max-h-[300px] object-contain"
                      />
                      <div className="absolute inset-0 group-hover:bg-foreground/5 transition-colors" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground h-8 w-8 border border-border" style={{ background: "var(--color-bg-card)", borderRadius: 4 }}
                        onClick={clearSelection}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {selectedFile && (
                    <div className="flex items-center justify-between px-4 py-3 border border-border" style={{ background: "var(--color-bg-light)", borderRadius: 3 }}>
                      <span className="text-sm text-foreground/80 truncate max-w-[150px] sm:max-w-[200px]">{selectedFile.name}</span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void scanSelectedFile()}
                        disabled={isDecoding || isLoading}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs sm:text-sm"
                      >
                        {isDecoding ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Scanning
                          </>
                        ) : (
                          "Scan Image"
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Hidden host for html5-qrcode scanFile() in Upload mode */}
                <div id={scannerHostId} className="hidden" />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {isLoading && !result && !isNonMira && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-fade-in">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Verifying token...</p>
        </div>
      )}

      {renderResult()}
    </div>
  );

  if (isApp) return (
    <>
      {showScanGate && <ScanGateModal onClose={() => setShowScanGate(false)} />}
      {body}
    </>
  );

  return (
    <div className="min-h-screen font-sans" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
      {showScanGate && <ScanGateModal onClose={() => setShowScanGate(false)} />}
      {header}
      {body}
    </div>
  );
}
