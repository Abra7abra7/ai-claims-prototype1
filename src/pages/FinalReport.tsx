import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Loader2, Sparkles } from "lucide-react";

interface Document {
  id: string;
  file_name: string;
}

interface ProcessedDocument {
  reviewed_text: string;
}

interface InsuranceContext {
  id: string;
  title: string;
  content: string;
  context_type: string;
}

interface Report {
  id?: string;
  summary: string;
  relevance_analysis: string;
  exclusions_analysis: string;
  recommendation: string;
  justification: string;
  created_at?: string;
}

export default function FinalReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contexts, setContexts] = useState<InsuranceContext[]>([]);
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      // First check if a report already exists
      const { data: existingReport, error: reportError } = await supabase
        .from("reports")
        .select("*")
        .eq("claim_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reportError && reportError.code !== "PGRST116") throw reportError;

      if (existingReport) {
        setReport(existingReport);
        setLoading(false);
        return;
      }

      const [docsResult, contextsResult] = await Promise.all([
        supabase
          .from("documents")
          .select("*")
          .eq("claim_id", id)
          .eq("status", "approved"),
        supabase
          .from("insurance_context")
          .select("*")
          .eq("is_active", true),
      ]);

      if (docsResult.error) throw docsResult.error;
      if (contextsResult.error) throw contextsResult.error;

      setDocuments(docsResult.data || []);
      setContexts(contextsResult.data || []);
      
      // Select all contexts by default
      setSelectedContexts((contextsResult.data || []).map(c => c.id));
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

  const handleGenerateReport = async () => {
    if (documents.length === 0) {
      toast({
        title: "Žiadne dokumenty",
        description: "Najprv schváľte dokumenty",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get claim info
      const { data: claim, error: claimError } = await supabase
        .from("claims")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (claimError) throw claimError;

      // Get all processed documents texts
      const processedDocsPromises = documents.map(doc =>
        supabase
          .from("processed_documents")
          .select("reviewed_text")
          .eq("document_id", doc.id)
          .maybeSingle()
      );

      const processedDocsResults = await Promise.all(processedDocsPromises);
      const allTexts = processedDocsResults
        .map((result, index) => {
          if (result.data?.reviewed_text) {
            return `=== DOKUMENT: ${documents[index].file_name} ===\n\n${result.data.reviewed_text}`;
          }
          return null;
        })
        .filter(Boolean)
        .join("\n\n" + "=".repeat(80) + "\n\n");

      // Get selected contexts
      const selectedContextsData = contexts.filter(c => 
        selectedContexts.includes(c.id)
      );

      // Call AI to generate comprehensive report
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke("generate-final-report", {
        body: {
          documentsText: allTexts,
          claimInfo: claim,
          insuranceContexts: selectedContextsData,
          customPrompt: customPrompt || null,
        },
      });

      if (aiError) throw aiError;

      setReport(aiResponse);

      toast({
        title: "Report vygenerovaný",
        description: "Finálna analýza bola úspešne vytvorená",
      });

      // Save to database
      await supabase.from("reports").insert({
        document_id: documents[0].id, // Link to first document for reference
        claim_id: id,
        summary: aiResponse.summary,
        relevance_analysis: aiResponse.relevance_analysis,
        exclusions_analysis: aiResponse.exclusions_analysis,
        recommendation: aiResponse.recommendation,
        justification: aiResponse.justification,
        generated_by: user.id,
      });

      // Update all documents status
      await Promise.all(
        documents.map(doc =>
          supabase
            .from("documents")
            .update({ status: "report_generated" })
            .eq("id", doc.id)
        )
      );

    } catch (error: any) {
      toast({
        title: "Chyba pri generovaní reportu",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = () => {
    if (!report) return;

    const reportText = `
FINÁLNY REPORT POISTNEJ UDALOSTI
${"=".repeat(80)}

SÚHRN LEKÁRSKYCH SPRÁV:
${report.summary}

${"=".repeat(80)}

RELEVANCIA VOČI POISTENIU:
${report.relevance_analysis}

${"=".repeat(80)}

IDENTIFIKÁCIA VÝLUK:
${report.exclusions_analysis}

${"=".repeat(80)}

ODPORÚČANIE PRE LIKVIDÁTORA:
${report.recommendation}

${"=".repeat(80)}

ZDÔVODNENIE:
${report.justification}
    `.trim();

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="flex items-center gap-4">
          <Link to={`/claim/${id}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Finálny AI Report</h1>
            <p className="text-muted-foreground mt-1">
              Komplexná analýza {documents.length} dokumentov
            </p>
          </div>
        </div>

        {!report ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Schválené dokumenty</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {documents.map(doc => (
                    <li key={doc.id} className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>{doc.file_name}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Kontextové dokumenty</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contexts.map(context => (
                  <div key={context.id} className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedContexts.includes(context.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedContexts([...selectedContexts, context.id]);
                        } else {
                          setSelectedContexts(selectedContexts.filter(c => c !== context.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{context.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {context.context_type}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vlastné inštrukcie (voliteľné)</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="custom-prompt">
                  Doplňujúce inštrukcie pre AI analýzu
                </Label>
                <Textarea
                  id="custom-prompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={5}
                  placeholder="Napr.: Zameraj sa osobitne na práceneschopnosť a jej trvanie..."
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Button
              onClick={handleGenerateReport}
              disabled={generating || documents.length === 0}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generujem komplexný report...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Vygenerovať AI Report
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>Súhrn lekárskych správ</CardTitle>
                  <Button onClick={handleDownloadReport} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Stiahnuť
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{report.summary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Relevancia voči poisteniu</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{report.relevance_analysis}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Identifikácia výluk</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{report.exclusions_analysis}</p>
              </CardContent>
            </Card>

            <Card className="border-primary">
              <CardHeader>
                <CardTitle>Odporúčanie pre likvidátora</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="font-semibold text-lg">{report.recommendation}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Zdôvodnenie:</h4>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {report.justification}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={() => navigate(`/claim/${id}`)} variant="outline" className="flex-1">
                Späť na poistnú udalosť
              </Button>
              <Button onClick={handleDownloadReport} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Stiahnuť report
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
