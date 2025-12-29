import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { CardReveal } from '@/components/game/CardReveal';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { useGameSession } from '@/hooks/useGameSession';
import { useAuth } from '@/hooks/useAuth';
import { useGuestId } from '@/hooks/useGuestId';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';

export default function PlayPage() {
  const { sessionId, playerId } = useParams<{ sessionId: string; playerId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const guestId = useGuestId();

  const {
    session,
    players,
    markPlayerRevealed,
    continueToDiscussion,
    finishGame,
    phase,
    firstSpeakerPlayerId
  } = useGameSession({ sessionId });

  const player = players.find(p => p.id === playerId);

  // Local state to track reveal progress
  const [hasSeenCard, setHasSeenCard] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  // Robust host detection
  const isHost = (() => {
    if (!session || !player) return false;

    // Check via the player entry (most reliable)
    if (player.userId && session.hostUserId && player.userId === session.hostUserId) {
      return true;
    }
    if (player.guestId && session.hostGuestId && player.guestId === session.hostGuestId) {
      return true;
    }

    // Fallback check using current auth state
    if (user?.id && session.hostUserId === user.id) {
      return true;
    }
    if (!user && !authLoading && guestId && session.hostGuestId === guestId) {
      return true;
    }

    return false;
  })();

  // Debug log for host detection
  console.debug('[PlayPage] State:', {
    isHost,
    playerId: player?.id,
    playerHasRevealed: player?.hasRevealed,
    hasSeenCard,
    phase,
    allPlayersCount: players.length,
    revealedCount: players.filter(p => p.hasRevealed).length,
  });

  // Check if all players have revealed
  const allRevealed = players.length > 0 && players.every(p => p.hasRevealed);

  // Find first speaker player - prefer local broadcasted ID over session ID which might be missing in DB
  const actualFirstSpeakerId = firstSpeakerPlayerId || session?.firstSpeakerPlayerId;
  const firstSpeaker = actualFirstSpeakerId
    ? players.find(p => p.id === actualFirstSpeakerId)
    : players[0];

  // Loading state
  if (!session || !player) {
    return (
      <PageLayout title="Juego">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-2">Cargando...</span>
        </div>
      </PageLayout>
    );
  }

  const isTopo = player.role === 'topo';
  const topos = players.filter(p => p.role === 'topo');

  // Handler when user holds to reveal card
  const handleCardRevealed = () => {
    console.info('[multiplayer] Card visually revealed', {
      sessionId,
      playerId: player.id,
      role: player.role,
    });
    setHasSeenCard(true);
  };

  // Handler when user clicks "He visto mi carta"
  const handleConfirmSeen = async () => {
    console.info('[multiplayer] Confirming card seen', {
      sessionId,
      playerId: player.id,
    });

    setIsConfirming(true);
    try {
      await markPlayerRevealed(player.id);
      console.info('[multiplayer] Marked as revealed OK', { playerId: player.id });
    } catch (err) {
      console.error('[multiplayer] Error marking revealed', err);
    } finally {
      setIsConfirming(false);
    }
  };

  // === FINISHED STATE ===
  if (phase === 'finished') {
    return (
      <PageLayout title="Resumen" showBack={false}>
        <div className="max-w-md mx-auto space-y-8 text-center">
          <div className="text-6xl">🎭</div>
          <div className="space-y-2">
            <p className="text-muted-foreground">Topo(s):</p>
            <p className="text-3xl font-bold">{topos.map(t => t.displayName).join(', ')}</p>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground">Palabra:</p>
            <p className="text-4xl font-bold">{session.wordText || '—'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground">Pista del topo:</p>
            <p className="text-2xl">{session.clueText || '—'}</p>
          </div>
          <div className="space-y-3 pt-4">
            <Button
              onClick={() => navigate('/')}
              className="w-full h-14 text-lg font-bold"
            >
              Nueva partida
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // === DISCUSSION STATE ===
  if (phase === 'discussion') {
    return (
      <PageLayout title="Ronda de discusión" showBack={false}>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-8 text-center">
          <div className="text-6xl">🎮</div>

          {firstSpeaker && (
            <PlayerAvatar
              avatarKey={firstSpeaker.avatarKey}
              displayName={firstSpeaker.displayName}
              size="xl"
            />
          )}

          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Empieza hablando:</h2>
            <p className="text-5xl font-bold">{firstSpeaker?.displayName || 'Jugador 1'}</p>
            <p className="text-muted-foreground">
              Cada jugador describe la palabra con una sola pista.
            </p>
          </div>

          {isHost ? (
            <Button
              onClick={finishGame}
              variant="destructive"
              className="w-full h-16 text-xl font-bold mt-8"
            >
              Finalizar partida
            </Button>
          ) : (
            <p className="text-muted-foreground mt-8">
              Esperando a que el anfitrión finalice la partida...
            </p>
          )}
        </div>
      </PageLayout>
    );
  }

  // === ALL REVEALED - WAITING FOR HOST ===
  // Show this if current player has revealed AND all have revealed
  if ((player.hasRevealed || hasSeenCard) && allRevealed && phase === 'dealing') {
    return (
      <PageLayout title="Todos listos" showBack={false}>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-8 text-center">
          <div className="text-6xl">✅</div>

          <h2 className="text-3xl font-bold">
            Todos han visto su carta
          </h2>

          {isHost ? (
            <>
              <p className="text-muted-foreground">
                Pulsa para iniciar la ronda de discusión
              </p>
              {continueError && (
                <p className="text-destructive text-sm">{continueError}</p>
              )}
              <Button
                onClick={async () => {
                  setIsContinuing(true);
                  setContinueError(null);
                  const success = await continueToDiscussion();
                  setIsContinuing(false);
                  if (!success) {
                    setContinueError('Error al continuar. Inténtalo de nuevo.');
                    toast.error('No se pudo avanzar a la fase de discusión');
                  }
                }}
                disabled={isContinuing}
                className="w-full h-16 text-xl font-bold"
              >
                {isContinuing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Continuando...
                  </>
                ) : (
                  'Continuar'
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Esperando a que el anfitrión continúe...
              </p>
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </>
          )}
        </div>
      </PageLayout>
    );
  }

  // === PLAYER HAS CONFIRMED - WAITING FOR OTHERS ===
  if (player.hasRevealed && !allRevealed) {
    return (
      <PageLayout title="Esperando" showBack={false}>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-8 text-center">
          <CheckCircle className="w-20 h-20 text-primary" />

          <h2 className="text-3xl font-bold">
            ¡Listo!
          </h2>

          <p className="text-muted-foreground">
            Esperando a que los demás revelen su carta...
          </p>

          <div className="text-lg font-bold">
            {players.filter(p => p.hasRevealed).length} / {players.length} listos
          </div>

          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  // === CARD REVEAL STATE (default) ===
  return (
    <PageLayout title="Tu carta" showBack={false}>
      <div className="max-w-md mx-auto space-y-6">
        <CardReveal
          word={session.wordText || ''}
          clue={session.clueText || ''}
          isTopo={isTopo}
          isRevealed={hasSeenCard}
          onRevealComplete={handleCardRevealed}
          revealDuration={1000}
        />

        {/* Show confirm button after card is revealed */}
        {hasSeenCard && !player.hasRevealed && (
          <Button
            onClick={handleConfirmSeen}
            disabled={isConfirming}
            className="w-full h-16 text-xl font-bold"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Confirmando...
              </>
            ) : (
              'He visto mi carta'
            )}
          </Button>
        )}
      </div>
    </PageLayout>
  );
}
