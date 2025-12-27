import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { Pack, Card } from '@/types/admin';

const AdminWordsPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [cards, setCards] = useState<Card[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="space-y-6">
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No hay palabras. Añade la primera.
                  </TableCell>
                </TableRow>
              ) : (
                cards.map((card) => (
                  <TableRow key={card.id}>
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
