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
  const [waitingForAssignment, setWaitingForAssignment] = useState(false);
  const [dealingRequested, setDealingRequested] = useState(false);

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

    console.info('[realtime] Setting up subscription for session:', session.id);

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
          console.info('[realtime] game_sessions payload:', {
            event: payload.eventType,
            new_status: (payload.new as any)?.status,
            has_word: !!(payload.new as any)?.word_text,
            has_clue: !!(payload.new as any)?.clue_text,
          });
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
        (payload) => {
          console.info('[realtime] session_players payload:', payload.eventType);
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
      .subscribe((status) => {
        console.info('[realtime] subscribed, status:', status);
      });

    return () => {
      console.info('[realtime] Unsubscribing from session:', session.id);
      supabase.removeChannel(sessionChannel);
    };
  }, [session?.id]);

  // Detect waiting for assignment state with timeout
  // Only activate timeout if:
  // - dealingRequested is true (user clicked start) OR
  // - session.status is 'dealing' (dealing in progress)
  useEffect(() => {
    // Don't run if still loading or no session
    if (loading || !session) {
      return;
    }

    // Check if we have word/clue
    const hasAssignment = Boolean(session.wordText && session.clueText);

    if (hasAssignment) {
      // Assignment is complete, clear waiting state and flag
      setWaitingForAssignment(false);
      setDealingRequested(false);
      return;
    }

    // Determine if we should be waiting with timeout
    const shouldWaitWithTimeout = dealingRequested || session.status === 'dealing';

    if (!shouldWaitWithTimeout) {
      // In lobby without dealingRequested - normal state, no timeout needed
      setWaitingForAssignment(false);
      return;
    }

    // Dealing was requested or is in progress - set waiting state with timeout
    setWaitingForAssignment(true);
    console.info('[useGameSession] Waiting for assignment (with timeout):', {
      sessionId: session.id,
      status: session.status,
      dealingRequested,
    });

    // Set 10 second timeout
    const timeoutId = window.setTimeout(() => {
      console.warn('[useGameSession] TIMEOUT waiting assignment', {
        sessionId: session.id,
        status: session.status,
        dealingRequested,
      });
      setError('Timeout: El servidor no responde. Pulse "Reintentar asignación" para volver a intentarlo.');
      setWaitingForAssignment(false);
      setDealingRequested(false);
    }, 10000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loading, session?.id, session?.status, session?.wordText, session?.clueText, dealingRequested]);

  const createSession = async (
    mode: GameMode,
    topoCount: number,
    hostUserId?: string,
    hostGuestId?: string,
    selectedPackIds?: string[]
  ): Promise<GameSession | null> => {
    console.info('[createSession] Creating session with word preload', { mode, topoCount, selectedPackIds });

    // 1) Preload a random word/clue
    let randomCard: { id: string; word: string; clue: string } | null = null;

    // Build query with selected packs filter
    let cardsQuery = supabase.from('cards').select('id, word, clue, pack_id').eq('is_active', true);

    if (selectedPackIds && selectedPackIds.length > 0) {
      cardsQuery = cardsQuery.in('pack_id', selectedPackIds);
    }

    const { data: cardsData, error: cardsError } = await cardsQuery;

    console.debug('[createSession] Cards found:', cardsData?.length || 0, cardsError ? `Error: ${cardsError.message}` : '');

    if (cardsData && cardsData.length > 0) {
      const randomIndex = Math.floor(Math.random() * cardsData.length);
      randomCard = cardsData[randomIndex];
      console.debug('[createSession] Card selected:', randomCard);
    } else {
      // Fallback to old words table
      console.debug('[createSession] No cards in cards table, trying words table...');
      const { data: wordData, error: wordError } = await supabase
        .from('words')
        .select('id, word, clue')
        .eq('is_active', true);

      console.debug('[createSession] Words found in words table:', wordData?.length || 0, wordError ? `Error: ${wordError.message}` : '');

      if (wordData && wordData.length > 0) {
        randomCard = wordData[Math.floor(Math.random() * wordData.length)];
        console.debug('[createSession] Word selected from words table:', randomCard);
      }
    }

    if (!randomCard) {
      setError('No hay palabras activas en las categorías seleccionadas');
      return null;
    }

    // 2) Create session with preloaded word
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
        card_id: randomCard.id,
        word_text: randomCard.word,
        clue_text: randomCard.clue,
      })
      .select()
      .single();

    if (insertError || !data) {
      console.error('[createSession] Insert error:', insertError);
      setError('Error al crear la partida');
      return null;
    }

    console.info('[createSession] Session created with preloaded word:', {
      sessionId: data.id,
      word: randomCard.word,
    });

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
    // Guards against race condition
    if (!session) {
      console.warn('[startDealing] No session available');
      setError('Sesión no cargada. Espere...');
      return false;
    }

    if (players.length === 0) {
      console.warn('[startDealing] No players loaded yet');
      setError('Jugadores no cargados. Espere...');
      return false;
    }

    if (loading) {
      console.warn('[startDealing] Still loading, abort');
      return false;
    }

    // Verify word is preloaded (should be from createSession)
    if (!session.wordText || !session.clueText) {
      console.error('[startDealing] No word/clue in session - should have been preloaded');
      setError('No hay palabra asignada. Vuelva a crear la partida.');
      return false;
    }

    console.info('[startDealing] begin (word already preloaded)', {
      sessionId: session.id,
      status: session.status,
      playersCount: players.length,
      word: session.wordText,
    });

    setLoading(true);
    setError(null);
    setWaitingForAssignment(false);
    setDealingRequested(true);

    try {
      // Read variant from localStorage
      const variant = localStorage.getItem(`impostor:variant:${session.id}`) || 'classic';
      console.info('[startDealing] Variant:', variant);

      // Assign roles
      const playerIds = players.map(p => p.id);
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

      // For double_topo, force 2 topos
      const effectiveTopoCount = variant === 'double_topo' ? 2 : session.topoCount;
      const topoIds = shuffled.slice(0, effectiveTopoCount);

      // For double_topo: pick one confused topo
      if (variant === 'double_topo' && topoIds.length >= 2) {
        const confusedTopoId = topoIds[Math.floor(Math.random() * topoIds.length)];
        localStorage.setItem(`impostor:confusedTopoId:${session.id}`, confusedTopoId);
        console.info('[startDealing] Confused topo:', confusedTopoId);
      }

      // Update players with roles and turn order
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const role = topoIds.includes(player.id) ? 'topo' : 'crew';

        await supabase
          .from('session_players')
          .update({ role, turn_order: i, has_revealed: false })
          .eq('id', player.id);
      }

      // Refetch players to get updated roles
      const { data: updatedPlayersData } = await supabase
        .from('session_players')
        .select('*')
        .eq('session_id', session.id)
        .order('turn_order', { ascending: true });

      if (updatedPlayersData) {
        setPlayers(updatedPlayersData.map(mapPlayer));
        console.info('[startDealing] Players refetched with roles:', updatedPlayersData.length);
      }

      // For guess_player: pick target and update word
      let wordTextOverride = null;
      let clueTextOverride = null;

      if (variant === 'guess_player' && updatedPlayersData) {
        const nonTopoPlayers = updatedPlayersData.filter(p => p.role !== 'topo');
        if (nonTopoPlayers.length > 0) {
          const targetPlayer = nonTopoPlayers[Math.floor(Math.random() * nonTopoPlayers.length)];
          localStorage.setItem(`impostor:targetPlayerId:${session.id}`, targetPlayer.id);
          wordTextOverride = targetPlayer.display_name;
          clueTextOverride = "Describe a esta persona sin decir su nombre.";
          console.info('[startDealing] Target player for guess_player:', targetPlayer.display_name);
        }
      }

      // Update session status to 'dealing' (and word/clue for guess_player)
      const updateData: any = { status: 'dealing' };
      if (wordTextOverride) {
        updateData.word_text = wordTextOverride;
        updateData.clue_text = clueTextOverride;
      }

      const { data: updatedSessionData, error: updateError } = await supabase
        .from('game_sessions')
        .update(updateData)
        .eq('id', session.id)
        .select()
        .single();

      if (updateError) {
        console.error('[startDealing] Error updating session status:', updateError);
        setError('Error al iniciar el reparto');
        return false;
      }

      if (updatedSessionData) {
        setSession(mapSession(updatedSessionData));
        console.info('[startDealing] end - SUCCESS', {
          sessionId: session.id,
          status: updatedSessionData.status,
          variant,
        });
      }

      setDealingRequested(false);
      return true;

    } catch (e: any) {
      console.error('[startDealing] end - EXCEPTION:', e);
      setError(e.message || 'Error inesperado al iniciar el reparto');
      return false;
    } finally {
      setLoading(false);
    }
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

  // Computed: is the session ready for dealing?
  // minPlayers should be a constant (3), not maxPlayers
  const minPlayers = 3;

  const isReadyForDealing = Boolean(
    session &&
    !loading &&
    session.status === "lobby" &&
    players.length >= minPlayers &&
    session.wordText && // Word should be preloaded
    session.clueText    // Clue should be preloaded
  );


  return {
    session,
    players,
    loading,
    error,
    waitingForAssignment,
    dealingRequested,
    isReadyForDealing,
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
