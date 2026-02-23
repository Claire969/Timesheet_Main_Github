import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { LogOut, User, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      sessionStorage.setItem('force_msal_prompt','1');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle className="text-green-600" size={32} />
            <h1 className="text-3xl font-bold text-slate-900">Connecté</h1>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <User className="text-slate-600 mt-1" size={20} />
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-slate-700 mb-2">Informations utilisateur</h2>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-slate-500">Email:</span>
                    <p className="text-sm text-slate-900">{user?.email || 'Non disponible'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500">ID:</span>
                    <p className="text-sm text-slate-900 font-mono break-all">{user?.id}</p>
                  </div>
                  {user?.user_metadata?.full_name && (
                    <div>
                      <span className="text-xs font-medium text-slate-500">Nom:</span>
                      <p className="text-sm text-slate-900">{user.user_metadata.full_name}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              Bienvenue sur votre application Timesheet. Authentification réussie via Microsoft Azure.
            </p>
          </div>

          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={20} />
            {loading ? 'Déconnexion...' : 'Se déconnecter'}
          </button>
        </div>
      </div>
    </div>
  );
};
