-- Migration: Fix game_sessions status constraint and ensure first_speaker_player_id exists
-- This fixes the error 23514 (status constraint) and PGRST204 (missing column)

-- 1. Ensure first_speaker_player_id exists
ALTER TABLE public.game_sessions 
  ADD COLUMN IF NOT EXISTS first_speaker_player_id UUID REFERENCES public.session_players(id);

-- 2. Update status constraint to include 'discussion' and 'closed'
-- We drop the existing constraint (whatever its name might be, we assume standard naming or try to be safe)
ALTER TABLE public.game_sessions DROP CONSTRAINT IF EXISTS game_sessions_status_check;

ALTER TABLE public.game_sessions 
  ADD CONSTRAINT game_sessions_status_check 
  CHECK (status IN ('lobby', 'dealing', 'ready', 'discussion', 'finished', 'closed'));

-- 3. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
