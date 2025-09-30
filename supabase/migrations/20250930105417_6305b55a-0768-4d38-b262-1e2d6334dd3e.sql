-- Create enum for user roles
CREATE TYPE app_role AS ENUM ('admin', 'likvidator');

-- Create enum for claim status
CREATE TYPE claim_status AS ENUM ('new', 'in_progress', 'completed', 'rejected');

-- Create enum for document processing status
CREATE TYPE processing_status AS ENUM ('uploaded', 'ocr_processing', 'ocr_complete', 'anonymizing', 'anonymized', 'ready_for_review', 'approved', 'report_generated');

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create user_roles table (separate for security)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Function to check user role
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create claims table
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  status claim_status DEFAULT 'new',
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on claims
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- Claims policies
CREATE POLICY "Users can view all claims"
  ON claims FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own claims"
  ON claims FOR UPDATE
  USING (auth.uid() = created_by);

-- Create documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  status processing_status DEFAULT 'uploaded',
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Documents policies
CREATE POLICY "Users can view all documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (true);

-- Create processed_documents table
CREATE TABLE processed_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ocr_text TEXT,
  anonymized_text TEXT,
  reviewed_text TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on processed_documents
ALTER TABLE processed_documents ENABLE ROW LEVEL SECURITY;

-- Processed documents policies
CREATE POLICY "Users can view all processed documents"
  ON processed_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create processed documents"
  ON processed_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update processed documents"
  ON processed_documents FOR UPDATE
  TO authenticated
  USING (true);

-- Create reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL,
  relevance_analysis TEXT,
  exclusions_analysis TEXT,
  recommendation TEXT NOT NULL,
  justification TEXT,
  generated_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Reports policies
CREATE POLICY "Users can view all reports"
  ON reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = generated_by);

-- Create insurance_context table (for policy terms, exclusions, etc.)
CREATE TABLE insurance_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on insurance_context
ALTER TABLE insurance_context ENABLE ROW LEVEL SECURITY;

-- Insurance context policies
CREATE POLICY "Users can view active insurance context"
  ON insurance_context FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage insurance context"
  ON insurance_context FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  
  -- Assign default role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'likvidator');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processed_documents_updated_at
  BEFORE UPDATE ON processed_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insurance_context_updated_at
  BEFORE UPDATE ON insurance_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample insurance context data
INSERT INTO insurance_context (context_type, title, content) VALUES
('policy_terms', 'Všeobecné poistné podmienky', 'Poistenie kryje úrazy a choroby vzniknuté počas trvania poistnej zmluvy. Poistné plnenie sa vyplatí podľa tabuľky poistných plnení uvedenej v poistnej zmluve.'),
('exclusions', 'Výluky z poistenia', 'Z poistenia sú vylúčené: 1) Úmyselné sebapoškodenie 2) Zranenia spôsobené pod vplyvom alkoholu alebo drog 3) Profesionálny šport 4) Extrémne športy bez dojednania pripoistenia 5) Preexistujúce ochorenia známe pred uzavretím zmluvy'),
('legal', 'Právne predpisy', 'Likvidácia poistných udalostí sa riadi zákonom č. 381/2001 Z.z. o povinnom zmluvnom poistení zodpovednosti za škodu spôsobenú prevádzkou motorového vozidla.');
