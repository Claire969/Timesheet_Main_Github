import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { CreateEntryPayload } from '../lib/timesheetTypes';

interface NewEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateEntryPayload) => void;
}

export const NewEntryModal = ({ isOpen, onClose, onSubmit }: NewEntryModalProps) => {
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState<CreateEntryPayload>({
    entry_date: today,
    start_time: '09:00',
    end_time: '17:00',
    break_minutes: 60,
    title: '',
    notes: '',
  });

  const [error, setError] = useState<string | null>(null);

  const validateForm = (): string | null => {
    if (!formData.title.trim()) {
      return 'Le titre est obligatoire';
    }

    if (!formData.entry_date) {
      return 'La date est obligatoire';
    }

    if (!formData.start_time || !formData.end_time) {
      return 'Les heures de début et fin sont obligatoires';
    }

    const start = new Date(`2000-01-01T${formData.start_time}`);
    const end = new Date(`2000-01-01T${formData.end_time}`);

    if (end < start) {
      return 'L\'heure de fin doit être après l\'heure de début';
    }

    if (formData.break_minutes < 0) {
      return 'La pause ne peut pas être négative';
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onSubmit(formData);

    setFormData({
      entry_date: today,
      start_time: '09:00',
      end_time: '17:00',
      break_minutes: 60,
      title: '',
      notes: '',
    });
    onClose();
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Nouvelle entrée</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="entry_date" className="block text-sm font-medium text-slate-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              id="entry_date"
              value={formData.entry_date}
              onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-slate-700 mb-1">
                Heure de début *
              </label>
              <input
                type="time"
                id="start_time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="end_time" className="block text-sm font-medium text-slate-700 mb-1">
                Heure de fin *
              </label>
              <input
                type="time"
                id="end_time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="break_minutes" className="block text-sm font-medium text-slate-700 mb-1">
              Pause (minutes)
            </label>
            <input
              type="number"
              id="break_minutes"
              value={formData.break_minutes}
              onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) || 0 })}
              min="0"
              step="15"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
              Titre *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Ex: Développement feature X"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Détails supplémentaires..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
