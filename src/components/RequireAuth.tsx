import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabaseEnabled } from '../lib/supabaseClient';

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (!supabaseEnabled) {
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
