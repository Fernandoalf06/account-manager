import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

export function getSupabase() {
  if (!supabase && supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project.supabase.co') {
    supabase = createClient(supabaseUrl, supabaseKey, {
      realtime: {
        params: { eventsPerSecond: 2 },
      },
    });
  }
  return supabase;
}

export function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project.supabase.co');
}
