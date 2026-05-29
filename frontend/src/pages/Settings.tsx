import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { useUsage } from "@/usage/UsageContext";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user, refresh: refreshAuth } = useAuth();
  const { usage, refresh: refreshUsage } = useUsage();
  const navigate = useNavigate();

  const onRefresh = async () => {
    await Promise.all([refreshAuth(), refreshUsage()]);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Account and plan settings.</p>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-foreground">Account</CardTitle>
            <CardDescription>Signed-in identity and current plan.</CardDescription>
          </div>
          <Button variant="outline" className="border-border hover:bg-muted text-foreground bg-transparent" onClick={onRefresh}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Email</div>
            <div className="text-sm font-medium text-foreground">{user?.email ?? "—"}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Plan</div>
            <div className="flex items-center gap-2">
              <Badge
                className={user?.plan === "paid" || user?.plan === "pro" ? "text-primary" : "text-muted-foreground"}
                style={
                  user?.plan === "paid" || user?.plan === "pro"
                    ? { background: "var(--color-accent-8)", borderColor: "var(--color-accent-16)", borderRadius: 3 }
                    : { background: "var(--color-bg-light)", borderColor: "var(--color-border)", borderRadius: 3 }
                }
              >
                {user?.plan ?? "free"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-foreground">Usage & Credits</CardTitle>
            <CardDescription>Track your claim issuance and remaining balance.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border hover:bg-muted text-foreground bg-transparent" onClick={() => navigate("/app/billing")}>
              Billing
            </Button>
            <Button variant="outline" className="border-border hover:bg-muted text-foreground bg-transparent" onClick={() => navigate("/pricing")}>
              Add Credits
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Credits Remaining</div>
              <div className="text-2xl font-bold text-foreground">
                {usage?.creditsRemaining.toLocaleString() ?? "—"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Total Issued</div>
              <div className="text-2xl font-bold text-foreground">
                {usage?.issuedCount.toLocaleString() ?? "—"}
              </div>
            </div>
          </div>

          {usage && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Usage</span>
                <span>{usage.creditsRemaining > 0 ? "Active" : "Exhausted"}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden" style={{ background: "var(--color-bg-light)", borderRadius: 2 }}>
                <div
                  className="h-full"
                  style={{ width: "100%", background: usage.creditsRemaining > 0 ? "var(--color-accent)" : "#D95050", borderRadius: 2 }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {usage.creditsRemaining <= 0
                  ? "You have used all available credits. Top up to continue issuing claims."
                  : "Credits are deducted per claim issued."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Security</CardTitle>
          <CardDescription>JWT-based auth in Stage-1. More controls later.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Password management, 2FA, and API keys will be added after the UI is finalized.</div>
        </CardContent>
      </Card>
    </div>
  );
}
