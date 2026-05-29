import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { getOpsClaims, getOpsEvents, getOpsTiles } from "@/services/opsApi";
import { revokeClaim } from "@/services/claimsApi";
import type { OpsClaimItem, OpsEventItem, OpsTilesResponse } from "@/types/backend";
import { BarChart3, Activity, AlertTriangle, CheckCircle, Clock, Zap, Download, QrCode } from "lucide-react";
import { downloadQrImage } from "@/lib/downloadQr";

function msToSeconds(ms: number | null | undefined): number | null {
  if (ms === null || ms === undefined) return null;
  return ms / 1000;
}

function formatIsoAgo(iso: string): string {
  const ts = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - ts.getTime();
  if (!Number.isFinite(diff)) return ts.toLocaleString();
  if (diff < 60_000) return `${Math.max(0, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return ts.toLocaleString();
}

function getApiRootFromBaseUrl(): string {
  const baseURL = api.defaults.baseURL ?? "";
  return baseURL.replace(/\/api\/v1\/?$/, "");
}

function downloadTextFile(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const Console = () => {
  const { toast } = useToast();
  const [tiles, setTiles] = useState<OpsTilesResponse | null>(null);
  const [events, setEvents] = useState<OpsEventItem[]>([]);
  const [claims, setClaims] = useState<OpsClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingJti, setRevokingJti] = useState<string | null>(null);

  const apiRoot = useMemo(() => getApiRootFromBaseUrl(), []);

  async function refreshAll(): Promise<void> {
    try {
      const [t, e, c] = await Promise.all([getOpsTiles(), getOpsEvents(50), getOpsClaims(50)]);
      setTiles(t);
      setEvents(e.items);
      setClaims(c.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll().catch((err) => {
      console.error(err);
      toast({ title: "Console failed to load", description: "Check backend is running and you are logged in." });
    });

    const interval = window.setInterval(() => {
      refreshAll().catch(() => {
        // keep quiet; UI already shows last loaded state
      });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [toast]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "text-[#4CAF7D] bg-[rgba(76,175,125,0.08)]";
      case "warning": return "text-[#E6A817] bg-[rgba(230,168,23,0.08)]";
      case "error": return "text-[#D95050] bg-[rgba(217,80,80,0.08)]";
      default: return "text-primary bg-[rgba(181,196,90,0.08)]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return CheckCircle;
      case "warning": return AlertTriangle;
      case "error": return AlertTriangle;
      default: return Activity;
    }
  };

  const p50s = msToSeconds(tiles?.verify_p50_ms ?? null);
  const p95s = msToSeconds(tiles?.verify_p95_ms ?? null);
  const avgMs = tiles?.verify_avg_ms ?? null;

  async function onDownloadQr(c: OpsClaimItem): Promise<void> {
    const subjId = (c.subject?.["id"] as string | undefined) ?? c.jti.slice(0, 8);
    // Filename combines the subject id and a short jti so two same-subject
    // QRs don't overwrite each other on disk.
    const safeSubj = subjId.replace(/[^a-z0-9_-]+/gi, "_");
    const ok = await downloadQrImage({
      payload: c.qr_payload,
      filename: `mira-${safeSubj}-${c.jti.slice(0, 8)}`,
    });
    if (!ok) {
      toast({
        title: "Download failed",
        description: "Could not generate this QR image. Try again.",
        variant: "destructive",
      });
    }
  }

  async function onRevoke(jti: string): Promise<void> {
    setRevokingJti(jti);
    try {
      await revokeClaim({ jti, reason: "revoked_by_issuer" });
      toast({ title: "Revoked", description: `Claim ${jti.slice(0, 8)} was revoked.` });
      await refreshAll();
    } catch (err) {
      console.error(err);
      toast({ title: "Revoke failed", description: "Please try again." });
    } finally {
      setRevokingJti(null);
    }
  }

  async function onExportCsv(): Promise<void> {
    try {
      const res = await api.get<string>("/ops/claims.csv", { responseType: "text" });
      downloadTextFile(`claims-${new Date().toISOString().slice(0, 10)}.csv`, res.data, "text/csv");
    } catch (err) {
      console.error(err);
      toast({ title: "Export failed", description: "Could not download CSV." });
    }
  }

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Console</h1>
            <p className="text-muted-foreground mt-1">Real-time operations and system monitoring.</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="text-[#4CAF7D]" style={{ background: "rgba(76,175,125,0.08)", borderColor: "rgba(76,175,125,0.25)", borderRadius: 3 }}>
              <div className="w-2 h-2 mr-2" style={{ background: "#4CAF7D", borderRadius: 1 }}></div>
              {tiles ? `Updated ${formatIsoAgo(tiles.updated_at)}` : "Loading"}
            </Badge>
          </div>
        </div>

        {/* SLO Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border hover:border-primary/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">P50 Latency</p>
                  <p className="text-2xl font-bold text-foreground">{p50s === null ? "—" : `${p50s.toFixed(2)}s`}</p>
                </div>
                <div className="p-3" style={{ background: "rgba(181,196,90,0.08)", borderRadius: 3 }}>
                  <Zap className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="mt-4">
                <Progress value={p50s === null ? 0 : Math.min(100, Math.max(0, (2 - p50s) * 50))} className="h-2 bg-white/10" />
                <p className="text-xs text-primary mt-1">Target: &lt;1.0s</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border hover:border-primary/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#4CAF7D]">P95 Latency</p>
                  <p className="text-2xl font-bold text-foreground">{p95s === null ? "—" : `${p95s.toFixed(2)}s`}</p>
                </div>
                <div className="p-3" style={{ background: "rgba(76,175,125,0.08)", borderRadius: 3 }}>
                  <Zap className="h-6 w-6 text-[#4CAF7D]" />
                </div>
              </div>
              <div className="mt-4">
                <Progress value={p95s === null ? 0 : Math.min(100, Math.max(0, (2 - p95s) * 50))} className="h-2 bg-white/10" />
                <p className="text-xs text-[#4CAF7D] mt-1">Target: &lt;2.0s</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border hover:border-primary/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">Avg Latency</p>
                  <p className="text-2xl font-bold text-foreground">{avgMs === null ? "—" : `${avgMs}ms`}</p>
                </div>
                <div className="p-3" style={{ background: "rgba(181,196,90,0.08)", borderRadius: 3 }}>
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="mt-4">
                <Progress value={avgMs === null ? 0 : Math.min(100, Math.max(0, (1000 - avgMs) / 10))} className="h-2 bg-white/10" />
                <p className="text-xs text-muted-foreground mt-1">Best-effort: today</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border hover:border-primary/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#E6A817]">Last Revocation Age</p>
                  <p className="text-2xl font-bold text-foreground">{tiles?.last_revocation_age_s == null ? "—" : `${Math.round(tiles.last_revocation_age_s)}s`}</p>
                </div>
                <div className="p-3" style={{ background: "rgba(230,168,23,0.08)", borderRadius: 3 }}>
                  <Clock className="h-6 w-6 text-[#E6A817]" />
                </div>
              </div>
              <div className="mt-4">
                <Progress value={tiles?.last_revocation_age_s == null ? 0 : Math.max(0, 100 - tiles.last_revocation_age_s)} className="h-2 bg-white/10" />
                <p className="text-xs text-[#E6A817] mt-1">Target: &lt;60s (CRL freshness)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main: Your QR Codes */}
          <div className="lg:col-span-2">
            <Card className="border-border h-full">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-foreground">
                  <BarChart3 className="h-5 w-5" />
                  <span>Your QR Codes</span>
                </CardTitle>
                <CardDescription className="text-muted-foreground">Issued claims with scans and revoke action</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border border-border overflow-hidden" style={{ borderRadius: 3 }}>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-white/5">
                        <TableHead className="text-muted-foreground">Subject</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-muted-foreground">Scans</TableHead>
                        <TableHead className="text-muted-foreground">Last Scan</TableHead>
                        <TableHead className="text-muted-foreground text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claims.map((c) => {
                        const subjId = (c.subject?.["id"] as string | undefined) ?? c.jti.slice(0, 8);
                        return (
                          <TableRow key={c.jti} className="border-border hover:bg-white/5">
                            <TableCell className="text-foreground">{subjId}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  c.status === "active"
                                    ? "border-[rgba(76,175,125,0.3)] text-[#4CAF7D]"
                                    : "border-[rgba(230,168,23,0.3)] text-[#E6A817]"
                                }
                              >
                                {c.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-foreground">{c.scan_count}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {c.last_scan_ts ? formatIsoAgo(c.last_scan_ts) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-border hover:bg-white/10 text-foreground bg-transparent"
                                  disabled={!c.qr_payload}
                                  onClick={() => onDownloadQr(c)}
                                  title="Download QR image (PNG)"
                                >
                                  <QrCode className="h-3.5 w-3.5 mr-1.5" />
                                  Download
                                </Button>
                                <Button
                                  variant="outline"
                                  className="border-border hover:bg-white/10 text-foreground bg-transparent"
                                  disabled={c.status === "revoked" || revokingJti === c.jti}
                                  onClick={() => onRevoke(c.jti)}
                                >
                                  {c.status === "revoked" ? "Revoked" : revokingJti === c.jti ? "Revoking..." : "Revoke"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!loading && claims.length === 0 ? (
                        <TableRow className="border-border">
                          <TableCell colSpan={5} className="text-muted-foreground">
                            No claims yet. Issue one in Studio.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aside: Live Events + Overview + Actions */}
          <div className="space-y-6">
            {/* Live Events Stream */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-foreground">
                  <Activity className="h-5 w-5" />
                  <span>Live Events Stream</span>
                </CardTitle>
                <CardDescription className="text-muted-foreground">Activity from your scans, issues, and revocations</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all" className="space-y-4">
                  <TabsList className="w-full grid grid-cols-4 rounded-none border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <TabsTrigger value="all" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">All</TabsTrigger>
                    <TabsTrigger value="scans" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Scans</TabsTrigger>
                    <TabsTrigger value="issues" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Issues</TabsTrigger>
                    <TabsTrigger value="revokes" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Revokes</TabsTrigger>
                  </TabsList>

                  {(
                    [
                      { key: "all", filter: (_e: OpsEventItem) => true },
                      { key: "scans", filter: (e: OpsEventItem) => e.type === "scan" },
                      { key: "issues", filter: (e: OpsEventItem) => e.type === "issue" },
                      { key: "revokes", filter: (e: OpsEventItem) => e.type === "revoke" },
                    ] as const
                  ).map((tab) => (
                    <TabsContent
                      key={tab.key}
                      value={tab.key}
                      className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar"
                    >
                      {(loading ? [] : events)
                        .filter(tab.filter)
                        .map((event) => {
                          const StatusIcon = getStatusIcon(event.status);
                          return (
                            <div key={event.id} className="flex items-center gap-3 p-3 border border-border hover:border-primary/20 transition-colors" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                              <div className={`p-2 ${getStatusColor(event.status)}`} style={{ borderRadius: 3 }}>
                                <StatusIcon className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{event.message}</p>
                                <p className="text-xs text-muted-foreground">{formatIsoAgo(event.ts)}</p>
                              </div>
                              <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                                {event.type}
                              </Badge>
                            </div>
                          );
                        })}

                      {!loading && events.filter(tab.filter).length === 0 ? (
                        <div className="text-sm text-muted-foreground">No events yet.</div>
                      ) : null}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            {/* System Overview */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-foreground">
                  <Activity className="h-5 w-5" />
                  <span>Issuer Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Scans</span>
                  <span className="font-bold text-lg text-foreground">{tiles?.total_scans?.toLocaleString() ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Claims (Active)</span>
                  <span className="font-bold text-lg text-foreground">{tiles ? `${tiles.claims_active} / ${tiles.claims_total}` : "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Scans Today</span>
                  <span className="font-bold text-lg text-foreground">{tiles?.scans_today?.toLocaleString() ?? "—"}</span>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2" style={{ background: "#4CAF7D", borderRadius: 1 }}></div>
                    <span className="text-sm font-medium text-[#4CAF7D]">All Systems Operational</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Backend-only data (no mocks)</p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start border-border hover:bg-white/10 text-foreground bg-transparent"
                  onClick={onExportCsv}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Claims CSV
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start border-border hover:bg-white/10 text-foreground bg-transparent"
                  onClick={() => window.open(`${apiRoot}/.well-known/mira/crl`, "_blank", "noopener,noreferrer")}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Open CRL
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start border-border hover:bg-white/10 text-foreground bg-transparent"
                  onClick={() => refreshAll()}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Refresh Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
};

export default Console;
