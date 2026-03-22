/*
  # Create event_report_setup_steps table

  ## Summary
  Adds a new table to track setup steps for Day 1 of an event report.
  These replace the per-day "Résumé du jour" field on Day 1, giving a
  structured checklist / timeline of setup actions.

  ## New Tables
  - `timesheet.event_report_setup_steps`
    - `id` (uuid, primary key)
    - `report_id` (uuid, FK to event_reports ON DELETE CASCADE)
    - `sort_order` (integer, used for ordering)
    - `text` (text, the step description)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only access steps belonging to their own reports
*/

CREATE TABLE IF NOT EXISTS timesheet.event_report_setup_steps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  uuid NOT NULL REFERENCES timesheet.event_reports(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  text       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE timesheet.event_report_setup_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select event_report_setup_steps"
  ON timesheet.event_report_setup_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can insert event_report_setup_steps"
  ON timesheet.event_report_setup_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update event_report_setup_steps"
  ON timesheet.event_report_setup_steps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can delete event_report_setup_steps"
  ON timesheet.event_report_setup_steps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  );
