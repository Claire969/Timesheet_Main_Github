import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckCircle, Save } from 'lucide-react';
import { dayApi, hourlyApi, incidentApi, imageApi, reportApi } from '../lib/eventReportApi';
import type {
  EventReportDay,
  EventReportHourlyRow,
  EventReportIncident,
  EventReportImage,
  EventReport,
} from '../lib/eventReportTypes';

const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export const EventReportDayEditor = () => {
  const navigate = useNavigate();
  const { reportId, dayId } = useParams<{ reportId: string; dayId: string }>();

  const [day, setDay] = useState<EventReportDay | null>(null);
  const [report, setReport] = useState<EventReport | null>(null);
  const [hourlyRows, setHourlyRows] = useState<EventReportHourlyRow[]>([]);
  const [incidents, setIncidents] = useState<EventReportIncident[]>([]);
  const [images, setImages] = useState<EventReportImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [dayForm, setDayForm] = useState({ report_date: '', summary: '', is_setup_day: false });

  const load = useCallback(async () => {
    if (!reportId || !dayId) return;
    try {
      const [d, r, hr, inc, img] = await Promise.all([
        dayApi.get(dayId),
        reportApi.get(reportId),
        hourlyApi.listForDay(dayId),
        incidentApi.listForDay(dayId),
        imageApi.listForDay(dayId),
      ]);
      setDay(d);
      setReport(r as EventReport);
      setHourlyRows(hr);
      setIncidents(inc);
      setImages(img);
      setDayForm({ report_date: d.report_date ?? '', summary: d.summary ?? '', is_setup_day: d.is_setup_day ?? false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [reportId, dayId]);

  useEffect(() => { void load(); }, [load]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  const handleSaveDay = async () => {
    if (!dayId) return;
    setIsSaving(true);
    try {
      await dayApi.update(dayId, {
        report_date: dayForm.report_date || null,
        summary: dayForm.summary,
        is_setup_day: dayForm.is_setup_day,
      });
      showSuccess('Sauvegardé');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!day || !report) return;
    if (day.status === 'validated') return;
    setIsValidating(true);
    try {
      await dayApi.update(dayId!, { report_date: dayForm.report_date || null, summary: dayForm.summary, is_setup_day: dayForm.is_setup_day });
      await dayApi.validate(day, report);
      showSuccess('Jour validé !');
      setTimeout(() => navigate(`/event-reports/${reportId}`), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la validation');
    } finally {
      setIsValidating(false);
    }
  };

  const handleAddHourlyRow = async () => {
    if (!dayId) return;
    try {
      const row = await hourlyApi.upsert({
        day_id: dayId,
        hour_label: '',
        wifi_users: 0,
        bandwidth_in: 0,
        bandwidth_out: 0,
        notes: '',
      });
      setHourlyRows((prev) => [...prev, row]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleUpdateHourlyRow = async (row: EventReportHourlyRow, field: keyof EventReportHourlyRow, value: string | number) => {
    const updated = { ...row, [field]: value };
    setHourlyRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    try {
      await hourlyApi.upsert(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleDeleteHourlyRow = async (id: string) => {
    setHourlyRows((prev) => prev.filter((r) => r.id !== id));
    try {
      await hourlyApi.delete(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleAddIncident = async () => {
    if (!dayId) return;
    try {
      const inc = await incidentApi.create({
        day_id: dayId,
        incident_time: null,
        title: '',
        description: '',
        resolution: '',
        network_impact: false,
        network_impact_text: null,
      });
      setIncidents((prev) => [...prev, inc]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleUpdateIncident = async (inc: EventReportIncident, field: keyof EventReportIncident, value: string | boolean | null) => {
    const updated = { ...inc, [field]: value };
    setIncidents((prev) => prev.map((i) => (i.id === inc.id ? updated : i)));
    try {
      await incidentApi.update(inc.id, { [field]: value });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleToggleNetworkImpact = async (inc: EventReportIncident, checked: boolean) => {
    const updated = { ...inc, network_impact: checked, network_impact_text: checked ? (inc.network_impact_text ?? '') : null };
    setIncidents((prev) => prev.map((i) => (i.id === inc.id ? updated : i)));
    try {
      await incidentApi.update(inc.id, { network_impact: checked, network_impact_text: checked ? (inc.network_impact_text ?? '') : null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleDeleteIncident = async (id: string) => {
    setIncidents((prev) => prev.filter((i) => i.id !== id));
    try {
      await incidentApi.delete(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleAddImage = async () => {
    if (!dayId) return;
    try {
      const img = await imageApi.create({
        day_id: dayId,
        file_url: '',
        caption: '',
        sort_order: images.length,
      });
      setImages((prev) => [...prev, img]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleUpdateImage = async (img: EventReportImage, field: keyof EventReportImage, value: string | number) => {
    const updated = { ...img, [field]: value };
    setImages((prev) => prev.map((i) => (i.id === img.id ? updated : i)));
    try {
      await imageApi.update(img.id, { [field]: value } as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleDeleteImage = async (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
    try {
      await imageApi.delete(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Chargement...</p>
      </div>
    );
  }

  const isValidated = day?.status === 'validated';

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/event-reports/${reportId}`)}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors text-sm shrink-0"
            >
              <ArrowLeft size={16} />
              Retour
            </button>
            <span className="text-gray-300">|</span>
            <h1 className="text-base font-bold text-gray-900 truncate">
              Jour {day?.day_number} — {report?.event_name}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {successMsg && (
              <span className="text-xs text-green-600 font-medium">{successMsg}</span>
            )}
            {!isValidated && (
              <button
                onClick={handleSaveDay}
                disabled={isSaving}
                className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm px-3 py-2 transition-colors"
              >
                <Save size={14} />
                {isSaving ? '...' : 'Sauvegarder'}
              </button>
            )}
            {!isValidated && (
              <button
                onClick={handleValidate}
                disabled={isValidating}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-sm px-3 py-2 transition-colors"
              >
                <CheckCircle size={14} />
                {isValidating ? '...' : 'Valider'}
              </button>
            )}
            {isValidated && (
              <span className="text-xs px-2.5 py-1.5 bg-green-100 text-green-700 rounded-full font-medium">
                Validé
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-base font-bold text-gray-900">Informations du jour</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={dayForm.report_date}
                onChange={(e) => setDayForm({ ...dayForm, report_date: e.target.value })}
                disabled={isValidated}
                className={inputCls}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dayForm.is_setup_day}
                  onChange={(e) => setDayForm({ ...dayForm, is_setup_day: e.target.checked })}
                  disabled={isValidated}
                  className="rounded w-4 h-4"
                />
                <span>
                  {dayForm.is_setup_day
                    ? <strong>Journée de montage</strong>
                    : <span className="text-gray-500">Journée d'événement</span>}
                </span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Résumé</label>
            <textarea
              value={dayForm.summary}
              onChange={(e) => setDayForm({ ...dayForm, summary: e.target.value })}
              disabled={isValidated}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Résumé de la journée..."
            />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Suivi horaire réseau</h2>
            {!isValidated && (
              <button
                onClick={handleAddHourlyRow}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <Plus size={15} />
                Ajouter une ligne
              </button>
            )}
          </div>
          {hourlyRows.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Aucune donnée horaire</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Heure</th>
                    <th className="px-3 py-2 text-left font-medium">Utilisateurs Wi-Fi</th>
                    <th className="px-3 py-2 text-left font-medium">BW entrant (Mbps)</th>
                    <th className="px-3 py-2 text-left font-medium">BW sortant (Mbps)</th>
                    <th className="px-3 py-2 text-left font-medium">Notes</th>
                    {!isValidated && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {hourlyRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.hour_label}
                          onChange={(e) => handleUpdateHourlyRow(row, 'hour_label', e.target.value)}
                          disabled={isValidated}
                          className={inputCls}
                          placeholder="08:00"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={row.wifi_users}
                          onChange={(e) => handleUpdateHourlyRow(row, 'wifi_users', parseInt(e.target.value) || 0)}
                          disabled={isValidated}
                          className={inputCls}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={row.bandwidth_in}
                          onChange={(e) => handleUpdateHourlyRow(row, 'bandwidth_in', parseFloat(e.target.value) || 0)}
                          disabled={isValidated}
                          className={inputCls}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={row.bandwidth_out}
                          onChange={(e) => handleUpdateHourlyRow(row, 'bandwidth_out', parseFloat(e.target.value) || 0)}
                          disabled={isValidated}
                          className={inputCls}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => handleUpdateHourlyRow(row, 'notes', e.target.value)}
                          disabled={isValidated}
                          className={inputCls}
                          placeholder="..."
                        />
                      </td>
                      {!isValidated && (
                        <td className="px-3 py-2">
                          <button onClick={() => handleDeleteHourlyRow(row.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Incidents</h2>
            {!isValidated && (
              <button
                onClick={handleAddIncident}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <Plus size={15} />
                Ajouter
              </button>
            )}
          </div>
          {incidents.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Aucun incident</p>
          ) : (
            <div className="space-y-3">
              {incidents.map((inc) => (
                <div key={inc.id} className="p-4 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Heure</label>
                        <input
                          type="time"
                          value={inc.incident_time ?? ''}
                          onChange={(e) => handleUpdateIncident(inc, 'incident_time', e.target.value || null as any)}
                          disabled={isValidated}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Titre</label>
                        <input
                          type="text"
                          value={inc.title}
                          onChange={(e) => handleUpdateIncident(inc, 'title', e.target.value)}
                          disabled={isValidated}
                          className={inputCls}
                          placeholder="Titre de l'incident"
                        />
                      </div>
                    </div>
                    {!isValidated && (
                      <button onClick={() => handleDeleteIncident(inc.id)} className="text-gray-400 hover:text-red-500 transition-colors mt-6">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <textarea
                      value={inc.description}
                      onChange={(e) => handleUpdateIncident(inc, 'description', e.target.value)}
                      disabled={isValidated}
                      rows={2}
                      className={`${inputCls} resize-none`}
                      placeholder="Description..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Résolution</label>
                    <textarea
                      value={inc.resolution}
                      onChange={(e) => handleUpdateIncident(inc, 'resolution', e.target.value)}
                      disabled={isValidated}
                      rows={2}
                      className={`${inputCls} resize-none`}
                      placeholder="Résolution..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={inc.network_impact}
                        onChange={(e) => handleToggleNetworkImpact(inc, e.target.checked)}
                        disabled={isValidated}
                        className="rounded w-4 h-4"
                      />
                      Impact réseau
                    </label>
                    {inc.network_impact && (
                      <textarea
                        value={inc.network_impact_text ?? ''}
                        onChange={(e) => handleUpdateIncident(inc, 'network_impact_text', e.target.value || null)}
                        disabled={isValidated}
                        rows={2}
                        className={`${inputCls} resize-none`}
                        placeholder="Décrire l'impact réseau..."
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Images</h2>
            {!isValidated && (
              <button
                onClick={handleAddImage}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <Plus size={15} />
                Ajouter
              </button>
            )}
          </div>
          {images.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Aucune image</p>
          ) : (
            <div className="space-y-3">
              {images.map((img) => (
                <div key={img.id} className="p-4 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">URL de l'image</label>
                        <input
                          type="text"
                          value={img.file_url}
                          onChange={(e) => handleUpdateImage(img, 'file_url', e.target.value)}
                          disabled={isValidated}
                          className={inputCls}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Légende</label>
                        <input
                          type="text"
                          value={img.caption}
                          onChange={(e) => handleUpdateImage(img, 'caption', e.target.value)}
                          disabled={isValidated}
                          className={inputCls}
                          placeholder="Légende..."
                        />
                      </div>
                    </div>
                    {!isValidated && (
                      <button onClick={() => handleDeleteImage(img.id)} className="text-gray-400 hover:text-red-500 transition-colors mt-6">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  {img.file_url && (
                    <img
                      src={img.file_url}
                      alt={img.caption || 'Image'}
                      className="max-h-48 rounded-lg border border-gray-200 object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
