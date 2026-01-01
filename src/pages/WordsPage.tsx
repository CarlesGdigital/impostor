import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Loader2, Edit2, History, Flag, Search, Globe, MapPin, Flame } from 'lucide-react';
import { WordEditDialog } from '@/components/words/WordEditDialog';
import { WordHistoryDialog } from '@/components/words/WordHistoryDialog';
import { WordReportDialog } from '@/components/words/WordReportDialog';
import type { MasterCategory } from '@/types/admin';

interface Card {
  id: string;
  masterCategory: MasterCategory;
  word: string;
  clue: string;
  difficulty?: number | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  packId?: string;
  packName?: string;
  creatorName?: string;
}

// Map to get or create packs for each master category
const MASTER_CATEGORY_PACKS: Record<MasterCategory, { name: string; slug: string }> = {
  general: { name: 'General', slug: 'general' },
  benicolet: { name: 'Benicolet', slug: 'benicolet' },
  picantes: { name: 'Picantes', slug: 'picantes' },
};

export default function WordsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [canSubmit, setCanSubmit] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);

  const [cards, setCards] = useState<Card[]>([]);
  const [packMap, setPackMap] = useState<Map<string, { id: string; masterCategory: MasterCategory }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyCardId, setHistoryCardId] = useState<string | null>(null);
  const [historyCardWord, setHistoryCardWord] = useState('');
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportingCard, setReportingCard] = useState<Card | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkPermission();
    }
  }, [user]);

  useEffect(() => {
    if (canSubmit) {
      fetchData();
    }
  }, [canSubmit]);

  const checkPermission = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('can_submit_words')
      .eq('id', user.id)
      .maybeSingle();
    
    setCanSubmit(data?.can_submit_words ?? true);
    setCheckingPermission(false);
  };

  const getMasterCategoryFromPack = (packMasterCategory: string | null | undefined): MasterCategory => {
    if (packMasterCategory && ['general', 'benicolet', 'picantes'].includes(packMasterCategory)) {
      return packMasterCategory as MasterCategory;
    }
    return 'general';
  };

  const fetchData = async () => {
    setLoading(true);

    // Fetch packs to build map
    const { data: packsData } = await supabase
      .from('packs')
      .select('id, name, slug, master_category')
      .eq('is_active', true)
      .order('name');

    const newPackMap = new Map<string, { id: string; masterCategory: MasterCategory }>();
    (packsData || []).forEach(p => {
      newPackMap.set(p.id, {
        id: p.id,
        masterCategory: getMasterCategoryFromPack(p.master_category)
      });
    });
    setPackMap(newPackMap);

    // Fetch cards
    const { data: cardsData } = await supabase
      .from('cards')
      .select(`
        *,
        packs(name, master_category)
      `)
      .order('created_at', { ascending: false });

    // Fetch creator names separately
    const creatorIds = [...new Set((cardsData || []).map(c => c.created_by))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', creatorIds);
    
    const profilesMap = new Map((profilesData || []).map(p => [p.id, p.display_name]));

    setCards((cardsData || []).map(c => ({
      id: c.id,
      packId: c.pack_id,
      masterCategory: getMasterCategoryFromPack((c.packs as any)?.master_category),
      word: c.word,
      clue: c.clue,
      difficulty: c.difficulty,
      isActive: c.is_active,
      createdAt: c.created_at,
      createdBy: c.created_by,
      packName: (c.packs as any)?.name,
      creatorName: profilesMap.get(c.created_by) || null,
    })));

    setLoading(false);
  };

  // Get pack ID for master category - packs must already exist in DB
  const getPackForCategory = async (category: MasterCategory): Promise<string | null> => {
    const { data: pack, error } = await supabase
      .from('packs')
      .select('id')
      .eq('master_category', category)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching pack:', error);
      toast.error(`Error al buscar la categoría "${MASTER_CATEGORY_PACKS[category].name}"`);
      return null;
    }

    if (!pack) {
      toast.error(`No existe la categoría "${MASTER_CATEGORY_PACKS[category].name}" en el sistema. Contacta con un administrador.`);
      return null;
    }

    return pack.id;
  };

  const handleSaveWord = async (data: {
    id?: string;
    masterCategory: MasterCategory;
    word: string;
    clue: string;
    difficulty?: number | null;
    isActive: boolean;
  }): Promise<boolean> => {
    if (!data.word.trim()) {
      toast.error('La palabra es obligatoria');
      return false;
    }

    try {
      // Get pack for this master category
      const packId = await getPackForCategory(data.masterCategory);
      
      if (!packId) {
        // Error already shown by getPackForCategory
        return false;
      }

      if (data.id) {
        // Get current values for history
        const { data: currentCard } = await supabase
          .from('cards')
          .select('*')
          .eq('id', data.id)
          .single();

        // Update existing card
        const { error } = await supabase
          .from('cards')
          .update({
            pack_id: packId,
            word: data.word.trim(),
            clue: data.clue.trim() || null,
            difficulty: data.difficulty,
            is_active: data.isActive,
          })
          .eq('id', data.id);

        if (error) {
          toast.error('Error al actualizar la palabra');
          return false;
        }

        // Record history
        await supabase.from('card_history').insert({
          card_id: data.id,
          user_id: user!.id,
          action: 'updated',
          old_word: currentCard?.word,
          new_word: data.word,
          old_clue: currentCard?.clue,
          new_clue: data.clue,
          old_difficulty: currentCard?.difficulty,
          new_difficulty: data.difficulty,
          old_is_active: currentCard?.is_active,
          new_is_active: data.isActive,
        });

        toast.success('Palabra actualizada');
      } else {
        // Create new card
        const { data: newCard, error } = await supabase
          .from('cards')
          .insert({
            pack_id: packId,
            word: data.word.trim(),
            clue: data.clue.trim() || null,
            difficulty: data.difficulty,
            is_active: data.isActive,
            created_by: user!.id,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            toast.error('Esta palabra ya existe en la categoría');
          } else {
            toast.error('Error al crear la palabra');
          }
          return false;
        }

        // Record history for creation
        await supabase.from('card_history').insert({
          card_id: newCard.id,
          user_id: user!.id,
          action: 'created',
          new_word: data.word,
          new_clue: data.clue,
          new_difficulty: data.difficulty,
          new_is_active: data.isActive,
        });

        toast.success('Palabra creada');
      }

      fetchData();
      return true;
    } catch {
      toast.error('Error al guardar');
      return false;
    }
  };

  const toggleCardActive = async (card: Card) => {
    const newActive = !card.isActive;
    const { error } = await supabase
      .from('cards')
      .update({ is_active: newActive })
      .eq('id', card.id);

    if (!error) {
      // Record history
      await supabase.from('card_history').insert({
        card_id: card.id,
        user_id: user!.id,
        action: newActive ? 'reactivated' : 'deactivated',
        old_is_active: card.isActive,
        new_is_active: newActive,
      });
    }

    fetchData();
  };

  const handleRestore = async (historyId: string) => {
    const { data: historyEntry } = await supabase
      .from('card_history')
      .select('*')
      .eq('id', historyId)
      .single();

    if (!historyEntry || !historyEntry.old_word || !historyEntry.old_clue) {
      toast.error('No se puede restaurar esta versión');
      return;
    }

    const { error } = await supabase
      .from('cards')
      .update({
        word: historyEntry.old_word,
        clue: historyEntry.old_clue,
        difficulty: historyEntry.old_difficulty,
      })
      .eq('id', historyEntry.card_id);

    if (error) {
      toast.error('Error al restaurar');
      return;
    }

    // Record restore action
    await supabase.from('card_history').insert({
      card_id: historyEntry.card_id,
      user_id: user!.id,
      action: 'restored',
      new_word: historyEntry.old_word,
      new_clue: historyEntry.old_clue,
      new_difficulty: historyEntry.old_difficulty,
    });

    toast.success('Versión restaurada');
    fetchData();
  };

  const handleReport = async (reason: string): Promise<boolean> => {
    if (!reportingCard) return false;

    const { error } = await supabase.from('card_reports').insert({
      card_id: reportingCard.id,
      reporter_id: user!.id,
      reason,
    });

    if (error) {
      toast.error('Error al enviar el reporte');
      return false;
    }

    toast.success('Reporte enviado. Un moderador lo revisará.');
    return true;
  };

  const openEdit = (card: Card) => {
    setEditingCard(card);
    setShowEditDialog(true);
  };

  const openHistory = (card: Card) => {
    setHistoryCardId(card.id);
    setHistoryCardWord(card.word);
    setShowHistoryDialog(true);
  };

  const openReport = (card: Card) => {
    setReportingCard(card);
    setShowReportDialog(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const getCategoryBadge = (category: MasterCategory) => {
    switch (category) {
      case 'benicolet':
        return (
          <Badge variant="outline" className="gap-1">
            <MapPin className="w-3 h-3" />
            Benicolet
          </Badge>
        );
      case 'picantes':
        return (
          <Badge variant="destructive" className="gap-1">
            <Flame className="w-3 h-3" />
            Picantes
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Globe className="w-3 h-3" />
            General
          </Badge>
        );
    }
  };

  // Filter cards by search
  const filteredCards = cards.filter(card => 
    card.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.clue.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.masterCategory.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || checkingPermission) {
    return (
      <PageLayout title="Palabras">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (!canSubmit) {
    return (
      <PageLayout title="Palabras">
        <div className="text-center py-16 space-y-4">
          <p className="text-xl text-muted-foreground">
            Tu cuenta no tiene permisos para editar palabras.
          </p>
          <p className="text-sm text-muted-foreground">
            Si crees que esto es un error, contacta con un administrador.
          </p>
          <Button onClick={() => navigate('/')}>Volver al inicio</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Palabras">
      <div className="space-y-4">
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => { setEditingCard(null); setShowEditDialog(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Añadir palabra
          </Button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar palabras..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border-2 border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Palabra</TableHead>
                  <TableHead>Pista</TableHead>
                  <TableHead className="w-20">Activa</TableHead>
                  <TableHead className="w-24">Creada</TableHead>
                  <TableHead>Por</TableHead>
                  <TableHead className="w-32">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {searchQuery ? 'No se encontraron palabras.' : 'No hay palabras. Añade la primera.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell>{getCategoryBadge(card.masterCategory)}</TableCell>
                      <TableCell className="font-bold">{card.word}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {card.clue}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={card.isActive}
                          onCheckedChange={() => toggleCardActive(card)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(card.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {card.creatorName || 'Desconocido'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(card)}
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openHistory(card)}
                            title="Historial"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openReport(card)}
                            title="Reportar"
                          >
                            <Flag className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-sm text-muted-foreground text-center">
          Total: {filteredCards.length} palabras
        </p>
      </div>

      {/* Dialogs */}
      <WordEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        editingCard={editingCard}
        onSave={handleSaveWord}
      />
      
      <WordHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        cardId={historyCardId}
        cardWord={historyCardWord}
        onRestore={handleRestore}
      />
      
      <WordReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        cardWord={reportingCard?.word || ''}
        onSubmit={handleReport}
      />
    </PageLayout>
  );
}