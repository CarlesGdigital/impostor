import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { PlayerList } from '@/components/game/PlayerList';
import { useGameSession } from '@/hooks/useGameSession';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

export default function LobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, players, loading, startDealing } = useGameSession({ sessionId });

  const handleCopyCode = () => {
    if (session?.joinCode) {
      navigator.clipboard.writeText(session.joinCode);
      toast.success('Código copiado');
    }
  };

  const handleStart = async () => {
    if (players.length < 3) {
      toast.error('Mínimo 3 jugadores');
      return;
    }
    await startDealing();
    navigate(`/game/${sessionId}`);
  };

  if (loading) {
    return <PageLayout title="Sala"><p className="text-center py-8">Cargando...</p></PageLayout>;
  }

  return (
    <PageLayout 
      title="Sala de espera"
      footer={
        <Button onClick={handleStart} disabled={players.length < 3} className="w-full h-16 text-xl font-bold">
          Iniciar reparto
        </Button>
      }
    >
      <div className="max-w-md mx-auto space-y-6">
        {session?.joinCode && (
          <button onClick={handleCopyCode} className="w-full p-6 border-2 border-foreground bg-card text-center">
            <p className="text-sm text-muted-foreground mb-2">Código de sala</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl font-mono font-bold tracking-[0.3em]">{session.joinCode}</span>
              <Copy className="w-6 h-6" />
            </div>
          </button>
        )}
        <PlayerList players={players} />
      </div>
    </PageLayout>
  );
}
