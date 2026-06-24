
DROP FUNCTION IF EXISTS select_phase1_songs_for_session(uuid);

CREATE FUNCTION select_phase1_songs_for_session(p_session_id uuid)
RETURNS TABLE(track_id text, is_attention boolean) AS $$
DECLARE
  v_songs text[];
  v_attention_pos integer;
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

  -- Insert attention check at random position (between 5 and 16)
  v_attention_pos := 5 + floor(random() * 12)::integer;

  -- Insert songs before attention check
  FOR v_i IN 1..LEAST(v_attention_pos - 1, array_length(v_songs, 1)) LOOP
    INSERT INTO session_phase1_songs (session_id, spotify_track_id, position, is_attention_check)
    VALUES (p_session_id, v_songs[v_i], v_i, false)
    ON CONFLICT (session_id, spotify_track_id) DO NOTHING;
  END LOOP;

  -- Insert attention check
  INSERT INTO session_phase1_songs (session_id, spotify_track_id, position, is_attention_check)
  VALUES (p_session_id, 'attention_check', v_attention_pos, true)
  ON CONFLICT (session_id, spotify_track_id) DO NOTHING;

  -- Insert songs after attention check
  FOR v_i IN v_attention_pos..LEAST(array_length(v_songs, 1), 20) LOOP
    INSERT INTO session_phase1_songs (session_id, spotify_track_id, position, is_attention_check)
    VALUES (p_session_id, v_songs[v_i], v_i + 1, false)
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
