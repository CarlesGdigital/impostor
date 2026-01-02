import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGuestId } from '@/hooks/useGuestId';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Globe, MapPin, Flame, Plus, ListPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

type MasterCategory = 'general' | 'benicolet' | 'picantes';

interface QuickAddWordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_CONFIG: Record<MasterCategory, { label: string; icon: React.ReactNode; variant: 'default' | 'destructive' | 'secondary' }> = {
  general: { label: 'General', icon: <Globe className="w-4 h-4" />, variant: 'secondary' },
  benicolet: { label: 'Benicolet', icon: <MapPin className="w-4 h-4" />, variant: 'default' },
  picantes: { label: 'Picantes', icon: <Flame className="w-4 h-4" />, variant: 'destructive' },
};

export function QuickAddWordDialog({ open, onOpenChange }: QuickAddWordDialogProps) {
  const { user } = useAuth();
  const guestId = useGuestId();
  
  // Single word mode
  const [word, setWord] = useState('');
  const [clue, setClue] = useState('');
  const [category, setCategory] = useState<MasterCategory>('general');
  
  // Bulk mode
  const [bulkWords, setBulkWords] = useState('');
  const [bulkCategory, setBulkCategory] = useState<MasterCategory>('general');
  
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [packMap, setPackMap] = useState<Map<MasterCategory, string>>(new Map());

  // Fetch packs on mount
  useEffect(() => {
    if (open) {
      fetchPacks();
    }
  }, [open]);

  const fetchPacks = async () => {
    const { data } = await supabase
      .from('packs')
      .select('id, master_category')
      .eq('is_active', true);
    
    const map = new Map<MasterCategory, string>();
    (data || []).forEach((p: any) => {
      if (p.master_category && ['general', 'benicolet', 'picantes'].includes(p.master_category)) {
        map.set(p.master_category as MasterCategory, p.id);
      }
    });
    setPackMap(map);
  };

  const getCreatorId = (): string => {
    // Use user ID if authenticated, otherwise use guest ID
    return user?.id || guestId;
  };

  const handleSaveSingle = async () => {
    if (!word.trim()) {
      toast.error('La palabra es obligatoria');
      return;
    }

    const packId = packMap.get(category);
    if (!packId) {
      toast.error('Categoría no disponible. Inténtalo de nuevo.');
      return;
    }

    setSaving(true);
    try {
      const creatorId = getCreatorId();
      
      const { error } = await supabase.from('cards').insert({
        pack_id: packId,
        word: word.trim(),
        clue: clue.trim() || null,
        is_active: true,
        created_by: creatorId,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('Esta palabra ya existe');
        } else if (error.code === '23503') {
          // Foreign key error - creator doesn't exist in profiles
          // For guests, we need to handle this differently
          toast.error('Error de permisos. Inténtalo de nuevo.');
        } else {
          toast.error('Error al guardar la palabra');
        }
        return;
      }

      toast.success('¡Palabra añadida!');
      setWord('');
      setClue('');
      onOpenChange(false);
    } catch (e) {
      toast.error('Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulk = async () => {
    const words = bulkWords
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0 && w.length <= 100);

    if (words.length === 0) {
      toast.error('Introduce al menos una palabra');
      return;
    }

    if (words.length > 50) {
      toast.error('Máximo 50 palabras a la vez');
      return;
    }

    const packId = packMap.get(bulkCategory);
    if (!packId) {
      toast.error('Categoría no disponible');
      return;
    }

    setSaving(true);
    try {
      const creatorId = getCreatorId();
      
      const cardsToInsert = words.map(w => ({
        pack_id: packId,
        word: w,
        clue: null,
        is_active: true,
        created_by: creatorId,
      }));

      const { error, data } = await supabase.from('cards').insert(cardsToInsert).select();

      if (error) {
        if (error.code === '23505') {
          toast.error('Algunas palabras ya existen y fueron omitidas');
        } else {
          toast.error('Error al guardar las palabras');
        }
        return;
      }

      const count = data?.length || words.length;
      toast.success(`¡${count} palabra(s) añadida(s)!`);
      setBulkWords('');
      onOpenChange(false);
    } catch (e) {
      toast.error('Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const CategorySelector = ({ value, onChange }: { value: MasterCategory; onChange: (v: MasterCategory) => void }) => (
    <div className="grid grid-cols-3 gap-2">
      {(['general', 'benicolet', 'picantes'] as MasterCategory[]).map((cat) => {
        const config = CATEGORY_CONFIG[cat];
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
              value === cat
                ? cat === 'picantes'
                  ? "border-destructive bg-destructive/10"
                  : "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground"
            )}
          >
            {config.icon}
            <span className="text-xs font-medium">{config.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir palabras</DialogTitle>
          <DialogDescription>
            Contribuye al juego añadiendo nuevas palabras.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'bulk')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="gap-2">
              <Plus className="w-4 h-4" />
              Una palabra
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <ListPlus className="w-4 h-4" />
              Creación masiva
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Palabra *</Label>
              <Input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="Escribe la palabra..."
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Pista (opcional)</Label>
              <Input
                value={clue}
                onChange={(e) => setClue(e.target.value)}
                placeholder="Una pista para el topo..."
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoría</Label>
              <CategorySelector value={category} onChange={setCategory} />
            </div>

            <Button
              onClick={handleSaveSingle}
              disabled={saving || !word.trim()}
              className="w-full"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Añadir palabra
            </Button>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Palabras (separadas por coma)</Label>
              <Textarea
                value={bulkWords}
                onChange={(e) => setBulkWords(e.target.value)}
                placeholder="palabra1, palabra2, palabra3, ..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Escribe las palabras separadas por coma. Máximo 50 palabras.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Categoría para todas</Label>
              <CategorySelector value={bulkCategory} onChange={setBulkCategory} />
            </div>

            <Button
              onClick={handleSaveBulk}
              disabled={saving || !bulkWords.trim()}
              className="w-full"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Añadir palabras
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
