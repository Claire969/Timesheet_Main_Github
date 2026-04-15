import { useState, useEffect, useCallback } from 'react';
import { AppNav } from '../components/AppNav';
import { DocFileCard } from '../components/DocFileCard';
import { DocViewerModal } from '../components/DocViewerModal';
import { DocUploadPanel } from '../components/DocUploadPanel';
import { Database, Upload, ChevronDown } from 'lucide-react';
import {
  fetchClients,
  fetchCategories,
  fetchFiles,
} from '../lib/clientDocsApi';
import type { DocClientEntry, DocCategoryEntry, DocFileEntry } from '../lib/clientDocsApi';

// FUTURE: filter clients by auth.uid() via doc_client_access when per-user
// visibility is implemented. The fetchClients() call is the single place to add that filter.

const selectCls = 'flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer';

export function ClientDatabase() {
  const [clients, setClients] = useState<DocClientEntry[]>([]);
  const [categories, setCategories] = useState<DocCategoryEntry[]>([]);
  const [files, setFiles] = useState<DocFileEntry[]>([]);

  const [selectedClient, setSelectedClient] = useState<DocClientEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocCategoryEntry | null>(null);

  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [viewerFile, setViewerFile] = useState<DocFileEntry | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [categoryDropOpen, setCategoryDropOpen] = useState(false);

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    const result = await fetchClients().catch(() => [] as DocClientEntry[]);
    setClients(result);
    setLoadingClients(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

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
    await loadClients();
    const updatedClient = clients.find(c => c.slug === clientSlug) ?? { slug: clientSlug, name: clientSlug };
    setSelectedClient(updatedClient);
    const cats = await loadCategories(updatedClient);
    const cat = cats.find(c => c.slug === categorySlug) ?? null;
    setSelectedCategory(cat);
    if (cat) {
      await loadFiles(updatedClient, cat);
    } else {
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const visibleCategories = selectedClient
    ? categories
    : [];

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

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button
              className={selectCls}
              onClick={() => { setClientDropOpen(v => !v); setCategoryDropOpen(false); }}
            >
              <span>{selectedClient ? selectedClient.name : 'Tous les clients'}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            {clientDropOpen && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 max-h-60 overflow-y-auto">
                <button
                  onClick={() => handleSelectClient(null)}
                  className="w-full text-left px-3.5 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Tous les clients
                </button>
                {clients.map(c => (
                  <button
                    key={c.slug}
                    onClick={() => handleSelectClient(c)}
                    className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${
                      selectedClient?.slug === c.slug
                        ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {!loadingClients && clients.length === 0 && (
                  <p className="px-3.5 py-2 text-xs text-gray-400">Aucun client</p>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              className={`${selectCls} ${!selectedClient ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => {
                if (!selectedClient) return;
                setCategoryDropOpen(v => !v);
                setClientDropOpen(false);
              }}
            >
              <span>{selectedCategory ? selectedCategory.name : 'Toutes les catégories'}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            {categoryDropOpen && selectedClient && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 max-h-60 overflow-y-auto">
                {visibleCategories.map(c => (
                  <button
                    key={c.slug}
                    onClick={() => handleSelectCategory(c)}
                    className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${
                      selectedCategory?.slug === c.slug
                        ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {visibleCategories.length === 0 && (
                  <p className="px-3.5 py-2 text-xs text-gray-400">Aucune catégorie</p>
                )}
              </div>
            )}
          </div>

          <div className="sm:ml-auto">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Upload size={14} />
              Importer un document
            </button>
          </div>
        </div>

        {loadingFiles ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : files.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {files.map(f => (
              <DocFileCard key={f.name} file={f} onClick={() => setViewerFile(f)} />
            ))}
          </div>
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

      {viewerFile && (
        <DocViewerModal file={viewerFile} onClose={() => setViewerFile(null)} />
      )}

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
