-- Add preferred_pack_ids to profiles for storing user preferences
ALTER TABLE public.profiles ADD COLUMN preferred_pack_ids uuid[] NULL;

-- Add selected_pack_ids to game_sessions for storing which packs were used
ALTER TABLE public.game_sessions ADD COLUMN selected_pack_ids uuid[] NULL;

-- Add max_players to game_sessions
ALTER TABLE public.game_sessions ADD COLUMN max_players integer NULL DEFAULT 20;