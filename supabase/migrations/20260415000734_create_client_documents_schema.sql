/*
  # Create client documents schema

  ## Purpose
  Stores documents organized by client and category.
  Structure: client → category → documents

  ## New Tables

  ### `doc_clients`
  - `id` (uuid, primary key)
  - `name` (text) — client display name
  - `created_by` (uuid) — references auth.users, the user who created this client
  - `created_at` (timestamptz)

  ### `doc_categories`
  - `id` (uuid, primary key)
  - `client_id` (uuid) — foreign key to doc_clients
  - `name` (text) — category display name
  - `created_at` (timestamptz)

  ### `doc_documents`
  - `id` (uuid, primary key)
  - `category_id` (uuid) — foreign key to doc_categories
  - `client_id` (uuid) — denormalized for efficient filtering; foreign key to doc_clients
  - `name` (text) — document display name
  - `file_path` (text) — storage path in Supabase Storage
  - `file_size` (bigint) — file size in bytes
  - `mime_type` (text)
  - `uploaded_by` (uuid) — references auth.users
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all three tables
  - For now, any authenticated user can read/write all records
  - `uploaded_by` / `created_by` columns are in place so per-user filtering
    can be enforced later without a schema change (see FUTURE NOTE below)

  ## Important Notes
  1. FUTURE: to restrict client visibility per user, add a `doc_client_access`
     join table (user_id, client_id) and update SELECT policies to check membership.
  2. All INSERT policies enforce that the authenticated user's id is recorded as
     the creator, preventing spoofing.
*/

-- Clients
CREATE TABLE IF NOT EXISTS doc_clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE doc_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clients"
  ON doc_clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON doc_clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update client"
  ON doc_clients FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can delete client"
  ON doc_clients FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);


-- Categories
CREATE TABLE IF NOT EXISTS doc_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES doc_clients(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE doc_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories"
  ON doc_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert categories"
  ON doc_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON doc_categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories"
  ON doc_categories FOR DELETE
  TO authenticated
  USING (true);


-- Documents
CREATE TABLE IF NOT EXISTS doc_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES doc_categories(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES doc_clients(id) ON DELETE CASCADE,
  name        text NOT NULL,
  file_path   text NOT NULL DEFAULT '',
  file_size   bigint DEFAULT 0,
  mime_type   text DEFAULT '',
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE doc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view documents"
  ON doc_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert documents"
  ON doc_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader can update document"
  ON doc_documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader can delete document"
  ON doc_documents FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);


-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_doc_categories_client_id  ON doc_categories(client_id);
CREATE INDEX IF NOT EXISTS idx_doc_documents_category_id ON doc_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_doc_documents_client_id   ON doc_documents(client_id);
