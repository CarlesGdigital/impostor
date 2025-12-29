-- Migration: Rename 'adultos' master category to 'ninos' and enforce 3 categories
-- Target categories: 'general', 'ninos', 'benicolet'

-- 1. Update existing data
-- Rename 'adultos' -> 'ninos'
UPDATE public.packs
SET master_category = 'ninos'
WHERE master_category = 'adultos';

-- Set nulls to 'general'
UPDATE public.packs
SET master_category = 'general'
WHERE master_category IS NULL;

-- 2. Update Check Constraint
ALTER TABLE public.packs DROP CONSTRAINT IF EXISTS packs_master_category_check;

ALTER TABLE public.packs 
  ADD CONSTRAINT packs_master_category_check 
  CHECK (master_category IN ('general', 'ninos', 'benicolet'));

-- 3. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
