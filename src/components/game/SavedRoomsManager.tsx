import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSavedRooms } from '@/hooks/useSavedRooms';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { cn } from '@/lib/utils';
import { Users, Star, Clock, Trash2, Edit2, Check } from 'lucide-react';
import type { SavedRoom } from '@/types/savedRoom';

export function SavedRoomsManager() {
    const { favorites, history, toggleFavorite, deleteRoom, updateRoom } = useSavedRooms();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    if (favorites.length === 0 && history.length === 0) {
        return (
            <div className="p-8 border-2 border-dashed border-border rounded-lg text-center text-muted-foreground bg-card/50">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No tienes historial de partidas.</p>
                <p className="text-sm mt-1">¡Juega una partida para empezar!</p>
            </div>
        );
    }

    const handleStartEdit = (room: SavedRoom) => {
        setEditingId(room.id);
        setEditName(room.name);
    };

    const handleSaveEdit = async (roomId: string) => {
        if (editName.trim()) {
            await updateRoom(roomId, { name: editName.trim() });
        }
        setEditingId(null);
    };

    const RoomItem = ({ room }: { room: SavedRoom }) => (
        <div key={room.id} className="flex flex-col gap-2 p-3 border-2 border-border bg-card transition-colors hover:border-foreground/20">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className="bg-primary/10 p-2 rounded-full shrink-0">
                        <Users className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                        {editingId === room.id ? (
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit(room.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                }}
                            />
                        ) : (
                            <>
                                <p
                                    className="font-bold truncate cursor-pointer hover:underline decoration-dashed underline-offset-4"
                                    onClick={() => handleStartEdit(room)}
                                    title="Clic para renombrar"
                                >
                                    {room.name}
                                    <Edit2 className="inline w-3 h-3 ml-2 opacity-30" />
                                </p>
                                <div className="flex items-center gap-1 mt-1">
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                        {room.players.slice(0, 4).map(p => (
                                            <div key={p.id} className="w-5 h-5 rounded-full border border-background">
                                                <PlayerAvatar avatarKey={p.avatarKey} displayName={p.displayName} size="xs" />
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-xs text-muted-foreground ml-1">
                                        • {room.players.length} jugadores
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {editingId === room.id ? (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSaveEdit(room.id)}
                            className="h-8 px-3"
                        >
                            <Check className="w-4 h-4" />
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleFavorite(room.id)}
                                className={cn("hover:bg-yellow-500/10 transition-colors", room.isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500")}
                            >
                                <Star className={cn("w-5 h-5", room.isFavorite && "fill-current")} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (confirm('¿Seguro que quieres borrar esta sala?')) {
                                        deleteRoom(room.id);
                                    }
                                }}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="w-5 h-5" />
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            {favorites.length > 0 && (
                <div className="space-y-3">
                    <h3 className="flex items-center gap-2 font-bold text-sm uppercase text-yellow-600 border-b pb-1 border-yellow-600/20">
                        <Star className="w-4 h-4 fill-yellow-600" />
                        Favoritos ({favorites.length})
                    </h3>
                    <div className="grid gap-3">
                        {favorites.map((room) => (
                            <RoomItem key={room.id} room={room} />
                        ))}
                    </div>
                </div>
            )}

            {history.length > 0 && (
                <div className="space-y-3">
                    <h3 className="flex items-center gap-2 font-bold text-sm uppercase text-muted-foreground border-b pb-1">
                        <Clock className="w-4 h-4" />
                        Recientes
                    </h3>
                    <div className="grid gap-3">
                        {history.map((room) => (
                            <RoomItem key={room.id} room={room} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
