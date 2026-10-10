import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { retireSharedSessionCookies } from '@/lib/supabase/sessionStorage';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;
const authKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
retireSharedSessionCookies(authKey);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: authKey,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
