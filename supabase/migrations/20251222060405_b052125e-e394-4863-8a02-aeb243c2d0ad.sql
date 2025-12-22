
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create packs table
CREATE TABLE public.packs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on packs
ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;

-- Packs are readable by everyone (for game selection)
CREATE POLICY "Packs are publicly readable"
ON public.packs FOR SELECT
USING (true);

-- Only admins can manage packs
CREATE POLICY "Admins can insert packs"
ON public.packs FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update packs"
ON public.packs FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete packs"
ON public.packs FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create cards table
CREATE TABLE public.cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
    word text NOT NULL,
    clue text NOT NULL,
    difficulty integer NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NOT NULL REFERENCES public.profiles(id),
    UNIQUE(pack_id, word)
);

-- Enable RLS on cards
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Cards are readable by everyone (for game)
CREATE POLICY "Cards are publicly readable"
ON public.cards FOR SELECT
USING (true);

-- Only admins can manage cards
CREATE POLICY "Admins can insert cards"
ON public.cards FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update cards"
ON public.cards FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete cards"
ON public.cards FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Add card_id to game_sessions
ALTER TABLE public.game_sessions ADD COLUMN card_id uuid REFERENCES public.cards(id);

-- Insert default pack
INSERT INTO public.packs (name, slug) VALUES ('General', 'general');
