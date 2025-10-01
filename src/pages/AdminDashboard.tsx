import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Users, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Activity,
  Database,
  Shield
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

interface DashboardStats {
  totalClaims: number;
  totalDocuments: number;
  totalReports: number;
  totalUsers: number;
  successRate: number;
  avgProcessingTime: number;
  pendingReviews: number;
  failedProcessing: number;
}

interface DocumentStatusData {
  name: string;
  value: number;
}

interface ClaimTypeData {
  name: string;
  count: number;
}

interface AIRecommendationData {
  date: string;
  approved: number;
  rejected: number;
  info_requested: number;
}

interface RecentActivity {
  id: string;
  claim_number: string;
  client_name: string;
  status: string;
  created_at: string;
  document_count: number;
}

const COLORS = {
  primary: "hsl(var(--chart-1))",
  success: "hsl(var(--chart-2))",
  warning: "hsl(var(--chart-3))",
  purple: "hsl(var(--chart-4))",
  danger: "hsl(var(--chart-5))",
};

const AdminDashboard = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalClaims: 0,
    totalDocuments: 0,
    totalReports: 0,
    totalUsers: 0,
    successRate: 0,
    avgProcessingTime: 0,
    pendingReviews: 0,
    failedProcessing: 0,
  });
  const [documentStatuses, setDocumentStatuses] = useState<DocumentStatusData[]>([]);
  const [claimTypes, setClaimTypes] = useState<ClaimTypeData[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendationData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch basic counts
      const [claimsRes, docsRes, reportsRes, usersRes] = await Promise.all([
        supabase.from("claims").select("*", { count: "exact" }),
        supabase.from("documents").select("*", { count: "exact" }),
        supabase.from("reports").select("*", { count: "exact" }),
        supabase.from("profiles").select("*", { count: "exact" }),
      ]);

      // Fetch document statuses
      const { data: docs } = await supabase.from("documents").select("status");
      const statusCounts: Record<string, number> = {};
      docs?.forEach((doc) => {
        statusCounts[doc.status] = (statusCounts[doc.status] || 0) + 1;
      });
      const statusData = Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
      }));

      // Fetch claim types
      const { data: claims } = await supabase.from("claims").select("claim_type");
      const typeCounts: Record<string, number> = {};
      claims?.forEach((claim) => {
        typeCounts[claim.claim_type] = (typeCounts[claim.claim_type] || 0) + 1;
      });
      const typeData = Object.entries(typeCounts).map(([name, count]) => ({
        name,
        count,
      }));

      // Fetch AI recommendations
      const { data: reports } = await supabase
        .from("reports")
        .select("recommendation, created_at")
        .order("created_at", { ascending: true });

      const recommendationsByDate: Record<string, any> = {};
      reports?.forEach((report) => {
        const date = new Date(report.created_at).toLocaleDateString("sk-SK");
        if (!recommendationsByDate[date]) {
          recommendationsByDate[date] = { date, approved: 0, rejected: 0, info_requested: 0 };
        }
        const rec = report.recommendation.toLowerCase();
        if (rec.includes("schváliť") || rec.includes("approve")) {
          recommendationsByDate[date].approved++;
        } else if (rec.includes("zamietnuť") || rec.includes("reject")) {
          recommendationsByDate[date].rejected++;
        } else {
          recommendationsByDate[date].info_requested++;
        }
      });
      const aiRecData = Object.values(recommendationsByDate);

      // Fetch recent activity
      const { data: recentClaims } = await supabase
        .from("claims")
        .select(`
          id,
          claim_number,
          client_name,
          status,
          created_at,
          documents:documents(count)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      const activityData = recentClaims?.map((claim: any) => ({
        id: claim.id,
        claim_number: claim.claim_number,
        client_name: claim.client_name,
        status: claim.status,
        created_at: claim.created_at,
        document_count: claim.documents[0]?.count || 0,
      })) || [];

      // Calculate success rate and pending reviews
      const successfulDocs = docs?.filter(
        (d) => d.status === "approved" || d.status === "report_generated"
      ).length || 0;
      const totalDocs = docs?.length || 1;
      const successRate = Math.round((successfulDocs / totalDocs) * 100);

      const pendingReviews = docs?.filter((d) => d.status === "ready_for_review").length || 0;
      const failedProcessing = 0; // No error status in current schema

      setStats({
        totalClaims: claimsRes.count || 0,
        totalDocuments: docsRes.count || 0,
        totalReports: reportsRes.count || 0,
        totalUsers: usersRes.count || 0,
        successRate,
        avgProcessingTime: 3.5, // TODO: Calculate from actual data
        pendingReviews,
        failedProcessing,
      });

      setDocumentStatuses(statusData);
      setClaimTypes(typeData);
      setAiRecommendations(aiRecData as AIRecommendationData[]);
      setRecentActivity(activityData);
    } catch (error: any) {
      toast({
        title: "Chyba pri načítaní dát",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Načítavam dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Komplexný prehľad systému a metriky
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            <Activity className="h-4 w-4 mr-1" />
            Real-time
          </Badge>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = "/admin/analysis-types"}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Typy analýz
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Spravovať typy AI analýz a systémové prompty</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = "/admin/knowledge-base"}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Vektorová znalostná báza
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Spravovať dokumenty a kontextové informácie</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = "/settings"}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Nastavenia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Používatelia a systémové nastavenia</p>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Celkový počet claims</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalClaims}</div>
              <p className="text-xs text-muted-foreground">Všetky poistné udalosti</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dokumenty</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalDocuments}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingReviews} čaká na schválenie
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Úspešnosť</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.successRate}%</div>
              <p className="text-xs text-muted-foreground">Úspešne spracované</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Používatelia</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Aktívni používatelia</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {(stats.pendingReviews > 0 || stats.failedProcessing > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {stats.pendingReviews > 0 && (
              <Card className="border-warning">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    Čakajú na schválenie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-warning">{stats.pendingReviews}</p>
                  <p className="text-xs text-muted-foreground">Dokumenty vyžadujú kontrolu</p>
                </CardContent>
              </Card>
            )}

            {stats.failedProcessing > 0 && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    Zlyhané spracovania
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-destructive">{stats.failedProcessing}</p>
                  <p className="text-xs text-muted-foreground">Vyžadujú pozornosť</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Charts Row 1 */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Stavy dokumentov</CardTitle>
              <CardDescription>Rozdelenie dokumentov podľa stavu</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={documentStatuses}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {documentStatuses.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={Object.values(COLORS)[index % Object.values(COLORS).length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typy poistných udalostí</CardTitle>
              <CardDescription>Počet claims podľa typu</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={claimTypes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="count" fill={COLORS.primary} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* AI Recommendations Chart */}
        <Card>
          <CardHeader>
            <CardTitle>AI Odporúčania v čase</CardTitle>
            <CardDescription>Trend AI analýz a odporúčaní</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={aiRecommendations}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="approved"
                  stackId="1"
                  stroke={COLORS.success}
                  fill={COLORS.success}
                  name="Schválené"
                />
                <Area
                  type="monotone"
                  dataKey="rejected"
                  stackId="1"
                  stroke={COLORS.danger}
                  fill={COLORS.danger}
                  name="Zamietnuté"
                />
                <Area
                  type="monotone"
                  dataKey="info_requested"
                  stackId="1"
                  stroke={COLORS.warning}
                  fill={COLORS.warning}
                  name="Vyžiadať info"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Posledná aktivita</CardTitle>
            <CardDescription>Najnovšie claims v systéme</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Číslo claim</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Dokumenty</TableHead>
                  <TableHead>Vytvorené</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.claim_number}</TableCell>
                    <TableCell>{activity.client_name}</TableCell>
                    <TableCell>
                      <StatusBadge status={activity.status} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{activity.document_count}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(activity.created_at).toLocaleDateString("sk-SK")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Statistics Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Súhrnné štatistiky</CardTitle>
            <CardDescription>Celkový prehľad systému</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Celkový počet reportov</p>
              <p className="text-3xl font-bold text-foreground">{stats.totalReports}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Priemerný čas spracovania</p>
              <p className="text-3xl font-bold text-foreground">{stats.avgProcessingTime}s</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Úspešnosť AI analýzy</p>
              <p className="text-3xl font-bold text-foreground">{stats.successRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
