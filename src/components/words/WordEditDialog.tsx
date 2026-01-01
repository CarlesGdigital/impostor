import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Globe, MapPin, Flame } from 'lucide-react';
import type { MasterCategory } from '@/types/admin';

interface WordEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCard?: {
    id: string;
    masterCategory: MasterCategory;
    word: string;
    clue: string;
    difficulty?: number | null;
    isActive: boolean;
  } | null;
  onSave: (data: {
    id?: string;
    masterCategory: MasterCategory;
    word: string;
    clue: string;
    difficulty?: number | null;
    isActive: boolean;
  }) => Promise<boolean>;
}

export function WordEditDialog({ 
  open, 
  onOpenChange, 
  editingCard, 
  onSave 
}: WordEditDialogProps) {
  const [word, setWord] = useState('');
  const [clue, setClue] = useState('');
  const [masterCategory, setMasterCategory] = useState<MasterCategory>('general');
  const [difficulty, setDifficulty] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingCard) {
      setWord(editingCard.word);
      setClue(editingCard.clue);
      setMasterCategory(editingCard.masterCategory);
      setDifficulty(editingCard.difficulty?.toString() || '');
      setIsActive(editingCard.isActive);
    } else {
      resetForm();
    }
  }, [editingCard, open]);

  const resetForm = () => {
    setWord('');
    setClue('');
    setMasterCategory('general');
    setDifficulty('');
    setIsActive(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await onSave({
      id: editingCard?.id,
      masterCategory,
      word: word.trim(),
      clue: clue.trim(),
      difficulty: difficulty ? parseInt(difficulty) : null,
      isActive,
    });
    setSaving(false);
    
    if (success) {
      onOpenChange(false);
      resetForm();
    }
  };

  const isEdit = !!editingCard;

  const getCategoryIcon = (cat: MasterCategory) => {
    switch (cat) {
      case 'benicolet': return <MapPin className="w-4 h-4" />;
      case 'picantes': return <Flame className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (cat: MasterCategory) => {
    switch (cat) {
      case 'benicolet': return 'Benicolet';
      case 'picantes': return '🔥 Picantes (+18)';
      default: return 'General';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar palabra' : 'Nueva palabra'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Palabra *</Label>
            <Input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Ej: Pirámide"
            />
          </div>
          <div className="space-y-2">
            <Label>Pista *</Label>
            <Input
              value={clue}
              onChange={(e) => setClue(e.target.value)}
              placeholder="Ej: Estructura arquitectónica"
            />
          </div>
          <div className="space-y-2">
            <Label>Categoría *</Label>
            <Select value={masterCategory} onValueChange={(v) => setMasterCategory(v as MasterCategory)}>
              <SelectTrigger>
                <SelectValue>
                  <span className="flex items-center gap-2">
                    {getCategoryIcon(masterCategory)}
                    {getCategoryLabel(masterCategory)}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    General
                  </span>
                </SelectItem>
                <SelectItem value="benicolet">
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Benicolet
                  </span>
                </SelectItem>
                <SelectItem value="picantes">
                  <span className="flex items-center gap-2">
                    <Flame className="w-4 h-4" />
                    🔥 Picantes (+18)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dificultad (opcional)</Label>
            <Input
              type="number"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              placeholder="1-5"
              min={1}
              max={5}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Activa</Label>
          </div>
          <Button onClick={handleSave} disabled={saving || !word.trim() || !clue.trim()} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}