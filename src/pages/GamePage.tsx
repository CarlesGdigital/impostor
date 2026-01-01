import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { CardReveal } from "@/components/game/CardReveal";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { PlayAgainButton } from "@/components/game/PlayAgainButton";
import { useGameSession } from "@/hooks/useGameSession";

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const {
    session,
    players,
    markPlayerRevealed,
    finishDealing,
    startDealing,
    loading,
    error,
    waitingForAssignment,
    dealingRequested,
    isReadyForDealing,
  } = useGameSession({ sessionId } as any);

  const [currentIndex, setCurrentIndex] = useState(0);
  // Nueva fase "start" entre el reparto y el resumen
  const [phase, setPhase] = useState<"pass" | "reveal" | "start" | "done">("pass");
  // Estado para saber si la carta ha sido revelada (usuario puede pasar al siguiente)
  const [hasRevealedCard, setHasRevealedCard] = useState(false);

  const currentPlayer = players[currentIndex];
  const isLastPlayer = currentIndex >= players.length - 1;

  const isTopo = useMemo(() => currentPlayer?.role === "topo", [currentPlayer]);

  // Multi-mode redirect: this page is only for single-player pass-the-phone
  useEffect(() => {
    if (session?.mode === 'multi') {
      navigate('/');
    }
  }, [session?.mode, navigate]);

  // Primer jugador del turno (ordenado por turn_order)
  const firstPlayer = useMemo(() => {
    if (players.length === 0) return null;
    // Los jugadores ya vienen ordenados por turn_order del hook
    return players[0];
  }, [players]);

  // ✅ "Carta lista" = palabra Y pista (precargadas) Y jugador tiene rol asignado
  const canReveal = useMemo(() => {
    if (!session || !currentPlayer) return false;
    return Boolean(session.wordText && session.clueText && currentPlayer.role);
  }, [session, currentPlayer]);

  // Se llama cuando el usuario revela la carta (mantiene pulsado)
  // NO avanza automáticamente - solo marca como revelada
  const handleRevealComplete = async () => {
    console.info('[GamePage] Card revealed');
    setHasRevealedCard(true);
    if (currentPlayer) {
      await markPlayerRevealed(currentPlayer.id);
    }
    // NO llamamos a handleNext aquí - el usuario debe pulsar el botón
  };

  // Se llama cuando el usuario pulsa "Siguiente jugador"
  const handleNext = async () => {
    // Reset hasRevealedCard para el siguiente jugador
    setHasRevealedCard(false);

    if (isLastPlayer) {
      await finishDealing();
      setPhase("start");
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setPhase("pass");
  };

  // Estado de carga base
  if (!session || !currentPlayer) {
    return (
      <PageLayout title="Juego">
        <p className="text-center py-8">Cargando...</p>
      </PageLayout>
    );
  }

  // Pantalla final / resumen (solo se muestra tras pulsar "Revelar resultado")
  if (phase === "done") {
    const topos = players.filter((p) => p.role === "topo");
    return (
      <PageLayout title="Resumen" showBack={false}>
        <div className="max-w-md mx-auto space-y-8 text-center">
          <div className="text-6xl">🎭</div>
          <div className="space-y-2">
            <p className="text-muted-foreground">Topo(s):</p>
            <p className="text-3xl font-bold">{topos.map((t) => t.displayName).join(", ")}</p>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground">Palabra:</p>
            <p className="text-4xl font-bold">{session.wordText || "—"}</p>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground">Pista del topo:</p>
            <p className="text-2xl">{session.clueText || "—"}</p>
          </div>
          <div className="space-y-3 pt-4">
            <PlayAgainButton
              sessionId={sessionId || ''}
              players={players}
              mode="single"
            />
            <Button onClick={() => navigate("/")} variant="outline" className="w-full h-14 text-lg font-bold border-2">
              Volver al inicio
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Pantalla "Empieza la partida" (después del reparto, antes de revelar)
  if (phase === "start") {
    const starterName = firstPlayer?.displayName || "Jugador 1";

    return (
      <PageLayout title="Empieza la partida" showBack={false}>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-8 text-center">
          <div className="text-6xl">🎮</div>

          {firstPlayer && (
            <PlayerAvatar
              avatarKey={firstPlayer.avatarKey}
              displayName={firstPlayer.displayName}
              size="xl"
            />
          )}

          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Empieza jugando:</h2>
            <p className="text-5xl font-bold">{starterName}</p>
            <p className="text-muted-foreground">
              Pasa el móvil a {starterName} y empieza la ronda.
            </p>
          </div>

          <Button
            onClick={() => setPhase("done")}
            variant="destructive"
            className="w-full h-16 text-xl font-bold mt-8"
          >
            Revelar resultado (terminar partida)
          </Button>
        </div>
      </PageLayout>
    );
  }

  // Pantalla de "pasar el móvil"
  if (phase === "pass") {
    // Can we start dealing?
    const canStartDealing = isReadyForDealing && !loading && !waitingForAssignment && !dealingRequested;

    // Is dealing in progress?
    const isDealingInProgress = loading || dealingRequested || waitingForAssignment;

    // Mode single doesn't need "host" terminology
    const isSingleMode = session?.mode === "single";

    const handleButtonClick = async () => {
      if (canReveal) {
        console.info("[UI] Estoy listo clicked", { sessionId, canReveal, currentPlayer: currentPlayer?.id });
        setPhase("reveal");
      } else if (canStartDealing) {
        console.info("[UI] Iniciar reparto clicked", { sessionId, players: players.length, status: session?.status });
        await startDealing();
      }
    };

    const handleRetry = async () => {
      console.info("[UI] Reintentar asignación clicked", { sessionId });
      await startDealing();
    };

    // Determine button text and state
    let buttonText = "Esperando...";
    let buttonDisabled = true;

    if (canReveal) {
      buttonText = "Estoy listo";
      buttonDisabled = false;
    } else if (isDealingInProgress) {
      buttonText = "Un momento...";
      buttonDisabled = true;
    } else if (canStartDealing) {
      buttonText = "Iniciar reparto";
      buttonDisabled = false;
    } else if (players.length < 3) {
      buttonText = `Faltan ${3 - players.length} jugador(es)`;
      buttonDisabled = true;
    }

    // Debug log
    console.debug("[GamePage] pass phase:", {
      canReveal,
      canStartDealing,
      isDealingInProgress,
      role: currentPlayer?.role,
      status: session?.status,
      hasWord: !!session?.wordText,
    });

    return (
      <PageLayout title={`Jugador ${currentIndex + 1}/${players.length}`} showBack={false}>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-8">
          <PlayerAvatar avatarKey={currentPlayer.avatarKey} displayName={currentPlayer.displayName} size="xl" />
          <h2 className="text-3xl font-bold text-center">Pase el móvil a</h2>
          <p className="text-5xl font-bold">{currentPlayer.displayName}</p>

          {!canReveal && (
            <div className="space-y-4 text-center">
              {error ? (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                  <p className="font-bold">Error:</p>
                  <p>{error}</p>
                  <Button onClick={handleRetry} variant="destructive" className="mt-4">
                    Reintentar asignación
                  </Button>
                </div>
              ) : isDealingInProgress ? (
                <>
                  <p className="text-sm text-muted-foreground">Asignando carta...</p>
                  {waitingForAssignment && (
                    <p className="text-xs text-muted-foreground/70">Esperando respuesta del servidor...</p>
                  )}
                </>
              ) : canStartDealing ? (
                <p className="text-sm text-muted-foreground">
                  {isSingleMode ? "Pulse 'Iniciar reparto' para comenzar." : "Listo para iniciar el reparto."}
                </p>
              ) : players.length < 3 ? (
                <p className="text-sm text-muted-foreground">
                  Faltan {3 - players.length} jugador(es) para empezar.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Preparando la partida...</p>
              )}
            </div>
          )}

          <Button
            onClick={handleButtonClick}
            className="w-full h-16 text-xl font-bold"
            disabled={buttonDisabled}
          >
            {buttonText}
          </Button>
        </div>
      </PageLayout>
    );
  }

  // Fase "reveal"
  console.debug("[GamePage] reveal phase:", currentPlayer.role, isTopo);

  // Read variant data from localStorage
  const variant = sessionId ? localStorage.getItem(`impostor:variant:${sessionId}`) || 'classic' : 'classic';
  const confusedTopoId = sessionId ? localStorage.getItem(`impostor:confusedTopoId:${sessionId}`) : null;
  const targetPlayerId = sessionId ? localStorage.getItem(`impostor:targetPlayerId:${sessionId}`) : null;

  // Calculate display values based on variant
  let displayAsTopo = isTopo;
  let displayWord = session.wordText ?? "";
  let displayClue = session.clueText ?? "";
  let extraNote: string | null = null;

  if (variant === 'double_topo') {
    // Confused topo sees crew card (not topo)
    if (currentPlayer.id === confusedTopoId) {
      displayAsTopo = false;
      console.info('[GamePage] Showing confused topo as crew');
    }
  } else if (variant === 'guess_player') {
    if (isTopo) {
      // Topo doesn't see the word
      displayWord = "";
      displayClue = "No tienes palabra. Debes adivinar de quién hablan.";
      displayAsTopo = true;
    } else {
      // Non-topo sees the target name
      if (currentPlayer.id === targetPlayerId) {
        extraNote = "¡Eres el objetivo! No lo hagas obvio.";
      }
    }
  }

  return (
    <PageLayout title={currentPlayer.displayName} showBack={false}>
      <div className="max-w-md mx-auto space-y-6">
        <CardReveal
          word={displayWord}
          clue={displayClue}
          isTopo={displayAsTopo}
          isRevealed={false}
          onRevealComplete={handleRevealComplete}
          revealDuration={1000}
          extraNote={extraNote}
        />

        <Button
          onClick={handleNext}
          variant="outline"
          className="w-full h-14 text-lg font-bold border-2"
          disabled={!hasRevealedCard}
        >
          {hasRevealedCard
            ? (isLastPlayer ? "Terminar reparto" : "Siguiente jugador")
            : "Mantén pulsado para revelar"
          }
        </Button>
      </div>
    </PageLayout>
  );
}
