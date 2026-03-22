/*
  # Event Reports MVP Schema

  Creates 6 tables inside the existing `timesheet` schema for the Event Reports feature.

  ## New Tables

  1. `timesheet.event_venues`
     - Venues owned by a user, with optional logo and notes

  2. `timesheet.event_reports`
     - Top-level event report linked to an existing client and optional venue
     - status: draft | in_progress | completed

  3. `timesheet.event_report_days`
     - One row per day of the event
     - status: open | validated

  4. `timesheet.event_report_hourly_rows`
     - Hourly network metrics per day (wifi users, bandwidth in/out, notes)

  5. `timesheet.event_report_incidents`
     - Incidents logged per day with time, title, description, resolution, and network_impact flag

  6. `timesheet.event_report_images`
     - Images attached to a day with URL, caption, and sort order

  ## Security
  - RLS enabled on every table
  - Users can only access rows they own (via user_id) or rows linked to their reports
*/

-- 1. event_venues
CREATE TABLE IF NOT EXISTS timesheet.event_venues (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid(),
  name       text NOT NULL,
  logo_url   text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE timesheet.event_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select event_venues"
  ON timesheet.event_venues FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert event_venues"
  ON timesheet.event_venues FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update event_venues"
  ON timesheet.event_venues FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete event_venues"
  ON timesheet.event_venues FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- 2. event_reports
CREATE TABLE IF NOT EXISTS timesheet.event_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid(),
  client_id   uuid NOT NULL REFERENCES timesheet.clients(id),
  venue_id    uuid REFERENCES timesheet.event_venues(id),
  event_name  text NOT NULL DEFAULT '',
  start_date  date,
  total_days  integer NOT NULL DEFAULT 1,
  current_day integer NOT NULL DEFAULT 1,
  status      text NOT NULL DEFAULT 'draft',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_reports_status_check CHECK (status IN ('draft', 'in_progress', 'completed'))
);

ALTER TABLE timesheet.event_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select event_reports"
  ON timesheet.event_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert event_reports"
  ON timesheet.event_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update event_reports"
  ON timesheet.event_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete event_reports"
  ON timesheet.event_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- 3. event_report_days
CREATE TABLE IF NOT EXISTS timesheet.event_report_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL REFERENCES timesheet.event_reports(id) ON DELETE CASCADE,
  day_number  integer NOT NULL,
  report_date date,
  status      text NOT NULL DEFAULT 'open',
  summary     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_report_days_status_check CHECK (status IN ('open', 'validated'))
);

ALTER TABLE timesheet.event_report_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select event_report_days"
  ON timesheet.event_report_days FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can insert event_report_days"
  ON timesheet.event_report_days FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update event_report_days"
  ON timesheet.event_report_days FOR UPDATE
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

CREATE POLICY "Owner can delete event_report_days"
  ON timesheet.event_report_days FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  );


-- 4. event_report_hourly_rows
CREATE TABLE IF NOT EXISTS timesheet.event_report_hourly_rows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id        uuid NOT NULL REFERENCES timesheet.event_report_days(id) ON DELETE CASCADE,
  hour_label    text NOT NULL DEFAULT '',
  wifi_users    integer NOT NULL DEFAULT 0,
  bandwidth_in  numeric NOT NULL DEFAULT 0,
  bandwidth_out numeric NOT NULL DEFAULT 0,
  notes         text NOT NULL DEFAULT ''
);

ALTER TABLE timesheet.event_report_hourly_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select event_report_hourly_rows"
  ON timesheet.event_report_hourly_rows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can insert event_report_hourly_rows"
  ON timesheet.event_report_hourly_rows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update event_report_hourly_rows"
  ON timesheet.event_report_hourly_rows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can delete event_report_hourly_rows"
  ON timesheet.event_report_hourly_rows FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );


-- 5. event_report_incidents
CREATE TABLE IF NOT EXISTS timesheet.event_report_incidents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id         uuid NOT NULL REFERENCES timesheet.event_report_days(id) ON DELETE CASCADE,
  incident_time  time,
  title          text NOT NULL DEFAULT '',
  description    text NOT NULL DEFAULT '',
  resolution     text NOT NULL DEFAULT '',
  network_impact boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE timesheet.event_report_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select event_report_incidents"
  ON timesheet.event_report_incidents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can insert event_report_incidents"
  ON timesheet.event_report_incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update event_report_incidents"
  ON timesheet.event_report_incidents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can delete event_report_incidents"
  ON timesheet.event_report_incidents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );


-- 6. event_report_images
CREATE TABLE IF NOT EXISTS timesheet.event_report_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id     uuid NOT NULL REFERENCES timesheet.event_report_days(id) ON DELETE CASCADE,
  file_url   text NOT NULL DEFAULT '',
  caption    text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE timesheet.event_report_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select event_report_images"
  ON timesheet.event_report_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can insert event_report_images"
  ON timesheet.event_report_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update event_report_images"
  ON timesheet.event_report_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can delete event_report_images"
  ON timesheet.event_report_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timesheet.event_report_days d
      JOIN timesheet.event_reports r ON r.id = d.report_id
      WHERE d.id = day_id AND r.user_id = auth.uid()
    )
  );
