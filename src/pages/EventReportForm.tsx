import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { reportApi } from '../lib/eventReportApi';

interface ClientRow { id: string; name: string; logo_url: string | null; }

export const EventReportForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    event_name: '',
    final_client_name: '',
    venue_client_id: '',
    start_date: '',
    total_days: 1,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { data: clientRows } = await supabase
          .schema('timesheet')
          .from('clients')
          .select('id,name,logo_url')
          .order('name');
        setClients((clientRows ?? []) as ClientRow[]);

        if (isEdit && id) {
          const report = await reportApi.get(id);
          setForm({
            event_name: report.event_name,
            final_client_name: report.final_client_name,
            venue_client_id: report.venue_client_id ?? '',
            start_date: report.start_date ?? '',
            total_days: report.total_days,
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [id, isEdit]);

  const selectedClient = clients.find((c) => c.id === form.venue_client_id) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.event_name.trim()) { setError("Le nom de l'événement est requis"); return; }
    if (form.total_days < 1) { setError('Le nombre de jours doit être >= 1'); return; }
    setError(null);
    setIsSaving(true);
    try {
      const payload = {
        event_name: form.event_name.trim(),
        final_client_name: form.final_client_name.trim(),
        venue_client_id: form.venue_client_id || null,
        start_date: form.start_date || null,
        total_days: form.total_days,
      };
      if (isEdit && id) {
        await reportApi.update(id, payload);
        navigate(`/event-reports/${id}`);
      } else {
        const report = await reportApi.create(payload);
        navigate(`/event-reports/${report.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(isEdit && id ? `/event-reports/${id}` : '/event-reports')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Modifier le rapport' : 'Nouveau rapport'}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nom de l'événement *
            </label>
            <input
              type="text"
              value={form.event_name}
              onChange={(e) => setForm({ ...form, event_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Festival XYZ 2026"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Client final
            </label>
            <input
              type="text"
              value={form.final_client_name}
              onChange={(e) => setForm({ ...form, final_client_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nom du client final (texte libre)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Venue / Salle (client Timesheet)
            </label>
            <select
              value={form.venue_client_id}
              onChange={(e) => setForm({ ...form, venue_client_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Aucune venue --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {selectedClient?.logo_url && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={selectedClient.logo_url}
                  alt={selectedClient.name}
                  className="w-10 h-10 object-contain rounded-lg border border-gray-200 bg-gray-50"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-sm text-gray-500">{selectedClient.name}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de début</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre de jours *
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={form.total_days}
                onChange={(e) => setForm({ ...form, total_days: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate(isEdit && id ? `/event-reports/${id}` : '/event-reports')}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
            >
              <Save size={16} />
              {isSaving ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
