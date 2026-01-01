import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AddPlayerForm } from "@/components/game/AddPlayerForm";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { PackSelector } from "@/components/game/PackSelector";
import { SavedRoomSelector } from "@/components/game/SavedRoomSelector";
import { OfflineIndicator } from "@/components/game/OfflineIndicator";
import { useAuth } from "@/hooks/useAuth";
import { useGuestId } from "@/hooks/useGuestId";
import { useGameSession } from "@/hooks/useGameSession";
import { useSavedRooms } from "@/hooks/useSavedRooms";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, X, Users, Smartphone, AlertTriangle, Save, WifiOff } from "lucide-react";
import type { GameMode, GuestPlayer } from "@/types/game";
import type { SavedRoom } from "@/types/savedRoom";

export default function NewGamePage() {
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get("mode") as GameMode;

  const [mode, setMode] = useState<GameMode>(modeParam || "single");
  const [topoCount, setTopoCount] = useState(1);
  const [players, setPlayers] = useState<GuestPlayer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [variant, setVariant] = useState<'classic' | 'double_topo' | 'guess_player'>('classic');
  const [selectedSavedRoom, setSelectedSavedRoom] = useState<SavedRoom | null>(null);
  const [roomName, setRoomName] = useState('');
  const [showSaveOption, setShowSaveOption] = useState(true);

  const CREATION_TIMEOUT_MS = 10000; // 10 seconds

  const { user } = useAuth();
  const guestId = useGuestId();
  const { createSession } = useGameSession();
  const { createRoom, updateRoom, getRoomById } = useSavedRooms();
  const { isOnline } = useOnlineStatus();
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

  // Load players from selected saved room
  useEffect(() => {
    if (selectedSavedRoom) {
      setPlayers(selectedSavedRoom.players);
      setRoomName(selectedSavedRoom.name);
    }
  }, [selectedSavedRoom]);

  // Check for "play again" room from previous game
  useEffect(() => {
    const playAgainRoomId = localStorage.getItem('impostor:play_again_room_id');
    if (playAgainRoomId) {
      localStorage.removeItem('impostor:play_again_room_id');
      const room = getRoomById(playAgainRoomId);
      if (room && room.mode === mode) {
        setSelectedSavedRoom(room);
      }
    }
  }, [mode, getRoomById]);

  // Get previous card ID for exclusion (set by PlayAgainButton)
  const getPreviousCardId = (): string | undefined => {
    const id = localStorage.getItem('impostor:previous_card_id');
    if (id) {
      localStorage.removeItem('impostor:previous_card_id');
      console.info('[NewGame] Retrieved previous card ID for exclusion:', id);
      return id;
    }
    return undefined;
  };

  const handleSelectSavedRoom = (room: SavedRoom | null) => {
    setSelectedSavedRoom(room);
    if (!room) {
      setPlayers([]);
      setRoomName('');
    }
  };

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
    setCreateError(null);
    console.info('[NewGame] create begin', { mode, topoCount, playerCount: players.length });

    // Timeout mechanism: abort if operation takes too long
    let timeoutTriggered = false;
    const timeoutId = setTimeout(() => {
      timeoutTriggered = true;
      console.error('[NewGame] create TIMEOUT after', CREATION_TIMEOUT_MS, 'ms');
      setCreating(false);
      setCreateError('Timeout: La creación tardó demasiado. Pulse Reintentar.');
      toast.error('Tiempo de espera agotado');
    }, CREATION_TIMEOUT_MS);

    try {
      const previousCardId = getPreviousCardId();
      console.info('[NewGame] calling createSession', { previousCardId });
      const session = await createSession(mode, topoCount, user?.id, !user ? guestId : undefined, selectedPackIds, previousCardId);

      // If timeout already triggered, abort
      if (timeoutTriggered) {
        console.warn('[NewGame] Timeout already triggered, aborting');
        return;
      }

      if (!session) {
        console.error('[NewGame] createSession returned null');
        setCreateError('No se pudo crear la partida. Reintente.');
        toast.error("Error al crear la partida");
        return;
      }
      console.info('[NewGame] session created', { sessionId: session.id });

      // Store variant in localStorage
      localStorage.setItem(`impostor:variant:${session.id}`, variant);

      // Save room if enabled and mode is single
      if (mode === "single" && showSaveOption && players.length >= minPlayers) {
        const finalRoomName = roomName.trim() || `Sala ${new Date().toLocaleDateString()}`;
        if (selectedSavedRoom) {
          // Update existing room with new players
          updateRoom(selectedSavedRoom.id, { 
            players, 
            name: finalRoomName 
          });
        } else {
          // Create new saved room
          createRoom(finalRoomName, mode, players);
        }
        toast.success('Sala guardada');
      }

      if (mode === "single") {
        // Check if offline session (id starts with "offline-")
        const isOfflineSession = session.id.startsWith('offline-');
        
        if (isOfflineSession) {
          // Offline mode: Store players in localStorage instead of database
          console.info('[NewGame] OFFLINE: Storing players locally');
          const offlinePlayers = players.map((player, i) => ({
            id: `offline-player-${i}`,
            sessionId: session.id,
            userId: null,
            guestId: player.id,
            displayName: player.displayName,
            gender: player.gender,
            avatarKey: player.avatarKey,
            photoUrl: null,
            role: null,
            hasRevealed: false,
            turnOrder: i,
          }));
          localStorage.setItem(`impostor:offline_players:${session.id}`, JSON.stringify(offlinePlayers));
        } else {
          // Online mode: Insert players into database
          for (let i = 0; i < players.length; i++) {
            const player = players[i];
            console.info('[Supabase] insert session_player', { index: i, displayName: player.displayName });

            const { error: insertError } = await supabase.from("session_players").insert({
              session_id: session.id,
              guest_id: player.id,
              display_name: player.displayName,
              gender: player.gender,
              avatar_key: player.avatarKey,
              turn_order: i,
            });

            if (insertError) {
              console.error('[Supabase] insert session_player error', { index: i, error: insertError });
              throw new Error(`Error al añadir jugador ${player.displayName}`);
            }
            console.info('[Supabase] insert session_player ok', { index: i });
          }
        }

        console.info('[Router] navigating to game', { sessionId: session.id });
        navigate(`/game/${session.id}`);
      } else {
        // Multiplayer: Add host as first player
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
          console.info('[Supabase] fetching profile for host');
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

        console.info('[Supabase] insert host player');
        const { error: hostInsertError } = await supabase.from('session_players').insert(hostPlayerData);

        if (hostInsertError) {
          console.error('[Supabase] insert host player error', hostInsertError);
          throw new Error('Error al registrar al anfitrión en la sala');
        }
        console.info('[Supabase] insert host player ok');

        console.info('[Router] navigating to lobby', { sessionId: session.id });
        navigate(`/lobby/${session.id}`);
      }

      toast.success("¡Partida creada!");
      console.info('[NewGame] create end - SUCCESS');

    } catch (e: any) {
      console.error('[NewGame] create error', e);
      if (!timeoutTriggered) {
        setCreateError(e.message || 'Error desconocido al crear la partida.');
        toast.error(e.message || "Error al crear la partida");
      }
    } finally {
      clearTimeout(timeoutId);
      if (!timeoutTriggered) {
        setCreating(false);
      }
      console.info('[NewGame] create end - finally');
    }
  };

  const canCreate = (mode === "multi" || players.length >= minPlayers) && selectedPackIds.length > 0;
  const topoWarning = mode === "single" && players.length > 0 && topoCount > Math.floor(players.length / 2);

  return (
    <PageLayout
      title="Nueva partida"
      footer={
        <div className="space-y-3">
          <Button onClick={handleCreateGame} disabled={!canCreate || creating} className="w-full h-16 text-xl font-bold">
            {creating ? "Creando..." : mode === "multi" ? "Crear sala" : "Crear partida"}
          </Button>
          {createError && (
            <div className="p-4 border-2 border-destructive bg-destructive/10 text-center space-y-2">
              <p className="text-sm text-destructive font-medium">{createError}</p>
              <Button onClick={handleCreateGame} variant="outline" size="sm" disabled={creating}>
                Reintentar
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="max-w-md mx-auto space-y-8">
        {/* Offline indicator */}
        <div className="flex justify-center">
          <OfflineIndicator />
        </div>

        {/* Offline warning for multi mode */}
        {!isOnline && mode === "multi" && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
            <WifiOff className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-muted-foreground">
              El modo multimóvil no está disponible sin conexión. Usa el modo "Un móvil".
            </span>
          </div>
        )}

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
              disabled={!isOnline}
              className={cn(
                "flex flex-col items-center gap-2 p-4 border-2 border-foreground text-center font-bold transition-colors",
                mode === "multi" ? "bg-foreground text-background" : "bg-card hover:bg-secondary",
                !isOnline && "opacity-50 cursor-not-allowed"
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

        {/* Saved Rooms Selector - only for single mode */}
        {mode === "single" && (
          <SavedRoomSelector
            mode={mode}
            onSelectRoom={handleSelectSavedRoom}
            selectedRoomId={selectedSavedRoom?.id}
          />
        )}

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

            {/* Save room option */}
            {players.length >= minPlayers && (
              <div className="space-y-3 p-4 border-2 border-border bg-card">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="save-room"
                    checked={showSaveOption}
                    onChange={(e) => setShowSaveOption(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label htmlFor="save-room" className="flex items-center gap-2 font-bold cursor-pointer">
                    <Save className="w-5 h-5" />
                    Guardar sala para futuras partidas
                  </label>
                </div>
                {showSaveOption && (
                  <Input
                    placeholder="Nombre de la sala (ej: Familia, Amigos...)"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="h-12"
                  />
                )}
              </div>
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
