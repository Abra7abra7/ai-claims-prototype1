import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    console.log(`Processing OCR for document: ${documentId}`);

    // Get Google Cloud credentials
    const googleCredentials = Deno.env.get('GOOGLE_CLOUD_CREDENTIALS2');
    if (!googleCredentials) {
      throw new Error('GOOGLE_CLOUD_CREDENTIALS2 not configured in secrets');
    }

    const credentials = JSON.parse(googleCredentials);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document from database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, file_type, file_path, claim_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Failed to fetch document: ${docError?.message}`);
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file from storage: ${downloadError?.message}`);
    }

    // Convert blob to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Get access token for Google API
    const now = Math.floor(Date.now() / 1000);
    const jwtHeader = { alg: "RS256", typ: "JWT" };
    const jwtClaim = {
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: await createJWT(jwtHeader, jwtClaim, credentials.private_key),
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token error:', errorText);
      throw new Error(`Failed to get access token: ${tokenResponse.statusText}`);
    }

    const { access_token } = await tokenResponse.json();

    // Call Document AI API
    const processorUrl = "https://eu-documentai.googleapis.com/v1/projects/485328765227/locations/eu/processors/1b186d456b875b89:process";
    
    const documentAIResponse = await fetch(processorUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rawDocument: {
          content: base64Content,
          mimeType: document.file_type || (document.file_name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        },
      }),
    });

    if (!documentAIResponse.ok) {
      const errorText = await documentAIResponse.text();
      console.error('Document AI error:', errorText);
      throw new Error(`Document AI processing failed: ${documentAIResponse.statusText}`);
    }

    const result = await documentAIResponse.json();
    const extractedText = result.document?.text || '';

    console.log(`OCR completed for document ${documentId}. Extracted ${extractedText.length} characters.`);

    // Update document status and save OCR text
    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'ocr_complete' })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document status: ${updateError.message}`);
    }

    // Save processed document data
    const { error: processedError } = await supabase
      .from('processed_documents')
      .upsert({
        document_id: documentId,
        ocr_text: extractedText,
      }, {
        onConflict: 'document_id'
      });

    if (processedError) {
      throw new Error(`Failed to save OCR text: ${processedError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: extractedText,
        characterCount: extractedText.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in process-document-ocr:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Helper function to create JWT
async function createJWT(header: any, claim: any, privateKey: string): Promise<string> {
  const encoder = new TextEncoder();
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claim));
  const message = `${encodedHeader}.${encodedClaim}`;
  
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    encoder.encode(message)
  );
  
  return `${message}.${base64UrlEncode(signature)}`;
}

function base64UrlEncode(data: string | ArrayBuffer): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}
