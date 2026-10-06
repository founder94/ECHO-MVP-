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
