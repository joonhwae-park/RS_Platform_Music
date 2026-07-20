/*
# Stratified Phase 1 song selection by release decade

1. Modified Functions
   - `select_phase1_songs_for_session`: now samples songs in four strata based on
     the `release` column:
       - >= 2010: 6 items
       - 2000-2009: 6 items
       - 1990-1999: 5 items
       - <= 1989: 3 items
     Within each stratum, songs are sampled proportional to rating_count.
2. Notes
   - Total remains 20 songs per session.
   - Existing sessions are not affected (songs already persisted).
*/

DROP FUNCTION IF EXISTS select_phase1_songs_for_session(uuid);

CREATE FUNCTION select_phase1_songs_for_session(p_session_id uuid)
RETURNS TABLE(track_id text, is_attention boolean) AS $$
DECLARE
  v_songs text[];
  v_batch text[];
  v_i integer;
  v_pos integer := 1;
BEGIN
  -- Stratum 1: release >= 2010, pick 6
  SELECT ARRAY(
    SELECT a.spotify_track_id
    FROM audio_list a
    WHERE a.release >= 2010
      AND a.spotify_track_id NOT IN (
        SELECT sp.spotify_track_id FROM session_phase1_songs sp WHERE sp.session_id = p_session_id
      )
    ORDER BY random() * (a.rating_count::float / GREATEST((SELECT MAX(al.rating_count) FROM audio_list al WHERE al.release >= 2010), 1)) DESC
    LIMIT 6
  ) INTO v_batch;
  v_songs := v_songs || v_batch;

  -- Stratum 2: release 2000-2009, pick 6
  SELECT ARRAY(
    SELECT a.spotify_track_id
    FROM audio_list a
    WHERE a.release >= 2000 AND a.release <= 2009
      AND a.spotify_track_id NOT IN (
        SELECT sp.spotify_track_id FROM session_phase1_songs sp WHERE sp.session_id = p_session_id
      )
    ORDER BY random() * (a.rating_count::float / GREATEST((SELECT MAX(al.rating_count) FROM audio_list al WHERE al.release >= 2000 AND al.release <= 2009), 1)) DESC
    LIMIT 6
  ) INTO v_batch;
  v_songs := v_songs || v_batch;

  -- Stratum 3: release 1990-1999, pick 5
  SELECT ARRAY(
    SELECT a.spotify_track_id
    FROM audio_list a
    WHERE a.release >= 1990 AND a.release <= 1999
      AND a.spotify_track_id NOT IN (
        SELECT sp.spotify_track_id FROM session_phase1_songs sp WHERE sp.session_id = p_session_id
      )
    ORDER BY random() * (a.rating_count::float / GREATEST((SELECT MAX(al.rating_count) FROM audio_list al WHERE al.release >= 1990 AND al.release <= 1999), 1)) DESC
    LIMIT 5
  ) INTO v_batch;
  v_songs := v_songs || v_batch;

  -- Stratum 4: release <= 1989, pick 3
  SELECT ARRAY(
    SELECT a.spotify_track_id
    FROM audio_list a
    WHERE a.release <= 1989
      AND a.spotify_track_id NOT IN (
        SELECT sp.spotify_track_id FROM session_phase1_songs sp WHERE sp.session_id = p_session_id
      )
    ORDER BY random() * (a.rating_count::float / GREATEST((SELECT MAX(al.rating_count) FROM audio_list al WHERE al.release <= 1989), 1)) DESC
    LIMIT 3
  ) INTO v_batch;
  v_songs := v_songs || v_batch;

  -- Insert all songs sequentially
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
