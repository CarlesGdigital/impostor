-- DIAGNOSIS: Run this in Supabase SQL Editor to inspect constraints

SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE confrelid = 'public.cards'::regclass
AND n.nspname = 'public';

-- Expected Output for success:
-- constraint_name: game_sessions_card_id_fkey
-- table_name: game_sessions
-- definition: FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL
