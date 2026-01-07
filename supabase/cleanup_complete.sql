-- ==============================================
-- SCRIPT DE NETEJA - EXECUTAR A SUPABASE SQL EDITOR
-- ==============================================

-- PASO 1: Canviar la FK constraint a ON DELETE SET NULL
-- Això permetrà eliminar cards sense error

ALTER TABLE public.game_sessions 
DROP CONSTRAINT IF EXISTS game_sessions_card_id_fkey;

ALTER TABLE public.game_sessions 
ALTER COLUMN card_id DROP NOT NULL;

ALTER TABLE public.game_sessions 
ADD CONSTRAINT game_sessions_card_id_fkey 
FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE SET NULL;

-- Fer el mateix per pack_id
ALTER TABLE public.game_sessions 
DROP CONSTRAINT IF EXISTS game_sessions_pack_id_fkey;

ALTER TABLE public.game_sessions 
ALTER COLUMN pack_id DROP NOT NULL;

ALTER TABLE public.game_sessions 
ADD CONSTRAINT game_sessions_pack_id_fkey 
FOREIGN KEY (pack_id) REFERENCES public.packs(id) ON DELETE SET NULL;

-- ==============================================
-- PASO 2: Veure quins packs hi ha i les seves master_category
-- ==============================================

SELECT 
  master_category, 
  COUNT(*) as count,
  array_agg(name ORDER BY name) as pack_names
FROM packs 
GROUP BY master_category
ORDER BY count DESC;

-- ==============================================
-- PASO 3: Mantenir NOMÉS els 3 packs principals (un per master_category)
-- Primer, crear-los si no existeixen
-- ==============================================

-- Crear els 3 packs master si no existeixen
INSERT INTO public.packs (name, slug, master_category, is_active)
VALUES 
  ('General', 'general', 'general', true),
  ('Benicolet', 'benicolet', 'benicolet', true),
  ('Picantes', 'picantes', 'picantes', true)
ON CONFLICT (slug) DO NOTHING;

-- ==============================================
-- PASO 4: Moure TOTES les cards als 3 packs principals
-- ==============================================

-- Moure cards de packs amb master_category='general' al pack principal 'General'
UPDATE public.cards c
SET pack_id = (SELECT id FROM public.packs WHERE slug = 'general' LIMIT 1)
WHERE c.pack_id IN (
  SELECT id FROM public.packs 
  WHERE master_category = 'general' AND slug != 'general'
);

-- Moure cards de packs amb master_category='benicolet' al pack principal 'Benicolet'  
UPDATE public.cards c
SET pack_id = (SELECT id FROM public.packs WHERE slug = 'benicolet' LIMIT 1)
WHERE c.pack_id IN (
  SELECT id FROM public.packs 
  WHERE master_category = 'benicolet' AND slug != 'benicolet'
);

-- Moure cards de packs amb master_category='picantes' al pack principal 'Picantes'
UPDATE public.cards c
SET pack_id = (SELECT id FROM public.packs WHERE slug = 'picantes' LIMIT 1)
WHERE c.pack_id IN (
  SELECT id FROM public.packs 
  WHERE master_category = 'picantes' AND slug != 'picantes'
);

-- ==============================================
-- PASO 5: Eliminar tots els packs que NO són els 3 principals
-- ==============================================

DELETE FROM public.packs 
WHERE slug NOT IN ('general', 'benicolet', 'picantes');

-- ==============================================
-- VERIFICACIÓ: Comprovar el resultat
-- ==============================================

SELECT 'PACKS' as tabla, COUNT(*) as total FROM packs
UNION ALL
SELECT 'CARDS' as tabla, COUNT(*) as total FROM cards;

SELECT * FROM packs ORDER BY name;
