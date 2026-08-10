/*
# Create attention_checks table

1. New Tables
   - `attention_checks`
     - `id` (uuid, primary key) — unique row identifier
     - `session_id` (uuid, not null, FK to user_sessions) — the session this check belongs to
     - `prolific_pid` (text, nullable) — Prolific participant ID when available
     - `pre_durability` (integer, nullable) — pre-study attention check: Durability rating (1-7)
     - `pre_price` (integer, nullable) — pre-study attention check: Competitive purchase price rating (1-7)
     - `pre_design` (integer, nullable) — pre-study attention check: Design rating (1-7)
     - `pre_passed` (boolean, nullable) — whether the pre-study check was passed (durability=7, others=1)
     - `questionnaire_response` (text, nullable) — the attention check answer from the final questionnaire
     - `created_at` (timestamptz) — row creation time

2. Security
   - RLS enabled.
   - Anon + authenticated can insert and select (no auth in this app).
*/

CREATE TABLE IF NOT EXISTS attention_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
  prolific_pid text,
  pre_durability integer,
  pre_price integer,
  pre_design integer,
  pre_passed boolean,
  questionnaire_response text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attention_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_attention_checks" ON attention_checks;
CREATE POLICY "anon_select_attention_checks" ON attention_checks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_attention_checks" ON attention_checks;
CREATE POLICY "anon_insert_attention_checks" ON attention_checks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_attention_checks" ON attention_checks;
CREATE POLICY "anon_update_attention_checks" ON attention_checks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_attention_checks" ON attention_checks;
CREATE POLICY "anon_delete_attention_checks" ON attention_checks FOR DELETE
  TO anon, authenticated USING (true);