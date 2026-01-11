import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameSession, Player, GameMode, GameStatus } from '@/types/game';
import { useOfflineCards } from './useOfflineCards';
import { useOnlineStatus } from './useOnlineStatus';
import { v4 as uuidv4 } from 'uuid';

interface UseGameSessionOptions {
  sessionId?: string;
}

export function useGameSession({ sessionId }: UseGameSessionOptions = {}) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waitingForAssignment, setWaitingForAssignment] = useState(false);
  const [dealingRequested, setDealingRequested] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Offline support
  const { isOnline } = useOnlineStatus();
  const { getRandomOfflineCard, hasOfflineData } = useOfflineCards();

  // Local phase state for non-persisted phases (e.g. discussion)
  const [localPhase, setLocalPhase] = useState<GameStatus>('lobby');
  const [localFirstSpeakerId, setLocalFirstSpeakerId] = useState<string | null>(null);

  const mapSession = (data: any): GameSession => ({
    id: data.id,
    hostUserId: data.host_user_id,
    hostGuestId: data.host_guest_id,
    mode: 'single', // Always single mode now
    status: data.status,
    topoCount: data.topo_count,
    maxPlayers: data.max_players,
    packId: data.pack_id,
    cardId: data.card_id,
    wordText: data.word_text,
    clueText: data.clue_text,
    selectedPackIds: data.selected_pack_ids,
    firstSpeakerPlayerId: data.first_speaker_player_id,
    deceivedTopoPlayerId: data.deceived_topo_player_id,
    deceivedWordText: data.deceived_word_text,
    deceivedClueText: data.deceived_clue_text,
    cluesEnabled: data.clues_enabled,
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
      // Check if this is an offline session
      if (sessionId?.startsWith('offline-')) {
        console.info('[fetchSession] Loading offline session:', sessionId);
        const storedSession = localStorage.getItem(`impostor:offline_session:${sessionId}`);
        const storedPlayers = localStorage.getItem(`impostor:offline_players:${sessionId}`);

        if (storedSession) {
          setSession(JSON.parse(storedSession));
          if (storedPlayers) {
            setPlayers(JSON.parse(storedPlayers));
          }
          setLoading(false);
          return;
        } else {
          setError('Sesión offline no encontrada');
          setLoading(false);
          return;
        }
      }

      // Online mode: fetch from database
      let query = supabase.from('game_sessions').select('*');

      if (sessionId) {
        query = query.eq('id', sessionId);
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
  }, [sessionId]);

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
    selectedPackIds?: string[],
    excludeCardId?: string, // Card ID to exclude from random selection (previous game's card)
    cluesEnabled: boolean = true
  ): Promise<GameSession | null> => {
    console.info('[createSession] Creating session', {
      mode,
      topoCount,
      packCount: selectedPackIds?.length || 0,
      excludeCardId: excludeCardId || 'none',
      cluesEnabled,
      isOnline
    });

    // Validate pack selection
    if (!selectedPackIds || selectedPackIds.length === 0) {
      console.error('[createSession] Step 1 FAIL: No pack_ids provided');
      setError('No hay categorías seleccionadas');
      return null;
    }

    // LOCAL-FIRST MODE: Always use local data if available (instant, no latency)
    // This ensures single-player games are always fast, regardless of internet
    if (hasOfflineData()) {
      console.info('[createSession] 🚀 LOCAL-FIRST MODE: Using cached data for instant game...');

      const offlineCard = getRandomOfflineCard(selectedPackIds, excludeCardId);

      if (!offlineCard) {
        console.warn('[createSession] LOCAL-FIRST: No cards for selected packs, trying sync...');
        // No cards for these packs - might need fresh sync
        // Fall through to online mode below
      } else {
        console.info('[createSession] 🚀 LOCAL Card selected:', {
          word: offlineCard.word,
          cardId: offlineCard.id,
          masterCategory: offlineCard.master_category
        });

        // Convert master_category to readable text for fallback clue
        const categoryDisplayNames: Record<string, string> = {
          'general': 'General',
          'benicolet': 'Benicolet',
          'terreta': 'De la terreta',
          'picantes': 'Picantes'
        };
        const categoryText = offlineCard.master_category
          ? categoryDisplayNames[offlineCard.master_category] || offlineCard.master_category
          : null;

        // Create local session object (not persisted to database)
        const localSession: GameSession = {
          id: `offline-${uuidv4()}`,
          hostUserId: hostUserId || null,
          hostGuestId: hostGuestId || null,
          mode: 'single',
          status: 'lobby',
          topoCount,
          maxPlayers: null,
          packId: null,
          cardId: offlineCard.id,
          wordText: offlineCard.word,
          clueText: offlineCard.clue,
          categoryText,
          selectedPackIds,
          firstSpeakerPlayerId: null,
          deceivedTopoPlayerId: null,
          deceivedWordText: null,
          deceivedClueText: null,
          cluesEnabled: cluesEnabled,
          createdAt: new Date().toISOString(),
        };

        // Store local session in localStorage for game page to retrieve
        localStorage.setItem(`impostor:offline_session:${localSession.id}`, JSON.stringify(localSession));

        setSession(localSession);
        return localSession;
      }
    }

    // NO LOCAL DATA: Need to sync or show error
    if (!isOnline) {
      console.error('[createSession] OFFLINE but no local data');
      setError('Sin conexión y sin datos offline. Sincroniza palabras cuando tengas conexión.');
      return null;
    }

    // ONLINE FALLBACK: Original database flow (only when no local data)
    // Step 1: Get random card (Chunked Search / Optimised Count-Offset Strategy)
    console.info('[createSession] Step 1: Getting random card from server (no local data)...');

    let randomCard: { id: string; word: string; clue: string; pack_id: string; packs?: { master_category: string | null } } | null = null;
    let totalCandidateCount = 0;
    let excludedPrevious = false;

    try {
      // Shuffle pack IDs to ensure randomness across all selected packs
      const shuffledPacks = [...selectedPackIds].sort(() => Math.random() - 0.5);

      // Process in chunks of 50
      const CHUNK_SIZE = 50;
      let candidatesFound = false;

      for (let i = 0; i < shuffledPacks.length; i += CHUNK_SIZE) {
        const chunk = shuffledPacks.slice(i, i + CHUNK_SIZE);
        console.info(`[createSession] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(shuffledPacks.length / CHUNK_SIZE)} (${chunk.length} packs)`);

        // Build query - exclude previous card if provided and there are alternatives
        let countQuery = supabase
          .from('cards')
          .select('id', { count: 'exact', head: true })
          .in('pack_id', chunk)
          .neq('is_active', false);

        const { count: totalCount, error: totalCountError } = await countQuery;

        if (totalCountError) {
          console.warn('[createSession] Error counting chunk:', totalCountError);
          continue;
        }

        if (!totalCount || totalCount === 0) {
          continue;
        }

        totalCandidateCount += totalCount;

        // Check if we should exclude the previous card
        let effectiveCount = totalCount;
        let shouldExcludePrevious = false;

        if (excludeCardId && totalCount > 1) {
          // Check if the previous card is in this chunk
          const { count: prevCardInChunk } = await supabase
            .from('cards')
            .select('id', { count: 'exact', head: true })
            .eq('id', excludeCardId)
            .in('pack_id', chunk)
            .neq('is_active', false);

          if (prevCardInChunk && prevCardInChunk > 0) {
            shouldExcludePrevious = true;
            effectiveCount = totalCount - 1;
            excludedPrevious = true;
            console.info('[createSession] Will exclude previous card from selection', {
              excludeCardId,
              totalCount,
              effectiveCount
            });
          }
        }

        if (effectiveCount > 0) {
          candidatesFound = true;
          console.info(`[createSession] Found ${effectiveCount} active candidates in this chunk (excluding previous: ${shouldExcludePrevious})`);

          // Select from this chunk
          // Retry loop for robustness
          let attempts = 0;
          const MAX_ATTEMPTS = 5;

          while (!randomCard && attempts < MAX_ATTEMPTS) {
            attempts++;
            const randomOffset = Math.floor(Math.random() * effectiveCount);

            let fetchQuery = supabase
              .from('cards')
              .select('id, word, clue, pack_id, packs(master_category)')
              .in('pack_id', chunk)
              .neq('is_active', false);

            // Exclude previous card if applicable
            if (shouldExcludePrevious && excludeCardId) {
              fetchQuery = fetchQuery.neq('id', excludeCardId);
            }

            const { data, error: fetchError } = await fetchQuery
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

    // Diagnostic logging
    console.info('[createSession] 🎲 Card selection diagnostic:', {
      previousCardId: excludeCardId || 'none',
      newCardId: randomCard.id,
      candidateCount: totalCandidateCount,
      excludedPrevious,
      newWord: randomCard.word
    });

    console.info('[createSession] Card selected:', { word: randomCard.word, packId: randomCard.pack_id });

    // Step 2: Create session with preloaded word
    console.info('[createSession] Step 2: Creating game_session...');

    const { data, error: insertError } = await supabase
      .from('game_sessions')
      .insert({
        mode: 'single',
        topo_count: topoCount,
        join_code: null,
        host_user_id: hostUserId || null,
        host_guest_id: hostGuestId || null,
        status: 'lobby',
        selected_pack_ids: selectedPackIds || null, // We keep original selection in DB for reference
        card_id: randomCard.id,
        word_text: randomCard.word,
        clue_text: randomCard.clue,
        clues_enabled: cluesEnabled,
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

    // Convert master_category to readable text for fallback clue
    const categoryDisplayNames: Record<string, string> = {
      'general': 'General',
      'benicolet': 'Benicolet',
      'terreta': 'De la terreta',
      'picantes': 'Picantes'
    };
    const masterCategory = randomCard.packs?.master_category;
    const categoryText = masterCategory
      ? categoryDisplayNames[masterCategory] || masterCategory
      : null;

    const newSession: GameSession = {
      ...mapSession(data),
      categoryText: categoryText || undefined
    };
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
      const isOfflineSession = session.id.startsWith('offline-');
      console.info('[startDealing] Variant:', variant, 'Offline:', isOfflineSession);

      // TRUE RANDOM: Fisher-Yates shuffle for unbiased randomization
      const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      };

      // Shuffle player IDs for truly random topo selection (no turn_order bias)
      const playerIds = players.map(p => p.id);
      const shuffledForRoles = shuffleArray(playerIds);

      // Determine topo count based on variant
      let effectiveTopoCount = session.topoCount;
      let deceivedWordText: string | null = null;
      let deceivedClueText: string | null = null;
      let allToposDeceived = false; // For misterioso mode

      if (variant === 'caos') {
        // CAOS: Random topo count from 1 to all players
        effectiveTopoCount = Math.floor(Math.random() * players.length) + 1;
        console.info('[startDealing] CAOS mode - random topo count:', effectiveTopoCount);
      } else if (variant === 'misterioso') {
        // MISTERIOSO: All topos don't know they are topos (get different word)
        allToposDeceived = true;
        console.info('[startDealing] MISTERIOSO mode - all topos will be deceived');

        // Get alternative word for deceived topos
        const packIds = session.selectedPackIds || [];
        if (packIds.length > 0) {
          const shuffledPacks = shuffleArray(packIds);

          for (const packChunk of [shuffledPacks.slice(0, 50)]) {
            const { count } = await supabase
              .from('cards')
              .select('id', { count: 'exact', head: true })
              .in('pack_id', packChunk)
              .neq('is_active', false)
              .neq('id', session.cardId || '');

            if (count && count > 0) {
              const randomOffset = Math.floor(Math.random() * count);
              const { data: altCard } = await supabase
                .from('cards')
                .select('word, clue')
                .in('pack_id', packChunk)
                .neq('is_active', false)
                .neq('id', session.cardId || '')
                .range(randomOffset, randomOffset)
                .maybeSingle();

              if (altCard) {
                deceivedWordText = altCard.word;
                deceivedClueText = altCard.clue;
                console.info('[startDealing] Alternative word for misterioso:', deceivedWordText);
                break;
              }
            }
          }

          if (!deceivedWordText) {
            deceivedWordText = 'Objeto misterioso';
            deceivedClueText = 'Algo que no es lo que parece';
            console.warn('[startDealing] No alt word found, using fallback');
          }
        }
      }

      const topoIds = shuffledForRoles.slice(0, effectiveTopoCount);

      // Shuffle players again for turn order (independent randomization)
      const shuffledForTurnOrder = shuffleArray(playerIds);

      // Update players with roles and randomized turn order
      const updatedPlayersLocal: Player[] = [];
      for (let i = 0; i < players.length; i++) {
        const playerId = shuffledForTurnOrder[i];
        const player = players.find(p => p.id === playerId)!;

        let role: string;
        if (topoIds.includes(playerId)) {
          // In misterioso mode, ALL topos are deceived (they don't know they're topos)
          role = allToposDeceived ? 'deceived_topo' : 'topo';
        } else {
          role = 'crew';
        }

        if (isOfflineSession) {
          // Offline: update local player object
          updatedPlayersLocal.push({ ...player, role: role as any, turnOrder: i, hasRevealed: false });
        } else {
          // Online: update database
          await supabase
            .from('session_players')
            .update({ role, turn_order: i, has_revealed: false })
            .eq('id', playerId);
        }
      }

      // Refetch players to get updated roles with new turn order
      if (isOfflineSession) {
        // Offline: sort and set local players
        updatedPlayersLocal.sort((a, b) => (a.turnOrder || 0) - (b.turnOrder || 0));
        setPlayers(updatedPlayersLocal);
        localStorage.setItem(`impostor:offline_players:${session.id}`, JSON.stringify(updatedPlayersLocal));
        console.info('[startDealing] OFFLINE Players updated:', updatedPlayersLocal.length);
      } else {
        const { data: updatedPlayersData } = await supabase
          .from('session_players')
          .select('*')
          .eq('session_id', session.id)
          .order('turn_order', { ascending: true });

        if (updatedPlayersData) {
          setPlayers(updatedPlayersData.map(mapPlayer));
          console.info('[startDealing] Players refetched with roles:', updatedPlayersData.length);
        }
      }

      // TRUE RANDOM first speaker: pick from all players randomly (not by turn_order)
      const randomFirstSpeaker = shuffleArray(playerIds)[0];
      console.info('[startDealing] Random first speaker:', randomFirstSpeaker);

      const currentPlayers = isOfflineSession ? updatedPlayersLocal : players;

      // Update session status to 'dealing' with all persisted data
      const updateData: any = {
        status: 'dealing',
        first_speaker_player_id: randomFirstSpeaker,
      };

      // Persist misterioso data for stability on reload (all topos see this word)
      if (variant === 'misterioso' && deceivedWordText) {
        updateData.deceived_word_text = deceivedWordText;
        updateData.deceived_clue_text = deceivedClueText;
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
        setLocalFirstSpeakerId(randomFirstSpeaker);
        console.info('[startDealing] end - SUCCESS', {
          sessionId: session.id,
          status: updatedSessionData.status,
          variant,
          firstSpeaker: randomFirstSpeaker,
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
  // Uses persisted first_speaker_player_id for stability on reload
  const continueToDiscussion = async (): Promise<boolean> => {
    if (!session) {
      console.error('[continueToDiscussion] No session');
      return false;
    }

    // Use the persisted first speaker from database (set during startDealing)
    const firstSpeakerId = session.firstSpeakerPlayerId || players[0]?.id;

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

    // Handle offline sessions
    if (session.id.startsWith('offline-')) {
      console.info('[resetGame] Clearing offline session:', session.id);
      localStorage.removeItem(`impostor:offline_session:${session.id}`);
      localStorage.removeItem(`impostor:offline_players:${session.id}`);
      localStorage.removeItem(`impostor:variant:${session.id}`);
      localStorage.removeItem(`impostor:targetPlayerId:${session.id}`);
      setSession(null);
      setPlayers([]);
      return;
    }

    // Reset players (online)
    await supabase
      .from('session_players')
      .update({ role: null, has_revealed: false })
      .eq('session_id', session.id);

    // Reset session - clear all game-specific data including double_topo fields
    await supabase
      .from('game_sessions')
      .update({
        status: 'lobby',
        card_id: null,
        word_text: null,
        clue_text: null,
        first_speaker_player_id: null,
        deceived_topo_player_id: null,
        deceived_word_text: null,
        deceived_clue_text: null,
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


