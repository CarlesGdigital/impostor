-- Add master_category column to packs table
ALTER TABLE public.packs 
ADD COLUMN IF NOT EXISTS master_category TEXT DEFAULT 'general';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_packs_master_category ON public.packs(master_category);