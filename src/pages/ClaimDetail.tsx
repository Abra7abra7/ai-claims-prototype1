import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, FileText, Calendar, Trash2 } from "lucide-react";
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

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  status: string;
  created_at: string;
}

interface FinalReport {
  id: string;
  created_at: string;
}

export default function ClaimDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchClaimDetail();
    checkAdminRole();
  }, [id]);

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

  const fetchClaimDetail = async () => {
    try {
      const [claimResult, docsResult, reportResult] = await Promise.all([
        supabase.from("claims").select("*").eq("id", id).maybeSingle(),
        supabase.from("documents").select("*").eq("claim_id", id).order("created_at", { ascending: false }),
        supabase.from("reports").select("id, created_at").eq("claim_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (claimResult.error) throw claimResult.error;
      if (docsResult.error) throw docsResult.error;

      setClaim(claimResult.data);
      setDocuments(docsResult.data || []);
      setFinalReport(reportResult.data);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileArray = Array.from(files);
      let successCount = 0;
      let errorCount = 0;

      for (const file of fileArray) {
        try {
          // Upload file to storage
          const fileExt = file.name.split(".").pop();
          const filePath = `${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Create document record
          const { error: dbError } = await supabase.from("documents").insert({
            claim_id: id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
            status: "uploaded",
          });

          if (dbError) throw dbError;
          successCount++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          errorCount++;
        }
      }

      toast({
        title: successCount > 0 ? "Úspech" : "Chyba",
        description: `Nahrané: ${successCount}, Chyby: ${errorCount}`,
        variant: errorCount > 0 ? "destructive" : "default",
      });

      setDialogOpen(false);
      fetchClaimDetail();
    } catch (error: any) {
      toast({
        title: "Chyba pri nahrávaní",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleBatchProcess = async () => {
    if (documents.length === 0) {
      toast({
        title: "Žiadne dokumenty",
        description: "Najprv nahrajte dokumenty",
        variant: "destructive",
      });
      return;
    }

    const unprocessedDocs = documents.filter(doc => doc.status === "uploaded");
    if (unprocessedDocs.length === 0) {
      toast({
        title: "Všetky dokumenty už sú spracované",
        variant: "default",
      });
      return;
    }

    toast({
      title: "Hromadné spracovanie spustené",
      description: `Spracováva sa ${unprocessedDocs.length} dokumentov...`,
    });

    // Redirect to first document for processing
    window.location.href = `/claim/${id}/batch-process`;
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;

      toast({
        title: "Dokument zmazaný",
        description: "Dokument bol úspešne odstránený",
      });

      fetchClaimDetail();
    } catch (error: any) {
      toast({
        title: "Chyba pri mazaní",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Načítavam...</div>
      </Layout>
    );
  }

  if (!claim) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Poistná udalosť nebola nájdená</p>
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Späť na dashboard
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{claim.claim_number}</h1>
            <p className="text-muted-foreground mt-1">
              {claim.client_name} • {claim.claim_type}
            </p>
          </div>
          <StatusBadge status={claim.status} />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Informácie o poistnej udalosti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Číslo poistnej udalosti</p>
                <p className="font-medium">{claim.claim_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Klient</p>
                <p className="font-medium">{claim.client_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Číslo poistky</p>
                <p className="font-medium">{claim.policy_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Typ</p>
                <p className="font-medium">{claim.claim_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vytvorené</p>
                <p className="font-medium">
                  {format(new Date(claim.created_at), "d. MMMM yyyy, HH:mm", {
                    locale: sk,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Dokumenty</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Nahrať
                      </Button>
                    </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nahrať dokument</DialogTitle>
                      <DialogDescription>
                        Nahrajte lekársku správu alebo iný dokument
                      </DialogDescription>
                    </DialogHeader>
                    <div>
                      <Label htmlFor="file">Súbory (môžete vybrať viac naraz)</Label>
                      <Input
                        id="file"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.tiff"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        multiple
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        Podporované formáty: PDF, JPG, PNG, TIFF (max 20MB na súbor)
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
                {documents.length > 0 && (
                  <>
                    <Button size="sm" variant="secondary" onClick={handleBatchProcess}>
                      Spracovať všetky
                    </Button>
                    {finalReport ? (
                      <Button size="sm" onClick={() => navigate(`/claim/${id}/final-report`)}>
                        Zobraziť finálny report
                      </Button>
                    ) : documents.every(doc => doc.status === "approved") && (
                      <Button size="sm" onClick={() => navigate(`/claim/${id}/final-report`)}>
                        Vygenerovať finálny report
                      </Button>
                    )}
                  </>
                )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Zatiaľ neboli nahrané žiadne dokumenty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors">
                      <Link to={`/claim/${id}/document/${doc.id}`} className="flex items-center gap-3 flex-1">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(doc.created_at), "d. MMM yyyy, HH:mm", {
                              locale: sk,
                            })}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={doc.status} />
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Zmazať dokument</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Ste si istí, že chcete zmazať dokument "{doc.file_name}"? Táto akcia sa nedá vrátiť späť.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Zrušiť</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDocument(doc.id)}
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
      </div>
    </Layout>
  );
}
