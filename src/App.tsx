import { createContext, useContext, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import Login from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Home } from './pages/Home';
import { ClientTimesheets } from './pages/ClientTimesheets';

export type Forfait = 'none' | 'halfDay' | 'fullDay';

export interface Client {
  id: string;
  name: string;
  logoUrl?: string;
  isArchived: boolean;
  rates: {
    halfHour: number;
    hour: number;
    travelHalfHour: number;
    halfDay: number;
    fullDay: number;
  };
}

export type BillingStatus = 'unbilled' | 'pending' | 'archived';

export interface TimesheetEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isForfait: Forfait;
  caller: string;
  description: string;
  travelUnits: number;
  total: number;
  billingStatus: BillingStatus;
  pendingAt?: string;
  archivedAt?: string;
}

export type ClientTimesheetsMap = Record<string, TimesheetEntry[]>;

interface AppStateCtx {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  clientTimesheets: ClientTimesheetsMap;
  setClientTimesheets: React.Dispatch<React.SetStateAction<ClientTimesheetsMap>>;
}

const AppStateContext = createContext<AppStateCtx | null>(null);

export const useAppState = () => {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
};

function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientTimesheets, setClientTimesheets] = useState<ClientTimesheetsMap>({});

  return (
    <AppStateContext.Provider value={{ clients, setClients, clientTimesheets, setClientTimesheets }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/client/:clientId"
            element={
              <RequireAuth>
                <ClientTimesheets />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </AppStateContext.Provider>
  );
}

export default App;
