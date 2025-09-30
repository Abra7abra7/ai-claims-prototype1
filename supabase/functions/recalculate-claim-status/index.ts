import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { claimId } = await req.json();

    // Get all documents for the claim
    const { data: documents, error: docsError } = await supabase
      .from("documents")
      .select("status")
      .eq("claim_id", claimId);

    if (docsError) throw docsError;

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No documents found for this claim",
          status: "new"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count statuses
    const totalDocs = documents.length;
    const reportGenerated = documents.filter(d => d.status === "report_generated").length;
    const failed = documents.filter(d => d.status === "failed").length;
    const processing = documents.filter(d => 
      d.status === "processing" || 
      d.status === "uploaded"
    ).length;

    // Determine new claim status
    let newStatus = "in_progress";
    
    if (reportGenerated === totalDocs) {
      newStatus = "completed";
    } else if (failed > 0 && reportGenerated + failed === totalDocs) {
      newStatus = "failed";
    } else if (processing > 0) {
      newStatus = "processing";
    }

    // Update claim status
    const { error: updateError } = await supabase
      .from("claims")
      .update({ status: newStatus })
      .eq("id", claimId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        message: "Claim status recalculated successfully",
        claimId,
        status: newStatus,
        stats: {
          total: totalDocs,
          reportGenerated,
          failed,
          processing
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error recalculating claim status:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
