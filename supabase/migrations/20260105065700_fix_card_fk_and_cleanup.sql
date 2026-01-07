-- Fix foreign key constraint to allow card deletion
-- This changes the constraint to SET NULL on delete, preserving game history

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.game_sessions 
DROP CONSTRAINT IF EXISTS game_sessions_card_id_fkey;

-- Step 2: Make sure card_id is nullable (it should be, but just in case)
ALTER TABLE public.game_sessions 
ALTER COLUMN card_id DROP NOT NULL;

-- Step 3: Re-add the constraint with ON DELETE SET NULL
ALTER TABLE public.game_sessions 
ADD CONSTRAINT game_sessions_card_id_fkey 
FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE SET NULL;

-- Step 4: Same for pack_id if needed
ALTER TABLE public.game_sessions 
DROP CONSTRAINT IF EXISTS game_sessions_pack_id_fkey;

ALTER TABLE public.game_sessions 
ALTER COLUMN pack_id DROP NOT NULL;

ALTER TABLE public.game_sessions 
ADD CONSTRAINT game_sessions_pack_id_fkey 
FOREIGN KEY (pack_id) REFERENCES public.packs(id) ON DELETE SET NULL;

-- Step 5: Now clean up orphaned cards (cards without valid master category pack)
-- First unlink any sessions referencing these cards
UPDATE public.game_sessions 
SET card_id = NULL 
WHERE card_id IN (
  SELECT c.id
  FROM public.cards c
  LEFT JOIN public.packs p ON c.pack_id = p.id
  WHERE 
    c.pack_id IS NULL
    OR p.id IS NULL
    OR p.master_category IS NULL
    OR p.master_category NOT IN ('general', 'benicolet', 'picantes')
);

-- Delete cards without valid master category packs
DELETE FROM public.cards 
WHERE id IN (
  SELECT c.id
  FROM public.cards c
  LEFT JOIN public.packs p ON c.pack_id = p.id
  WHERE 
    c.pack_id IS NULL
    OR p.id IS NULL
    OR p.master_category IS NULL
    OR p.master_category NOT IN ('general', 'benicolet', 'picantes')
);

-- Also delete card_history for deleted cards (cleanup)
DELETE FROM public.card_history 
WHERE card_id NOT IN (SELECT id FROM public.cards);

-- Delete packs without valid master_category
DELETE FROM public.packs 
WHERE master_category IS NULL 
   OR master_category NOT IN ('general', 'benicolet', 'picantes');

-- Update master_category constraint to only allow our 3 categories
ALTER TABLE public.packs DROP CONSTRAINT IF EXISTS packs_master_category_check;
ALTER TABLE public.packs 
ADD CONSTRAINT packs_master_category_check 
CHECK (master_category IN ('general', 'benicolet', 'picantes'));
