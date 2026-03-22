/*
  # Create event_report_wifi_networks table

  ## Summary
  Adds a WiFi networks table for storing report-level WiFi access point details.
  Networks belong to an event report (not a specific day) and are shown/edited from Day 1.

  ## New Tables
  - `event_report_wifi_networks`
    - `id` (uuid, primary key)
    - `report_id` (uuid, FK → event_reports.id, ON DELETE CASCADE)
    - `ssid` (text) - network name
    - `password` (text, nullable) - optional password
    - `speed` (text) - speed description e.g. "100 Mbps"
    - `sort_order` (int, default 0)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can select/insert/update/delete their own records
    (via the linked event_report's user_id)
*/

CREATE TABLE IF NOT EXISTS timesheet.event_report_wifi_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES timesheet.event_reports(id) ON DELETE CASCADE,
  ssid text NOT NULL DEFAULT '',
  password text DEFAULT NULL,
  speed text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE timesheet.event_report_wifi_networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own wifi networks"
  ON timesheet.event_report_wifi_networks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports er
      WHERE er.id = report_id AND er.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own wifi networks"
  ON timesheet.event_report_wifi_networks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports er
      WHERE er.id = report_id AND er.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own wifi networks"
  ON timesheet.event_report_wifi_networks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports er
      WHERE er.id = report_id AND er.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports er
      WHERE er.id = report_id AND er.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own wifi networks"
  ON timesheet.event_report_wifi_networks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports er
      WHERE er.id = report_id AND er.user_id = auth.uid()
    )
  );
