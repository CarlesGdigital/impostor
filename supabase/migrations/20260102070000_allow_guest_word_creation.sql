-- Migration: Allow guest word creation
-- Make created_by nullable and add created_by_guest column for anonymous users

-- Step 1: Make created_by nullable
ALTER TABLE public.cards 
ALTER COLUMN created_by DROP NOT NULL;

-- Step 2: Add created_by_guest column for guest users
ALTER TABLE public.cards 
ADD COLUMN IF NOT EXISTS created_by_guest TEXT;

-- Step 3: Add constraint: either created_by or created_by_guest must be set
-- (We don't enforce this at DB level to keep flexibility, but the app logic will ensure it)

-- Step 4: Grant insert permission on cards to anon users
-- Note: RLS policies should still limit what guests can do
GRANT INSERT ON public.cards TO anon;

-- Step 5: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
