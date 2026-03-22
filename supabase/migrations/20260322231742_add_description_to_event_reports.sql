/*
  # Add description field to event_reports

  ## Summary
  Adds a report-level `description` text column to `timesheet.event_reports`.
  This replaces the pattern of re-entering a main description on every day editor.
  The field is editable only from Day 1; other days show it read-only.

  ## Changes
  - `timesheet.event_reports`: new column `description text NOT NULL DEFAULT ''`

  ## Notes
  - No data loss: existing rows get an empty string by default
  - WiFi networks were already report-level (report_id FK) — no schema change needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'timesheet'
      AND table_name = 'event_reports'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE timesheet.event_reports ADD COLUMN description text NOT NULL DEFAULT '';
  END IF;
END $$;
