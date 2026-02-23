import { supabase } from './supabaseClient';

export interface TimesheetEntry {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  title: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEntryPayload {
  entry_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  title: string;
  notes?: string;
}

export interface UpdateEntryPayload {
  entry_date?: string;
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
  title?: string;
  notes?: string;
}

export const timesheetApi = {
  async listEntries(from?: string, to?: string): Promise<TimesheetEntry[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      let query = supabase
        .from('timesheet.entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (from) {
        query = query.gte('entry_date', from);
      }

      if (to) {
        query = query.lte('entry_date', to);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          throw new Error(
            'La table timesheet.entries n\'existe pas encore. Veuillez exécuter la migration SQL (voir sql/README.md)'
          );
        }
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error listing entries:', error);
      throw error;
    }
  },

  async createEntry(payload: CreateEntryPayload): Promise<TimesheetEntry> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      const { data, error } = await supabase
        .from('timesheet.entries')
        .insert({
          user_id: user.id,
          ...payload,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          throw new Error(
            'La table timesheet.entries n\'existe pas encore. Veuillez exécuter la migration SQL (voir sql/README.md)'
          );
        }
        throw error;
      }

      if (!data) {
        throw new Error('Aucune donnée retournée après la création');
      }

      return data;
    } catch (error) {
      console.error('Error creating entry:', error);
      throw error;
    }
  },

  async updateEntry(id: string, payload: UpdateEntryPayload): Promise<TimesheetEntry> {
    try {
      const { data, error } = await supabase
        .from('timesheet.entries')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          throw new Error(
            'La table timesheet.entries n\'existe pas encore. Veuillez exécuter la migration SQL (voir sql/README.md)'
          );
        }
        throw error;
      }

      if (!data) {
        throw new Error('Entrée non trouvée');
      }

      return data;
    } catch (error) {
      console.error('Error updating entry:', error);
      throw error;
    }
  },

  async deleteEntry(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('timesheet.entries')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          throw new Error(
            'La table timesheet.entries n\'existe pas encore. Veuillez exécuter la migration SQL (voir sql/README.md)'
          );
        }
        throw error;
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      throw error;
    }
  },
};

export function calculateDuration(
  startTime: string,
  endTime: string,
  breakMinutes: number
): number {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);

  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = diffMs / 60000;

  return Math.max(0, diffMinutes - breakMinutes);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours === 0) {
    return `${mins}min`;
  }

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h${mins.toString().padStart(2, '0')}`;
}
