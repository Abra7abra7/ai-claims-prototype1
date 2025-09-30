-- Drop the overly permissive policy that allows everyone to view analysis types
DROP POLICY IF EXISTS "Everyone can view active analysis types" ON analysis_types;

-- Create a new policy that requires authentication to view analysis types
CREATE POLICY "Authenticated users can view active analysis types"
ON analysis_types
FOR SELECT
TO authenticated
USING (is_active = true);