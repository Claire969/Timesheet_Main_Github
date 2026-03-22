/*
  # Add is_archived to event_reports

  ## Changes
  - `event_reports`: adds `is_archived` boolean column, default false
    - Allows soft-archiving reports without deleting them
    - Existing rows all default to false (active)

  ## Notes
  - Safe additive migration, no data loss
  - No RLS changes needed (existing policies cover new column)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'timesheet'
      AND table_name = 'event_reports'
      AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE timesheet.event_reports
      ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;
