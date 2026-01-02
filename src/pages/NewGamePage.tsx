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
import { useWordHistory } from "@/hooks/useWordHistory";
import { useSavedRooms } from "@/hooks/useSavedRooms";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, X, AlertTriangle, Save, WifiOff } from "lucide-react";
import type { GuestPlayer } from "@/types/game";
import type { SavedRoom } from "@/types/savedRoom";

export default function NewGamePage() {
  // Single mode only (multiplayer removed)
  const mode = 'single' as const;
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

  const CREATION_TIMEOUT_MS = 5000; // 5 seconds (reduced for better UX)

  const { user } = useAuth();
  const guestId = useGuestId();
  const { createSession } = useGameSession();
  const { createRoom, updateRoom, getRoomById } = useSavedRooms();
  const { isOnline } = useOnlineStatus();
  const { getExcludedCardIds, addToHistory } = useWordHistory();
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

  // Get card IDs to exclude from selection (from word history + previous game)
  const getExcludeCardIds = (): string[] => {
    const historyIds = getExcludedCardIds();
    
    // Also check for immediate previous card (from play again)
    const previousCardId = localStorage.getItem('impostor:previous_card_id');
    if (previousCardId) {
      localStorage.removeItem('impostor:previous_card_id');
      console.info('[NewGame] Retrieved previous card ID for exclusion:', previousCardId);
      // Add to list if not already there
      if (!historyIds.includes(previousCardId)) {
        return [previousCardId, ...historyIds];
      }
    }
    
    console.info('[NewGame] Excluding card IDs from history:', historyIds.length);
    return historyIds;
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

    try {
      const excludeCardIds = getExcludeCardIds();
      const session = await createSession(mode, topoCount, user?.id, !user ? guestId : undefined, selectedPackIds, excludeCardIds[0]);

      if (!session) {
        setCreateError('No se pudo crear la partida. Reintente.');
        toast.error("Error al crear la partida");
        setCreating(false);
        return;
      }
      console.info('[NewGame] session created', { sessionId: session.id });

      // Add card to history to prevent repetition
      if (session.cardId) {
        addToHistory(session.cardId);
        console.info('[NewGame] Added card to history:', session.cardId);
      }

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
        // Online mode: Insert players into database in parallel
        await Promise.all(players.map((player, i) =>
          supabase.from("session_players").insert({
            session_id: session.id,
            guest_id: player.id,
            display_name: player.displayName,
            gender: player.gender,
            avatar_key: player.avatarKey,
            turn_order: i,
          })
        ));
      }

      console.info('[Router] navigating to game', { sessionId: session.id });
      navigate(`/game/${session.id}`);
      toast.success("¡Partida creada!");

    } catch (e: any) {
      console.error('[NewGame] create error', e);
      setCreateError(e.message || 'Error desconocido al crear la partida.');
      toast.error(e.message || "Error al crear la partida");
    } finally {
      setCreating(false);
    }
  };

  const canCreate = players.length >= minPlayers && selectedPackIds.length > 0;
  const topoWarning = players.length > 0 && topoCount > Math.floor(players.length / 2);

  return (
    <PageLayout
      title="Nueva partida"
      footer={
        <div className="space-y-3">
          <Button onClick={handleCreateGame} disabled={!canCreate || creating} className="w-full h-16 text-xl font-bold transition-transform duration-200 active:scale-95">
            {creating ? "Creando..." : "Crear partida"}
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

        {/* Offline notice - just informative, game works offline */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-lg text-sm">
            <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              Modo sin conexión. El juego funciona normalmente.
            </span>
          </div>
        )}

        <PackSelector selectedPackIds={selectedPackIds} onSelectionChange={setSelectedPackIds} />

        <SavedRoomSelector
          mode={mode}
          onSelectRoom={handleSelectSavedRoom}
          selectedRoomId={selectedSavedRoom?.id}
        />

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

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-bold">
              Jugadores ({players.length}/{maxPlayers})
            </Label>
            <div className="text-sm text-muted-foreground">
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
      </div>
    </PageLayout>
  );
}
