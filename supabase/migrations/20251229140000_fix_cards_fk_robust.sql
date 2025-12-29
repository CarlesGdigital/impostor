-- ROBUST MIGRATION: Fix cards deletion idempotently
-- Timestamp: 20251229140000

BEGIN;

-- 1. Ensure card_id is nullable (safe to run multiple times)
ALTER TABLE public.game_sessions
  ALTER COLUMN card_id DROP NOT NULL;

-- 2. Drop the specific constraint if it exists
ALTER TABLE public.game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_card_id_fkey;

-- 3. Re-create the constraint with ON DELETE SET NULL
-- We use a DO block to avoid error if it somehow existed under a different name,
-- but standard practice for named constraints is just Drop Then Create.
ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_card_id_fkey
  FOREIGN KEY (card_id)
  REFERENCES public.cards (id)
  ON DELETE SET NULL;

-- 4. Ensure Index exists for performance (idempotent)
CREATE INDEX IF NOT EXISTS game_sessions_card_id_idx
  ON public.game_sessions (card_id);

-- 5. Ensure defaults (idempotent)
ALTER TABLE public.cards
  ALTER COLUMN is_active SET DEFAULT true;

COMMIT;
