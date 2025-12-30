import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
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
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Local phase state for non-persisted phases (e.g. discussion)
  const [localPhase, setLocalPhase] = useState<GameStatus>('lobby');
  const [localFirstSpeakerId, setLocalFirstSpeakerId] = useState<string | null>(null);

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
    firstSpeakerPlayerId: data.first_speaker_player_id,
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

  // Sync local phase with DB status when it changes (only for persisted phases)
  // FIXED: Removed dependency on localPhase to satisfy linter and avoid stale closures
  useEffect(() => {
    if (session?.status) {
      setLocalPhase(prevPhase => {
        // If DB status is finished, always respect it
        if (session.status === 'finished' || session.status === 'closed') {
          return session.status;
        }
        // If we are currently in a lobby/dealing/ready state in DB, sync it
        // UNLESS we are in 'discussion' locally and DB is still sticking to 'dealing'
        if (prevPhase === 'discussion') {
          return prevPhase; // Keep discussion
        }
        // Otherwise sync
        return session.status;
      });
    }
  }, [session?.status]);

  // Realtime subscription
  useEffect(() => {
    if (!session?.id) return;

    console.info('[realtime] Setting up subscription for session:', session.id);

    console.info('[realtime] Setting up subscription for session:', session.id);

    const sessionChannel = supabase
      .channel(`session-${session.id}`);

    channelRef.current = sessionChannel;

    sessionChannel
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
          console.info('[realtime] session_players payload:', payload.eventType, {
            playerId: (payload.new as any)?.id,
            hasRevealed: (payload.new as any)?.has_revealed,
          });
          // Refetch players on any change
          supabase
            .from('session_players')
            .select('*')
            .eq('session_id', session.id)
            .order('turn_order', { ascending: true })
            .then(({ data }) => {
              const mapped = (data || []).map(mapPlayer);
              // Use functional update to ensure we have latest players
              setPlayers(mapped);
            });
        }
      )
      // Broadcast channel for phase synchronization (non-persisted phases)
      .on('broadcast', { event: 'phase_change' }, ({ payload }) => {
        console.info('[realtime] phase_change received:', payload);
        if (payload.phase) {
          setLocalPhase(payload.phase);
        }
        if (payload.firstSpeakerPlayerId) {
          setLocalFirstSpeakerId(payload.firstSpeakerPlayerId);
        }
      })
      .on('broadcast', { event: 'phase_sync_request' }, async ({ payload }) => {
        console.info('[realtime] phase_sync_request received:', payload);
        // If I am host, respond with my current state
        // We check current user against session host
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;
        // Host check: user ID matches hostUserId OR local memory says I'm guest host
        const isHost = (currentUserId && session.hostUserId === currentUserId) ||
          (!currentUserId && typeof window !== 'undefined' && localStorage.getItem('impostor_guest_id') === session.hostGuestId);

        if (isHost && localPhase === 'discussion') {
          console.info('[realtime] Responding to sync request as host');
          await sessionChannel.send({
            type: 'broadcast',
            event: 'phase_sync_state',
            payload: {
              phase: localPhase,
              firstSpeakerPlayerId: localFirstSpeakerId
            }
          });
        }
      })
      .on('broadcast', { event: 'phase_sync_state' }, ({ payload }) => {
        console.info('[realtime] phase_sync_state received:', payload);
        if (payload.phase) setLocalPhase(payload.phase);
        if (payload.firstSpeakerPlayerId) setLocalFirstSpeakerId(payload.firstSpeakerPlayerId);
      })
      .subscribe((status) => {
        console.info('[realtime] subscribed, status:', status);
        if (status === 'SUBSCRIBED') {
          // Request sync when connected
          sessionChannel.send({
            type: 'broadcast',
            event: 'phase_sync_request',
            payload: { ts: Date.now() }
          });
        }
      });

    return () => {
      console.info('[realtime] Unsubscribing from session:', session.id);
      channelRef.current = null;
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
    console.info('[createSession] Creating session', { mode, topoCount, packCount: selectedPackIds?.length || 0 });

    // Validate pack selection
    if (!selectedPackIds || selectedPackIds.length === 0) {
      console.error('[createSession] Step 1 FAIL: No pack_ids provided');
      setError('No hay categorías seleccionadas');
      return null;
    }

    // Step 1: Get random card (Chunked Search / Optimised Count-Offset Strategy)
    // We shuffle packs and process in chunks to avoid URL length issues (414) with many packs
    console.info('[createSession] Step 1: Getting random card (Chunked Strategy)...');

    let randomCard: { id: string; word: string; clue: string; pack_id: string } | null = null;

    try {
      // Shuffle pack IDs to ensure randomness across all selected packs
      const shuffledPacks = [...selectedPackIds].sort(() => Math.random() - 0.5);

      // Process in chunks of 50
      const CHUNK_SIZE = 50;
      let candidatesFound = false;

      for (let i = 0; i < shuffledPacks.length; i += CHUNK_SIZE) {
        const chunk = shuffledPacks.slice(i, i + CHUNK_SIZE);
        console.info(`[createSession] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(shuffledPacks.length / CHUNK_SIZE)} (${chunk.length} packs)`);

        // Check active cards in this chunk
        const { count, error: countError } = await supabase
          .from('cards')
          .select('id', { count: 'exact', head: true })
          .in('pack_id', chunk)
          .neq('is_active', false);

        if (countError) {
          console.warn('[createSession] Error counting chunk:', countError);
          continue;
        }

        if (count && count > 0) {
          candidatesFound = true;
          console.info(`[createSession] Found ${count} active candidates in this chunk`);

          // Select from this chunk
          // Retry loop for robustness
          let attempts = 0;
          const MAX_ATTEMPTS = 3;

          while (!randomCard && attempts < MAX_ATTEMPTS) {
            attempts++;
            const randomOffset = Math.floor(Math.random() * count);

            const { data, error: fetchError } = await supabase
              .from('cards')
              .select('id, word, clue, pack_id')
              .in('pack_id', chunk)
              .neq('is_active', false)
              .range(randomOffset, randomOffset)
              .maybeSingle();

            if (fetchError) {
              console.warn(`[createSession] Fetch error at offset ${randomOffset}:`, fetchError);
              continue;
            }

            if (data) {
              randomCard = data;
              break; // Found one!
            }
          }

          if (randomCard) break; // Use the card we found
        }
      }

      if (!candidatesFound) {
        console.warn('[createSession] No candidates found in ANY chunk');
        setError('No hay palabras activas en las categorías seleccionadas.');
        return null;
      }

    } catch (e: any) {
      console.error('[createSession] Step 1 EXCEPTION:', e);
      setError(`Error inesperado al obtener carta: ${e.message}`);
      return null;
    }

    if (!randomCard) {
      console.error('[createSession] Step 1 FAIL: randomCard is null after search');
      setError('Error al seleccionar una palabra aleatoria. Por favor, inténtalo de nuevo.');
      return null;
    }

    console.info('[createSession] Card selected:', { word: randomCard.word, packId: randomCard.pack_id });

    // Step 2: Create session with preloaded word
    console.info('[createSession] Step 2: Creating game_session...');

    // Safety check for mode
    const finalMode = (mode === 'single' || mode === 'multi') ? mode : 'multi';
    const joinCodeValue = finalMode === 'multi' ? generateJoinCode() : null;

    const { data, error: insertError } = await supabase
      .from('game_sessions')
      .insert({
        mode: finalMode,
        topo_count: topoCount,
        join_code: joinCodeValue,
        host_user_id: hostUserId || null,
        host_guest_id: hostGuestId || null,
        status: 'lobby',
        selected_pack_ids: selectedPackIds || null, // We keep original selection in DB for reference
        card_id: randomCard.id,
        word_text: randomCard.word,
        clue_text: randomCard.clue,
      })
      .select()
      .single();

    if (insertError || !data) {
      console.error('[createSession] Step 2 FAIL: Insert error', insertError);
      setError(`Error al crear la partida: ${insertError?.message || 'Sin datos'}`);
      return null;
    }

    console.info('[createSession] Step 2 OK: Session created', {
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

  const markPlayerRevealed = async (playerId: string): Promise<boolean> => {
    console.info('[markPlayerRevealed] Starting', { playerId, sessionId: session?.id });

    try {
      const { error } = await supabase
        .from('session_players')
        .update({ has_revealed: true })
        .eq('id', playerId);

      if (error) {
        console.error('[markPlayerRevealed] Error:', error);
        return false;
      }

      console.info('[markPlayerRevealed] OK', { playerId });

      // Optimistically update local state
      setPlayers(prev =>
        prev.map(p =>
          p.id === playerId ? { ...p, hasRevealed: true } : p
        )
      );

      return true;
    } catch (e) {
      console.error('[markPlayerRevealed] Exception:', e);
      return false;
    }
  };

  const finishDealing = async () => {
    if (!session) return;

    await supabase
      .from('game_sessions')
      .update({ status: 'finished' })
      .eq('id', session.id);
  };

  // Transition to discussion phase (host only for multiplayer)
  // UPDATED: Uses Realtime Broadcast instead of DB Update to avoid migration reqs
  const continueToDiscussion = async (): Promise<boolean> => {
    if (!session) {
      console.error('[continueToDiscussion] No session');
      return false;
    }

    // Determine first speaker (first in turn order or random)
    let firstSpeakerId = players[0]?.id;
    // Try to pick non-topo if possible, or just random
    const nonTopos = players.filter(p => p.role !== 'topo');
    if (nonTopos.length > 0) {
      const randomStart = Math.floor(Math.random() * nonTopos.length);
      firstSpeakerId = nonTopos[randomStart].id;
    }

    console.info('[continueToDiscussion] Broadcasting discussion phase...', {
      sessionId: session.id,
      firstSpeakerId
    });

    // Update local state immediately
    setLocalPhase('discussion' as any);
    setLocalFirstSpeakerId(firstSpeakerId);

    try {
      // Send broadcast using existing channel
      if (!channelRef.current) {
        throw new Error("No hay conexión en tiempo real. Recarga la página.");
      }

      await channelRef.current.send({
        type: 'broadcast',
        event: 'phase_change',
        payload: {
          phase: 'discussion',
          firstSpeakerPlayerId: firstSpeakerId
        }
      });
      return true;
    } catch (e: any) {
      console.error('[continueToDiscussion] Exception sending broadcast', e);
      setError(`Error de conexión: ${e.message}`);
      return false;
    }
  };

  // Finish the game
  const finishGame = async () => {
    if (!session) return;

    // Broadcast reveal first for immediate UI
    setLocalPhase('finished');

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'phase_change',
        payload: { phase: 'finished' }
      });
    } else {
      console.warn('[finishGame] No active channel to broadcast finish');
    }

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
        card_id: null,
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
    continueToDiscussion,
    finishGame,
    resetGame,
    refetch: fetchSession,
    phase: localPhase, // Export local phase
    firstSpeakerPlayerId: localFirstSpeakerId || session?.firstSpeakerPlayerId // Prefer local if available (since DB might not have it)
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
