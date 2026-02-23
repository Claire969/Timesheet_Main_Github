/*
  # Timesheet Schema Initialization

  1. New Schema
    - `timesheet` - dedicated schema for timesheet data

  2. New Tables
    - `timesheet.entries`
      - `id` (uuid, primary key) - unique entry identifier
      - `user_id` (uuid, foreign key to auth.users) - owner of the entry
      - `entry_date` (date) - date of the timesheet entry
      - `start_time` (time) - start time of work
      - `end_time` (time) - end time of work
      - `break_minutes` (integer) - break duration in minutes
      - `title` (text) - short description of the work
      - `notes` (text) - detailed notes (optional)
      - `created_at` (timestamptz) - record creation timestamp
      - `updated_at` (timestamptz) - last update timestamp

  3. Security
    - Enable RLS on `timesheet.entries` table
    - Add policies for authenticated users to manage their own entries:
      - SELECT: Users can view only their own entries
      - INSERT: Users can create entries for themselves
      - UPDATE: Users can update only their own entries
      - DELETE: Users can delete only their own entries

  4. Additional Features
    - Automatic trigger to update `updated_at` timestamp
    - Index on user_id and entry_date for efficient queries
    - Check constraint to ensure end_time >= start_time
    - Check constraint to ensure break_minutes >= 0
*/

-- Create timesheet schema
CREATE SCHEMA IF NOT EXISTS timesheet;

-- Create entries table
CREATE TABLE IF NOT EXISTS timesheet.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_minutes integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time >= start_time),
  CONSTRAINT valid_break_minutes CHECK (break_minutes >= 0)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON timesheet.entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON timesheet.entries(user_id, entry_date DESC);

-- Enable Row Level Security
ALTER TABLE timesheet.entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own entries
CREATE POLICY "Users can view own entries"
  ON timesheet.entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create entries for themselves
CREATE POLICY "Users can create own entries"
  ON timesheet.entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own entries
CREATE POLICY "Users can update own entries"
  ON timesheet.entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own entries
CREATE POLICY "Users can delete own entries"
  ON timesheet.entries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION timesheet.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_entries_updated_at ON timesheet.entries;
CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON timesheet.entries
  FOR EACH ROW
  EXECUTE FUNCTION timesheet.update_updated_at_column();
