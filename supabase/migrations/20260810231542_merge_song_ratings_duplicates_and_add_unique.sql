/*
# Merge duplicate song_ratings rows and prevent future duplicates

Some (session_id, spotify_track_id, phase) groups have multiple rows because
concurrent client-side handlers each did a SELECT-then-INSERT.

## Steps
1. For every duplicate group, merge the valid values into the earliest row:
   - `rating`: keep the max valid (>= 0) value across the group; -1 otherwise
   - `diversity_rating`, `novelty_rating`, `serendipity_rating`: keep the max non-null value
   - `listened_duration`: keep the max non-null value
   - `model`, `rank`, `batch`: keep the max non-null value
2. Delete the extra rows in each group.
3. Add a UNIQUE constraint on (session_id, spotify_track_id, phase) so future
   concurrent inserts collide and can be resolved with `upsert(onConflict=...)`.
*/

DO $$
DECLARE
  keeper_id uuid;
  grp record;
  merged_rating integer;
  merged_diversity integer;
  merged_novelty integer;
  merged_serendipity integer;
  merged_duration real;
  merged_model text;
  merged_rank integer;
  merged_batch integer;
BEGIN
  FOR grp IN
    SELECT session_id, spotify_track_id, phase
    FROM song_ratings
    GROUP BY session_id, spotify_track_id, phase
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keeper_id
    FROM song_ratings
    WHERE session_id = grp.session_id
      AND spotify_track_id = grp.spotify_track_id
      AND phase = grp.phase
    ORDER BY created_at NULLS LAST, id
    LIMIT 1;

    SELECT
      COALESCE(MAX(rating) FILTER (WHERE rating IS NOT NULL AND rating >= 0), -1),
      MAX(diversity_rating),
      MAX(novelty_rating),
      MAX(serendipity_rating),
      MAX(listened_duration),
      MAX(model),
      MAX(rank),
      MAX(batch)
    INTO
      merged_rating, merged_diversity, merged_novelty, merged_serendipity,
      merged_duration, merged_model, merged_rank, merged_batch
    FROM song_ratings
    WHERE session_id = grp.session_id
      AND spotify_track_id = grp.spotify_track_id
      AND phase = grp.phase;

    UPDATE song_ratings SET
      rating = merged_rating,
      diversity_rating = merged_diversity,
      novelty_rating = merged_novelty,
      serendipity_rating = merged_serendipity,
      listened_duration = COALESCE(merged_duration, listened_duration),
      model = COALESCE(merged_model, model),
      rank = COALESCE(merged_rank, rank),
      batch = COALESCE(merged_batch, batch)
    WHERE id = keeper_id;

    DELETE FROM song_ratings
    WHERE session_id = grp.session_id
      AND spotify_track_id = grp.spotify_track_id
      AND phase = grp.phase
      AND id <> keeper_id;
  END LOOP;
END $$;

ALTER TABLE song_ratings
  ADD CONSTRAINT song_ratings_session_track_phase_key
  UNIQUE (session_id, spotify_track_id, phase);