/*
  # Rename FK constraint on event_reports.venue_client_id

  ## Problem
  When the column was renamed from client_id to venue_client_id, the FK constraint
  kept its old name (event_reports_client_id_fkey). PostgREST uses FK constraint
  names for relationship resolution, so the stale name can cause 400 errors on
  queries that join event_reports to clients.

  ## Change
  - Drop old FK constraint event_reports_client_id_fkey
  - Re-add it as event_reports_venue_client_id_fkey (same column, same target)

  ## Safety
  - Additive: drops only the constraint by name then recreates it identically
  - No data is touched
*/

ALTER TABLE timesheet.event_reports
  DROP CONSTRAINT IF EXISTS event_reports_client_id_fkey;

ALTER TABLE timesheet.event_reports
  ADD CONSTRAINT event_reports_venue_client_id_fkey
  FOREIGN KEY (venue_client_id) REFERENCES timesheet.clients(id);
