-- Add columns for double_topo variant and first speaker persistence
-- first_speaker_player_id: persisted random first speaker for stability on reload
-- deceived_topo_player_id: the topo who doesn't know they're topo
-- deceived_word_text: alternative word shown to deceived topo
-- deceived_clue_text: alternative clue shown to deceived topo

ALTER TABLE public.game_sessions 
ADD COLUMN IF NOT EXISTS first_speaker_player_id uuid REFERENCES public.session_players(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deceived_topo_player_id uuid REFERENCES public.session_players(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deceived_word_text text,
ADD COLUMN IF NOT EXISTS deceived_clue_text text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_game_sessions_first_speaker ON public.game_sessions(first_speaker_player_id);

-- Update session_players to persist role assignment clearly
-- We need to distinguish between 'topo' (real), 'deceived_topo', and 'crew'
COMMENT ON COLUMN public.session_players.role IS 'Player role: crew, topo (real topo who knows), or deceived_topo (topo who thinks they are crew)';