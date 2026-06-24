
-- User sessions table
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  phase text NOT NULL DEFAULT 'intro',
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  created_at timestamptz DEFAULT now(),
  screen_width integer,
  screen_height integer,
  intro_start_time timestamptz,
  initial_start_time timestamptz,
  choice_start_time timestamptz,
  recommendation_start_time timestamptz,
  questionnaire_start_time timestamptz
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_sessions" ON user_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_sessions" ON user_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_sessions" ON user_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sessions" ON user_sessions FOR DELETE TO anon, authenticated USING (true);

-- Phase transitions
CREATE TABLE phase_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES user_sessions(id),
  from_phase text NOT NULL,
  to_phase text NOT NULL,
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE phase_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_transitions" ON phase_transitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_transitions" ON phase_transitions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_transitions" ON phase_transitions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_transitions" ON phase_transitions FOR DELETE TO anon, authenticated USING (true);

-- Song ratings
CREATE TABLE song_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES user_sessions(id),
  spotify_track_id text NOT NULL,
  rating integer NOT NULL, -- 1 = like, 0 = dislike
  is_attention_check boolean DEFAULT false,
  diversity_rating integer, -- 1 = yes, 0 = no
  novelty_rating integer, -- 1 = yes, 0 = no
  serendipity_rating integer, -- 1 = yes, 0 = no
  model text,
  rank integer,
  batch integer,
  phase integer DEFAULT 1,
  listened_duration real,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE song_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_song_ratings" ON song_ratings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_song_ratings" ON song_ratings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_song_ratings" ON song_ratings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_song_ratings" ON song_ratings FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX idx_song_ratings_session ON song_ratings(session_id);
CREATE INDEX idx_song_ratings_track ON song_ratings(spotify_track_id);

-- Session Phase 1 songs
CREATE TABLE session_phase1_songs (
  session_id uuid NOT NULL REFERENCES user_sessions(id),
  spotify_track_id text NOT NULL,
  position integer NOT NULL,
  is_attention_check boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, spotify_track_id)
);

ALTER TABLE session_phase1_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_phase1_songs" ON session_phase1_songs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_phase1_songs" ON session_phase1_songs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_phase1_songs" ON session_phase1_songs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_phase1_songs" ON session_phase1_songs FOR DELETE TO anon, authenticated USING (true);

-- Music recommendations
CREATE TABLE music_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES user_sessions(id),
  spotify_track_id text NOT NULL,
  model text NOT NULL,
  rank integer NOT NULL,
  batch integer NOT NULL,
  display_order integer NOT NULL,
  score real,
  is_attention_check boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, spotify_track_id, model)
);

ALTER TABLE music_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_music_recs" ON music_recommendations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_music_recs" ON music_recommendations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_music_recs" ON music_recommendations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_music_recs" ON music_recommendations FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX idx_music_recs_session ON music_recommendations(session_id);

-- Questionnaire responses
CREATE TABLE questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES user_sessions(id),
  gender text,
  age_range text,
  music_listening_frequency text,
  music_genre_preference text,
  music_expertise text,
  attention_check text,
  diversity_attitude text,
  diversity_attitude2 text,
  novelty_attitude text,
  novelty_attitude2 text,
  serendipity_attitude text,
  serendipity_attitude2 text,
  additional_comments text,
  email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_questionnaire" ON questionnaire_responses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_questionnaire" ON questionnaire_responses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_questionnaire" ON questionnaire_responses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_questionnaire" ON questionnaire_responses FOR DELETE TO anon, authenticated USING (true);
