import type { ReactNode } from "react";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import "./product-brand.css";

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
  return (
    <div className="do-it-app doit-product relative mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {showHeader && <TopBar title={title} back={back} showActions={showNav} />}

      <main className={`doit-product-main flex-1 px-4 pb-8 ${showNav ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : ""}`}>
        {children}
      </main>

      {showNav && <BottomNav activeTab={activeTab} />}
    </div>
  );
}