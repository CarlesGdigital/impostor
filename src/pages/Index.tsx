import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { Users, Smartphone, UserCircle, LogIn, Settings } from 'lucide-react';
import type { GameMode } from '@/types/game';

const Index = () => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('single');
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  return (
    <PageLayout showBack={false} className="flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-md mx-auto w-full">
        {/* Logo */}
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-bold tracking-tighter">TOPO</h1>
          <p className="text-xl text-muted-foreground">El juego del impostor</p>
        </div>

        {/* Mode selector */}
        <div className="w-full space-y-3">
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide text-center">
            Modo de juego
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedMode('single')}
              className={cn(
                'flex flex-col items-center gap-3 p-6 border-2 border-foreground transition-all',
                selectedMode === 'single' 
                  ? 'bg-foreground text-background shadow-md' 
                  : 'bg-card hover:bg-secondary'
              )}
            >
              <Smartphone className="w-10 h-10" />
              <span className="font-bold text-lg">Un móvil</span>
              <span className={cn(
                'text-xs',
                selectedMode === 'single' ? 'text-background/70' : 'text-muted-foreground'
              )}>
                Pasar y jugar
              </span>
            </button>
            <button
              onClick={() => setSelectedMode('multi')}
              className={cn(
                'flex flex-col items-center gap-3 p-6 border-2 border-foreground transition-all',
                selectedMode === 'multi' 
                  ? 'bg-foreground text-background shadow-md' 
                  : 'bg-card hover:bg-secondary'
              )}
            >
              <Users className="w-10 h-10" />
              <span className="font-bold text-lg">Multimóvil</span>
              <span className={cn(
                'text-xs',
                selectedMode === 'multi' ? 'text-background/70' : 'text-muted-foreground'
              )}>
                Cada uno con su móvil
              </span>
            </button>
          </div>
        </div>

        {/* Main actions */}
        <div className="w-full space-y-4">
          <Button
            onClick={() => navigate(`/new-game?mode=${selectedMode}`)}
            className="w-full h-16 text-xl font-bold"
            size="lg"
          >
            Nueva partida
          </Button>

          {selectedMode === 'multi' && (
            <Button
              onClick={() => navigate('/join')}
              variant="outline"
              className="w-full h-16 text-xl font-bold border-2"
              size="lg"
            >
              Unirse con código
            </Button>
          )}
        </div>

        {/* Profile/Auth */}
        <div className="w-full pt-4 border-t-2 border-border space-y-1">
          {user ? (
            <>
              <Button
                onClick={() => navigate('/profile')}
                variant="ghost"
                className="w-full h-14 text-lg justify-start gap-3"
              >
                <UserCircle className="w-6 h-6" />
                Mi perfil
              </Button>
              {isAdmin && (
                <Button
                  onClick={() => navigate('/admin')}
                  variant="ghost"
                  className="w-full h-14 text-lg justify-start gap-3"
                >
                  <Settings className="w-6 h-6" />
                  Administración
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={() => navigate('/auth')}
              variant="ghost"
              className="w-full h-14 text-lg justify-start gap-3"
            >
              <LogIn className="w-6 h-6" />
              Iniciar sesión / Crear cuenta
            </Button>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center py-4 text-sm text-muted-foreground">
        <p>Versión 1.0 • Hecho para jugar en persona</p>
      </div>
    </PageLayout>
  );
};

export default Index;
