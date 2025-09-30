-- Fix Critical Security Issue: Overly permissive RLS policies on processed_documents
-- Drop insecure policies that allow access to all documents
DROP POLICY IF EXISTS "Users can view all processed documents" ON processed_documents;
DROP POLICY IF EXISTS "Users can create processed documents" ON processed_documents;
DROP POLICY IF EXISTS "Users can update processed documents" ON processed_documents;

-- Create secure policies that restrict access to user's own claims only
CREATE POLICY "Users can view their own processed documents"
ON processed_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents d
    JOIN claims c ON d.claim_id = c.id
    WHERE d.id = processed_documents.document_id
    AND c.created_by = auth.uid()
  )
);

CREATE POLICY "Users can create processed documents for their claims"
ON processed_documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents d
    JOIN claims c ON d.claim_id = c.id
    WHERE d.id = document_id
    AND c.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update their own processed documents"
ON processed_documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM documents d
    JOIN claims c ON d.claim_id = c.id
    WHERE d.id = processed_documents.document_id
    AND c.created_by = auth.uid()
  )
);

-- Admins can still manage all processed documents
CREATE POLICY "Admins can manage all processed documents"
ON processed_documents
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix function security: Add search_path protection to update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;