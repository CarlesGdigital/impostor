import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
  const [state, setState] = useState<SavedRoomsState>(() => loadFromStorage());

  // Sync to localStorage when state changes
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const createRoom = useCallback((
    name: string,
    mode: GameMode,
    players: GuestPlayer[],
    joinCode?: string
  ): SavedRoom => {
    const now = new Date().toISOString();
    const newRoom: SavedRoom = {
      id: uuidv4(),
      name,
      mode,
      players,
      joinCode,
      createdAt: now,
      updatedAt: now,
    };

    setState(prev => ({
      ...prev,
      rooms: [...prev.rooms, newRoom],
    }));

    return newRoom;
  }, []);

  const updateRoom = useCallback((roomId: string, updates: Partial<Omit<SavedRoom, 'id' | 'createdAt'>>): void => {
    setState(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.id === roomId
          ? { ...room, ...updates, updatedAt: new Date().toISOString() }
          : room
      ),
    }));
  }, []);

  const deleteRoom = useCallback((roomId: string): void => {
    setState(prev => ({
      ...prev,
      rooms: prev.rooms.filter(room => room.id !== roomId),
      activeRoomId: prev.activeRoomId === roomId ? undefined : prev.activeRoomId,
    }));
  }, []);

  const duplicateRoom = useCallback((roomId: string, newName: string): SavedRoom | null => {
    const originalRoom = state.rooms.find(r => r.id === roomId);
    if (!originalRoom) return null;

    return createRoom(
      newName,
      originalRoom.mode,
      originalRoom.players.map(p => ({ ...p, id: uuidv4() })), // New IDs for duplicated players
      undefined // Don't copy join code
    );
  }, [state.rooms, createRoom]);

  const setActiveRoom = useCallback((roomId: string | undefined): void => {
    setState(prev => ({
      ...prev,
      activeRoomId: roomId,
    }));
  }, []);

  const addPlayerToRoom = useCallback((roomId: string, player: GuestPlayer): void => {
    setState(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              players: [...room.players, player],
              updatedAt: new Date().toISOString(),
            }
          : room
      ),
    }));
  }, []);

  const removePlayerFromRoom = useCallback((roomId: string, playerId: string): void => {
    setState(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              players: room.players.filter(p => p.id !== playerId),
              updatedAt: new Date().toISOString(),
            }
          : room
      ),
    }));
  }, []);

  const updatePlayerInRoom = useCallback((roomId: string, playerId: string, updates: Partial<GuestPlayer>): void => {
    setState(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              players: room.players.map(p =>
                p.id === playerId ? { ...p, ...updates } : p
              ),
              updatedAt: new Date().toISOString(),
            }
          : room
      ),
    }));
  }, []);

  const reorderPlayersInRoom = useCallback((roomId: string, newOrder: GuestPlayer[]): void => {
    setState(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              players: newOrder,
              updatedAt: new Date().toISOString(),
            }
          : room
      ),
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
    activeRoomId: state.activeRoomId,
    activeRoom: state.activeRoomId ? state.rooms.find(r => r.id === state.activeRoomId) : undefined,
    createRoom,
    updateRoom,
    deleteRoom,
    duplicateRoom,
    setActiveRoom,
    addPlayerToRoom,
    removePlayerFromRoom,
    updatePlayerInRoom,
    reorderPlayersInRoom,
    getRoomById,
    getRoomsByMode,
  };
}
