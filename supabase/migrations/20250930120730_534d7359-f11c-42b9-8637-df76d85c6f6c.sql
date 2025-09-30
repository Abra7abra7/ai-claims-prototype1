-- Create analysis_types table
CREATE TABLE public.analysis_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Add analysis type columns to reports table
ALTER TABLE public.reports 
ADD COLUMN analysis_type_id UUID REFERENCES public.analysis_types(id),
ADD COLUMN analysis_type_name TEXT;

-- Enable RLS on analysis_types
ALTER TABLE public.analysis_types ENABLE ROW LEVEL SECURITY;

-- RLS policies for analysis_types
CREATE POLICY "Everyone can view active analysis types"
ON public.analysis_types
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage analysis types"
ON public.analysis_types
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at on analysis_types
CREATE TRIGGER update_analysis_types_updated_at
BEFORE UPDATE ON public.analysis_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default analysis types
INSERT INTO public.analysis_types (name, description, system_prompt, created_by)
VALUES 
(
  'Štandardná analýza',
  'Komplexná analýza zdravotnej dokumentácie s dôrazom na relevanciu k poistnému prípadu a identifikáciu vylúčení z poistenia.',
  'Si expert na analýzu zdravotnej dokumentácie pre poisťovne. Tvoja úloha je vytvoriť komplexnú analýzu predložených dokumentov vo vzťahu k poistnému prípadu.

Analyzuj dokumenty dôkladne a venuj pozornosť:
1. Relevantnosti dokumentov k poistnému prípadu
2. Identifikácii vylúčení z poistenia
3. Posúdeniu dôvodnosti nároku
4. Odhaleniu nesúladov alebo rizík

Tvoja analýza musí byť objektívna, podložená faktami z dokumentov a prezentovaná jasným, zrozumiteľným jazykom.',
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'Detailná lekárska analýza',
  'Hĺbková medicínska analýza so zameraním na diagnózy, liečbu, chronológiu udalostí a medicínske súvislosti.',
  'Si lekársky expert špecializujúci sa na analýzu zdravotnej dokumentácie pre poisťovne. Tvoja úloha je vytvoriť detailnú lekársku analýzu predložených dokumentov.

Zameraj sa na:
1. Medicínsku presnosť a terminológiu v dokumentoch
2. Chronológiu diagnóz a liečby
3. Príčinné súvislosti medzi diagnózami a udalosťami
4. Medicínsku dôvodnosť a adekvátnosť liečby
5. Preexistujúce stavy a ich vplyv na poistnú udalosť
6. Súlad s medicínskymi štandardmi a postupmi

Analýza musí byť medicínsky precízna, s dôrazom na objektívne medicínske fakty a ich interpretáciu v kontexte poistného prípadu.',
  (SELECT id FROM auth.users LIMIT 1)
),
(
  'Rýchla analýza',
  'Stručné zhrnutie kľúčových bodov s odporúčaním pre rýchle rozhodnutie.',
  'Si expert na rýchle hodnotenie zdravotnej dokumentácie pre poisťovne. Tvoja úloha je vytvoriť stručnú, ale informatívnu analýzu.

Zameraj sa na:
1. Kľúčové body a hlavné zistenia
2. Jasné identifikovanie potenciálnych rizík
3. Stručné a jednoznačné odporúčanie
4. Kritické informácie pre rozhodnutie

Analýza musí byť koncízna, výstižná a obsahovať iba najpodstatnejšie informácie potrebné pre rýchle rozhodnutie.',
  (SELECT id FROM auth.users LIMIT 1)
);