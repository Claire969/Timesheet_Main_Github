import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { LogOut, Plus, Trash2, X } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">Clear_Computing</div>
          <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">Timesheet</h1>
        <p className="text-lg text-gray-500 mb-10">{user?.email || 'Mode preview'}</p>

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
    </div>
  );
};
