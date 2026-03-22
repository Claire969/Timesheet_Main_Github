import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, Calendar, Building2 } from 'lucide-react';
import { reportApi } from '../lib/eventReportApi';
import type { EventReport } from '../lib/eventReportTypes';

type ReportRow = EventReport & { client_name?: string; venue_name?: string };

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
          <div className="space-y-3">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/event-reports/${r.id}`)}
                className="w-full text-left p-4 rounded-xl bg-white border border-gray-200 hover:border-blue-200 hover:shadow-md transition-all"
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
                      {r.client_name && (
                        <span className="flex items-center gap-1">
                          <Building2 size={13} />
                          {r.client_name}
                        </span>
                      )}
                      {r.venue_name && (
                        <span className="text-gray-400">{r.venue_name}</span>
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
