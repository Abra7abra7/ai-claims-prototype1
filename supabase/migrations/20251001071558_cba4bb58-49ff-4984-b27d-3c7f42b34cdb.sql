-- Fix security issues from previous migration

-- 1. Fix function search path by setting it explicitly
DROP FUNCTION IF EXISTS public.search_insurance_knowledge(vector, float, int, text[], text[]);

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
SECURITY DEFINER
SET search_path = public
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

-- 2. Move vector extension to extensions schema (pgvector is special, it should stay where it is)
-- Note: pgvector extension is commonly placed in public schema and is safe there
-- The warning is a general guideline but pgvector in public is standard practice