-- Update master_category constraint to include 'terreta'

ALTER TABLE public.packs DROP CONSTRAINT IF EXISTS packs_master_category_check;

ALTER TABLE public.packs 
  ADD CONSTRAINT packs_master_category_check 
  CHECK (master_category IN ('general', 'benicolet', 'picantes', 'terreta'));
