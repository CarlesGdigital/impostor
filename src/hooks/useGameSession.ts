import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GameSession, Player, GameMode, GameStatus } from '@/types/game';

interface UseGameSessionOptions {
  sessionId?: string;
  joinCode?: string;
}

export function useGameSession({ sessionId, joinCode }: UseGameSessionOptions = {}) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapSession = (data: any): GameSession => ({
    id: data.id,
    hostUserId: data.host_user_id,
    hostGuestId: data.host_guest_id,
    mode: data.mode,
    joinCode: data.join_code,
    status: data.status,
    topoCount: data.topo_count,
    packId: data.pack_id,
    wordId: data.word_id,
    wordText: data.word_text,
    clueText: data.clue_text,
    createdAt: data.created_at,
  });

  const mapPlayer = (data: any): Player => ({
    id: data.id,
    sessionId: data.session_id,
    userId: data.user_id,
    guestId: data.guest_id,
    displayName: data.display_name,
    gender: data.gender,
    avatarKey: data.avatar_key,
    photoUrl: data.photo_url,
    role: data.role,
    hasRevealed: data.has_revealed,
    turnOrder: data.turn_order,
  });

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from('game_sessions').select('*');
      
      if (sessionId) {
        query = query.eq('id', sessionId);
      } else if (joinCode) {
        query = query.eq('join_code', joinCode);
      } else {
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError) {
        setError('Partida no encontrada');
        setLoading(false);
        return;
      }

      setSession(mapSession(data));

      const { data: playersData } = await supabase
        .from('session_players')
        .select('*')
        .eq('session_id', data.id)
        .order('turn_order', { ascending: true });

      setPlayers((playersData || []).map(mapPlayer));
    } catch (e) {
      setError('Error al cargar la partida');
    } finally {
      setLoading(false);
    }
  }, [sessionId, joinCode]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Realtime subscription
  useEffect(() => {
    if (!session?.id) return;

    const sessionChannel = supabase
      .channel(`session-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.new) {
            setSession(mapSession(payload.new));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_players',
          filter: `session_id=eq.${session.id}`,
        },
        () => {
          // Refetch players on any change
          supabase
            .from('session_players')
            .select('*')
            .eq('session_id', session.id)
            .order('turn_order', { ascending: true })
            .then(({ data }) => {
              setPlayers((data || []).map(mapPlayer));
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, [session?.id]);

  const createSession = async (
    mode: GameMode,
    topoCount: number,
    hostUserId?: string,
    hostGuestId?: string
  ): Promise<GameSession | null> => {
    const joinCodeValue = mode === 'multi' ? generateJoinCode() : null;

    const { data, error: insertError } = await supabase
      .from('game_sessions')
      .insert({
        mode,
        topo_count: topoCount,
        join_code: joinCodeValue,
        host_user_id: hostUserId || null,
        host_guest_id: hostGuestId || null,
        status: 'lobby',
      })
      .select()
      .single();

    if (insertError || !data) {
      setError('Error al crear la partida');
      return null;
    }

    const newSession = mapSession(data);
    setSession(newSession);
    return newSession;
  };

  const updateSessionStatus = async (status: GameStatus) => {
    if (!session) return;

    await supabase
      .from('game_sessions')
      .update({ status })
      .eq('id', session.id);
  };

  const startDealing = async () => {
    if (!session) return;

    // Get random word
    const { data: wordData } = await supabase
      .from('words')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .order('created_at', { ascending: false });

    const randomWord = wordData?.[Math.floor(Math.random() * (wordData?.length || 1))];

    if (!randomWord) {
      setError('No hay palabras disponibles');
      return;
    }

    // Assign roles
    const playerIds = players.map(p => p.id);
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const topoIds = shuffled.slice(0, session.topoCount);

    // Update players with roles and turn order
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const role = topoIds.includes(player.id) ? 'topo' : 'crew';
      
      await supabase
        .from('session_players')
        .update({ role, turn_order: i, has_revealed: false })
        .eq('id', player.id);
    }

    // Update session
    await supabase
      .from('game_sessions')
      .update({
        status: 'dealing',
        word_id: randomWord.id,
        word_text: randomWord.word,
        clue_text: randomWord.clue,
      })
      .eq('id', session.id);
  };

  const markPlayerRevealed = async (playerId: string) => {
    await supabase
      .from('session_players')
      .update({ has_revealed: true })
      .eq('id', playerId);
  };

  const finishDealing = async () => {
    if (!session) return;

    await supabase
      .from('game_sessions')
      .update({ status: 'finished' })
      .eq('id', session.id);
  };

  const resetGame = async () => {
    if (!session) return;

    // Reset players
    await supabase
      .from('session_players')
      .update({ role: null, has_revealed: false })
      .eq('session_id', session.id);

    // Reset session
    await supabase
      .from('game_sessions')
      .update({
        status: 'lobby',
        word_id: null,
        word_text: null,
        clue_text: null,
      })
      .eq('id', session.id);
  };

  return {
    session,
    players,
    loading,
    error,
    createSession,
    updateSessionStatus,
    startDealing,
    markPlayerRevealed,
    finishDealing,
    resetGame,
    refetch: fetchSession,
  };
}

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
