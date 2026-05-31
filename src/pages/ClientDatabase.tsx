import { useState, useCallback, useEffect } from 'react';
import { AppNav } from '../components/AppNav';
import { DocFileCard } from '../components/DocFileCard';
import { DocViewerModal } from '../components/DocViewerModal';
import { DocUploadPanel } from '../components/DocUploadPanel';
import {
  Database, Upload, ChevronDown, LayoutGrid, List,
  X, Check, Pencil, Trash2, Plus, ArrowUp, ArrowDown,
} from 'lucide-react';
import { useAppState } from '../App';
import { useLoadClients } from '../lib/useLoadClients';
import {
  fetchCategories,
  fetchFiles,
  slugifyClientName,
  updateMeta,
  deleteFile as apiDeleteFile,
  findCategoryCI,
  renameCategory,
  deleteCategory,
  createCategory,
  DEFAULT_CATEGORY_SLUG,
} from '../lib/clientDocsApi';
import type { DocClientEntry, DocCategoryEntry, DocFileEntry } from '../lib/clientDocsApi';

const selectCls = 'flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer';

const fieldCls = 'w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = 'title' | 'type' | 'size' | 'modifiedAt';
type SortDir = 'asc' | 'desc';

function sortFiles(files: DocFileEntry[], key: SortKey, dir: SortDir): DocFileEntry[] {
  return [...files].sort((a, b) => {
    let cmp = 0;
    if (key === 'title')      cmp = a.title.localeCompare(b.title);
    else if (key === 'type')  cmp = a.type.localeCompare(b.type);
    else if (key === 'size')  cmp = a.size - b.size;
    else                      cmp = a.modifiedAt.localeCompare(b.modifiedAt);
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  file: DocFileEntry;
  categories: DocCategoryEntry[];
  onSave: (title: string, newCategoryName: string | null) => Promise<void>;
  onClose: () => void;
}

function DocEditModal({ file, categories, onSave, onClose }: EditModalProps) {
  const [title, setTitle] = useState(file.title);
  const currentCatName = categories.find(c => c.slug === file.categorySlug)?.name ?? file.categorySlug;
  const [catInput, setCatInput] = useState(currentCatName);
  const [showSugg, setShowSugg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filteredCats = catInput.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(catInput.toLowerCase()))
    : categories;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const newCatName = catInput.trim().toLowerCase() !== currentCatName.toLowerCase()
        ? catInput.trim()
        : null;
      await onSave(title.trim() || file.name, newCatName);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Pencil size={14} className="text-blue-600" />
            Modifier le document
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Titre</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
              className={fieldCls}
              placeholder="Titre du document"
            />
            <p className="text-[11px] text-gray-400">Fichier physique : {file.name}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Catégorie</label>
            <div className="relative">
              <input
                value={catInput}
                onChange={e => { setCatInput(e.target.value); setShowSugg(true); }}
                onFocus={() => setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                className={fieldCls}
                placeholder="Catégorie"
              />
              {showSugg && filteredCats.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {filteredCats.map(c => (
                    <button key={c.slug} onClick={() => { setCatInput(c.name); setShowSugg(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            <Check size={14} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  label: string;
  detail?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ label, detail, confirmLabel = 'Supprimer', onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</h2>
            {detail && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            Annuler
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category manager modal ───────────────────────────────────────────────────

interface CatManagerProps {
  clientSlug: string;
  categories: DocCategoryEntry[];
  onClose: () => void;
  onChanged: () => void;
}

function CategoryManager({ clientSlug, categories, onClose, onChanged }: CatManagerProps) {
  const [newCatName, setNewCatName] = useState('');
  const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!newCatName.trim()) return;
    setBusy(true); setError('');
    try {
      await createCategory(clientSlug, newCatName.trim());
      setNewCatName('');
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(false); }
  };

  const handleRename = async (slug: string) => {
    if (!renameValue.trim()) return;
    setBusy(true); setError('');
    try {
      await renameCategory(clientSlug, slug, renameValue.trim());
      setRenamingSlug(null);
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(false); }
  };

  const handleDelete = async (slug: string) => {
    setBusy(true); setError('');
    try {
      await deleteCategory(clientSlug, slug);
      setDeletingSlug(null);
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Gérer les catégories</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Existing categories */}
          {categories.map(cat => (
            <div key={cat.slug} className="flex items-center gap-2">
              {renamingSlug === cat.slug ? (
                <>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(cat.slug); if (e.key === 'Escape') setRenamingSlug(null); }}
                    className={`flex-1 ${fieldCls}`}
                  />
                  <button onClick={() => handleRename(cat.slug)} disabled={busy}
                    className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setRenamingSlug(null)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X size={13} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">{cat.name}</span>
                  {cat.slug === DEFAULT_CATEGORY_SLUG && (
                    <span className="text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">défaut</span>
                  )}
                  <button onClick={() => { setRenamingSlug(cat.slug); setRenameValue(cat.name); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button
                    disabled={cat.slug === DEFAULT_CATEGORY_SLUG}
                    onClick={() => setDeletingSlug(cat.slug)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* New category row */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="Nouvelle catégorie…"
              className={`flex-1 ${fieldCls}`}
            />
            <button onClick={handleCreate} disabled={busy || !newCatName.trim()}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors">
              <Plus size={14} />
            </button>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {deletingSlug && (
        <DeleteConfirm
          label="Supprimer cette catégorie ?"
          detail="Les documents seront déplacés vers la catégorie par défaut (Général)."
          onConfirm={() => handleDelete(deletingSlug)}
          onCancel={() => setDeletingSlug(null)}
        />
      )}
    </div>
  );
}

// ─── Sort indicator ───────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <span className="w-3" />;
  return sortDir === 'asc' ? <ArrowUp size={11} className="text-blue-500" /> : <ArrowDown size={11} className="text-blue-500" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ClientDatabase() {
  // Load clients automatically when this page is opened directly
  useLoadClients();

  const { clients: appClients } = useAppState();
  const clients: DocClientEntry[] = appClients
    .filter(c => !c.isArchived)
    .map(c => ({ slug: slugifyClientName(c.name), name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const [categories, setCategories] = useState<DocCategoryEntry[]>([]);
  const [files, setFiles] = useState<DocFileEntry[]>([]);

  const [selectedClient, setSelectedClient] = useState<DocClientEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocCategoryEntry | null>(null);

  const [loadingFiles, setLoadingFiles] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [viewerFile, setViewerFile] = useState<DocFileEntry | null>(null);
  const [editFile, setEditFile] = useState<DocFileEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocFileEntry | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);

  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [categoryDropOpen, setCategoryDropOpen] = useState(false);

  const loadCategories = useCallback(async (client: DocClientEntry) => {
    const cats = await fetchCategories(client.slug).catch(() => [] as DocCategoryEntry[]);
    setCategories(cats);
    return cats;
  }, []);

  const loadFiles = useCallback(async (client: DocClientEntry, category: DocCategoryEntry) => {
    setLoadingFiles(true);
    const result = await fetchFiles(client.slug, category.slug).catch(() => [] as DocFileEntry[]);
    setFiles(result);
    setLoadingFiles(false);
  }, []);

  const handleSelectClient = async (client: DocClientEntry | null) => {
    setSelectedClient(client);
    setSelectedCategory(null);
    setFiles([]);
    setClientDropOpen(false);
    if (!client) { setCategories([]); return; }
    const cats = await loadCategories(client);
    if (cats.length > 0) {
      setSelectedCategory(cats[0]);
      await loadFiles(client, cats[0]);
    }
  };

  const handleSelectCategory = async (cat: DocCategoryEntry | null) => {
    setSelectedCategory(cat);
    setCategoryDropOpen(false);
    if (!cat || !selectedClient) { setFiles([]); return; }
    await loadFiles(selectedClient, cat);
  };

  const handleUploaded = async (newFiles: DocFileEntry[], clientSlug: string, categorySlug: string) => {
    const updatedClient = clients.find(c => c.slug === clientSlug) ?? { slug: clientSlug, name: clientSlug };
    setSelectedClient(updatedClient);
    const cats = await loadCategories(updatedClient);
    const cat = cats.find(c => c.slug === categorySlug) ?? null;
    setSelectedCategory(cat);
    if (cat) await loadFiles(updatedClient, cat);
    else setFiles(prev => [...prev, ...newFiles]);
  };

  // ── Sort toggle ─────────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortedFiles = sortFiles(files, sortKey, sortDir);

  // ── Edit save ───────────────────────────────────────────────────────────────
  const handleSaveMeta = async (file: DocFileEntry, title: string, newCategoryName: string | null) => {
    const result = await updateMeta({
      clientSlug: file.clientSlug,
      categorySlug: file.categorySlug,
      filename: file.name,
      title,
      newCategoryName: newCategoryName ?? undefined,
    });

    const movedTo = result.movedTo;
    if (movedTo && movedTo !== file.categorySlug) {
      if (selectedClient) await loadCategories(selectedClient);
      if (selectedCategory?.slug === file.categorySlug) {
        setFiles(prev => prev.filter(f => f.name !== file.name));
      }
    } else {
      setFiles(prev => prev.map(f =>
        f.name === file.name && f.categorySlug === file.categorySlug ? result.file : f
      ));
    }

    if (viewerFile?.name === file.name) {
      setViewerFile(movedTo && movedTo !== file.categorySlug ? null : result.file);
    }
  };

  // ── Delete file ─────────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDeleteFile(deleteTarget.clientSlug, deleteTarget.categorySlug, deleteTarget.name);
      setFiles(prev => prev.filter(f => !(f.name === deleteTarget.name && f.categorySlug === deleteTarget.categorySlug)));
      if (viewerFile?.name === deleteTarget.name) setViewerFile(null);
    } catch (e) { console.error('Delete failed', e); }
    setDeleteTarget(null);
  };

  // ── Category manager refresh ────────────────────────────────────────────────
  const handleCatChanged = async () => {
    if (!selectedClient) return;
    const cats = await loadCategories(selectedClient);
    // If the selected category was deleted, switch to the default one
    if (selectedCategory && !cats.find(c => c.slug === selectedCategory.slug)) {
      const defaultCat = cats.find(c => c.slug === DEFAULT_CATEGORY_SLUG) ?? cats[0] ?? null;
      setSelectedCategory(defaultCat);
      if (defaultCat) await loadFiles(selectedClient, defaultCat);
      else setFiles([]);
    }
  };

  const visibleCategories = selectedClient ? categories : [];

  return (
    <div className="relative min-h-screen bg-white dark:bg-gray-900 pt-14 overflow-hidden">
      <AppNav />

      <img
        src="/images/ui/map.png"
        alt=""
        aria-hidden="true"
        className="hidden sm:block absolute top-10 left-0 w-[460px] lg:w-[580px] h-auto object-contain pointer-events-none select-none z-0"
        style={{ opacity: 0.19 }}
      />

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Base clients</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Organisez vos documents par client et par catégorie. Accédez rapidement aux fichiers liés à chaque dossier.
          </p>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Client dropdown */}
          <div className="relative">
            <button className={selectCls}
              onClick={() => { setClientDropOpen(v => !v); setCategoryDropOpen(false); }}>
              <span>{selectedClient ? selectedClient.name : 'Tous les clients'}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            {clientDropOpen && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 max-h-60 overflow-y-auto">
                <button onClick={() => handleSelectClient(null)}
                  className="w-full text-left px-3.5 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Tous les clients
                </button>
                {clients.map(c => (
                  <button key={c.slug} onClick={() => handleSelectClient(c)}
                    className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${
                      selectedClient?.slug === c.slug
                        ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}>
                    {c.name}
                  </button>
                ))}
                {clients.length === 0 && (
                  <p className="px-3.5 py-2 text-xs text-gray-400">Aucun client dans la base</p>
                )}
              </div>
            )}
          </div>

          {/* Category dropdown */}
          <div className="relative">
            <button
              className={`${selectCls} ${!selectedClient ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => { if (!selectedClient) return; setCategoryDropOpen(v => !v); setClientDropOpen(false); }}>
              <span>{selectedCategory ? selectedCategory.name : 'Toutes les catégories'}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            {categoryDropOpen && selectedClient && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 max-h-60 overflow-y-auto">
                {visibleCategories.map(c => (
                  <button key={c.slug} onClick={() => handleSelectCategory(c)}
                    className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${
                      selectedCategory?.slug === c.slug
                        ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}>
                    {c.name}
                  </button>
                ))}
                {visibleCategories.length === 0 && (
                  <p className="px-3.5 py-2 text-xs text-gray-400">Aucune catégorie</p>
                )}
              </div>
            )}
          </div>

          {/* Category manager button */}
          {selectedClient && (
            <button
              onClick={() => setShowCatManager(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              title="Gérer les catégories"
            >
              <Pencil size={13} />
              Catégories
            </button>
          )}

          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
              title="Vue grille">
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
              title="Vue liste">
              <List size={15} />
            </button>
          </div>

          {/* Upload button */}
          <div className="sm:ml-auto">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Upload size={14} />
              Importer un document
            </button>
          </div>
        </div>

        {/* ── File area ─────────────────────────────────────────────────── */}
        {loadingFiles ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedFiles.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {sortedFiles.map(f => (
                <DocFileCard key={`${f.categorySlug}/${f.name}`} file={f} viewMode="grid"
                  onClick={() => setViewerFile(f)}
                  onEdit={() => setEditFile(f)}
                  onDelete={() => setDeleteTarget(f)} />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Sortable list header */}
              <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 px-4 pb-1">
                <div className="w-9" />
                <button onClick={() => handleSort('title')}
                  className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-300 text-left">
                  Titre <SortIcon col="title" sortKey={sortKey} sortDir={sortDir} />
                </button>
                <button onClick={() => handleSort('type')}
                  className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-300 w-16 text-right justify-end">
                  Type <SortIcon col="type" sortKey={sortKey} sortDir={sortDir} />
                </button>
                <button onClick={() => handleSort('size')}
                  className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-300 w-16 text-right justify-end">
                  Taille <SortIcon col="size" sortKey={sortKey} sortDir={sortDir} />
                </button>
                <button onClick={() => handleSort('modifiedAt')}
                  className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-300 w-28 text-right justify-end">
                  Modifié <SortIcon col="modifiedAt" sortKey={sortKey} sortDir={sortDir} />
                </button>
                <div className="w-32" />
              </div>
              {sortedFiles.map(f => (
                <DocFileCard key={`${f.categorySlug}/${f.name}`} file={f} viewMode="list"
                  onClick={() => setViewerFile(f)}
                  onEdit={() => setEditFile(f)}
                  onDelete={() => setDeleteTarget(f)} />
              ))}
            </div>
          )
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-16 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Database size={22} className="text-gray-400 dark:text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Aucun document chargé</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                {selectedClient && selectedCategory
                  ? 'Cette catégorie ne contient pas encore de documents.'
                  : 'Sélectionnez un client et une catégorie, puis importez vos documents pour les retrouver ici.'}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Viewer modal */}
      {viewerFile && (
        <DocViewerModal
          file={viewerFile}
          categories={categories}
          onClose={() => setViewerFile(null)}
          onSave={(title, newCatName) => handleSaveMeta(viewerFile, title, newCatName)}
          onDelete={() => { setDeleteTarget(viewerFile); setViewerFile(null); }}
        />
      )}

      {/* Edit modal (from card) */}
      {editFile && (
        <DocEditModal
          file={editFile}
          categories={categories}
          onSave={(title, newCatName) => handleSaveMeta(editFile, title, newCatName)}
          onClose={() => setEditFile(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirm
          label="Supprimer ce document ?"
          detail={`« ${deleteTarget.title} » sera définitivement supprimé du serveur.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Category manager */}
      {showCatManager && selectedClient && (
        <CategoryManager
          clientSlug={selectedClient.slug}
          categories={categories}
          onClose={() => setShowCatManager(false)}
          onChanged={handleCatChanged}
        />
      )}

      {/* Upload panel */}
      {showUpload && (
        <DocUploadPanel
          clients={clients}
          initialClientSlug={selectedClient?.slug}
          initialCategorySlug={selectedCategory?.slug}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}
