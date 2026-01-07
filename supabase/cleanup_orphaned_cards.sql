-- Script to clean up orphaned cards (words without valid master category packs)
-- Run this in Supabase SQL Editor

-- First, let's see what we have:
-- 1. Cards with NULL pack_id
-- 2. Cards with pack_id pointing to packs without master_category
-- 3. Cards with pack_id pointing to deleted/non-existent packs

-- Preview what will be deleted (run this first to verify)
SELECT 
  c.id,
  c.word,
  c.pack_id,
  p.name as pack_name,
  p.master_category
FROM public.cards c
LEFT JOIN public.packs p ON c.pack_id = p.id
WHERE 
  c.pack_id IS NULL
  OR p.id IS NULL
  OR p.master_category IS NULL
  OR p.master_category NOT IN ('general', 'benicolet', 'picantes');

-- Count how many will be affected
SELECT COUNT(*) as cards_to_delete
FROM public.cards c
LEFT JOIN public.packs p ON c.pack_id = p.id
WHERE 
  c.pack_id IS NULL
  OR p.id IS NULL
  OR p.master_category IS NULL
  OR p.master_category NOT IN ('general', 'benicolet', 'picantes');

-- DANGER ZONE: Uncomment below to actually delete
-- First unlink from game_sessions to avoid FK constraint errors
/*
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

-- Then delete the cards
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
*/

-- Also clean up packs that don't have valid master_category
-- Preview packs to delete
SELECT id, name, master_category, is_active
FROM public.packs
WHERE master_category IS NULL 
   OR master_category NOT IN ('general', 'benicolet', 'picantes');
