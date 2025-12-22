export interface Pack {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
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
