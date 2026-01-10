import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { getAvatarsByGender } from '@/lib/avatars';
import { cn } from '@/lib/utils';
import type { Gender } from '@/types/game';
import { LogOut, Upload, Users, Star, Clock, Trash2 } from 'lucide-react';
import { useSavedRooms } from '@/hooks/useSavedRooms';
import { SavedRoomsManager } from '@/components/game/SavedRoomsManager';
import type { SavedRoom } from '@/types/savedRoom';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender>('other');
  const [avatarKey, setAvatarKey] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    loadProfile();
  }, [user, navigate]);

  const loadProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setDisplayName(data.display_name || '');
      setGender((data.gender as Gender) || 'other');
      setAvatarKey(data.avatar_key || '');
      setPhotoUrl(data.photo_url || '');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        display_name: displayName,
        gender,
        avatar_key: avatarKey,
        photo_url: photoUrl,
      });

    setLoading(false);

    if (error) {
      toast.error('Error al guardar el perfil');
    } else {
      toast.success('Perfil guardado');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Error al subir la foto');
      setLoading(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    setPhotoUrl(data.publicUrl);
    setLoading(false);
    toast.success('Foto subida');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
    toast.success('Sesión cerrada');
  };

  const avatars = getAvatarsByGender(gender);

  if (!user) return null;

  return (
    <PageLayout title="Mi perfil">
      <div className="max-w-md mx-auto space-y-8">
        {/* Avatar preview */}
        <div className="flex flex-col items-center gap-4">
          <PlayerAvatar
            avatarKey={avatarKey}
            photoUrl={photoUrl}
            displayName={displayName}
            size="xl"
          />

          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <div className="flex items-center gap-2 px-4 py-2 border-2 border-foreground hover:bg-secondary transition-colors">
              <Upload className="w-5 h-5" />
              <span className="font-bold">Subir foto</span>
            </div>
          </label>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-lg font-bold">
              Nombre
            </Label>
            <Input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre"
              className="text-xl h-14 border-2"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-lg font-bold">Género</Label>
            <div className="grid grid-cols-3 gap-3">
              {(['male', 'female', 'other'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setGender(g);
                    setAvatarKey('');
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
            <Label className="text-lg font-bold">Avatar (si no hay foto)</Label>
            <div className="grid grid-cols-5 gap-3">
              {avatars.map((avatar) => (
                <button
                  key={avatar.key}
                  type="button"
                  onClick={() => setAvatarKey(avatar.key)}
                  className={cn(
                    'p-3 text-3xl border-2 border-foreground transition-colors',
                    avatarKey === avatar.key
                      ? 'bg-foreground text-background'
                      : 'bg-card hover:bg-secondary'
                  )}
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Favorites and History */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold border-b-2 border-foreground pb-2">Mis Salas</h2>
          <SavedRoomsManager />
        </div>

        {/* Actions */}
        <div className="space-y-4 pt-4">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full h-14 text-lg font-bold"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </Button>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full h-14 text-lg font-bold border-2"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Cerrar sesión
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {user.email}
        </p>
      </div>
    </PageLayout>
  );
}
