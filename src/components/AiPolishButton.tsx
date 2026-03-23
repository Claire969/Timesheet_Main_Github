import { useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { aiAssistIncident } from '../lib/aiIncidentApi';
import type { AiAction } from '../lib/aiIncidentApi';

interface AiPolishButtonProps {
  text: string;
  language: 'fr' | 'en';
  onAccept: (result: string) => void;
  direct?: boolean;
}

export function AiPolishButton({ text, language, onAccept, direct = false }: AiPolishButtonProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const action: AiAction = language === 'en' ? 'translate_en' : 'rewrite_fr';

  const handleClick = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setPreview(null);
    setError(null);
    try {
      const result = await aiAssistIncident(text, action);
      if (direct) {
        onAccept(result);
      } else {
        setPreview(result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'IA non configurée');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (preview !== null) {
      onAccept(preview);
      setPreview(null);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setError(null);
  };

  return (
    <div className="mt-1.5">
      {preview === null && error === null && (
        <button
          type="button"
          onClick={handleClick}
          disabled={loading || !text.trim()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 transition-colors"
        >
          <Sparkles size={11} />
          {loading ? 'En cours...' : 'Correction & lissage'}
        </button>
      )}

      {error !== null && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-500 italic">{error}</span>
          <button type="button" onClick={handleCancel} className="text-xs text-gray-400 hover:text-gray-600">
            <X size={12} />
          </button>
        </div>
      )}

      {!direct && preview !== null && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-700 mb-1.5">Suggestion IA</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{preview}</p>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              <Check size={11} />
              Remplacer
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X size={11} />
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
