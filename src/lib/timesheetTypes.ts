export interface TimesheetEntry {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  title: string;
  notes: string;
  created_at: string;
}

export interface CreateEntryPayload {
  entry_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  title: string;
  notes: string;
}

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

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
