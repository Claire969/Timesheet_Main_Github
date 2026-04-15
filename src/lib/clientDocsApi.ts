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
  name: string;
  size: number;
  modifiedAt: string;
  type: 'PDF' | 'Image' | 'DOC' | 'XLSX' | 'Autre';
  mime: string;
  url: string;
  downloadUrl: string;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchClients(): Promise<DocClientEntry[]> {
  return apiGet('/client-docs/clients');
}

export async function fetchCategories(clientSlug: string): Promise<DocCategoryEntry[]> {
  return apiGet(`/client-docs/categories?client=${encodeURIComponent(clientSlug)}`);
}

export async function fetchFiles(clientSlug: string, categorySlug: string): Promise<DocFileEntry[]> {
  return apiGet(`/client-docs/list?client=${encodeURIComponent(clientSlug)}&category=${encodeURIComponent(categorySlug)}`);
}

export async function createCategory(clientSlug: string, categoryName: string): Promise<DocCategoryEntry> {
  const res = await fetch('/client-docs/category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientSlug, categoryName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<DocCategoryEntry>;
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
