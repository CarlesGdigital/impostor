import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Gender, GuestPlayer } from '@/types/game';
import { getDefaultAvatar, getAvatarsByGender, getAvatarEmoji } from '@/lib/avatars';
import { v4 as uuidv4 } from 'uuid';

interface AddPlayerFormProps {
  onAddPlayer: (player: GuestPlayer) => void;
  onCancel?: () => void;
  className?: string;
}

export function AddPlayerForm({ onAddPlayer, onCancel, className }: AddPlayerFormProps) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('other');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const avatarKey = selectedAvatar || getDefaultAvatar(gender);
    
    onAddPlayer({
      id: uuidv4(),
      displayName: name.trim(),
      gender,
      avatarKey,
    });

    setName('');
    setGender('other');
    setSelectedAvatar('');
  };

  const avatars = getAvatarsByGender(gender);

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      <div className="space-y-2">
        <Label htmlFor="player-name" className="text-lg font-bold">
          Nombre del jugador
        </Label>
        <Input
          id="player-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Escribe el nombre..."
          className="text-xl h-14 border-2"
          autoComplete="off"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-lg font-bold">Género (para avatar)</Label>
        <div className="grid grid-cols-3 gap-3">
          {(['male', 'female', 'other'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setGender(g);
                setSelectedAvatar('');
              }}
              className={cn(
                'p-4 border-2 border-foreground text-center font-bold transition-colors',
                gender === g ? 'bg-foreground text-background' : 'bg-card hover:bg-secondary'
              )}
            >
              {g === 'male' ? 'Hombre' : g === 'female' ? 'Mujer' : 'Otro'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-lg font-bold">Avatar</Label>
        <div className="grid grid-cols-5 gap-3">
          {avatars.map((avatar) => (
            <button
              key={avatar.key}
              type="button"
              onClick={() => setSelectedAvatar(avatar.key)}
              className={cn(
                'p-3 text-3xl border-2 border-foreground transition-colors',
                selectedAvatar === avatar.key 
                  ? 'bg-foreground text-background' 
                  : 'bg-card hover:bg-secondary'
              )}
            >
              {avatar.emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-14 text-lg font-bold border-2"
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 h-14 text-lg font-bold border-2"
        >
          Añadir jugador
        </Button>
      </div>
    </form>
  );
}
