import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { rememberReturnPath } from '@/lib/auth/returnPath';

export interface SignUpParams {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthResult {
  error: string | null;
  needsEmailConfirm?: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: (returnPath: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const OAUTH_CALLBACK_PATH = '/auth/callback';
const DEFAULT_DISPLAY_NAME = '사용자';

function oauthRedirectUrl(): string {
  const base = (__BASE_PATH__ || '/').replace(/\/$/, '');
  return `${window.location.origin}${base}${OAUTH_CALLBACK_PATH}`;
}

function displayNameOf(user: User): string {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const candidate = meta.display_name ?? meta.full_name ?? meta.name;

  return typeof candidate === 'string' && candidate.trim()
    ? candidate.trim()
    : DEFAULT_DISPLAY_NAME;
}

async function ensureProfile(user: User): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          display_name: displayNameOf(user),
        },
        {
          onConflict: 'id',
          ignoreDuplicates: true,
        },
      );

    if (error && import.meta.env.DEV) {
      console.error(
        '[AuthContext] ensureProfile 동기화 실패:',
        error.code ?? 'UnknownCode',
      );
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error(
        '[AuthContext] ensureProfile 네트워크 오류:',
        (err as Error)?.name ?? 'UnknownError',
      );
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then((result) => {
        if (!mounted) return;

        if (result.error && import.meta.env.DEV) {
          console.error(
            '[AuthContext] getSession 실패:',
            result.error.code ??
              result.error.name ??
              'UnknownError',
          );
        }

        const session = result?.data?.session ?? null;

        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch(() => {
        if (!mounted) return;

        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: subscription } =
      supabase.auth.onAuthStateChange(
        (event, newSession) => {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);

          if (event === 'SIGNED_IN' && newSession?.user) {
            const signedInUser = newSession.user;

            setTimeout(
              () => void ensureProfile(signedInUser),
              0,
            );
          }
        },
      );

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (params: SignUpParams): Promise<AuthResult> => {
      const { email, password, displayName } = params;

      try {
        const { data, error } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                display_name:
                  displayName || DEFAULT_DISPLAY_NAME,
              },
            },
          });

        if (error) return { error: error.message };

        return {
          error: null,
          needsEmailConfirm: !data.session,
        };
      } catch {
        return {
          error: '네트워크 연결을 확인해 주세요.',
        };
      }
    },
    [],
  );

  const signIn = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<AuthResult> => {
      try {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) return { error: error.message };

        return {
          error: null,
          needsEmailConfirm: !data.session,
        };
      } catch {
        return {
          error: '네트워크 연결을 확인해 주세요.',
        };
      }
    },
    [],
  );

  const signInWithGoogle = useCallback(
    async (returnPath: string): Promise<AuthResult> => {
      try {
        rememberReturnPath(returnPath);

        const { error } =
          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: oauthRedirectUrl(),
            },
          });

        if (error) return { error: error.message };

        return { error: null };
      } catch {
        return {
          error: '네트워크 연결을 확인해 주세요.',
        };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // local state reset
    }

    setSession(null);
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    session,
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}
