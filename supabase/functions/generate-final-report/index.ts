import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentsText, claimInfo, insuranceContexts, customPrompt, analysisTypeId } = await req.json();

    // Import Supabase client
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get analysis type system prompt
    let baseSystemPrompt = `Si expert na likvidáciu poistných udalostí v oblasti životného a úrazového poistenia. 
Tvojou úlohou je analyzovať VŠETKY priložené lekárske správy a vytvoriť JEDEN komplexný report pre interného likvidátora.`;

    if (analysisTypeId) {
      const { data: analysisType, error: analysisTypeError } = await supabase
        .from("analysis_types")
        .select("system_prompt")
        .eq("id", analysisTypeId)
        .maybeSingle();

      if (analysisTypeError) {
        console.error("Error fetching analysis type:", analysisTypeError);
      } else if (analysisType) {
        baseSystemPrompt = analysisType.system_prompt;
      }
    }

    // Build context from insurance documents
    let contextText = "";
    if (insuranceContexts && insuranceContexts.length > 0) {
      contextText = insuranceContexts
        .map(
          (ctx: any) => `[${ctx.context_type.toUpperCase()}]: ${ctx.title}\n${ctx.content}`
        )
        .join("\n\n");
    }

    // Build system prompt
    const systemPrompt = `${baseSystemPrompt}

${customPrompt ? `\nDOPLŇUJÚCE INŠTRUKCIE: ${customPrompt}` : ''}

Odpoveď MUSÍ byť v JSON formáte s nasledujúcou štruktúrou:
{
  "summary": "Komplexný súhrn VŠETKÝCH lekárskych správ s dátumami a diagnózami - max 400 slov",
  "relevance_analysis": "Analýza relevantných bodov voči poisteniu z VŠETKÝCH dokumentov - max 400 slov",
  "exclusions_analysis": "Identifikácia možných výluk na základe VŠETKÝCH správ - max 300 slov",
  "recommendation": "Jasné odporúčanie (schváliť/zamietnuť/vyžiadať ďalšie info) - max 100 slov",
  "justification": "Zdôvodnenie s konkrétnymi citáciami z KONKRÉTNYCH dokumentov - max 400 slov"
}`;

    // Build user prompt
    const userPrompt = `Poistná udalosť:
Číslo: ${claimInfo.claim_number}
Klient: ${claimInfo.client_name}
Číslo poistky: ${claimInfo.policy_number}
Typ: ${claimInfo.claim_type}

LEKÁRSKE SPRÁVY (anonymizované, po kontrole likvidátorom):
${documentsText}

KONTEXT POISTENIA:
${contextText}

Vygeneruj komplexný report v JSON formáte.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Calling Lovable AI to generate comprehensive report...");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("Payment required. Please add credits to your Lovable AI workspace.");
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");

    const reportContent = data.choices[0].message.content;
    const parsedReport = JSON.parse(reportContent);

    console.log("Comprehensive report generated successfully");

    return new Response(JSON.stringify(parsedReport), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-final-report function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
