/*
  # Create tasks and subtasks tables

  ## Summary
  Implements the personal Todo / Task List feature for Clear_Computing.

  ## New Tables

  ### `timesheet.tasks`
  Personal work tasks tied to the authenticated user.
  - `id` — UUID primary key
  - `user_id` — owner (auth.uid()), used for RLS
  - `title` — task title (required)
  - `description` — optional notes / description
  - `client_id` — optional FK to timesheet.clients (nullable)
  - `priority` — enum-like text: 'normal' | 'important' | 'urgent' | 'urgent_important'
  - `status` — text: 'todo' | 'in_progress' | 'completed'
  - `issue_date` — business/task date chosen by user (defaults to today)
  - `due_date` — optional deadline
  - `position` — integer for manual ordering (lower = higher in list)
  - `completed_at` — timestamp when task was completed (null if active)
  - `created_at` — auto
  - `updated_at` — auto, updated by trigger

  ### `timesheet.subtasks`
  Subtasks belonging to a parent task.
  - `id` — UUID primary key
  - `task_id` — FK to timesheet.tasks (cascade delete)
  - `user_id` — owner (auth.uid()), used for RLS
  - `title` — subtask title (required)
  - `completed` — boolean
  - `completed_at` — timestamp when subtask was completed
  - `position` — integer for ordering
  - `created_at` — auto
  - `updated_at` — auto, updated by trigger

  ## Security
  - RLS enabled on both tables
  - Users can only access their own tasks and subtasks (auth.uid() = user_id)
  - Separate policies for SELECT, INSERT, UPDATE, DELETE

  ## Notes
  - client_id is nullable so tasks can be unassigned
  - position defaults to 0; app sets it on creation to order tasks
  - completed_at is set/cleared when status changes to/from 'completed'
  - updated_at trigger fires on any row update
*/

-- ─── Tasks table ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS timesheet.tasks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text        NOT NULL CHECK (char_length(title) > 0),
  description   text        NOT NULL DEFAULT '',
  client_id     uuid        REFERENCES timesheet.clients(id) ON DELETE SET NULL,
  priority      text        NOT NULL DEFAULT 'normal'
                              CHECK (priority IN ('normal', 'important', 'urgent', 'urgent_important')),
  status        text        NOT NULL DEFAULT 'todo'
                              CHECK (status IN ('todo', 'in_progress', 'completed')),
  issue_date    date        NOT NULL DEFAULT CURRENT_DATE,
  due_date      date,
  position      integer     NOT NULL DEFAULT 0,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Subtasks table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS timesheet.subtasks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid        NOT NULL REFERENCES timesheet.tasks(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text        NOT NULL CHECK (char_length(title) > 0),
  completed    boolean     NOT NULL DEFAULT false,
  completed_at timestamptz,
  position     integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_user_id       ON timesheet.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id     ON timesheet.tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status        ON timesheet.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority      ON timesheet.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id    ON timesheet.subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_user_id    ON timesheet.subtasks(user_id);

-- ─── updated_at trigger function (shared if not already created) ────────────────

CREATE OR REPLACE FUNCTION timesheet.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON timesheet.tasks
  FOR EACH ROW EXECUTE FUNCTION timesheet.set_updated_at();

CREATE OR REPLACE TRIGGER subtasks_updated_at
  BEFORE UPDATE ON timesheet.subtasks
  FOR EACH ROW EXECUTE FUNCTION timesheet.set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────────

ALTER TABLE timesheet.tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet.subtasks ENABLE ROW LEVEL SECURITY;

-- Tasks policies
CREATE POLICY "Users can view own tasks"
  ON timesheet.tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON timesheet.tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON timesheet.tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON timesheet.tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Subtasks policies
CREATE POLICY "Users can view own subtasks"
  ON timesheet.subtasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subtasks"
  ON timesheet.subtasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subtasks"
  ON timesheet.subtasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subtasks"
  ON timesheet.subtasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
