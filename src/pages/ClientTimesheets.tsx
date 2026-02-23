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

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

const formatForfait = (f: Forfait) => {
  if (f === 'halfDay') return 'Demi-journée';
  if (f === 'fullDay') return 'Journée';
  return '—';
};

const groupByDate = (entries: TimesheetEntry[], dateKey: 'pendingAt' | 'archivedAt') => {
  const map: Record<string, TimesheetEntry[]> = {};
  for (const e of entries) {
    const k = e[dateKey] || 'unknown';
    if (!map[k]) map[k] = [];
    map[k].push(e);
  }
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
};

const TABLE_HEADERS = (
  <tr>
    <th className="px-3 py-3 w-8" />
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
);

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

  const [selectedUnbilled, setSelectedUnbilled] = useState<Set<string>>(new Set());
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());

  const unbilledEntries = entries.filter(e => e.billingStatus === 'unbilled');
  const pendingEntries = entries.filter(e => e.billingStatus === 'pending');
  const archivedEntries = entries.filter(e => e.billingStatus === 'archived');

  const toggleSelect = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setFn(next);
  };

  const toggleAll = (list: TimesheetEntry[], set: Set<string>, setFn: (s: Set<string>) => void) => {
    if (list.every(e => set.has(e.id))) {
      setFn(new Set());
    } else {
      setFn(new Set(list.map(e => e.id)));
    }
  };

  const handleExportPending = () => {
    if (selectedUnbilled.size === 0) return;
    const t = today();
    setClientTimesheets(prev => ({
      ...prev,
      [client.id]: (prev[client.id] || []).map(e =>
        selectedUnbilled.has(e.id) ? { ...e, billingStatus: 'pending', pendingAt: t } : e
      ),
    }));
    setSelectedUnbilled(new Set());
  };

  const handleArchive = () => {
    if (selectedPending.size === 0) return;
    const t = today();
    setClientTimesheets(prev => ({
      ...prev,
      [client.id]: (prev[client.id] || []).map(e =>
        selectedPending.has(e.id) ? { ...e, billingStatus: 'archived', archivedAt: t } : e
      ),
    }));
    setSelectedPending(new Set());
  };

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
        billingStatus: 'unbilled',
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

  const renderRow = (entry: TimesheetEntry, checked: boolean, onCheck: () => void, isArchived: boolean) => (
    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3 text-center">
        {!isArchived && (
          <input
            type="checkbox"
            checked={checked}
            onChange={onCheck}
            className="accent-blue-600 w-4 h-4 cursor-pointer"
          />
        )}
      </td>
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
        {isArchived ? (
          <span className="text-xs text-gray-400 px-3 py-1.5">Archivé</span>
        ) : (
          <button
            onClick={() => openEdit(entry)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Edit2 size={12} />
            Éditer
          </button>
        )}
      </td>
    </tr>
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

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Timesheets — {client.name}</h1>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus size={18} />
            Nouveau timesheet
          </button>
        </div>

        {/* Section A: Unbilled */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Pas encore facturé</h2>
            <button
              onClick={handleExportPending}
              disabled={selectedUnbilled.size === 0}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg transition-colors"
            >
              Exporter pour la facturation ({selectedUnbilled.size})
            </button>
          </div>
          {unbilledEntries.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
              <p className="text-gray-500 text-sm">Aucune entrée non facturée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={unbilledEntries.length > 0 && unbilledEntries.every(e => selectedUnbilled.has(e.id))}
                        onChange={() => toggleAll(unbilledEntries, selectedUnbilled, setSelectedUnbilled)}
                        className="accent-blue-600 w-4 h-4 cursor-pointer"
                      />
                    </th>
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
                  {unbilledEntries.map(entry =>
                    renderRow(
                      entry,
                      selectedUnbilled.has(entry.id),
                      () => toggleSelect(selectedUnbilled, setSelectedUnbilled, entry.id),
                      false
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section B: Pending */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Pending</h2>
            <button
              onClick={handleArchive}
              disabled={selectedPending.size === 0}
              className="px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg transition-colors"
            >
              Archiver ({selectedPending.size})
            </button>
          </div>
          {pendingEntries.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
              <p className="text-gray-500 text-sm">Aucune entrée en pending.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={pendingEntries.length > 0 && pendingEntries.every(e => selectedPending.has(e.id))}
                        onChange={() => toggleAll(pendingEntries, selectedPending, setSelectedPending)}
                        className="accent-blue-600 w-4 h-4 cursor-pointer"
                      />
                    </th>
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
                  {groupByDate(pendingEntries, 'pendingAt').map(([date, group]) => (
                    <>
                      <tr key={`divider-${date}`}>
                        <td colSpan={10} className="px-4 py-2 bg-blue-50 text-xs font-medium text-blue-700 border-y border-blue-100">
                          Mis en pending le {date}
                        </td>
                      </tr>
                      {group.map(entry =>
                        renderRow(
                          entry,
                          selectedPending.has(entry.id),
                          () => toggleSelect(selectedPending, setSelectedPending, entry.id),
                          false
                        )
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section C: Archived */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Archivé</h2>
          {archivedEntries.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
              <p className="text-gray-500 text-sm">Aucune entrée archivée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  {TABLE_HEADERS}
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupByDate(archivedEntries, 'archivedAt').map(([date, group]) => (
                    <>
                      <tr key={`divider-${date}`}>
                        <td colSpan={10} className="px-4 py-2 bg-gray-100 text-xs font-medium text-gray-500 border-y border-gray-200">
                          Archivé le {date}
                        </td>
                      </tr>
                      {group.map(entry =>
                        renderRow(entry, false, () => {}, true)
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
                  <select
                    value={tsForm.isForfait !== 'none' ? '00:00' : tsForm.startTime}
                    disabled={tsForm.isForfait !== 'none'}
                    onChange={(e) => setTsForm({ ...tsForm, startTime: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${tsForm.isForfait !== 'none' ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : tsErrors.startTime ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {tsErrors.startTime && <p className="text-xs text-red-600 mt-1">{tsErrors.startTime}</p>}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${tsForm.isForfait !== 'none' ? 'text-gray-400' : 'text-gray-700'}`}>
                    Fin *
                  </label>
                  <select
                    value={tsForm.isForfait !== 'none' ? '00:00' : tsForm.endTime}
                    disabled={tsForm.isForfait !== 'none'}
                    onChange={(e) => setTsForm({ ...tsForm, endTime: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${tsForm.isForfait !== 'none' ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : tsErrors.endTime ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
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
