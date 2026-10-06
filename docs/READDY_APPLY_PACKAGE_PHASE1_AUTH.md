# READDY APPLY PACKAGE — PHASE 1 · Auth / OAuth / Session
작성 2026-09-11 · 브랜치 claude/readdy-a-structure-server-ui-znauoh · 기준 저장소 founder94/ECHO-MVP-

> **중요 전제.** 이 패키지는 이 세션에 존재하는 유일한 실물 소스(ECHO-MVP-, 구 ECHO MVP)의 실제 파일을 기준으로 작성·검증했다.
> Readdy 430 소스(src/doit/*, /admin/login, /admin/mobile 등)는 이 세션에 도착하지 않았다.
> Readdy 프로젝트에 적용할 때는 아래 "경로 대응표"의 오른쪽 칸을 Readdy의 실제 파일로 채워 적용한다. 함수 이름이 다르면 **역할이 같은 함수**에 같은 변경을 넣는다.

## 0. 경로 대응표 (Readdy가 채울 것)

| 이 패키지의 파일 | 역할 | Readdy 실제 파일 |
|---|---|---|
| src/lib/supabase.ts | createClient (변경 없음) | (확인) |
| src/hooks/useAuth.ts | 세션·프로필·OAuth 시작 | AuthContext / useAuth 해당 파일 |
| src/router/index.ts | 라우트 트리 + OAuth 복귀 처리 | src/router/config.tsx 또는 src/doit/routes.tsx |
| src/pages/auth/page.tsx | 로그인 화면(returnTo) | /admin/login 화면 및 일반 로그인 화면 |
| src/pages/admin/page.tsx | AdminGuard (role 판정) | /admin/mobile 가드 |
| public/_redirects | Netlify SPA 폴백 | 동일 |

## 1. 수정 파일 전체 목록
- src/hooks/useAuth.ts (전체 교체본 아래)
- src/router/index.ts (전체 교체본 아래)
- src/pages/auth/page.tsx (diff)
- src/pages/admin/page.tsx (diff)
- package.json: devDependencies에 `vitest ^3.2.7`, scripts에 `"test": "vitest run"` 추가

## 2. 신규 파일 전체 목록
- public/_redirects — 내용 한 줄: `/*    /index.html   200`
- src/hooks/useAuth.test.ts (아래)
- supabase/drafts/PENDING_대표승인_profiles_role_guard.sql (아래 · **실행 금지, 대표 승인 대기**)

## 3. 각 변경의 이유 (FILE PATH / CURRENT PROBLEM / WHY)

### src/hooks/useAuth.ts
- PROBLEM 1: `onAuthStateChange`와 `getSession()`을 동시에 호출해 첫 로그인에서 프로필을 두 번 읽고 INSERT를 두 번 시도. 두 번째 INSERT는 PK 중복으로 실패해 `profile: null`을 돌려주고, 결과 도착 순서에 따라 관리자도 비관리자로 표시될 수 있었다.
- PROBLEM 2: SELECT **오류**와 **행 없음**을 같은 분기로 처리해, 일시적 조회 실패를 "프로필 없음"으로 오인하고 INSERT까지 시도했다.
- PROBLEM 3: OAuth `redirectTo`가 항상 `window.location.origin` — Readdy 미리보기 도메인에서 로그인하면 그 도메인으로 복귀한다. 운영 도메인이 코드 어디에도 없었다.
- PROBLEM 4: `window.__BASE_PATH__`를 읽지만 이 값은 빌드 시 치환되는 전역이라 window에는 없다(항상 빈 문자열). 기본값 `'/'`를 넣으면 `//`가 생기는 잠재 버그.
- WHY: AUTH_SESSION / PROFILE_EXISTS / REDIRECT_TARGET 판정을 분리(`profileStatus` 추가). `INITIAL_SESSION` 단일 경로로 중복 제거. 조회 실패 시 INSERT 금지. 23505(동시 생성)면 재조회. `VITE_PUBLIC_SITE_URL`이 있으면 항상 운영 도메인으로 복귀. 로그인 직전 경로를 sessionStorage에 저장해 복귀 후 이동(앱 내부 경로만 허용).

### src/router/index.ts
- PROBLEM: OAuth 복귀 후 항상 `/`에 머문다. 관리자가 /admin에서 로그인하면 홈으로 떨어진다.
- WHY: `SIGNED_IN`/`INITIAL_SESSION` 시 저장된 복귀 경로가 있으면 그곳으로 `replace` 이동. 프로필 조회는 하지 않는다(세션 이벤트만).

### src/pages/auth/page.tsx
- PROBLEM: 이메일·소셜 로그인 후 무조건 `/`로 이동.
- WHY: `?returnTo=` 쿼리(앱 내부 경로만)를 받아 이메일 로그인 후 이동, 소셜 로그인 시작 시 저장.

### src/pages/admin/page.tsx
- PROBLEM: `profile.role === 'admin'`만 보고 판단해, 프로필 조회 중/실패 상태를 "권한 없음"으로 표시.
- WHY: `profileStatus === 'loading'`이면 로딩, `'error'`면 "판정 불가 · 다시 시도" 화면. 로그인 링크에 `returnTo=/admin` 부여.

### public/_redirects
- PROBLEM: Netlify에서 /admin 등 직접 진입·새로고침 시 404.
- WHY: SPA 폴백. (Readdy가 Netlify 설정을 별도로 생성한다면 중복 확인 후 하나만 유지)

## 4. 필요한 dependency
- devDependencies: `vitest@^3.2.7` (테스트 실행용, 번들에 포함되지 않음)

## 5. 환경변수 이름 (값은 넣지 않는다)
- `VITE_PUBLIC_SUPABASE_URL` (기존)
- `VITE_PUBLIC_SUPABASE_ANON_KEY` (기존)
- `VITE_PUBLIC_SITE_URL` — **신규 사용**. 운영 도메인 `https://do-it.company` 를 Netlify 환경변수에 설정해야 OAuth가 운영 도메인으로 복귀한다. 미설정이면 현재 origin 사용(기존 동작).

## 6. 라우트 변경
- 없음. 기존 라우트 유지. `/auth?mode=login&returnTo=/admin` 쿼리만 추가로 해석.

## 7. DB migration 초안
- supabase/drafts/PENDING_대표승인_profiles_role_guard.sql — role / payment_status 셀프 변경 차단 트리거. **STOP: 대표 승인 전 실행 금지.**
- 판정: `profiles` EXISTING / ALTER REQUIRED(트리거 추가) / NEW REQUIRED 없음.

## 8. Readdy가 건드리면 안 되는 파일
- 모든 화면·디자인·이미지·셰이더·모션 파일. 이 패키지는 위 5개 파일과 신규 3개 파일만 바꾼다.
- public/do-it/intro/*.png, public/do-it/landing/*.png (대표 제공 원본)

## 9. 적용 순서
1. package.json에 vitest·test 스크립트 추가 → `npm install`
2. src/hooks/useAuth.ts 교체
3. src/router/index.ts 교체 (Readdy 라우터가 다르면 "OAuth 복귀 처리" useEffect만 이식)
4. src/pages/auth/page.tsx, src/pages/admin/page.tsx diff 적용
5. public/_redirects 추가
6. Netlify 환경변수 `VITE_PUBLIC_SITE_URL=https://do-it.company` 설정 (대표)
7. 빌드 검사(아래)

## 10. 적용 후 검사 명령
```
npm ci
npm run type-check
npm run lint
npm test
npm run build
```

## 11. 예상 정상 결과
- 네 명령 모두 종료코드 0. `npm test`: 12 passed.
- 브라우저: do-it.company에서 Google 로그인 → Google → do-it.company로 복귀(미리보기 도메인 아님) → 새로고침해도 로그인 유지 → /admin 진입 시 role=admin이면 대시보드, 아니면 "권한 없음", 프로필 조회 실패면 "다시 시도".

## 12. 실패 시 rollback 대상
- 위 5개 수정 파일을 이전 커밋으로 되돌리고 public/_redirects·테스트 파일 제거. DB는 건드린 것이 없으므로 복구 불필요.

---

## 13. 최종 코드

### FILE: src/hooks/useAuth.ts (전체 교체본)
```ts
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
}```

### FILE: src/router/index.ts (전체 교체본)
```ts
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useRoutes } from "react-router-dom";
import { useEffect } from "react";
import routes from "./config";
import { supabase } from "@/lib/supabase";
import { consumeReturnPath } from "@/hooks/useAuth";

let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;

declare global {
  interface Window {
    REACT_APP_NAVIGATE: ReturnType<typeof useNavigate>;
  }
}

export const navigatePromise = new Promise<NavigateFunction>((resolve) => {
  navigateResolver = resolve;
});

export function AppRoutes() {
  const element = useRoutes(routes);
  const navigate = useNavigate();
  useEffect(() => {
    window.REACT_APP_NAVIGATE = navigate;
    navigateResolver(window.REACT_APP_NAVIGATE);
  });

  // OAuth 복귀 처리: Supabase가 URL의 코드/토큰으로 세션을 복구하면 SIGNED_IN이 온다.
  // 로그인 직전에 저장해 둔 앱 내부 경로가 있으면 그곳으로 이동한다(없으면 현재 위치 유지).
  // 프로필 조회는 하지 않는다 — 세션 이벤트만 듣는다.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      const target = consumeReturnPath();
      if (target) navigate(target, { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return element;
}
```

### FILE: src/pages/auth/page.tsx · src/pages/admin/page.tsx · (참고) src/router/index.ts — diff
```diff
diff --git a/src/pages/admin/page.tsx b/src/pages/admin/page.tsx
index 89a2614..34c9429 100644
--- a/src/pages/admin/page.tsx
+++ b/src/pages/admin/page.tsx
@@ -539,7 +539,7 @@ function SectionTimeList({ data }: { data: SectionTimeStat[] }) {
 // ═══════════════════════════════════════════════════════
 
 export default function AdminPage() {
-  const { currentUser, profile, loading: authLoading, isAuthenticated, logout } = useAuth();
+  const { currentUser, profile, profileStatus, loading: authLoading, isAuthenticated, logout } = useAuth();
   const navigate = useNavigate();
   const [activeTab, setActiveTab] = useState<'overview' | 'visitors' | 'analytics' | 'activity' | 'kpi' | 'funnel' | 'live' | 'buttons' | 'openai' | 'errors' | 'users' | 'mobile' | 'features' | 'notifications' | 'release'>('overview');
   const [period, setPeriod] = useState<Period>('today');
@@ -727,8 +727,8 @@ export default function AdminPage() {
   // AUTH GATE — Supabase Auth + Role 기반 접근 제어
   // ═══════════════════════════════════════════════════════
 
-  // Loading state
-  if (authLoading) {
+  // Loading state — AUTH_SESSION 확인 중이거나 PROFILE_EXISTS 판정 중이면 아직 권한을 판단하지 않는다
+  if (authLoading || (isAuthenticated && profileStatus === 'loading')) {
     return (
       <div className="relative w-full min-h-screen flex items-center justify-center overflow-hidden" style={{ background: C.black }}>
         <div className="absolute inset-0 pointer-events-none" style={{
@@ -764,7 +764,7 @@ export default function AdminPage() {
             <i className="ri-shield-check-line text-3xl mb-3 block" style={{ color: C.gold }} />
             <p className="text-sm text-white/40 mb-4">관리자 페이지입니다.<br />로그인이 필요합니다.</p>
             <Link
-              to="/auth"
+              to="/auth?mode=login&returnTo=/admin"
               className="inline-block w-full rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer active:scale-95"
               style={{ background: C.gold, color: C.black, WebkitTapHighlightColor: 'transparent' }}
             >
@@ -779,6 +779,32 @@ export default function AdminPage() {
     );
   }
 
+  // 프로필 조회 자체가 실패한 경우 — "권한 없음"이 아니라 "판정 불가"로 표시한다
+  if (isAuthenticated && profileStatus === 'error') {
+    return (
+      <div className="relative w-full min-h-screen flex items-center justify-center overflow-hidden" style={{ background: C.black }}>
+        <div className="relative z-10 w-full max-w-sm mx-auto px-6 text-center">
+          <span className="text-[10px] font-mono tracking-[0.4em] uppercase text-white/10">Admin Console</span>
+          <h1 className="font-display font-bold text-2xl text-white mt-3 mb-1" style={{ fontFamily: 'var(--font-heading, sans-serif)' }}>
+            ECHO ADMIN
+          </h1>
+          <div className="rounded-2xl border p-6 mb-6 mt-8" style={{ borderColor: `${C.danger}30`, background: `${C.blackCard}80` }}>
+            <i className="ri-error-warning-line text-3xl mb-3 block" style={{ color: C.danger }} />
+            <p className="text-sm text-white/40 mb-4">프로필 정보를 불러오지 못했습니다.<br />네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>
+            <button
+              type="button"
+              onClick={() => window.location.reload()}
+              className="inline-block w-full rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer active:scale-95"
+              style={{ background: C.gold, color: C.black, WebkitTapHighlightColor: 'transparent' }}
+            >
+              다시 시도
+            </button>
+          </div>
+        </div>
+      </div>
+    );
+  }
+
   // Authenticated but not admin
   if (!isAdmin) {
     return (
diff --git a/src/pages/auth/page.tsx b/src/pages/auth/page.tsx
index d79fe3d..fdb39bc 100644
--- a/src/pages/auth/page.tsx
+++ b/src/pages/auth/page.tsx
@@ -49,6 +49,9 @@ export default function AuthPage() {
   const { signup, login, socialLogin } = useAuth();
 
   const [authMode, setAuthMode] = useState<AuthMode>(searchParams.get('mode') === 'login' ? 'login' : 'signup');
+  // 로그인 후 복귀 경로 — 앱 내부 경로만 허용 (외부 URL 오픈 리다이렉트 차단)
+  const rawReturnTo = searchParams.get('returnTo');
+  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/';
   const [signupStep, setSignupStep] = useState<SignupStep>('entry');
   const [canvasPhase, setCanvasPhase] = useState<CanvasPhase>('entry');
   const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
@@ -300,7 +303,7 @@ export default function AuthPage() {
 
     setLoginStatus('success');
     setTimeout(() => {
-      navigate('/');
+      navigate(returnTo, { replace: true });
     }, 1000);
   };
 
@@ -322,7 +325,7 @@ export default function AuthPage() {
     }
 
     setSocialLoading(provider);
-    const result = await socialLogin(providerKey);
+    const result = await socialLogin(providerKey, returnTo);
 
     if (result.success && result.url) {
       window.location.href = result.url;
diff --git a/src/router/index.ts b/src/router/index.ts
index 3233caa..b8fee63 100644
--- a/src/router/index.ts
+++ b/src/router/index.ts
@@ -2,6 +2,8 @@ import { useNavigate, type NavigateFunction } from "react-router-dom";
 import { useRoutes } from "react-router-dom";
 import { useEffect } from "react";
 import routes from "./config";
+import { supabase } from "@/lib/supabase";
+import { consumeReturnPath } from "@/hooks/useAuth";
 
 let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;
 
@@ -22,5 +24,19 @@ export function AppRoutes() {
     window.REACT_APP_NAVIGATE = navigate;
     navigateResolver(window.REACT_APP_NAVIGATE);
   });
+
+  // OAuth 복귀 처리: Supabase가 URL의 코드/토큰으로 세션을 복구하면 SIGNED_IN이 온다.
+  // 로그인 직전에 저장해 둔 앱 내부 경로가 있으면 그곳으로 이동한다(없으면 현재 위치 유지).
+  // 프로필 조회는 하지 않는다 — 세션 이벤트만 듣는다.
+  useEffect(() => {
+    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
+      if (!session) return;
+      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
+      const target = consumeReturnPath();
+      if (target) navigate(target, { replace: true });
+    });
+    return () => subscription.unsubscribe();
+  }, [navigate]);
+
   return element;
 }
```

### NEW FILE: public/_redirects
```
/*    /index.html   200
```

### NEW FILE: src/hooks/useAuth.test.ts
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@supabase/supabase-js';

// ── supabase 클라이언트 모의 (네트워크 없음) ──
type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
const selectQueue: QueryResult[] = [];
const insertQueue: QueryResult[] = [];
const calls = { select: 0, insert: 0 };

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls.select += 1;
            return selectQueue.shift() ?? { data: null, error: { message: 'queue empty' } };
          },
        }),
      }),
      insert: async () => {
        calls.insert += 1;
        return insertQueue.shift() ?? { data: null, error: { message: 'queue empty' } };
      },
    }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}));
vi.mock('@/hooks/useAnalytics', () => ({
  recordAuthEvent: () => {},
  linkVisitorToUser: () => {},
  getVisitorId: () => null,
}));

const { loadUserProfile, buildOAuthRedirectUrl, rememberReturnPath, consumeReturnPath } = await import('./useAuth');

const user = { id: 'u-1', email: 'a@b.c', user_metadata: { full_name: '홍길동' } } as unknown as User;
const row = { id: 'u-1', email: 'a@b.c', name: '홍길동', age_group: null, onboarding_answers: [], role: 'admin', payment_status: 'paid' };

beforeEach(() => {
  selectQueue.length = 0;
  insertQueue.length = 0;
  calls.select = 0;
  calls.insert = 0;
});

describe('PROFILE_EXISTS 판정 (loadUserProfile)', () => {
  it('행이 있으면 exists — INSERT 하지 않는다', async () => {
    selectQueue.push({ data: row, error: null });
    const r = await loadUserProfile(user);
    expect(r.status).toBe('exists');
    expect(r.profile?.role).toBe('admin');
    expect(calls.insert).toBe(0);
  });

  it('조회가 실패하면 error — 행 없음으로 오인하지 않고 INSERT도 하지 않는다', async () => {
    selectQueue.push({ data: null, error: { message: 'network' } });
    const r = await loadUserProfile(user);
    expect(r.status).toBe('error');
    expect(r.profile).toBeNull();
    expect(calls.insert).toBe(0);
  });

  it('행이 없으면 INSERT 후 created (role은 null — 프론트가 admin을 만들지 않는다)', async () => {
    selectQueue.push({ data: null, error: null });
    insertQueue.push({ data: null, error: null });
    const r = await loadUserProfile(user);
    expect(r.status).toBe('created');
    expect(r.profile?.role).toBeNull();
    expect(calls.insert).toBe(1);
  });

  it('동시 생성으로 23505가 나면 다시 읽어 exists로 수렴한다', async () => {
    selectQueue.push({ data: null, error: null });
    insertQueue.push({ data: null, error: { code: '23505', message: 'duplicate key' } });
    selectQueue.push({ data: row, error: null });
    const r = await loadUserProfile(user);
    expect(r.status).toBe('exists');
    expect(r.profile?.role).toBe('admin');
    expect(calls.select).toBe(2);
  });

  it('INSERT가 다른 이유로 실패하면 missing (기존 데이터 덮어쓰기 없음)', async () => {
    selectQueue.push({ data: null, error: null });
    insertQueue.push({ data: null, error: { code: '42501', message: 'rls' } });
    const r = await loadUserProfile(user);
    expect(r.status).toBe('missing');
    expect(r.profile).toBeNull();
  });
});

describe('REDIRECT_TARGET 판정 (buildOAuthRedirectUrl)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://ixxrjb.readdy.co' } });
    vi.stubGlobal('__BASE_PATH__', '/');
  });

  it('VITE_PUBLIC_SITE_URL이 있으면 현재 origin(미리보기 도메인)이 아니라 운영 도메인으로 복귀한다', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://do-it.company/');
    expect(buildOAuthRedirectUrl()).toBe('https://do-it.company/');
  });

  it('VITE_PUBLIC_SITE_URL이 없으면 현재 origin으로 복귀한다 (미리보기 도메인 잔류 원인)', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', '');
    expect(buildOAuthRedirectUrl()).toBe('https://ixxrjb.readdy.co/');
  });

  it('http(s)가 아닌 값은 무시한다', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'do-it.company');
    expect(buildOAuthRedirectUrl()).toBe('https://ixxrjb.readdy.co/');
  });

  it('하위 경로 배포(__BASE_PATH__=/app/)면 접두사를 붙인다', () => {
    vi.stubGlobal('__BASE_PATH__', '/app/');
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://do-it.company');
    expect(buildOAuthRedirectUrl()).toBe('https://do-it.company/app/');
  });
});

describe('복귀 경로 (rememberReturnPath / consumeReturnPath)', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it('앱 내부 경로는 한 번만 꺼내진다', () => {
    rememberReturnPath('/admin');
    expect(consumeReturnPath()).toBe('/admin');
    expect(consumeReturnPath()).toBeNull();
  });

  it('외부 URL·프로토콜 상대 경로는 저장하지 않는다 (오픈 리다이렉트 차단)', () => {
    rememberReturnPath('https://evil.example');
    expect(consumeReturnPath()).toBeNull();
    rememberReturnPath('//evil.example');
    expect(consumeReturnPath()).toBeNull();
  });

  it('/auth 로 되돌아가는 경로는 무시한다 (로그인 루프 방지)', () => {
    rememberReturnPath('/auth?mode=login');
    expect(consumeReturnPath()).toBeNull();
  });
});
```

### NEW FILE (STOP · 실행 금지): supabase/drafts/PENDING_대표승인_profiles_role_guard.sql
```sql
-- ============================================================
-- PENDING · 대표 승인 전 실행 금지
-- profiles.role / payment_status 셀프 변경 차단 (권한 상승 방지)
-- 작성: 2026-09-11 · PHASE 1 Auth 실측 중 발견
-- ============================================================
-- [문제]
--   현재 RLS "profiles_update_own"은 본인 행 UPDATE를 컬럼 제한 없이 허용한다.
--   따라서 브라우저 anon key만으로 아래가 통한다:
--     supabase.from('profiles').update({ role: 'admin' }).eq('id', <내 id>)
--   관리자 화면 가드(profile.role === 'admin')와 is_echo_admin()이 모두 이 컬럼을 믿으므로
--   일반 사용자가 스스로 관리자가 될 수 있다. payment_status도 같은 경로로 'paid' 셀프 변경 가능.
--
-- [적용 원문]
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role(서버 함수·콘솔)은 제한하지 않는다. 브라우저(authenticated/anon)만 차단.
  IF current_setting('request.jwt.claim.role', true) IN ('authenticated', 'anon') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'role 컬럼은 클라이언트에서 변경할 수 없습니다' USING ERRCODE = '42501';
    END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'payment_status 컬럼은 클라이언트에서 변경할 수 없습니다' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_privileged_columns();

-- INSERT 시에도 role/payment_status는 기본값만 허용 (신규 가입자가 처음부터 admin으로 들어오는 것 차단)
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IN ('authenticated', 'anon') THEN
    NEW.role := 'user';
    NEW.payment_status := 'free';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_insert ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_privileged_insert();

-- [영향]
--   - 일반 사용자: 이름·연령대·온보딩 답변 등 다른 컬럼 수정은 그대로 가능. role/payment_status만 변경 불가.
--   - 관리자 지정: 대표가 Supabase SQL Editor(service_role)에서 UPDATE 하거나 서버 함수로만 가능.
--   - 결제 상태 변경: Toss 승인 서버 함수(service_role)만 가능 → 이미 그 구조라면 영향 없음.
--   - Readdy 소스에 is_admin / verification_status 컬럼이 실재하면 같은 방식으로 IF 절을 추가해야 한다(소스 확인 후 보강).
--
-- [검증 SQL — 적용 후 일반 사용자 토큰으로]
--   update profiles set role = 'admin' where id = auth.uid();   -- 기대: 42501 오류
--   update profiles set name = '테스트' where id = auth.uid();  -- 기대: 성공
--
-- [복구 — 아래 4줄의 주석을 풀어 별도로 실행]
-- DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_columns ON public.profiles;
-- DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_insert ON public.profiles;
-- DROP FUNCTION IF EXISTS public.profiles_guard_privileged_columns();
-- DROP FUNCTION IF EXISTS public.profiles_guard_privileged_insert();
```
