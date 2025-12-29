-- Add master_category column to packs table for grouping
ALTER TABLE public.packs 
  ADD COLUMN IF NOT EXISTS master_category TEXT DEFAULT 'general';

-- Add constraint for valid values
ALTER TABLE public.packs DROP CONSTRAINT IF EXISTS packs_master_category_check;
ALTER TABLE public.packs 
  ADD CONSTRAINT packs_master_category_check 
  CHECK (master_category IN ('general', 'adultos', 'benicolet'));
