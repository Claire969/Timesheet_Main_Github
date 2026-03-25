import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';
import { LogOut, Plus, X, Users, CreditCard as Edit2, Archive, ArchiveRestore, LayoutGrid, List, FileSpreadsheet, Download, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../App';
import type { Client } from '../App';
import * as XLSX from 'xlsx';
import { ThemeToggle } from '../components/ThemeToggle';

const fmtEur = (n: number) => Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`;

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y.slice(2)}`;
};

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { clients, setClients, clientTimesheets } = useAppState();
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handler = (e: Event) => { setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    (installPrompt as any).prompt();
    await (installPrompt as any).userChoice;
    setInstallPrompt(null);
  };
  const [clientsView, setClientsView] = useState<'grid' | 'list'>(() => {
    const stored = localStorage.getItem('ts_clients_view');
    return (stored === 'grid' || stored === 'list') ? stored : 'list';
  });
  const [clientTotals, setClientTotals] = useState<Record<string, { toInvoice: number; pending: number }>>({});

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

useEffect(() => {
  if (!supabaseEnabled || clients.length === 0) return;
  const fetchTotals = async () => {
    const { data, error } = await supabase
      .schema('timesheet')
      .from('entries')
      .select('total, billing_status, project:projects!inner(client_id)');
    if (error || !data) return;
    const map: Record<string, { toInvoice: number; pending: number }> = {};
    for (const row of data as Array<{ total: unknown; billing_status: unknown; project: { client_id: string } }>) {
      const clientId = row.project?.client_id;
      if (!clientId) continue;
      if (!map[clientId]) map[clientId] = { toInvoice: 0, pending: 0 };
      const total = parseFloat(String(row.total ?? 0));
      const status = (row.billing_status as string) || 'unbilled';
      if (status === 'unbilled') map[clientId].toInvoice += total;
      else if (status === 'pending') map[clientId].pending += total;
    }
    setClientTotals(map);
  };
  void fetchTotals();
}, [clients, supabaseEnabled]);

const isBypass = sessionStorage.getItem('ts_auth_bypass') === '1';

