// Game constants shared across the application

export const GAME_CONFIG = {
    /** Minimum players required to start a game */
    MIN_PLAYERS: 3,
    /** Maximum players allowed in a game */
    MAX_PLAYERS: 20,
    /** Hard limit on number of topos */
    MAX_TOPOS: 5,
    /** Timeout for game creation process in ms */
    CREATION_TIMEOUT_MS: 10000,
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
    SAVED_ROOMS: 'impostor:saved_rooms',
    PREFERRED_CATEGORIES: 'topo_preferred_master_categories',
    ADULT_CONFIRMED: 'topo_adult_content_confirmed',
    PLAY_AGAIN_ROOM_ID: 'impostor:play_again_room_id',
    PREVIOUS_CARD_ID: 'impostor:previous_card_id',
    GUEST_WORD_SUBMISSIONS: 'impostor:guest_word_submissions',
} as const;
