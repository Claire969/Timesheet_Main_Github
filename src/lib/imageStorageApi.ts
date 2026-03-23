import { supabase } from './supabaseClient';

const BUCKET = 'event-report-images';

export function extractStoragePath(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const pathname = url.pathname;
    const bucketPrefix = `${BUCKET}/`;
    const idx = pathname.indexOf(bucketPrefix);
    if (idx === -1) return null;
    return pathname.slice(idx + bucketPrefix.length).split('?')[0];
  } catch {
    return null;
  }
}

export async function createSignedImageUrl(fileUrl: string, expiresIn = 3600): Promise<string | null> {
  const path = extractStoragePath(fileUrl);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function uploadImageBlob(
  blob: Blob,
  reportId: string,
  dayNumber: number
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non authentifié');

  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/event-reports/${reportId}/day-${dayNumber}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (data?.publicUrl) return data.publicUrl;

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw signErr;
  return signed.signedUrl;
}

export async function deleteStorageImage(fileUrl: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split(`/object/`);
    if (pathParts.length < 2) return;
    const withBucket = pathParts[1];
    const bucketPrefix = `${BUCKET}/`;
    if (!withBucket.startsWith(bucketPrefix)) return;
    const storagePath = withBucket.slice(bucketPrefix.length).split('?')[0];
    await supabase.storage.from(BUCKET).remove([storagePath]);
  } catch {
    // best-effort
  }
}
