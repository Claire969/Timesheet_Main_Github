import { supabase } from './supabaseClient';

export type AiAction = 'correct_fr' | 'rewrite_fr' | 'translate_en';

export async function aiAssistIncident(text: string, action: AiAction): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-incident-assist`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ text, action }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(body || `HTTP ${res.status}`);
  return body;
}
