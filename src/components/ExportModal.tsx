import { X, FileText, FileDown } from 'lucide-react';

interface ExportModalProps {
  onClose: () => void;
  onExportPdf: () => void;
  isExporting: boolean;
}

export function ExportModal({ onClose, onExportPdf, isExporting }: ExportModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Exporter le rapport</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <button
            onClick={onExportPdf}
            disabled={isExporting}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {isExporting ? 'Préparation...' : 'Exporter en PDF'}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">Rapport complet, prêt à imprimer</div>
            </div>
          </button>

          <button
            disabled
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 opacity-40 cursor-not-allowed text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <FileDown size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Exporter en Word</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">Disponible prochainement</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
