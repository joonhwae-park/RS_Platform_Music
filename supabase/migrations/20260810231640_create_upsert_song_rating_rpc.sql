/*
# Atomic upsert function for song_ratings

Avoids the read-then-write race by letting the client send only the fields it
wants to change. NULL arguments preserve whatever is already in the row.
*/

CREATE OR REPLACE FUNCTION upsert_song_rating(
  p_session_id uuid,
  p_track_id text,
  p_phase integer,
  p_rating integer DEFAULT NULL,
  p_listened_duration real DEFAULT NULL,
  p_diversity integer DEFAULT NULL,
  p_novelty integer DEFAULT NULL,
  p_serendipity integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO song_ratings (
    session_id, spotify_track_id, phase,
    rating, listened_duration,
    diversity_rating, novelty_rating, serendipity_rating
  )
  VALUES (
    p_session_id, p_track_id, p_phase,
    COALESCE(p_rating, -1), p_listened_duration,
    p_diversity, p_novelty, p_serendipity
  )
  ON CONFLICT (session_id, spotify_track_id, phase) DO UPDATE SET
    rating = CASE WHEN p_rating IS NOT NULL THEN p_rating ELSE song_ratings.rating END,
    listened_duration = COALESCE(EXCLUDED.listened_duration, song_ratings.listened_duration),
    diversity_rating = COALESCE(EXCLUDED.diversity_rating, song_ratings.diversity_rating),
    novelty_rating = COALESCE(EXCLUDED.novelty_rating, song_ratings.novelty_rating),
    serendipity_rating = COALESCE(EXCLUDED.serendipity_rating, song_ratings.serendipity_rating);
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_song_rating(uuid, text, integer, integer, real, integer, integer, integer)
  TO anon, authenticated;