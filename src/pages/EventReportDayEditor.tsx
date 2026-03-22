import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckCircle, Save, Sparkles, ChevronDown, ChevronUp, ClipboardPaste, Link } from 'lucide-react';
import { dayApi, hourlyApi, incidentApi, imageApi, reportApi, wifiApi, setupStepApi } from '../lib/eventReportApi';
import { aiAssistIncident, type AiAction } from '../lib/aiIncidentApi';
import { uploadImageBlob, deleteStorageImage } from '../lib/imageStorageApi';
import { WifiNetworksSection } from '../components/WifiNetworksSection';
import type {
  EventReportDay,
  EventReportHourlyRow,
  EventReportIncident,
  EventReportImage,
  EventReport,
  EventReportWifiNetwork,
  EventReportSetupStep,
} from '../lib/eventReportTypes';

const AI_ENABLED = false;

const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function pad(n: number) { return String(n).padStart(2, '0'); }

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
  const [reportLanguage, setReportLanguage] = useState<'fr' | 'en'>('fr');
  const [reportDescription, setReportDescription] = useState('');

  const [hourlyGenStart, setHourlyGenStart] = useState('08');
  const [hourlyGenEnd, setHourlyGenEnd] = useState('18');

  const [wifiNetworks, setWifiNetworks] = useState<EventReportWifiNetwork[]>([]);
  const [setupSteps, setSetupSteps] = useState<EventReportSetupStep[]>([]);
  const [newIncidentForm, setNewIncidentForm] = useState({ incident_time: '', title: '' });
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<{ incId: string; action: AiAction } | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [manualUrlImgId, setManualUrlImgId] = useState<string | null>(null);
  const imageDropzoneRef = useRef<HTMLDivElement>(null);

  const handleAiAssist = async (inc: EventReportIncident, action: AiAction) => {
    const sourceText = action === 'translate_en'
      ? [inc.description, inc.resolution].filter(Boolean).join('\n\n')
      : inc.description;
    if (!sourceText.trim()) return;
    setAiLoading({ incId: inc.id, action });
    try {
      const result = await aiAssistIncident(sourceText, action);
      if (action === 'translate_en') {
        const parts = result.split(/\n\n/);
        const updated = { ...inc, description: parts[0] ?? inc.description, resolution: parts[1] ?? inc.resolution };
        setIncidents((prev) => prev.map((i) => (i.id === inc.id ? updated : i)));
        await incidentApi.update(inc.id, { description: updated.description, resolution: updated.resolution });
      } else {
        const updated = { ...inc, description: result };
        setIncidents((prev) => prev.map((i) => (i.id === inc.id ? updated : i)));
        await incidentApi.update(inc.id, { description: result });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur IA');
    } finally {
      setAiLoading(null);
    }
  };

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
      setReportLanguage((r as EventReport).language ?? 'fr');
      setReportDescription((r as EventReport).description ?? '');
      if (d.day_number === 1) {
        const [wifi, steps] = await Promise.all([
          wifiApi.listForReport(reportId),
          setupStepApi.listForReport(reportId),
        ]);
        setWifiNetworks(wifi);
        setSetupSteps(steps);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [reportId, dayId]);

  const handleAiCorrectSummary = async () => {
    if (!dayForm.summary.trim()) return;
    setAiSummaryLoading(true);
    try {
      const result = await aiAssistIncident(dayForm.summary, 'correct_fr');
      setDayForm((prev) => ({ ...prev, summary: result }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur IA');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleAddSetupStep = async () => {
    if (!reportId) return;
    try {
      const step = await setupStepApi.create({
        report_id: reportId,
        sort_order: setupSteps.length,
        text: '',
      });
      setSetupSteps((prev) => [...prev, step]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleUpdateSetupStep = async (step: EventReportSetupStep, text: string) => {
    setSetupSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, text } : s)));
    try {
      await setupStepApi.update(step.id, text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleDeleteSetupStep = async (id: string) => {
    setSetupSteps((prev) => prev.filter((s) => s.id !== id));
    try {
      await setupStepApi.delete(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  useEffect(() => { void load(); }, [load]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  const handleSaveDay = async () => {
    if (!dayId || !reportId) return;
    setIsSaving(true);
    try {
      await Promise.all([
        dayApi.update(dayId, {
          report_date: dayForm.report_date || null,
          summary: dayForm.summary,
          is_setup_day: dayForm.is_setup_day,
        }),
        reportApi.update(reportId, { language: reportLanguage, description: reportDescription }),
      ]);
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
      await Promise.all([
        dayApi.update(dayId!, { report_date: dayForm.report_date || null, summary: dayForm.summary, is_setup_day: dayForm.is_setup_day }),
        reportApi.update(report.id, { language: reportLanguage, description: reportDescription }),
      ]);
      await dayApi.validate(day, report);
      showSuccess('Jour validé !');
      setTimeout(() => navigate(`/event-reports/${reportId}`), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la validation');
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerateHourlyRows = async () => {
    if (!dayId) return;
    const start = parseInt(hourlyGenStart, 10);
    const end = parseInt(hourlyGenEnd, 10);
    if (isNaN(start) || isNaN(end) || start >= end) return;

    const existingLabels = new Set(hourlyRows.map((r) => r.hour_label));
    const toCreate: string[] = [];
    for (let h = start; h <= end; h++) {
      const label = `${pad(h)}:00`;
      if (!existingLabels.has(label)) toCreate.push(label);
    }
    if (toCreate.length === 0) return;

    try {
      const created: EventReportHourlyRow[] = [];
      for (const label of toCreate) {
        const row = await hourlyApi.upsert({
          day_id: dayId,
          hour_label: label,
          wifi_users: 0,
          bandwidth_in: 0,
          bandwidth_out: 0,
          notes: '',
        });
        created.push(row);
      }
      setHourlyRows((prev) => {
        const combined = [...prev, ...created];
        return combined.sort((a, b) => a.hour_label.localeCompare(b.hour_label));
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
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

  const handleCreateIncident = async () => {
    if (!dayId) return;
    if (!newIncidentForm.title.trim()) return;
    try {
      const inc = await incidentApi.create({
        day_id: dayId,
        incident_time: newIncidentForm.incident_time || null,
        title: newIncidentForm.title,
        description: '',
        resolution: '',
        network_impact: false,
        network_impact_text: null,
      });
      setIncidents((prev) => [...prev, inc]);
      setNewIncidentForm({ incident_time: '', title: '' });
      setExpandedIncidentId(inc.id);
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
    if (expandedIncidentId === id) setExpandedIncidentId(null);
    try {
      await incidentApi.delete(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleUploadBlob = async (blob: Blob) => {
    if (!dayId || !reportId || !day) return;
    setUploadingImage(true);
    try {
      const url = await uploadImageBlob(blob, reportId, day.day_number);
      const img = await imageApi.create({
        day_id: dayId,
        file_url: url,
        caption: '',
        sort_order: images.length,
      });
      setImages((prev) => [...prev, img]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'upload");
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (day?.status === 'validated') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) await handleUploadBlob(blob);
        break;
      }
    }
  }, [dayId, reportId, day, images.length]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste as EventListener);
    return () => document.removeEventListener('paste', handlePaste as EventListener);
  }, [handlePaste]);

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
      setManualUrlImgId(img.id);
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
    const img = images.find((i) => i.id === id);
    setImages((prev) => prev.filter((i) => i.id !== id));
    if (manualUrlImgId === id) setManualUrlImgId(null);
    try {
      await imageApi.delete(id);
      if (img?.file_url) void deleteStorageImage(img.file_url);
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

  const hours = Array.from({ length: 24 }, (_, i) => pad(i));

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

        {/* Day info */}
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

            {/* Day type: clear button group replacing ambiguous checkbox */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de journée</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                <button
                  type="button"
                  disabled={isValidated}
                  onClick={() => setDayForm({ ...dayForm, is_setup_day: false })}
                  className={`flex-1 py-1.5 font-medium transition-colors ${
                    !dayForm.is_setup_day
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  } disabled:cursor-default`}
                >
                  Événement
                </button>
                <button
                  type="button"
                  disabled={isValidated}
                  onClick={() => setDayForm({ ...dayForm, is_setup_day: true })}
                  className={`flex-1 py-1.5 font-medium transition-colors border-l border-gray-300 ${
                    dayForm.is_setup_day
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  } disabled:cursor-default`}
                >
                  Montage
                </button>
              </div>
            </div>
          </div>

          {/* Language selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Langue du rapport</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm w-32">
              <button
                type="button"
                disabled={isValidated}
                onClick={() => setReportLanguage('fr')}
                className={`flex-1 py-1.5 font-medium transition-colors ${
                  reportLanguage === 'fr'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                } disabled:cursor-default`}
              >
                FR
              </button>
              <button
                type="button"
                disabled={isValidated}
                onClick={() => setReportLanguage('en')}
                className={`flex-1 py-1.5 font-medium transition-colors border-l border-gray-300 ${
                  reportLanguage === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                } disabled:cursor-default`}
              >
                EN
              </button>
            </div>
          </div>

          {day?.day_number === 1 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description de l'événement</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                disabled={isValidated}
                rows={4}
                className={`${inputCls} resize-none`}
                placeholder="Description générale de l'événement..."
              />
            </div>
          ) : report?.description ? (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1 text-xs">Description de l'événement (saisie au jour 1)</label>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 whitespace-pre-wrap">{report.description}</p>
            </div>
          ) : null}

          {day?.day_number === 1 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Étapes de mise en place</label>
                {!isValidated && (
                  <button
                    type="button"
                    onClick={handleAddSetupStep}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    <Plus size={14} />
                    Ajouter
                  </button>
                )}
              </div>
              {setupSteps.length === 0 ? (
                <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                  Aucune étape — cliquez sur Ajouter
                </p>
              ) : (
                <div className="space-y-2">
                  {setupSteps.map((step, idx) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 text-right shrink-0">{idx + 1}.</span>
                      <input
                        type="text"
                        value={step.text}
                        onChange={(e) => handleUpdateSetupStep(step, e.target.value)}
                        disabled={isValidated}
                        className={`${inputCls} flex-1`}
                        placeholder="Décrivez l'étape..."
                      />
                      {!isValidated && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSetupStep(step.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Résumé du jour</label>
              <textarea
                value={dayForm.summary}
                onChange={(e) => setDayForm({ ...dayForm, summary: e.target.value })}
                disabled={isValidated}
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder="Notes spécifiques à ce jour..."
              />
              {!isValidated && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Sparkles size={12} className="text-gray-400 shrink-0" />
                  {AI_ENABLED ? (
                    <button
                      type="button"
                      onClick={handleAiCorrectSummary}
                      disabled={aiSummaryLoading || !dayForm.summary.trim()}
                      className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 transition-colors"
                    >
                      {aiSummaryLoading ? '...' : 'Corriger'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Assistant IA non configuré sur le serveur</span>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {day?.day_number === 1 && (
          <WifiNetworksSection
            reportId={reportId!}
            networks={wifiNetworks}
            onNetworksChange={setWifiNetworks}
            disabled={isValidated}
            onError={setError}
          />
        )}

        {/* Hourly rows */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Suivi horaire réseau</h2>
            {!isValidated && (
              <button
                onClick={handleAddHourlyRow}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <Plus size={15} />
                Ligne manuelle
              </button>
            )}
          </div>

          {/* Auto-generate rows */}
          {!isValidated && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs text-gray-500">Générer de</span>
              <select
                value={hourlyGenStart}
                onChange={(e) => setHourlyGenStart(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">à</span>
              <select
                value={hourlyGenEnd}
                onChange={(e) => setHourlyGenEnd(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
              <button
                onClick={handleGenerateHourlyRows}
                className="px-3 py-1 border border-blue-400 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
              >
                Générer
              </button>
            </div>
          )}

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

        {/* Incidents */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">Incidents</h2>

          {/* New incident form */}
          {!isValidated && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <input
                type="time"
                value={newIncidentForm.incident_time}
                onChange={(e) => setNewIncidentForm({ ...newIncidentForm, incident_time: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
              />
              <input
                type="text"
                value={newIncidentForm.title}
                onChange={(e) => setNewIncidentForm({ ...newIncidentForm, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateIncident(); }}
                className="flex-1 min-w-40 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Titre de l'incident..."
              />
              <button
                onClick={handleCreateIncident}
                disabled={!newIncidentForm.title.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={14} />
                Ajouter
              </button>
            </div>
          )}

          {incidents.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Aucun incident</p>
          ) : (
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {incidents.map((inc) => {
                const isExpanded = expandedIncidentId === inc.id;
                return (
                  <div key={inc.id}>
                    {/* Compact row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedIncidentId(isExpanded ? null : inc.id)}
                    >
                      {inc.incident_time && (
                        <span className="text-xs font-mono text-gray-500 shrink-0 w-12">{inc.incident_time.slice(0, 5)}</span>
                      )}
                      <span className="flex-1 text-sm text-gray-800 font-medium truncate">
                        {inc.title || <span className="text-gray-400 italic">Sans titre</span>}
                      </span>
                      {inc.network_impact && (
                        <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium shrink-0">Réseau</span>
                      )}
                      {!isValidated && (
                        <button
                          onClick={(e) => { e.stopPropagation(); void handleDeleteIncident(inc.id); }}
                          className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                    </div>

                    {/* Expanded editor */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 bg-gray-50 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          {!isValidated && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Sparkles size={12} className="text-gray-400 shrink-0" />
                              {AI_ENABLED ? (
                                (['correct_fr', 'rewrite_fr', 'translate_en'] as AiAction[]).map((action) => {
                                  const labels: Record<AiAction, string> = { correct_fr: 'Corriger', rewrite_fr: 'Reformuler', translate_en: 'Traduire EN' };
                                  const busy = aiLoading?.incId === inc.id && aiLoading.action === action;
                                  return (
                                    <button
                                      key={action}
                                      type="button"
                                      onClick={() => handleAiAssist(inc, action)}
                                      disabled={aiLoading !== null}
                                      className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 transition-colors"
                                    >
                                      {busy ? '...' : labels[action]}
                                    </button>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-gray-400 italic">Assistant IA non configuré sur le serveur</span>
                              )}
                            </div>
                          )}
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Images */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Images</h2>
            {!isValidated && (
              <button
                onClick={handleAddImage}
                className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm"
              >
                <Link size={14} />
                URL manuelle
              </button>
            )}
          </div>

          {/* Paste drop zone */}
          {!isValidated && (
            <div
              ref={imageDropzoneRef}
              className="mb-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-6 text-center cursor-default"
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) await handleUploadBlob(file);
              }}
            >
              {uploadingImage ? (
                <p className="text-sm text-blue-500 font-medium">Upload en cours...</p>
              ) : (
                <>
                  <ClipboardPaste size={20} className="text-gray-400" />
                  <p className="text-sm text-gray-500">
                    Coller une capture d'écran <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs font-mono">Ctrl+V</kbd>
                    <span className="mx-1 text-gray-300">·</span>
                    ou glisser-déposer une image ici
                  </p>
                </>
              )}
            </div>
          )}

          {images.length === 0 ? (
            <p className="text-sm text-gray-400 py-2 text-center">Aucune image</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img) => (
                <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50 group relative">
                  {img.file_url ? (
                    <img
                      src={img.file_url}
                      alt={img.caption || 'Image'}
                      className="w-full h-36 object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-36 flex items-center justify-center text-gray-300 text-xs">Aucune image</div>
                  )}
                  {!isValidated && (
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute top-1.5 right-1.5 p-1 bg-white/80 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div className="px-2 py-1.5">
                    {manualUrlImgId === img.id && !img.file_url ? (
                      <input
                        type="text"
                        value={img.file_url}
                        onChange={(e) => handleUpdateImage(img, 'file_url', e.target.value)}
                        onBlur={() => setManualUrlImgId(null)}
                        autoFocus
                        className="w-full text-xs px-1.5 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1"
                        placeholder="https://..."
                      />
                    ) : null}
                    <input
                      type="text"
                      value={img.caption}
                      onChange={(e) => handleUpdateImage(img, 'caption', e.target.value)}
                      disabled={isValidated}
                      className="w-full text-xs px-1.5 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                      placeholder="Légende..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
