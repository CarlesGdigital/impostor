-- Allow clue to be nullable for cards
ALTER TABLE public.cards ALTER COLUMN clue DROP NOT NULL;