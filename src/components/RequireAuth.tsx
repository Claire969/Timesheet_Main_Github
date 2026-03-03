import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabaseEnabled } from '../lib/supabaseClient';

const bypassAllowed = import.meta.env.DEV && !window.location.hostname.endsWith('clearcomputing.be');

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (!supabaseEnabled) {
    return <>{children}</>;
  }

  if (bypassAllowed && sessionStorage.getItem('ts_auth_bypass') === '1') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
