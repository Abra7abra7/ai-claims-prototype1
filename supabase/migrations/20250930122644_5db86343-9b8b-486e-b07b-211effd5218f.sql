-- Add cleaned_text column to processed_documents table
ALTER TABLE public.processed_documents 
ADD COLUMN IF NOT EXISTS cleaned_text TEXT;