/*
# Remove Phase 1 attention check

1. Modified Tables
   - `song_ratings`: dropped `is_attention_check` column
2. Modified Functions
   - `select_phase1_songs_for_session`: no longer inserts an attention check item;
     selects 20 real songs only, without the fake 'attention_check' entry.
3. Notes
   - Phase 2 attention checks (in `music_recommendations`) are unaffected.
   - Existing `session_phase1_songs` rows with spotify_track_id = 'attention_check' are
     cleaned up (deleted) so session recovery doesn't try to look them up.
*/

-- Drop is_attention_check from song_ratings
ALTER TABLE song_ratings DROP COLUMN IF EXISTS is_attention_check;

-- Clean up old attention check rows from session_phase1_songs
DELETE FROM session_phase1_songs WHERE spotify_track_id = 'attention_check';

-- Recreate the function without attention check logic
DROP FUNCTION IF EXISTS select_phase1_songs_for_session(uuid);

CREATE FUNCTION select_phase1_songs_for_session(p_session_id uuid)
RETURNS TABLE(track_id text, is_attention boolean) AS $$
DECLARE
  v_songs text[];
  v_i integer;
BEGIN
  -- Select 20 songs weighted by rating_count
  SELECT ARRAY(
    SELECT a.spotify_track_id
    FROM audio_list a
    WHERE a.spotify_track_id NOT IN (
      SELECT sp.spotify_track_id FROM session_phase1_songs sp WHERE sp.session_id = p_session_id
    )
    ORDER BY random() * (a.rating_count::float / (SELECT MAX(al.rating_count) FROM audio_list al)) DESC
    LIMIT 20
  ) INTO v_songs;

  -- Insert all songs sequentially (no attention check)
  FOR v_i IN 1..array_length(v_songs, 1) LOOP
    INSERT INTO session_phase1_songs (session_id, spotify_track_id, position, is_attention_check)
    VALUES (p_session_id, v_songs[v_i], v_i, false)
    ON CONFLICT (session_id, spotify_track_id) DO NOTHING;
  END LOOP;

  -- Return songs in order
  RETURN QUERY
    SELECT sp.spotify_track_id AS track_id, sp.is_attention_check AS is_attention
    FROM session_phase1_songs sp
    WHERE sp.session_id = p_session_id
    ORDER BY sp.position;
END;
$$ LANGUAGE plpgsql;
