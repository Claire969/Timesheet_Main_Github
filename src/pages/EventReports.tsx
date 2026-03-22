import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, Calendar, Building2, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { reportApi } from '../lib/eventReportApi';
import type { EventReport } from '../lib/eventReportTypes';

type ReportRow = EventReport & { venue_client_name?: string; venue_client_logo?: string };

const STATUS_LABELS: Record<EventReport['status'], string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  completed: 'Terminé',
};

const STATUS_COLORS: Record<EventReport['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const EventReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await reportApi.list();
        setReports(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const handleArchive = async (e: React.MouseEvent, id: string, archive: boolean) => {
    e.stopPropagation();
    setActioningId(id);
    try {
      await reportApi.archive(id, archive);
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, is_archived: archive } : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce rapport ? Cette action est irréversible.')) return;
    setActioningId(id);
    try {
      await reportApi.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setActioningId(null);
    }
  };

  const active = reports.filter((r) => !r.is_archived);
  const archived = reports.filter((r) => r.is_archived);

  const renderRow = (r: ReportRow) => (
    <div key={r.id} className="flex items-stretch gap-2">
      <button
        onClick={() => navigate(`/event-reports/${r.id}`)}
        className={`flex-1 text-left p-4 rounded-xl border transition-all ${
          r.is_archived
            ? 'bg-gray-50 border-gray-200 hover:border-gray-300 opacity-75'
            : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-md'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold text-gray-900 truncate">{r.event_name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>
                {STATUS_LABELS[r.status]}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
              {r.final_client_name && (
                <span className="flex items-center gap-1">
                  <Building2 size={13} />
                  {r.final_client_name}
                </span>
              )}
              {r.venue_client_name && (
                <span className="text-gray-400">{r.venue_client_name}</span>
              )}
              {r.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {fmtDate(r.start_date)}
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-sm font-semibold text-gray-700">
              Jour {r.current_day} / {r.total_days}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {r.total_days} jour{r.total_days > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </button>

      <div className="flex flex-col gap-1.5 justify-center">
        {r.is_archived ? (
          <button
            onClick={(e) => handleArchive(e, r.id, false)}
            disabled={actioningId === r.id}
            title="Désarchiver"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <ArchiveRestore size={15} />
            <span className="hidden sm:inline">Désarchiver</span>
          </button>
        ) : (
          <button
            onClick={(e) => handleArchive(e, r.id, true)}
            disabled={actioningId === r.id}
            title="Archiver"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <Archive size={15} />
            <span className="hidden sm:inline">Archiver</span>
          </button>
        )}
        <button
          onClick={(e) => handleDelete(e, r.id)}
          disabled={actioningId === r.id}
          title="Supprimer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          <Trash2 size={15} />
          <span className="hidden sm:inline">Supprimer</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors text-sm"
            >
              <ArrowLeft size={16} />
              Retour
            </button>
            <span className="text-gray-300">|</span>
            <h1 className="text-lg font-bold text-gray-900">Rapports événement</h1>
          </div>
          <button
            onClick={() => navigate('/event-reports/new')}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm px-4 py-2.5 shadow-sm transition-colors"
          >
            <Plus size={16} />
            Nouveau rapport
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {isLoading && (
          <div className="text-center py-16 text-gray-400 text-sm">Chargement...</div>
        )}

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {!isLoading && reports.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">Aucun rapport pour le moment</p>
            <button
              onClick={() => navigate('/event-reports/new')}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Créer un premier rapport
            </button>
          </div>
        )}

        {!isLoading && reports.length > 0 && (
          <div className="space-y-8">
            {active.length > 0 && (
              <div className="space-y-3">
                {active.map(renderRow)}
              </div>
            )}

            {archived.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Archive size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-400">Archivés ({archived.length})</span>
                </div>
                <div className="space-y-3">
                  {archived.map(renderRow)}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
