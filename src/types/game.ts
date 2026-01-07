export type GameMode = 'single';
export type GameStatus = 'lobby' | 'dealing' | 'ready' | 'discussion' | 'finished' | 'closed';
export type PlayerRole = 'crew' | 'topo' | 'deceived_topo';
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
  status: GameStatus;
  topoCount: number;
  maxPlayers?: number;
  packId?: string;
  cardId?: string;
  wordText?: string;
  clueText?: string;
  categoryText?: string;
  selectedPackIds?: string[];
  firstSpeakerPlayerId?: string;
  deceivedTopoPlayerId?: string;
  deceivedWordText?: string;
  deceivedClueText?: string;
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
