import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

async function acquireLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    return fn();
  }

  try {
    return await navigator.locks.request(
      name,
      { ifAvailable: true },
      async (lock): Promise<R> => {
        if (!lock) return fn();

        return await Promise.race<R>([
          fn(),
          new Promise<R>((_, reject) =>
            setTimeout(
              () => reject(new Error('Lock acquisition timed out')),
              acquireTimeout,
            ),
          ),
        ]);
      },
    );
  } catch {
    return fn();
  }
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: acquireLock,
    },
  },
);
