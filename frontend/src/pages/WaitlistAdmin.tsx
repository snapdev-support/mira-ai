import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/Logo";
import { api } from "@/services/api";
import {
  Loader2,
  Download,
  RefreshCw,
  Users,
  Lock,
  Search,
  Building2,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  developer: "Developer",
  brand_owner: "Brand Owner",
  retailer: "Retailer",
  enterprise: "Enterprise",
  other: "Other",
};

const SESSION_KEY = "mira_ops_secret";

interface Entry {
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  created_at: string | null;
}

export default function WaitlistAdmin() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? "");
  const [inputSecret, setInputSecret] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchEntries = useCallback(async (s: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ total: number; entries: Entry[] }>("/waitlist", {
        headers: { "x-ops-secret": s },
      });
      setEntries(res.data.entries);
      setTotal(res.data.total);
      setSecret(s);
      sessionStorage.setItem(SESSION_KEY, s);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setError("Invalid secret. Check your OPS_SECRET environment variable.");
      } else {
        setError("Could not fetch waitlist. Is the backend running?");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSecret.trim()) fetchEntries(inputSecret.trim());
  };

  const handleDownloadCsv = async () => {
    const res = await fetch(`${api.defaults.baseURL}/waitlist.csv`, {
      headers: { "x-ops-secret": secret },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "waitlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = entries.filter(
    (e) =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.company ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  // ── Locked state ──
  if (!secret) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
        <div className="w-full max-w-sm space-y-6">
          <div className="flex justify-center">
            <Logo size="sm" />
          </div>
          <div className="border p-6 space-y-5" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
            <div className="flex items-center gap-3">
              <div className="p-2 border" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", borderRadius: 3 }}>
                <Lock className="h-4 w-4" style={{ color: "var(--color-muted)" }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Waitlist Admin</div>
                <div className="text-xs text-muted-foreground">Enter your OPS_SECRET to continue</div>
              </div>
            </div>
            <form onSubmit={handleUnlock} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="secret" className="text-xs text-muted-foreground">Secret</Label>
                <Input
                  id="secret"
                  type="password"
                  placeholder="ops secret…"
                  value={inputSecret}
                  onChange={(e) => setInputSecret(e.target.value)}
                  required
                  style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", color: "var(--color-text)", borderRadius: 3 }}
                  className="placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-0"
                />
              </div>
              {error && <p className="text-xs text-[#D95050]">{error}</p>}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full font-semibold hover:opacity-90 transition-opacity"
                style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, border: "none" }}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Unlocked state ──
  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div className="h-4 w-px" style={{ background: "var(--color-border)" }} />
            <span className="label-caps text-muted-foreground">Waitlist</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchEntries(secret)}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadCsv}
              className="text-foreground gap-1.5 hover:opacity-90"
              style={{ background: "var(--color-bg-light)", border: "1px solid var(--color-border)", borderRadius: 4 }}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { sessionStorage.removeItem(SESSION_KEY); setSecret(""); setInputSecret(""); }}
              className="text-muted-foreground hover:text-[#D95050]"
            >
              Lock
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="border p-4 space-y-1" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Users className="h-3.5 w-3.5" />
              Total signups
            </div>
            <div className="text-2xl font-bold text-foreground">{total ?? "—"}</div>
          </div>
          <div className="border p-4 space-y-1" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Building2 className="h-3.5 w-3.5" />
              With company
            </div>
            <div className="text-2xl font-bold text-foreground">
              {entries.filter((e) => e.company).length}
            </div>
          </div>
          <div className="border p-4 space-y-1 col-span-2 sm:col-span-1" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Search className="h-3.5 w-3.5" />
              Showing
            </div>
            <div className="text-2xl font-bold text-foreground">{filtered.length}</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 placeholder:text-[#7A7D8C]/50 focus:border-[#B5C45A]/50 focus:ring-0"
            style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", color: "var(--color-text)", borderRadius: 3 }}
          />
        </div>

        {/* Table */}
        <div className="border overflow-hidden" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {search ? "No results match your search." : "No signups yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-4 py-3 label-caps">Name</th>
                    <th className="text-left px-4 py-3 label-caps">Email</th>
                    <th className="text-left px-4 py-3 label-caps hidden sm:table-cell">Company</th>
                    <th className="text-left px-4 py-3 label-caps hidden md:table-cell">Role</th>
                    <th className="text-left px-4 py-3 label-caps hidden lg:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry, i) => (
                    <tr
                      key={entry.email}
                      className={`border-b border-border hover:bg-white/[0.02] transition-colors ${i === filtered.length - 1 ? "border-b-0" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{entry.name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{entry.email}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {entry.company || <span style={{ color: "rgba(122,125,140,0.4)" }}>—</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {entry.role ? (
                          <Badge
                            variant="outline"
                            className="text-xs text-muted-foreground"
                            style={{ borderColor: "var(--color-border)", background: "var(--color-bg)", borderRadius: 3 }}
                          >
                            {ROLE_LABELS[entry.role] ?? entry.role}
                          </Badge>
                        ) : (
                          <span style={{ color: "rgba(122,125,140,0.4)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
