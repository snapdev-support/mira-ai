import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpRight, ArrowDownRight, Activity, Server, QrCode, Clock, Zap } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

import { getOpsEvents, getOpsTiles, getOpsTraffic } from "@/services/opsApi";
import type { OpsEventItem, OpsTilesResponse, OpsTrafficBucket } from "@/types/backend";

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

function dateToLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

const Dashboard = () => {
  const { theme } = useTheme();
  const [tiles, setTiles] = useState<OpsTilesResponse | null>(null);
  const [traffic, setTraffic] = useState<OpsTrafficBucket[]>([]);
  const [events, setEvents] = useState<OpsEventItem[]>([]);

  useEffect(() => {
    Promise.all([getOpsTiles(), getOpsTraffic(7), getOpsEvents(10)])
      .then(([t, tr, ev]) => {
        setTiles(t);
        setTraffic(tr.items);
        setEvents(ev.items);
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  const chartData = traffic.map((b) => ({
    name: dateToLabel(b.date),
    requests: b.scans,
    latency: b.avg_latency_ms ?? 0,
  }));

  return (
    <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of your system's performance and security.</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="hidden sm:flex border-border hover:bg-accent text-foreground">
              <Clock className="mr-2 h-4 w-4" />
              {tiles ? `Last Updated: ${formatIsoAgo(tiles.updated_at)}` : "Last Updated: —"}
            </Button>
            <Button className="font-semibold hover:opacity-90" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, border: "none" }} onClick={() => window.location.reload()}>
              <Zap className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
              <Activity className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{tiles ? tiles.total_scans.toLocaleString() : "—"}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Scans for your issuer account
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Latency</CardTitle>
              <Server className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{tiles?.verify_avg_ms == null ? "—" : `${tiles.verify_avg_ms}ms`}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowDownRight className="h-3 w-3 mr-1" />
                Today’s average verify latency
              </p>
            </CardContent>
          </Card>
          {/* <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
              <Users className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">573</div>
              <p className="text-xs text-[#4CAF7D] flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                +201 since last hour
              </p>
            </CardContent>
          </Card> */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">QR Codes Generated</CardTitle>
              <QrCode className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{tiles ? tiles.claims_total.toLocaleString() : "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">Total generated</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">MiraTrust QR Scans</CardTitle>
              <Activity className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{tiles ? tiles.scans_today.toLocaleString() : "—"}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Scans today
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section use whole width*/}


        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Traffic Overview</CardTitle>
              <CardDescription>Daily request volume over the last 7 days.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme === "dark" ? "#B5C45A" : "#627A1E"} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={theme === "dark" ? "#B5C45A" : "#627A1E"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--color-muted)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--color-muted)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--color-bg-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                      itemStyle={{ color: "var(--color-text)" }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="requests" 
                      stroke={theme === "dark" ? "#B5C45A" : "#627A1E"}
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRequests)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-3 border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Recent Activity</CardTitle>
              <CardDescription>Latest system events and alerts.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {events.map((activity) => (
                  <div key={activity.id} className="flex items-center">
                    <div className={`
                      w-2 h-2 rounded-full mr-4 
                      ${activity.status === 'success' ? 'bg-[#4CAF7D]' :
                        activity.status === 'warning' ? 'bg-[#E6A817]' :
                        activity.status === 'info' ? (theme === 'dark' ? 'bg-[#B5C45A]' : 'bg-[#627A1E]') :
                        'bg-[#D95050]'}
                    `} />
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none text-foreground">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.type} • {formatIsoAgo(activity.ts)}
                      </p>
                    </div>
                  </div>
                ))}

                {events.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No recent activity yet.</div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

    </div>
  );
};

export default Dashboard;
