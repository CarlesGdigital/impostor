import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { useSavedRooms } from '@/hooks/useSavedRooms';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Copy, Edit2, Check, X, Users, ChevronDown, ChevronUp } from 'lucide-react';
import type { GameMode, GuestPlayer } from '@/types/game';
import type { SavedRoom } from '@/types/savedRoom';

interface SavedRoomSelectorProps {
  mode: GameMode;
  onSelectRoom: (room: SavedRoom | null) => void;
  selectedRoomId?: string;
}

export function SavedRoomSelector({ mode, onSelectRoom, selectedRoomId }: SavedRoomSelectorProps) {
  const { getRoomsByMode, deleteRoom, duplicateRoom, updateRoom } = useSavedRooms();
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const rooms = getRoomsByMode(mode);

  if (rooms.length === 0) {
    return null;
  }

  const handleStartEdit = (room: SavedRoom) => {
    setEditingId(room.id);
    setEditName(room.name);
  };

  const handleSaveEdit = (roomId: string) => {
    if (editName.trim()) {
      updateRoom(roomId, { name: editName.trim() });
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDuplicate = (room: SavedRoom) => {
    const newRoom = duplicateRoom(room.id, `${room.name} (copia)`);
    if (newRoom) {
      onSelectRoom(newRoom);
    }
  };

  const handleDelete = (roomId: string) => {
    if (selectedRoomId === roomId) {
      onSelectRoom(null);
    }
    deleteRoom(roomId);
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 border-2 border-border bg-card hover:bg-secondary transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          <span className="font-bold">Salas guardadas ({rooms.length})</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {expanded && (
        <div className="space-y-2 pl-2 border-l-2 border-border">
          {/* Option to start fresh */}
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
            <span className="font-bold">Crear nueva sala</span>
          </button>

          {/* Saved rooms */}
          {rooms.map(room => (
            <div
              key={room.id}
              className={cn(
                "border-2 transition-colors",
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
                <div className="flex-1 min-w-0">
                  {editingId === room.id ? (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit(room.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                      <button onClick={() => handleSaveEdit(room.id)} className="p-1 hover:bg-secondary rounded">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={handleCancelEdit} className="p-1 hover:bg-secondary rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="font-bold truncate">{room.name}</p>
                      <p className="text-sm text-muted-foreground">{room.players.length} jugadores</p>
                    </>
                  )}
                </div>
              </button>

              {/* Actions row */}
              {selectedRoomId === room.id && editingId !== room.id && (
                <div className="flex items-center gap-1 px-3 pb-3 pt-1 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleStartEdit(room); }}
                    className="h-8 px-2"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Renombrar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(room); }}
                    className="h-8 px-2"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Duplicar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(room.id); }}
                    className="h-8 px-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selected room summary (when collapsed) */}
      {!expanded && selectedRoom && (
        <div className="p-3 border-2 border-foreground bg-foreground/5">
          <p className="font-bold">{selectedRoom.name}</p>
          <p className="text-sm text-muted-foreground">{selectedRoom.players.length} jugadores guardados</p>
        </div>
      )}
    </div>
  );
}
