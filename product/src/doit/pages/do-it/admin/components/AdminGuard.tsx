import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/doit/lib/supabase";
import AdminShell from "./AdminShell";

// 5상태: checking / signed_out / denied / error / ok
type GuardState = "checking" | "signed_out" | "denied" | "error" | "ok";

function adminRedirectUrl(): string {
  const basePath = __BASE_PATH__.split("/").filter(Boolean).join("/");
  const pathPrefix = basePath ? `/${basePath}` : "";
  return `${window.location.origin}${pathPrefix}/doit/admin/mobile`;
}

// Google Provider 미활성화 오류 감지
function isProviderDisabled(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("unsupported provider") ||
    m.includes("provider is not enabled")
  );
}

interface AdminGuardProps {
  onLeaveAdmin?: () => void;
}

export default function AdminGuard({ onLeaveAdmin }: AdminGuardProps) {
  const [state, setState] = useState<GuardState>("checking");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  // 늦은 응답 폐기용 요청 번호
  const reqSeqRef = useRef(0);
  // onLeaveAdmin ref 안정화
  const onLeaveAdminRef = useRef(onLeaveAdmin);
  onLeaveAdminRef.current = onLeaveAdmin;

  // 권한 확인: 전체 user UUID → profiles.id 조회 → role === 'admin' 만 ok
  const checkRole = useCallback(async (session: Session | null) => {
    const seq = ++reqSeqRef.current;

    if (!session?.user) {
      setEmail(null);
      setState("signed_out");
      return;
    }

    setEmail(session.user.email ?? null);
    setState("checking");

    const supabase = getSupabase();
    if (!supabase) {
      if (seq === reqSeqRef.current) {
        setCheckError("Supabase가 연결되지 않았습니다.");
        setState("error");
      }
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (seq !== reqSeqRef.current) return; // 늦은 응답 폐기

    if (error) {
      // RLS·네트워크·스키마 오류 → error
      setCheckError(error.message);
      setState("error");
      return;
    }

    if (!data) {
      // 프로필 없음 → denied
      setState("denied");
      return;
    }

    setState(data.role === "admin" ? "ok" : "denied");
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setCheckError("Supabase가 연결되지 않았습니다.");
      setState("error");
      return;
    }

    let active = true;

    // 초기 세션 확인
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      checkRole(data?.session ?? null);
    });

    // 인증 상태 변화 감지 — 콜백은 동기 반환(await 금지)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        // 즉시 본문 제거
        setEmail(null);
        setState("signed_out");
        onLeaveAdminRef.current?.();
        return;
      }
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        checkRole(session);
      }
    });

    // 포커스 복귀 시 재검사
    const onFocus = () => {
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        checkRole(data?.session ?? null);
      });
    };
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [checkRole]);

  const handleSignOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setState("checking");
    await supabase.auth.signOut();
  }, []);

  const handleRetry = useCallback(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    setState("checking");
    supabase.auth
      .getSession()
      .then(({ data }) => checkRole(data?.session ?? null));
  }, [checkRole]);

  const handleAdminLogin = useCallback(async () => {
    if (signingIn) return;
    setSignInError(null);
    setSigningIn(true);

    const supabase = getSupabase();
    if (!supabase) {
      setSignInError("Supabase가 연결되지 않았습니다.");
      setSigningIn(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: adminRedirectUrl(),
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setSignInError(
        isProviderDisabled(error.message)
          ? "현재 Google 로그인이 활성화되지 않았습니다. Supabase 관리자 설정이 필요합니다."
          : error.message,
      );
      setSigningIn(false);
    }
    // 성공 시 redirect 로 이동하므로 signingIn 유지(중복 클릭 방지)
  }, [signingIn]);

  if (state === "checking") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-foreground-600">
          <i className="ri-loader-4-line animate-spin-slow text-3xl" />
          <p className="text-sm">관리자 권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (state === "signed_out") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-background-200 bg-background-50 p-6">
          <div className="flex items-center gap-2 text-foreground-950">
            <i className="ri-shield-line text-xl text-primary-600" />
            <h1 className="text-lg font-semibold">관리자 로그인</h1>
          </div>
          <p className="mt-2 text-sm text-foreground-600">
            관리자 페이지에 접근하려면 관리자 계정으로 로그인해 주세요.
          </p>

          <button
            type="button"
            onClick={handleAdminLogin}
            disabled={signingIn}
            className="mt-5 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-60"
          >
            {signingIn ? (
              <i className="ri-loader-4-line animate-spin-slow" />
            ) : (
              <i className="ri-google-fill" />
            )}
            {signingIn ? "로그인 진행 중..." : "Google로 관리자 로그인"}
          </button>

          {signInError && (
            <p className="mt-3 rounded-md bg-primary-100 px-3 py-2 text-xs leading-relaxed text-primary-900">
              {signInError}
            </p>
          )}

          <div className="mt-5 rounded-md bg-secondary-50 px-3 py-3">
            <p className="text-xs leading-relaxed text-secondary-900">
              미리보기 주소와 echo.do-it.company는 로그인 정보가 공유되지 않습니다.
              미리보기에서는 관리자 계정으로 다시 로그인해 주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-background-200 bg-background-50 p-6 text-center">
          <i className="ri-lock-line text-3xl text-secondary-600" />
          <h1 className="mt-3 text-lg font-semibold text-foreground-950">
            관리자 권한이 없습니다
          </h1>
          <p className="mt-2 text-sm text-foreground-600">
            현재 로그인한 계정({email ?? "—"})은 관리자 권한이 없어 관리자
            데이터에 접근할 수 없습니다.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-5 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-background-200 px-4 py-2 text-sm font-medium text-foreground-900 transition hover:bg-background-300"
          >
            <i className="ri-logout-box-line" />
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-background-200 bg-background-50 p-6 text-center">
          <i className="ri-error-warning-line text-3xl text-secondary-600" />
          <h1 className="mt-3 text-lg font-semibold text-foreground-950">
            권한 확인에 실패했습니다
          </h1>
          <p className="mt-2 text-sm text-foreground-600">
            관리자 권한을 확인하는 중 오류가 발생했습니다. 잠시 후 다시
            시도해 주세요.
          </p>
          {checkError && (
            <p className="mt-2 rounded-md bg-secondary-50 px-3 py-2 text-xs leading-relaxed text-secondary-900">
              {checkError}
            </p>
          )}
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
            >
              <i className="ri-refresh-line" />
              다시 시도
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-background-200 px-4 py-2 text-sm font-medium text-foreground-900 transition hover:bg-background-300"
            >
              <i className="ri-logout-box-line" />
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AdminShell />;
}