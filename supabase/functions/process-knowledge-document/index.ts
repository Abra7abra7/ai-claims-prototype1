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
    const { title, content, policyTypes, categories, sourceDocument } = await req.json();

    // Import Supabase client
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("Processing document:", title);

    // Chunk the content into smaller pieces (max 1000 chars per chunk)
    const chunkSize = 1000;
    const chunks: string[] = [];
    
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    console.log(`Created ${chunks.length} chunks from document`);

    // Generate embeddings for each chunk using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const processedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      console.log(`Generating embedding for chunk ${i + 1}/${chunks.length}`);

      // Generate embedding using Lovable AI with text-embedding model
      const embeddingResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/embeddings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: chunk,
            dimensions: 1536,
          }),
        }
      );

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        console.error("Embedding error:", embeddingResponse.status, errorText);
        throw new Error(`Failed to generate embedding: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Store in database
      const { error: insertError } = await supabase
        .from("insurance_knowledge_base")
        .insert({
          title,
          content,
          chunk_text: chunk,
          chunk_index: i,
          embedding,
          policy_types: policyTypes || [],
          categories: categories || [],
          source_document: sourceDocument,
          created_by: user.id,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      processedChunks.push({
        chunk_index: i,
        chunk_text: chunk.substring(0, 100) + "...",
      });
    }

    console.log(`Successfully processed ${chunks.length} chunks`);

    return new Response(
      JSON.stringify({
        success: true,
        chunks_processed: chunks.length,
        chunks: processedChunks,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in process-knowledge-document function:", error);
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
