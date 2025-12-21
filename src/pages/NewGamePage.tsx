import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AddPlayerForm } from '@/components/game/AddPlayerForm';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { useAuth } from '@/hooks/useAuth';
import { useGuestId } from '@/hooks/useGuestId';
import { useGameSession } from '@/hooks/useGameSession';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plus, X, Users } from 'lucide-react';
import type { GameMode, GuestPlayer } from '@/types/game';
import { getDefaultAvatar } from '@/lib/avatars';

export default function NewGamePage() {
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode') as GameMode;
  const [mode, setMode] = useState<GameMode>(modeParam || 'single');
  const [topoCount, setTopoCount] = useState(1);
  const [players, setPlayers] = useState<GuestPlayer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const { user } = useAuth();
  const guestId = useGuestId();
  const { createSession } = useGameSession();
  const navigate = useNavigate();

  const minPlayers = 3;
  const maxPlayers = 12;
  const maxTopos = Math.floor(players.length / 3) || 1;

  const handleAddPlayer = (player: GuestPlayer) => {
    if (players.length >= maxPlayers) {
      toast.error(`Máximo ${maxPlayers} jugadores`);
      return;
    }
    setPlayers([...players, player]);
    setShowAddForm(false);
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const handleCreateGame = async () => {
    if (players.length < minPlayers) {
      toast.error(`Mínimo ${minPlayers} jugadores`);
      return;
    }

    setCreating(true);

    try {
      const session = await createSession(
        mode,
        topoCount,
        user?.id,
        !user ? guestId : undefined
      );

      if (!session) {
        toast.error('Error al crear la partida');
        return;
      }

      // Add players to session
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        await supabase.from('session_players').insert({
          session_id: session.id,
          guest_id: player.id,
          display_name: player.displayName,
          gender: player.gender,
          avatar_key: player.avatarKey,
          turn_order: i,
        });
      }

      toast.success('¡Partida creada!');
      
      if (mode === 'single') {
        navigate(`/game/${session.id}`);
      } else {
        navigate(`/lobby/${session.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageLayout 
      title="Nueva partida"
      footer={
        <Button
          onClick={handleCreateGame}
          disabled={players.length < minPlayers || creating}
          className="w-full h-16 text-xl font-bold"
        >
          {creating ? 'Creando...' : 'Crear partida'}
        </Button>
      }
    >
      <div className="max-w-md mx-auto space-y-8">
        {/* Mode selector */}
        <div className="space-y-3">
          <Label className="text-lg font-bold">Modo de juego</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('single')}
              className={cn(
                'p-4 border-2 border-foreground text-center font-bold transition-colors',
                mode === 'single' ? 'bg-foreground text-background' : 'bg-card hover:bg-secondary'
              )}
            >
              Un móvil
            </button>
            <button
              onClick={() => setMode('multi')}
              className={cn(
                'p-4 border-2 border-foreground text-center font-bold transition-colors',
                mode === 'multi' ? 'bg-foreground text-background' : 'bg-card hover:bg-secondary'
              )}
            >
              Multimóvil
            </button>
          </div>
        </div>

        {/* Topo count */}
        <div className="space-y-3">
          <Label className="text-lg font-bold">Número de topos</Label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTopoCount(Math.max(1, topoCount - 1))}
              disabled={topoCount <= 1}
              className="w-14 h-14 border-2 border-foreground text-2xl font-bold disabled:opacity-30"
            >
              -
            </button>
            <span className="text-4xl font-bold w-16 text-center">{topoCount}</span>
            <button
              onClick={() => setTopoCount(Math.min(maxTopos, topoCount + 1))}
              disabled={topoCount >= maxTopos}
              className="w-14 h-14 border-2 border-foreground text-2xl font-bold disabled:opacity-30"
            >
              +
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Máximo {maxTopos} topos para {players.length || 3}+ jugadores
          </p>
        </div>

        {/* Players */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-bold">
              Jugadores ({players.length}/{maxPlayers})
            </Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              Mín. {minPlayers}
            </div>
          </div>

          {players.length > 0 && (
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 p-3 border-2 border-foreground bg-card"
                >
                  <PlayerAvatar
                    avatarKey={player.avatarKey}
                    displayName={player.displayName}
                    size="sm"
                  />
                  <span className="flex-1 font-bold truncate">
                    {player.displayName}
                  </span>
                  <button
                    onClick={() => handleRemovePlayer(player.id)}
                    className="p-2 hover:bg-secondary transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddForm ? (
            <div className="border-2 border-foreground p-4 bg-card">
              <AddPlayerForm
                onAddPlayer={handleAddPlayer}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          ) : (
            <Button
              onClick={() => setShowAddForm(true)}
              variant="outline"
              className="w-full h-14 text-lg font-bold border-2 border-dashed"
              disabled={players.length >= maxPlayers}
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
