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
      console.error("Missing document ID in request");
      throw new Error("Document ID is required");
    }

    console.info(`=== Starting text cleaning for document: ${documentId} ===`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the anonymized text
    console.info("Fetching anonymized text from database...");
    const { data: processedDoc, error: fetchError } = await supabase
      .from("processed_documents")
      .select("anonymized_text")
      .eq("document_id", documentId)
      .maybeSingle();

    if (fetchError) {
      console.error("Database fetch error:", fetchError);
      throw new Error(`Failed to fetch document: ${fetchError.message}`);
    }

    if (!processedDoc) {
      console.error("No processed document found for ID:", documentId);
      throw new Error("Document not found");
    }

    if (!processedDoc.anonymized_text) {
      console.error("No anonymized text found for document:", documentId);
      throw new Error("No anonymized text available for cleaning");
    }

    console.info(`Anonymized text length: ${processedDoc.anonymized_text.length} characters`);
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
      console.error("AI API error details:", {
        status: aiResponse.status,
        statusText: aiResponse.statusText,
        body: errorText
      });
      
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Payment required. Please add credits to your Lovable AI workspace.");
      }
      
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    
    if (!aiData.choices || !aiData.choices[0] || !aiData.choices[0].message) {
      console.error("Invalid AI response structure:", aiData);
      throw new Error("Invalid response from AI service");
    }

    const cleanedText = aiData.choices[0].message.content;

    if (!cleanedText) {
      console.error("AI returned empty cleaned text");
      throw new Error("AI service returned empty text");
    }

    console.info(`AI text cleaning completed. Cleaned text length: ${cleanedText.length} characters`);

    // Save the cleaned text separately
    console.info("Saving cleaned text to database...");
    const { error: updateError } = await supabase
      .from("processed_documents")
      .update({
        cleaned_text: cleanedText,
      })
      .eq("document_id", documentId);

    if (updateError) {
      console.error("Failed to update processed_documents:", updateError);
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    // Update document status only if not already approved
    console.info("Checking document status...");
    const { data: docData, error: docFetchError } = await supabase
      .from("documents")
      .select("status")
      .eq("id", documentId)
      .single();

    if (docFetchError) {
      console.error("Failed to fetch document status:", docFetchError);
    }

    if (docData && docData.status !== "approved") {
      console.info("Updating document status to ready_for_review...");
      const { error: statusError } = await supabase
        .from("documents")
        .update({ status: "ready_for_review" })
        .eq("id", documentId);

      if (statusError) {
        console.error("Failed to update document status:", statusError);
        throw new Error(`Failed to update document status: ${statusError.message}`);
      }
    } else {
      console.info("Document already approved, skipping status update");
    }

    console.info(`=== Text cleaning completed successfully for document ${documentId} ===`);

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
