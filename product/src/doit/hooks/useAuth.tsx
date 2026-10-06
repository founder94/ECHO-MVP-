/* eslint-disable react-refresh/only-export-components -- A 구조 원본 구조 유지(컴포넌트+훅 같은 파일). 동작 영향 없음 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/doit/lib/supabase";
import { getAnonSessionId } from "@/doit/lib/openai";
import { rememberReturnPath } from "@/lib/auth/returnPath";

export interface AuthResult {
  error: string | null;
}

const OAUTH_CALLBACK_PATH = "/auth/callback";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  signUp: (
    email: string,
    password: string,
    nickname: string,
  ) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// 익명 세션 ID를 프로필에 연결하는 공통 헬퍼.
// - userId / anonSession / supabase 중 하나라도 없으면 아무것도 하지 않는다.
// - 연결 실패가 로그인·가입을 실패시키면 안 되므로 조용히 무시한다.
// - 같은 anon_session_id 재기록은 update 특성상 멱등이다.
// - profile 행 생성(트리거 등)과 update가 근접할 수 있어, 첫 update가 0건이면
//   짧은 지연 후 1회만 재시도한다(무한 재시도 금지).
// - 여기서 profile 행을 생성하지 않는다(메인 AuthContext의 ensureProfile 책임 유지).
async function linkAnonSession(userId: string): Promise<void> {
  if (!userId) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const anonSession = getAnonSessionId();
  if (!anonSession) return;

  const { count, error } = await supabase
    .from("profiles")
    .update({ anon_session_id: anonSession }, { count: "exact" })
    .eq("id", userId);

  if (error) return;

  if (count === 0) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await supabase
      .from("profiles")
      .update({ anon_session_id: anonSession })
      .eq("id", userId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      setLoading(false);
      // A. 초기 getSession 성공 시 익명 세션 연결(콜백 복귀 등으로 이벤트를 놓친 경우 보완)
      if (data?.session?.user) {
        void linkAnonSession(data.session.user.id);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // B. SIGNED_IN / C. USER_UPDATED 시 익명 세션 ID를 프로필에 연결
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && next?.user) {
        void linkAnonSession(next.user.id);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      nickname: string,
    ): Promise<AuthResult> => {
      const supabase = getSupabase();
      if (!supabase) return { error: "Supabase가 연결되지 않았습니다." };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname } },
      });
      if (!error && data?.user) {
        await linkAnonSession(data.user.id);
      }
      return { error: error ? error.message : null };
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const supabase = getSupabase();
      if (!supabase) return { error: "Supabase가 연결되지 않았습니다." };
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error ? error.message : null };
    },
    [],
  );

  // A·B 통합: Google 로그인 복귀 주소는 ECHO 와 같은 /auth/callback 하나로 맞춘다(Supabase Redirect URLs 등록 1개).
  // basePath(운영 하위 경로 배포)가 있으면 반영해 ECHO(AuthContext.oauthRedirectUrl)와 동일하게 만든다.
  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    const supabase = getSupabase();
    if (!supabase) return { error: "Supabase가 연결되지 않았습니다." };
    // PATCH 3: OAuth 전에 현재 DO IT 내부 경로를 보존해, callback 후 원래 화면으로 복귀한다.
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    rememberReturnPath(currentPath);
    const base = (__BASE_PATH__ || "/").replace(/\/$/, "");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${base}${OAUTH_CALLBACK_PATH}` },
    });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('로그아웃 연결을 확인하지 못했어요.');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        configured: isSupabaseConfigured,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
