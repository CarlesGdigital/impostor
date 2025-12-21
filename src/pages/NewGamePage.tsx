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
import { Plus, X, Users, Smartphone } from 'lucide-react';
import type { GameMode, GuestPlayer } from '@/types/game';

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
  const maxTopos = Math.max(1, Math.floor((mode === 'single' ? players.length : 6) / 3));

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
    // In single mode, require minimum players
    if (mode === 'single' && players.length < minPlayers) {
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

      // Only add players manually for single mode
      if (mode === 'single') {
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
        navigate(`/game/${session.id}`);
      } else {
        // Multi mode: go directly to lobby, players join with code
        navigate(`/lobby/${session.id}`);
      }

      toast.success('¡Partida creada!');
    } finally {
      setCreating(false);
    }
  };

  const canCreate = mode === 'multi' || players.length >= minPlayers;

  return (
    <PageLayout 
      title="Nueva partida"
      footer={
        <Button
          onClick={handleCreateGame}
          disabled={!canCreate || creating}
          className="w-full h-16 text-xl font-bold"
        >
          {creating ? 'Creando...' : mode === 'multi' ? 'Crear sala' : 'Crear partida'}
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
                'flex flex-col items-center gap-2 p-4 border-2 border-foreground text-center font-bold transition-colors',
                mode === 'single' ? 'bg-foreground text-background' : 'bg-card hover:bg-secondary'
              )}
            >
              <Smartphone className="w-6 h-6" />
              Un móvil
            </button>
            <button
              onClick={() => setMode('multi')}
              className={cn(
                'flex flex-col items-center gap-2 p-4 border-2 border-foreground text-center font-bold transition-colors',
                mode === 'multi' ? 'bg-foreground text-background' : 'bg-card hover:bg-secondary'
              )}
            >
              <Users className="w-6 h-6" />
              Multimóvil
            </button>
          </div>
          {mode === 'multi' && (
            <p className="text-sm text-muted-foreground text-center">
              Los jugadores se unirán con un código desde sus móviles
            </p>
          )}
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
            {mode === 'single' 
              ? `Máximo ${maxTopos} topos para ${players.length || 3}+ jugadores`
              : 'Podrás ajustarlo cuando se unan los jugadores'
            }
          </p>
        </div>

        {/* Players - Only for single mode */}
        {mode === 'single' && (
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
        )}

        {/* Info for multi mode */}
        {mode === 'multi' && (
          <div className="border-2 border-foreground bg-card p-6 space-y-4">
            <h3 className="font-bold text-lg text-center">Cómo funciona</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-bold text-foreground">1.</span>
                Crea la sala y comparte el código
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-foreground">2.</span>
                Cada jugador entra con su móvil
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-foreground">3.</span>
                Inicia el reparto cuando estén todos
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-foreground">4.</span>
                Cada uno ve su carta en su móvil
              </li>
            </ol>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
