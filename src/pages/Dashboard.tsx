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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Calendar, Trash2, Clock, CheckCircle, AlertCircle, TrendingUp, LayoutGrid, List, Search } from "lucide-react";
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

interface ClaimWithDetails extends Claim {
  totalDocuments: number;
  uploadedDocs: number;
  processingDocs: number;
  readyForReviewDocs: number;
  approvedDocs: number;
  reportGeneratedDocs: number;
  totalReports: number;
  workflowStatus: string;
  workflowLabel: string;
  progressPercent: number;
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
  const [claimsWithDetails, setClaimsWithDetails] = useState<ClaimWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [newClaim, setNewClaim] = useState({
    claim_number: "",
    client_name: "",
    policy_number: "",
    claim_type: "",
  });
  const { toast } = useToast();

  const filteredClaims = claimsWithDetails.filter((claim) => {
    const query = searchQuery.toLowerCase();
    return (
      claim.claim_number.toLowerCase().includes(query) ||
      claim.client_name.toLowerCase().includes(query) ||
      claim.policy_number.toLowerCase().includes(query) ||
      claim.claim_type.toLowerCase().includes(query)
    );
  });

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

  const getWorkflowStatus = (
    totalDocs: number,
    uploadedDocs: number,
    processingDocs: number,
    readyForReviewDocs: number,
    approvedDocs: number,
    reportGeneratedDocs: number,
    totalReports: number
  ) => {
    if (totalDocs === 0) {
      return {
        status: "no_documents",
        label: "Čaká na dokumenty",
        percent: 0,
      };
    }

    if (reportGeneratedDocs === totalDocs && totalReports === totalDocs) {
      return {
        status: "analysis_complete",
        label: "Analýza dokončená",
        percent: 100,
      };
    }

    if (approvedDocs === totalDocs && totalReports > 0) {
      return {
        status: "analysis_in_progress",
        label: "Analýza prebieha",
        percent: 75 + (totalReports / totalDocs) * 25,
      };
    }

    if (approvedDocs === totalDocs) {
      return {
        status: "awaiting_analysis",
        label: "Čaká na analýzu",
        percent: 75,
      };
    }

    if (readyForReviewDocs > 0) {
      return {
        status: "pending_approval",
        label: "Čaká na schválenie",
        percent: 50 + ((approvedDocs + readyForReviewDocs) / totalDocs) * 25,
      };
    }

    if (processingDocs > 0 || uploadedDocs > 0) {
      return {
        status: "processing",
        label: "Dokumenty sa spracovávajú",
        percent: ((totalDocs - processingDocs - uploadedDocs) / totalDocs) * 50,
      };
    }

    return {
      status: "unknown",
      label: "Neznámy stav",
      percent: 0,
    };
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

      // Fetch all documents
      const { data: docsData, error: docsError } = await supabase
        .from("documents")
        .select("*, claims!inner(created_by)")
        .eq("claims.created_by", user.id);

      if (docsError) throw docsError;

      // Fetch all reports
      const { data: reportsData, error: reportsError } = await supabase
        .from("reports")
        .select("*, claims!inner(created_by)")
        .eq("claims.created_by", user.id);

      if (reportsError) throw reportsError;

      // Build claims with details
      const claimsWithDetailsData: ClaimWithDetails[] = (claimsData || []).map((claim) => {
        const claimDocs = docsData?.filter((d) => d.claim_id === claim.id) || [];
        const claimReports = reportsData?.filter((r) => r.claim_id === claim.id) || [];

        const totalDocuments = claimDocs.length;
        const uploadedDocs = claimDocs.filter((d) => d.status === "uploaded").length;
        const processingDocs = claimDocs.filter(
          (d) => d.status === "ocr_processing" || d.status === "anonymizing" || d.status === "ocr_complete" || d.status === "anonymized"
        ).length;
        const readyForReviewDocs = claimDocs.filter((d) => d.status === "ready_for_review").length;
        const approvedDocs = claimDocs.filter((d) => d.status === "approved").length;
        const reportGeneratedDocs = claimDocs.filter((d) => d.status === "report_generated").length;
        const totalReports = claimReports.length;

        const workflow = getWorkflowStatus(
          totalDocuments,
          uploadedDocs,
          processingDocs,
          readyForReviewDocs,
          approvedDocs,
          reportGeneratedDocs,
          totalReports
        );

        return {
          ...claim,
          totalDocuments,
          uploadedDocs,
          processingDocs,
          readyForReviewDocs,
          approvedDocs,
          reportGeneratedDocs,
          totalReports,
          workflowStatus: workflow.status,
          workflowLabel: workflow.label,
          progressPercent: workflow.percent,
        };
      });

      setClaimsWithDetails(claimsWithDetailsData);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "no_documents":
        return <FileText className="h-5 w-5 text-muted-foreground" />;
      case "processing":
        return <Clock className="h-5 w-5 text-warning animate-pulse" />;
      case "pending_approval":
        return <AlertCircle className="h-5 w-5 text-primary" />;
      case "awaiting_analysis":
        return <Clock className="h-5 w-5 text-primary" />;
      case "analysis_in_progress":
        return <TrendingUp className="h-5 w-5 text-primary animate-pulse" />;
      case "analysis_complete":
        return <CheckCircle className="h-5 w-5 text-success" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

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
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
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

        {/* Search and View Toggle */}
        {claimsWithDetails.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hľadať podľa čísla, mena, poistky alebo typu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "cards" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Karty
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4 mr-2" />
                Tabuľka
              </Button>
            </div>
          </div>
        )}

