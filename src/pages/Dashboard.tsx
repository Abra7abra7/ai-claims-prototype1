import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Calendar, Trash2, Clock, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";

interface Claim {
  id: string;
  claim_number: string;
  client_name: string;
  policy_number: string;
  claim_type: string;
  status: string;
  created_at: string;
}

interface DashboardStats {
  totalClaims: number;
  totalDocuments: number;
  totalReports: number;
  processingDocuments: number;
  completedDocuments: number;
  pendingReviews: number;
}

interface RecentDocument {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  claim_id: string;
  claim_number: string;
}

export default function Dashboard() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalClaims: 0,
    totalDocuments: 0,
    totalReports: 0,
    processingDocuments: 0,
    completedDocuments: 0,
    pendingReviews: 0,
  });
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newClaim, setNewClaim] = useState({
    claim_number: "",
    client_name: "",
    policy_number: "",
    claim_type: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
    checkAdminRole();
  }, []);

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch claims
      const { data: claimsData, error: claimsError } = await supabase
        .from("claims")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (claimsError) throw claimsError;
      setClaims(claimsData || []);

      // Fetch documents for stats
      const { data: docsData, error: docsError } = await supabase
        .from("documents")
        .select("*, claims!inner(created_by)")
        .eq("claims.created_by", user.id);

      if (docsError) throw docsError;

      // Fetch reports for stats
      const { data: reportsData, error: reportsError } = await supabase
        .from("reports")
        .select("*, claims!inner(created_by)")
        .eq("claims.created_by", user.id);

      if (reportsError) throw reportsError;

      // Calculate stats
      const processingDocs = docsData?.filter(
        (d) => d.status === "uploaded" || d.status === "ocr_processing" || d.status === "anonymizing"
      ).length || 0;

      const completedDocs = docsData?.filter(
        (d) => d.status === "approved" || d.status === "report_generated"
      ).length || 0;

      const pendingReviews = docsData?.filter((d) => d.status === "ready_for_review").length || 0;

      setStats({
        totalClaims: claimsData?.length || 0,
        totalDocuments: docsData?.length || 0,
        totalReports: reportsData?.length || 0,
        processingDocuments: processingDocs,
        completedDocuments: completedDocs,
        pendingReviews,
      });

      // Fetch recent documents with claim info
      const { data: recentDocs, error: recentError } = await supabase
        .from("documents")
        .select(`
          id,
          file_name,
          status,
          created_at,
          claim_id,
          claims!inner(claim_number, created_by)
        `)
        .eq("claims.created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      const formattedRecentDocs = recentDocs?.map((doc: any) => ({
        id: doc.id,
        file_name: doc.file_name,
        status: doc.status,
        created_at: doc.created_at,
        claim_id: doc.claim_id,
        claim_number: doc.claims.claim_number,
      })) || [];

      setRecentDocuments(formattedRecentDocs);
    } catch (error: any) {
      toast({
        title: "Chyba pri načítaní",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("claims").insert({
        ...newClaim,
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Poistná udalosť bola vytvorená",
      });

      setDialogOpen(false);
      setNewClaim({
        claim_number: "",
        client_name: "",
        policy_number: "",
        claim_type: "",
      });
      fetchDashboardData();
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClaim = async (claimId: string) => {
    try {
      const { error } = await supabase
        .from("claims")
        .delete()
        .eq("id", claimId);

      if (error) throw error;

      toast({
        title: "Claim zmazaný",
        description: "Poistná udalosť bola úspešne odstránená",
      });

      fetchDashboardData();
    } catch (error: any) {
      toast({
        title: "Chyba pri mazaní",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const completionRate =
    stats.totalDocuments > 0
      ? Math.round((stats.completedDocuments / stats.totalDocuments) * 100)
      : 0;

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Načítavam...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Prehľad vašich poistných udalostí a analýz
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nová poistná udalosť
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nová poistná udalosť</DialogTitle>
                <DialogDescription>
                  Vytvorte novú poistnú udalosť
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateClaim} className="space-y-4">
                <div>
                  <Label htmlFor="claim_number">Číslo poistnej udalosti</Label>
                  <Input
                    id="claim_number"
                    value={newClaim.claim_number}
                    onChange={(e) =>
                      setNewClaim({ ...newClaim, claim_number: e.target.value })
                    }
                    required
                    placeholder="PU-2025-001"
                  />
                </div>
                <div>
                  <Label htmlFor="client_name">Meno klienta</Label>
                  <Input
                    id="client_name"
                    value={newClaim.client_name}
                    onChange={(e) =>
                      setNewClaim({ ...newClaim, client_name: e.target.value })
                    }
                    required
                    placeholder="Jan Novák"
                  />
                </div>
                <div>
                  <Label htmlFor="policy_number">Číslo poistky</Label>
                  <Input
                    id="policy_number"
                    value={newClaim.policy_number}
                    onChange={(e) =>
                      setNewClaim({ ...newClaim, policy_number: e.target.value })
                    }
                    required
                    placeholder="POL-123456"
                  />
                </div>
                <div>
                  <Label htmlFor="claim_type">Typ poistnej udalosti</Label>
                  <Select
                    value={newClaim.claim_type}
                    onValueChange={(value) =>
                      setNewClaim({ ...newClaim, claim_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte typ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Úraz">Úraz</SelectItem>
                      <SelectItem value="Choroba">Choroba</SelectItem>
                      <SelectItem value="Invalidita">Invalidita</SelectItem>
                      <SelectItem value="Smrť">Smrť</SelectItem>
                      <SelectItem value="Hospitalizácia">Hospitalizácia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Vytváranie..." : "Vytvoriť"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Celkové claims</CardTitle>
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
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalDocuments}</div>
              <p className="text-xs text-muted-foreground">
                {stats.completedDocuments} dokončených
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">V spracovaní</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.processingDocuments}</div>
              <p className="text-xs text-muted-foreground">Práve sa spracovávajú</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Úspešnosť</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{completionRate}%</div>
              <p className="text-xs text-muted-foreground">Dokončených dokumentov</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Overview */}
        {stats.totalDocuments > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Prehľad spracovania</CardTitle>
              <CardDescription>Stav vašich dokumentov a analýz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Celkový progress</span>
                  <span className="font-medium">{completionRate}%</span>
                </div>
                <Progress value={completionRate} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-warning" />
                    <span className="text-2xl font-bold text-warning">
                      {stats.processingDocuments}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">V spracovaní</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <span className="text-2xl font-bold text-primary">
                      {stats.pendingReviews}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Čaká na kontrolu</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-2xl font-bold text-success">
                      {stats.completedDocuments}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Dokončené</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Documents */}
        {recentDocuments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Posledné dokumenty</CardTitle>
              <CardDescription>Najnovšie nahraté a spracované dokumenty</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    to={`/claim/${doc.claim_id}/document/${doc.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.claim_number} • {format(new Date(doc.created_at), "d. MMM yyyy", { locale: sk })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={doc.status} />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Claims List */}
        <Card>
          <CardHeader>
            <CardTitle>Vaše poistné udalosti</CardTitle>
            <CardDescription>Všetky claims ktoré ste vytvorili</CardDescription>
          </CardHeader>
          <CardContent>
            {claims.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Zatiaľ nemáte žiadne poistné udalosti</p>
              </div>
            ) : (
              <div className="space-y-3">
                {claims.map((claim) => (
                  <div key={claim.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors">
                    <Link to={`/claim/${claim.id}`} className="flex items-center gap-3 flex-1">
                      <div className="flex-1">
                        <div className="font-medium">{claim.claim_number}</div>
                        <div className="text-sm text-muted-foreground">
                          {claim.client_name} • {claim.claim_type}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(claim.created_at), "d. MMMM yyyy", { locale: sk })}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={claim.status} />
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive h-8 w-8"
                              onClick={(e) => e.preventDefault()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Zmazať claim</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ste si istí, že chcete zmazať claim "{claim.claim_number}"? Táto akcia zmaže aj všetky súvisiace dokumenty a reporty. Táto akcia sa nedá vrátiť späť.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Zrušiť</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteClaim(claim.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Zmazať
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
