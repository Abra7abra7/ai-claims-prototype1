import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, FileText, Sparkles } from "lucide-react";

interface Document {
  id: string;
  file_name: string;
  status: string;
  claim_id: string;
}

interface ProcessedDocument {
  ocr_text: string | null;
  anonymized_text: string | null;
  cleaned_text: string | null;
  reviewed_text: string | null;
}

export default function DocumentProcessor() {
  const { id, docId } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [processedDoc, setProcessedDoc] = useState<ProcessedDocument | null>(null);
  const [editedText, setEditedText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocument();
  }, [docId]);

  const fetchDocument = async () => {
    try {
      const [docResult, processedResult] = await Promise.all([
        supabase.from("documents").select("*").eq("id", docId).maybeSingle(),
        supabase.from("processed_documents").select("*").eq("document_id", docId).maybeSingle(),
      ]);

      if (docResult.error) throw docResult.error;
      
      setDocument(docResult.data);
      setProcessedDoc(processedResult.data);
      
      if (processedResult.data) {
        setEditedText(
          processedResult.data.reviewed_text || 
          processedResult.data.cleaned_text || 
          processedResult.data.anonymized_text || 
          ""
        );
      }
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

  const simulateOCR = async () => {
    if (!docId) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-document-ocr", {
        body: { documentId: docId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update local state
      await supabase
        .from("documents")
        .update({ status: "ocr_complete" })
        .eq("id", docId);

      await supabase
        .from("processed_documents")
        .upsert({ document_id: docId, ocr_text: data.text });

      toast({ title: "OCR dokončené", description: `Extrahovaných znakov: ${data.characterCount}` });

      // Auto-run anonymization
      await simulateAnonymization(data.text);
    } catch (error: any) {
      toast({ title: "Chyba OCR", description: error.message, variant: "destructive" });
    } finally {
      await fetchDocument();
      setProcessing(false);
    }
  };

  const simulateAnonymization = async (ocrText: string) => {
    if (!docId) return;
    setProcessing(true);
    try {
      // Invoke real anonymization
      const { data, error } = await supabase.functions.invoke("anonymize-document", {
        body: { documentId: docId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await supabase
        .from("documents")
        .update({ status: "anonymized" })
        .eq("id", docId);

      await supabase
        .from("processed_documents")
        .update({ anonymized_text: data.text })
        .eq("document_id", docId);

      setEditedText(data.text);

      toast({ 
        title: "Anonymizácia dokončená", 
        description: "Citlivé údaje boli odstránené. Teraz môžete vyčistiť text." 
      });

      // Auto-run text cleaning
      await cleanAnonymizedText();
    } catch (error: any) {
      toast({ title: "Chyba anonymizácie", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const cleanAnonymizedText = async () => {
    if (!docId) return;
    
    if (!processedDoc?.anonymized_text) {
      toast({ 
        title: "Nemožno vyčistiť text", 
        description: "Najprv musí byť dokument anonymizovaný",
        variant: "destructive" 
      });
      return;
    }

    setProcessing(true);
    try {
      console.log("Starting text cleaning for document:", docId);
      
      const { data, error } = await supabase.functions.invoke("clean-anonymized-text", {
        body: { documentId: docId },
      });

      console.log("Cleaning response:", { data, error });

      if (error) {
        console.error("Cleaning error:", error);
        throw error;
      }
      if (data?.error) {
        console.error("Cleaning data error:", data.error);
        throw new Error(data.error);
      }

      // Update document status only if it's not already approved
      if (document?.status !== "approved") {
        await supabase
          .from("documents")
          .update({ status: "ready_for_review" })
          .eq("id", docId);
      }

      await supabase
        .from("processed_documents")
        .update({ cleaned_text: data.cleanedText })
        .eq("document_id", docId);

      setEditedText(data.cleanedText);

      toast({ 
        title: "Text vyčistený", 
        description: "Gramatické chyby a preklepy boli opravené" 
      });

      await fetchDocument();
    } catch (error: any) {
      console.error("Text cleaning failed:", error);
      toast({ 
        title: "Chyba pri čistení textu", 
        description: error.message || "Neznáma chyba pri čistení textu", 
        variant: "destructive" 
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Update processed document
      const { error } = await supabase
        .from("processed_documents")
        .update({
          reviewed_text: editedText,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("document_id", docId);

      if (error) throw error;

      // Update document status
      await supabase
        .from("documents")
        .update({ status: "approved" })
        .eq("id", docId);

      toast({
        title: "Schválené",
        description: "Text bol schválený a je pripravený na generovanie reportu",
      });

      fetchDocument();
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateReport = () => {
    navigate(`/claim/${id}/document/${docId}/report`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Načítavam...</div>
      </Layout>
    );
  }

  if (!document) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Dokument nebol nájdený</p>
          <Link to={`/claim/${id}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Späť
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
          <Link to={`/claim/${id}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{document.file_name}</h1>
            <p className="text-muted-foreground mt-1">Spracovanie dokumentu</p>
          </div>
          <StatusBadge status={document.status} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Workflow spracovania</CardTitle>
            <CardDescription>
              Sledujte postup spracovania dokumentu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {document.status === "uploaded" && (
              <Button onClick={simulateOCR} disabled={processing} className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                {processing ? "Spracovávam OCR..." : "Spustiť OCR spracovanie"}
              </Button>
            )}

              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      OCR text (pôvodný)
                    </label>
                    <Textarea
                      value={processedDoc?.ocr_text || ""}
                      readOnly
                      rows={20}
                      className="font-mono text-sm bg-muted"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Anonymizovaný text
                    </label>
                    <Textarea
                      value={processedDoc?.anonymized_text || ""}
                      readOnly
                      rows={20}
                      className="font-mono text-sm bg-muted"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">
                        Vyčistený text (upraviteľný)
                      </label>
                      {!processedDoc?.cleaned_text && processedDoc?.anonymized_text && (
                        <span className="text-xs text-warning">Čaká na vyčistenie</span>
                      )}
                    </div>
                    <Textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      rows={20}
                      className="font-mono text-sm"
                      disabled={document.status === "approved"}
                      placeholder={
                        !processedDoc?.anonymized_text 
                          ? "Text sa zobrazí po anonymizácii..." 
                          : !processedDoc?.cleaned_text
                          ? "Kliknite na tlačidlo 'Vyčistiť text' pre opravu gramatiky"
                          : ""
                      }
                    />
                  </div>
                </div>

                {/* Manual cleaning button - shown when anonymized text exists but cleaned text doesn't */}
                {processedDoc?.anonymized_text && !processedDoc?.cleaned_text && (
                  <Button 
                    onClick={cleanAnonymizedText} 
                    disabled={processing} 
                    variant="secondary"
                    className="w-full"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {processing ? "Čistím text..." : "Vyčistiť text (opraviť gramatiku)"}
                  </Button>
                )}

                {/* Re-clean button - shown when cleaned text exists but user wants to re-run */}
                {processedDoc?.cleaned_text && document.status !== "approved" && (
                  <Button 
                    onClick={cleanAnonymizedText} 
                    disabled={processing} 
                    variant="outline"
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {processing ? "Znovu čistím text..." : "Znovu vyčistiť text"}
                  </Button>
                )}

                {document.status === "ready_for_review" && (
                  <Button onClick={handleApprove} disabled={processing} className="w-full">
                    <Check className="h-4 w-4 mr-2" />
                    {processing ? "Schvaľujem..." : "Schváliť dokument"}
                  </Button>
                )}

                {document.status === "approved" && (
                  <div className="p-4 bg-success/10 border border-success rounded-lg">
                    <p className="text-success font-medium">
                      ✓ Dokument bol schválený a je pripravený na finálnu analýzu
                    </p>
                  </div>
                )}
              </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
