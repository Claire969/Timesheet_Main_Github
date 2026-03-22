/*
  # Event Reports: rename client_id → venue_client_id, add final_client_name

  ## Changes
  - Rename `event_reports.client_id` to `venue_client_id`
    (now points to timesheet.clients, used as the venue/salle with its logo)
  - Add `event_reports.final_client_name` text column (free text for the end client)
  - Update existing RLS policies to reference the new column name

  ## Notes
  - venue_client_id is now NULLABLE (venue is optional)
  - final_client_name defaults to empty string
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'timesheet'
      AND table_name = 'event_reports'
      AND column_name = 'client_id'
  ) THEN
    ALTER TABLE timesheet.event_reports RENAME COLUMN client_id TO venue_client_id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'timesheet'
      AND table_name = 'event_reports'
      AND column_name = 'final_client_name'
  ) THEN
    ALTER TABLE timesheet.event_reports ADD COLUMN final_client_name text NOT NULL DEFAULT '';
  END IF;
END $$;

ALTER TABLE timesheet.event_reports ALTER COLUMN venue_client_id DROP NOT NULL;
