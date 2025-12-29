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
import { Plus, Upload, Loader2, CheckCircle, XCircle, Trash2, Check, X, AlertTriangle } from 'lucide-react';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkActioning, setBulkActioning] = useState(false);
  const [affectedSessionCount, setAffectedSessionCount] = useState<number | null>(null);
  const [checkingAffected, setCheckingAffected] = useState(false);

  // Form state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [formWord, setFormWord] = useState('');
  const [formClue, setFormClue] = useState('');
  const [formPackId, setFormPackId] = useState('');
  const [formNewPack, setFormNewPack] = useState('');
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
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
    setCheckingAffected(true);
    setAffectedSessionCount(null);

    try {
      const count = await cardService.countAffectedSessions([...selectedIds]);
      setAffectedSessionCount(count);

      setShowDeleteConfirm(true);
    } catch (e) {
      console.error('[PreDelete] Exception:', e);
      setShowDeleteConfirm(true);
    } finally {
      setCheckingAffected(false);
    }
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

    await processInBatches(
      [...selectedIds],
      (chunk) => cardService.deleteCards(chunk),
      'palabras eliminadas definitivamente',
      'Error al eliminar'
    );
  };

  const handleAddWord = async () => {
    if (!formWord.trim() || !formClue.trim()) {
      toast.error('Palabra y pista son obligatorias');
      return;
    }

    if (!formPackId && !formNewPack.trim()) {
      toast.error('Selecciona o crea una categoría');
      return;
    }

    setSaving(true);

    try {
      let packId = formPackId;

      // Create new pack if needed
      if (formNewPack.trim()) {
        const slug = formNewPack.trim().toLowerCase().replace(/\s+/g, '-');
        const { data: newPack, error: packError } = await supabase
          .from('packs')
          .insert({ name: formNewPack.trim(), slug })
          .select()
          .single();

        if (packError) {
          toast.error('Error al crear la categoría');
          setSaving(false);
          return;
        }
        packId = newPack.id;
      }

      const { error } = await supabase
        .from('cards')
        .insert({
          pack_id: packId,
          word: formWord.trim(),
          clue: formClue.trim(),
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
    setFormPackId('');
    setFormNewPack('');
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
                  <div className="p-3 bg-amber-500/10 border border-amber-500 rounded-md text-amber-600 space-y-1">
                    <p className="font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Atención
                    </p>
                    <p className="text-sm">
                      Estas cartas se usan en <strong>{affectedSessionCount} partidas históricas</strong>.
                    </p>
                    <p className="text-xs opacity-90">
                      Al eliminar, se mantendrá el histórico (palabra/pista) pero perderán el enlace a la carta original.
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    No se han encontrado partidas afectadas (o no se pudo comprobar).
                  </span>
                )}
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
                  <Label>Pista *</Label>
                  <Input
                    value={formClue}
                    onChange={(e) => setFormClue(e.target.value)}
                    placeholder="Ej: Estructura arquitectónica"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={formPackId} onValueChange={(v) => { setFormPackId(v); setFormNewPack(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {packs.map((pack) => (
                        <SelectItem key={pack.id} value={pack.id}>
                          {pack.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>O crear nueva categoría</Label>
                  <Input
                    value={formNewPack}
                    onChange={(e) => { setFormNewPack(e.target.value); setFormPackId(''); }}
                    placeholder="Nombre de la nueva categoría"
                  />
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
                <p className="text-sm text-muted-foreground">
                  Formato: pack_slug, word, clue, difficulty (opcional), is_active (opcional)
                </p>
                <textarea
                  className="w-full h-48 p-3 border-2 border-border rounded-md text-sm font-mono resize-none"
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder="general, Pirámide, Estructura triangular, 2, true
animales, León, Rey de la selva, 1, true"
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
