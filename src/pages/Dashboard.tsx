import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FileText,
  CheckSquare,
  Clock,
  ChevronRight,
  Upload,
  ClipboardList,
  Wifi,
  ListTodo,
  AlertCircle,
  Star,
  Info,
  Calendar,
} from 'lucide-react';
import { AppNav } from '../components/AppNav';
import { useAuth } from '../contexts/AuthContext';
import { useAppState } from '../App';
import { useLoadClients } from '../lib/useLoadClients';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';
import { taskApi } from '../lib/taskApi';
import { sortTasksByPriority, PRIORITY_LABELS, PRIORITY_ORDER } from '../lib/taskTypes';
import type { Task, TaskPriority } from '../lib/taskTypes';

function getUserFirstName(user: { email?: string | null; user_metadata?: { full_name?: string; name?: string } } | null): string {
  if (!user) return '';
  const name = user.user_metadata?.full_name || user.user_metadata?.name;
  if (name) return name.trim().split(' ')[0];
  if (user.email) return user.email.split('@')[0];
  return '';
}

// --------------- Summary card ---------------

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  iconBg: string;
  iconColor: string;
}

function SummaryCard({ icon, label, value, sub, iconBg, iconColor }: SummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex items-center gap-4 flex-1 min-w-[160px]">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
        <p className="text-xs text-blue-600 mt-1">{sub}</p>
      </div>
    </div>
  );
}

// --------------- Quick action card ---------------

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}

function QuickAction({ icon, label, iconBg, iconColor, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-[140px] flex items-center gap-3 px-4 py-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg} group-hover:scale-105 transition-transform`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 text-left leading-tight">{label}</span>
      <ChevronRight size={14} className="text-gray-400 ml-auto shrink-0 group-hover:text-blue-500 transition-colors" />
    </button>
  );
}

// --------------- Module card — entire card is the click target ---------------

interface ModuleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  comingSoon?: boolean;
  onClick?: () => void;
  iconBg: string;
  iconColor: string;
}

function ModuleCard({ icon, title, description, comingSoon, onClick, iconBg, iconColor }: ModuleCardProps) {
  if (comingSoon) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-3 min-w-0 opacity-60 select-none">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
        <div className="mt-auto w-full py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs font-medium text-gray-400 text-center cursor-not-allowed">
          À venir
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-3 min-w-0 text-left hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} group-hover:scale-105 transition-transform`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="mt-auto w-full py-2 rounded-lg border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all text-center">
        Ouvrir
      </div>
    </button>
  );
}

// --------------- Priority tasks (sidebar) — uses real data ---------------

const PRIORITY_BADGE_SIDEBAR: Record<TaskPriority, { label: string; labelClass: string; borderClass: string; icon: React.ReactNode }> = {
  urgent_important: {
    label: PRIORITY_LABELS.urgent_important,
    labelClass: 'bg-red-100 text-red-700',
    borderClass: 'border-l-red-500',
    icon: <AlertCircle size={14} className="text-red-500" />,
  },
  urgent: {
    label: PRIORITY_LABELS.urgent,
    labelClass: 'bg-red-100 text-red-700',
    borderClass: 'border-l-red-400',
    icon: <AlertCircle size={14} className="text-red-400" />,
  },
  important: {
    label: PRIORITY_LABELS.important,
    labelClass: 'bg-orange-100 text-orange-700',
    borderClass: 'border-l-orange-400',
    icon: <Star size={14} className="text-orange-400" />,
  },
  normal: {
    label: PRIORITY_LABELS.normal,
    labelClass: 'bg-blue-100 text-blue-700',
    borderClass: 'border-l-blue-400',
    icon: <Info size={14} className="text-blue-500" />,
  },
};

// --------------- Recent documents from Supabase ---------------

interface RecentDocRow {
  id: string;
  name: string;
  clientName: string;
  categoryName: string;
  createdAt: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

// --------------- Recent clients (placeholder, sidebar) ---------------

interface RecentClient {
  id: number;
  name: string;
  initials: string;
  color: string;
}

const PLACEHOLDER_CLIENTS: RecentClient[] = [
  { id: 1, name: 'TheEgg', initials: 'TE', color: 'bg-blue-100 text-blue-700' },
  { id: 2, name: 'Pepibru', initials: 'PE', color: 'bg-green-100 text-green-700' },
  { id: 3, name: 'AfinIT Consulting', initials: 'AC', color: 'bg-orange-100 text-orange-700' },
  { id: 4, name: 'Event Lounge', initials: 'EL', color: 'bg-teal-100 text-teal-700' },
];

// --------------- Dashboard page ---------------

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = getUserFirstName(user);

