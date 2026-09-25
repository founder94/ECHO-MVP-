import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { rememberReturnPath } from '@/lib/auth/returnPath';
import {
  CONSENT_VERSION,
  consentMetadata,
  consumePendingConsent,
  fetchConsentStatus,
  persistConsent,
  readConsentMetadata,
  type ConsentChoice,
  type ConsentStatus,
} from '@/lib/legal/consent';

export interface SignUpParams {
  email: string;
  password: string;
  displayName: string;
  // 가입 화면에서 받은 약관 동의. 세션이 생기기 전이라 인증 메타데이터에 실어 보내고, 첫 로그인 때 profiles 로 옮긴다.
  consent?: ConsentChoice;
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
  // 현재 버전 약관 동의가 서버(profiles.consent_version)에 있는지. 'unknown' = 미로그인 또는 조회 실패(막지 않음).
  consentStatus: ConsentStatus;
  markConsented: () => void;
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
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : DEFAULT_DISPLAY_NAME;
}

// 프로필 보장: 인증이 "완료된 세션"이 있을 때만, 본인 행(id = auth.uid())만, 이미 있으면 건드리지 않는다.
// 정식 경로는 DB 트리거(supabase/drafts/PENDING_20260904_echo_hardening.sql)이며, 트리거 적용 후 이 호출은
// 항상 "이미 있음"으로 끝나는 무해한 보조 장치다. 실패해도 로그인 흐름을 막지 않는다.
// upsert는 실패해도 예외를 던지지 않고 결과의 error로 알려주므로 error를 직접 확인한다.
async function ensureProfile(user: User): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, email: user.email ?? null, display_name: displayNameOf(user) },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    if (error && import.meta.env.DEV) {
      // 프로필 동기화 실패로 구분(로그인 세션은 유지). 개인정보·토큰 없이 오류 코드만 남긴다.
      console.error('[AuthContext] ensureProfile 동기화 실패:', error.code ?? 'UnknownCode');
    }
  } catch (err) {
    // 예상하지 못한 네트워크 예외는 별도로 처리. 개인정보 없이 실패 위치·종류만 남긴다.
    if (import.meta.env.DEV) {
      console.error('[AuthContext] ensureProfile 네트워크 오류:', (err as Error)?.name ?? 'UnknownError');
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('unknown');

  // 세션 복원. onAuthStateChange 콜백은 동기로 처리해야 하므로 비동기 데이터 로딩은
  // 여기서 하지 않고, getSession 결과만으로 즉시 loading을 해제한다.
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then((result) => {
        if (!mounted) return;
        // 세션 조회 오류를 무조건 "사용자 없음"으로 바꾸지 않는다. 개인정보 없이 오류 코드만 남긴다.
        if (result.error && import.meta.env.DEV) {
          console.error('[AuthContext] getSession 실패:', result.error.code ?? result.error.name ?? 'UnknownError');
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

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      // 인증 완료 뒤에만 프로필을 보장한다(세션 없는 가입 직후에는 실행되지 않음). 콜백을 막지 않도록 비동기로 넘긴다.
      if (event === 'SIGNED_IN' && newSession?.user) {
        const signedInUser = newSession.user;
        setTimeout(() => void ensureProfile(signedInUser), 0);
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  // 약관 동의 상태 동기화(로그인 사용자 기준).
  // 1) 서버 profiles.consent_version 이 현재 버전이면 ok.
  // 2) 아니면 가입 때 메타데이터(또는 Google 이동 전 임시값)에 남긴 동의를 서버로 옮기고 ok.
  // 3) 둘 다 없으면 required → ConsentGate 가 동의 화면으로 보낸다. 조회 실패는 unknown(막지 않음).
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      setConsentStatus('unknown');
      return;
    }
    let cancelled = false;
    (async () => {
      let status = await fetchConsentStatus(supabase, userId);
      if (status === 'required') {
        const fromMeta = readConsentMetadata(user?.user_metadata);
        const pending = consumePendingConsent() ?? (fromMeta?.consent_version === CONSENT_VERSION ? fromMeta : null);
        if (pending && !(await persistConsent(supabase, userId, pending))) status = 'ok';
      }
      if (!cancelled) setConsentStatus(status);
    })().catch(() => {
      if (!cancelled) setConsentStatus('unknown');
    });
    return () => {
      cancelled = true;
    };
    // user 객체는 메타데이터 갱신마다 바뀌므로 id 로만 다시 실행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const markConsented = useCallback(() => setConsentStatus('ok'), []);

  const signUp = useCallback(async (params: SignUpParams): Promise<AuthResult> => {
    const { email, password, displayName, consent } = params;
    try {
      // 프로필은 브라우저가 세션 전에 직접 쓰지 않는다. 이름은 메타데이터로 넘겨 인증 완료 뒤(트리거·ensureProfile) 만든다.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || DEFAULT_DISPLAY_NAME,
            ...(consent ? consentMetadata(consent) : {}),
          },
        },
      });
      if (error) return { error: error.message };
      // 이메일 확인이 켜져 있으면 세션이 즉시 생성되지 않을 수 있다.
      return { error: null, needsEmailConfirm: !data.session };
    } catch {
      return { error: '네트워크 연결을 확인해 주세요.' };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null, needsEmailConfirm: !data.session };
    } catch {
      return { error: '네트워크 연결을 확인해 주세요.' };
    }
  }, []);

  // Google 로그인: 실제 앱 호출. 제공자(Provider) 설정이 없으면 Supabase가 오류를 돌려주며, 가짜 성공을 만들지 않는다.
  const signInWithGoogle = useCallback(async (returnPath: string): Promise<AuthResult> => {
    try {
      rememberReturnPath(returnPath);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: oauthRedirectUrl() },
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch {
      return { error: '네트워크 연결을 확인해 주세요.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // 세션 해제 실패해도 로컬 상태는 초기화해 앱이 멈추지 않게 한다.
    }
    setSession(null);
    setUser(null);
  }, []);

  const value: AuthContextValue = { session, user, loading, signUp, signIn, signInWithGoogle, signOut, consentStatus, markConsented };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- 훅과 Provider를 한 파일에 두는 기존 구조 유지
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}