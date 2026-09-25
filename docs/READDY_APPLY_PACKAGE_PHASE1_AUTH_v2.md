# READDY APPLY PACKAGE — PHASE 1 · Auth / OAuth / Session (v2 · Readdy 실소스 기준)
작성 2026-09-11 · 근거: 대표가 채팅으로 전달한 Readdy 원문 5개 + 구조 요약 10개 · 이전 ECHO-MVP- 패키지(v1)는 참고본으로 격하

## 0. 판정 요약
| 항목 | 판정 |
|---|---|
| 두 Provider 관계 | **KEEP** (책임 분리 조건부) |
| src/lib/supabase/client.ts custom lock | **불일치 → 수정 (P1)** |
| src/context/AuthContext.tsx | 일치 (수정 없음) |
| src/pages/auth/callback/page.tsx | 경미한 불일치 → 최소 수정 |
| src/pages/admin/login/page.tsx | 경미한 불일치 → 최소 수정 |
| src/doit/hooks/useAuth.tsx anon_session_id | 순서 문제 가능 → ADAPT (원문 확인 후 적용) |
| src/lib/auth/returnPath.ts DEFAULT_RETURN_PATH | CONFIRM REQUIRED (값이 /weather 면 수정) |
| profiles RLS role 셀프 변경 | CONFIRM REQUIRED (pg_policies 결과 대기) |
| Supabase Console Site URL / Redirect URLs | NOT VERIFIED |

## 1. 수정 파일 (확정)
1. src/lib/supabase/client.ts — custom `lock` 제거 (전체 교체본 아래)
2. src/pages/auth/callback/page.tsx — 시간 초과 후 늦은 세션 복구 허용 (전체 교체본 아래)
3. src/pages/admin/login/page.tsx — role 조회 실패·비관리자 안내, unhandled rejection 제거 (전체 교체본 아래)

## 2. 조건부 수정 (원문 확인 후 적용 · 아래 PATCH 지침)
4. src/doit/hooks/useAuth.tsx — anon_session_id update 가 0건일 때 1회 재시도
5. src/lib/auth/returnPath.ts — DEFAULT_RETURN_PATH 가 '/weather' 이면 '/' 로
6. src/doit/lib/supabase.ts — getSupabase() 가 createClient 를 따로 호출하면 공용 client 재사용으로

## 3. 신규 파일
- supabase/drafts/PENDING_대표승인_readdy_profiles_role_guard_v2.sql (STOP · 실행 금지)
- (선택) readdy-review/phase1-auth/lock.test.ts — 잠금 계약 회귀 테스트. Readdy 프로젝트에 test 스크립트가 없으므로 넣지 않아도 된다.

## 4. 삭제 파일
- 없음

## 5. 각 파일 최종 코드

### FILE: src/lib/supabase/client.ts (전체 교체)
PROBLEM: custom acquireLock 이 (a) 항상 `ifAvailable: true` 로 요청해 다른 탭이 잠금을 쥐고 있어도 잠금 없이 실행하고, (b) supabase 가 넘기는 `acquireTimeout = -1`(무한 대기 의미)을 `setTimeout(-1)` 로 처리해 즉시 거부한 뒤 `catch { return fn() }` 로 **fn 을 두 번 실행**한다. auth-js 2.71.1 은 getSession·initialize·signOut·exchangeCode 등 거의 모든 작업에 -1 을 넘긴다(GoTrueClient.js `_acquireLock(-1, …)` 15곳, autoRefresh tick 만 0).
WHY: 잠금 옵션을 제거하면 supabase 가 브라우저에서 navigatorLock(계약 준수), 미지원 환경에서 no-op 을 자동 선택한다. 검증: readdy-review/phase1-auth/lock.test.ts 6건 PASS.
```ts
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
```

