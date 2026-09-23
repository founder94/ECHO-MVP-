import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

// A·B 통합(2026-09-05): DO IT(A) 화면은 ECHO(B)와 같은 Supabase 클라이언트 1개를 공유한다.
// 별도 createClient 없음 → 로그인 세션·토큰 갱신이 한 곳에서만 일어난다(계정 하나로 통합).
const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabase(): SupabaseClient | null {
  return isSupabaseConfigured ? supabase : null;
}