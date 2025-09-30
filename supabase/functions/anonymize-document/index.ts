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

    console.log(`Anonymizing document: ${documentId}`);

    // Get Google Cloud credentials
    const googleCredentials = Deno.env.get('GOOGLE_CLOUD_CREDENTIALS');
    if (!googleCredentials) {
      throw new Error('GOOGLE_CLOUD_CREDENTIALS not configured');
    }

    const credentials = JSON.parse(googleCredentials);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get OCR text from processed_documents
    const { data: processedDoc, error: fetchError } = await supabase
      .from('processed_documents')
      .select('ocr_text')
      .eq('document_id', documentId)
      .single();

    if (fetchError || !processedDoc || !processedDoc.ocr_text) {
      throw new Error(`Failed to fetch OCR text: ${fetchError?.message || 'No OCR text found'}`);
    }

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

    // Call DLP API for de-identification
    const dlpUrl = `https://dlp.googleapis.com/v2/projects/${credentials.project_id}/content:deidentify`;
    
    const dlpResponse = await fetch(dlpUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        item: {
          value: processedDoc.ocr_text
        },
        deidentifyConfig: {
          infoTypeTransformations: {
            transformations: [
              {
                primitiveTransformation: {
                  replaceWithInfoTypeConfig: {}
                }
              }
            ]
          }
        },
        inspectConfig: {
          infoTypes: [
            { name: "PERSON_NAME" },
            { name: "EMAIL_ADDRESS" },
            { name: "PHONE_NUMBER" },
            { name: "CREDIT_CARD_NUMBER" },
            { name: "IBAN_CODE" },
            { name: "STREET_ADDRESS" },
            { name: "DATE_OF_BIRTH" },
            { name: "PASSPORT" },
            { name: "NATIONAL_ID" }
          ],
          minLikelihood: "POSSIBLE"
        }
      }),
    });

    if (!dlpResponse.ok) {
      const errorText = await dlpResponse.text();
      console.error('DLP API error:', errorText);
      throw new Error(`DLP processing failed: ${dlpResponse.statusText}`);
    }

    const result = await dlpResponse.json();
    const anonymizedText = result.item?.value || processedDoc.ocr_text;

    console.log(`Anonymization completed for document ${documentId}.`);

    // Update document status and save anonymized text
    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'ready_for_review' })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document status: ${updateError.message}`);
    }

    // Save anonymized text
    const { error: processedError } = await supabase
      .from('processed_documents')
      .update({
        anonymized_text: anonymizedText,
      })
      .eq('document_id', documentId);

    if (processedError) {
      throw new Error(`Failed to save anonymized text: ${processedError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: anonymizedText 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in anonymize-document:', error);
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
