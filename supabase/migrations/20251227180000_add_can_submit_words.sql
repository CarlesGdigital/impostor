-- Migration: Add can_submit_words permission to profiles
-- This allows admins to control which users can submit words

-- Add can_submit_words column to profiles (default false)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS can_submit_words BOOLEAN NOT NULL DEFAULT false;

-- Drop existing insert policy on cards to replace it
DROP POLICY IF EXISTS "Admins can insert cards" ON public.cards;

-- Create new policy that allows admins OR users with can_submit_words permission
CREATE POLICY "Authorized users can insert cards"
ON public.cards FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND can_submit_words = true
  )
);

-- Allow admins to view all profiles for user management
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any profile (for permission management)
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Add first_speaker_player_id for multiplayer discussion phase
ALTER TABLE public.game_sessions 
  ADD COLUMN IF NOT EXISTS first_speaker_player_id UUID REFERENCES public.session_players(id);

-- Update game_sessions status check constraint to include 'discussion'
ALTER TABLE public.game_sessions DROP CONSTRAINT IF EXISTS game_sessions_status_check;
ALTER TABLE public.game_sessions 
  ADD CONSTRAINT game_sessions_status_check 
  CHECK (status IN ('lobby', 'dealing', 'ready', 'discussion', 'finished', 'closed'));
