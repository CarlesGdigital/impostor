import { useParams } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { CardReveal } from '@/components/game/CardReveal';
import { useGameSession } from '@/hooks/useGameSession';

export default function PlayPage() {
  const { sessionId, playerId } = useParams<{ sessionId: string; playerId: string }>();
  const { session, players, markPlayerRevealed } = useGameSession({ sessionId });
  const player = players.find(p => p.id === playerId);

  if (!session || !player) {
    return <PageLayout title="Juego"><p className="text-center py-8">Cargando...</p></PageLayout>;
  }

  const word = player.role === 'topo' ? (session.clueText || 'Sin pista') : (session.wordText || 'Sin palabra');

  return (
    <PageLayout title="Tu carta" showBack={false}>
      <div className="max-w-md mx-auto">
        <CardReveal word={word} isRevealed={player.hasRevealed} onRevealComplete={() => markPlayerRevealed(player.id)} revealDuration={1000} />
      </div>
    </PageLayout>
  );
}
