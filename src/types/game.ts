export type GameMode = 'single' | 'multi';
export type GameStatus = 'lobby' | 'dealing' | 'ready' | 'finished';
export type PlayerRole = 'crew' | 'topo';
export type Gender = 'male' | 'female' | 'other';

export interface Player {
  id: string;
  sessionId: string;
  userId?: string;
  guestId?: string;
  displayName: string;
  gender?: Gender;
  avatarKey?: string;
  photoUrl?: string;
  role?: PlayerRole;
  hasRevealed: boolean;
  turnOrder?: number;
}

export interface GameSession {
  id: string;
  hostUserId?: string;
  hostGuestId?: string;
  mode: GameMode;
  joinCode?: string;
  status: GameStatus;
  topoCount: number;
  packId?: string;
  wordId?: string;
  wordText?: string;
  clueText?: string;
  createdAt: string;
}

export interface Word {
  id: string;
  pack: string;
  word: string;
  clue: string;
  isActive: boolean;
}

export interface GuestPlayer {
  id: string;
  displayName: string;
  gender: Gender;
  avatarKey: string;
}
