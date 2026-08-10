/*
# Add prolific_pid column to user_sessions

1. Modified Tables
   - `user_sessions`
     - Added `prolific_pid` (text, nullable) — stores the Prolific participant ID
       captured from the URL query parameter when a user enters through Prolific.
       NULL when the user did not come through Prolific.

2. Important Notes
   - No security changes; existing RLS policies already cover user_sessions.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'prolific_pid'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN prolific_pid text;
  END IF;
END $$;