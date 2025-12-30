-- Migration to fix data issues and enable soft deletes

-- 1. Add master_category to packs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'packs' AND column_name = 'master_category') THEN
        ALTER TABLE packs ADD COLUMN master_category TEXT;
    END IF;
END $$;

-- 2. Modify game_sessions foreign key to allow SET NULL on delete
-- First make sure the column allows NULLs
ALTER TABLE game_sessions ALTER COLUMN card_id DROP NOT NULL;

-- Drop existing constraint if it exists (name might vary, trying standard naming)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'game_sessions_card_id_fkey') THEN
        ALTER TABLE game_sessions DROP CONSTRAINT game_sessions_card_id_fkey;
    END IF;
END $$;

-- Add the new constraint with ON DELETE SET NULL
ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_card_id_fkey
    FOREIGN KEY (card_id)
    REFERENCES cards(id)
    ON DELETE SET NULL;

-- 3. Add index on card_id for performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_card_id ON game_sessions(card_id);
