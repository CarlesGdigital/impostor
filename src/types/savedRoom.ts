import type { GameMode, GuestPlayer } from './game';

export interface SavedRoom {
  id: string;
  name: string;
  mode: GameMode;
  players: GuestPlayer[];
  joinCode?: string; // For multi mode, stored for reference
  createdAt: string;
  updatedAt: string;
}

export interface SavedRoomsState {
  rooms: SavedRoom[];
  activeRoomId?: string; // Currently selected room for "play again"
}
