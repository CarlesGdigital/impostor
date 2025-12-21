-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  avatar_key TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create words table for word/clue pairs
CREATE TABLE public.words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack TEXT NOT NULL DEFAULT 'General',
  word TEXT NOT NULL,
  clue TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Words are publicly readable" ON public.words FOR SELECT USING (true);

-- Insert sample words for MVP
INSERT INTO public.words (pack, word, clue) VALUES
  ('General', 'Playa', 'Vacaciones'),
  ('General', 'Pizza', 'Comida'),
  ('General', 'Guitarra', 'Música'),
  ('General', 'Hospital', 'Edificio'),
  ('General', 'Astronauta', 'Profesión'),
  ('General', 'Chocolate', 'Dulce'),
  ('General', 'Dinosaurio', 'Animal'),
  ('General', 'Volcán', 'Naturaleza'),
  ('General', 'Pirata', 'Personaje'),
  ('General', 'Helicóptero', 'Transporte');

-- Create game sessions table
CREATE TABLE public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  host_guest_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('single', 'multi')),
  join_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'dealing', 'ready', 'finished')),
  topo_count INTEGER NOT NULL DEFAULT 1,
  pack_id UUID REFERENCES public.words(id) ON DELETE SET NULL,
  word_id UUID REFERENCES public.words(id) ON DELETE SET NULL,
  word_text TEXT,
  clue_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game sessions" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create game sessions" ON public.game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Host can update their sessions" ON public.game_sessions FOR UPDATE USING (
  auth.uid() = host_user_id OR host_guest_id IS NOT NULL
);

-- Create session players table
CREATE TABLE public.session_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_id TEXT,
  display_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  avatar_key TEXT,
  photo_url TEXT,
  role TEXT CHECK (role IN ('crew', 'topo')),
  has_revealed BOOLEAN DEFAULT false,
  turn_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view session players" ON public.session_players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert session players" ON public.session_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update session players" ON public.session_players FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete session players" ON public.session_players FOR DELETE USING (true);

-- Enable realtime for game sessions and players
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_players;

-- Create function to generate join codes
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);