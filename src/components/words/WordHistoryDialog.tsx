import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface HistoryEntry {
  id: string;
  action: string;
  oldWord: string | null;
  newWord: string | null;
  oldClue: string | null;
  newClue: string | null;
  oldIsActive: boolean | null;
  newIsActive: boolean | null;
  createdAt: string;
  userName: string | null;
}

interface WordHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string | null;
  cardWord: string;
  onRestore: (historyId: string) => Promise<void>;
}

export function WordHistoryDialog({ 
  open, 
  onOpenChange, 
  cardId, 
  cardWord,
  onRestore 
}: WordHistoryDialogProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (open && cardId) {
      loadHistory();
    }
  }, [open, cardId]);

  const loadHistory = async () => {
    if (!cardId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('card_history')
      .select(`
        id,
        action,
        old_word,
        new_word,
        old_clue,
        new_clue,
        old_is_active,
        new_is_active,
        created_at,
        profiles!inner(display_name)
      `)
      .eq('card_id', cardId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading history:', error);
      setHistory([]);
    } else {
      setHistory((data || []).map(h => ({
        id: h.id,
        action: h.action,
        oldWord: h.old_word,
        newWord: h.new_word,
        oldClue: h.old_clue,
        newClue: h.new_clue,
        oldIsActive: h.old_is_active,
        newIsActive: h.new_is_active,
        createdAt: h.created_at,
        userName: (h.profiles as any)?.display_name || 'Usuario',
      })));
    }
    setLoading(false);
  };

  const handleRestore = async (historyId: string) => {
    setRestoring(historyId);
    await onRestore(historyId);
    setRestoring(null);
    loadHistory();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return 'Creada';
      case 'updated': return 'Editada';
      case 'deactivated': return 'Archivada';
      case 'reactivated': return 'Reactivada';
      case 'restored': return 'Restaurada';
      default: return action;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial: {cardWord}</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay historial para esta palabra.
          </p>
        ) : (
          <div className="space-y-4">
            {history.map((entry, idx) => (
              <div key={entry.id} className="border-2 border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">
                    {getActionLabel(entry.action)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Por: {entry.userName}
                </p>
                
                {entry.action === 'updated' && (
                  <div className="text-sm space-y-1">
                    {entry.oldWord !== entry.newWord && (
                      <p>
                        <span className="text-muted-foreground">Palabra:</span>{' '}
                        <span className="line-through">{entry.oldWord}</span>{' → '}
                        <span className="font-medium">{entry.newWord}</span>
                      </p>
                    )}
                    {entry.oldClue !== entry.newClue && (
                      <p>
                        <span className="text-muted-foreground">Pista:</span>{' '}
                        <span className="line-through">{entry.oldClue}</span>{' → '}
                        <span className="font-medium">{entry.newClue}</span>
                      </p>
                    )}
                  </div>
                )}
                
                {idx > 0 && entry.action === 'updated' && entry.oldWord && entry.oldClue && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(entry.id)}
                    disabled={restoring === entry.id}
                    className="gap-1"
                  >
                    {restoring === entry.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Restaurar versión anterior
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
