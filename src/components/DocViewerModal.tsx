import { useState } from 'react';
import { X, Download, ExternalLink, Printer, Pencil, Trash2, Check, ChevronDown } from 'lucide-react';
import type { DocFileEntry, DocCategoryEntry } from '../lib/clientDocsApi';
import { formatFileSize } from '../lib/clientDocsApi';

interface Props {
  file: DocFileEntry;
  categories: DocCategoryEntry[];
  onClose: () => void;
  onSave: (title: string, newCategoryName: string | null) => Promise<void>;
  onDelete: () => void;
}

export function DocViewerModal({ file, categories, onClose, onSave, onDelete }: Props) {
  const canPreview = file.type === 'PDF' || file.type === 'Image';

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(file.title);
  const currentCatName = categories.find(c => c.slug === file.categorySlug)?.name ?? file.categorySlug;
  const [catInput, setCatInput] = useState(currentCatName);
  const [showCatSugg, setShowCatSugg] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredCats = catInput.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(catInput.toLowerCase()))
    : categories;

  const handleSave = async () => {
    setSaving(true);
    try {
      const newCategoryName = catInput.trim().toLowerCase() !== currentCatName.toLowerCase()
        ? catInput.trim()
        : null;
      await onSave(editTitle.trim() || file.name, newCategoryName);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          {editing ? (
            <div className="flex-1 mr-4 space-y-2">
              <input
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                className="w-full px-3 py-1.5 text-sm font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Titre du document"
              />
              <div className="relative">
                <input
                  value={catInput}
                  onChange={e => { setCatInput(e.target.value); setShowCatSugg(true); }}
                  onFocus={() => setShowCatSugg(true)}
                  onBlur={() => setTimeout(() => setShowCatSugg(false), 150)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Catégorie"
                />
                {showCatSugg && filteredCats.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-36 overflow-y-auto">
                    {filteredCats.map(c => (
                      <button
                        key={c.slug}
                        onClick={() => { setCatInput(c.name); setShowCatSugg(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="min-w-0 mr-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{file.title}</p>
              {file.title !== file.name && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{file.name}</p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {formatFileSize(file.size)} · {file.type}
              </p>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  <Check size={12} />
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditTitle(file.title); setCatInput(currentCatName); }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Modifier"
                >
                  <Pencil size={13} />
                  Modifier
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={13} />
                </button>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <ExternalLink size={13} />
                  Ouvrir
                </a>
                <a
                  href={file.downloadUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Download size={13} />
                  Télécharger
                </a>
                {file.type === 'PDF' && (
                  <button
                    onClick={() => window.open(file.url, '_blank')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Printer size={13} />
                    Imprimer
                  </button>
                )}
              </>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Preview ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto min-h-0 bg-gray-100 dark:bg-gray-800">
          {file.type === 'Image' && (
            <div className="flex items-center justify-center min-h-[400px] p-4">
              <img
                src={file.url}
                alt={file.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
              />
            </div>
          )}
          {file.type === 'PDF' && (
            <iframe
              src={file.url}
              className="w-full h-full min-h-[500px]"
              title={file.title}
            />
          )}
          {!canPreview && (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center p-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aperçu non disponible pour ce type de fichier.
              </p>
              <a
                href={file.downloadUrl}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download size={14} />
                Télécharger le fichier
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
