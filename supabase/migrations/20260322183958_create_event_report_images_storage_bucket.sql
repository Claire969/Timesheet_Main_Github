/*
  # Create storage bucket for event report images

  ## Changes
  - Creates a private storage bucket `event-report-images`
  - Adds RLS policies so authenticated users can upload/read/delete
    only files under their own user_id prefix

  ## Security
  - Bucket is private (not public)
  - Policies scope access by auth.uid() in the file path
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-report-images',
  'event-report-images',
  false,
  10485760,
  ARRAY['image/png','image/jpeg','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload event report images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-report-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can read own event report images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'event-report-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can delete own event report images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-report-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
