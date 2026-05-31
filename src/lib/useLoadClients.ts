import { useEffect, useRef, useState } from 'react';
import { supabase, supabaseEnabled } from './supabaseClient';
import { useAppState } from '../App';

// Shared hook: loads the client list from Supabase into shared app state.
// Safe to call from multiple pages — only fetches when the list is empty
// and guards against duplicate in-flight requests via a ref flag.
export function useLoadClients() {
  const { clients, setClients } = useAppState();
  const fetching = useRef(false);
  const [loading, setLoading] = useState(() => supabaseEnabled && clients.length === 0);

  useEffect(() => {
    if (!supabaseEnabled) {
      setLoading(false);
      return;
    }
    if (clients.length > 0) {    // already loaded (e.g. came from Home)
      setLoading(false);
      return;
    }
    if (fetching.current) return;      // already in flight
    fetching.current = true;
    setLoading(true);

    supabase
      .schema('timesheet')
      .from('clients')
      .select('id,name,logo_url,half_hour,hour,travel_half_hour,half_day,full_day,created_at')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        fetching.current = false;
        setLoading(false);
        if (!data) return;
        setClients(data.map((r: any) => ({
          id: r.id,
          name: r.name,
          logoUrl: r.logo_url ?? undefined,
          isArchived: false,
          rates: {
            halfHour: Number(r.half_hour) || 0,
            hour: Number(r.hour) || 0,
            travelHalfHour: Number(r.travel_half_hour) || 0,
            halfDay: Number(r.half_day) || 0,
            fullDay: Number(r.full_day) || 0,
          },
        })));
      })
      .catch(() => {
        fetching.current = false;
        setLoading(false);
      });
  }, [clients.length, setClients]);

  return { loading };
}
