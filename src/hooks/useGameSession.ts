import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

  const { isOnline } = useOnlineStatus();
  const { getRandomOfflineCard, hasOfflineData } = useOfflineCards();

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
    deceivedTopoPlayerId: data.deceived_topo_player_id,
    deceivedWordText: data.deceived_word_text,
    deceivedClueText: data.deceived_clue_text,
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
    if (!sessionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if offline session
      if (sessionId.startsWith('offline-')) {
        const storedSession = localStorage.getItem(`impostor:offline_session:${sessionId}`);
        const storedPlayers = localStorage.getItem(`impostor:offline_players:${sessionId}`);
        
        if (storedSession) {
          setSession(JSON.parse(storedSession));
          if (storedPlayers) {
            setPlayers(JSON.parse(storedPlayers));
          }
        } else {
          setError('Sesión offline no encontrada');
        }
        setLoading(false);
        return;
      }

      // Online: fetch from database
      const { data, error: fetchError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (fetchError || !data) {
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

  // Fisher-Yates shuffle
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const createSession = async (
    mode: GameMode,
    topoCount: number,
    hostUserId?: string,
    hostGuestId?: string,
    selectedPackIds?: string[],
    excludeCardId?: string
  ): Promise<GameSession | null> => {
    console.info('[createSession] Starting', { mode, topoCount, isOnline });

    if (!selectedPackIds || selectedPackIds.length === 0) {
      setError('No hay categorías seleccionadas');
      return null;
    }

    // OFFLINE MODE
    if (!isOnline) {
      if (!hasOfflineData()) {
        setError('Sin conexión y sin datos offline.');
        return null;
      }

      const offlineCard = getRandomOfflineCard(selectedPackIds, excludeCardId ? [excludeCardId] : []);
      if (!offlineCard) {
        setError('No hay palabras disponibles offline.');
        return null;
      }

      const offlineSession: GameSession = {
        id: `offline-${uuidv4()}`,
        hostUserId: hostUserId || null,
        hostGuestId: hostGuestId || null,
        mode,
        joinCode: null,
        status: 'lobby',
        topoCount,
        maxPlayers: null,
        packId: null,
        cardId: offlineCard.id,
        wordText: offlineCard.word,
        clueText: offlineCard.clue,
        selectedPackIds,
        firstSpeakerPlayerId: null,
        deceivedTopoPlayerId: null,
        deceivedWordText: null,
        deceivedClueText: null,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(`impostor:offline_session:${offlineSession.id}`, JSON.stringify(offlineSession));
      setSession(offlineSession);
      return offlineSession;
    }

    // ONLINE MODE - Simplified single query
    try {
      // Get all packs for the selected master categories
      const { data: packs } = await supabase
        .from('packs')
        .select('id')
        .in('master_category', selectedPackIds)
        .eq('is_active', true);

      const packIds = packs?.map(p => p.id) || [];
      
      if (packIds.length === 0) {
        setError('No hay packs activos para las categorías seleccionadas.');
        return null;
      }

      // Single query to get random card - limit to 100 and pick randomly client-side
      let query = supabase
        .from('cards')
        .select('id, word, clue')
        .in('pack_id', packIds)
        .eq('is_active', true)
        .limit(100);

      if (excludeCardId) {
        query = query.neq('id', excludeCardId);
      }

      const { data: cards, error: cardsError } = await query;

      if (cardsError || !cards || cards.length === 0) {
        setError('No hay palabras activas disponibles.');
        return null;
      }

      // Random selection client-side
      const randomCard = cards[Math.floor(Math.random() * cards.length)];
      console.info('[createSession] Card selected:', randomCard.word);

      // Create session
      const { data, error: insertError } = await supabase
        .from('game_sessions')
        .insert({
          mode: 'single',
          topo_count: topoCount,
          host_user_id: hostUserId || null,
          host_guest_id: hostGuestId || null,
          status: 'lobby',
          selected_pack_ids: selectedPackIds,
          card_id: randomCard.id,
          word_text: randomCard.word,
          clue_text: randomCard.clue,
        })
        .select()
        .single();

      if (insertError || !data) {
        console.error('[createSession] Insert error:', insertError);
        setError('Error al crear la partida.');
        return null;
      }

      const newSession = mapSession(data);
      setSession(newSession);
      return newSession;

    } catch (e: any) {
      console.error('[createSession] Exception:', e);
      setError('Error inesperado al crear partida.');
      return null;
    }
  };

  const startDealing = async (): Promise<boolean> => {
    if (!session || players.length === 0) {
      setError('Sesión o jugadores no cargados.');
      return false;
    }

    if (!session.wordText || !session.clueText) {
      setError('No hay palabra asignada.');
      return false;
    }

    const isOffline = session.id.startsWith('offline-');
    const variant = localStorage.getItem(`impostor:variant:${session.id}`) || 'classic';

    console.info('[startDealing] Starting', { variant, isOffline });

    try {
      const playerIds = players.map(p => p.id);
      const shuffledForRoles = shuffleArray(playerIds);
      const shuffledForTurnOrder = shuffleArray(playerIds);

      let effectiveTopoCount = session.topoCount;
      let deceivedTopoId: string | null = null;
      let deceivedWordText: string | null = null;
      let deceivedClueText: string | null = null;

      // Double topo variant
      if (variant === 'double_topo') {
        effectiveTopoCount = 1;
        const realTopoId = shuffledForRoles[0];
        const remainingForDeceived = shuffledForRoles.filter(id => id !== realTopoId);
        deceivedTopoId = remainingForDeceived[Math.floor(Math.random() * remainingForDeceived.length)];

        // Get alternative word
        const packIds = session.selectedPackIds || [];
        if (packIds.length > 0) {
          const altCard = getRandomOfflineCard(packIds, session.cardId ? [session.cardId] : []);
          if (altCard) {
            deceivedWordText = altCard.word;
            deceivedClueText = altCard.clue;
          } else {
            deceivedWordText = 'Objeto misterioso';
            deceivedClueText = 'Algo que no es lo que parece';
          }
        }
      }

      const topoIds = shuffledForRoles.slice(0, effectiveTopoCount);
      const randomFirstSpeaker = shuffleArray(playerIds)[0];

      // Handle guess_player variant
      let wordTextOverride = null;
      let clueTextOverride = null;

      if (variant === 'guess_player') {
        const nonTopoPlayers = players.filter(p => !topoIds.includes(p.id));
        if (nonTopoPlayers.length > 0) {
          const targetPlayer = nonTopoPlayers[Math.floor(Math.random() * nonTopoPlayers.length)];
          localStorage.setItem(`impostor:targetPlayerId:${session.id}`, targetPlayer.id);
          wordTextOverride = targetPlayer.displayName;
          clueTextOverride = "Describe a esta persona sin decir su nombre.";
        }
      }

      // Update players with roles
      const updatedPlayers: Player[] = shuffledForTurnOrder.map((playerId, i) => {
        const player = players.find(p => p.id === playerId)!;
        let role: string;
        
        if (variant === 'double_topo' && playerId === deceivedTopoId) {
          role = 'deceived_topo';
        } else if (topoIds.includes(playerId)) {
          role = 'topo';
        } else {
          role = 'crew';
        }

        return { ...player, role: role as any, turnOrder: i, hasRevealed: false };
      });

      updatedPlayers.sort((a, b) => (a.turnOrder || 0) - (b.turnOrder || 0));

      const updatedSession: GameSession = {
        ...session,
        status: 'dealing',
        firstSpeakerPlayerId: randomFirstSpeaker,
        wordText: wordTextOverride || session.wordText,
        clueText: clueTextOverride || session.clueText,
        deceivedTopoPlayerId: deceivedTopoId,
        deceivedWordText,
        deceivedClueText,
      };

      if (isOffline) {
        // Offline: update localStorage only
        localStorage.setItem(`impostor:offline_session:${session.id}`, JSON.stringify(updatedSession));
        localStorage.setItem(`impostor:offline_players:${session.id}`, JSON.stringify(updatedPlayers));
        setSession(updatedSession);
        setPlayers(updatedPlayers);
      } else {
        // Online: update database
        const updateData: any = {
          status: 'dealing',
          first_speaker_player_id: randomFirstSpeaker,
        };

        if (wordTextOverride) {
          updateData.word_text = wordTextOverride;
          updateData.clue_text = clueTextOverride;
        }

        if (variant === 'double_topo' && deceivedTopoId) {
          updateData.deceived_topo_player_id = deceivedTopoId;
          updateData.deceived_word_text = deceivedWordText;
          updateData.deceived_clue_text = deceivedClueText;
        }

        await supabase.from('game_sessions').update(updateData).eq('id', session.id);

        // Update players in parallel
        await Promise.all(
          updatedPlayers.map(p =>
            supabase.from('session_players').update({
              role: p.role,
              turn_order: p.turnOrder,
              has_revealed: false
            }).eq('id', p.id)
          )
        );

        setSession(updatedSession);
        setPlayers(updatedPlayers);
      }

      console.info('[startDealing] Success');
      return true;

    } catch (e: any) {
      console.error('[startDealing] Error:', e);
      setError(e.message || 'Error al iniciar el reparto');
      return false;
    }
  };

  const markPlayerRevealed = async (playerId: string): Promise<boolean> => {
    const isOffline = session?.id?.startsWith('offline-');

    const updatedPlayers = players.map(p =>
      p.id === playerId ? { ...p, hasRevealed: true } : p
    );
    setPlayers(updatedPlayers);

    if (isOffline) {
      localStorage.setItem(`impostor:offline_players:${session?.id}`, JSON.stringify(updatedPlayers));
    } else {
      await supabase.from('session_players').update({ has_revealed: true }).eq('id', playerId);
    }

    return true;
  };

  const finishDealing = async () => {
    if (!session) return;
    const isOffline = session.id.startsWith('offline-');

    const updatedSession = { ...session, status: 'finished' as const };
    setSession(updatedSession);

    if (isOffline) {
      localStorage.setItem(`impostor:offline_session:${session.id}`, JSON.stringify(updatedSession));
    } else {
      await supabase.from('game_sessions').update({ status: 'finished' }).eq('id', session.id);
    }
  };

  const isReadyForDealing = Boolean(
    session &&
    !loading &&
    session.status === 'lobby' &&
    players.length >= 3 &&
    session.wordText &&
    session.clueText
  );

  return {
    session,
    players,
    loading,
    error,
    isReadyForDealing,
    createSession,
    startDealing,
    markPlayerRevealed,
    finishDealing,
    refetch: fetchSession,
    firstSpeakerPlayerId: session?.firstSpeakerPlayerId,
  };
}
