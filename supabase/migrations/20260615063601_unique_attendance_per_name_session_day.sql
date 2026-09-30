
-- Add a generated date column and unique constraint on it
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS submitted_date date
    GENERATED ALWAYS AS ((submitted_at AT TIME ZONE 'UTC')::date) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_unique_per_day
  ON attendance (teacher_name, session_name, submitted_date);
