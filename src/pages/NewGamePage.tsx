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
import { Plus, X, Users, AlertTriangle, Save } from "lucide-react";
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
  const [variant, setVariant] = useState<'classic' | 'misterioso' | 'caos'>('classic');
  const [cluesEnabled, setCluesEnabled] = useState(true);
  const [selectedSavedRoom, setSelectedSavedRoom] = useState<SavedRoom | null>(null);

  // RESTORED: Manual save options
  const [showSaveOption, setShowSaveOption] = useState(false);
  const [roomName, setRoomName] = useState('');

  const CREATION_TIMEOUT_MS = 10000; // 10 seconds

  const { user } = useAuth();
  const guestId = useGuestId();
  const { createSession } = useGameSession();
  const { isOnline } = useOnlineStatus();
  const { createRoom, updateRoom, getRoomById, recordHistory } = useSavedRooms();
  const navigate = useNavigate();

  const minPlayers = 3;
  const maxPlayers = 20;
  const maxToposHard = 5;

  const playerCount = mode === "single" ? players.length : 6;
  const effectiveMaxTopos = Math.min(maxToposHard, Math.max(1, Math.floor(playerCount / 2)));

  useEffect(() => {
    if (topoCount > effectiveMaxTopos) setTopoCount(effectiveMaxTopos);
  }, [effectiveMaxTopos, topoCount]);

  // Misterioso mode doesn't affect topo count
  // Caos mode will randomize at game start, keep UI selection visible

  useEffect(() => {
    if (selectedSavedRoom) {
      setPlayers(selectedSavedRoom.players);
      // Restore game preferences
      if (selectedSavedRoom.topoCount !== undefined) {
        setTopoCount(selectedSavedRoom.topoCount);
      }
      if (selectedSavedRoom.variant) {
        setVariant(selectedSavedRoom.variant as any);
      }
      if (selectedSavedRoom.selectedPackIds?.length) {
        setSelectedPackIds(selectedSavedRoom.selectedPackIds);
      }
      if (selectedSavedRoom.cluesEnabled !== undefined) {
        setCluesEnabled(selectedSavedRoom.cluesEnabled);
      }

      // Setup manual save state if room is favorite
      if (selectedSavedRoom.isFavorite) {
        setRoomName(selectedSavedRoom.name);
        setShowSaveOption(true);
      } else {
        setRoomName('');
        setShowSaveOption(false);
      }
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
      setShowSaveOption(false);
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
      const session = await createSession(mode, topoCount, user?.id, !user ? guestId : undefined, selectedPackIds, previousCardId, cluesEnabled);

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

      // Record history OR Explicit Save
      if (mode === 'single' && players.length >= minPlayers) {
        console.info('[NewGame] Saving room/history');

        const finalRoomName = (showSaveOption && roomName.trim()) ? roomName.trim() : undefined;

        await recordHistory(players, mode, {
          topoCount,
          variant,
          selectedPackIds,
          forceName: finalRoomName,
          forceFavorite: showSaveOption ? true : undefined // Only force true if checked, otherwise leave as is/false
        });

        if (showSaveOption) toast.success('Sala guardada en favoritos');
      }

      localStorage.setItem(`impostor:variant:${session.id}`, variant);

      if (mode === "single") {
        const isOfflineSession = session.id.startsWith('offline-');

        if (isOfflineSession) {
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
          for (let i = 0; i < players.length; i++) {
            const player = players[i];
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
          }
        }

        navigate(`/game/${session.id}`);
      } else {
        // Multiplayer (kept just in case logic needed later, though concealed in UI)
        navigate(`/lobby/${session.id}`);
      }

      toast.success("¡Partida creada!");

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
        <div className="flex justify-center">
          <OfflineIndicator />
        </div>

        <PackSelector selectedPackIds={selectedPackIds} onSelectionChange={setSelectedPackIds} />

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
              disabled={topoCount <= 1 || variant === 'caos'}
              className="w-14 h-14 border-2 border-foreground text-2xl font-bold disabled:opacity-30"
            >
              -
            </button>

            <span className="text-4xl font-bold w-16 text-center">{topoCount}</span>

            <button
              onClick={() => setTopoCount(Math.min(effectiveMaxTopos, topoCount + 1))}
              disabled={topoCount >= effectiveMaxTopos || variant === 'caos'}
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

        <div className="space-y-3">
          <Label className="text-lg font-bold">Pistas</Label>
          <div className="flex items-center gap-3 p-4 border-2 border-border bg-card">
            <input
              type="checkbox"
              id="clues-toggle"
              checked={cluesEnabled}
              onChange={(e) => setCluesEnabled(e.target.checked)}
              className="w-5 h-5 cursor-pointer"
            />
            <label htmlFor="clues-toggle" className="flex-1 font-bold cursor-pointer">
              Activar pistas para el Topo
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            Si se desactiva, el Topo no verá ninguna pista sobre la palabra secreta.
          </p>
        </div>

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
              onClick={() => setVariant('misterioso')}
              className={cn(
                "flex flex-col p-4 border-2 border-foreground text-left transition-colors",
                variant === 'misterioso' ? "bg-foreground text-background" : "bg-card hover:bg-secondary",
              )}
            >
              <span className="font-bold">🎭 Misterioso</span>
              <span className="text-sm opacity-70">Los topos no saben que lo son (ven otra palabra)</span>
            </button>
            <button
              onClick={() => setVariant('caos')}
              className={cn(
                "flex flex-col p-4 border-2 border-foreground text-left transition-colors",
                variant === 'caos' ? "bg-foreground text-background" : "bg-card hover:bg-secondary",
              )}
            >
              <span className="font-bold">🌀 Caos</span>
              <span className="text-sm opacity-70">Número de topos aleatorio (1 a todos)</span>
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

            {/* RESTORED: Save room option */}
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
                {!showSaveOption && (
                  <p className="text-xs text-center text-muted-foreground pt-0">
                    Se guardará automáticamente en el historial si no la marcas como favorita.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout >
  );
}
