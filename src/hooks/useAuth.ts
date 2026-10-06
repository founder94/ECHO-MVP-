import { useState, useCallback, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { recordAuthEvent, linkVisitorToUser, getVisitorId } from '@/hooks/useAnalytics';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  age_group: string | null;
  onboarding_answers: unknown;
  role: string | null;
  payment_status: string | null;
}

/**
 * PROFILE_EXISTS 판정. AUTH_SESSION(세션 유무)과 분리해 둔다.
 * - 'exists'  : profiles 행을 읽었다
 * - 'created' : 행이 없어 방금 만들었다
 * - 'missing' : 행이 없고 생성도 실패했다
 * - 'error'   : 조회 자체가 실패했다 (행이 없다는 뜻이 아님 — 덮어쓰기 금지)
 */
type ProfileStatus = 'idle' | 'loading' | 'exists' | 'created' | 'missing' | 'error';

interface AuthState {
  currentUser: User | null;
  profile: Profile | null;
  profileStatus: ProfileStatus;
  loading: boolean;
  isAuthenticated: boolean;
  hasPaid: boolean;
}

type AuthProviderType = 'google' | 'apple' | 'kakao';

const PG_UNIQUE_VIOLATION = '23505';

function displayNameOf(user: User): string {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    ''
  );
}

function buildDefaultProfile(user: User, name: string): Profile {
  return {
    id: user.id,
    email: user.email || '',
    name,
    age_group: null,
    onboarding_answers: [],
    role: null,
    payment_status: null,
  };
}

interface ProfileLoadResult {
  profile: Profile | null;
  status: Exclude<ProfileStatus, 'idle' | 'loading'>;
}

async function selectProfile(userId: string): Promise<{ profile: Profile | null; failed: boolean }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { profile: null, failed: true };
  return { profile: (data as Profile | null) ?? null, failed: false };
}

/**
 * 조회 실패(error)와 행 없음(missing)을 구분한다.
 * 조회가 실패했을 때는 INSERT를 시도하지 않는다 — 기존 행이 있을 수 있고,
 * 실패를 "행 없음"으로 오인하면 관리자도 비관리자로 표시된다.
 */
export async function loadUserProfile(user: User): Promise<ProfileLoadResult> {
  try {
    const first = await selectProfile(user.id);
    if (first.failed) return { profile: null, status: 'error' };
    if (first.profile) return { profile: first.profile, status: 'exists' };

    const name = displayNameOf(user);
    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email || '',
      name,
      age_group: null,
      onboarding_answers: [],
    });

    if (!insertError) {
      return { profile: buildDefaultProfile(user, name), status: 'created' };
    }

    // 동시에 두 번 생성을 시도한 경우(onAuthStateChange가 연달아 오는 첫 로그인 등):
    // 이미 다른 호출이 만들었으므로 다시 읽는다.
    if (insertError.code === PG_UNIQUE_VIOLATION) {
      const again = await selectProfile(user.id);
      if (again.profile) return { profile: again.profile, status: 'exists' };
      return { profile: null, status: again.failed ? 'error' : 'missing' };
    }

    return { profile: null, status: 'missing' };
  } catch {
    return { profile: null, status: 'error' };
  }
}

/** OAuth 복귀 후 돌아갈 앱 내부 경로 저장 키 (sessionStorage — 탭 단위, 자동 소멸) */
const RETURN_PATH_KEY = 'doit.auth.returnTo';

/** 빌드 시 치환되는 __BASE_PATH__('/', '/sub/' 등)를 경로 접두사로 정규화. 루트('/')면 빈 문자열. */
function basePathPrefix(): string {
  const raw = typeof __BASE_PATH__ !== 'undefined' ? __BASE_PATH__ : '';
  const segments = raw.split('/').filter(Boolean);
  return segments.length ? `/${segments.join('/')}` : '';
}

/**
 * REDIRECT_TARGET 판정.
 * 운영 도메인(VITE_PUBLIC_SITE_URL)이 설정돼 있으면 항상 그 주소로 복귀한다.
 * 미설정이면 현재 origin — 이 경우 Readdy 미리보기 도메인에서 로그인하면 그 도메인으로 돌아간다.
 * Supabase 콘솔 Redirect URLs 허용 목록에 없는 주소는 Site URL로 대체되므로 콘솔 값과 반드시 일치해야 한다.
 */
export function buildOAuthRedirectUrl(): string {
  const configured = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim().replace(/\/+$/, '');
  const origin = configured && /^https?:\/\//.test(configured) ? configured : window.location.origin;
  return `${origin}${basePathPrefix()}/`;
}

export function rememberReturnPath(path: string): void {
  try {
    // 앱 내부 경로만 허용 (외부 URL·프로토콜 상대 경로 차단)
    if (path.startsWith('/') && !path.startsWith('//')) sessionStorage.setItem(RETURN_PATH_KEY, path);
  } catch {
    // sessionStorage 사용 불가 환경(프라이빗 모드 등)은 무시 — 루트로 복귀
  }
}

