export type EventVenue = {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
};

export type EventReport = {
  id: string;
  user_id: string;
  venue_client_id: string | null;
  final_client_name: string;
  event_name: string;
  start_date: string | null;
  total_days: number;
  current_day: number;
  status: 'draft' | 'in_progress' | 'completed';
  created_at: string;
};

export type EventReportDay = {
  id: string;
  report_id: string;
  day_number: number;
  report_date: string | null;
  is_setup_day: boolean;
  status: 'open' | 'validated';
  summary: string;
  created_at: string;
};

export type EventReportHourlyRow = {
  id: string;
  day_id: string;
  hour_label: string;
  wifi_users: number;
  bandwidth_in: number;
  bandwidth_out: number;
  notes: string;
};

export type EventReportIncident = {
  id: string;
  day_id: string;
  incident_time: string | null;
  title: string;
  description: string;
  resolution: string;
  network_impact: boolean;
  network_impact_text: string | null;
  created_at: string;
};

export type EventReportImage = {
  id: string;
  day_id: string;
  file_url: string;
  caption: string;
  sort_order: number;
  created_at: string;
};
