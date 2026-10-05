import DoItSymbol from "@/components/DoItSymbol";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { visibleInRelease } from "@/doit/lib/releaseScope";
import KeyChip from "./KeyChip";

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
          <DoItSymbol decorative />
          {title ? (
            <h1 className="font-heading text-lg font-semibold text-foreground-950">
              {title}
            </h1>
          ) : (
            <span className="font-heading text-xl font-semibold tracking-tight text-foreground-950">
              DO IT
            </span>
          )}
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
