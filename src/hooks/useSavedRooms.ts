import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SavedRoom, SavedRoomsState } from '@/types/savedRoom';
import type { GameMode, GuestPlayer } from '@/types/game';

const STORAGE_KEY = 'impostor:saved_rooms';

function loadFromStorage(): SavedRoomsState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[useSavedRooms] Error loading from localStorage:', e);
  }
  return { rooms: [] };
}

function saveToStorage(state: SavedRoomsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[useSavedRooms] Error saving to localStorage:', e);
  }
}

export function useSavedRooms() {
  const { user } = useAuth();
  const [state, setState] = useState<SavedRoomsState>(() => loadFromStorage());
  const [loading, setLoading] = useState(false);
  const [useLocalOnly, setUseLocalOnly] = useState(false);

  // Load from DB when user logs in, but fallback if error
  useEffect(() => {
    if (user && !useLocalOnly) {
      loadFromDb();
    } else if (!user) {
      // Revert to local storage if logged out
      setState(loadFromStorage());
      setUseLocalOnly(false);
    }
  }, [user, useLocalOnly]);

  // Sync to localStorage when state changes (Always sync as backup)
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const loadFromDb = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_rooms')
        .select('*')
        .order('last_played_at', { ascending: false });

      if (error) {
        // If table doesn't exist (404) or other error, switch to local only
        // PGRST205: function or view not found (often table missing)
        // 404: resource not found
        if (error.code === 'PGRST205' || error.code === '404' || error.message.includes('not found') || error.message.includes('does not exist')) {
          console.warn('[useSavedRooms] DB table not found, switching to local storage');
          setUseLocalOnly(true);
          // Load local storage which serves as the fallback source
          setState(loadFromStorage());
        } else {
          // If it's another error (e.g. network), we might want to throw or just log
          console.error('[useSavedRooms] DB Error:', error);
          setUseLocalOnly(true);
          setState(loadFromStorage());
        }
        return;
      }

      if (data) {
        // Map DB fields to application types
        const rooms: SavedRoom[] = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          mode: row.mode as GameMode,
          players: Array.isArray(row.players) ? row.players : [],
          topoCount: row.topo_count,
          variant: row.variant,
          selectedPackIds: row.selected_pack_ids,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          isFavorite: row.is_favorite || false,
          lastPlayedAt: row.last_played_at || row.created_at,
          cluesEnabled: row.clues_enabled,
        }));
        setState({ rooms });
      }
    } catch (e) {
      console.error('[useSavedRooms] Validation error loading from DB:', e);
      setUseLocalOnly(true);
      setState(loadFromStorage());
    } finally {
      setLoading(false);
    }
  };

  const createRoom = useCallback(async (
    name: string,
    mode: GameMode,
    players: GuestPlayer[],
    preferences?: { topoCount?: number; variant?: string; selectedPackIds?: string[]; isFavorite?: boolean; cluesEnabled?: boolean }
  ): Promise<SavedRoom | null> => {
    const now = new Date().toISOString();
    const newRoom: SavedRoom = {
      id: uuidv4(),
      name,
      mode,
      players,
      createdAt: now,
      updatedAt: now,
      isFavorite: preferences?.isFavorite ?? false,
      lastPlayedAt: now,
      topoCount: preferences?.topoCount,
      variant: preferences?.variant as any,
      selectedPackIds: preferences?.selectedPackIds,
      cluesEnabled: preferences?.cluesEnabled ?? true,
    };

    // Update local state immediately (Optimistic)
    setState(prev => ({
      ...prev,
      rooms: [newRoom, ...prev.rooms],
    }));

    if (user && !useLocalOnly) {
      try {
        const { data, error } = await supabase
          .from('saved_rooms')
          .insert({
            id: newRoom.id,
            user_id: user.id,
            name: newRoom.name,
            mode: newRoom.mode,
            players: newRoom.players as any,
            topo_count: newRoom.topoCount,
            variant: newRoom.variant,
            selected_pack_ids: newRoom.selectedPackIds,
            is_favorite: newRoom.isFavorite,
            last_played_at: newRoom.lastPlayedAt,
            clues_enabled: newRoom.cluesEnabled,
          })
          .select()
          .single();

        if (error) {
          // If error on insert, fallback to local only for future
          if (error.code === 'PGRST205' || error.code === '404') {
            setUseLocalOnly(true);
          }
          throw error;
        }
      } catch (e) {
        console.error('[useSavedRooms] Error saving to DB, kept local:', e);
        // We already updated state, so it persists locally via the useEffect hook
      }
    }

    return newRoom;
  }, [user, useLocalOnly]);

  const updateRoom = useCallback(async (roomId: string, updates: Partial<Omit<SavedRoom, 'id' | 'createdAt'>>): Promise<void> => {
    const now = new Date().toISOString();

    setState(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.id === roomId
          ? { ...room, ...updates, updatedAt: now }
          : room
      ).sort((a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime())
    }));

    if (user && !useLocalOnly) {
      try {
        const dbUpdates: any = { updated_at: now };
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.players) dbUpdates.players = updates.players;
        if (updates.topoCount !== undefined) dbUpdates.topo_count = updates.topoCount;
        if (updates.variant) dbUpdates.variant = updates.variant;
        if (updates.selectedPackIds) dbUpdates.selected_pack_ids = updates.selectedPackIds;
        if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
        if (updates.lastPlayedAt) dbUpdates.last_played_at = updates.lastPlayedAt;
        if (updates.cluesEnabled !== undefined) dbUpdates.clues_enabled = updates.cluesEnabled;


        const { error } = await supabase
          .from('saved_rooms')
          .update(dbUpdates)
          .eq('id', roomId);

        if (error) throw error;
      } catch (e) {
        console.error('[useSavedRooms] Error updating in DB:', e);
        // If fails, we accept purely local update
      }
    }
  }, [user, useLocalOnly]);

  const recordHistory = useCallback(async (
    players: GuestPlayer[],
    mode: GameMode,
    preferences?: {
      topoCount?: number;
      variant?: string;
      selectedPackIds?: string[];
      forceName?: string;
      forceFavorite?: boolean;
      cluesEnabled?: boolean;
    }
  ): Promise<void> => {
    const getPlayerSignature = (p: GuestPlayer[]) => p.map(x => x.displayName.trim().toLowerCase()).sort().join('|');
    const currentSig = getPlayerSignature(players);

    const existingRoom = state.rooms.find(r =>
      r.mode === mode &&
      getPlayerSignature(r.players) === currentSig
    );

    const now = new Date().toISOString();

    if (existingRoom) {
      const updates: any = {
        lastPlayedAt: now,
        topoCount: preferences?.topoCount,
        variant: preferences?.variant as any,
        selectedPackIds: preferences?.selectedPackIds,
        cluesEnabled: preferences?.cluesEnabled,
        players: players
      };

      if (preferences?.forceName) updates.name = preferences.forceName;
      if (preferences?.forceFavorite !== undefined) updates.isFavorite = preferences.forceFavorite;

      await updateRoom(existingRoom.id, updates);
    } else {
      const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      const defaultName = preferences?.forceName || `Partida ${dateStr} (${players.length} jug.)`;
      const isFav = preferences?.forceFavorite || false;

      await createRoom(defaultName, mode, players, {
        ...preferences,
        isFavorite: isFav
      });
    }
  }, [state.rooms, updateRoom, createRoom]);

  const toggleFavorite = useCallback(async (roomId: string) => {
    const room = state.rooms.find(r => r.id === roomId);
    if (!room) return;

    const newStatus = !room.isFavorite;
    await updateRoom(roomId, { isFavorite: newStatus });

    toast.success(newStatus ? 'Añadido a favoritos' : 'Eliminado de favoritos');
  }, [state.rooms, updateRoom]);

  const deleteRoom = useCallback(async (roomId: string): Promise<void> => {
    // Optimistic delete
    setState(prev => ({
      ...prev,
      rooms: prev.rooms.filter(room => room.id !== roomId),
      activeRoomId: prev.activeRoomId === roomId ? undefined : prev.activeRoomId,
    }));

    if (user && !useLocalOnly) {
      try {
        const { error } = await supabase
          .from('saved_rooms')
          .delete()
          .eq('id', roomId);

        if (error) throw error;
      } catch (e) {
        console.error('[useSavedRooms] Error deleting from DB:', e);
      }
    }
  }, [user, useLocalOnly]);

  const duplicateRoom = useCallback(async (roomId: string, newName: string): Promise<SavedRoom | null> => {
    const originalRoom = state.rooms.find(r => r.id === roomId);
    if (!originalRoom) return null;

    return createRoom(
      newName,
      originalRoom.mode,
      originalRoom.players.map(p => ({ ...p, id: uuidv4() })),
      {
        topoCount: originalRoom.topoCount,
        variant: originalRoom.variant,
        selectedPackIds: originalRoom.selectedPackIds,
        cluesEnabled: originalRoom.cluesEnabled
      }
    );
  }, [state.rooms, createRoom]);

  const setActiveRoom = useCallback((roomId: string | undefined): void => {
    setState(prev => ({
      ...prev,
      activeRoomId: roomId,
    }));
  }, []);

  const getRoomById = useCallback((roomId: string): SavedRoom | undefined => {
    return state.rooms.find(r => r.id === roomId);
  }, [state.rooms]);

  const getRoomsByMode = useCallback((mode: GameMode): SavedRoom[] => {
    return state.rooms.filter(r => r.mode === mode);
  }, [state.rooms]);

  return {
    rooms: state.rooms,
    favorites: state.rooms.filter(r => r.isFavorite),
    history: state.rooms.filter(r => !r.isFavorite),
    activeRoomId: state.activeRoomId,
    activeRoom: state.activeRoomId ? state.rooms.find(r => r.id === state.activeRoomId) : undefined,
    loading,
    createRoom,
    updateRoom,
    deleteRoom,
    duplicateRoom,
    setActiveRoom,
    getRoomById,
    getRoomsByMode,
    recordHistory,
    toggleFavorite,

    // Legacy helpers
    addPlayerToRoom: async (roomId: string, player: GuestPlayer) => {
      const room = state.rooms.find(r => r.id === roomId);
      if (room) await updateRoom(roomId, { players: [...room.players, player] });
    },
    removePlayerFromRoom: async (roomId: string, playerId: string) => {
      const room = state.rooms.find(r => r.id === roomId);
      if (room) await updateRoom(roomId, { players: room.players.filter(p => p.id !== playerId) });
    },
    updatePlayerInRoom: async (roomId: string, playerId: string, updates: Partial<GuestPlayer>) => {
      const room = state.rooms.find(r => r.id === roomId);
      if (room) await updateRoom(roomId, { players: room.players.map(p => p.id === playerId ? { ...p, ...updates } : p) });
    },
    reorderPlayersInRoom: async (roomId: string, newOrder: GuestPlayer[]) => {
      await updateRoom(roomId, { players: newOrder });
    }
  };
}
