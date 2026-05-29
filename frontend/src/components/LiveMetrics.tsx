import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Zap, Globe, Users, Shield } from "lucide-react";

export const LiveMetrics = () => {
  const [metrics, setMetrics] = useState({
    totalScans: 127543,
    scansToday: 2847,
    activeIssuers: 342,
    avgVerifyTime: 0.9,
    successRate: 99.7,
    fraudBlocked: 23,
    topRegions: [
      { name: "North America", scans: 45231, growth: 12.3 },
      { name: "Europe", scans: 38942, growth: 8.7 },
      { name: "Asia Pacific", scans: 31284, growth: 15.2 },
      { name: "Latin America", scans: 12086, growth: 22.1 }
    ],
    recentActivity: [
      { type: "scan", count: 1247, trend: "up" },
      { type: "issue", count: 89, trend: "up" },
      { type: "revoke", count: 12, trend: "down" },
      { type: "fraud", count: 3, trend: "down" }
    ]
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        totalScans: prev.totalScans + Math.floor(Math.random() * 5),
        scansToday: prev.scansToday + Math.floor(Math.random() * 3),
        avgVerifyTime: Math.max(0.5, Math.min(2.0, prev.avgVerifyTime + (Math.random() - 0.5) * 0.1)),
        fraudBlocked: prev.fraudBlocked + (Math.random() < 0.1 ? 1 : 0)
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const cardStyle = { background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 };

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border p-4" style={cardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Scans</p>
              <p className="text-2xl font-bold text-foreground">{metrics.totalScans.toLocaleString()}</p>
            </div>
            <Globe className="h-8 w-8" style={{ color: "var(--color-accent)", opacity: 0.4 }} />
          </div>
          <div className="mt-2">
            <Badge
              variant="outline"
              className="text-xs"
              style={{ color: "var(--color-accent)", background: "var(--color-accent-8)", borderColor: "var(--color-accent-16)", borderRadius: 3 }}
            >
              +{metrics.scansToday} today
            </Badge>
          </div>
        </div>

        <div className="border p-4" style={cardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Issuers</p>
              <p className="text-2xl font-bold text-foreground">{metrics.activeIssuers}</p>
            </div>
            <Users className="h-8 w-8 text-[#4CAF7D]/40" />
          </div>
          <div className="mt-2">
            <Badge
              variant="outline"
              className="text-xs text-[#4CAF7D]"
              style={{ background: "rgba(76,175,125,0.08)", borderColor: "rgba(76,175,125,0.2)", borderRadius: 3 }}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              +12% this week
            </Badge>
          </div>
        </div>

        <div className="border p-4" style={cardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Verify Time</p>
              <p className="text-2xl font-bold text-foreground">{metrics.avgVerifyTime.toFixed(1)}s</p>
            </div>
            <Zap className="h-8 w-8" style={{ color: "var(--color-accent)", opacity: 0.4 }} />
          </div>
          <div className="mt-2">
            <Progress value={Math.max(0, 100 - (metrics.avgVerifyTime * 50))} className="h-1" />
          </div>
        </div>

        <div className="border p-4" style={cardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fraud Blocked</p>
              <p className="text-2xl font-bold text-foreground">{metrics.fraudBlocked}</p>
            </div>
            <Shield className="h-8 w-8 text-[#D95050]/40" />
          </div>
          <div className="mt-2">
            <Badge
              variant="outline"
              className="text-xs text-[#D95050]"
              style={{ background: "rgba(217,80,80,0.08)", borderColor: "rgba(217,80,80,0.2)", borderRadius: 3 }}
            >
              Last 24h
            </Badge>
          </div>
        </div>
      </div>

      {/* Regional Activity */}
      <div className="border" style={cardStyle}>
        <div className="flex items-center gap-2 p-6 pb-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <Globe className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
          <span className="font-semibold text-foreground">Global Activity</span>
        </div>
        <div className="p-6 space-y-4">
          {metrics.topRegions.map((region, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2" style={{ background: "var(--color-accent)", borderRadius: 1 }} />
                <span className="font-medium text-foreground">{region.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{region.scans.toLocaleString()} scans</span>
                <Badge
                  variant="outline"
                  className="text-xs text-[#4CAF7D]"
                  style={{ background: "rgba(76,175,125,0.08)", borderColor: "rgba(76,175,125,0.2)", borderRadius: 3 }}
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{region.growth}%
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Success Rate Indicator */}
      <div className="border p-6" style={{ background: "rgba(76,175,125,0.05)", borderColor: "rgba(76,175,125,0.2)", borderRadius: 3 }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#4CAF7D]">System Health</h3>
            <p className="text-[#4CAF7D]/70 text-sm">All systems operational</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-foreground">{metrics.successRate}%</p>
            <p className="text-sm text-[#4CAF7D]">Success Rate</p>
          </div>
        </div>
        <div className="mt-4">
          <Progress value={metrics.successRate} className="h-1.5" />
        </div>
      </div>
    </div>
  );
};

export default LiveMetrics;