### FILE: src/pages/auth/callback/page.tsx (전체 교체)
PROBLEM: 8초 시간 초과 시 `handledRef = true` 로 처리를 종료해, 그 뒤 세션이 복구돼도(느린 코드 교환) 사용자는 "실패" 화면에 남는다. 실제로는 로그인된 상태.
WHY: 시간 초과는 화면 표시만 바꾸고 handledRef 는 세우지 않는다. 늦게 user 가 도착하면 기존 effect 가 정상 복귀시킨다. SESSION_WAIT_MS=8000 은 유지(변경 근거 없음).
```tsx
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { consumeReturnPath } from '@/lib/auth/returnPath';

type Phase = 'waiting' | 'failed';

const SESSION_WAIT_MS = 8000;

function oauthErrorFromUrl(): string | null {
  try {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, ''),
    );

    const code =
      search.get('error') ??
      hash.get('error');

    if (!code) return null;

    if (code === 'access_denied') {
      return '로그인을 취소했어요.';
    }

    return '로그인을 완료하지 못했어요. 다시 시도해 주세요.';
  } catch {
    return null;
  }
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [phase, setPhase] =
    useState<Phase>('waiting');

  const [message, setMessage] =
    useState('');

  const handledRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (handledRef.current) return;

      // 시간 초과는 "실패 화면 표시"일 뿐 처리 종료가 아니다.
      // handledRef를 세우지 않아, 늦게 세션이 복구되면 아래 effect가 정상 복귀시킨다.
      setPhase('failed');
      setMessage(
        '로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.',
      );
    }, SESSION_WAIT_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (handledRef.current) return;

    const urlError = oauthErrorFromUrl();

    if (urlError) {
      handledRef.current = true;
      setPhase('failed');
      setMessage(urlError);
      return;
    }

    if (loading) return;

    if (user) {
      handledRef.current = true;

      navigate(
        consumeReturnPath(),
        { replace: true },
      );
    }
  }, [
    user,
    loading,
    navigate,
  ]);

  return (
    <div className="min-h-screen bg-background-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {phase === 'waiting' ? (
          <>
            <span className="inline-block w-8 h-8 border-2 border-foreground-700 border-t-foreground-50 rounded-full animate-spin mb-4" />

            <p className="text-sm text-foreground-400">
              로그인 상태를 확인하고 있어요...
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground-300 mb-6">
              {message}
            </p>

            <Link
              to="/login"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors duration-300 whitespace-nowrap"
            >
              로그인 화면으로
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
```

### FILE: src/pages/admin/login/page.tsx (전체 교체)
PROBLEM: `.maybeSingle().then(({ data }) => …)` 에 오류 처리가 없어 네트워크 실패 시 unhandled rejection. 비관리자 계정은 아무 안내 없이 로그인 화면에 머문다(버튼을 눌러도 같은 자리).
WHY: admin / 비관리자 / 조회 실패 세 갈래를 구분해 안내. 라우트·UI 구조는 그대로.
```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const navigate = useNavigate();

  const {
    signInWithGoogle,
    user,
    loading,
  } = useAuth();

  const [signingIn, setSigningIn] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    if (loading || !user) return;

    let active = true;

    // 이미 로그인된 사용자: role 조회 결과를 세 갈래로 나눈다.
    // admin → 운영센터 이동 / 비관리자 → 안내 / 조회 실패 → 안내 (권한 없음과 구분)
    // 이전 코드는 조회 실패 시 unhandled rejection, 비관리자는 아무 표시 없이 대기했다.
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          setError('권한을 확인하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.');
          return;
        }

        if (data?.role === 'admin') {
          navigate('/admin/mobile', { replace: true });
          return;
        }

        setError('관리자 권한이 없는 계정이에요. 관리자 계정으로 다시 로그인해 주세요.');
      } catch {
        if (active) {
          setError('권한을 확인하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    loading,
    user,
    navigate,
  ]);

  const handleGoogle = async () => {
    if (signingIn) return;

    setSigningIn(true);
    setError('');

    try {
      const result =
        await signInWithGoogle('/admin/mobile');

      if (result.error) {
        setError(result.error);
      }
    } catch {
      setError(
        '네트워크 연결을 확인해 주세요.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="light flex min-h-dvh items-center justify-center bg-background-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-background-200 bg-background-50 p-6">
          <div className="flex items-center gap-2 text-foreground-950">
            <i className="ri-shield-line text-xl text-primary-600" />
            <h1 className="text-lg font-semibold">
              관리자 로그인
            </h1>
          </div>

          <p className="mt-2 text-sm text-foreground-600">
            ECHO · DO IT 운영센터에 접근하려면 관리자 계정으로 로그인해 주세요.
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={signingIn}
            className="mt-5 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-60"
          >
            {signingIn ? (
              <i className="ri-loader-4-line animate-spin" />
            ) : (
              <i className="ri-google-fill" />
            )}

            {signingIn
              ? '로그인 진행 중...'
              : 'Google로 관리자 로그인'}
          </button>

          {error && (
            <p className="mt-3 rounded-md bg-primary-100 px-3 py-2 text-xs leading-relaxed text-primary-900">
              {error}
            </p>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-foreground-500 transition hover:text-foreground-700"
          >
            <i className="ri-arrow-left-line" />
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### PATCH: src/doit/hooks/useAuth.tsx (원문 미수령 · 해당 블록만 교체)
PROBLEM: SIGNED_IN 시 메인 AuthContext 의 `ensureProfile`(setTimeout 0 으로 지연)과 DO IT 의 `profiles.update({ anon_session_id })` 가 같은 이벤트에서 출발한다. 첫 로그인 사용자는 행이 아직 없어 update 가 **0건으로 조용히 끝나고** anon_session_id 연결이 영구 누락될 수 있다.
WHY: `.select('id')` 로 갱신 건수를 확인하고 0건이면 짧게 기다렸다가 1회 재시도. 실패해도 로그인 흐름은 깨지 않는다(기존 원칙 유지).
```ts
// 기존: onAuthStateChange 콜백 안에서 SIGNED_IN | USER_UPDATED 일 때 실행되는 블록을 아래로 교체
if ((event === "SIGNED_IN" || event === "USER_UPDATED") && next?.user) {
  const anonSessionId = getAnonSessionId();
  if (anonSessionId) {
    const userId = next.user.id;
    void (async () => {
      const link = () =>
        supabase
          .from("profiles")
          .update({ anon_session_id: anonSessionId })
          .eq("id", userId)
          .select("id");
      try {
        let { data, error } = await link();
        if (!error && (data?.length ?? 0) === 0) {
          // 메인 AuthContext.ensureProfile 이 행을 만드는 중일 수 있다 — 1회 재시도
          await new Promise((r) => setTimeout(r, 1500));
          ({ data, error } = await link());
        }
        if (import.meta.env.DEV && (error || (data?.length ?? 0) === 0)) {
          console.warn("[doit/useAuth] anon_session_id 연결 실패", error?.code ?? "no-row");
        }
      } catch {
        // 연결 실패는 로그인 실패가 아니다 — 무시
      }
    })();
  }
}
```
CONFIRM REQUIRED: 원문의 변수명(next / session 등)과 supabase 인스턴스 이름을 실제 파일에 맞춘다. 로직 외 변경 금지.

### PATCH: src/lib/auth/returnPath.ts (원문 미수령)
PROBLEM(조건부): `DEFAULT_RETURN_PATH = '/weather'` 라면 returnPath 유실(sessionStorage 소실·인앱 브라우저 전환) 시 DO IT 사용자가 마음 날씨로 떨어진다. 제품 기준 위반.
WHY: 기본값은 진입 선택 화면 '/'. ECHO 로그인 진입은 이미 `signInWithGoogle(returnPath)` 로 '/weather' 를 명시적으로 넘기므로 정상 fallback 은 유지된다.
```ts
// 변경 전 (확인 필요)
// export const DEFAULT_RETURN_PATH = '/weather';
// 변경 후
export const DEFAULT_RETURN_PATH = '/';
```
값이 이미 '/' 또는 '/start' 이면 변경하지 않는다. 검증 기준(유지): 외부 URL·`//`·`javascript:` 차단, sessionStorage 1회 소비.

