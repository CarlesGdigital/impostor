import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { PlayerList } from '@/components/game/PlayerList';
import { useGameSession } from '@/hooks/useGameSession';
import { toast } from 'sonner';
import { Copy, Share2, Users, Lock, AlertTriangle } from 'lucide-react';

export default function LobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, players, loading, error, startDealing, updateSessionStatus } = useGameSession({ sessionId });

  const handleCopyCode = () => {
    if (session?.joinCode) {
      navigator.clipboard.writeText(session.joinCode);
      toast.success('Código copiado');
    }
  };

  const handleShareLink = async () => {
    if (!session?.joinCode) return;
    
    const url = `${window.location.origin}/join/${session.joinCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Únete a mi partida de TOPO',
          text: `¡Únete a mi partida! Código: ${session.joinCode}`,
          url,
        });
      } catch (err) {
        navigator.clipboard.writeText(url);
        toast.success('Enlace copiado');
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Enlace copiado');
    }
  };

  const handleCloseLobby = async () => {
    await updateSessionStatus('closed');
    toast.info('Sala cerrada - no se pueden unir más jugadores');
  };

  const handleStart = async () => {
    if (players.length < 3) {
      toast.error('Mínimo 3 jugadores');
      return;
    }
    
    // Validate topo count
    const maxAllowedTopos = Math.floor(players.length / 2);
    if (session && session.topoCount > maxAllowedTopos) {
      toast.error(`Máximo ${maxAllowedTopos} topos para ${players.length} jugadores`);
      return;
    }

    const success = await startDealing();
    
    if (!success) {
      toast.error(error || 'Error al iniciar el reparto');
      return;
    }
    
    navigate(`/game/${sessionId}`);
  };

  if (loading) {
    return (
      <PageLayout title="Sala">
        <p className="text-center py-8">Cargando...</p>
      </PageLayout>
    );
  }

  if (!session) {
    return (
      <PageLayout title="Error">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-xl">Sala no encontrada</p>
          <Button onClick={() => navigate('/')} variant="outline">
            Volver al inicio
          </Button>
        </div>
      </PageLayout>
    );
  }

  const isClosed = session.status === 'closed';
  const maxPlayers = session.maxPlayers || 20;
  const maxAllowedTopos = Math.floor(players.length / 2);
  const topoWarning = session.topoCount > maxAllowedTopos && players.length >= 3;

  return (
    <PageLayout 
      title="Sala de espera"
      footer={
        <div className="space-y-3">
          {!isClosed && players.length >= 3 && (
            <Button onClick={handleCloseLobby} variant="outline" className="w-full h-12 text-lg font-bold border-2">
              <Lock className="w-5 h-5 mr-2" />
              Cerrar sala
            </Button>
          )}
          <Button 
            onClick={handleStart} 
            disabled={players.length < 3 || topoWarning} 
            className="w-full h-16 text-xl font-bold"
          >
            Iniciar reparto ({players.length}/3 mín.)
          </Button>
        </div>
      }
    >
      <div className="max-w-md mx-auto space-y-6">
        {/* Join code */}
        {session.joinCode && !isClosed && (
          <div className="space-y-3">
            <button 
              onClick={handleCopyCode} 
              className="w-full p-6 border-2 border-foreground bg-card text-center active:bg-secondary transition-colors"
            >
              <p className="text-sm text-muted-foreground mb-2">Código de sala</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl font-mono font-bold tracking-[0.3em]">{session.joinCode}</span>
                <Copy className="w-6 h-6" />
              </div>
            </button>
            
            <Button 
              onClick={handleShareLink} 
              variant="outline" 
              className="w-full h-12 text-lg font-bold border-2"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Compartir enlace
            </Button>
          </div>
        )}

        {isClosed && (
          <div className="p-4 border-2 border-foreground bg-secondary text-center">
            <Lock className="w-6 h-6 mx-auto mb-2" />
            <p className="font-bold">Sala cerrada</p>
            <p className="text-sm text-muted-foreground">No se pueden unir más jugadores</p>
          </div>
        )}

        {/* Game config info */}
        <div className="p-4 border-2 border-border bg-card space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Topos:</span>
            <span className="font-bold">{session.topoCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Categorías:</span>
            <span className="font-bold">{session.selectedPackIds?.length || 'Todas'}</span>
          </div>
          {topoWarning && (
            <div className="flex items-center gap-2 text-sm text-amber-600 pt-2 border-t border-border">
              <AlertTriangle className="w-4 h-4" />
              Demasiados topos para {players.length} jugadores (máx. {maxAllowedTopos})
            </div>
          )}
        </div>

        {/* Players */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Jugadores ({players.length}/{maxPlayers})
            </p>
            {players.length < 3 && (
              <span className="text-sm text-muted-foreground">
                Faltan {3 - players.length} más
              </span>
            )}
          </div>
          
          {players.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-foreground/30 text-center">
              <p className="text-muted-foreground">
                Esperando jugadores...
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Comparte el código para que se unan
              </p>
            </div>
          ) : (
            <PlayerList players={players} />
          )}
        </div>

        {/* Instructions */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>Los jugadores entran desde "Unirse con código"</p>
          <p>en la pantalla principal de sus móviles</p>
        </div>
      </div>
    </PageLayout>
  );
}
