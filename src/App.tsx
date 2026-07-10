import React, { useState, useEffect, useCallback } from 'react';
import { Song, Rating, AppPhase, QuestionnaireData, Phase2Song } from './types';
import { SongCard } from './components/SongCard';
import { ProgressBar } from './components/ProgressBar';
import { ChoiceScreen } from './components/ChoiceScreen';
import { CompletionScreen } from './components/CompletionScreen';
import { IntroScreen } from './components/IntroScreen';
import { Phase2CompletionModal } from './components/Phase2CompletionModal';
import { QuestionnaireScreen } from './components/QuestionnaireScreen';
import { recommenderService } from './services/recommenderService';
import { supabase, getAudioUrl, getAlbumImageUrl } from './lib/supabase';
import { Music, Loader2, AlertCircle } from 'lucide-react';

const SESSION_STORAGE_KEY = 'musicrate_session';

interface SessionState {
  sessionId: string;
  phase: AppPhase;
  ratings: Rating[];
  sessionStartTime: number;
}

const saveSessionToStorage = (state: SessionState) => {
  try { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state)); } catch {}
};
const loadSessionFromStorage = (): SessionState | null => {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};
const clearSessionFromStorage = () => {
  try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
};

function App() {
  const [phase, setPhase] = useState<AppPhase>('intro');
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [currentSongs, setCurrentSongs] = useState<Song[]>([]);
  const [phase2Songs, setPhase2Songs] = useState<Phase2Song[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [loadingSongs, setLoadingSongs] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPhase2Modal, setShowPhase2Modal] = useState<boolean>(false);
  const [showFinishButton, setShowFinishButton] = useState<boolean>(false);
  const [incompleteRatings, setIncompleteRatings] = useState<string[]>([]);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(true);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState<boolean>(false);

  // Restore session
  useEffect(() => {
    const restore = async () => {
      const saved = loadSessionFromStorage();
      if (saved && saved.sessionId && saved.phase !== 'intro') {
        setSessionId(saved.sessionId);
        setPhase(saved.phase);
        setRatings(saved.ratings);
        setSessionStartTime(saved.sessionStartTime);
        if (saved.phase === 'initial') {
          await loadPhase1Songs(saved.sessionId);
        } else if (saved.phase === 'recommendation') {
          await loadPhase2Songs(saved.sessionId);
        }
      }
      setIsRestoringSession(false);
    };
    restore();
  }, []);

  // Persist session state
  useEffect(() => {
    if (!isRestoringSession && sessionId && phase !== 'intro') {
      saveSessionToStorage({ sessionId, phase, ratings, sessionStartTime });
    }
  }, [sessionId, phase, ratings, sessionStartTime, isRestoringSession]);

  const initializeSession = async (): Promise<string> => {
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { data, error } = await supabase
      .from('user_sessions')
      .insert({ user_id: userId, phase: 'initial', start_time: new Date().toISOString() })
      .select()
      .single();

    if (error || !data) {
      const localId = `local_${Date.now()}`;
      setSessionId(localId);
      return localId;
    }

    setSessionId(data.id);
    setSessionStartTime(Date.now());
    return data.id;
  };

  const recordPhaseTransition = async (from: string, to: string) => {
    if (!sessionId || sessionId.startsWith('local_')) return;
    await supabase.from('phase_transitions').insert({
      session_id: sessionId,
      from_phase: from,
      to_phase: to,
      timestamp: new Date().toISOString()
    });
  };

  const updateSessionPhase = async (newPhase: string) => {
    if (!sessionId || sessionId.startsWith('local_')) return;
    const updateData: Record<string, string> = { phase: newPhase };
    const ts = new Date().toISOString();
    const key = `${newPhase}_start_time`;
    if (['intro', 'initial', 'choice', 'recommendation', 'questionnaire'].includes(newPhase)) {
      updateData[key] = ts;
    }
    await supabase.from('user_sessions').update(updateData).eq('id', sessionId);
  };

  const loadPhase1Songs = async (sid: string) => {
    setLoadingSongs(true);
    setErrorMsg(null);
    try {
      // Check if songs were already selected for this session
      const { data: existing } = await supabase
        .from('session_phase1_songs')
        .select('spotify_track_id, is_attention_check, position')
        .eq('session_id', sid)
        .order('position', { ascending: true });

      let audioRows: { spotify_track_id: string; song: string; artist: string; album_name: string }[];

      if (existing && existing.length > 0) {
        // Session already has songs selected -- fetch metadata for them
        const realIds = existing.filter(e => !e.is_attention_check).map(e => e.spotify_track_id);
        const { data: meta, error: metaErr } = await supabase
          .from('audio_list')
          .select('spotify_track_id, song, artist, album_name')
          .in('spotify_track_id', realIds);
        if (metaErr) throw metaErr;

        const metaMap = new Map((meta || []).map(m => [m.spotify_track_id, m]));
        const songs: Song[] = existing.map(item => {
          if (item.is_attention_check) {
            return {
              spotify_track_id: 'attention_check',
              song: 'Attention Check',
              artist: 'Please do not rate this',
              album_name: '',
              is_attention_check: true,
              audioUrl: getAudioUrl('attention_check'),
              imageUrl: getAlbumImageUrl('attention_check'),
            };
          }
          const m = metaMap.get(item.spotify_track_id);
          return {
            spotify_track_id: item.spotify_track_id,
            song: m?.song || 'Unknown',
            artist: m?.artist || 'Unknown',
            album_name: m?.album_name || '',
            is_attention_check: false,
            audioUrl: getAudioUrl(item.spotify_track_id),
            imageUrl: getAlbumImageUrl(item.spotify_track_id),
          };
        });
        setCurrentSongs(songs);
        return;
      }

      // Fresh selection: fetch all songs from audio_list and sample 20 weighted by rating_count
      const { data: allSongs, error: fetchErr } = await supabase
        .from('audio_list')
        .select('spotify_track_id, song, artist, album_name, rating_count');
      if (fetchErr) throw fetchErr;
      if (!allSongs || allSongs.length === 0) {
        setErrorMsg('No songs available in the catalog.');
        return;
      }

      // Weighted random sampling: probability proportional to rating_count
      const selected: typeof allSongs = [];
      const pool = [...allSongs];
      const sampleSize = Math.min(20, pool.length);

      for (let i = 0; i < sampleSize; i++) {
        const totalWeight = pool.reduce((sum, s) => sum + (s.rating_count || 1), 0);
        let r = Math.random() * totalWeight;
        let idx = 0;
        for (let j = 0; j < pool.length; j++) {
          r -= (pool[j].rating_count || 1);
          if (r <= 0) { idx = j; break; }
        }
        selected.push(pool[idx]);
        pool.splice(idx, 1);
      }

      // Insert attention check at a random position between index 5 and 16
      const attentionPos = 5 + Math.floor(Math.random() * Math.min(12, selected.length - 4));

      // Build the final song list with attention check inserted
      const songs: Song[] = [];
      const recordsToInsert: { session_id: string; spotify_track_id: string; position: number; is_attention_check: boolean }[] = [];
      let position = 1;

      for (let i = 0; i < selected.length; i++) {
        if (i === attentionPos) {
          songs.push({
            spotify_track_id: 'attention_check',
            song: 'Attention Check',
            artist: 'Please do not rate this',
            album_name: '',
            is_attention_check: true,
            audioUrl: getAudioUrl('attention_check'),
            imageUrl: getAlbumImageUrl('attention_check'),
          });
          recordsToInsert.push({ session_id: sid, spotify_track_id: 'attention_check', position, is_attention_check: true });
          position++;
        }

        const s = selected[i];
        songs.push({
          spotify_track_id: s.spotify_track_id,
          song: s.song,
          artist: s.artist,
          album_name: s.album_name,
          is_attention_check: false,
          audioUrl: getAudioUrl(s.spotify_track_id),
          imageUrl: getAlbumImageUrl(s.spotify_track_id),
        });
        recordsToInsert.push({ session_id: sid, spotify_track_id: s.spotify_track_id, position, is_attention_check: false });
        position++;
      }

      // If attention check wasn't inserted yet (edge case), append at end
      if (!songs.some(s => s.is_attention_check)) {
        songs.push({
          spotify_track_id: 'attention_check',
          song: 'Attention Check',
          artist: 'Please do not rate this',
          album_name: '',
          is_attention_check: true,
          audioUrl: getAudioUrl('attention_check'),
          imageUrl: getAlbumImageUrl('attention_check'),
        });
        recordsToInsert.push({ session_id: sid, spotify_track_id: 'attention_check', position, is_attention_check: true });
      }

      // Persist selection for session recovery
      if (!sid.startsWith('local_')) {
        await supabase.from('session_phase1_songs').insert(recordsToInsert);
      }

      setCurrentSongs(songs);
    } catch (error: any) {
      console.error('Error loading Phase 1 songs:', error);
      setErrorMsg(`Failed to load songs: ${error.message || 'Unknown error'}`);
    } finally {
      setLoadingSongs(false);
    }
  };

  const loadPhase2Songs = async (sid: string) => {
    setLoadingSongs(true);
    setErrorMsg(null);
    try {
      const { data: recs, error } = await supabase
        .from('music_recommendations')
        .select('spotify_track_id, model, rank, batch, display_order, is_attention_check')
        .eq('session_id', sid)
        .order('display_order', { ascending: true });

      if (error) throw error;
      if (!recs || recs.length === 0) {
        setErrorMsg('No recommendations found. Please try again.');
        return;
      }

      const realTrackIds = recs.filter(r => !r.is_attention_check).map(r => r.spotify_track_id);
      const { data: audioData } = await supabase
        .from('audio_list')
        .select('spotify_track_id, song, artist, album_name')
        .in('spotify_track_id', realTrackIds);

      const audioMap = new Map(audioData?.map(a => [a.spotify_track_id, a]) || []);

      const songs: Phase2Song[] = recs.map(rec => {
        if (rec.is_attention_check) {
          return {
            spotify_track_id: 'attention_check_p2',
            song: 'Attention Check',
            artist: 'Please do not rate this',
            album_name: '',
            is_attention_check: true,
            audioUrl: getAudioUrl('attention_check'),
            imageUrl: getAlbumImageUrl('attention_check'),
            model: rec.model,
            rank: rec.rank,
            batch: rec.batch,
            displayOrder: rec.display_order,
          };
        }
        const meta = audioMap.get(rec.spotify_track_id);
        return {
          spotify_track_id: rec.spotify_track_id,
          song: meta?.song || 'Unknown',
          artist: meta?.artist || 'Unknown',
          album_name: meta?.album_name || '',
          is_attention_check: false,
          audioUrl: getAudioUrl(rec.spotify_track_id),
          imageUrl: getAlbumImageUrl(rec.spotify_track_id),
          model: rec.model,
          rank: rec.rank,
          batch: rec.batch,
          displayOrder: rec.display_order,
        };
      });

      setPhase2Songs(songs);
    } catch (error: any) {
      console.error('Error loading Phase 2 songs:', error);
      setErrorMsg(`Failed to load recommendations: ${error.message || 'Unknown error'}`);
    } finally {
      setLoadingSongs(false);
    }
  };

  const handleStartFromIntro = async () => {
    setPhase('initial');
    const newSid = await initializeSession();
    await loadPhase1Songs(newSid);
  };

  const handleRatingChange = useCallback(async (trackId: string, rating: number, listenedDuration: number) => {
    setRatings(prev => {
      const existing = prev.findIndex(r => r.trackId === trackId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], rating, listenedDuration };
        return updated;
      }
      return [...prev, { trackId, rating, listenedDuration }];
    });

    // Save to database
    if (sessionId && !sessionId.startsWith('local_')) {
      const currentPhase = phase === 'recommendation' ? 2 : 1;
      const { data: existingRows } = await supabase
        .from('song_ratings')
        .select('id')
        .eq('session_id', sessionId)
        .eq('spotify_track_id', trackId)
        .eq('phase', currentPhase)
        .limit(1);

      const isAttention = trackId === 'attention_check' || trackId === 'attention_check_p2';

      if (existingRows && existingRows.length > 0) {
        await supabase.from('song_ratings')
          .update({ rating, listened_duration: listenedDuration })
          .eq('id', existingRows[0].id);
      } else {
        await supabase.from('song_ratings').insert({
          session_id: sessionId,
          spotify_track_id: trackId,
          rating,
          phase: currentPhase,
          is_attention_check: isAttention,
          listened_duration: listenedDuration,
        });
      }
    }
    setIncompleteRatings(prev => prev.filter(id => id !== trackId));
  }, [sessionId, phase]);

  const handleAdditionalRatingChange = useCallback(async (
    trackId: string,
    type: 'diversity' | 'novelty' | 'serendipity',
    value: number
  ) => {
    setRatings(prev => {
      const existing = prev.findIndex(r => r.trackId === trackId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], [type]: value };
        return updated;
      }
      return [...prev, { trackId, rating: -1, [type]: value }];
    });

    if (sessionId && !sessionId.startsWith('local_')) {
      const col = `${type}_rating`;
      const { data: existingRows } = await supabase
        .from('song_ratings')
        .select('id')
        .eq('session_id', sessionId)
        .eq('spotify_track_id', trackId)
        .eq('phase', 2)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        await supabase.from('song_ratings')
          .update({ [col]: value })
          .eq('id', existingRows[0].id);
      } else {
        await supabase.from('song_ratings').insert({
          session_id: sessionId,
          spotify_track_id: trackId,
          rating: -1,
          phase: 2,
          [col]: value,
        });
      }
    }
    setIncompleteRatings(prev => prev.filter(id => id !== trackId));
  }, [sessionId]);

  const getRating = (trackId: string): Rating => {
    return ratings.find(r => r.trackId === trackId) || { trackId, rating: -1 };
  };

  const getPhase1RatedCount = () => {
    const phase1Ids = currentSongs.filter(s => !s.is_attention_check).map(s => s.spotify_track_id);
    return ratings.filter(r => r.rating >= 0 && phase1Ids.includes(r.trackId)).length;
  };

  const getPhase2RatedCount = () => {
    const phase2Ids = phase2Songs.filter(s => !s.is_attention_check).map(s => s.spotify_track_id);
    return ratings.filter(r => {
      if (!phase2Ids.includes(r.trackId)) return false;
      return r.rating >= 0 && r.diversity !== undefined && r.diversity >= 0
        && r.novelty !== undefined && r.novelty >= 0
        && r.serendipity !== undefined && r.serendipity >= 0;
    }).length;
  };

  const allPhase1Rated = () => {
    const phase1Ids = currentSongs.filter(s => !s.is_attention_check).map(s => s.spotify_track_id);
    return phase1Ids.length > 0 && phase1Ids.every(id => ratings.some(r => r.trackId === id && r.rating >= 0));
  };

  const allPhase2Complete = () => {
    const phase2Ids = phase2Songs.filter(s => !s.is_attention_check).map(s => s.spotify_track_id);
    return phase2Ids.length > 0 && phase2Ids.every(id => {
      const r = ratings.find(rt => rt.trackId === id);
      return r && r.rating >= 0 && r.diversity !== undefined && r.diversity >= 0
        && r.novelty !== undefined && r.novelty >= 0
        && r.serendipity !== undefined && r.serendipity >= 0;
    });
  };

  const handleProceedToChoice = async () => {
    await recordPhaseTransition('initial', 'choice');
    await updateSessionPhase('choice');
    setPhase('choice');
  };

  const handleGetRecommendations = async () => {
    setIsGeneratingRecommendations(true);
    const loadStart = Date.now();

    try {
      await recordPhaseTransition('choice', 'recommendation');

      // Trigger recommendation API
      if (sessionId && !sessionId.startsWith('local_')) {
        await recommenderService.triggerRecommendationGeneration(sessionId);
      }

      // Wait minimum 10 seconds for UX
      const elapsed = Date.now() - loadStart;
      if (elapsed < 10000) {
        await new Promise(resolve => setTimeout(resolve, 10000 - elapsed));
      }

      // Load from database
      if (sessionId) {
        await loadPhase2Songs(sessionId);
      }

      setPhase('recommendation');
      await updateSessionPhase('recommendation');
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };

  const handleFinishAttempt = () => {
    if (phase === 'recommendation') {
      const incomplete: string[] = [];
      phase2Songs.filter(s => !s.is_attention_check).forEach(song => {
        const r = getRating(song.spotify_track_id);
        if (r.rating < 0 || r.diversity === undefined || r.diversity < 0
          || r.novelty === undefined || r.novelty < 0
          || r.serendipity === undefined || r.serendipity < 0) {
          incomplete.push(song.spotify_track_id);
        }
      });
      if (incomplete.length > 0) {
        setIncompleteRatings(incomplete);
        return;
      }
    }
    recordPhaseTransition(phase, 'questionnaire');
    updateSessionPhase('questionnaire');
    setPhase('questionnaire');
  };

  const handleQuestionnaireComplete = async (data: QuestionnaireData) => {
    await recordPhaseTransition('questionnaire', 'complete');

    if (sessionId && !sessionId.startsWith('local_')) {
      await supabase.from('questionnaire_responses').insert({
        session_id: sessionId,
        gender: data.gender || null,
        age_range: data.ageRange || null,
        music_listening_frequency: data.musicListeningFrequency,
        music_genre_preference: data.musicGenrePreference,
        music_expertise: data.musicExpertise,
        attention_check: data.attentionCheck,
        diversity_attitude: data.diversityAttitude,
        diversity_attitude2: data.diversityAttitude2,
        novelty_attitude: data.noveltyAttitude,
        novelty_attitude2: data.noveltyAttitude2,
        serendipity_attitude: data.serendipityAttitude,
        serendipity_attitude2: data.serendipityAttitude2,
        additional_comments: data.additionalComments || null,
        email: data.email || null,
      });

      await supabase.from('user_sessions')
        .update({ end_time: new Date().toISOString(), phase: 'complete' })
        .eq('id', sessionId);
    }

    setPhase('complete');
    clearSessionFromStorage();
  };

  // Phase 2 completion check
  useEffect(() => {
    if (phase === 'recommendation' && phase2Songs.length > 0 && allPhase2Complete() && !showPhase2Modal && !showFinishButton) {
      setShowPhase2Modal(true);
    }
  }, [ratings, phase, phase2Songs, showPhase2Modal, showFinishButton]);

  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-teal-500 mx-auto mb-4" size={48} />
          <p className="text-gray-400 text-lg">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (phase === 'intro') return <IntroScreen onStart={handleStartFromIntro} />;

  if (phase === 'choice') {
    return (
      <ChoiceScreen
        ratingsCount={getPhase1RatedCount()}
        onGetRecommendations={handleGetRecommendations}
        isGeneratingRecommendations={isGeneratingRecommendations}
      />
    );
  }

  if (phase === 'questionnaire') return <QuestionnaireScreen onComplete={handleQuestionnaireComplete} />;
  if (phase === 'complete') return <CompletionScreen totalRatings={ratings.filter(r => r.rating >= 0).length} />;

  const songsToDisplay = phase === 'recommendation' ? phase2Songs : currentSongs;
  const ratedCount = phase === 'recommendation' ? getPhase2RatedCount() : getPhase1RatedCount();
  const totalRequired = phase === 'recommendation'
    ? phase2Songs.filter(s => !s.is_attention_check).length
    : currentSongs.filter(s => !s.is_attention_check).length;

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Music className="text-teal-500" size={32} />
              <h1 className="text-2xl font-bold text-white">MusicRate</h1>
            </div>
            <div className="text-teal-400 font-medium">
              {phase === 'initial' ? 'Phase 1: Rate Songs' : 'Phase 2: Rate Recommendations'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {loadingSongs ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <Loader2 className="animate-spin text-teal-500 mx-auto mb-4" size={48} />
              <p className="text-gray-400 text-lg">Loading songs...</p>
            </div>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
              <p className="text-red-400 text-lg mb-4">{errorMsg}</p>
              <button
                onClick={() => sessionId && (phase === 'recommendation' ? loadPhase2Songs(sessionId) : loadPhase1Songs(sessionId))}
                className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="sticky top-[73px] z-40 bg-gray-950 pb-4 -mx-4 px-4 pt-4 border-b border-gray-800">
              <ProgressBar
                current={ratedCount}
                total={totalRequired}
                label={phase === 'initial' ? 'Songs Rated' : 'Recommendations Rated'}
              />
              {phase === 'initial' && (
                <p className="text-gray-400 text-sm mt-2">
                  Listen to each song for at least 15 seconds, then rate with like or dislike.
                </p>
              )}
            </div>

            {/* Action buttons */}
            {phase === 'initial' && allPhase1Rated() && (
              <div className="text-center my-6">
                <button
                  onClick={handleProceedToChoice}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  Continue to Next Step
                </button>
              </div>
            )}

            {phase === 'recommendation' && (
              <div className="text-center my-6">
                <button
                  onClick={handleFinishAttempt}
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  Finish Study
                </button>
                {incompleteRatings.length > 0 && (
                  <div className="mt-4 p-4 bg-red-900 border border-red-500 rounded-lg">
                    <p className="text-red-400 font-semibold mb-2">
                      Please complete all ratings before finishing.
                    </p>
                    <p className="text-red-300 text-sm">
                      Missing ratings for {incompleteRatings.length} song(s). Incomplete items are highlighted.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Song list */}
            <div className="space-y-4 mt-6">
              {songsToDisplay.map((song) => {
                const r = getRating(song.spotify_track_id);
                const isIncomplete = incompleteRatings.includes(song.spotify_track_id);
                return (
                  <SongCard
                    key={song.spotify_track_id + (phase === 'recommendation' ? '_p2' : '')}
                    song={song}
                    rating={r.rating}
                    onRatingChange={(rating, duration) => handleRatingChange(song.spotify_track_id, rating, duration)}
                    showAdditionalQuestions={phase === 'recommendation' && !song.is_attention_check}
                    diversityRating={r.diversity ?? -1}
                    noveltyRating={r.novelty ?? -1}
                    serendipityRating={r.serendipity ?? -1}
                    onDiversityChange={(v) => handleAdditionalRatingChange(song.spotify_track_id, 'diversity', v)}
                    onNoveltyChange={(v) => handleAdditionalRatingChange(song.spotify_track_id, 'novelty', v)}
                    onSerendipityChange={(v) => handleAdditionalRatingChange(song.spotify_track_id, 'serendipity', v)}
                    isIncomplete={isIncomplete}
                  />
                );
              })}
            </div>

            {/* Bottom action for Phase 1 */}
            {phase === 'initial' && allPhase1Rated() && (
              <div className="text-center mt-8">
                <button
                  onClick={handleProceedToChoice}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  Continue to Next Step
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <Phase2CompletionModal
        isOpen={showPhase2Modal}
        onModifyRatings={() => { setShowPhase2Modal(false); setShowFinishButton(true); }}
        onFinish={() => { setShowPhase2Modal(false); handleFinishAttempt(); }}
      />
    </div>
  );
}

export default App;
