import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { LogOut, Plus, Trash2, X, Users, Edit2, Archive, ArchiveRestore } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TimesheetEntry {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  title: string;
  notes: string;
}

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

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '17:00',
    break_minutes: 0,
    title: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [clients, setClients] = useState<Client[]>([]);
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

  const handleSignOut = async () => {
    try {
      sessionStorage.setItem('force_msal_prompt', '1');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Le titre est requis';
    if (formData.end_time < formData.start_time) errors.end_time = 'L\'heure de fin doit être après l\'heure de début';
    if (formData.break_minutes < 0) errors.break_minutes = 'La pause doit être >= 0';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const newEntry: TimesheetEntry = { id: Date.now().toString(), ...formData };
    setEntries([newEntry, ...entries]);
    setIsModalOpen(false);
    setFormData({ entry_date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '17:00', break_minutes: 0, title: '', notes: '' });
    setFormErrors({});
  };

  const handleDeleteEntry = (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer cette entrée ?')) {
      setEntries(entries.filter(entry => entry.id !== id));
    }
  };

  const calculateDuration = (start: string, end: string, breakMin: number) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const totalMinutes = (eh * 60 + em) - (sh * 60 + sm) - breakMin;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
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

      <main className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">Timesheet</h1>
        <p className="text-lg text-gray-500 mb-10">{user?.email || 'Mode preview'}</p>

        <div className="text-left mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Clients</h2>
          {activeClients.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 text-center border border-gray-200">
              <p className="text-gray-600 mb-4">Aucun client pour le moment</p>
              <button onClick={handleOpenNewClientFromMain} className="text-blue-600 hover:text-blue-700 font-medium">
                Créer un client
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeClients.map((client) => (
                <div key={client.id} className="bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg p-5 cursor-pointer">
                  <div className="flex items-center gap-3 mb-3">
                    {client.logoUrl && <img src={client.logoUrl} alt={client.name} className="w-8 h-8 object-contain rounded bg-white p-0.5" />}
                    <h3 className="text-lg font-semibold text-white">{client.name}</h3>
                  </div>
                  <div className="text-sm text-blue-100 space-y-1">
                    <div className="flex gap-4">
                      <span>1/2h: {client.rates.halfHour}€</span>
                      <span>1h: {client.rates.hour}€</span>
                    </div>
                    <div className="flex gap-4">
                      <span>Demi-journée: {client.rates.halfDay}€</span>
                      <span>Journée: {client.rates.fullDay}€</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors inline-flex items-center gap-2 mb-16">
          <Plus size={20} />
          Nouvelle entrée
        </button>

        <div className="text-left">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Mes entrées</h2>

          {entries.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 text-center border border-gray-200">
              <p className="text-gray-600 mb-4">Aucune entrée pour le moment</p>
              <button onClick={() => setIsModalOpen(true)} className="text-blue-600 hover:text-blue-700 font-medium">
                Créer une entrée
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div key={entry.id} className="bg-white rounded-lg p-6 border border-gray-200 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-gray-500">{formatDate(entry.entry_date)}</span>
                        <span className="text-sm text-gray-400">•</span>
                        <span className="text-sm text-gray-500">{entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}</span>
                        <span className="text-sm font-medium text-blue-600">{calculateDuration(entry.start_time, entry.end_time, entry.break_minutes)}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{entry.title}</h3>
                      {entry.notes && <p className="text-sm text-gray-600">{entry.notes}</p>}
                      {entry.break_minutes > 0 && <p className="text-xs text-gray-500 mt-2">Pause: {entry.break_minutes} min</p>}
                    </div>
                    <button onClick={() => handleDeleteEntry(entry.id)} className="text-gray-400 hover:text-red-600 p-2 transition-colors" title="Supprimer">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Nouvelle entrée</h3>
              <button onClick={() => { setIsModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input type="date" value={formData.entry_date} onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Début</label>
                  <input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Fin</label>
                  <input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.end_time ? 'border-red-500' : 'border-gray-300'}`} />
                  {formErrors.end_time && <p className="text-xs text-red-600 mt-1">{formErrors.end_time}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pause (minutes)</label>
                <input type="number" min="0" value={formData.break_minutes} onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.break_minutes ? 'border-red-500' : 'border-gray-300'}`} />
                {formErrors.break_minutes && <p className="text-xs text-red-600 mt-1">{formErrors.break_minutes}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Titre *</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.title ? 'border-red-500' : 'border-gray-300'}`} placeholder="Ex: Développement feature X" />
                {formErrors.title && <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Détails supplémentaires..." />
              </div>
              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => { setIsModalOpen(false); setFormErrors({}); }} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
                  Créer
                </button>
              </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Logo URL (optionnel)</label>
                  <input type="text" value={clientFormData.logoUrl} onChange={(e) => setClientFormData({ ...clientFormData, logoUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
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
