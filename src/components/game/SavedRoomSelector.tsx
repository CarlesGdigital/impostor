import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { useSavedRooms } from '@/hooks/useSavedRooms';
import { cn } from '@/lib/utils';
import { Plus, Users, ChevronDown, ChevronUp, Star, Clock } from 'lucide-react';
import type { GameMode } from '@/types/game';
import type { SavedRoom } from '@/types/savedRoom';

interface SavedRoomSelectorProps {
  mode: GameMode;
  onSelectRoom: (room: SavedRoom | null) => void;
  selectedRoomId?: string;
}

export function SavedRoomSelector({ mode, onSelectRoom, selectedRoomId }: SavedRoomSelectorProps) {
  const { favorites, history, toggleFavorite } = useSavedRooms();
  const [expanded, setExpanded] = useState(false);

  // Filter based on mode if needed (though history/favorites hooks usually return all or we should filter in the hook or here)
  // For now, let's filter here to match current mode
  const modeFavorites = favorites.filter(r => r.mode === mode);
  const modeHistory = history.filter(r => r.mode === mode).slice(0, 5); // Just top 5 history

  if (modeFavorites.length === 0 && modeHistory.length === 0) {
    return null;
  }

  const selectedRoom = [...favorites, ...history].find(r => r.id === selectedRoomId);

  const RoomItem = ({ room }: { room: SavedRoom }) => (
    <div
      className={cn(
        "border-2 transition-colors relative group",
        selectedRoomId === room.id
          ? "border-foreground bg-foreground/5"
          : "border-border bg-card"
      )}
    >
      <button
        onClick={() => onSelectRoom(room)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors"
      >
        <div className="flex -space-x-2">
          {room.players.slice(0, 3).map(player => (
            <div key={player.id} className="w-8 h-8 border-2 border-background rounded-full overflow-hidden">
              <PlayerAvatar avatarKey={player.avatarKey} displayName={player.displayName} size="sm" />
            </div>
          ))}
          {room.players.length > 3 && (
            <div className="w-8 h-8 border-2 border-background rounded-full bg-muted flex items-center justify-center text-xs font-bold">
              +{room.players.length - 3}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <p className="font-bold truncate">{room.name}</p>
          <p className="text-sm text-muted-foreground">{room.players.length} jugadores</p>
        </div>
      </button>

      {/* Favorite Toggle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(room.id);
        }}
        className="absolute top-3 right-3 p-1.5 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors"
      >
        <Star className={cn("w-4 h-4", room.isFavorite && "fill-yellow-400 text-yellow-400")} />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 border-2 border-border bg-card hover:bg-secondary transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          <span className="font-bold">Cargar partida ({modeFavorites.length + modeHistory.length})</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {expanded && (
        <div className="space-y-4 pl-2 border-l-2 border-border">
          {/* Start New Option */}
          <button
            onClick={() => onSelectRoom(null)}
            className={cn(
              "w-full flex items-center gap-3 p-3 border-2 transition-colors text-left",
              !selectedRoomId
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:bg-secondary"
            )}
          >
            <Plus className="w-5 h-5" />
            <span className="font-bold">Nueva partida (vacía)</span>
          </button>

          {/* Favorites Section */}
          {modeFavorites.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Star className="w-3 h-3" /> Favoritos
              </h4>
              {modeFavorites.map(room => (
                <RoomItem key={room.id} room={room} />
              ))}
            </div>
          )}

          {/* History Section */}
          {modeHistory.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mt-2">
                <Clock className="w-3 h-3" /> Recientes
              </h4>
              {modeHistory.map(room => (
                <RoomItem key={room.id} room={room} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected room summary (when collapsed) */}
      {!expanded && selectedRoom && (
        <div className="p-3 border-2 border-foreground bg-foreground/5 relative">
          <p className="font-bold">{selectedRoom.name}</p>
          <p className="text-sm text-muted-foreground">{selectedRoom.players.length} jugadores guardados</p>
          {selectedRoom.isFavorite && <Star className="w-4 h-4 text-yellow-500 absolute top-3 right-3 fill-yellow-500" />}
        </div>
      )}
    </div>
  );
}
