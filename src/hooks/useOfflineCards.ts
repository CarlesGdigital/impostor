import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OfflineCard {
  id: string;
  word: string;
  clue: string | null;
  pack_id: string;
  master_category?: string | null;
}

interface OfflinePack {
  id: string;
  name: string;
  master_category: string | null;
}

const CARDS_STORAGE_KEY = 'topo_offline_cards';
const PACKS_STORAGE_KEY = 'topo_offline_packs';
const LAST_SYNC_KEY = 'topo_last_sync';

export function useOfflineCards() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [cardCount, setCardCount] = useState(0);

  // Load last sync time on mount
  useEffect(() => {
    const storedSync = localStorage.getItem(LAST_SYNC_KEY);
    if (storedSync) {
      setLastSync(new Date(storedSync));
    }
    const storedCards = getOfflineCards();
    setCardCount(storedCards.length);
  }, []);

  // Sync cards from database to localStorage
  const syncCards = useCallback(async (): Promise<boolean> => {
    console.info('[useOfflineCards] Starting sync...');
    setIsLoading(true);

    try {
      // Fetch all active cards
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('id, word, clue, pack_id')
        .neq('is_active', false);

      if (cardsError) {
        console.error('[useOfflineCards] Error fetching cards:', cardsError);
        return false;
      }

      // Fetch all active packs
      const { data: packs, error: packsError } = await supabase
        .from('packs')
        .select('id, name, master_category')
        .neq('is_active', false);

      if (packsError) {
        console.error('[useOfflineCards] Error fetching packs:', packsError);
        return false;
      }

      // Store in localStorage
      localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards || []));
      localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(packs || []));

      const now = new Date();
      localStorage.setItem(LAST_SYNC_KEY, now.toISOString());
      setLastSync(now);
      setCardCount(cards?.length || 0);

      console.info(`[useOfflineCards] Sync complete: ${cards?.length} cards, ${packs?.length} packs`);
      return true;
    } catch (error) {
      console.error('[useOfflineCards] Sync failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get cards from localStorage
  const getOfflineCards = useCallback((): OfflineCard[] => {
    try {
      const stored = localStorage.getItem(CARDS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  // Get packs from localStorage
  const getOfflinePacks = useCallback((): OfflinePack[] => {
    try {
      const stored = localStorage.getItem(PACKS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  // Get a random card from offline storage
  const getRandomOfflineCard = useCallback((
    selectedPackIds: string[],
    excludeCardId?: string
  ): OfflineCard | null => {
    const allCards = getOfflineCards();
    const allPacks = getOfflinePacks();

    // Filter by selected packs
    let candidates = allCards.filter(card => selectedPackIds.includes(card.pack_id));

    console.info('[useOfflineCards] getRandomOfflineCard', {
      totalCards: allCards.length,
      selectedPacks: selectedPackIds.length,
      candidatesBeforeExclusion: candidates.length,
      excludeCardId
    });

    // Exclude previous card if there are alternatives
    if (excludeCardId && candidates.length > 1) {
      candidates = candidates.filter(card => card.id !== excludeCardId);
      console.info('[useOfflineCards] Excluded previous card, remaining:', candidates.length);
    }

    if (candidates.length === 0) {
      console.warn('[useOfflineCards] No offline cards available');
      return null;
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const selected = candidates[randomIndex];

    // Find the pack to get master_category
    const pack = allPacks.find(p => p.id === selected.pack_id);
    const cardWithCategory: OfflineCard = {
      ...selected,
      master_category: pack?.master_category || null
    };

    console.info('[useOfflineCards] Selected offline card:', {
      cardId: cardWithCategory.id,
      word: cardWithCategory.word,
      masterCategory: cardWithCategory.master_category,
      candidateCount: candidates.length
    });

    return cardWithCategory;
  }, [getOfflineCards, getOfflinePacks]);

  // Check if we have offline data
  const hasOfflineData = useCallback((): boolean => {
    const cards = getOfflineCards();
    return cards.length > 0;
  }, [getOfflineCards]);

  return {
    syncCards,
    getOfflineCards,
    getOfflinePacks,
    getRandomOfflineCard,
    hasOfflineData,
    isLoading,
    lastSync,
    cardCount
  };
}
