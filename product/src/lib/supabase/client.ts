import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSharedSessionStorage } from '@/lib/supabase/sessionStorage';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

// 세션 저장소: do-it.company 계열 주소에서는 도메인 쿠키(브랜드·앱 공유), 그 밖에는 Supabase 기본(localStorage).
const sharedStorage = createSharedSessionStorage();

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    ...(sharedStorage ? { storage: sharedStorage } : {}),
  },
});
