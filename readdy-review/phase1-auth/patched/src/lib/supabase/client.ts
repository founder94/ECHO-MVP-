import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * auth.lock 옵션을 지정하지 않는다.
 * supabase-js 2.57.4(auth-js 2.71.1)는 브라우저에 navigator.locks가 있으면 자체 navigatorLock을,
 * 없으면 no-op lock을 자동 선택한다. 자체 구현은 acquireTimeout 계약(-1 = 무한 대기, 0 = 즉시 시도,
 * 양수 = 대기 시간)을 지키므로 별도 wrapper가 필요 없다.
 * 이전 custom acquireLock은 (1) 항상 ifAvailable로 잠금 없이 실행, (2) acquireTimeout=-1에서 즉시 거부 후
 * fn()을 재호출해 모든 인증 작업이 두 번 실행되는 문제가 있었다 (readdy-review/phase1-auth/lock.test.ts).
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