### PATCH: src/doit/lib/supabase.ts (원문 미수령 · 조건부)
PROBLEM(조건부): getSupabase() 가 `createClient` 를 따로 호출하면 같은 storageKey 에 GoTrueClient 가 두 개 생겨 refresh 경쟁·"Multiple GoTrueClient instances" 경고가 난다.
WHY: DO IT 은 공용 client 를 재사용해야 세션이 하나로 유지된다.
```ts
import { supabase } from "@/lib/supabase/client";
export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY);
}
export function getSupabase() {
  return isSupabaseConfigured() ? supabase : null;
}
```
이미 공용 client 를 import 하고 있으면 변경하지 않는다.

## 6. 적용 순서
1. client.ts 교체 → 2. callback/page.tsx 교체 → 3. admin/login/page.tsx 교체 → 4~6. 조건부 PATCH(원문 확인 후) → 7. 검사

## 7. 건드리지 말아야 할 파일
- src/context/AuthContext.tsx (수정 없음), 두 AdminGuard, AdminShell, router/config.tsx, doit/routes.tsx, DoitApp.tsx, 모든 화면·디자인·이미지. /do-it/* 와 /doit/* 는 역할이 다르므로 통합 금지.

## 8. dependency
- 추가 없음.

## 9. 환경변수 이름
- VITE_PUBLIC_SUPABASE_URL, VITE_PUBLIC_SUPABASE_ANON_KEY (기존). 신규 없음.

## 10. DB 변경 필요 여부
- 코드 적용에는 불필요. 보안 P0(role 셀프 변경)은 pg_policies 결과에 따라 트리거 초안 실행 여부 결정 → 대표 승인 STOP.

## 11. 적용 후 검사 명령 (Readdy package.json 실제 scripts)
```
npm run type-check
npm run lint
npm run build
```
## 12. 예상 정상 결과
- 세 명령 종료코드 0. 브라우저: Google 로그인 → /auth/callback → 저장된 내부 경로 복귀, 새로고침 후 유지, 두 탭 동시 새로고침에서 로그아웃되지 않음, /admin/login 비관리자에 안내 문구 표시.

## 13. rollback
- 파일 1~3 을 이전 버전으로 되돌린다. DB 변경 없음.
