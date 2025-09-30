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
    const { documentText, claimInfo, insuranceContexts } = await req.json();

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
    const systemPrompt = `Si expert na likvidáciu poistných udalostí v oblasti životného a úrazového poistenia. 
Tvojou úlohou je analyzovať nasledujúce dokumenty a vytvoriť štruktúrovaný report pre interného likvidátora. 

Zameraj sa na:
1. Súlad medzi lekárskou správou a poistnými podmienkami
2. Kľúčové diagnózy a navrhované liečebné postupy
3. Identifikáciu prípadných výluk z poistenia
4. Jasné a vecne podložené odporúčanie

Odpoveď MUSÍ byť v JSON formáte s nasledujúcou štruktúrou:
{
  "summary": "Stručný súhrn lekárskej správy - max 200 slov",
  "relevance_analysis": "Analýza relevantných bodov voči poisteniu - max 300 slov",
  "exclusions_analysis": "Identifikácia možných výluk - max 200 slov",
  "recommendation": "Jasné odporúčanie (schváliť/zamietnuť/vyžiadať ďalšie info) - max 50 slov",
  "justification": "Zdôvodnenie s konkrétnymi citáciami z dodaných dokumentov - max 300 slov"
}`;

    // Build user prompt
    const userPrompt = `Poistná udalosť:
Číslo: ${claimInfo.claim_number}
Klient: ${claimInfo.client_name}
Číslo poistky: ${claimInfo.policy_number}
Typ: ${claimInfo.claim_type}

LEKÁRSKA SPRÁVA (anonymizovaná):
${documentText}

KONTEXT POISTENIA:
${contextText}

Vygeneruj report v JSON formáte.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Calling Lovable AI to generate report...");

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

    console.log("Report generated successfully");

    return new Response(JSON.stringify(parsedReport), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-report function:", error);
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
