import { X, Download, ExternalLink, Printer } from 'lucide-react';
import type { DocFileEntry } from '../lib/clientDocsApi';
import { formatFileSize } from '../lib/clientDocsApi';

interface Props {
  file: DocFileEntry;
  onClose: () => void;
}

export function DocViewerModal({ file, onClose }: Props) {
  const canPreview = file.type === 'PDF' || file.type === 'Image';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="min-w-0 mr-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatFileSize(file.size)} · {file.type}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0 bg-gray-100 dark:bg-gray-800">
          {file.type === 'Image' && (
            <div className="flex items-center justify-center min-h-[400px] p-4">
              <img
                src={file.url}
                alt={file.name}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
              />
            </div>
          )}
          {file.type === 'PDF' && (
            <iframe
              src={file.url}
              className="w-full h-full min-h-[500px]"
              title={file.name}
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