  useLoadClients();
  const { clients } = useAppState();
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

  const [recentDocs, setRecentDocs] = useState<RecentDocRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const [priorityTasks, setPriorityTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    if (!supabaseEnabled) {
      setDocsLoading(false);
      return;
    }
    let cancelled = false;

    supabase
      .from('doc_documents')
      .select('id, name, created_at, doc_clients(name), doc_categories(name)')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setDocsLoading(false); return; }
        const rows: RecentDocRow[] = (data ?? []).map((d: {
          id: string;
          name: string;
          created_at: string;
          doc_clients: { name: string } | null;
          doc_categories: { name: string } | null;
        }) => ({
          id: d.id,
          name: d.name,
          clientName: d.doc_clients?.name ?? '—',
          categoryName: d.doc_categories?.name ?? '—',
          createdAt: d.created_at,
        }));
        setRecentDocs(rows);
        setDocsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!supabaseEnabled) { setTasksLoading(false); return; }
    let cancelled = false;

    taskApi.listTasks().then(tasks => {
      if (cancelled) return;
      const active = tasks.filter(t => t.status !== 'completed');
      const sorted = sortTasksByPriority(active).slice(0, 5);
      setPriorityTasks(sorted);
      setTasksLoading(false);
    }).catch(() => setTasksLoading(false));

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNav />

      <main className="pt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
              {firstName ? `Bienvenue ${firstName} \u2014 ` : ''}aperçu rapide de votre activité.
            </p>
          </div>

          <div className="flex gap-6 items-start">
            {/* Main column */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">

              {/* Summary cards */}
              <div className="flex gap-4 flex-wrap">
                <SummaryCard
                  icon={<Users size={20} />}
                  label="Clients"
                  value={12}
                  sub="+2 ce mois"
                  iconBg="bg-blue-50"
                  iconColor="text-blue-600"
                />
                <SummaryCard
                  icon={<FileText size={20} />}
                  label="Documents"
                  value={48}
                  sub="+6 ce mois"
                  iconBg="bg-green-50"
                  iconColor="text-green-600"
                />
                <SummaryCard
                  icon={<CheckSquare size={20} />}
                  label="Tâches"
                  value={18}
                  sub="+3 ce mois"
                  iconBg="bg-orange-50"
                  iconColor="text-orange-500"
                />
                <SummaryCard
                  icon={<Clock size={20} />}
                  label="En attente"
                  value={4}
                  sub="Total"
                  iconBg="bg-red-50"
                  iconColor="text-red-500"
                />
              </div>

              {/* Quick actions */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Actions rapides</h2>
                <div className="flex gap-3 flex-wrap">
                  <QuickAction
                    icon={<Clock size={18} />}
                    label="Nouvelle timesheet"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    onClick={() => navigate('/timesheets')}
                  />
                  <QuickAction
                    icon={<Upload size={18} />}
                    label="Upload document"
                    iconBg="bg-green-50"
                    iconColor="text-green-600"
                    onClick={() => navigate('/client-database')}
                  />
                  <QuickAction
                    icon={<ClipboardList size={18} />}
                    label="Nouveau rapport"
                    iconBg="bg-orange-50"
                    iconColor="text-orange-500"
                    onClick={() => navigate('/event-reports/new')}
                  />
                  <QuickAction
                    icon={<Wifi size={18} />}
                    label="Wi-Fi Generator"
                    iconBg="bg-teal-50"
                    iconColor="text-teal-600"
                    onClick={() => navigate('/wifi-pdf')}
                  />
                </div>
              </div>

              {/* Modules */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Modules</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <ModuleCard
                    icon={<Clock size={18} />}
                    title="Timesheets"
                    description="Créez et gérez vos timesheets clients."
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    onClick={() => navigate('/timesheets')}
                  />
                  <ModuleCard
                    icon={<Users size={18} />}
                    title="Client Database"
                    description="Gérez vos clients et informations associées."
                    iconBg="bg-green-50"
                    iconColor="text-green-600"
                    onClick={() => navigate('/client-database')}
                  />
                  <ModuleCard
                    icon={<ClipboardList size={18} />}
                    title="Event Reports"
                    description="Consultez et générez vos rapports d'événements."
                    iconBg="bg-orange-50"
                    iconColor="text-orange-500"
                    onClick={() => navigate('/event-reports')}
                  />
                  <ModuleCard
                    icon={<Wifi size={18} />}
                    title="Wi-Fi Generator"
                    description="Générez facilement des codes Wi-Fi sécurisés."
                    iconBg="bg-teal-50"
                    iconColor="text-teal-600"
                    onClick={() => navigate('/wifi-pdf')}
                  />
                  <ModuleCard
                    icon={<ListTodo size={18} />}
                    title="Todo List"
                    description="Suivez vos tâches et projets."
                    iconBg="bg-teal-50"
                    iconColor="text-teal-600"
                    onClick={() => navigate('/todo')}
                  />
                </div>
              </div>

              {/* Recent documents */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Documents récents</h2>
                  <button
                    onClick={() => navigate('/client-database')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Voir tous
                  </button>
                </div>

                {docsLoading ? (
                  <div className="py-8 text-center text-sm text-gray-400">Chargement…</div>
                ) : recentDocs.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText size={28} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Aucun document pour l'instant.</p>
                    <button
                      onClick={() => navigate('/client-database')}
                      className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Importer un document
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Document</th>
                          <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Client</th>
                          <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Catégorie</th>
                          <th className="text-left text-xs font-medium text-gray-500 pb-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentDocs.map((doc) => (
                          <tr
                            key={doc.id}
                            className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                            onClick={() => navigate('/client-database')}
                          >
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <FileText size={14} className="text-gray-400 shrink-0" />
                                <span className="text-gray-800 dark:text-gray-200 truncate max-w-[220px]">{doc.name}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">{doc.clientName}</td>
                            <td className="py-3 pr-4">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                {doc.categoryName}
                              </span>
                            </td>
                            <td className="py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {formatDate(doc.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Right sidebar */}
            <div className="w-72 shrink-0 flex-col gap-6 hidden lg:flex">

              {/* Priority tasks */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tâches prioritaires</h2>
                  <button
                    onClick={() => navigate('/todo')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Voir tout
                  </button>
                </div>

                {tasksLoading ? (
                  <div className="py-6 text-center text-xs text-gray-400">Chargement…</div>
                ) : priorityTasks.length === 0 ? (
                  <div className="py-6 text-center">
                    <CheckSquare size={24} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Aucune tâche active.</p>
                    <button
                      onClick={() => navigate('/todo')}
                      className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      + Créer une tâche
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {priorityTasks.map((task) => {
                      const cfg = PRIORITY_BADGE_SIDEBAR[task.priority];
                      const clientName = task.client_id ? (clientMap[task.client_id] ?? null) : null;
                      return (
                        <button
                          key={task.id}
                          onClick={() => navigate('/todo')}
                          className={`border-l-4 pl-3 py-2 rounded-r-lg bg-gray-50 dark:bg-gray-800 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full ${cfg.borderClass}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="shrink-0">{cfg.icon}</span>
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight line-clamp-1">{task.title}</span>
                            </div>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.labelClass}`}>
                              {cfg.label}
                            </span>
                          </div>
                          {clientName !== null && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{clientName}</p>
                          )}
                          {task.due_date && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                              <Calendar size={10} />
                              Échéance : {new Date(task.due_date + 'T00:00:00').toLocaleDateString('fr-BE', { day: '2-digit', month: 'short' })}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent clients */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Clients récents</h2>
                  <button
                    onClick={() => navigate('/client-database')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Voir tout
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {PLACEHOLDER_CLIENTS.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => navigate('/client-database')}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${client.color}`}>
                        {client.initials}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1 truncate">{client.name}</span>
                      <ChevronRight size={14} className="text-gray-400 shrink-0 group-hover:text-blue-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
