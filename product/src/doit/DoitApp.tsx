import { Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/doit/hooks/useAuth";
import { KeyWalletProvider } from "@/doit/hooks/useKeyWallet";
import { PurposeProvider } from "@/doit/hooks/usePurpose";
import { UnderstandingProvider } from "@/doit/hooks/useUnderstanding";
import AnalyticsBootstrap from "@/doit/components/feature/AnalyticsBootstrap";
import { getSupabase } from "@/doit/lib/supabase";
import "@/doit/doit.css";
import "@/doit/components/feature/mobile-polish.css"; // 2026-10-05 모바일 글자·정렬·대비 마무리(앱 화면 전용 · 홈페이지 빌드 0)
import "@/doit/components/feature/visual-parity.css"; // 2026-10-05 승인 시안과 시각 일치(앱 화면 전용 · mobile-polish 뒤)
import "@/doit/components/feature/flora-theme.css"; // 2026-10-10 대표 「모바일웹 = Flora」: 겉모습 맨 마지막 층(바탕·판·버튼·글자)
import FloraBackdrop from "@/doit/flora/FloraBackdrop";

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
      <FloraBackdrop />
      <div className="doit-flora-stage">
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
    </div>
  );
}