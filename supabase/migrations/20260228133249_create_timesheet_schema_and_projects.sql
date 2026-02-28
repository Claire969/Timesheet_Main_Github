/*
  # Create timesheet schema and projects table

  1. Creates the timesheet schema if it doesn't exist
  2. New Tables
    - `timesheet.projects`
      - `id` (uuid, primary key, auto-generated)
      - `client_id` (uuid, foreign key -> timesheet.clients.id)
      - `name` (text, not null)
      - `active` (boolean, default true)
      - `created_at` (timestamptz, default now())

  3. Security
    - Enable RLS on `timesheet.projects`
    - Policies scoped to authenticated users who own the parent client
*/

CREATE SCHEMA IF NOT EXISTS timesheet;

CREATE TABLE IF NOT EXISTS timesheet.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE timesheet.clients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'timesheet' AND tablename = 'clients' AND policyname = 'Users can view own clients'
  ) THEN
    CREATE POLICY "Users can view own clients"
      ON timesheet.clients FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'timesheet' AND tablename = 'clients' AND policyname = 'Users can insert own clients'
  ) THEN
    CREATE POLICY "Users can insert own clients"
      ON timesheet.clients FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'timesheet' AND tablename = 'clients' AND policyname = 'Users can update own clients'
  ) THEN
    CREATE POLICY "Users can update own clients"
      ON timesheet.clients FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'timesheet' AND tablename = 'clients' AND policyname = 'Users can delete own clients'
  ) THEN
    CREATE POLICY "Users can delete own clients"
      ON timesheet.clients FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS timesheet.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES timesheet.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE timesheet.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects for their clients"
  ON timesheet.projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.clients
      WHERE timesheet.clients.id = timesheet.projects.client_id
        AND timesheet.clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert projects for their clients"
  ON timesheet.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.clients
      WHERE timesheet.clients.id = timesheet.projects.client_id
        AND timesheet.clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects for their clients"
  ON timesheet.projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.clients
      WHERE timesheet.clients.id = timesheet.projects.client_id
        AND timesheet.clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.clients
      WHERE timesheet.clients.id = timesheet.projects.client_id
        AND timesheet.clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete projects for their clients"
  ON timesheet.projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.clients
      WHERE timesheet.clients.id = timesheet.projects.client_id
        AND timesheet.clients.user_id = auth.uid()
    )
  );
