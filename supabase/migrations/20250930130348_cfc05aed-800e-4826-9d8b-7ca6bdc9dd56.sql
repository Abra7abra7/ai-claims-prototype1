-- Fix RLS policies for claims table
DROP POLICY IF EXISTS "Users can view all claims" ON claims;

CREATE POLICY "Users can view their own claims"
ON claims
FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Admins can view all claims"
ON claims
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix RLS policies for documents table
DROP POLICY IF EXISTS "Users can view all documents" ON documents;

CREATE POLICY "Users can view documents from their claims"
ON documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM claims
    WHERE claims.id = documents.claim_id
    AND claims.created_by = auth.uid()
  )
);

CREATE POLICY "Admins can view all documents"
ON documents
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix RLS policies for reports table
DROP POLICY IF EXISTS "Users can view all reports" ON reports;

CREATE POLICY "Users can view reports from their claims"
ON reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM claims
    WHERE claims.id = reports.claim_id
    AND claims.created_by = auth.uid()
  )
);

CREATE POLICY "Admins can view all reports"
ON reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));