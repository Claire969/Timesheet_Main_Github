import { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Edit2 } from 'lucide-react';
import { useAppState } from '../App';
import type { Forfait, TimesheetEntry } from '../App';

const today = () => new Date().toISOString().slice(0, 10);

const computeTotal = (
  isForfait: Forfait,
  startTime: string,
  endTime: string,
  travelUnits: number,
  rates: { halfHour: number; hour: number; travelHalfHour: number; halfDay: number; fullDay: number }
): number => {
  let base = 0;
  if (isForfait === 'halfDay') {
    base = rates.halfDay;
  } else if (isForfait === 'fullDay') {
    base = rates.fullDay;
  } else {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (durationMinutes > 0) {
      const fullHours = Math.floor(durationMinutes / 60);
      const halfHours = (durationMinutes % 60) / 30;
      base = fullHours * rates.hour + halfHours * rates.halfHour;
    }
  }
  return base + travelUnits * rates.travelHalfHour;
};

const emptyForm = () => ({
  date: today(),
  isForfait: 'none' as Forfait,
  startTime: '09:00',
  endTime: '10:00',
  caller: '',
  description: '',
  travelUnits: 0,
});

const snapTime = (value: string): string => {
  const [h, m] = value.split(':').map(Number);
  const snapped = m < 15 ? 0 : m < 45 ? 30 : 0;
  const hour = m >= 45 ? (h + 1) % 24 : h;
  return `${String(hour).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`;
};

const formatForfait = (f: Forfait) => {
  if (f === 'halfDay') return 'Demi-journée';
  if (f === 'fullDay') return 'Journée';
  return '—';
};

