import { supabase } from './supabaseClient';
import type {
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

export const reportApi = {
  async list(): Promise<(EventReport & { venue_client_name?: string; venue_client_logo?: string })[]> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_reports')
      .select('*, venue_client:clients(name, logo_url)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      ...r,
      venue_client_name: r.venue_client?.name ?? '',
      venue_client_logo: r.venue_client?.logo_url ?? null,
    }));
  },

  async get(id: string): Promise<EventReport & { venue_client_name?: string; venue_client_logo?: string }> {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_reports')
      .select('*, venue_client:clients(name, logo_url)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Rapport introuvable');
    return {
      ...data,
      venue_client_name: data.venue_client?.name ?? '',
      venue_client_logo: data.venue_client?.logo_url ?? null,
    };
  },

  async create(payload: {
    venue_client_id?: string | null;
    final_client_name: string;
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

    const days = Array.from({ length: payload.total_days }, (_, i) => {
      let report_date: string | null = null;
      if (payload.start_date) {
        const d = new Date(payload.start_date);
        d.setDate(d.getDate() + i);
        report_date = d.toISOString().slice(0, 10);
      }
      return { report_id: report.id, day_number: i + 1, status: 'open', summary: '', is_setup_day: false, report_date };
    });
    const { error: daysError } = await supabase
      .schema(SCHEMA)
      .from('event_report_days')
      .insert(days);
    if (daysError) throw daysError;

    return report;
  },

  async update(id: string, payload: Partial<Pick<EventReport, 'event_name' | 'venue_client_id' | 'final_client_name' | 'start_date' | 'total_days' | 'current_day' | 'status' | 'language'>>): Promise<void> {
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

  async update(id: string, payload: Partial<Pick<EventReportDay, 'report_date' | 'summary' | 'status' | 'is_setup_day'>>): Promise<void> {
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

  async update(id: string, payload: Partial<Omit<EventReportIncident, 'id' | 'day_id' | 'created_at'>> & { network_impact_text?: string | null }): Promise<void> {
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
