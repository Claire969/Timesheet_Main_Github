/*
  # Event Reports: day prefill dates, is_setup_day, network impact text

  ## Changes

  ### event_report_days
  - `report_date` already exists; no schema change needed (prefilling happens in app logic)
  - Add `is_setup_day` boolean (true = montage, false = event), default false

  ### event_report_incidents
  - Add `network_impact_text` text column (nullable) — describes network impact when present
  - Keep existing `network_impact` boolean for backwards compatibility; it will be set true
    whenever network_impact_text is non-empty (managed in app layer)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'timesheet'
      AND table_name = 'event_report_days'
      AND column_name = 'is_setup_day'
  ) THEN
    ALTER TABLE timesheet.event_report_days ADD COLUMN is_setup_day boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'timesheet'
      AND table_name = 'event_report_incidents'
      AND column_name = 'network_impact_text'
  ) THEN
    ALTER TABLE timesheet.event_report_incidents ADD COLUMN network_impact_text text;
  END IF;
END $$;
