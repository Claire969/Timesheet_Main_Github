import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { reportApi, venueApi } from '../lib/eventReportApi';
import type { EventVenue } from '../lib/eventReportTypes';

interface ClientRow { id: string; name: string; }

export const EventReportForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [venues, setVenues] = useState<EventVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    event_name: '',
    client_id: '',
    venue_id: '',
    start_date: '',
    total_days: 1,
  });

  const [showVenueCreate, setShowVenueCreate] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueLogoUrl, setNewVenueLogoUrl] = useState('');
  const [isCreatingVenue, setIsCreatingVenue] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: clientRows }, venueRows] = await Promise.all([
          supabase.schema('timesheet').from('clients').select('id,name').order('name'),
          venueApi.list(),
        ]);
        setClients((clientRows ?? []) as ClientRow[]);
        setVenues(venueRows);

        if (isEdit && id) {
          const report = await reportApi.get(id);
          setForm({
            event_name: report.event_name,
            client_id: report.client_id,
            venue_id: report.venue_id ?? '',
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

  const handleCreateVenue = async () => {
    if (!newVenueName.trim()) return;
    setIsCreatingVenue(true);
    try {
      const venue = await venueApi.create(newVenueName.trim(), newVenueLogoUrl || undefined);
      setVenues((prev) => [...prev, venue]);
      setForm((prev) => ({ ...prev, venue_id: venue.id }));
      setNewVenueName('');
      setNewVenueLogoUrl('');
      setShowVenueCreate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création du lieu');
    } finally {
      setIsCreatingVenue(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.event_name.trim()) { setError("Le nom de l'événement est requis"); return; }
    if (!form.client_id) { setError('Sélectionnez un client'); return; }
    if (form.total_days < 1) { setError('Le nombre de jours doit être >= 1'); return; }
    setError(null);
    setIsSaving(true);
    try {
      const payload = {
        event_name: form.event_name.trim(),
        client_id: form.client_id,
        venue_id: form.venue_id || null,
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Client *</label>
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Sélectionner un client --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Lieu</label>
            <div className="flex gap-2">
              <select
                value={form.venue_id}
                onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Sélectionner un lieu --</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowVenueCreate(!showVenueCreate)}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Plus size={15} />
                Nouveau
              </button>
            </div>

            {showVenueCreate && (
              <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <p className="text-sm font-medium text-gray-700">Créer un nouveau lieu</p>
                <input
                  type="text"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  placeholder="Nom du lieu *"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newVenueLogoUrl}
                  onChange={(e) => setNewVenueLogoUrl(e.target.value)}
                  placeholder="URL du logo (optionnel)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVenueCreate(false)}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateVenue}
                    disabled={isCreatingVenue || !newVenueName.trim()}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                  >
                    {isCreatingVenue ? 'Création...' : 'Créer le lieu'}
                  </button>
                </div>
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
