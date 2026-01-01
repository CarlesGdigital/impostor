import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSavedRooms } from '@/hooks/useSavedRooms';
import { RefreshCw, Save } from 'lucide-react';
import type { Player, GameMode } from '@/types/game';
import type { GuestPlayer } from '@/types/game';

interface PlayAgainButtonProps {
  sessionId: string;
  players: Player[];
  mode: GameMode;
  roomName?: string;
}

export function PlayAgainButton({ sessionId, players, mode, roomName }: PlayAgainButtonProps) {
  const navigate = useNavigate();
  const { createRoom, rooms, getRoomsByMode } = useSavedRooms();

  const handlePlayAgain = () => {
    // Convert players to GuestPlayer format for saving
    const guestPlayers: GuestPlayer[] = players.map(p => ({
      id: p.guestId || p.id,
      displayName: p.displayName,
      gender: p.gender || 'other',
      avatarKey: p.avatarKey || 'default',
    }));

    // Check if a room with these exact players already exists
    const existingRooms = getRoomsByMode(mode);
    const existingRoom = existingRooms.find(room => {
      if (room.players.length !== guestPlayers.length) return false;
      const existingNames = room.players.map(p => p.displayName).sort();
      const currentNames = guestPlayers.map(p => p.displayName).sort();
      return existingNames.every((name, i) => name === currentNames[i]);
    });

    if (!existingRoom) {
      // Create new saved room with auto-generated name
      const roomCount = existingRooms.length + 1;
      const newName = roomName || `Sala ${roomCount}`;
      const newRoom = createRoom(newName, mode, guestPlayers);
      
      // Store active room ID for NewGamePage to pick up
      localStorage.setItem('impostor:play_again_room_id', newRoom.id);
    } else {
      // Use existing room
      localStorage.setItem('impostor:play_again_room_id', existingRoom.id);
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
