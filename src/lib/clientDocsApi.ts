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

async function apiReq<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function apiGet<T>(url: string) {
  return apiReq<T>(url);
}

function apiPost<T>(url: string, body: unknown) {
  return apiReq<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function apiPatch<T>(url: string, body: unknown) {
  return apiReq<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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

export async function renameCategory(
  clientSlug: string,
  categorySlug: string,
  newName: string,
): Promise<DocCategoryEntry> {
  return apiPatch('/client-docs/category', { clientSlug, categorySlug, newName });
}

export async function deleteCategory(
  clientSlug: string,
  categorySlug: string,
): Promise<{ ok: boolean; movedTo: string; movedFiles: string[] }> {
  const res = await fetch(
    `/client-docs/category?client=${encodeURIComponent(clientSlug)}&category=${encodeURIComponent(categorySlug)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
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
  movedTo?: string;
}

export async function updateMeta(payload: UpdateMetaPayload): Promise<UpdateMetaResult> {
  return apiPatch('/client-docs/meta', payload);
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

export function findCategoryCI(cats: DocCategoryEntry[], nameOrSlug: string): DocCategoryEntry | undefined {
  const lower = nameOrSlug.trim().toLowerCase();
  return cats.find(c => c.name.toLowerCase() === lower || c.slug.toLowerCase() === lower);
}

export const DEFAULT_CATEGORY_SLUG = 'general';
