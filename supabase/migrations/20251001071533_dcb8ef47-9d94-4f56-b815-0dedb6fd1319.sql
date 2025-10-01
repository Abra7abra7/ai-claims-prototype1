-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create insurance knowledge base table with vector embeddings
CREATE TABLE public.insurance_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 embedding size
  metadata JSONB DEFAULT '{}'::jsonb,
  policy_types TEXT[], -- Array of policy types this applies to
  categories TEXT[], -- Array of categories (exclusions, conditions, etc.)
  source_document TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create index for vector similarity search using cosine distance
CREATE INDEX idx_insurance_knowledge_embedding ON public.insurance_knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create indexes for filtering
CREATE INDEX idx_insurance_knowledge_active ON public.insurance_knowledge_base(is_active);
CREATE INDEX idx_insurance_knowledge_policy_types ON public.insurance_knowledge_base USING GIN(policy_types);
CREATE INDEX idx_insurance_knowledge_categories ON public.insurance_knowledge_base USING GIN(categories);

-- Enable RLS
ALTER TABLE public.insurance_knowledge_base ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view active knowledge base"
ON public.insurance_knowledge_base
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage knowledge base"
ON public.insurance_knowledge_base
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create function to search knowledge base
CREATE OR REPLACE FUNCTION public.search_insurance_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_policy_types text[] DEFAULT NULL,
  filter_categories text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  chunk_text text,
  similarity float,
  metadata jsonb,
  policy_types text[],
  categories text[]
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ikb.id,
    ikb.title,
    ikb.chunk_text,
    1 - (ikb.embedding <=> query_embedding) as similarity,
    ikb.metadata,
    ikb.policy_types,
    ikb.categories
  FROM public.insurance_knowledge_base ikb
  WHERE ikb.is_active = true
    AND (filter_policy_types IS NULL OR ikb.policy_types && filter_policy_types)
    AND (filter_categories IS NULL OR ikb.categories && filter_categories)
    AND 1 - (ikb.embedding <=> query_embedding) > match_threshold
  ORDER BY ikb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_insurance_knowledge_updated_at
BEFORE UPDATE ON public.insurance_knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();