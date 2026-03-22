/*
  # Add language field to event_reports

  ## Changes
  - `event_reports`: adds `language` column (text, NOT NULL, DEFAULT 'fr')
    Stores the report language choice (fr or en) for future PDF/report generation
    and AI assistance behavior.

  ## Notes
  - Default is 'fr' (French)
  - Safe conditional add (IF NOT EXISTS)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'timesheet'
      AND table_name = 'event_reports'
      AND column_name = 'language'
  ) THEN
    ALTER TABLE timesheet.event_reports
      ADD COLUMN language text NOT NULL DEFAULT 'fr';
  END IF;
END $$;
