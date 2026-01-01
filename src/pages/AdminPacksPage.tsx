import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Loader2, CheckCircle, XCircle, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Pack, MasterCategory } from '@/types/admin';

const AdminPacksPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPack, setEditingPack] = useState<Pack | null>(null);
  const [formName, setFormName] = useState('');
  const [formMasterCategory, setFormMasterCategory] = useState<MasterCategory>('general');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [packToDelete, setPackToDelete] = useState<Pack | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      fetchPacks();
    }
  }, [isAdmin]);

  const fetchPacks = async () => {
    setLoading(true);

    const { data } = await supabase
      .from('packs')
      .select('*')
      .order('name');

    setPacks((data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      isActive: p.is_active,
      // Map legacy values to the 3 valid categories
      masterCategory: (['general', 'benicolet', 'picantes'].includes(p.master_category) 
        ? p.master_category 
        : 'general') as MasterCategory,
      createdAt: p.created_at,
    })));

    setLoading(false);
  };

  const handleAddPack = async () => {
    if (!formName.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setSaving(true);

    const slug = formName.trim().toLowerCase().replace(/\s+/g, '-');

    const { error } = await supabase
      .from('packs')
      .insert({
        name: formName.trim(),
        slug,
        is_active: formActive,
        master_category: formMasterCategory
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('Esta categoría ya existe');
      } else {
        toast.error('Error al crear la categoría');
      }
      setSaving(false);
      return;
    }

    toast.success('Categoría creada');
    setShowAddDialog(false);
    setFormName('');
    setFormMasterCategory('general');
    setFormActive(true);
    fetchPacks();
    setSaving(false);
  };

  const toggleActive = async (pack: Pack) => {
    await supabase
      .from('packs')
      .update({ is_active: !pack.isActive })
      .eq('id', pack.id);

    fetchPacks();
  };

  const openEditDialog = (pack: Pack) => {
    setEditingPack(pack);
    setFormName(pack.name);
    setFormMasterCategory(pack.masterCategory);
    setShowEditDialog(true);
  };

  const handleEditPack = async () => {
    if (!editingPack || !formName.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('packs')
      .update({
        name: formName.trim(),
        master_category: formMasterCategory
      })
      .eq('id', editingPack.id);

    if (error) {
      toast.error('Error al guardar');
      setSaving(false);
      return;
    }

    toast.success('Categoría actualizada');
    setShowEditDialog(false);
    setEditingPack(null);
    setFormName('');
    setFormMasterCategory('general');
    fetchPacks();
    setSaving(false);
  };

  const handleDeleteClick = (pack: Pack) => {
    setPackToDelete(pack);
  };

  const confirmDeletePack = async () => {
    if (!packToDelete) return;

    setDeleting(true);
    try {
      console.info('[DeletePack] Starting cascade delete for pack:', packToDelete.id);

      // 0. Get all card IDs in this pack to unlink them
      const { data: packCards } = await supabase
        .from('cards')
        .select('id')
        .eq('pack_id', packToDelete.id);

      const cardIds = packCards?.map(c => c.id) || [];

      // 1. Unlink from game history (Set card_id = NULL in game_sessions)
      if (cardIds.length > 0) {
        // Chunking for safety if many cards
        const CHUNK_SIZE = 50;
        for (let i = 0; i < cardIds.length; i += CHUNK_SIZE) {
          const chunk = cardIds.slice(i, i + CHUNK_SIZE);
          await supabase
            .from('game_sessions')
            .update({ card_id: null })
            .in('card_id', chunk);
        }
      }

      // Also unlink pack_id from sessions
      await supabase
        .from('game_sessions')
        .update({ pack_id: null })
        .eq('pack_id', packToDelete.id);

      // 2. Delete all cards in this pack
      console.info('[DeletePack] Deleting cards...');
      const { error: cardsError } = await supabase
        .from('cards')
        .delete()
        .eq('pack_id', packToDelete.id);

      if (cardsError) {
        throw new Error(`Error al eliminar palabras: ${cardsError.message}`);
      }

      // 3. Delete the pack itself
      console.info('[DeletePack] Deleting pack:', packToDelete.id);
      const { error: packError } = await supabase
        .from('packs')
        .delete()
        .eq('id', packToDelete.id);

      if (packError) {
        throw new Error(`Error al eliminar la categoría: ${packError.message}`);
      }

      toast.success('Categoría eliminada (historial desvinculado)');
      setPackToDelete(null);
      fetchPacks();
    } catch (e: any) {
      console.error('[DeletePack] Failed:', e);
      toast.error(e.message || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  if (authLoading || roleLoading || loading) {
    return (
      <PageLayout title="Categorías">
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
    <PageLayout title="Categorías">
      <div className="space-y-6">
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva categoría
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva categoría</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Animales"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría Superior</Label>
                <Select value={formMasterCategory} onValueChange={(v) => setFormMasterCategory(v as MasterCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="benicolet">Benicolet</SelectItem>
                    <SelectItem value="picantes">🔥 Picantes (+18)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formActive} onCheckedChange={setFormActive} />
                <Label>Activa</Label>
              </div>
              <Button onClick={handleAddPack} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar categoría</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nombre de la categoría"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría Superior</Label>
                <Select value={formMasterCategory} onValueChange={(v) => setFormMasterCategory(v as MasterCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="benicolet">Benicolet</SelectItem>
                    <SelectItem value="picantes">🔥 Picantes (+18)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleEditPack} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!packToDelete} onOpenChange={(open) => !open && setPackToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                ¿Eliminar categoría "{packToDelete?.name}"?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción borrará la categoría <strong>y todas sus palabras asociadas</strong>.
                <br /><br />
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmDeletePack();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar todo'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="border-2 border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-20">Activa</TableHead>
                <TableHead className="w-24">Creada</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay categorías.
                  </TableCell>
                </TableRow>
              ) : (
                packs.map((pack) => (
                  <TableRow key={pack.id}>
                    <TableCell className="font-bold">{pack.name}</TableCell>
                    <TableCell>
                      {pack.masterCategory === 'benicolet' ? 'Benicolet' : 
                        pack.masterCategory === 'picantes' ? '🔥 Picantes' : 'General'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{pack.slug}</TableCell>
                    <TableCell>
                      <Switch checked={pack.isActive} onCheckedChange={() => toggleActive(pack)} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(pack.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(pack)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(pack)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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

export default AdminPacksPage;
