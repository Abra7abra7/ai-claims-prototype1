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
    const { documentId } = await req.json();

    if (!documentId) {
      throw new Error("Document ID is required");
    }

    console.info(`Cleaning text for document: ${documentId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the anonymized text
    const { data: processedDoc, error: fetchError } = await supabase
      .from("processed_documents")
      .select("anonymized_text")
      .eq("document_id", documentId)
      .maybeSingle();

    if (fetchError || !processedDoc?.anonymized_text) {
      throw new Error("Failed to fetch anonymized text");
    }

    console.info("Calling Lovable AI to clean text...");

    // Call Lovable AI to clean the text
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Si lingvistický expert. Tvojou úlohou je opraviť gramatické chyby, preklepy a jazykové nedostatky v texte BEZ ZMENY KONTEXTU A VÝZNAMU.

PRAVIDLÁ:
- Oprav len gramatické chyby, preklepy, interpunkciu
- NIKDY nemeň fakty, čísla, mená (aj keď sú anonymizované ako [OSOBA_1])
- NIKDY nevypúšťaj ani nepridávaj informácie
- NIKDY nemeň štruktúru textu
- Zachovaj všetky anonymizované značky presne ako sú (napr. [OSOBA_1], [EMAIL_1], [TELEFON_1])
- Ak je text v slovenčine, oprav slovenské gramatické chyby
- Ak je v ňom zmiešaný jazyk, opravu len gramatiku, nie jazyk samotný

Vráť CELÝ opravený text.`
          },
          {
            role: "user",
            content: processedDoc.anonymized_text
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Payment required. Please add credits to your Lovable AI workspace.");
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const cleanedText = aiData.choices[0].message.content;

    console.info("AI text cleaning completed");

    // Save the cleaned text separately
    const { error: updateError } = await supabase
      .from("processed_documents")
      .update({
        cleaned_text: cleanedText,
      })
      .eq("document_id", documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    // Update document status
    const { error: statusError } = await supabase
      .from("documents")
      .update({ status: "ready_for_review" })
      .eq("id", documentId);

    if (statusError) {
      throw new Error(`Failed to update document status: ${statusError.message}`);
    }

    console.info(`Text cleaning completed for document ${documentId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        cleanedText,
        message: "Text cleaned successfully"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error in clean-anonymized-text function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
