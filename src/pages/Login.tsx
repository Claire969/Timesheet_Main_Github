import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

const bypassAllowed = import.meta.env.DEV && !window.location.hostname.endsWith('clearcomputing.be');

const Login = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forcePrompt = sessionStorage.getItem('force_msal_prompt') === '1';

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleMicrosoftLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'openid profile email User.Read',
          queryParams: {
            prompt: forcePrompt ? 'login' : 'select_account',
          },
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <img
        src="/images/ui/logo-clear-computing.png"
        alt="Clear Computing"
        className="h-20 sm:h-24 w-auto mx-auto mb-6 drop-shadow-sm"
      />
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Timesheet</h1>
          <p className="text-slate-600">Connectez-vous pour continuer</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleMicrosoftLogin}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <LogIn size={20} />
          {loading ? 'Connexion...' : 'Se connecter avec Microsoft'}
        </button>

        {bypassAllowed && (
          <button
            onClick={() => {
              sessionStorage.setItem('ts_auth_bypass', '1');
              navigate('/');
            }}
            className="mt-3 w-full border border-slate-300 hover:bg-slate-50 text-slate-600 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Mode preview (bypass auth)
          </button>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Authentification sécurisée via Microsoft Azure
        </p>
      </div>
    </div>
  );
};

export default Login;
