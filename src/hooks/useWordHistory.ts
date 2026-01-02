import { useState, useCallback } from 'react';

const WORD_HISTORY_KEY = 'impostor:word_history';
const MAX_HISTORY_SIZE = 5;

/**
 * Hook to manage word history to prevent repetition across games.
 * Stores the last N card IDs used and provides functions to check/add.
 */
export function useWordHistory() {
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(WORD_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  /**
   * Check if a card ID was used recently (in last 5 games)
   */
  const wasRecentlyUsed = useCallback((cardId: string): boolean => {
    return history.includes(cardId);
  }, [history]);

  /**
   * Add a card ID to history after it's used in a game
   */
  const addToHistory = useCallback((cardId: string) => {
    setHistory(prev => {
      // Don't add duplicates
      if (prev.includes(cardId)) return prev;
      
      // Add to front, keep only last N
      const newHistory = [cardId, ...prev].slice(0, MAX_HISTORY_SIZE);
      localStorage.setItem(WORD_HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  /**
   * Get all card IDs to exclude from random selection
   */
  const getExcludedCardIds = useCallback((): string[] => {
    return history;
  }, [history]);

  /**
   * Clear history (for testing or reset)
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(WORD_HISTORY_KEY);
  }, []);

  return {
    history,
    wasRecentlyUsed,
    addToHistory,
    getExcludedCardIds,
    clearHistory,
  };
}
