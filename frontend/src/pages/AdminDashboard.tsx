import { useState, useEffect } from "react";
import MainLayout from "@/components/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, Activity, BarChart3, AlertTriangle, CheckCircle, TrendingUp, Zap, Database, Server, Eye, QrCode } from "lucide-react";

const AdminDashboard = () => {
  const [liveMetrics, setLiveMetrics] = useState({
    totalUsers: 12847,
    activeUsers: 3421,
    totalScans: 127543,
    scansToday: 2847,
    revenue: 89420,
    revenueGrowth: 23.5,
    systemHealth: 99.7,
    p50Latency: 0.8,
    p95Latency: 1.4,
    errorRate: 0.03,
    fraudBlocked: 23,
    storageUsed: 67.3
  });

  const [recentUsers] = useState([
    { id: 1, name: "Sarah Chen", email: "sarah@techstart.com", company: "TechStart Inc", plan: "Enterprise", status: "Active", joined: "2024-09-15" },
    { id: 2, name: "Marcus Rodriguez", email: "marcus@pharma.com", company: "PharmaCorp", plan: "Professional", status: "Active", joined: "2024-09-14" },
    { id: 3, name: "Lisa Park", email: "lisa@ecommerce.com", company: "E-Shop Ltd", plan: "Starter", status: "Trial", joined: "2024-09-13" },
    { id: 4, name: "David Kim", email: "david@logistics.com", company: "LogiFlow", plan: "Professional", status: "Active", joined: "2024-09-12" },
    { id: 5, name: "Emma Wilson", email: "emma@retail.com", company: "RetailMax", plan: "Enterprise", status: "Active", joined: "2024-09-11" }
  ]);

  const [systemAlerts] = useState([
    { id: 1, type: "warning", message: "High API usage detected - 95% of rate limit", timestamp: "2 minutes ago" },
    { id: 2, type: "info", message: "Scheduled maintenance completed successfully", timestamp: "1 hour ago" },
    { id: 3, type: "success", message: "New enterprise customer onboarded", timestamp: "3 hours ago" },
    { id: 4, type: "error", message: "Temporary spike in verification latency", timestamp: "5 hours ago" }
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveMetrics(prev => ({
        ...prev,
        totalScans: prev.totalScans + Math.floor(Math.random() * 5),
        scansToday: prev.scansToday + Math.floor(Math.random() * 3),
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 10 - 5),
        p50Latency: Math.max(0.3, prev.p50Latency + (Math.random() - 0.5) * 0.1),
        p95Latency: Math.max(0.8, prev.p95Latency + (Math.random() - 0.5) * 0.2)
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "error": return <AlertTriangle className="h-4 w-4 text-[#D95050]" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-[#E6A817]" />;
      case "success": return <CheckCircle className="h-4 w-4 text-[#4CAF7D]" />;
      default: return <Activity className="h-4 w-4 text-primary" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active": return <Badge className="text-[#4CAF7D]" style={{ background: "rgba(76,175,125,0.08)", borderColor: "rgba(76,175,125,0.25)", borderRadius: 3 }}>Active</Badge>;
      case "Trial": return <Badge className="text-primary" style={{ background: "rgba(181,196,90,0.08)", borderColor: "rgba(181,196,90,0.2)", borderRadius: 3 }}>Trial</Badge>;
      case "Suspended": return <Badge className="text-[#D95050]" style={{ background: "rgba(217,80,80,0.08)", borderColor: "rgba(217,80,80,0.25)", borderRadius: 3 }}>Suspended</Badge>;
      default: return <Badge variant="secondary" className="bg-secondary text-secondary-foreground">{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "Enterprise": return <Badge className="text-foreground" style={{ background: "rgba(255,255,255,0.08)", borderColor: "var(--color-border)", borderRadius: 3 }}>Enterprise</Badge>;
      case "Professional": return <Badge className="text-primary" style={{ background: "rgba(181,196,90,0.08)", borderColor: "rgba(181,196,90,0.2)", borderRadius: 3 }}>Professional</Badge>;
      case "Starter": return <Badge className="bg-secondary text-secondary-foreground">Starter</Badge>;
      default: return <Badge variant="secondary">{plan}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Product Management & Analytics</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="text-[#D95050]" style={{ background: "rgba(217,80,80,0.08)", borderColor: "rgba(217,80,80,0.25)", borderRadius: 3 }}>
              <div className="w-2 h-2 mr-2" style={{ background: "#D95050", borderRadius: 1 }}></div>
              Admin Access
            </Badge>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border hover:border-[#B5C45A]/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">Total Users</p>
                  <p className="text-2xl font-bold text-foreground">{liveMetrics.totalUsers.toLocaleString()}</p>
                </div>
                <div className="bg-[rgba(181,196,90,0.08)] p-3" style={{ borderRadius: 3 }}>
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <TrendingUp className="h-4 w-4 text-[#4CAF7D] mr-1" />
                <span className="text-sm text-[#4CAF7D]">+12% this month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border hover:border-[#B5C45A]/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#4CAF7D]">Revenue (MRR)</p>
                  <p className="text-2xl font-bold text-foreground">${liveMetrics.revenue.toLocaleString()}</p>
                </div>
                <div className="bg-[rgba(76,175,125,0.08)] p-3" style={{ borderRadius: 3 }}>
                  <BarChart3 className="h-6 w-6 text-[#4CAF7D]" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <TrendingUp className="h-4 w-4 text-[#4CAF7D] mr-1" />
                <span className="text-sm text-[#4CAF7D]">+{liveMetrics.revenueGrowth}% growth</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border hover:border-[#B5C45A]/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">Total Scans</p>
                  <p className="text-2xl font-bold text-foreground">{liveMetrics.totalScans.toLocaleString()}</p>
                </div>
                <div className="bg-[rgba(181,196,90,0.08)] p-3" style={{ borderRadius: 3 }}>
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-primary">+{liveMetrics.scansToday} today</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border hover:border-[#B5C45A]/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#E6A817]">System Health</p>
                  <p className="text-2xl font-bold text-foreground">{liveMetrics.systemHealth}%</p>
                </div>
                <div className="bg-[rgba(230,168,23,0.08)] p-3" style={{ borderRadius: 3 }}>
                  <Activity className="h-6 w-6 text-[#E6A817]" />
                </div>
              </div>
              <div className="mt-4">
                <Progress value={liveMetrics.systemHealth} className="h-2 bg-white/10" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="w-full grid grid-cols-5 rounded-none border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
            <TabsTrigger value="overview" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Overview</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Users</TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Performance</TabsTrigger>
            <TabsTrigger value="alerts" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Alerts</TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Performance Metrics */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-foreground">
                    <Zap className="h-5 w-5 text-primary" />
                    <span>Performance Metrics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">P50 Latency</span>
                    <span className="font-bold text-foreground">{liveMetrics.p50Latency.toFixed(2)}s</span>
                  </div>
                  <Progress value={Math.min(100, (2 - liveMetrics.p50Latency) * 50)} className="h-2 bg-white/10" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">P95 Latency</span>
                    <span className="font-bold text-foreground">{liveMetrics.p95Latency.toFixed(2)}s</span>
                  </div>
                  <Progress value={Math.min(100, (3 - liveMetrics.p95Latency) * 33)} className="h-2 bg-white/10" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Error Rate</span>
                    <span className="font-bold text-foreground">{liveMetrics.errorRate}%</span>
                  </div>
                  <Progress value={Math.max(0, 100 - liveMetrics.errorRate * 100)} className="h-2 bg-white/10" />
                </CardContent>
              </Card>

              {/* Resource Usage */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-foreground">
                    <Server className="h-5 w-5 text-primary" />
                    <span>Resource Usage</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Storage Used</span>
                    <span className="font-bold text-foreground">{liveMetrics.storageUsed}%</span>
                  </div>
                  <Progress value={liveMetrics.storageUsed} className="h-2 bg-white/10" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Connections</span>
                    <span className="font-bold text-foreground">{liveMetrics.activeUsers}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Fraud Blocked Today</span>
                    <span className="font-bold text-[#D95050]">{liveMetrics.fraudBlocked}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Recent Users</CardTitle>
                <CardDescription className="text-muted-foreground">Latest user registrations and activity</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-white/[0.02]">
                      <TableHead className="text-muted-foreground">User</TableHead>
                      <TableHead className="text-muted-foreground">Company</TableHead>
                      <TableHead className="text-muted-foreground">Plan</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground">Joined</TableHead>
                      <TableHead className="text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentUsers.map((user) => (
                      <TableRow key={user.id} className="border-border hover:bg-white/[0.02]">
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">{user.company}</TableCell>
                        <TableCell>{getPlanBadge(user.plan)}</TableCell>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell className="text-foreground">{user.joined}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" className="border-white/20 hover:bg-white/10 text-foreground bg-transparent">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">API Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Requests/min</span>
                      <span className="font-bold text-foreground">1,247</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Success Rate</span>
                      <span className="font-bold text-[#4CAF7D]">99.97%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Avg Response</span>
                      <span className="font-bold text-foreground">{liveMetrics.p50Latency.toFixed(2)}s</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Database</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Connections</span>
                      <span className="font-bold text-foreground">47/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Query Time</span>
                      <span className="font-bold text-foreground">12ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Storage</span>
                      <span className="font-bold text-foreground">{liveMetrics.storageUsed}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Security</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Threats Blocked</span>
                      <span className="font-bold text-[#D95050]">{liveMetrics.fraudBlocked}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Failed Logins</span>
                      <span className="font-bold text-foreground">8</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">SSL Score</span>
                      <span className="font-bold text-[#4CAF7D]">A+</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground">System Alerts</CardTitle>
                <CardDescription className="text-muted-foreground">Recent system events and notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-4 border border-border" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{alert.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">System Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button className="w-full border-white/20 hover:bg-white/10 text-foreground bg-transparent" variant="outline">
                    <Database className="h-4 w-4 mr-2" />
                    Database Maintenance
                  </Button>
                  <Button className="w-full border-white/20 hover:bg-white/10 text-foreground bg-transparent" variant="outline">
                    <Server className="h-4 w-4 mr-2" />
                    Server Configuration
                  </Button>
                  <Button className="w-full border-white/20 hover:bg-white/10 text-foreground bg-transparent" variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Security Settings
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button className="w-full border-white/20 hover:bg-white/10 text-foreground bg-transparent" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Export User Data
                  </Button>
                  <Button className="w-full border-white/20 hover:bg-white/10 text-foreground bg-transparent" variant="outline">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generate Reports
                  </Button>
                  <Button className="w-full border-white/20 hover:bg-white/10 text-foreground bg-transparent" variant="outline">
                    <Activity className="h-4 w-4 mr-2" />
                    System Health Check
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default AdminDashboard;
