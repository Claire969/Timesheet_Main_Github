export interface DocClientEntry {
  slug: string;
  name: string;
}

export interface DocCategoryEntry {
  slug: string;
  name: string;
  clientSlug: string;
}

export interface DocFileEntry {
  name: string;        // physical filename on disk — never changes
  title: string;       // user-editable display title (defaults to filename)
  size: number;
  modifiedAt: string;
  type: 'PDF' | 'Image' | 'DOC' | 'XLSX' | 'Autre';
  mime: string;
  url: string;
  downloadUrl: string;
  clientSlug: string;
  categorySlug: string;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCategories(clientSlug: string): Promise<DocCategoryEntry[]> {
  return apiGet(`/client-docs/categories?client=${encodeURIComponent(clientSlug)}`);
}

export async function fetchFiles(clientSlug: string, categorySlug: string): Promise<DocFileEntry[]> {
  return apiGet(`/client-docs/list?client=${encodeURIComponent(clientSlug)}&category=${encodeURIComponent(categorySlug)}`);
}

export async function createCategory(clientSlug: string, categoryName: string): Promise<DocCategoryEntry> {
  return apiPost('/client-docs/category', { clientSlug, categoryName });
}

export async function uploadFiles(
  clientSlug: string,
  categorySlug: string,
  files: File[],
): Promise<{ uploaded: DocFileEntry[]; errors: string[] }> {
  const form = new FormData();
  form.append('clientSlug', clientSlug);
  form.append('categorySlug', categorySlug);
  for (const f of files) form.append('files', f);
  const res = await fetch('/client-docs/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ uploaded: DocFileEntry[]; errors: string[] }>;
}

export interface UpdateMetaPayload {
  clientSlug: string;
  categorySlug: string;
  filename: string;
  title?: string;
  newCategoryName?: string;
}

export interface UpdateMetaResult {
  file: DocFileEntry;
  movedTo?: string; // new categorySlug if file was moved
}

export async function updateMeta(payload: UpdateMetaPayload): Promise<UpdateMetaResult> {
  const res = await fetch('/client-docs/meta', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<UpdateMetaResult>;
}

export async function deleteFile(clientSlug: string, categorySlug: string, filename: string): Promise<void> {
  const res = await fetch(
    `/client-docs/file?client=${encodeURIComponent(clientSlug)}&category=${encodeURIComponent(categorySlug)}&name=${encodeURIComponent(filename)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function slugifyClientName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

// Case-insensitive category lookup in a local list
export function findCategoryCI(cats: DocCategoryEntry[], nameOrSlug: string): DocCategoryEntry | undefined {
  const lower = nameOrSlug.trim().toLowerCase();
  return cats.find(c => c.name.toLowerCase() === lower || c.slug.toLowerCase() === lower);
}
