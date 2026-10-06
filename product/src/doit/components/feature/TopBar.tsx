import DoItSymbol from "@/components/DoItSymbol";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { visibleInRelease } from "@/doit/lib/releaseScope";
import KeyChip from "./KeyChip";
import "./brand-parity.css"; // 머리줄 ECHO 글자(§8) — 이 머리줄을 쓰는 화면이면 어디서든

interface TopBarProps {
  title?: string;
  back?: boolean;
  showActions?: boolean;
}

// 알림은 숨김 목록(src/doit/lib/releaseScope.ts)에 있으면 빠진다. 메뉴·설정은 모든 제품 화면 공통 오른쪽 위 하나(src/components/AppCornerMenu.tsx).
const SHOW_NOTIFICATIONS = visibleInRelease("/doit/notifications");

export default function TopBar({
  title,
  back = false,
  showActions = true,
}: TopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="doit-product-topbar sticky top-0 z-40 border-b border-background-200/70 bg-background-100/90 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {back && (
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-700 doit-icon-button"
              aria-label="뒤로"
            >
              <i className="ri-arrow-left-line text-xl" />
            </button>
          )}
          {/* 2026-10-05 대표 「DO IT = 회사 · ECHO = 모바일 웹 이름」: 회사 D 심볼을 두고, 옆에 서비스 이름 ECHO 를 따로 적는다.
              화면 제목(프로필·연결 등)은 본문이 크게 보여 주므로 머리줄에서는 화면 읽기 프로그램용으로만 남긴다. */}
          <DoItSymbol decorative />
          <span className="echo-wordmark font-heading text-xl font-semibold text-foreground-950" aria-label="ECHO">ECHO</span>
          {title && <h1 className="echo-sr">{title}</h1>}
        </div>

        {/* 오른쪽 44px 는 공통 메뉴 버튼 자리(겹침 0). */}
        <div className="flex items-center gap-1 pr-12">
          {/* 2026-10-05 승인 시안: 윗줄 오른쪽 KEY 알약(메뉴 버튼 왼쪽 · 겹침 0) */}
          <KeyChip />
          {showActions && (
            <>
              {SHOW_NOTIFICATIONS && (
                <Link
                  to="/doit/notifications"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-700 doit-icon-button"
                  aria-label="알림"
                >
                  <i className="ri-notification-3-line text-xl" />
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
