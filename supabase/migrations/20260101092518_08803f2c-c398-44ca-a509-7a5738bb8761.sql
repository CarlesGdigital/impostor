-- Add can_submit_words to profiles (for blocking users from submitting)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_submit_words boolean NOT NULL DEFAULT true;

-- Create card_history table for audit trail
CREATE TABLE public.card_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'created', 'updated', 'deactivated', 'reactivated', 'restored'
  old_word text,
  new_word text,
  old_clue text,
  new_clue text,
  old_difficulty integer,
  new_difficulty integer,
  old_is_active boolean,
  new_is_active boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on card_history
ALTER TABLE public.card_history ENABLE ROW LEVEL SECURITY;

-- Card history is readable by admins
CREATE POLICY "Admins can view all card history"
ON public.card_history FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view history of their own changes
CREATE POLICY "Users can view their own card history"
ON public.card_history FOR SELECT
USING (auth.uid() = user_id);

-- History is inserted via trigger, so we need insert policy
CREATE POLICY "System can insert card history"
ON public.card_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create card_reports table for reporting problematic words
CREATE TABLE public.card_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'dismissed'
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on card_reports
ALTER TABLE public.card_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "Users can create reports"
ON public.card_reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
ON public.card_reports FOR SELECT
USING (auth.uid() = reporter_id);

-- Admins can view and manage all reports
CREATE POLICY "Admins can view all reports"
ON public.card_reports FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reports"
ON public.card_reports FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update cards table RLS policies to allow registered users with can_submit_words
-- First drop the restrictive admin-only policies
DROP POLICY IF EXISTS "Admins can insert cards" ON public.cards;
DROP POLICY IF EXISTS "Admins can update cards" ON public.cards;

-- Create new policies allowing registered users
CREATE POLICY "Registered users can insert cards"
ON public.cards FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND can_submit_words = true
  )
);

CREATE POLICY "Registered users can update cards"
ON public.cards FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND can_submit_words = true
  )
);

-- Admins retain delete capability (for moderation)
-- The existing "Admins can delete cards" policy already handles this

-- Create function to check if card is used in any game session
CREATE OR REPLACE FUNCTION public.card_used_in_sessions(card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE game_sessions.card_id = card_used_in_sessions.card_id
  )
$$;