        {/* Claims with Workflow Status */}
        {claimsWithDetails.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Zatiaľ nemáte žiadne poistné udalosti</h3>
              <p className="text-muted-foreground mb-4">
                Vytvorte svoju prvú poistnú udalosť a začnite nahrávať dokumenty
              </p>
            </CardContent>
          </Card>
        ) : filteredClaims.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Žiadne výsledky</h3>
              <p className="text-muted-foreground mb-4">
                Skúste zmeniť vyhľadávacie kritériá
              </p>
            </CardContent>
          </Card>
        ) : viewMode === "cards" ? (
          <div className="grid gap-6 md:grid-cols-2">
            {filteredClaims.map((claim) => (
              <Card key={claim.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-lg">{claim.claim_number}</CardTitle>
                      <CardDescription className="text-sm">
                        {claim.client_name} • {claim.policy_number}
                      </CardDescription>
                    </div>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Zmazať poistnú udalosť</AlertDialogTitle>
                            <AlertDialogDescription>
                              Naozaj chcete zmazať túto poistnú udalosť? Táto akcia je nenávratná.
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
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Workflow Status */}
                  <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                    {getStatusIcon(claim.workflowStatus)}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{claim.workflowLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {claim.totalDocuments === 0
                          ? "Žiadne dokumenty"
                          : `${claim.approvedDocs + claim.reportGeneratedDocs}/${claim.totalDocuments} dokumentov spracovaných`}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {claim.claim_type}
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  {claim.totalDocuments > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Celkový progress</span>
                        <span className="font-medium">{Math.round(claim.progressPercent)}%</span>
                      </div>
                      <Progress value={claim.progressPercent} className="h-2" />
                    </div>
                  )}

                  {/* Document Breakdown */}
                  {claim.totalDocuments > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {claim.uploadedDocs > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Nahrané: <span className="font-medium text-foreground">{claim.uploadedDocs}</span>
                          </span>
                        </div>
                      )}
                      {claim.processingDocs > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-warning/10 rounded">
                          <Clock className="h-3 w-3 text-warning" />
                          <span className="text-muted-foreground">
                            Spracovávajú sa: <span className="font-medium text-warning">{claim.processingDocs}</span>
                          </span>
                        </div>
                      )}
                      {claim.readyForReviewDocs > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded">
                          <AlertCircle className="h-3 w-3 text-primary" />
                          <span className="text-muted-foreground">
                            Na kontrolu: <span className="font-medium text-primary">{claim.readyForReviewDocs}</span>
                          </span>
                        </div>
                      )}
                      {claim.approvedDocs > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-success/10 rounded">
                          <CheckCircle className="h-3 w-3 text-success" />
                          <span className="text-muted-foreground">
                            Schválené: <span className="font-medium text-success">{claim.approvedDocs}</span>
                          </span>
                        </div>
                      )}
                      {claim.totalReports > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-success/10 rounded col-span-2">
                          <TrendingUp className="h-3 w-3 text-success" />
                          <span className="text-muted-foreground">
                            Analýzy: <span className="font-medium text-success">{claim.totalReports}/{claim.totalDocuments}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Link to={`/claim/${claim.id}`} className="flex-1">
                      <Button variant="default" className="w-full" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Zobraziť detail
                      </Button>
                    </Link>
                    {claim.workflowStatus === "analysis_complete" && claim.totalReports > 0 && (
                      <Link to={`/claim/${claim.id}/final-report`} className="flex-1">
                        <Button variant="secondary" className="w-full" size="sm">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Zobraziť analýzu
                        </Button>
                      </Link>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Vytvorené: {format(new Date(claim.created_at), "d. MMMM yyyy", { locale: sk })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Číslo PU</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Číslo poistky</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Dokumenty</TableHead>
                  <TableHead>Vytvorené</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">{claim.claim_number}</TableCell>
                    <TableCell>{claim.client_name}</TableCell>
                    <TableCell>{claim.policy_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {claim.claim_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(claim.workflowStatus)}
                        <span className="text-sm">{claim.workflowLabel}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={claim.progressPercent} className="h-2 flex-1" />
                        <span className="text-xs font-medium min-w-[35px]">
                          {Math.round(claim.progressPercent)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{claim.approvedDocs + claim.reportGeneratedDocs}</span>
                        <span className="text-muted-foreground">/{claim.totalDocuments}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(claim.created_at), "d.M.yyyy", { locale: sk })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link to={`/claim/${claim.id}`}>
                          <Button variant="ghost" size="sm">
                            Detail
                          </Button>
                        </Link>
                        {claim.workflowStatus === "analysis_complete" && claim.totalReports > 0 && (
                          <Link to={`/claim/${claim.id}/final-report`}>
                            <Button variant="ghost" size="sm">
                              Analýza
                            </Button>
                          </Link>
                        )}
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Zmazať poistnú udalosť</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Naozaj chcete zmazať túto poistnú udalosť? Táto akcia je nenávratná.
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </Layout>
  );
}