export const ClientTimesheets = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients, clientTimesheets, setClientTimesheets } = useAppState();

  const client = clients.find(c => c.id === clientId);
  if (!client) return <Navigate to="/" replace />;

  const entries: TimesheetEntry[] = clientTimesheets[client.id] || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [tsForm, setTsForm] = useState(emptyForm());
  const [tsErrors, setTsErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!tsForm.date) errors.date = 'La date est requise';
    if (tsForm.isForfait === 'none') {
      if (!tsForm.startTime) errors.startTime = 'Requis';
      if (!tsForm.endTime) errors.endTime = 'Requis';
      if (tsForm.startTime && tsForm.endTime) {
        const [sh, sm] = tsForm.startTime.split(':').map(Number);
        const [eh, em] = tsForm.endTime.split(':').map(Number);
        if (eh * 60 + em <= sh * 60 + sm) errors.endTime = 'Fin doit être après début';
      }
    }
    setTsErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openNew = () => {
    setEditingEntryId(null);
    setTsForm(emptyForm());
    setTsErrors({});
    setDeleteConfirm(false);
    setIsModalOpen(true);
  };

  const openEdit = (entry: TimesheetEntry) => {
    setEditingEntryId(entry.id);
    setTsForm({
      date: entry.date,
      isForfait: entry.isForfait,
      startTime: entry.startTime,
      endTime: entry.endTime,
      caller: entry.caller,
      description: entry.description,
      travelUnits: entry.travelUnits,
    });
    setTsErrors({});
    setDeleteConfirm(false);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const startTime = tsForm.isForfait !== 'none' ? '00:00' : tsForm.startTime;
    const endTime = tsForm.isForfait !== 'none' ? '00:00' : tsForm.endTime;
    const total = computeTotal(tsForm.isForfait, startTime, endTime, tsForm.travelUnits, client.rates);

    if (editingEntryId) {
      setClientTimesheets(prev => ({
        ...prev,
        [client.id]: (prev[client.id] || []).map(e =>
          e.id === editingEntryId
            ? { ...e, date: tsForm.date, startTime, endTime, isForfait: tsForm.isForfait, caller: tsForm.caller, description: tsForm.description, travelUnits: tsForm.travelUnits, total }
            : e
        ),
      }));
    } else {
      const newEntry: TimesheetEntry = {
        id: Date.now().toString(),
        date: tsForm.date,
        startTime,
        endTime,
        isForfait: tsForm.isForfait,
        caller: tsForm.caller,
        description: tsForm.description,
        travelUnits: tsForm.travelUnits,
        total,
      };
      setClientTimesheets(prev => ({
        ...prev,
        [client.id]: [newEntry, ...(prev[client.id] || [])],
      }));
    }

    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (!editingEntryId) return;
    setClientTimesheets(prev => ({
      ...prev,
      [client.id]: (prev[client.id] || []).filter(e => e.id !== editingEntryId),
    }));
    setIsModalOpen(false);
  };

  const liveTotal = computeTotal(
    tsForm.isForfait,
    tsForm.isForfait !== 'none' ? '00:00' : tsForm.startTime,
    tsForm.isForfait !== 'none' ? '00:00' : tsForm.endTime,
    tsForm.travelUnits,
    client.rates
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
          <div className="text-sm text-gray-500">Clear_Computing</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Timesheets — {client.name}
          </h1>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus size={18} />
            Nouveau timesheet
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-12 text-center border border-gray-200">
            <p className="text-gray-500">Aucune entrée pour ce client.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Début</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Fin</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Appelant</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Déplacement</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total (HTVA)</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{entry.date}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {entry.isForfait !== 'none' ? formatForfait(entry.isForfait) : entry.startTime}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {entry.isForfait !== 'none' ? '—' : entry.endTime}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.caller || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{entry.description || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-center">{entry.travelUnits}</td>
                    <td className="px-4 py-3 text-gray-600">{client.name}</td>
                    <td className="px-4 py-3 text-gray-900 font-semibold text-right whitespace-nowrap">{entry.total} €</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(entry)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <Edit2 size={12} />
                        Éditer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEntryId ? 'Modifier le timesheet' : 'Nouveau timesheet'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
                <input
                  type="date"
                  value={tsForm.date}
                  onChange={(e) => setTsForm({ ...tsForm, date: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${tsErrors.date ? 'border-red-500' : 'border-gray-300'}`}
                />
                {tsErrors.date && <p className="text-xs text-red-600 mt-1">{tsErrors.date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Forfait</label>
                <select
                  value={tsForm.isForfait}
                  onChange={(e) => setTsForm({ ...tsForm, isForfait: e.target.value as Forfait })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">Aucun (heures)</option>
                  <option value="halfDay">Demi-journée</option>
                  <option value="fullDay">Journée complète</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${tsForm.isForfait !== 'none' ? 'text-gray-400' : 'text-gray-700'}`}>
                    Début *
                  </label>
                  <input
                    type="time"
                    step="1800"
                    value={tsForm.isForfait !== 'none' ? '00:00' : tsForm.startTime}
                    disabled={tsForm.isForfait !== 'none'}
                    onChange={(e) => setTsForm({ ...tsForm, startTime: snapTime(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${tsForm.isForfait !== 'none' ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : tsErrors.startTime ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {tsErrors.startTime && <p className="text-xs text-red-600 mt-1">{tsErrors.startTime}</p>}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${tsForm.isForfait !== 'none' ? 'text-gray-400' : 'text-gray-700'}`}>
                    Fin *
                  </label>
                  <input
                    type="time"
                    step="1800"
                    value={tsForm.isForfait !== 'none' ? '00:00' : tsForm.endTime}
                    disabled={tsForm.isForfait !== 'none'}
                    onChange={(e) => setTsForm({ ...tsForm, endTime: snapTime(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${tsForm.isForfait !== 'none' ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : tsErrors.endTime ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {tsErrors.endTime && <p className="text-xs text-red-600 mt-1">{tsErrors.endTime}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Appelant</label>
                <input
                  type="text"
                  value={tsForm.caller}
                  onChange={(e) => setTsForm({ ...tsForm, caller: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom de l'appelant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={tsForm.description}
                  onChange={(e) => setTsForm({ ...tsForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Description de l'intervention"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Déplacement — {tsForm.travelUnits} unité{tsForm.travelUnits !== 1 ? 's' : ''} (×30 min)
                </label>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={tsForm.travelUnits}
                  onChange={(e) => setTsForm({ ...tsForm, travelUnits: parseInt(e.target.value) })}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  {[0,1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Total estimé (HTVA)</span>
                <span className="text-lg font-bold text-blue-900">{liveTotal} €</span>
              </div>

              {editingEntryId ? (
                <div className="flex gap-3 pt-2">
                  {deleteConfirm ? (
                    <div className="flex-1 flex gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        Confirmer suppression
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(false)}
                        className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(true)}
                        className="px-4 py-2.5 border border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Supprimer
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        Enregistrer
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Créer
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
