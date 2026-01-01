import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface Pack {
  id: string;
  name: string;
}

interface WordEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packs: Pack[];
  editingCard?: {
    id: string;
    packId: string;
    word: string;
    clue: string;
    difficulty?: number | null;
    isActive: boolean;
  } | null;
  onSave: (data: {
    id?: string;
    packId: string;
    newPackName?: string;
    word: string;
    clue: string;
    difficulty?: number | null;
    isActive: boolean;
  }) => Promise<boolean>;
}

export function WordEditDialog({ 
  open, 
  onOpenChange, 
  packs, 
  editingCard, 
  onSave 
}: WordEditDialogProps) {
  const [word, setWord] = useState('');
  const [clue, setClue] = useState('');
  const [packId, setPackId] = useState('');
  const [newPackName, setNewPackName] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingCard) {
      setWord(editingCard.word);
      setClue(editingCard.clue);
      setPackId(editingCard.packId);
      setDifficulty(editingCard.difficulty?.toString() || '');
      setIsActive(editingCard.isActive);
      setNewPackName('');
    } else {
      resetForm();
    }
  }, [editingCard, open]);

  const resetForm = () => {
    setWord('');
    setClue('');
    setPackId('');
    setNewPackName('');
    setDifficulty('');
    setIsActive(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await onSave({
      id: editingCard?.id,
      packId,
      newPackName: newPackName.trim() || undefined,
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
            <Label>Categoría</Label>
            <Select value={packId} onValueChange={(v) => { setPackId(v); setNewPackName(''); }}>
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
          {!isEdit && (
            <div className="space-y-2">
              <Label>O crear nueva categoría</Label>
              <Input
                value={newPackName}
                onChange={(e) => { setNewPackName(e.target.value); setPackId(''); }}
                placeholder="Nombre de la nueva categoría"
              />
            </div>
          )}
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
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
