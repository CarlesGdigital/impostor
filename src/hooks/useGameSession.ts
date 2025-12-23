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
    maxPlayers: data.max_players,
    packId: data.pack_id,
    cardId: data.card_id,
    wordText: data.word_text,
    clueText: data.clue_text,
    selectedPackIds: data.selected_pack_ids,
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
    hostGuestId?: string,
    selectedPackIds?: string[]
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
        selected_pack_ids: selectedPackIds || null,
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

  const startDealing = async (): Promise<boolean> => {
    if (!session) return false;

    const selectedPacks = session.selectedPackIds || [];
    console.debug('[startDealing] Categorías seleccionadas:', selectedPacks);

    // Get random card from cards table using session's selected packs
    let randomCard: { id: string; word: string; clue: string } | null = null;

    // Build query with selected packs filter
    let cardsQuery = supabase.from('cards').select('id, word, clue, pack_id').eq('is_active', true);
    
    if (selectedPacks.length > 0) {
      cardsQuery = cardsQuery.in('pack_id', selectedPacks);
    }
    
    const { data: cardsData, error: cardsError } = await cardsQuery;

    console.debug('[startDealing] Cartas encontradas:', cardsData?.length || 0, cardsError ? `Error: ${cardsError.message}` : '');

    if (cardsData && cardsData.length > 0) {
      const randomIndex = Math.floor(Math.random() * cardsData.length);
      randomCard = cardsData[randomIndex];
      console.debug('[startDealing] Carta elegida:', randomCard);
    } else {
      // Fallback to old words table
      console.debug('[startDealing] Sin cartas en tabla cards, buscando en words...');
      const { data: wordData, error: wordError } = await supabase
        .from('words')
        .select('id, word, clue')
        .eq('is_active', true);

      console.debug('[startDealing] Palabras encontradas en words:', wordData?.length || 0, wordError ? `Error: ${wordError.message}` : '');

      if (wordData && wordData.length > 0) {
        randomCard = wordData[Math.floor(Math.random() * wordData.length)];
        console.debug('[startDealing] Palabra elegida de words:', randomCard);
      }
    }

    if (!randomCard) {
      const errorMsg = 'No hay palabras activas en las categorías seleccionadas';
      console.error('[startDealing]', errorMsg);
      setError(errorMsg);
      return false;
    }

    // Validate card has word and clue
    if (!randomCard.word || !randomCard.clue) {
      const errorMsg = 'La carta seleccionada no tiene palabra o pista válida';
      console.error('[startDealing]', errorMsg, randomCard);
      setError(errorMsg);
      return false;
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

    // Update session with word and clue
    const { error: updateError } = await supabase
      .from('game_sessions')
      .update({
        status: 'dealing',
        card_id: randomCard.id,
        word_text: randomCard.word,
        clue_text: randomCard.clue,
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('Error updating game session:', updateError);
      setError('Error al iniciar el reparto');
      return false;
    }

    // Update local session state immediately
    const updatedCard = randomCard;
    setSession(prev => prev ? {
      ...prev,
      status: 'dealing' as GameStatus,
      cardId: updatedCard.id,
      wordText: updatedCard.word,
      clueText: updatedCard.clue,
    } : null);

    return true;
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
