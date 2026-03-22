import { createContext, useContext, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import Login from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Home } from './pages/Home';
import { ClientTimesheets } from './pages/ClientTimesheets';
import { EventReports } from './pages/EventReports';
import { EventReportForm } from './pages/EventReportForm';
import { EventReportDetail } from './pages/EventReportDetail';
import { EventReportDayEditor } from './pages/EventReportDayEditor';

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
  isEvent: boolean;
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
          <Route
            path="/event-reports"
            element={
              <RequireAuth>
                <EventReports />
              </RequireAuth>
            }
          />
          <Route
            path="/event-reports/new"
            element={
              <RequireAuth>
                <EventReportForm />
              </RequireAuth>
            }
          />
          <Route
            path="/event-reports/:id/edit"
            element={
              <RequireAuth>
                <EventReportForm />
              </RequireAuth>
            }
          />
          <Route
            path="/event-reports/:id"
            element={
              <RequireAuth>
                <EventReportDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/event-reports/:reportId/days/:dayId"
            element={
              <RequireAuth>
                <EventReportDayEditor />
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
