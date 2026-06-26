import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 환경 변수가 설정되지 않았습니다. Supabase를 먼저 연결해주세요.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

const acquireLock = (name: string, timeout = 10000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.locks) {
      resolve(true);
      return;
    }
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, timeout);
    navigator.locks.request(name, () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(true);
      }
    });
  });
};

export { acquireLock };