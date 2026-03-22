import { supabase } from './supabaseClient';
import type {
  EventVenue,
  EventReport,
  EventReportDay,
  EventReportHourlyRow,
  EventReportIncident,
  EventReportImage,
} from './eventReportTypes';

const SCHEMA = 'timesheet';

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non authentifié');
  return user;
}

export const venueApi = {
  async list(): Promise<EventVenue[]> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_venues')
      .select('*')
      .order('name');
    if (error) throw error;
    return data ?? [];
  },

  async create(name: string, logo_url?: string, notes?: string): Promise<EventVenue> {
    const user = await getUser();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_venues')
      .insert({ user_id: user.id, name, logo_url: logo_url ?? null, notes: notes ?? null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

export const reportApi = {
  async list(): Promise<(EventReport & { client_name?: string; venue_name?: string })[]> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_reports')
      .select('*, client:clients(name), venue:event_venues(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      ...r,
      client_name: r.client?.name ?? '',
      venue_name: r.venue?.name ?? '',
    }));
  },

  async get(id: string): Promise<EventReport & { client_name?: string; venue_name?: string }> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_reports')
      .select('*, client:clients(name), venue:event_venues(name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Rapport introuvable');
    return { ...data, client_name: data.client?.name ?? '', venue_name: data.venue?.name ?? '' };
  },

  async create(payload: {
    client_id: string;
    venue_id?: string | null;
    event_name: string;
    start_date?: string | null;
    total_days: number;
  }): Promise<EventReport> {
    const user = await getUser();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_reports')
      .insert({ user_id: user.id, ...payload, current_day: 1, status: 'draft' })
      .select()
      .single();
    if (error) throw error;
    const report = data as EventReport;

    const days = Array.from({ length: payload.total_days }, (_, i) => ({
      report_id: report.id,
      day_number: i + 1,
      status: 'open',
      summary: '',
    }));
    const { error: daysError } = await supabase
      .schema(SCHEMA)
      .from('event_report_days')
      .insert(days);
    if (daysError) throw daysError;

    return report;
  },

  async update(id: string, payload: Partial<Pick<EventReport, 'event_name' | 'client_id' | 'venue_id' | 'start_date' | 'total_days' | 'current_day' | 'status'>>): Promise<void> {
    const { error } = await supabase
      .schema(SCHEMA)
      .from('event_reports')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  },
};

export const dayApi = {
  async listForReport(report_id: string): Promise<EventReportDay[]> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_report_days')
      .select('*')
      .eq('report_id', report_id)
      .order('day_number');
    if (error) throw error;
    return data ?? [];
  },

  async get(id: string): Promise<EventReportDay> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_report_days')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Jour introuvable');
    return data;
  },

  async update(id: string, payload: Partial<Pick<EventReportDay, 'report_date' | 'summary' | 'status'>>): Promise<void> {
    const { error } = await supabase
      .schema(SCHEMA)
      .from('event_report_days')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  },

  async validate(day: EventReportDay, report: EventReport): Promise<void> {
    await dayApi.update(day.id, { status: 'validated' });
    const newCurrentDay = Math.min(report.current_day + 1, report.total_days + 1);
    const newStatus: EventReport['status'] =
      newCurrentDay > report.total_days ? 'completed' : 'in_progress';
    await reportApi.update(report.id, { current_day: newCurrentDay, status: newStatus });
  },
};

export const hourlyApi = {
  async listForDay(day_id: string): Promise<EventReportHourlyRow[]> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_report_hourly_rows')
      .select('*')
      .eq('day_id', day_id)
      .order('hour_label');
    if (error) throw error;
    return data ?? [];
  },

  async upsert(row: Omit<EventReportHourlyRow, 'id'> & { id?: string }): Promise<EventReportHourlyRow> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_report_hourly_rows')
      .upsert(row)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .schema(SCHEMA)
      .from('event_report_hourly_rows')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export const incidentApi = {
  async listForDay(day_id: string): Promise<EventReportIncident[]> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_report_incidents')
      .select('*')
      .eq('day_id', day_id)
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  },

  async create(payload: Omit<EventReportIncident, 'id' | 'created_at'>): Promise<EventReportIncident> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_report_incidents')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: Partial<Omit<EventReportIncident, 'id' | 'day_id' | 'created_at'>>): Promise<void> {
    const { error } = await supabase
      .schema(SCHEMA)
      .from('event_report_incidents')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .schema(SCHEMA)
      .from('event_report_incidents')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export const imageApi = {
  async listForDay(day_id: string): Promise<EventReportImage[]> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_report_images')
      .select('*')
      .eq('day_id', day_id)
      .order('sort_order');
    if (error) throw error;
    return data ?? [];
  },

  async create(payload: Omit<EventReportImage, 'id' | 'created_at'>): Promise<EventReportImage> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_report_images')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: Partial<Pick<EventReportImage, 'file_url' | 'caption' | 'sort_order'>>): Promise<void> {
    const { error } = await supabase
      .schema(SCHEMA)
      .from('event_report_images')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .schema(SCHEMA)
      .from('event_report_images')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
