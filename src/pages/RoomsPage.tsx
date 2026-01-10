import { useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SavedRoomsManager } from '@/components/game/SavedRoomsManager';
import { AddPlayerForm } from '@/components/game/AddPlayerForm';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { useSavedRooms } from '@/hooks/useSavedRooms';
import { toast } from 'sonner';
import { Plus, X, Save, Users, ArrowLeft } from 'lucide-react';
import type { GuestPlayer } from '@/types/game';

export default function RoomsPage() {
    const [isCreating, setIsCreating] = useState(false);

    if (isCreating) {
        return <CreateRoomView onCancel={() => setIsCreating(false)} onCallback={() => setIsCreating(false)} />;
    }

    return (
        <PageLayout title="Gestión de Salas">
            <div className="max-w-md mx-auto space-y-8">
                <Button
                    onClick={() => setIsCreating(true)}
                    className="w-full h-14 text-lg font-bold gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Crear nueva sala
                </Button>

                <SavedRoomsManager />
            </div>
        </PageLayout>
    );
}

function CreateRoomView({ onCancel, onCallback }: { onCancel: () => void, onCallback: () => void }) {
    const { createRoom } = useSavedRooms();
    const [name, setName] = useState('');
    const [players, setPlayers] = useState<GuestPlayer[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);

    const handleAddPlayer = (player: GuestPlayer) => {
        setPlayers([...players, player]);
        setShowAddForm(false);
    };

    const handleRemovePlayer = (id: string) => {
        setPlayers(players.filter(p => p.id !== id));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Escribe un nombre para la sala');
            return;
        }
        if (players.length < 2) {
            toast.error('Añade al menos 2 jugadores');
            return;
        }

        await createRoom(name.trim(), 'single', players, { isFavorite: true });
        toast.success('Sala creada en Favoritos');
        onCallback();
    };

    return (
        <PageLayout
            title="Crear Sala"
            showBack={false} // Custom back handling to cancel
            footer={
                <Button onClick={handleSave} disabled={players.length < 2 || !name.trim()} className="w-full h-14 text-xl font-bold">
                    <Save className="w-5 h-5 mr-2" />
                    Guardar Sala
                </Button>
            }
        >
            <div className="max-w-md mx-auto space-y-6">
                <Button variant="ghost" onClick={onCancel} className="mb-2 -ml-2 text-muted-foreground">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver a gestión
                </Button>

                <div className="space-y-2">
                    <Label>Nombre de la sala</Label>
                    <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ej: Familia Domingos"
                        className="text-lg h-12"
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-lg font-bold">
                            Jugadores ({players.length})
                        </Label>
                    </div>

                    <div className="space-y-2">
                        {players.map((player) => (
                            <div key={player.id} className="flex items-center gap-3 p-3 border-2 border-foreground bg-card">
                                <PlayerAvatar avatarKey={player.avatarKey} displayName={player.displayName} size="sm" />
                                <span className="flex-1 font-bold truncate">{player.displayName}</span>
                                <button
                                    onClick={() => handleRemovePlayer(player.id)}
                                    className="p-2 hover:bg-secondary transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ))}

                        {players.length === 0 && !showAddForm && (
                            <div className="text-center p-8 border-2 border-dashed text-muted-foreground rounded-lg">
                                Añade jugadores a esta sala
                            </div>
                        )}
                    </div>

                    {showAddForm ? (
                        <div className="border-2 border-foreground p-4 bg-card">
                            <AddPlayerForm onAddPlayer={handleAddPlayer} onCancel={() => setShowAddForm(false)} />
                        </div>
                    ) : (
                        <Button
                            onClick={() => setShowAddForm(true)}
                            variant="outline"
                            className="w-full h-14 text-lg font-bold border-2 border-dashed"
                        >
                            <Plus className="w-6 h-6 mr-2" />
                            Añadir jugador
                        </Button>
                    )}
                </div>
            </div>
        </PageLayout>
    );
}
