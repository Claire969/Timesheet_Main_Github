/*
  # Create timesheet.entries table

  1. New Tables
    - `timesheet.entries`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK -> timesheet.projects.id, cascade delete)
      - `work_date` (date, not null)
      - `start_time` (time, nullable - null when forfait)
      - `end_time` (time, nullable - null when forfait)
      - `minutes` (int, not null, > 0)
      - `caller` (text, default '')
      - `description` (text, default '')
      - `travel_units` (int, default 0, 0..5)
      - `is_forfait` (text, default 'none': none|halfDay|fullDay)
      - `total` (numeric, not null)
      - `billing_status` (text, default 'unbilled': unbilled|pending|archived)
      - `pending_at` (date, nullable)
      - `archived_at` (date, nullable)
      - `is_event` (bool, default false)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS
    - Policies check ownership via project -> client -> user
*/

CREATE TABLE IF NOT EXISTS timesheet.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES timesheet.projects(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  start_time time,
  end_time time,
  minutes int NOT NULL DEFAULT 0,
  caller text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  travel_units int NOT NULL DEFAULT 0,
  is_forfait text NOT NULL DEFAULT 'none',
  total numeric NOT NULL DEFAULT 0,
  billing_status text NOT NULL DEFAULT 'unbilled',
  pending_at date,
  archived_at date,
  is_event boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE timesheet.entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view entries for their projects"
  ON timesheet.entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.projects p
      JOIN timesheet.clients c ON c.id = p.client_id
      WHERE p.id = timesheet.entries.project_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert entries for their projects"
  ON timesheet.entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.projects p
      JOIN timesheet.clients c ON c.id = p.client_id
      WHERE p.id = timesheet.entries.project_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update entries for their projects"
  ON timesheet.entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.projects p
      JOIN timesheet.clients c ON c.id = p.client_id
      WHERE p.id = timesheet.entries.project_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.projects p
      JOIN timesheet.clients c ON c.id = p.client_id
      WHERE p.id = timesheet.entries.project_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete entries for their projects"
  ON timesheet.entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.projects p
      JOIN timesheet.clients c ON c.id = p.client_id
      WHERE p.id = timesheet.entries.project_id
        AND c.user_id = auth.uid()
    )
  );
