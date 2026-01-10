import type { GameMode, GuestPlayer } from './game';

export type GameVariant = 'classic' | 'double_topo' | 'guess_player';

export interface SavedRoom {
  id: string;
  name: string;
  mode: GameMode;
  players: GuestPlayer[];
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  lastPlayedAt: string;
  // Game preferences (preserved for "play again")
  topoCount?: number;
  variant?: GameVariant;
  selectedPackIds?: string[];
  cluesEnabled?: boolean;
}

export interface SavedRoomsState {
  rooms: SavedRoom[];
  activeRoomId?: string; // Currently selected room for "play again"
}
