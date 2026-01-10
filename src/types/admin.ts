export type MasterCategory = 'general' | 'benicolet' | 'picantes' | 'terreta';

export interface Pack {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  masterCategory: MasterCategory;
  createdAt: string;
}

export interface Card {
  id: string;
  packId: string;
  word: string;
  clue: string;
  difficulty?: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  // Joined data
  packName?: string;
  creatorName?: string;
}

export interface Profile {
  id: string;
  displayName: string | null;
  gender: string | null;
  avatarKey: string | null;
  photoUrl: string | null;
  canSubmitWords: boolean;
  email?: string;
}
