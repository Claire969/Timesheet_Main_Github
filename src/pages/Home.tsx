import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';
import { LogOut, Plus, X, Users, CreditCard as Edit2, Archive, ArchiveRestore } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../App';
import type { Client } from '../App';

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { clients, setClients } = useAppState();

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
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const mapDbClients = (rows: Record<string, unknown>[]): Client[] =>
    rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      logoUrl: (row.logo_url as string) ?? undefined,
      isArchived: false,
      rates: {
        halfHour: Number(row.half_hour) || 0,
        hour: Number(row.hour) || 0,
        travelHalfHour: Number(row.travel_half_hour) || 0,
        halfDay: Number(row.half_day) || 0,
        fullDay: Number(row.full_day) || 0,
      },
    }));

const fetchClients = useCallback(async () => {
  if (!supabaseEnabled) return;

  setIsLoading(true);
  setFetchError(null);

  try {
    const { data, error } = await supabase
      .schema('timesheet')
      .from('clients')
      .select('id,name,logo_url,half_hour,hour,travel_half_hour,half_day,full_day,created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    setClients(
      (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        logoUrl: r.logo_url ?? undefined,
        isArchived: false,
        rates: {
          halfHour: Number(r.half_hour) || 0,
          hour: Number(r.hour) || 0,
          travelHalfHour: Number(r.travel_half_hour) || 0,
          halfDay: Number(r.half_day) || 0,
          fullDay: Number(r.full_day) || 0,
        },
      }))
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur lors du chargement des clients';
    setFetchError(msg);
  } finally {
    setIsLoading(false);
  }
}, [supabaseEnabled, setClients]);

useEffect(() => {
  void fetchClients();
}, [fetchClients]);

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

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateClientForm()) return;

    if (editingClientId) {
      if (supabaseEnabled) {
        setIsSaving(true);
        try {
          const { error } = await supabase
            .schema('timesheet')
            .from('clients')
            .update({
              name: clientFormData.name.trim(),
              logo_url: clientFormData.logoUrl || null,
              half_hour: clientFormData.halfHour,
              hour: clientFormData.hour,
              travel_half_hour: clientFormData.travelHalfHour,
              half_day: clientFormData.halfDay,
              full_day: clientFormData.fullDay,
            })
            .eq('id', editingClientId);
          if (error) throw error;
          await fetchClients();
          setIsClientFormOpen(false);
          setEditingClientId(null);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
          setClientFormErrors({ name: msg });
        } finally {
          setIsSaving(false);
        }
      } else {
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
        setIsClientFormOpen(false);
        setEditingClientId(null);
      }
      return;
    }

    if (supabaseEnabled) {
      setIsSaving(true);
      try {
        const { error } = await supabase
          .schema('timesheet')
          .from('clients')
          .insert([{ name: clientFormData.name.trim(), company: null, email: null }])
          .select()
          .single();
        if (error) throw error;
        await fetchClients();
        setIsClientFormOpen(false);
        setEditingClientId(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur lors de la création';
        setClientFormErrors({ name: msg });
      } finally {
        setIsSaving(false);
      }
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
      setIsClientFormOpen(false);
      setEditingClientId(null);
    }
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
          <img src="/images/ui/logo-clear-computing.png" alt="Clear Computing" className="h-6 w-auto" />
          <div className="flex items-center gap-3">
            <button onClick={() => setIsClientsModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-3 shadow-sm transition-colors">
              <Users size={16} />
              Gestion clients
            </button>
            <button onClick={handleSignOut} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl px-5 py-3 shadow-sm transition-colors">
              <LogOut size={16} />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 relative" style={{ backgroundImage: "url('/images/ui/clients-bg.png')", backgroundRepeat: "no-repeat", backgroundPosition: "right 40px", backgroundSize: "750px auto", backgroundBlendMode: "multiply" }}>
        <div className="pointer-events-none absolute inset-0 bg-white/80" />
        <div className="relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Timesheet</h1>
          <p className="text-lg text-gray-500">{user?.email || 'Mode preview'}</p>
        </div>

        {fetchError && (
          <div className="mb-6 px-4 py-3 bg-red-50/70 backdrop-blur-sm border border-red-200 rounded-lg text-sm text-red-700">
            {fetchError}
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Clients</h2>
          {isLoading ? (
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-16 text-center border border-gray-200">
              <p className="text-gray-400 text-sm">Chargement...</p>
            </div>
          ) : activeClients.length === 0 ? (
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-16 text-center border border-gray-200">
              <p className="text-gray-600 mb-4">Aucun client pour le moment</p>
              <button onClick={handleOpenNewClientFromMain} className="text-blue-600 hover:text-blue-700 font-medium">
                Créer un client
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => navigate(`/client/${client.id}`)}
                  className="aspect-square rounded-2xl flex flex-col items-center justify-between p-6 transition-all duration-200 bg-white border border-blue-200 shadow-sm hover:border-blue-400 hover:shadow-xl hover:-translate-y-0.5"
                >
                  <span className="text-2xl font-extrabold text-slate-900 text-center truncate w-full">
                    {client.name}
                  </span>
                  <div className="flex-1 flex items-center justify-center w-full">
                    <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-center w-56 h-56">
                      {client.logoUrl ? (
                        <img
                          src={client.logoUrl}
                          alt={client.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span
                        className={`text-sm text-gray-400 font-medium items-center justify-center ${client.logoUrl ? 'hidden' : 'flex'}`}
                      >
                        Logo
                      </span>
                    </div>
                  </div>
                  <div className="w-full" />
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </main>

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
                  <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors">
                    {isSaving ? 'Enregistrement...' : editingClientId ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      <div className="fixed bottom-3 right-3 z-[9999] text-xs font-semibold text-slate-700 bg-white/90 backdrop-blur px-2 py-1 rounded-lg border border-slate-200 shadow">
  v{import.meta.env.VITE_BUILD_ID}
</div>
    </div>
  );
};
