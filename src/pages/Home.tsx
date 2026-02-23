import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { LogOut, Plus, X, Users, Edit2, Archive, ArchiveRestore } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Client {
  id: string;
  name: string;
  logoUrl?: string;
  isArchived: boolean;
  rates: {
    halfHour: number;
    hour: number;
    travelHalfHour: number;
    halfDay: number;
    fullDay: number;
  };
}

type Forfait = 'none' | 'halfDay' | 'fullDay';

interface TimesheetEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isForfait: Forfait;
  caller: string;
  description: string;
  travelUnits: number;
  total: number;
}

type ClientTimesheets = Record<string, TimesheetEntry[]>;

const today = () => new Date().toISOString().slice(0, 10);

const computeTotal = (
  isForfait: Forfait,
  startTime: string,
  endTime: string,
  travelUnits: number,
  rates: Client['rates']
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

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientTimesheets, setClientTimesheets] = useState<ClientTimesheets>({});
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [isClientsModalOpen, setIsClientsModalOpen] = useState(false);
  const [showArchivedClients, setShowArchivedClients] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientFormData, setClientFormData] = useState({
    name: '',
    logoUrl: '',
    halfHour: 0,
    hour: 0,
    travelHalfHour: 0,
    halfDay: 0,
    fullDay: 0,
  });
  const [clientFormErrors, setClientFormErrors] = useState<Record<string, string>>({});

  const [isTimesheetModalOpen, setIsTimesheetModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [tsForm, setTsForm] = useState(emptyForm());
  const [tsErrors, setTsErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleSignOut = async () => {
    try {
      sessionStorage.setItem('force_msal_prompt', '1');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const validateClientForm = () => {
    const errors: Record<string, string> = {};
    if (!clientFormData.name.trim()) errors.name = 'Le nom est requis';
    if (clientFormData.halfHour < 0) errors.halfHour = 'Doit être >= 0';
    if (clientFormData.hour < 0) errors.hour = 'Doit être >= 0';
    if (clientFormData.travelHalfHour < 0) errors.travelHalfHour = 'Doit être >= 0';
    if (clientFormData.halfDay < 0) errors.halfDay = 'Doit être >= 0';
    if (clientFormData.fullDay < 0) errors.fullDay = 'Doit être >= 0';
    setClientFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenClientForm = (client?: Client) => {
    if (client) {
      setEditingClientId(client.id);
      setClientFormData({
        name: client.name,
        logoUrl: client.logoUrl || '',
        halfHour: client.rates.halfHour,
        hour: client.rates.hour,
        travelHalfHour: client.rates.travelHalfHour,
        halfDay: client.rates.halfDay,
        fullDay: client.rates.fullDay,
      });
    } else {
      setEditingClientId(null);
      setClientFormData({ name: '', logoUrl: '', halfHour: 0, hour: 0, travelHalfHour: 0, halfDay: 0, fullDay: 0 });
    }
    setClientFormErrors({});
    setIsClientFormOpen(true);
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateClientForm()) return;

    if (editingClientId) {
      setClients(clients.map(c => c.id === editingClientId ? {
        ...c,
        name: clientFormData.name,
        logoUrl: clientFormData.logoUrl || undefined,
        rates: {
          halfHour: clientFormData.halfHour,
          hour: clientFormData.hour,
          travelHalfHour: clientFormData.travelHalfHour,
          halfDay: clientFormData.halfDay,
          fullDay: clientFormData.fullDay,
        }
      } : c));
    } else {
      const newClient: Client = {
        id: Date.now().toString(),
        name: clientFormData.name,
        logoUrl: clientFormData.logoUrl || undefined,
        isArchived: false,
        rates: {
          halfHour: clientFormData.halfHour,
          hour: clientFormData.hour,
          travelHalfHour: clientFormData.travelHalfHour,
          halfDay: clientFormData.halfDay,
          fullDay: clientFormData.fullDay,
        }
      };
      setClients([...clients, newClient]);
    }

    setIsClientFormOpen(false);
    setEditingClientId(null);
  };

  const handleToggleArchiveClient = (clientId: string) => {
    setClients(clients.map(c => c.id === clientId ? { ...c, isArchived: !c.isArchived } : c));
  };

  const activeClients = clients.filter(c => !c.isArchived);

  const filteredClients = clients.filter(c => {
    const matchesArchive = showArchivedClients || !c.isArchived;
    const matchesSearch = !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase());
    return matchesArchive && matchesSearch;
  });

  const handleOpenNewClientFromMain = () => {
    setIsClientsModalOpen(true);
    setEditingClientId(null);
    setClientFormData({ name: '', logoUrl: '', halfHour: 0, hour: 0, travelHalfHour: 0, halfDay: 0, fullDay: 0 });
    setClientFormErrors({});
    setIsClientFormOpen(true);
  };

  const snapTime = (value: string): string => {
    const [h, m] = value.split(':').map(Number);
    const snapped = m < 15 ? 0 : m < 45 ? 30 : 0;
    const hour = m >= 45 ? (h + 1) % 24 : h;
    return `${String(hour).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`;
  };

  const validateTsForm = (): boolean => {
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

  const openNewTimesheetModal = () => {
    setEditingEntryId(null);
    setTsForm(emptyForm());
    setTsErrors({});
    setDeleteConfirm(false);
    setIsTimesheetModalOpen(true);
  };

  const openEditTimesheetModal = (entry: TimesheetEntry) => {
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
    setIsTimesheetModalOpen(true);
  };

  const handleSaveTimesheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateTsForm() || !selectedClientId) return;

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    const startTime = tsForm.isForfait !== 'none' ? '00:00' : tsForm.startTime;
    const endTime = tsForm.isForfait !== 'none' ? '00:00' : tsForm.endTime;
    const total = computeTotal(tsForm.isForfait, startTime, endTime, tsForm.travelUnits, client.rates);

    const existing = clientTimesheets[selectedClientId] || [];

    if (editingEntryId) {
      setClientTimesheets({
        ...clientTimesheets,
        [selectedClientId]: existing.map(e =>
          e.id === editingEntryId
            ? { ...e, date: tsForm.date, startTime, endTime, isForfait: tsForm.isForfait, caller: tsForm.caller, description: tsForm.description, travelUnits: tsForm.travelUnits, total }
            : e
        ),
      });
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
      setClientTimesheets({
        ...clientTimesheets,
        [selectedClientId]: [newEntry, ...existing],
      });
    }

    setIsTimesheetModalOpen(false);
  };

  const handleDeleteEntry = () => {
    if (!selectedClientId || !editingEntryId) return;
    const existing = clientTimesheets[selectedClientId] || [];
    setClientTimesheets({
      ...clientTimesheets,
      [selectedClientId]: existing.filter(e => e.id !== editingEntryId),
    });
    setIsTimesheetModalOpen(false);
  };

  const formatForfait = (f: Forfait) => {
    if (f === 'halfDay') return 'Demi-journée';
    if (f === 'fullDay') return 'Journée';
    return '—';
  };

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;
  const selectedEntries = selectedClientId ? (clientTimesheets[selectedClientId] || []) : [];

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">Clear_Computing</div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsClientsModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <Users size={16} />
              Gestion clients
            </button>
            <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <LogOut size={16} />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Timesheet</h1>
          <p className="text-lg text-gray-500">{user?.email || 'Mode preview'}</p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Clients</h2>
          {activeClients.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-16 text-center border border-gray-200">
              <p className="text-gray-600 mb-4">Aucun client pour le moment</p>
              <button onClick={handleOpenNewClientFromMain} className="text-blue-600 hover:text-blue-700 font-medium">
                Créer un client
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeClients.map((client) => {
                const isSelected = selectedClientId === client.id;
                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(isSelected ? null : client.id)}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-between p-6 transition-all bg-blue-600 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5 ${
                      isSelected
                        ? 'ring-4 ring-white ring-offset-2 ring-offset-blue-600 shadow-xl'
                        : 'shadow-md'
                    }`}
                  >
                    <span className="text-lg font-bold text-white text-center leading-tight w-full">
                      {client.name}
                    </span>
                    <div className="flex-1 flex items-center justify-center w-full">
                      {client.logoUrl ? (
                        <div className="w-40 h-40 flex items-center justify-center">
                          <img
                            src={client.logoUrl}
                            alt={client.name}
                            className="w-full h-full object-contain rounded-lg"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.parentElement!.style.display = 'none';
                              const next = target.parentElement!.nextElementSibling as HTMLElement | null;
                              if (next) next.style.display = 'flex';
                            }}
                          />
                        </div>
                      ) : null}
                      <div
                        className={`w-20 h-14 rounded-lg bg-white bg-opacity-20 items-center justify-center text-sm text-white text-opacity-70 ${
                          client.logoUrl ? 'hidden' : 'flex'
                        }`}
                      >
                        Logo
                      </div>
                    </div>
                    <div className="w-full" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedClient && (
          <div className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Timesheets — {selectedClient.name}
              </h2>
              <button
                onClick={openNewTimesheetModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus size={18} />
                Nouveau timesheet
              </button>
            </div>

            {selectedEntries.length === 0 ? (
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
                    {selectedEntries.map((entry) => (
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
                        <td className="px-4 py-3 text-gray-600">{selectedClient.name}</td>
                        <td className="px-4 py-3 text-gray-900 font-semibold text-right whitespace-nowrap">{entry.total} €</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openEditTimesheetModal(entry)}
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
          </div>
        )}
      </main>

      {isTimesheetModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEntryId ? 'Modifier le timesheet' : 'Nouveau timesheet'}
              </h3>
              <button onClick={() => setIsTimesheetModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTimesheet} className="flex-1 overflow-y-auto p-5 space-y-4">
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
                <span className="text-lg font-bold text-blue-900">
                  {computeTotal(
                    tsForm.isForfait,
                    tsForm.isForfait !== 'none' ? '00:00' : tsForm.startTime,
                    tsForm.isForfait !== 'none' ? '00:00' : tsForm.endTime,
                    tsForm.travelUnits,
                    selectedClient.rates
                  )} €
                </span>
              </div>

              {editingEntryId ? (
                <div className="flex gap-3 pt-2">
                  {deleteConfirm ? (
                    <div className="flex-1 flex gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteEntry}
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
                    onClick={() => setIsTimesheetModalOpen(false)}
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

      {isClientsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Gestion clients</h3>
              <button onClick={() => { setIsClientsModalOpen(false); setIsClientFormOpen(false); setClientSearch(''); }} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
                <X size={20} />
              </button>
            </div>

            {!isClientFormOpen ? (
              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex items-center gap-3 mb-4">
                  <input type="text" placeholder="Rechercher un client..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={showArchivedClients} onChange={(e) => setShowArchivedClients(e.target.checked)} className="rounded" />
                    Afficher archivés
                  </label>
                  <button onClick={() => handleOpenClientForm()} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                    <Plus size={18} />
                    Nouveau client
                  </button>
                </div>

                {filteredClients.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {clientSearch ? 'Aucun client trouvé' : 'Aucun client. Créez-en un pour commencer.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredClients.map((client) => (
                      <div key={client.id} className={`p-4 border rounded-lg ${client.isArchived ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {client.logoUrl && <img src={client.logoUrl} alt={client.name} className="w-8 h-8 object-contain rounded" />}
                              <h4 className="font-semibold text-gray-900">{client.name}</h4>
                              {client.isArchived && <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">Archivé</span>}
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex gap-4">
                                <span>1/2h: {client.rates.halfHour}€</span>
                                <span>1h: {client.rates.hour}€</span>
                                <span>Déplacement: {client.rates.travelHalfHour}€</span>
                              </div>
                              <div className="flex gap-4">
                                <span>Demi-journée: {client.rates.halfDay}€</span>
                                <span>Journée: {client.rates.fullDay}€</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleOpenClientForm(client)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Modifier">
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleToggleArchiveClient(client.id)} className="p-2 text-gray-400 hover:text-orange-600 transition-colors" title={client.isArchived ? 'Réactiver' : 'Archiver'}>
                              {client.isArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveClient} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du client *</label>
                  <input type="text" value={clientFormData.name} onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.name ? 'border-red-500' : 'border-gray-300'}`} />
                  {clientFormErrors.name && <p className="text-xs text-red-600 mt-1">{clientFormErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Logo (optionnel)</label>
                  <input type="text" value={clientFormData.logoUrl} onChange={(e) => setClientFormData({ ...clientFormData, logoUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" placeholder="https://..." />
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setClientFormData((prev) => ({ ...prev, logoUrl: ev.target?.result as string }));
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  {clientFormData.logoUrl && (
                    <div className="flex items-center gap-3 mt-2">
                      <img src={clientFormData.logoUrl} alt="Aperçu logo" className="w-12 h-12 object-contain rounded-lg border border-gray-200 bg-gray-50" />
                      <button type="button" onClick={() => setClientFormData((prev) => ({ ...prev, logoUrl: '' }))} className="text-sm text-red-600 hover:text-red-700 font-medium">
                        Retirer le logo
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Tarifs</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">1/2 heure (€)</label>
                      <input type="number" min="0" step="0.01" value={clientFormData.halfHour} onChange={(e) => setClientFormData({ ...clientFormData, halfHour: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.halfHour ? 'border-red-500' : 'border-gray-300'}`} />
                      {clientFormErrors.halfHour && <p className="text-xs text-red-600 mt-1">{clientFormErrors.halfHour}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">1 heure (€)</label>
                      <input type="number" min="0" step="0.01" value={clientFormData.hour} onChange={(e) => setClientFormData({ ...clientFormData, hour: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.hour ? 'border-red-500' : 'border-gray-300'}`} />
                      {clientFormErrors.hour && <p className="text-xs text-red-600 mt-1">{clientFormErrors.hour}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Déplacement (€)</label>
                      <input type="number" min="0" step="0.01" value={clientFormData.travelHalfHour} onChange={(e) => setClientFormData({ ...clientFormData, travelHalfHour: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.travelHalfHour ? 'border-red-500' : 'border-gray-300'}`} />
                      {clientFormErrors.travelHalfHour && <p className="text-xs text-red-600 mt-1">{clientFormErrors.travelHalfHour}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Demi-journée (€)</label>
                      <input type="number" min="0" step="0.01" value={clientFormData.halfDay} onChange={(e) => setClientFormData({ ...clientFormData, halfDay: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.halfDay ? 'border-red-500' : 'border-gray-300'}`} />
                      {clientFormErrors.halfDay && <p className="text-xs text-red-600 mt-1">{clientFormErrors.halfDay}</p>}
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Journée complète (€)</label>
                      <input type="number" min="0" step="0.01" value={clientFormData.fullDay} onChange={(e) => setClientFormData({ ...clientFormData, fullDay: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.fullDay ? 'border-red-500' : 'border-gray-300'}`} />
                      {clientFormErrors.fullDay && <p className="text-xs text-red-600 mt-1">{clientFormErrors.fullDay}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => { setIsClientFormOpen(false); setClientFormErrors({}); }} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                    Annuler
                  </button>
                  <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
                    {editingClientId ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
