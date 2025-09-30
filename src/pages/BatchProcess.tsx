import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

interface Document {
  id: string;
  file_name: string;
  status: string;
}

export default function BatchProcess() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, [id]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("claim_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        title: "Chyba pri načítaní",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const simulateOCR = async (docId: string, fileName: string) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const simulatedText = `LEKÁRSKA SPRÁVA - ${fileName}
    
Pacient: Ján Novák
Rodné číslo: 850101/1234
Adresa: Hlavná 123, 811 01 Bratislava
Telefón: +421 912 345 678

Dátum vyšetrenia: ${new Date().toLocaleDateString('sk-SK')}

Diagnóza: Zlomenina predlaktia vpravo (S52.5)

Anamnéza:
Pacient prišiel na vyšetrenie po páde z bicykla. Udáva bolesť v oblasti pravého predlaktia a obmedzenú pohyblivosť.

Objektívne vyšetrenie:
Zjavná deformita v oblasti pravého predlaktia, otok, hematóm. Distálna cirkulácia a senzitivita zachovaná.

RTG vyšetrenie:
Potvrdená zlomenina distálneho rádia s dislokáciou.

Liečba:
Vykonaná repozícia a imobilizácia sádrovou dlahou. Odporúčaná kontrola u ortopéda po 7 dňoch.

Práceneschopnosť: 6 týždňov

MUDr. Peter Horák
Traumatológia`;

    await supabase
      .from("documents")
      .update({ status: "ocr_complete" })
      .eq("id", docId);

    await supabase
      .from("processed_documents")
      .upsert({
        document_id: docId,
        ocr_text: simulatedText,
      });

    return simulatedText;
  };

  const simulateAnonymization = async (docId: string, ocrText: string) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const anonymizedText = ocrText
      .replace(/Ján Novák/g, "[MENO]")
      .replace(/850101\/1234/g, "[RODNÉ_ČÍSLO]")
      .replace(/Hlavná 123, 811 01 Bratislava/g, "[ADRESA]")
      .replace(/\+421 912 345 678/g, "[TELEFÓN]")
      .replace(/MUDr\. Peter Horák/g, "[LEKÁR]");

    await supabase
      .from("documents")
      .update({ status: "approved" })
      .eq("id", docId);

    await supabase
      .from("processed_documents")
      .update({
        anonymized_text: anonymizedText,
        reviewed_text: anonymizedText,
      })
      .eq("document_id", docId);

    return anonymizedText;
  };

  const generateReport = async (docId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: processedDoc } = await supabase
      .from("processed_documents")
      .select("reviewed_text")
      .eq("document_id", docId)
      .maybeSingle();

    if (!processedDoc?.reviewed_text) throw new Error("No reviewed text found");

    const { data: claim } = await supabase
      .from("claims")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const { data: contexts } = await supabase
      .from("insurance_context")
      .select("*")
      .eq("is_active", true);

    const { data: aiResponse, error: aiError } = await supabase.functions.invoke("generate-report", {
      body: {
        documentText: processedDoc.reviewed_text,
        claimInfo: claim,
        insuranceContexts: contexts,
      },
    });

    if (aiError) throw aiError;

    await supabase.from("reports").insert({
      document_id: docId,
      claim_id: id,
      summary: aiResponse.summary,
      relevance_analysis: aiResponse.relevance_analysis,
      exclusions_analysis: aiResponse.exclusions_analysis,
      recommendation: aiResponse.recommendation,
      justification: aiResponse.justification,
      generated_by: user.id,
    });

    await supabase
      .from("documents")
      .update({ status: "report_generated" })
      .eq("id", docId);
  };

  const processAllDocuments = async () => {
    setProcessing(true);
    const unprocessedDocs = documents.filter(doc => doc.status === "uploaded");
    
    for (let i = 0; i < unprocessedDocs.length; i++) {
      const doc = unprocessedDocs[i];
      setCurrentIndex(i);
      setProgress(((i) / unprocessedDocs.length) * 100);

      try {
        toast({
          title: `Spracováva sa ${doc.file_name}`,
          description: "OCR extrakcia...",
        });

        const ocrText = await simulateOCR(doc.id, doc.file_name);

        toast({
          title: `Spracováva sa ${doc.file_name}`,
          description: "Anonymizácia...",
        });

        await simulateAnonymization(doc.id, ocrText);

        toast({
          title: `Spracováva sa ${doc.file_name}`,
          description: "Generovanie AI reportu...",
        });

        await generateReport(doc.id);

        toast({
          title: "Dokončené",
          description: `${doc.file_name} bol úspešne spracovaný`,
        });

      } catch (error: any) {
        console.error(`Error processing ${doc.file_name}:`, error);
        toast({
          title: "Chyba",
          description: `Chyba pri spracovaní ${doc.file_name}: ${error.message}`,
          variant: "destructive",
        });
      }
    }

    setProgress(100);
    setProcessing(false);

    toast({
      title: "Hromadné spracovanie dokončené",
      description: `Spracovaných ${unprocessedDocs.length} dokumentov`,
    });

    await fetchDocuments();
  };

  useEffect(() => {
    if (documents.length > 0 && !processing) {
      const unprocessed = documents.filter(doc => doc.status === "uploaded");
      if (unprocessed.length > 0) {
        processAllDocuments();
      }
    }
  }, [documents.length]);

  const allProcessed = documents.every(doc => doc.status === "report_generated");

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
            <h1 className="text-2xl font-bold text-foreground">Hromadné spracovanie dokumentov</h1>
            <p className="text-muted-foreground mt-1">Automatická OCR, anonymizácia a AI analýza</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Priebeh spracovania</CardTitle>
            <CardDescription>
              {processing ? (
                <>Spracováva sa dokument {currentIndex + 1} z {documents.length}</>
              ) : allProcessed ? (
                "Všetky dokumenty boli úspešne spracované"
              ) : (
                "Pripravené na spracovanie"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="w-full" />
            
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {doc.status === "report_generated" ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : processing && index === currentIndex ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted" />
                    )}
                    <span className="font-medium">{doc.file_name}</span>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
              ))}
            </div>

            {allProcessed && (
              <div className="flex gap-2 pt-4">
                <Button onClick={() => navigate(`/claim/${id}`)} className="flex-1">
                  Späť na poistnú udalosť
                </Button>
                <Button
                  onClick={() => navigate(`/claim/${id}/reports`)}
                  variant="outline"
                  className="flex-1"
                >
                  Zobraziť reporty
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
