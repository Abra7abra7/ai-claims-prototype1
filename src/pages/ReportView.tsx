import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Report {
  id: string;
  summary: string;
  relevance_analysis: string | null;
  exclusions_analysis: string | null;
  recommendation: string;
  justification: string | null;
  created_at: string;
}

export default function ReportView() {
  const { id, docId } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchReport();
  }, [docId]);

  const fetchReport = async () => {
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("document_id", docId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        // No report exists, generate one
        await generateReport();
      } else {
        setReport(data);
        
        // Update document status
        await supabase
          .from("documents")
          .update({ status: "report_generated" })
          .eq("id", docId);
      }
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

  const generateReport = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get processed document
      const { data: processedDoc, error: procError } = await supabase
        .from("processed_documents")
        .select("reviewed_text")
        .eq("document_id", docId)
        .maybeSingle();

      if (procError) throw procError;
      if (!processedDoc?.reviewed_text) throw new Error("No reviewed text found");

      // Get claim info
      const { data: claim, error: claimError } = await supabase
        .from("claims")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (claimError) throw claimError;

      // Get insurance context
      const { data: contexts, error: contextError } = await supabase
        .from("insurance_context")
        .select("*")
        .eq("is_active", true);

      if (contextError) throw contextError;

      // Call AI edge function to generate report
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke("generate-report", {
        body: {
          documentText: processedDoc.reviewed_text,
          claimInfo: claim,
          insuranceContexts: contexts,
        },
      });

      if (aiError) throw aiError;

      // Save report to database
      const { data: savedReport, error: saveError } = await supabase
        .from("reports")
        .insert({
          document_id: docId,
          claim_id: id,
          summary: aiResponse.summary,
          relevance_analysis: aiResponse.relevance_analysis,
          exclusions_analysis: aiResponse.exclusions_analysis,
          recommendation: aiResponse.recommendation,
          justification: aiResponse.justification,
          generated_by: user.id,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Update document status
      await supabase
        .from("documents")
        .update({ status: "report_generated" })
        .eq("id", docId);

      setReport(savedReport);

      toast({
        title: "Report vygenerovaný",
        description: "AI analýza bola úspešne vytvorená",
      });
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

  if (loading || generating) {
    return (
      <Layout>
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">
            {generating ? "Generujem AI report..." : "Načítavam..."}
          </p>
        </div>
      </Layout>
    );
  }

  if (!report) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Report nebol nájdený</p>
          <Link to={`/claim/${id}/document/${docId}`}>
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
          <Link to={`/claim/${id}/document/${docId}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">AI Analýza a Report</h1>
            <p className="text-muted-foreground mt-1">Vygenerovaný pomocou Gemini AI</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Súhrn lekárskej správy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{report.summary}</p>
            </CardContent>
          </Card>

          {report.relevance_analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Relevancia voči poisteniu</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{report.relevance_analysis}</p>
              </CardContent>
            </Card>
          )}

          {report.exclusions_analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Identifikácia výluk</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{report.exclusions_analysis}</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Odporúčanie pre likvidátora</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="font-semibold text-lg">{report.recommendation}</p>
              </div>
              {report.justification && (
                <div>
                  <h4 className="font-medium mb-2">Zdôvodnenie:</h4>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {report.justification}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
