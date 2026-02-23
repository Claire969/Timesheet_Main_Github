// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseEnabled) {
  // Bolt preview / environnement sans .env : on évite l'écran blanc.
  console.warn('[supabase] Missing env vars. UI-only mode enabled.');
}

export const supabase = createClient(
  supabaseEnabled ? supabaseUrl! : 'http://localhost',
  supabaseEnabled ? supabaseAnonKey! : 'public-anon-key',
  {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: supabaseEnabled,
      detectSessionInUrl: supabaseEnabled,
      persistSession: supabaseEnabled,
    },
  }
);