import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { useGameSession } from '@/hooks/useGameSession';
import { useAuth } from '@/hooks/useAuth';
import { useGuestId } from '@/hooks/useGuestId';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Gender } from '@/types/game';
import { getDefaultAvatar, getAvatarsByGender } from '@/lib/avatars';

export default function JoinWithCodePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const guestId = useGuestId();
  const { session, players, loading, error } = useGameSession({ joinCode: code });
  
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('other');
  const [avatarKey, setAvatarKey] = useState('');
  const [joining, setJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  // Check if already joined
  useEffect(() => {
    if (!session || !guestId) return;
    
    const existingPlayer = players.find(
      p => p.guestId === guestId || p.userId === user?.id
    );
    
    if (existingPlayer) {
      setHasJoined(true);
      setMyPlayerId(existingPlayer.id);
    }
  }, [session, players, guestId, user]);

  // Navigate to game when dealing starts
  useEffect(() => {
    if (session?.status === 'dealing' && myPlayerId) {
      navigate(`/play/${session.id}/${myPlayerId}`);
    }
  }, [session?.status, myPlayerId, navigate]);

  const handleJoin = async () => {
    if (!session || !name.trim()) return;
    
    setJoining(true);
    
    const finalAvatarKey = avatarKey || getDefaultAvatar(gender);
    
    const { data, error: insertError } = await supabase
      .from('session_players')
      .insert({
        session_id: session.id,
        user_id: user?.id || null,
        guest_id: guestId,
        display_name: name.trim(),
        gender,
        avatar_key: finalAvatarKey,
      })
      .select()
      .single();

    setJoining(false);

    if (insertError) {
      toast.error('Error al unirse');
      return;
    }

    setHasJoined(true);
    setMyPlayerId(data.id);
    toast.success('¡Te has unido!');
  };

  const avatars = getAvatarsByGender(gender);

  if (loading) {
    return (
      <PageLayout title="Unirse">
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-xl">Buscando partida...</p>
        </div>
      </PageLayout>
    );
  }

  if (error || !session) {
    return (
      <PageLayout title="Error">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-xl text-center">Partida no encontrada</p>
          <Button onClick={() => navigate('/join')} variant="outline">
            Volver
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (hasJoined) {
    return (
      <PageLayout title={`Sala: ${code}`}>
        <div className="max-w-md mx-auto space-y-8">
          <div className="text-center space-y-2">
            <div className="text-6xl">⏳</div>
            <h2 className="text-2xl font-bold">Esperando al anfitrión</h2>
            <p className="text-muted-foreground">
              El anfitrión iniciará el reparto cuando todos estén listos
            </p>
          </div>

          <div className="space-y-4">
            <Label className="text-lg font-bold">
              Jugadores conectados ({players.length})
            </Label>
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={cn(
                    'flex items-center gap-3 p-3 border-2 border-foreground bg-card',
                    player.id === myPlayerId && 'border-4 bg-secondary'
                  )}
                >
                  <PlayerAvatar
                    avatarKey={player.avatarKey}
                    photoUrl={player.photoUrl}
                    displayName={player.displayName}
                    size="sm"
                  />
                  <span className="font-bold truncate">
                    {player.displayName}
                    {player.id === myPlayerId && ' (tú)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title={`Unirse: ${code}`}
      footer={
        <Button
          onClick={handleJoin}
          disabled={!name.trim() || joining}
          className="w-full h-16 text-xl font-bold"
        >
          {joining ? 'Uniéndose...' : 'Unirse a la partida'}
        </Button>
      }
    >
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <p className="text-muted-foreground">
            Introduce tu nombre y elige un avatar
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-lg font-bold">
            Tu nombre
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Escribe tu nombre..."
            className="text-xl h-14 border-2"
            autoComplete="off"
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
          <Label className="text-lg font-bold">Avatar</Label>
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
    </PageLayout>
  );
}
