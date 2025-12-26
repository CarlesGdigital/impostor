import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { CardReveal } from "@/components/game/CardReveal";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { useGameSession } from "@/hooks/useGameSession";

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  // ✅ IMPORTANTE: si su hook ya expone startDealing, esto arregla el "Sin palabra"
  // Si todavía NO lo expone, deje startDealing comentado y al final le digo qué hacer.
  const {
    session,
    players,
    markPlayerRevealed,
    finishDealing,
    startDealing,
    loading,
    error,
  } = useGameSession({ sessionId } as any);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"pass" | "reveal" | "done">("pass");

  const currentPlayer = players[currentIndex];
  const isLastPlayer = currentIndex >= players.length - 1;

  const isTopo = useMemo(() => currentPlayer?.role === "topo", [currentPlayer]);

  // ✅ “Carta lista” = hay palabra para civiles y hay pista para topo
  const canReveal = useMemo(() => {
    if (!session || !currentPlayer) return false;
    return isTopo ? Boolean(session.clueText) : Boolean(session.wordText);
  }, [session, currentPlayer, isTopo]);

  // ✅ Auto-reparto: asegura que session.wordText / clueText existan antes de revelar
  useEffect(() => {
    if (!session || !players.length) return;

    // Si su modelo usa otros status, ajuste aquí (por ejemplo: 'setup' / 'dealing')
    if (session.status === "setup" && typeof startDealing === "function") {
      startDealing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status, players.length]);

  const handleRevealComplete = async () => {
    if (currentPlayer) await markPlayerRevealed(currentPlayer.id);

    if (isLastPlayer) {
      await finishDealing();
      setPhase("done");
    } else {
      // ✅ Tras revelar, volvemos a “pass” para pasar el móvil
      setPhase("pass");
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleNext = async () => {
    // Botón manual “Siguiente jugador” por si no quiere esperar al revealDuration
    if (isLastPlayer) {
      await finishDealing();
      setPhase("done");
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

  // Pantalla final / resumen
  if (phase === "done" || session.status === "finished") {
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
            <Button onClick={() => navigate("/")} className="w-full h-14 text-lg font-bold">
              Nueva partida
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Pantalla de “pasar el móvil”
  if (phase === "pass") {
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
                  <Button
                    onClick={() => startDealing && startDealing()}
                    variant="destructive"
                    className="mt-4"
                  >
                    Reintentar asignación
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {loading ? "Asignando carta..." : "Preparando carta… (esperando servidor)"}
                </p>
              )}
            </div>
          )}

          <Button
            onClick={() => setPhase("reveal")}
            className="w-full h-16 text-xl font-bold"
            disabled={!canReveal || loading}
          >
            {loading ? "Un momento..." : "Estoy listo"}
          </Button>
        </div>
      </PageLayout>
    );
  }

  // Fase “reveal”
  console.debug("[GamePage] Rol del jugador:", currentPlayer.role, "| Es topo:", isTopo);
  console.debug("[GamePage] session.wordText:", session.wordText, "| session.clueText:", session.clueText);

  return (
    <PageLayout title={currentPlayer.displayName} showBack={false}>
      <div className="max-w-md mx-auto space-y-6">
        <CardReveal
          word={session.wordText ?? ""}
          clue={session.clueText ?? ""}
          isTopo={isTopo}
          isRevealed={false}
          onRevealComplete={handleRevealComplete}
          revealDuration={1000}
        />

        <Button
          onClick={handleNext}
          variant="outline"
          className="w-full h-14 text-lg font-bold border-2"
          disabled={!canReveal}
        >
          {isLastPlayer ? "Terminar reparto" : "Siguiente jugador"}
        </Button>
      </div>
    </PageLayout>
  );
}
