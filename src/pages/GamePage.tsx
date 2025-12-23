import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { CardReveal } from '@/components/game/CardReveal';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { useGameSession } from '@/hooks/useGameSession';

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, players, markPlayerRevealed, finishDealing } = useGameSession({ sessionId });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'pass' | 'reveal' | 'done'>('pass');

  const currentPlayer = players[currentIndex];
  const isLastPlayer = currentIndex >= players.length - 1;

  const handleRevealComplete = async () => {
    if (currentPlayer) await markPlayerRevealed(currentPlayer.id);
    if (isLastPlayer) {
      await finishDealing();
      setPhase('done');
    }
  };

  const handleNext = () => {
    if (isLastPlayer) {
      setPhase('done');
    } else {
      setCurrentIndex(currentIndex + 1);
      setPhase('pass');
    }
  };

  if (!session || !currentPlayer) {
    return <PageLayout title="Juego"><p className="text-center py-8">Cargando...</p></PageLayout>;
  }

  if (phase === 'done' || session.status === 'finished') {
    const topos = players.filter(p => p.role === 'topo');
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
            <p className="text-4xl font-bold">{session.wordText}</p>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground">Pista del topo:</p>
            <p className="text-2xl">{session.clueText}</p>
          </div>
          <div className="space-y-3 pt-4">
            <Button onClick={() => navigate('/')} className="w-full h-14 text-lg font-bold">Nueva partida</Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (phase === 'pass') {
    return (
      <PageLayout title={`Jugador ${currentIndex + 1}/${players.length}`} showBack={false}>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-8">
          <PlayerAvatar avatarKey={currentPlayer.avatarKey} displayName={currentPlayer.displayName} size="xl" />
          <h2 className="text-3xl font-bold text-center">Pasa el móvil a</h2>
          <p className="text-5xl font-bold">{currentPlayer.displayName}</p>
          <Button onClick={() => setPhase('reveal')} className="w-full h-16 text-xl font-bold">Estoy listo</Button>
        </div>
      </PageLayout>
    );
  }

  const isTopo = currentPlayer.role === 'topo';
  
  console.debug('[GamePage] Rol del jugador:', currentPlayer.role, '| Es topo:', isTopo);
  console.debug('[GamePage] session.wordText:', session.wordText, '| session.clueText:', session.clueText);

  return (
    <PageLayout title={currentPlayer.displayName} showBack={false}>
      <div className="max-w-md mx-auto space-y-6">
        <CardReveal 
          word={session.wordText || ''} 
          clue={session.clueText || ''} 
          isTopo={isTopo} 
          isRevealed={false} 
          onRevealComplete={handleRevealComplete} 
          revealDuration={1000} 
        />
        <Button onClick={handleNext} variant="outline" className="w-full h-14 text-lg font-bold border-2">
          {isLastPlayer ? 'Terminar reparto' : 'Siguiente jugador'}
        </Button>
      </div>
    </PageLayout>
  );
}
