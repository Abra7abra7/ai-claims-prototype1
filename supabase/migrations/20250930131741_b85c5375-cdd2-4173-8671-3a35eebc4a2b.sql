-- Add DELETE policies for admins on documents table
CREATE POLICY "Admins can delete documents"
ON documents
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policy for admins on documents table
CREATE POLICY "Admins can update all documents"
ON documents
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for admins on reports table
CREATE POLICY "Admins can delete reports"
ON reports
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for admins on processed_documents table
CREATE POLICY "Admins can delete processed documents"
ON processed_documents
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for admins on claims table
CREATE POLICY "Admins can delete claims"
ON claims
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policy for admins on claims table
CREATE POLICY "Admins can update all claims"
ON claims
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));