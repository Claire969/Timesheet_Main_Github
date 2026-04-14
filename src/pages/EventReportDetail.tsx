import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard as Edit, Calendar, Building2, MapPin, Download } from 'lucide-react';
import { reportApi, dayApi } from '../lib/eventReportApi';
import type { EventReport, EventReportDay } from '../lib/eventReportTypes';
import { AppNav } from '../components/AppNav';
import { ExportModal } from '../components/ExportModal';
import { usePdfExport } from '../lib/usePdfExport';

type ReportRow = EventReport & { venue_client_name?: string; venue_client_logo?: string | null };

const STATUS_LABELS: Record<EventReport['status'], string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  completed: 'Terminé',
};

const STATUS_COLORS: Record<EventReport['status'], string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
};

const DAY_STATUS_LABELS: Record<EventReportDay['status'], string> = {
  open: 'Ouvert',
  validated: 'Validé',
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const EventReportDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [report, setReport] = useState<ReportRow | null>(null);
  const [days, setDays] = useState<EventReportDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const { exportPdf, isExporting } = usePdfExport();

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [r, d] = await Promise.all([
          reportApi.get(id),
          dayApi.listForReport(id),
        ]);
        setReport(r);
        setDays(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [id]);

  const allValidated = days.length > 0 && days.every((d) => d.status === 'validated');

  const handleExportPdf = async () => {
    if (!report) return;
    setShowExportModal(false);
    await exportPdf(report, days);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Chargement...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <p className="text-red-600 dark:text-red-400 text-sm">{error ?? 'Rapport introuvable'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pt-14">
      <AppNav />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/event-reports')}
              className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors text-sm shrink-0"
            >
              <ArrowLeft size={16} />
              Retour
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{report.event_name}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {allValidated && (
              <button
                onClick={() => setShowExportModal(true)}
                disabled={isExporting}
                className="flex items-center gap-1.5 border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 rounded-xl text-sm px-3 py-2 transition-colors disabled:opacity-50"
              >
                <Download size={14} />
                {isExporting ? 'Export...' : 'Exporter'}
              </button>
            )}
            <button
              onClick={() => navigate(`/event-reports/${id}/edit`)}
              className="flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm px-3 py-2 transition-colors"
            >
              <Edit size={14} />
              Modifier
            </button>
          </div>
        </div>
        <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-1">{report.event_name}</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[report.status]}`}>
                {STATUS_LABELS[report.status]}
              </span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                {report.current_day > report.total_days ? report.total_days : report.current_day}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">/ {report.total_days} jour{report.total_days > 1 ? 's' : ''}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 pt-1">
            {report.final_client_name && (
              <span className="flex items-center gap-1.5">
                <Building2 size={14} className="text-gray-400 dark:text-gray-500" />
                {report.final_client_name}
              </span>
            )}
            {report.venue_client_name && (
              <span className="flex items-center gap-1.5">
                {report.venue_client_logo ? (
                  <img
                    src={report.venue_client_logo}
                    alt={report.venue_client_name}
                    className="w-4 h-4 object-contain rounded"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <MapPin size={14} className="text-gray-400 dark:text-gray-500" />
                )}
                {report.venue_client_name}
              </span>
            )}
            {report.start_date && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400 dark:text-gray-500" />
                {fmtDate(report.start_date)}
              </span>
            )}
          </div>

        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Jours</h3>
          <div className="space-y-2">
            {days.map((day) => {
              const isCurrent = day.day_number === report.current_day && report.status !== 'completed';
              return (
                <button
                  key={day.id}
                  onClick={() => navigate(`/event-reports/${id}/days/${day.id}`)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isCurrent
                      ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-200 dark:hover:border-blue-600 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        day.status === 'validated'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : isCurrent
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}>
                        {day.day_number}
                      </span>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                          Jour {day.day_number}
                          {isCurrent && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">Jour courant</span>}
                        </div>
                        {day.report_date && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(day.report_date)}</div>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      day.status === 'validated'
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {DAY_STATUS_LABELS[day.status]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onExportPdf={handleExportPdf}
          isExporting={isExporting}
        />
      )}
    </div>
  );
};
