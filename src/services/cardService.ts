import { supabase } from "@/integrations/supabase/client";

export const cardService = {
    /**
     * Delete cards effectively.
     * If cards are referenced by game_sessions, the DB constraint ON DELETE SET NULL
     * will handle it (preserving session history).
     * 
     * @param cardIds Array of card IDs to delete
     * @returns 
     */
    async deleteCards(cardIds: string[]) {
        return await supabase
            .from('cards')
            .delete()
            .in('id', cardIds);
    },

    /**
     * Checks how many game_sessions reference the given card IDs.
     * Useful for showing warnings before deletion.
     */
    async countAffectedSessions(cardIds: string[]) {
        const { count, error } = await supabase
            .from('game_sessions')
            .select('id', { count: 'exact', head: true })
            .in('card_id', cardIds);

        if (error) throw error;
        return count || 0;
    }
};
