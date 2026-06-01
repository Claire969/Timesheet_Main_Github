import { useNavigate } from 'react-router-dom';
import {
  Users,
  FileText,
  CheckSquare,
  Clock,
  ChevronRight,
  LayoutGrid,
  Upload,
  ClipboardList,
  Wifi,
  ListTodo,
  AlertCircle,
  Star,
  Info,
} from 'lucide-react';
import { AppNav } from '../components/AppNav';
import { useAuth } from '../contexts/AuthContext';

function getUserFirstName(user: { email?: string | null; user_metadata?: { full_name?: string; name?: string } } | null): string {
  if (!user) return '';
  const name = user.user_metadata?.full_name || user.user_metadata?.name;
  if (name) return name.trim().split(' ')[0];
  if (user.email) return user.email.split('@')[0];
  return '';
}

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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 flex-1 min-w-0">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-blue-600 mt-1">{sub}</p>
      </div>
    </div>
  );
}

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
      className="flex-1 min-w-[140px] flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg} group-hover:scale-105 transition-transform`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <span className="text-sm font-medium text-gray-700 text-left leading-tight">{label}</span>
      <ChevronRight size={14} className="text-gray-400 ml-auto shrink-0 group-hover:text-blue-500 transition-colors" />
    </button>
  );
}

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
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      {comingSoon ? (
        <button
          disabled
          className="mt-auto w-full py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs font-medium text-gray-400 cursor-not-allowed"
        >
          À venir
        </button>
      ) : (
        <button
          onClick={onClick}
          className="mt-auto w-full py-2 rounded-lg border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
        >
          Ouvrir
        </button>
      )}
    </div>
  );
}

type Priority = 'urgent' | 'important' | 'urgent-important' | 'normal';

interface TaskItem {
  id: number;
  title: string;
  client: string;
  due: string;
  priority: Priority;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; labelClass: string; borderClass: string; icon: React.ReactNode }> = {
  urgent: {
    label: 'Urgent',
    labelClass: 'bg-red-100 text-red-700',
    borderClass: 'border-l-red-500',
    icon: <AlertCircle size={14} className="text-red-500" />,
  },
  important: {
    label: 'Important',
    labelClass: 'bg-orange-100 text-orange-700',
    borderClass: 'border-l-orange-400',
    icon: <Star size={14} className="text-orange-400" />,
  },
  'urgent-important': {
    label: 'Urgent + Important',
    labelClass: 'bg-red-100 text-red-700',
    borderClass: 'border-l-red-500',
    icon: <Star size={14} className="text-red-500" />,
  },
  normal: {
    label: 'Normal',
    labelClass: 'bg-blue-100 text-blue-700',
    borderClass: 'border-l-blue-400',
    icon: <Info size={14} className="text-blue-500" />,
  },
};

const PLACEHOLDER_TASKS: TaskItem[] = [
  { id: 1, title: 'Finaliser le rapport événement', client: 'TheEgg', due: "Aujourd'hui", priority: 'urgent' },
  { id: 2, title: 'Relancer devis client', client: 'Pepibru', due: '22 mai 2025', priority: 'important' },
  { id: 3, title: 'Vérification des documents', client: 'AfinIT Consulting', due: '23 mai 2025', priority: 'urgent-important' },
  { id: 4, title: 'Préparer réunion client', client: 'Event Lounge', due: '26 mai 2025', priority: 'normal' },
];

type DocCategory = 'Rapport' | 'Devis' | 'Finance' | 'Technique';

interface RecentDoc {
  id: number;
  name: string;
  client: string;
  category: DocCategory;
  date: string;
}

const CATEGORY_COLORS: Record<DocCategory, string> = {
  Rapport: 'bg-blue-100 text-blue-700',
  Devis: 'bg-green-100 text-green-700',
  Finance: 'bg-yellow-100 text-yellow-700',
  Technique: 'bg-orange-100 text-orange-700',
};

const PLACEHOLDER_DOCS: RecentDoc[] = [
  { id: 1, name: 'Rapport événement - Launch 2025.pdf', client: 'TheEgg', category: 'Rapport', date: '20 mai 2025' },
  { id: 2, name: 'Devis - Support technique.docx', client: 'Pepibru', category: 'Devis', date: '18 mai 2025' },
  { id: 3, name: 'Budget prévisionnel Q2.xlsx', client: 'AfinIT Consulting', category: 'Finance', date: '17 mai 2025' },
  { id: 4, name: 'Plan de salle - Event Lounge.pdf', client: 'Event Lounge', category: 'Technique', date: '15 mai 2025' },
];

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

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = getUserFirstName(user);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNav />

      <main className="pt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {firstName ? `Bienvenue ${firstName} \u2014 ` : ''}aperçu rapide de votre activité.
            </p>
          </div>

          <div className="flex gap-6 items-start">
            {/* Left / Main column */}
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
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
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
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
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
                    iconBg="bg-gray-100"
                    iconColor="text-gray-400"
                    comingSoon
                  />
                </div>
              </div>

              {/* Recent documents */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Documents récents</h2>
                  <button
                    onClick={() => navigate('/client-database')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Voir tous
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Document</th>
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Client</th>
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Catégorie</th>
                        <th className="text-left text-xs font-medium text-gray-500 pb-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PLACEHOLDER_DOCS.map((doc) => (
                        <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <FileText size={14} className="text-gray-400 shrink-0" />
                              <span className="text-gray-800 truncate max-w-[220px]">{doc.name}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-gray-600">{doc.client}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[doc.category]}`}>
                              {doc.category}
                            </span>
                          </td>
                          <td className="py-3 text-gray-500">{doc.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Right sidebar */}
            <div className="w-72 shrink-0 flex flex-col gap-6 hidden lg:flex">

              {/* Priority tasks */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">Tâches prioritaires</h2>
                  <button className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                    Voir tout
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {PLACEHOLDER_TASKS.map((task) => {
                    const cfg = PRIORITY_CONFIG[task.priority];
                    return (
                      <div
                        key={task.id}
                        className={`border-l-4 pl-3 py-2 rounded-r-lg bg-gray-50 ${cfg.borderClass}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5">
                            {cfg.icon}
                            <span className="text-xs font-semibold text-gray-800 leading-tight">{task.title}</span>
                          </div>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.labelClass}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{task.client}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Échéance : {task.due}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent clients */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">Clients récents</h2>
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
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group w-full text-left"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${client.color}`}>
                        {client.initials}
                      </div>
                      <span className="text-sm font-medium text-gray-700 flex-1 truncate">{client.name}</span>
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

// Named export also available as default for flexibility
export default Dashboard;
