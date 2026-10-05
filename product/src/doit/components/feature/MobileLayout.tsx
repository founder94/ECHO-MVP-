import type { ReactNode } from "react";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import "./product-brand.css";
import "./ref-parity.css"; // 2026-10-05 승인 시안 일치(마지막에 적용)
import "./brand-parity.css"; // 2026-10-05 #131 프로필 준비·머리줄 이름(ref-parity 다음)

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  back?: boolean;
  showHeader?: boolean;
  showNav?: boolean;
  activeTab?: string;
}

export default function MobileLayout({
  children,
  title,
  back = false,
  showHeader = true,
  showNav = false,
  activeTab,
}: MobileLayoutProps) {
  // 2026-09-25 대표 MASTER §12: 사용자 앱 화면 전면 파스텔(관리자 화면은 이 틀을 쓰지 않는다)
  return (
    <div className="do-it-app doit-product doit-app-pastel relative mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {showHeader && <TopBar title={title} back={back} showActions={showNav} />}

      <main className={`doit-product-main flex-1 px-4 pb-8 ${showNav ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : ""}`}>
        {children}
      </main>

      {showNav && <BottomNav activeTab={activeTab} />}
    </div>
  );
}