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
import { Plus, Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { Pack } from '@/types/admin';

const AdminPacksPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formName, setFormName] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

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
    
    setPacks((data || []).map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      isActive: p.is_active,
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
      .insert({ name: formName.trim(), slug, is_active: formActive });

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

        <div className="border-2 border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-20">Activa</TableHead>
                <TableHead className="w-24">Creada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No hay categorías.
                  </TableCell>
                </TableRow>
              ) : (
                packs.map((pack) => (
                  <TableRow key={pack.id}>
                    <TableCell className="font-bold">{pack.name}</TableCell>
                    <TableCell className="text-muted-foreground">{pack.slug}</TableCell>
                    <TableCell>
                      <Switch checked={pack.isActive} onCheckedChange={() => toggleActive(pack)} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(pack.createdAt)}
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
