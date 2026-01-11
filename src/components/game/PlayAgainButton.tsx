import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSavedRooms } from '@/hooks/useSavedRooms';
import { RefreshCw } from 'lucide-react';
import type { Player, GameMode } from '@/types/game';
import type { GuestPlayer } from '@/types/game';
import type { GameVariant } from '@/types/savedRoom';

interface PlayAgainButtonProps {
  sessionId: string;
  players: Player[];
  mode: GameMode;
  roomName?: string;
  previousCardId?: string; // Card ID from the finished game to exclude
  // Game preferences to preserve
  topoCount?: number;
  variant?: string;
  selectedPackIds?: string[];
  cluesEnabled?: boolean;
}

export function PlayAgainButton({
  sessionId,
  players,
  mode,
  roomName,
  previousCardId,
  topoCount,
  variant,
  selectedPackIds,
  cluesEnabled,
}: PlayAgainButtonProps) {
  const navigate = useNavigate();
  const { createRoom, updateRoom, getRoomsByMode } = useSavedRooms();

  const handlePlayAgain = async () => {
    // Convert players to GuestPlayer format for saving
    const guestPlayers: GuestPlayer[] = players.map(p => ({
      id: p.guestId || p.id,
      displayName: p.displayName,
      gender: p.gender || 'other',
      avatarKey: p.avatarKey || 'default',
    }));

    // Game preferences to save
    const preferences = {
      topoCount,
      variant,
      selectedPackIds,
      cluesEnabled,
    };

    // Check if a room with these exact players already exists
    const existingRooms = getRoomsByMode(mode);
    const existingRoom = existingRooms.find(room => {
      if (room.players.length !== guestPlayers.length) return false;
      const existingNames = room.players.map(p => p.displayName).sort();
      const currentNames = guestPlayers.map(p => p.displayName).sort();
      return existingNames.every((name, i) => name === currentNames[i]);
    });

    if (!existingRoom) {
      // Create new saved room with auto-generated name and preferences
      const roomCount = existingRooms.length + 1;
      const newName = roomName || `Sala ${roomCount}`;
      const newRoom = await createRoom(newName, mode, guestPlayers, preferences);

      // Store active room ID for NewGamePage to pick up
      if (newRoom) {
        localStorage.setItem('impostor:play_again_room_id', newRoom.id);
      }
    } else {
      // Update existing room with latest preferences
      await updateRoom(existingRoom.id, {
        players: guestPlayers,
        topoCount,
        variant: variant as GameVariant,
        selectedPackIds,
        cluesEnabled,
      });
      localStorage.setItem('impostor:play_again_room_id', existingRoom.id);
    }

    // Store previous card ID to exclude from next random selection
    if (previousCardId) {
      localStorage.setItem('impostor:previous_card_id', previousCardId);
      console.info('[PlayAgain] Storing previous card ID for exclusion:', previousCardId);
    }

    // Navigate to new game page with mode
    navigate(`/new-game?mode=${mode}`);
  };

  return (
    <Button
      onClick={handlePlayAgain}
      variant="outline"
      className="w-full h-14 text-lg font-bold border-2"
    >
      <RefreshCw className="w-5 h-5 mr-2" />
      Volver a jugar
    </Button>
  );
}

