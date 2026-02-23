import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { LogOut, Plus, Clock, Calendar, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TimesheetEntry, CreateEntryPayload, calculateDuration, formatDuration, generateId } from '../lib/timesheetTypes';
import { NewEntryModal } from '../components/NewEntryModal';

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSignOut = async () => {
    try {
      sessionStorage.setItem('force_msal_prompt', '1');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const handleCreateEntry = (payload: CreateEntryPayload) => {
    const newEntry: TimesheetEntry = {
      id: generateId(),
      ...payload,
      created_at: new Date().toISOString(),
    };

    setEntries([newEntry, ...entries]);
  };

  const handleDeleteEntry = (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette entrée ?')) {
      return;
    }

    setDeletingId(id);
    setTimeout(() => {
      setEntries(entries.filter(entry => entry.id !== id));
      setDeletingId(null);
    }, 300);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Timesheet</h1>
              <p className="text-sm text-slate-600">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Mes entrées</h2>
              <p className="text-sm text-slate-600 mt-1">
                {entries.length > 0 ? `${entries.length} entrée${entries.length > 1 ? 's' : ''}` : 'Aucune entrée'}
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              Nouvelle entrée
            </button>
          </div>

          {entries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Clock className="mx-auto mb-4 text-slate-300" size={64} />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Aucune entrée</h3>
              <p className="text-slate-600 mb-6">Commencez par créer votre première entrée timesheet</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Plus size={20} />
                Créer une entrée
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const duration = calculateDuration(entry.start_time, entry.end_time, entry.break_minutes);
                const isDeleting = deletingId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 border border-slate-100"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="text-slate-400 flex-shrink-0" size={18} />
                            <span className="text-sm font-medium text-slate-600">
                              {formatDate(entry.entry_date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Clock size={16} />
                            <span>
                              {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                            </span>
                          </div>
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                          {entry.title}
                        </h3>

                        {entry.notes && (
                          <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                            {entry.notes}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                            {formatDuration(duration)}
                          </div>
                          {entry.break_minutes > 0 && (
                            <span className="text-slate-500">
                              Pause: {entry.break_minutes} min
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={isDeleting}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                        title="Supprimer"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <NewEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateEntry}
      />
    </div>
  );
};