/** OAuth 복귀 직후 한 번만 꺼내 쓴다. 없으면 null. */
export function consumeReturnPath(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_PATH_KEY);
    if (v) sessionStorage.removeItem(RETURN_PATH_KEY);
    return v && v !== '/auth' && !v.startsWith('/auth?') ? v : null;
  } catch {
    return null;
  }
}

const SIGNED_OUT_STATE: AuthState = {
  currentUser: null,
  profile: null,
  profileStatus: 'idle',
  loading: false,
  isAuthenticated: false,
  hasPaid: false,
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    currentUser: null,
    profile: null,
    profileStatus: 'idle',
    loading: true,
    isAuthenticated: false,
    hasPaid: false,
  });
  const mountedRef = useRef(true);

  // 마지막으로 프로필을 요청한 사용자. 늦게 도착한 이전 사용자 결과를 버리기 위한 기준.
  const profileForUserRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    const applyUser = (user: User | null, reloadProfile: boolean) => {
      if (!mountedRef.current) return;

      if (!user) {
        profileForUserRef.current = null;
        setState(SIGNED_OUT_STATE);
        return;
      }

      // AUTH_SESSION은 즉시 확정한다. PROFILE_EXISTS는 별도로 판정한다.
      setState((prev) => ({
        ...prev,
        currentUser: user,
        loading: false,
        isAuthenticated: true,
        profileStatus: reloadProfile ? 'loading' : prev.profileStatus,
      }));

      if (!reloadProfile) return;

      profileForUserRef.current = user.id;
      void loadUserProfile(user).then(({ profile, status }) => {
        if (!mountedRef.current) return;
        if (profileForUserRef.current !== user.id) return; // 그 사이 사용자가 바뀜
        setState((prev) => ({
          ...prev,
          profile,
          profileStatus: status,
          hasPaid: profile?.payment_status === 'paid',
        }));
      });
    };

    // supabase-js v2는 구독 직후 INITIAL_SESSION을 보내므로 getSession()을 따로 부르지 않는다.
    // (두 경로가 동시에 프로필을 읽고 INSERT까지 두 번 시도하던 원인 제거)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      switch (event) {
        case 'INITIAL_SESSION':
        case 'SIGNED_IN':
        case 'USER_UPDATED':
          applyUser(user, true);
          break;
        case 'SIGNED_OUT':
          applyUser(null, false);
          break;
        case 'TOKEN_REFRESHED':
          // 토큰 갱신은 세션만 유지. 프로필은 사용자가 바뀐 경우에만 다시 읽는다.
          applyUser(user, user?.id !== profileForUserRef.current);
          break;
        default:
          applyUser(user, user?.id !== profileForUserRef.current);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string, ageGroup?: string, answers?: number[]) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          return { success: false, error: '이미 등록된 이메일입니다' };
        }
        return { success: false, error: error.message };
      }

      const user = data.user;
      if (user) {
        const visitorId = getVisitorId();
        if (visitorId) linkVisitorToUser(visitorId, user.id);
        recordAuthEvent('이메일 회원가입', 'auth_signup', user.id);

        const { error: profileError } = await supabase.from('profiles').insert({
          id: user.id,
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          age_group: ageGroup || null,
          onboarding_answers: answers || [],
        });

        if (profileError) {
          console.error('프로필 생성 실패:', profileError.message);
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '회원가입 중 오류가 발생했습니다' };
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          return { success: false, error: '이메일 인증이 완료되지 않았습니다. 이메일을 확인해 주세요.' };
        }
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다.' };
        }
        return { success: false, error: '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
      }

      const user = data.user;
      if (user) {
        const visitorId = getVisitorId();
        if (visitorId) linkVisitorToUser(visitorId, user.id);
        recordAuthEvent('이메일 로그인', 'auth_login', user.id);

        // 세션 확정은 onAuthStateChange(SIGNED_IN)가 담당한다. 여기서는 중복 조회하지 않는다.
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '로그인 중 오류가 발생했습니다' };
    }
  }, []);

  const socialLogin = useCallback(async (provider: AuthProviderType, returnTo?: string) => {
    const redirectTo = buildOAuthRedirectUrl();
    rememberReturnPath(returnTo ?? `${window.location.pathname}${window.location.search}`);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, url: data.url };
    } catch (err: any) {
      return { success: false, error: err.message || '소셜 로그인 중 오류가 발생했습니다' };
    }
  }, []);

  const logout = useCallback(async (userId?: string) => {
    try {
      if (userId) recordAuthEvent('로그아웃', 'auth_logout', userId);
      await supabase.auth.signOut();
    } catch {
      // 세션 종료는 UI에서 처리
    }
  }, []);

  return {
    currentUser: state.currentUser,
    profile: state.profile,
    profileStatus: state.profileStatus,
    loading: state.loading,
    isAuthenticated: state.isAuthenticated,
    hasPaid: state.hasPaid,
    signup,
    login,
    socialLogin,
    logout,
  };
}