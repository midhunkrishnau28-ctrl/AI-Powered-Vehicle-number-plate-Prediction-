import { useReports } from "@/hooks/use-reports";
import { Link } from "wouter";
import { LayoutShell } from "@/components/layout-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BarChart3, Clock, AlertTriangle, Search, Plus, Video } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export default function Dashboard() {
  const { data: reports, isLoading } = useReports();

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </LayoutShell>
    );
  }

  const recentReports = reports?.slice(0, 5) || [];
  const total = reports?.length || 0;
  const pending = reports?.filter(r => r.status === 'pending').length || 0;
  const completed = reports?.filter(r => r.status === 'completed').length || 0;

  // Mock data for chart
  const chartData = [
    { name: 'Mon', value: 4 },
    { name: 'Tue', value: 3 },
    { name: 'Wed', value: 7 },
    { name: 'Thu', value: 5 },
    { name: 'Fri', value: 8 },
    { name: 'Sat', value: 2 },
    { name: 'Sun', value: 1 },
  ];

  return (
    <LayoutShell>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Command Center</h1>
          <p className="text-muted-foreground mt-1">Real-time surveillance and analysis overview.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/video">
            <Button size="lg" variant="outline" className="shadow-lg">
              <Video className="mr-2 h-5 w-5" />
              Video Analysis
            </Button>
          </Link>
          <Link href="/new">
            <Button size="lg" className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-5 w-5" />
              Image Analysis
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Reports</p>
                <h3 className="text-3xl font-bold font-mono">{total}</h3>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Processed</p>
                <h3 className="text-3xl font-bold font-mono text-green-600">{completed}</h3>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Search className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Pending</p>
                <h3 className="text-3xl font-bold font-mono text-yellow-600">{pending}</h3>
              </div>
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Alerts</p>
                <h3 className="text-3xl font-bold font-mono text-red-600">0</h3>
              </div>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/20">
              <CardTitle className="text-lg">Recent Analysis Requests</CardTitle>
              <Link href="/history">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                  View All <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentReports.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 opacity-50" />
                  </div>
                  <p>No reports found. Start a new analysis.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentReports.map((report) => (
                    <div key={report.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center gap-4">
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 border border-border">
                        <img src={report.imageUrl || ""} alt="Vehicle" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm truncate">{report.originalFilename || "Unknown"}</h4>
                          <StatusBadge status={report.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {report.createdAt ? new Date(report.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'long',
                            timeStyle: 'short',
                            timeZone: 'Asia/Kolkata'
                          }) : 'Unknown Date'}
                        </p>
                        {report.predictedNumberPlate && (
                          <div className="mt-1 inline-block bg-yellow-400 text-black px-2 py-0.5 rounded text-xs font-mono font-bold border-2 border-black/80">
                            {report.predictedNumberPlate}
                          </div>
                        )}
                      </div>
                      <Link href={`/report/${report.id}`}>
                        <Button variant="outline" size="sm">Details</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Analytics Chart */}
        <div className="lg:col-span-1">
          <Card className="h-full shadow-md">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg">Weekly Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="name"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      stroke="#888888"
                    />
                    <YAxis
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      stroke="#888888"
                    />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar
                      dataKey="value"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      barSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm text-muted-foreground text-center">
                Processing volume is <span className="text-green-600 font-bold">+12%</span> vs last week.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </LayoutShell>
  );
}
