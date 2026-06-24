
-- Function to select 20 Phase 1 songs for a session, weighted by rating_count
-- Plus 1 attention check inserted at a random position
CREATE OR REPLACE FUNCTION select_phase1_songs_for_session(p_session_id uuid)
RETURNS TABLE(spotify_track_id text, is_attention_check boolean) AS $$
DECLARE
  v_songs text[];
  v_result text[];
  v_attention_pos integer;
BEGIN
  -- Select 20 songs weighted by rating_count (higher count = more likely to be selected)
  -- This mimics showing popular songs that more users would recognize
  SELECT ARRAY(
    SELECT a.spotify_track_id
    FROM audio_list a
    WHERE a.spotify_track_id NOT IN (
      SELECT sp.spotify_track_id FROM session_phase1_songs sp WHERE sp.session_id = p_session_id
    )
    ORDER BY random() * (a.rating_count::float / (SELECT MAX(al.rating_count) FROM audio_list al))
    DESC
    LIMIT 20
  ) INTO v_songs;

  -- Insert attention check at random position (between position 5 and 16)
  v_attention_pos := 5 + floor(random() * 12)::integer;

  -- Insert songs into session_phase1_songs
  FOR i IN 1..array_length(v_songs, 1) LOOP
    IF i = v_attention_pos THEN
      -- Insert attention check
      INSERT INTO session_phase1_songs (session_id, spotify_track_id, position, is_attention_check)
      VALUES (p_session_id, 'attention_check', i, true)
      ON CONFLICT (session_id, spotify_track_id) DO NOTHING;
      
      -- Shift remaining songs by 1
      INSERT INTO session_phase1_songs (session_id, spotify_track_id, position, is_attention_check)
      VALUES (p_session_id, v_songs[i], i + 1, false)
      ON CONFLICT (session_id, spotify_track_id) DO NOTHING;
    ELSIF i > v_attention_pos THEN
      INSERT INTO session_phase1_songs (session_id, spotify_track_id, position, is_attention_check)
      VALUES (p_session_id, v_songs[i], i + 1, false)
      ON CONFLICT (session_id, spotify_track_id) DO NOTHING;
    ELSE
      INSERT INTO session_phase1_songs (session_id, spotify_track_id, position, is_attention_check)
      VALUES (p_session_id, v_songs[i], i, false)
      ON CONFLICT (session_id, spotify_track_id) DO NOTHING;
    END IF;
  END LOOP;

  -- Return songs in order
  RETURN QUERY
    SELECT sp.spotify_track_id, sp.is_attention_check
    FROM session_phase1_songs sp
    WHERE sp.session_id = p_session_id
    ORDER BY sp.position;
END;
$$ LANGUAGE plpgsql;
