import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, ExternalLink, FileSpreadsheet, Users, ClipboardList, Database, Clock, Shield, LogOut, Wifi } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface AppNavProps {
  onExportExcel?: () => void;
  onOpenClients?: () => void;
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return { open, setOpen, ref };
}

function getUserInitials(user: { email?: string | null; user_metadata?: { full_name?: string; name?: string } } | null): string {
  if (!user) return '?';
  const name = user.user_metadata?.full_name || user.user_metadata?.name;
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (user.email) return user.email[0].toUpperCase();
  return '?';
}

function getUserDisplayName(user: { email?: string | null; user_metadata?: { full_name?: string; name?: string } } | null): string {
  if (!user) return '';
  return user.user_metadata?.full_name || user.user_metadata?.name || user.email || '';
}

function getUserAvatar(user: { user_metadata?: { avatar_url?: string; picture?: string } } | null): string | null {
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
}

export function AppNav({ onExportExcel, onOpenClients }: AppNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const timesheetDd = useDropdown();
  const toolsDd = useDropdown();
  const userDd = useDropdown();

  const handleSignOut = async () => {
    userDd.setOpen(false);
    try {
      sessionStorage.setItem('force_msal_prompt', '1');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign out error', err);
    }
  };

  const closeAll = () => {
    timesheetDd.setOpen(false);
    toolsDd.setOpen(false);
    userDd.setOpen(false);
  };

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  const avatarUrl = getUserAvatar(user);
  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">

        <div className="flex items-center gap-1">
          <button
            onClick={() => { closeAll(); navigate('/'); }}
            className="flex items-center shrink-0 mr-3"
          >
            <img
              src="/images/ui/logo-clear-computing.png"
              alt="Clear Computing"
              className="h-7 w-auto max-w-[150px] object-contain"
            />
          </button>

          <div ref={timesheetDd.ref} className="relative">
            <button
              onClick={() => { toolsDd.setOpen(false); userDd.setOpen(false); timesheetDd.setOpen(v => !v); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive('/') || isActive('/client')
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Clock size={14} />
              Timesheet
              <ChevronDown size={12} className={`transition-transform ${timesheetDd.open ? 'rotate-180' : ''}`} />
            </button>
            {timesheetDd.open && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1.5 z-50">
                <button
                  onClick={() => { closeAll(); navigate('/'); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <Clock size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  Timesheet
                </button>
                <button
                  onClick={() => { closeAll(); if (location.pathname !== '/') navigate('/'); onOpenClients?.(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <Users size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  Gestion clients
                </button>
                <button
                  onClick={() => { closeAll(); onExportExcel?.(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <FileSpreadsheet size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  Export Excel
                </button>
              </div>
            )}
          </div>

          <div ref={toolsDd.ref} className="relative">
            <button
              onClick={() => { timesheetDd.setOpen(false); userDd.setOpen(false); toolsDd.setOpen(v => !v); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive('/event-reports') || isActive('/client-database')
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Tools
              <ChevronDown size={12} className={`transition-transform ${toolsDd.open ? 'rotate-180' : ''}`} />
            </button>
            {toolsDd.open && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1.5 z-50">
                <a
                  href="https://vault.clearcomputing.be"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeAll}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Shield size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  Vault
                  <ExternalLink size={11} className="text-gray-400 dark:text-gray-500 ml-auto" />
                </a>
                <button
                  onClick={() => { closeAll(); navigate('/event-reports'); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <ClipboardList size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  Rapports événement
                </button>
                <button
                  onClick={() => { closeAll(); navigate('/client-database'); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors text-left ${
                    isActive('/client-database')
                      ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Database size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  Base clients
                </button>
                <div className="my-1 mx-3 border-t border-gray-100 dark:border-gray-700" />
                <button
                  onClick={() => { closeAll(); navigate('/wifi-pdf'); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors text-left ${
                    isActive('/wifi-pdf')
                      ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Wifi size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  Wi-Fi PDF Generator
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />

          <div ref={userDd.ref} className="relative ml-1">
            <button
              onClick={() => { timesheetDd.setOpen(false); toolsDd.setOpen(false); userDd.setOpen(v => !v); }}
              className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              title={displayName}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={initials} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
              )}
            </button>

            {userDd.open && (
              <div className="absolute top-full right-0 mt-1.5 w-60 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1.5 z-50">
                <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Connecté en tant que</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{displayName || 'Mode preview'}</p>
                </div>
                <div className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed select-none">
                  <Users size={14} className="shrink-0" />
                  Gestion utilisateurs
                  <span className="ml-auto text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                    Bientôt
                  </span>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                  >
                    <LogOut size={14} className="shrink-0" />
                    Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
