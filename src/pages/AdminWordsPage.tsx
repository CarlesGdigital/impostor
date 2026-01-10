import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Upload, Loader2, CheckCircle, XCircle, Trash2, Check, X, AlertTriangle, FolderSync } from 'lucide-react';
import type { MasterCategory } from '@/types/admin';
import type { Pack, Card } from '@/types/admin';
import { cardService } from '@/services/cardService';

const AdminWordsPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [cards, setCards] = useState<Card[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null); // For Shift+Click
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkActioning, setBulkActioning] = useState(false);
  const [affectedSessionCount, setAffectedSessionCount] = useState<number | null>(null);
  const [checkingAffected, setCheckingAffected] = useState(false);

  // Category change state
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [targetCategory, setTargetCategory] = useState<MasterCategory | ''>('');

  // Form state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [formWord, setFormWord] = useState('');
  const [formClue, setFormClue] = useState('');
  const [formMasterCategory, setFormMasterCategory] = useState<MasterCategory>('general');
  const [formDifficulty, setFormDifficulty] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Import state
  const [csvContent, setCsvContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ inserted: number; updated: number; failed: number } | null>(null);

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        navigate('/');
      }
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch packs
    const { data: packsData } = await supabase
      .from('packs')
      .select('*')
      .order('name');

    setPacks((packsData || []).map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      isActive: p.is_active,
      masterCategory: (p as any).master_category || 'general',
      createdAt: p.created_at,
    })));

    // Fetch cards with pack info
    const { data: cardsData } = await supabase
      .from('cards')
      .select(`
        *,
        packs!inner(name),
        profiles!inner(display_name)
      `)
      .order('created_at', { ascending: false });

    setCards((cardsData || []).map(c => ({
      id: c.id,
      packId: c.pack_id,
      word: c.word,
      clue: c.clue,
      difficulty: c.difficulty,
      isActive: c.is_active,
      createdAt: c.created_at,
      createdBy: c.created_by,
      packName: (c.packs as any)?.name,
      creatorName: (c.profiles as any)?.display_name,
    })));

    setLoading(false);
  };

  // === SELECTION HELPERS ===
  const toggleOne = (id: string, event?: React.MouseEvent) => {
    setSelectedIds(prev => {
      const next = new Set(prev);

      // Handle Shift+Click Range Selection
      if (event?.shiftKey && lastSelectedId && lastSelectedId !== id) {
        const lastIdx = cards.findIndex(c => c.id === lastSelectedId);
        const currIdx = cards.findIndex(c => c.id === id);

        if (lastIdx !== -1 && currIdx !== -1) {
          const start = Math.min(lastIdx, currIdx);
          const end = Math.max(lastIdx, currIdx);

          const rangeIds = cards.slice(start, end + 1).map(c => c.id);
          // Determine if we are selecting or deselecting based on target
          const isSelecting = !prev.has(id);

          rangeIds.forEach(rid => {
            if (isSelecting) next.add(rid);
            else next.delete(rid);
          });

          setLastSelectedId(id);
          return next;
        }
      }

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setLastSelectedId(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === cards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cards.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected = cards.length > 0 && selectedIds.size === cards.length;
  const hasSelection = selectedIds.size > 0;

  // === BULK ACTIONS ===
  const processInBatches = async (
    ids: string[],
    action: (chunk: string[]) => PromiseLike<any>,
    successMessage: string,
    errorMessage: string
  ) => {
    setBulkActioning(true);
    const BATCH_SIZE = 50;
    let successCount = 0;
    let errorOccurred = false;

    try {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const { error } = await action(chunk);

        if (error) {
          console.error('[BulkAction] Error processing chunk:', error);
          toast.error(`${errorMessage} (lote ${i / BATCH_SIZE + 1}): ${error.message}`);
          errorOccurred = true;
          break;
        }
        successCount += chunk.length;
      }

      if (successCount > 0) {
        toast.success(`${successCount} ${successMessage}` + (errorOccurred ? ' (interrumpido por error)' : ''));
        await fetchData();
        clearSelection();
      }
    } catch (e: any) {
      console.error('[BulkAction] Unexpected error:', e);
      toast.error(`Error inesperado: ${e.message}`);
    } finally {
      setBulkActioning(false);
      setShowDeleteConfirm(false); // Close dialog if it was open
      setAffectedSessionCount(null);
    }
  };

  const handlePreDeleteCheck = async () => {
    if (!hasSelection) return;
    // No need to check affected sessions anymore since we are doing soft delete
    // Just show confirmation
    setShowDeleteConfirm(true);
  };

  const handleBulkEnable = async () => {
    if (!hasSelection) return;

    await processInBatches(
      [...selectedIds],
      (chunk) => supabase.from('cards').update({ is_active: true }).in('id', chunk),
      'palabras habilitadas',
      'Error al habilitar'
    );
  };

  const handleBulkDisable = async () => {
    if (!hasSelection) return;

    await processInBatches(
      [...selectedIds],
      (chunk) => supabase.from('cards').update({ is_active: false }).in('id', chunk),
      'palabras archivadas',
      'Error al archivar'
    );
  };

  const handleBulkDelete = async () => {
    if (!hasSelection) return;

    // Convert to unlinking delete (robust hard delete)
    setBulkActioning(true);
    try {
      const ids = [...selectedIds];

      // 1. Unlink historical sessions
      const { error: unlinkError } = await supabase
        .from('game_sessions')
        .update({ card_id: null })
        .in('card_id', ids);

      if (unlinkError) console.warn('Unlink error (might be fine):', unlinkError);

      await processInBatches(
        ids,
        (chunk) => supabase.from('cards').delete().in('id', chunk),
        'palabras eliminadas (historial desvinculado)',
        'Error al eliminar'
      );
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
      setBulkActioning(false);
    }
  };

  const handlePurgeInactive = async () => {
    if (!confirm('¿Estás seguro de ELIMINAR TODAS las palabras inactivas? Esto desvinculará el historial de partidas pasadas.')) return;

    setBulkActioning(true);
    try {
      // 1. Get all inactive IDs
      const { data: inactiveCards } = await supabase
        .from('cards')
        .select('id')
        .eq('is_active', false);

      const ids = inactiveCards?.map(c => c.id) || [];

      if (ids.length === 0) {
        toast.info('No hay palabras inactivas.');
        setBulkActioning(false);
        return;
      }

      // 2. Unlink History
      const BATCH_SIZE = 50;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        await supabase.from('game_sessions').update({ card_id: null }).in('card_id', chunk);
      }

      // 3. Delete
      await processInBatches(
        ids,
        (chunk) => supabase.from('cards').delete().in('id', chunk),
        'palabras inactivas eliminadas',
        'Error al purgar'
      );
    } catch (e: any) {
      toast.error('Error al purgar: ' + e.message);
      setBulkActioning(false);
    }
  };

  // Cleanup orphaned cards (cards without valid master category packs)
  const handleCleanupOrphans = async () => {
    setBulkActioning(true);
    try {
      // 1. Get ALL packs with their master_category
      const { data: allPacks } = await supabase
        .from('packs')
        .select('id, name, master_category');

      // Find valid pack IDs (only general, benicolet, picantes, terreta)
      const validPackIds = new Set(
        (allPacks || [])
          .filter(p => p.master_category && ['general', 'benicolet', 'picantes', 'terreta'].includes(p.master_category))
          .map(p => p.id)
      );

      // Find invalid packs for reporting
      const invalidPacks = (allPacks || [])
        .filter(p => !p.master_category || !['general', 'benicolet', 'picantes', 'terreta'].includes(p.master_category));

      // Show what we found
      toast.info(`📊 Packs: ${validPackIds.size} válidos, ${invalidPacks.length} inválidos`);

      // STEP 1: First clean up invalid packs (this will cascade to cards)
      if (invalidPacks.length > 0) {
        const packNames = invalidPacks.slice(0, 10).map(p => p.name).join(', ');
        const moreText = invalidPacks.length > 10 ? `... y ${invalidPacks.length - 10} más` : '';

        if (confirm(`🗑️ PASO 1: Hay ${invalidPacks.length} packs sin categoría master válida:\n\n${packNames}${moreText}\n\nLas palabras en estos packs quedarán huérfanas.\n\n¿Eliminar estos packs?`)) {
          // First unlink cards from these packs (set pack_id to null)
          const invalidPackIds = invalidPacks.map(p => p.id);

          // Get cards in invalid packs
          const { data: cardsInInvalidPacks } = await supabase
            .from('cards')
            .select('id')
            .in('pack_id', invalidPackIds);

          const cardIds = cardsInInvalidPacks?.map(c => c.id) || [];

          if (cardIds.length > 0) {
            // Unlink from game_sessions
            const BATCH_SIZE = 50;
            for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
              const chunk = cardIds.slice(i, i + BATCH_SIZE);
              await supabase.from('game_sessions').update({ card_id: null }).in('card_id', chunk);
            }

            // Delete the cards
            for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
              const chunk = cardIds.slice(i, i + BATCH_SIZE);
              await supabase.from('cards').delete().in('id', chunk);
            }
            toast.success(`${cardIds.length} palabras de packs inválidos eliminadas`);
          }

          // Now delete the packs
          await supabase.from('packs').delete().in('id', invalidPackIds);
          toast.success(`${invalidPacks.length} packs inválidos eliminados`);

          await fetchData();
        }
      } else {
        toast.info('✅ Todos los packs tienen master_category válida');
      }

      // STEP 2: Check for any remaining orphan cards (null pack_id)
      const { data: orphanCards } = await supabase
        .from('cards')
        .select('id, word')
        .is('pack_id', null);

      if (orphanCards && orphanCards.length > 0) {
        if (confirm(`🗑️ PASO 2: Hay ${orphanCards.length} palabras sin categoría asignada.\n\n¿Eliminarlas?`)) {
          const orphanIds = orphanCards.map(c => c.id);

          // Unlink from game_sessions
          const BATCH_SIZE = 50;
          for (let i = 0; i < orphanIds.length; i += BATCH_SIZE) {
            const chunk = orphanIds.slice(i, i + BATCH_SIZE);
            await supabase.from('game_sessions').update({ card_id: null }).in('card_id', chunk);
          }

          // Delete
          for (let i = 0; i < orphanIds.length; i += BATCH_SIZE) {
            const chunk = orphanIds.slice(i, i + BATCH_SIZE);
            await supabase.from('cards').delete().in('id', chunk);
          }

          toast.success(`${orphanCards.length} palabras huérfanas eliminadas`);
          await fetchData();
        }
      } else {
        toast.info('✅ No hay palabras huérfanas');
      }

    } catch (e: any) {
      console.error('[CleanupOrphans] Error:', e);
      toast.error('Error al limpiar: ' + e.message);
    } finally {
      setBulkActioning(false);
    }
  };

  // === BULK CATEGORY CHANGE ===
  const handleBulkCategoryChange = async () => {
    if (!hasSelection || !targetCategory) return;

    setBulkActioning(true);
    const ids = [...selectedIds];
    let successCount = 0;
    let failedCount = 0;

    try {
      // Find or create the pack for this master category
      const packName = targetCategory === 'general' ? 'General'
        : targetCategory === 'benicolet' ? 'Benicolet'
          : targetCategory === 'terreta' ? 'De la terreta'
            : 'Picantes';
      const packSlug = targetCategory;

      let { data: pack } = await supabase
        .from('packs')
        .select('id')
        .eq('master_category', targetCategory)
        .limit(1)
        .maybeSingle();

      if (!pack) {
        // Create the pack for this master category
        const { data: newPack, error: packError } = await supabase
          .from('packs')
          .insert({
            name: packName,
            slug: packSlug,
            master_category: targetCategory,
            is_active: true
          })
          .select()
          .single();

        if (packError) {
          toast.error('Error al crear la categoría destino');
          setBulkActioning(false);
          return;
        }
        pack = newPack;
      }

      // Process in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('cards')
          .update({ pack_id: pack.id })
          .in('id', chunk);

        if (error) {
          console.error('[BulkCategoryChange] Error:', error);
          failedCount += chunk.length;
        } else {
          successCount += chunk.length;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} palabras movidas a "${packName}"${failedCount > 0 ? ` (${failedCount} fallidas)` : ''}`);
        await fetchData();
        clearSelection();
      } else if (failedCount > 0) {
        toast.error(`Error al mover ${failedCount} palabras`);
      }
    } catch (e: any) {
      console.error('[BulkCategoryChange] Unexpected error:', e);
      toast.error(`Error inesperado: ${e.message}`);
    } finally {
      setBulkActioning(false);
      setShowCategoryDialog(false);
      setTargetCategory('');
    }
  };

  const handleAddWord = async () => {
    if (!formWord.trim()) {
      toast.error('La palabra es obligatoria');
      return;
    }

    setSaving(true);

    try {
      // Get pack for this master category
      const { data: pack, error: packError } = await supabase
        .from('packs')
        .select('id')
        .eq('master_category', formMasterCategory)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (packError || !pack) {
        const categoryName = formMasterCategory === 'general' ? 'General'
          : formMasterCategory === 'benicolet' ? 'Benicolet'
            : formMasterCategory === 'terreta' ? 'De la terreta'
              : 'Picantes';
        toast.error(`No existe la categoría "${categoryName}" en el sistema. Contacta con un administrador.`);
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('cards')
        .insert({
          pack_id: pack.id,
          word: formWord.trim(),
          clue: formClue.trim() || null,
          difficulty: formDifficulty ? parseInt(formDifficulty) : null,
          is_active: formActive,
          created_by: user!.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Esta palabra ya existe en la categoría');
        } else {
          toast.error('Error al crear la palabra');
        }
        setSaving(false);
        return;
      }

      toast.success('Palabra creada');
      setShowAddDialog(false);
      resetForm();
      fetchData();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      toast.error('Pega el contenido CSV');
      return;
    }

    setImporting(true);
    setImportResults(null);

    const lines = csvContent.trim().split('\n').filter(l => l.trim());
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 3) {
        failed++;
        continue;
      }

      const [packSlug, word, clue, difficultyStr, isActiveStr] = parts;

      try {
        // Get or create pack
        let { data: pack } = await supabase
          .from('packs')
          .select('id')
          .eq('slug', packSlug.toLowerCase())
          .maybeSingle();

        if (!pack) {
          const { data: newPack, error: packError } = await supabase
            .from('packs')
            .insert({ name: packSlug, slug: packSlug.toLowerCase() })
            .select()
            .single();

          if (packError) {
            failed++;
            continue;
          }
          pack = newPack;
        }

        // Check if card exists
        const { data: existing } = await supabase
          .from('cards')
          .select('id')
          .eq('pack_id', pack.id)
          .eq('word', word)
          .maybeSingle();

        const difficulty = difficultyStr ? parseInt(difficultyStr) : null;
        const isActive = isActiveStr ? isActiveStr.toLowerCase() === 'true' : true;

        if (existing) {
          // Update existing (don't change created_by or created_at)
          await supabase
            .from('cards')
            .update({ clue, difficulty, is_active: isActive })
            .eq('id', existing.id);
          updated++;
        } else {
          // Insert new
          await supabase
            .from('cards')
            .insert({
              pack_id: pack.id,
              word,
              clue,
              difficulty,
              is_active: isActive,
              created_by: user!.id,
            });
          inserted++;
        }
      } catch {
        failed++;
      }
    }

    setImportResults({ inserted, updated, failed });
    setImporting(false);
    fetchData();
  };

  const resetForm = () => {
    setFormWord('');
    setFormClue('');
    setFormMasterCategory('general');
    setFormDifficulty('');
    setFormActive(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const toggleCardActive = async (card: Card) => {
    await supabase
      .from('cards')
      .update({ is_active: !card.isActive })
      .eq('id', card.id);

    fetchData();
  };

  if (authLoading || roleLoading || loading) {
    return (
      <PageLayout title="Palabras">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <PageLayout title="Palabras">
      <div className="space-y-4">
        {/* Bulk Action Bar */}
        {hasSelection && (
          <div className="sticky top-0 z-10 bg-card border-2 border-primary rounded-md p-4 flex flex-wrap items-center gap-3">
            <span className="font-bold text-primary">
              Seleccionadas: {selectedIds.size}
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkEnable}
              disabled={bulkActioning}
              className="gap-1"
            >
              <Check className="w-4 h-4" />
              Habilitar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkDisable}
              disabled={bulkActioning}
              className="gap-1"
            >
              <X className="w-4 h-4" />
              Archivar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowCategoryDialog(true)}
              disabled={bulkActioning}
              className="gap-1"
            >
              <FolderSync className="w-4 h-4" />
              Cambiar categoría
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handlePreDeleteCheck}
              disabled={bulkActioning || checkingAffected}
              className="gap-1"
            >
              {checkingAffected ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Eliminar definitivamente
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              disabled={bulkActioning}
            >
              Limpiar
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button
              size="sm"
              variant="destructive"
              onClick={handlePurgeInactive}
              disabled={bulkActioning}
              className="gap-1 bg-red-900/80 hover:bg-red-900"
            >
              <Trash2 className="w-4 h-4" />
              Purgar Inactivas
            </Button>
          </div>
        )}

        {!hasSelection && (
          <div className="flex justify-end gap-2 mb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCleanupOrphans}
              disabled={bulkActioning}
              className="gap-1 text-orange-600 hover:text-orange-600 hover:bg-orange-600/10"
            >
              <AlertTriangle className="w-4 h-4" />
              Limpiar Huérfanas
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePurgeInactive}
              disabled={bulkActioning}
              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
              Purgar Inactivas
            </Button>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar definitivamente?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borrarán permanentemente {selectedIds.size} palabras.
                <br />
                <br />
                {affectedSessionCount !== null && affectedSessionCount > 0 ? (
                  <div className="p-3 bg-blue-500/10 border border-blue-500 rounded-md text-blue-600 space-y-1">
                    <p className="font-bold flex items-center gap-2">
                      Nota Informática
                    </p>
                    <p className="text-sm">
                      Las palabras se marcarán como <strong>inactivas</strong> (archivadas) en lugar de borrarse,
                      para no afectar a las partidas históricas.
                    </p>
                  </div>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkActioning}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                disabled={bulkActioning}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {bulkActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Category Change Dialog */}
        <Dialog open={showCategoryDialog} onOpenChange={(open) => {
          setShowCategoryDialog(open);
          if (!open) setTargetCategory('');
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cambiar categoría de {selectedIds.size} palabras</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecciona la categoría destino para las palabras seleccionadas.
              </p>
              <Select value={targetCategory} onValueChange={(v) => setTargetCategory(v as MasterCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">🎯 General</SelectItem>
                  <SelectItem value="benicolet">🎭 Benicolet</SelectItem>
                  <SelectItem value="terreta">🥘 De la terreta</SelectItem>
                  <SelectItem value="picantes">🔥 Picantes (+18)</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowCategoryDialog(false)}
                  disabled={bulkActioning}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleBulkCategoryChange}
                  disabled={bulkActioning || !targetCategory}
                >
                  {bulkActioning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Aplicar cambio
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Actions */}
        <div className="flex gap-3">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Añadir palabra
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva palabra</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Palabra *</Label>
                  <Input
                    value={formWord}
                    onChange={(e) => setFormWord(e.target.value)}
                    placeholder="Ej: Pirámide"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pista (opcional)</Label>
                  <Input
                    value={formClue}
                    onChange={(e) => setFormClue(e.target.value)}
                    placeholder="Ej: Estructura arquitectónica"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoría *</Label>
                  <Select value={formMasterCategory} onValueChange={(v) => setFormMasterCategory(v as MasterCategory)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">🎯 General</SelectItem>
                      <SelectItem value="benicolet">🎭 Benicolet</SelectItem>
                      <SelectItem value="terreta">🥘 De la terreta</SelectItem>
                      <SelectItem value="picantes">🔥 Picantes (+18)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dificultad (opcional)</Label>
                  <Input
                    type="number"
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value)}
                    placeholder="1-5"
                    min={1}
                    max={5}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formActive} onCheckedChange={setFormActive} />
                  <Label>Activa</Label>
                </div>
                <Button onClick={handleAddWord} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar palabras</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Formato:</strong> categoria, palabra, pista</p>
                  <p className="text-xs">
                    Categorías válidas: <code className="bg-muted px-1 rounded">general</code>, <code className="bg-muted px-1 rounded">benicolet</code>, <code className="bg-muted px-1 rounded">terreta</code>, <code className="bg-muted px-1 rounded">picantes</code>
                  </p>
                </div>
                <textarea
                  className="w-full h-48 p-3 border-2 border-border rounded-md text-sm font-mono resize-none"
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder="general, Pirámide, Estructura triangular
benicolet, Forn de lleña, On es fa pa
picantes, Consolador, Juguete para adultos"
                />
                {importResults && (
                  <div className="p-3 bg-secondary rounded-md text-sm space-y-1">
                    <p className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Insertadas: {importResults.inserted}
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                      Actualizadas: {importResults.updated}
                    </p>
                    {importResults.failed > 0 && (
                      <p className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        Fallidas: {importResults.failed}
                      </p>
                    )}
                  </div>
                )}
                <Button onClick={handleImport} disabled={importing} className="w-full">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Importar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <div className="border-2 border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Palabra</TableHead>
                <TableHead>Pista</TableHead>
                <TableHead className="w-20">Activa</TableHead>
                <TableHead className="w-24">Creada</TableHead>
                <TableHead>Creado por</TableHead>
                <TableHead className="w-16">Dif.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No hay palabras. Añade la primera.
                  </TableCell>
                </TableRow>
              ) : (
                cards.map((card) => (
                  <TableRow key={card.id} className={selectedIds.has(card.id) ? 'bg-primary/10' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(card.id)}
                        onCheckedChange={() => toggleOne(card.id)}
                        onClick={(e) => {
                          // Allow native shift-click behavior on the checkbox container too
                          if (e.shiftKey) toggleOne(card.id, e);
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{card.packName}</TableCell>
                    <TableCell className="font-bold">{card.word}</TableCell>
                    <TableCell className="text-muted-foreground">{card.clue}</TableCell>
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
                      {card.creatorName || card.createdBy.slice(0, 8) + '...'}
                    </TableCell>
                    <TableCell className="text-center">
                      {card.difficulty || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
};

export default AdminWordsPage;
