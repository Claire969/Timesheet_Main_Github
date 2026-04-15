import { useState, useRef, useCallback } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { DocClientEntry, DocCategoryEntry, DocFileEntry } from '../lib/clientDocsApi';
import { createCategory, uploadFiles, fetchCategories } from '../lib/clientDocsApi';

interface Props {
  clients: DocClientEntry[];
  initialClientSlug?: string;
  initialCategorySlug?: string;
  onClose: () => void;
  onUploaded: (files: DocFileEntry[], clientSlug: string, categorySlug: string) => void;
}

type Status = 'idle' | 'uploading' | 'done' | 'error';

export function DocUploadPanel({
  clients,
  initialClientSlug,
  initialCategorySlug,
  onClose,
  onUploaded,
}: Props) {
  const [clientSlug, setClientSlug] = useState(initialClientSlug ?? (clients[0]?.slug ?? ''));
  const [categories, setCategories] = useState<DocCategoryEntry[]>([]);
  const [categoryInput, setCategoryInput] = useState(initialCategorySlug ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCategories = useCallback(async (slug: string) => {
    if (!slug) return;
    const cats = await fetchCategories(slug).catch(() => []);
    setCategories(cats);
  }, []);

  const handleClientChange = async (slug: string) => {
    setClientSlug(slug);
    setCategoryInput('');
    setShowSuggestions(false);
    await loadCategories(slug);
  };

  const filteredSuggestions = categoryInput.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(categoryInput.toLowerCase()))
    : categories;

  const handleAddFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setFiles(prev => [...prev, ...Array.from(incoming)]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleAddFiles(e.dataTransfer.files);
  };

  const handleSuggestionClick = (catName: string) => {
    setCategoryInput(catName);
    setShowSuggestions(false);
  };

  const handleUpload = async () => {
    const catNameTrimmed = categoryInput.trim();
    if (!clientSlug || !catNameTrimmed || files.length === 0) return;

    setStatus('uploading');
    setErrorMsg('');

    try {
      const existingCat = categories.find(c => c.name.toLowerCase() === catNameTrimmed.toLowerCase());
      let usedCatSlug = existingCat?.slug;

      if (!usedCatSlug) {
        const newCat = await createCategory(clientSlug, catNameTrimmed);
        usedCatSlug = newCat.slug;
        setCategories(prev => [...prev, newCat]);
      }

      const result = await uploadFiles(clientSlug, usedCatSlug, files);
      setStatus('done');
      onUploaded(result.uploaded, clientSlug, usedCatSlug);
      setTimeout(onClose, 1200);
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Erreur lors de l\'upload');
    }
  };

  const canUpload = clientSlug && categoryInput.trim() && files.length > 0 && status === 'idle';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Importer des documents</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Client</label>
            <select
              value={clientSlug}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {clients.length === 0 && <option value="">— aucun client —</option>}
              {clients.map(c => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Catégorie</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Saisissez ou sélectionnez"
                value={categoryInput}
                onChange={(e) => {
                  setCategoryInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                disabled={!clientSlug}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              {showSuggestions && clientSlug && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {filteredSuggestions.map(cat => (
                    <button
                      key={cat.slug}
                      onClick={() => handleSuggestionClick(cat.name)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
              dragging
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30'
            }`}
          >
            <Upload size={22} className="text-gray-400 dark:text-gray-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Glissez vos fichiers ici
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">ou cliquez pour sélectionner</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleAddFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <ul className="space-y-1.5 max-h-36 overflow-y-auto">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{f.name}</span>
                  <button
                    onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle size={14} />
              {errorMsg}
            </div>
          )}

          {status === 'done' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-sm">
              <CheckCircle size={14} />
              Fichiers importés avec succès
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleUpload}
            disabled={!canUpload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {status === 'uploading' ? (
              <><Loader2 size={14} className="animate-spin" /> Import en cours…</>
            ) : (
              <><Upload size={14} /> Importer {files.length > 0 ? `(${files.length})` : ''}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
