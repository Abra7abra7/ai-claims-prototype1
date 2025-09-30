-- Fix Critical Security Issue: Overly permissive UPDATE policy on documents table
-- Drop the insecure policy that allows any user to update any document
DROP POLICY IF EXISTS "Users can update documents" ON documents;

-- Create secure policy that restricts updates to document owners only
-- Users can only update documents from their own claims
CREATE POLICY "Users can update their own documents"
ON documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM claims
    WHERE claims.id = documents.claim_id
    AND claims.created_by = auth.uid()
  )
);