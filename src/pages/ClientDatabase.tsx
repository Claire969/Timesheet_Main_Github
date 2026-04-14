import { AppNav } from '../components/AppNav';
import { Database, Upload, ChevronDown } from 'lucide-react';

const selectCls = 'flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer';

export function ClientDatabase() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pt-14">
      <AppNav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Base clients</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Organisez vos documents par client et par catégorie. Accédez rapidement aux fichiers liés à chaque dossier.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className={selectCls}>
            <span>Tous les clients</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          <button className={selectCls}>
            <span>Toutes les catégories</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          <div className="sm:ml-auto">
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Upload size={14} />
              Importer un document
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Database size={22} className="text-gray-400 dark:text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Aucun document chargé</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 max-w-xs">
              Sélectionnez un client et une catégorie, puis importez vos documents pour les retrouver ici.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
