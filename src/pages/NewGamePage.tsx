import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AddPlayerForm } from "@/components/game/AddPlayerForm";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { PackSelector } from "@/components/game/PackSelector";
import { useAuth } from "@/hooks/useAuth";
import { useGuestId } from "@/hooks/useGuestId";
import { useGameSession } from "@/hooks/useGameSession";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, X, Users, Smartphone, AlertTriangle } from "lucide-react";
import type { GameMode, GuestPlayer } from "@/types/game";

export default function NewGamePage() {
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get("mode") as GameMode;

  const [mode, setMode] = useState<GameMode>(modeParam || "single");
  const [topoCount, setTopoCount] = useState(1);
  const [players, setPlayers] = useState<GuestPlayer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [variant, setVariant] = useState<'classic' | 'double_topo' | 'guess_player'>('classic');

  const { user } = useAuth();
  const guestId = useGuestId();
  const { createSession } = useGameSession();
  const navigate = useNavigate();

  const minPlayers = 3;
  const maxPlayers = 20;
  const maxToposHard = 5;

  // En multi no sabemos jugadores aún; estimamos 6 para el warning/limit visual
  const playerCount = mode === "single" ? players.length : 6;
  const effectiveMaxTopos = Math.min(maxToposHard, Math.max(1, Math.floor(playerCount / 2)));

  useEffect(() => {
    if (topoCount > effectiveMaxTopos) setTopoCount(effectiveMaxTopos);
  }, [effectiveMaxTopos, topoCount]);

  // Doble topo siempre requiere 2 topos
  useEffect(() => {
    if (variant === 'double_topo') setTopoCount(2);
  }, [variant]);

  const handleAddPlayer = (player: GuestPlayer) => {
    if (players.length >= maxPlayers) {
      toast.error(`Máximo ${maxPlayers} jugadores`);
      return;
    }
    setPlayers([...players, player]);
    setShowAddForm(false);
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers(players.filter((p) => p.id !== id));
  };

  const handleCreateGame = async () => {
    if (selectedPackIds.length === 0) {
      toast.error("Selecciona al menos una categoría");
      return;
    }

    if (mode === "single" && players.length < minPlayers) {
      toast.error(`Mínimo ${minPlayers} jugadores`);
      return;
    }

    setCreating(true);

    try {
      const session = await createSession(mode, topoCount, user?.id, !user ? guestId : undefined, selectedPackIds);

      if (!session) {
        toast.error("Error al crear la partida");
        return;
      }

      // Persistir variant en localStorage
      localStorage.setItem(`impostor:variant:${session.id}`, variant);

      if (mode === "single") {
        for (let i = 0; i < players.length; i++) {
          const player = players[i];
          await supabase.from("session_players").insert({
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
        // Add host as first player in multiplayer mode
        let hostPlayerData: {
          session_id: string;
          user_id: string | null;
          guest_id: string | null;
          display_name: string;
          gender: string;
          avatar_key: string;
          photo_url: string | null;
          turn_order: number;
        } = {
          session_id: session.id,
          user_id: user?.id || null,
          guest_id: !user ? guestId : null,
          display_name: 'Anfitrión',
          gender: 'other',
          avatar_key: 'default',
          photo_url: null,
          turn_order: 0,
        };

        // Try to fetch profile for authenticated users
        if (user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, gender, avatar_key, photo_url')
            .eq('id', user.id)
            .single();

          if (profile) {
            hostPlayerData = {
              ...hostPlayerData,
              display_name: profile.display_name || 'Anfitrión',
              gender: profile.gender || 'other',
              avatar_key: profile.avatar_key || 'default',
              photo_url: profile.photo_url || null,
            };
          }
        }

        await supabase.from('session_players').insert(hostPlayerData);
        navigate(`/lobby/${session.id}`);
      }

      toast.success("¡Partida creada!");
    } finally {
      setCreating(false);
    }
  };

  const canCreate = (mode === "multi" || players.length >= minPlayers) && selectedPackIds.length > 0;
  const topoWarning = mode === "single" && players.length > 0 && topoCount > Math.floor(players.length / 2);

  return (
    <PageLayout
      title="Nueva partida"
      footer={
        <Button onClick={handleCreateGame} disabled={!canCreate || creating} className="w-full h-16 text-xl font-bold">
          {creating ? "Creando..." : mode === "multi" ? "Crear sala" : "Crear partida"}
        </Button>
      }
    >
      <div className="max-w-md mx-auto space-y-8">
        <div className="space-y-3">
          <Label className="text-lg font-bold">Modo de juego</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("single")}
              className={cn(
                "flex flex-col items-center gap-2 p-4 border-2 border-foreground text-center font-bold transition-colors",
                mode === "single" ? "bg-foreground text-background" : "bg-card hover:bg-secondary",
              )}
            >
              <Smartphone className="w-6 h-6" />
              Un móvil
            </button>
            <button
              onClick={() => setMode("multi")}
              className={cn(
                "flex flex-col items-center gap-2 p-4 border-2 border-foreground text-center font-bold transition-colors",
                mode === "multi" ? "bg-foreground text-background" : "bg-card hover:bg-secondary",
              )}
            >
              <Users className="w-6 h-6" />
              Multimóvil
            </button>
          </div>
          {mode === "multi" && (
            <p className="text-sm text-muted-foreground text-center">
              Los jugadores se unirán con un código desde sus móviles
            </p>
          )}
        </div>

        <PackSelector selectedPackIds={selectedPackIds} onSelectionChange={setSelectedPackIds} />

        <div className="space-y-3">
          <Label className="text-lg font-bold">Número de topos</Label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTopoCount(Math.max(1, topoCount - 1))}
              disabled={topoCount <= 1 || variant === 'double_topo'}
              className="w-14 h-14 border-2 border-foreground text-2xl font-bold disabled:opacity-30"
            >
              -
            </button>

            <span className="text-4xl font-bold w-16 text-center">{topoCount}</span>

            <button
              onClick={() => setTopoCount(Math.min(effectiveMaxTopos, topoCount + 1))}
              disabled={topoCount >= effectiveMaxTopos || variant === 'double_topo'}
              className="w-14 h-14 border-2 border-foreground text-2xl font-bold disabled:opacity-30"
            >
              +
            </button>
          </div>

          <p className="text-sm text-muted-foreground">
            Máximo {effectiveMaxTopos} topo(s) con {playerCount} jugadores (la mitad deben ser tripulación)
          </p>

          {topoWarning && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              Demasiados topos para {players.length} jugadores
            </div>
          )}
        </div>

        {/* Selector de variante */}
        <div className="space-y-3">
          <Label className="text-lg font-bold">Variante de juego</Label>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => setVariant('classic')}
              className={cn(
                "flex flex-col p-4 border-2 border-foreground text-left transition-colors",
                variant === 'classic' ? "bg-foreground text-background" : "bg-card hover:bg-secondary",
              )}
            >
              <span className="font-bold">Clásico</span>
              <span className="text-sm opacity-70">El juego tradicional de palabras</span>
            </button>
            <button
              onClick={() => setVariant('double_topo')}
              className={cn(
                "flex flex-col p-4 border-2 border-foreground text-left transition-colors",
                variant === 'double_topo' ? "bg-foreground text-background" : "bg-card hover:bg-secondary",
              )}
            >
              <span className="font-bold">Doble topo (uno confundido)</span>
              <span className="text-sm opacity-70">2 topos, pero uno cree ser tripulación</span>
            </button>
            <button
              onClick={() => setVariant('guess_player')}
              className={cn(
                "flex flex-col p-4 border-2 border-foreground text-left transition-colors",
                variant === 'guess_player' ? "bg-foreground text-background" : "bg-card hover:bg-secondary",
              )}
            >
              <span className="font-bold">Adivina al jugador</span>
              <span className="text-sm opacity-70">La palabra es el nombre de un jugador</span>
            </button>
          </div>
        </div>

        {mode === "single" && (
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
              </div>
            )}

            {showAddForm ? (
              <div className="border-2 border-foreground p-4 bg-card">
                <AddPlayerForm onAddPlayer={handleAddPlayer} onCancel={() => setShowAddForm(false)} />
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

        {mode === "multi" && (
          <div className="border-2 border-foreground bg-card p-6 space-y-4">
            <h3 className="font-bold text-lg text-center">Cómo funciona</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-bold text-foreground">1.</span> Crea la sala y comparte el código
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-foreground">2.</span> Cada jugador entra con su móvil
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-foreground">3.</span> Inicia el reparto cuando estén todos
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-foreground">4.</span> Cada uno ve su carta en su móvil
              </li>
            </ol>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
