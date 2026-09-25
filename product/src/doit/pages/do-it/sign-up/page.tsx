import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/doit/hooks/useAuth";

// A·B 통합(2026-09-05): 계정은 하나다. DO IT 안에서 따로 가입·로그인하지 않는다.
// - 이미 로그인됨 → 가입 다음 단계(/doit/verify)로 바로 간다.
// - 로그인 안 됨 → ECHO 로그인 화면으로 보내고, 끝나면 /doit/verify 로 돌아온다.
const AFTER_SIGN_UP_PATH = "/doit/verify";
const LOGIN_PATH = "/login";

export default function SignUp() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate(AFTER_SIGN_UP_PATH, { replace: true });
      return;
    }
    navigate(LOGIN_PATH, { replace: true, state: { from: AFTER_SIGN_UP_PATH } });
  }, [user, loading, navigate]);

  return (
    <div className="do-it-app flex min-h-dvh items-center justify-center">
      <span className="h-8 w-8 rounded-full border-2 border-foreground-300 border-t-foreground-950 animate-spin-slow" />
    </div>
  );
}