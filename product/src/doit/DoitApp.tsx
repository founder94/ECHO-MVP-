import { Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/doit/hooks/useAuth";
import { KeyWalletProvider } from "@/doit/hooks/useKeyWallet";
import { PurposeProvider } from "@/doit/hooks/usePurpose";
import { UnderstandingProvider } from "@/doit/hooks/useUnderstanding";
import AnalyticsBootstrap from "@/doit/components/feature/AnalyticsBootstrap";
import { getSupabase } from "@/doit/lib/supabase";
import "@/doit/doit.css";

// DO IT(A 구조 · "당신이 잠든 사이에") 서브앱의 뿌리.
// - /doit/* 아래 모든 화면은 이 레이아웃 안에서 렌더링된다.
// - 스타일은 .doit-root 아래로만 적용된다(ECHO 전역 CSS 오염 0).
// - Supabase 클라이언트는 ECHO(B)와 같은 것 하나를 공유한다(계정 하나로 통합).
function AccountUnderstanding({ children }: { children: import("react").ReactNode }) {
  const { user } = useAuth();
  return <UnderstandingProvider key={user?.id ?? "signed-out"}>{children}</UnderstandingProvider>;
}

export default function DoitApp() {
  const supabase = getSupabase();

  return (
    <div className="doit-root">
      <AuthProvider>
        <KeyWalletProvider>
          <PurposeProvider>
            <AccountUnderstanding>
              {supabase && <AnalyticsBootstrap supabase={supabase} enabled={false} />}
              <Outlet />
            </AccountUnderstanding>
          </PurposeProvider>
        </KeyWalletProvider>
      </AuthProvider>
    </div>
  );
}