import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Simple PDF text extraction (no OCR)
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

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
    const contentType = req.headers.get("content-type") || "";
    let title: string;
    let content: string;
    let policyTypes: string[] = [];
    let categories: string[] = [];
    let sourceDocument: string | null = null;

    // Handle file upload
    if (contentType.includes("multipart/form-data")) {
      console.log("Processing file upload...");
      
      const formData = await req.formData();
      const file = formData.get("file") as File;
      
      if (!file) {
        throw new Error("No file provided");
      }

      console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);
      
      // Set title and source from filename
      title = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      sourceDocument = file.name;

      // Extract text based on file type
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        console.log("Processing text file...");
        content = await file.text();
      } else if (fileName.endsWith('.pdf')) {
        console.log("Processing PDF with OCR...");
        content = await extractTextFromPDF(file);
      } else if (fileName.endsWith('.docx')) {
        throw new Error("DOCX support coming soon. Please convert to PDF or TXT.");
      } else {
        throw new Error("Unsupported file type. Use PDF, TXT, or MD files.");
      }

      if (!content || content.trim().length < 10) {
        throw new Error("Could not extract meaningful text from the document");
      }

      console.log(`Extracted ${content.length} characters from ${file.name}`);

      // Use AI to suggest categories and policy types
      console.log("Analyzing document with AI...");
      const suggestions = await analyzeDocumentContent(content, title);
      policyTypes = suggestions.policyTypes;
      categories = suggestions.categories;
      
      console.log(`AI suggested policy types: ${policyTypes.join(', ')}`);
      console.log(`AI suggested categories: ${categories.join(', ')}`);
    } else {
      // Handle JSON input (legacy support)
      const body = await req.json();
      title = body.title;
      content = body.content;
      policyTypes = body.policyTypes || [];
      categories = body.categories || [];
      sourceDocument = body.sourceDocument;
    }

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

      // Generate embedding using OpenAI embeddings API
      // Note: Lovable AI doesn't support embeddings, so we use OpenAI directly
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required for generating embeddings");
      }

      try {
        const embeddingResponse = await fetch(
          "https://api.openai.com/v1/embeddings",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
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
          throw new Error(`Failed to generate embedding: ${embeddingResponse.status} - ${errorText}`);
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
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
        throw error;
      }
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

// Extract text from PDF using pdfjs (simple text layer extraction, no OCR)
async function extractTextFromPDF(file: File): Promise<string> {
  console.log("Extracting text from PDF (text layer only, no OCR)...");
  
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Load PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useSystemFonts: true,
    standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/standard_fonts/",
  });
  
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  console.log(`PDF has ${numPages} pages`);
  
  const textPromises = [];
  
  // Extract text from each page
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    textPromises.push(
      pdf.getPage(pageNum).then(async (page) => {
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        return pageText;
      })
    );
  }
  
  const pageTexts = await Promise.all(textPromises);
  const fullText = pageTexts.join("\n\n");
  
  console.log(`Extracted ${fullText.length} characters from ${numPages} pages`);
  
  if (!fullText || fullText.trim().length < 50) {
    throw new Error("PDF appears to be scanned/image-based. Please use a PDF with selectable text or convert to searchable PDF first.");
  }
  
  return fullText;
}

// Use AI to analyze document and suggest categories/policy types
async function analyzeDocumentContent(content: string, title: string): Promise<{
  policyTypes: string[];
  categories: string[];
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log("LOVABLE_API_KEY not configured, using defaults");
    return { policyTypes: [], categories: [] };
  }

  // Take first 2000 characters for analysis
  const contentSample = content.substring(0, 2000);

  try {
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
            {
              role: "system",
              content: `You are an insurance document analyzer. Analyze documents and suggest:
1. Policy types (zdravotné, životné, úrazové, majetkové, cestovné, auto, domácnosť, zodpovednosť)
2. Categories (vylúčenia, podmienky, krytie, povinnosti, nároky, poplatky, definície, všeobecné)

Respond ONLY with JSON: {"policyTypes": ["type1", "type2"], "categories": ["cat1", "cat2"]}
Choose 1-3 most relevant items for each. Use Slovak terms.`
            },
            {
              role: "user",
              content: `Analyze this insurance document:\n\nTitle: ${title}\n\nContent:\n${contentSample}`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "categorize_document",
              description: "Categorize insurance document",
              parameters: {
                type: "object",
                properties: {
                  policyTypes: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-3 relevant policy types"
                  },
                  categories: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-3 relevant categories"
                  }
                },
                required: ["policyTypes", "categories"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "categorize_document" } }
        }),
      }
    );

    if (!response.ok) {
      console.error("AI analysis failed:", response.status);
      return { policyTypes: [], categories: [] };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return {
        policyTypes: result.policyTypes || [],
        categories: result.categories || []
      };
    }

    return { policyTypes: [], categories: [] };
  } catch (error) {
    console.error("Error in AI analysis:", error);
    return { policyTypes: [], categories: [] };
  }
}

// No longer needed - removed Google Document AI dependencies