useEffect(() => {
  if (!isBypass) return;
  if (clients.length > 0) return;
  setClients([{
    id: 'demo',
    name: 'Demo Client',
    logoUrl: '/images/ui/logo-clear-computing.png',
    isArchived: false,
    rates: { halfHour: 35, hour: 70, travelHalfHour: 25, halfDay: 200, fullDay: 400 }
  }]);
}, []);

  const handleExportExcel = async () => {
    const COLS = ['Date', 'Début de l\'intervention', 'Fin de l\'intervention', 'Caller', 'Description', 'Déplacement', 'Client', 'Total (Hors TVA)', 'Commentaire Prix'];
    const COL_WIDTHS = [10, 14, 14, 14, 60, 13, 14, 14, 60];
    const SECTIONS: Array<{ label: string; status: string }> = [
      { label: 'Pas encore facturé', status: 'unbilled' },
      { label: 'Pending', status: 'pending' },
      { label: 'Archivé', status: 'archived' },
    ];

    const activeClients = clients.filter(c => !c.isArchived);

    const { data: projectRows } = await supabase
      .schema('timesheet')
      .from('projects')
      .select('id,client_id')
      .in('client_id', activeClients.map(c => c.id));

    const projectToClient: Record<string, string> = {};
    for (const p of projectRows ?? []) {
      projectToClient[p.id as string] = p.client_id as string;
    }

    const projectIds = Object.keys(projectToClient);

    const { data: entryRows } = projectIds.length > 0
      ? await supabase
          .schema('timesheet')
          .from('entries')
          .select('id,project_id,work_date,start_time,end_time,is_forfait,caller,description,travel_units,total,billing_status')
          .in('project_id', projectIds)
          .order('work_date', { ascending: true })
          .order('created_at', { ascending: true })
      : { data: [] };

    const stripSeconds = (t: string) => (t ? t.slice(0, 5) : '00:00');

    const entriesByClient: Record<string, Array<{
      date: string; startTime: string; endTime: string;
      isForfait: string; caller: string; description: string;
      travelUnits: number; total: number; billingStatus: string;
    }>> = {};

    for (const r of entryRows ?? []) {
      const clientId = projectToClient[r.project_id as string];
      if (!clientId) continue;
      if (!entriesByClient[clientId]) entriesByClient[clientId] = [];
      entriesByClient[clientId].push({
        date: r.work_date as string,
        startTime: r.start_time ? stripSeconds(r.start_time as string) : '00:00',
        endTime: r.end_time ? stripSeconds(r.end_time as string) : '00:00',
        isForfait: (r.is_forfait as string) || 'none',
        caller: (r.caller as string) || '',
        description: (r.description as string) || '',
        travelUnits: (r.travel_units as number) || 0,
        total: parseFloat(String(r.total ?? 0)),
        billingStatus: (r.billing_status as string) || 'unbilled',
      });
    }

    const wb = XLSX.utils.book_new();

    for (const client of activeClients) {
      const allEntries = entriesByClient[client.id] ?? [];
      const aoa: (string | number)[][] = [];

      let grandTotal = 0;

      SECTIONS.forEach(({ label, status }, si) => {
        if (si > 0) aoa.push([]);
        const group = allEntries
          .filter(e => e.billingStatus === status)
          .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

        aoa.push([label]);
        aoa.push(COLS);

        let sectionTotal = 0;
        for (const e of group) {
          const start = e.isForfait !== 'none' ? '00:00' : e.startTime;
          const end = e.isForfait !== 'none' ? '00:00' : e.endTime;
          aoa.push([fmtDate(e.date), start, end, e.caller, e.description, e.travelUnits, client.name, fmtEur(e.total), '']);
          sectionTotal += e.total;
        }
        aoa.push(['Total', '', '', '', '', '', '', fmtEur(sectionTotal), '']);
        grandTotal += sectionTotal;
      });

      aoa.push([]);
      aoa.push(['TOTAL GÉNÉRAL', '', '', '', '', '', '', fmtEur(grandTotal), '']);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = COL_WIDTHS.map(w => ({ wch: w }));

      const sheetName = client.name.replace(/[\\/*?[\]:]/g, '_').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `timesheet-backup-${today}.xlsx`);
  };

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
    <div className="relative min-h-screen bg-white dark:bg-gray-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: "url('/images/ui/eva-walk.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 120px",
          backgroundSize: "clamp(320px, 55vw, 700px)",
          opacity: 0.14,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 hidden sm:block"
        style={{
          backgroundImage: "url('/images/ui/eva-walk.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right center",
          backgroundSize: "clamp(320px, 55vw, 700px)",
          opacity: 0.14,
        }}
      />
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <img src="/images/ui/logo-clear-computing.png" alt="Clear Computing" className="h-8 w-auto max-w-[180px] object-contain" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="hidden sm:flex items-center gap-2">
                {installPrompt && (
                  <button onClick={handleInstall} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm px-4 py-3 shadow-sm transition-colors whitespace-nowrap shrink-0">
                    <Download size={14} />
                    Installer l'app
                  </button>
                )}
                <button onClick={handleExportExcel} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm px-4 py-3 shadow-sm transition-colors whitespace-nowrap shrink-0">
                  <FileSpreadsheet size={14} />
                  Exporter Excel
                </button>
                <button onClick={() => setIsClientsModalOpen(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm px-4 py-3 shadow-sm transition-colors whitespace-nowrap shrink-0">
                  <Users size={14} />
                  Gestion clients
                </button>
                <button onClick={() => navigate('/event-reports')} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm px-4 py-3 shadow-sm transition-colors whitespace-nowrap shrink-0">
                  <ClipboardList size={14} />
                  Rapports événement
                </button>
              </div>
              <button onClick={handleSignOut} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs px-3 py-2 sm:text-sm sm:px-4 sm:py-3 shadow-sm transition-colors whitespace-nowrap shrink-0">
                <LogOut size={14} />
                Déconnexion
              </button>
            </div>
          </div>
          <div className="sm:hidden mt-3 text-center">
            <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-gray-100">Timesheet</h1>
            <p className="mt-1 text-base text-slate-500 dark:text-slate-400">{user?.email || 'Mode preview'}</p>
          </div>
          <div className="sm:hidden mt-4 flex items-center justify-center gap-2 flex-wrap">
            {installPrompt && (
              <button onClick={handleInstall} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs px-3 py-2 whitespace-nowrap shrink-0 shadow-sm transition-colors">
                <Download size={13} />
                Installer l'app
              </button>
            )}
            <button onClick={handleExportExcel} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs px-3 py-2 whitespace-nowrap shrink-0 shadow-sm transition-colors">
              <FileSpreadsheet size={13} />
              Exporter Excel
            </button>
            <button onClick={() => setIsClientsModalOpen(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs px-3 py-2 whitespace-nowrap shrink-0 shadow-sm transition-colors">
              <Users size={13} />
              Gestion clients
            </button>
            <button onClick={() => navigate('/event-reports')} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs px-3 py-2 whitespace-nowrap shrink-0 shadow-sm transition-colors">
              <ClipboardList size={13} />
              Rapports événement
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 pb-28 relative min-h-[clamp(780px,110vh,1200px)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: "url('/images/ui/clients-bg.png')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center 140px",
            backgroundSize: "clamp(420px, 88vw, 980px)",
            opacity: 0.14,
          }}
        />
        <div className="relative z-10">
        <div className="hidden sm:block text-center mb-12">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-gray-900 dark:text-gray-100 mb-4">Timesheet</h1>
          <p className="mt-1 text-base sm:text-2xl text-slate-500 dark:text-slate-400">{user?.email || 'Mode preview'}</p>
        </div>
        <div className="sm:hidden mb-8" />

        {fetchError && (
          <div className="mb-6 px-4 py-3 bg-red-50/70 dark:bg-red-900/30 backdrop-blur-sm border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {fetchError}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Clients</h2>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <button
                onClick={() => { setClientsView('grid'); localStorage.setItem('ts_clients_view', 'grid'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${clientsView === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}
              >
                <LayoutGrid size={14} />
                Grille
              </button>
              <button
                onClick={() => { setClientsView('list'); localStorage.setItem('ts_clients_view', 'list'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${clientsView === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}
              >
                <List size={14} />
                Liste
              </button>
            </div>
          </div>
          {isLoading ? (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-16 text-center border border-gray-200 dark:border-gray-700">
              <p className="text-gray-400 dark:text-gray-500 text-sm">Chargement...</p>
            </div>
          ) : activeClients.length === 0 ? (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-16 text-center border border-gray-200 dark:border-gray-700">
              <p className="text-gray-600 dark:text-gray-400 mb-4">Aucun client pour le moment</p>
              <button onClick={handleOpenNewClientFromMain} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                Créer un client
              </button>
            </div>
          ) : clientsView === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeClients.map((client) => (
                <div key={client.id} className="bg-gradient-to-br from-blue-400 via-blue-200 to-white p-[2px] rounded-3xl shadow-sm hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
                <button
                  onClick={() => navigate(`/client/${client.id}`)}
                  className="aspect-square w-full bg-white/80 backdrop-blur-sm rounded-[22px] flex flex-col items-center justify-between p-6"
                >
                  <span className="text-2xl font-extrabold text-slate-900 text-center truncate w-full">
                    {client.name}
                  </span>
                  <div className="flex-1 flex items-center justify-center w-full">
                    <div className="bg-white/50 backdrop-blur-sm border border-white/60 rounded-xl p-4 flex items-center justify-center w-56 h-56">
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
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {activeClients.map((client) => {
                const totals = clientTotals[client.id] ?? { toInvoice: 0, pending: 0 };
                const unbilledSum = totals.toInvoice;
                const pendingSum = totals.pending;
                return (
                  <button
                    key={client.id}
                    onClick={() => navigate(`/client/${client.id}`)}
                    className="w-full flex items-center justify-between gap-4 p-4 rounded-xl bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-600 transition text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {client.logoUrl ? (
                          <img
                            src={client.logoUrl}
                            alt={client.name}
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Logo</span>
                        )}
                      </div>
                      <span className="font-bold text-gray-900 dark:text-gray-100 truncate">{client.name}</span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">{fmtEur(unbilledSum)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{fmtEur(pendingSum)} en attente</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </main>

      {isClientsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Gestion clients</h3>
              <button onClick={() => { setIsClientsModalOpen(false); setIsClientFormOpen(false); setClientSearch(''); }} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 transition-colors">
                <X size={20} />
              </button>
            </div>

            {!isClientFormOpen ? (
              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex items-center gap-3 mb-4">
                  <input type="text" placeholder="Rechercher un client..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={showArchivedClients} onChange={(e) => setShowArchivedClients(e.target.checked)} className="rounded" />
                    Afficher archivés
                  </label>
                  <button onClick={() => handleOpenClientForm()} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                    <Plus size={18} />
                    Nouveau client
                  </button>
                </div>

                {filteredClients.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    {clientSearch ? 'Aucun client trouvé' : 'Aucun client. Créez-en un pour commencer.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredClients.map((client) => (
                      <div key={client.id} className={`p-4 border rounded-lg ${client.isArchived ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {client.logoUrl && <img src={client.logoUrl} alt={client.name} className="w-8 h-8 object-contain rounded" />}
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{client.name}</h4>
                              {client.isArchived && <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">Archivé</span>}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
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
                            <button onClick={() => handleOpenClientForm(client)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Modifier">
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleToggleArchiveClient(client.id)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors" title={client.isArchived ? 'Réactiver' : 'Archiver'}>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom du client *</label>
                  <input type="text" value={clientFormData.name} onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })} className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                  {clientFormErrors.name && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{clientFormErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Logo (optionnel)</label>
                  <input type="text" value={clientFormData.logoUrl} onChange={(e) => setClientFormData({ ...clientFormData, logoUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" placeholder="https://..." />
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50 cursor-pointer"
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
                      <img src={clientFormData.logoUrl} alt="Aperçu logo" className="w-12 h-12 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700" />
                      <button type="button" onClick={() => setClientFormData((prev) => ({ ...prev, logoUrl: '' }))} className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium">
                        Retirer le logo
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Tarifs</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">1/2 heure (€)</label>
                      <input type="number" min="0" step="0.01" value={clientFormData.halfHour} onChange={(e) => setClientFormData({ ...clientFormData, halfHour: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.halfHour ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                      {clientFormErrors.halfHour && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{clientFormErrors.halfHour}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">1 heure (€)</label>
                      <input type="number" min="0" step="0.01" value={clientFormData.hour} onChange={(e) => setClientFormData({ ...clientFormData, hour: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.hour ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                      {clientFormErrors.hour && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{clientFormErrors.hour}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Déplacement (€)</label>
                      <input type="number" min="0" step="0.01" value={clientFormData.travelHalfHour} onChange={(e) => setClientFormData({ ...clientFormData, travelHalfHour: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.travelHalfHour ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                      {clientFormErrors.travelHalfHour && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{clientFormErrors.travelHalfHour}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Demi-journée (€)</label>
                      <input type="number" min="0" step="0.01" value={clientFormData.halfDay} onChange={(e) => setClientFormData({ ...clientFormData, halfDay: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.halfDay ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                      {clientFormErrors.halfDay && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{clientFormErrors.halfDay}</p>}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Journée complète (€)</label>
                      <input type="number" min="0" step="0.01" value={clientFormData.fullDay} onChange={(e) => setClientFormData({ ...clientFormData, fullDay: parseFloat(e.target.value) || 0 })} className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientFormErrors.fullDay ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                      {clientFormErrors.fullDay && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{clientFormErrors.fullDay}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => { setIsClientFormOpen(false); setClientFormErrors({}); }} className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
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
      <div className="fixed bottom-3 right-3 z-[9999] text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-2 py-1 rounded-lg border border-slate-200 dark:border-gray-700 shadow">
  v{import.meta.env.VITE_BUILD_ID}
</div>
    </div>
  );
};