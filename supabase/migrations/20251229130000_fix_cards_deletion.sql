-- Migration: Fix cards deletion by changing FK to ON DELETE SET NULL
-- This allows deleting cards without breaking historical game sessions

-- 1. Ensure card_id is nullable (it should be, but let's be safe)
alter table public.game_sessions
  alter column card_id drop not null;

-- 2. Drop the existing foreign key constraint
alter table public.game_sessions
  drop constraint if exists game_sessions_card_id_fkey;

-- 3. Re-create it with ON DELETE SET NULL
alter table public.game_sessions
  add constraint game_sessions_card_id_fkey
  foreign key (card_id)
  references public.cards (id)
  on delete set null;

-- 4. Create index for performance (finding sessions by card_id)
create index if not exists game_sessions_card_id_idx
  on public.game_sessions (card_id);

-- 5. Ensure is_active has a default of true (if not already)
alter table public.cards
  alter column is_active set default true;
