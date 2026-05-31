import { useEffect, useRef } from 'react';
import { supabase, supabaseEnabled } from './supabaseClient';
import { useAppState } from '../App';

// Shared hook: loads the client list from Supabase into shared app state.
// Safe to call from multiple pages — only fetches when the list is empty
// and guards against duplicate in-flight requests via a ref flag.
export function useLoadClients() {
  const { clients, setClients } = useAppState();
  const fetching = useRef(false);

  useEffect(() => {
    if (!supabaseEnabled) return;
    if (clients.length > 0) return;    // already loaded (e.g. came from Home)
    if (fetching.current) return;      // already in flight
    fetching.current = true;

    supabase
      .schema('timesheet')
      .from('clients')
      .select('id,name,logo_url,half_hour,hour,travel_half_hour,half_day,full_day,created_at')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        fetching.current = false;
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
      .catch(() => { fetching.current = false; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
