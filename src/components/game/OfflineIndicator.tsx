import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineCards } from '@/hooks/useOfflineCards';
import { toast } from 'sonner';

export function OfflineIndicator() {
  const { isOnline } = useOnlineStatus();
  const { syncCards, isLoading, lastSync, cardCount, hasOfflineData } = useOfflineCards();

  const handleSync = async () => {
    const success = await syncCards();
    if (success) {
      toast.success('Palabras sincronizadas para jugar offline');
    } else {
      toast.error('Error al sincronizar palabras');
    }
  };

  // Show sync button when online
  if (isOnline) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={isLoading}
          className="h-7 px-2 text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Sincronizando...' : 'Sincronizar offline'}
        </Button>
        {cardCount > 0 && (
          <span className="text-muted-foreground">
            ({cardCount} palabras guardadas)
          </span>
        )}
      </div>
    );
  }

  // Show offline indicator when offline
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs">
      <WifiOff className="h-3 w-3" />
      <span>Sin conexión</span>
      {hasOfflineData() ? (
        <span className="text-muted-foreground">({cardCount} palabras disponibles)</span>
      ) : (
        <span className="text-destructive font-medium">Sin datos offline</span>
      )}
    </div>
  );
}
