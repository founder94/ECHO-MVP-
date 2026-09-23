import DoItSymbol from "@/components/DoItSymbol";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { visibleInRelease } from "@/doit/lib/releaseScope";

interface TopBarProps {
  title?: string;
  back?: boolean;
  showActions?: boolean;
}

// 사주·타로는 A구조의 필수 과정이 아니라, 햄버거 메뉴에서 진입하는 별도 무료 재미 기능이다.
const ALL_MENU_ITEMS = [
  { label: "다섯 가지 질문", desc: "내 말로 답하고, 다르면 고쳐요", to: "/doit/conversation", icon: "ri-chat-1-line" },
  { label: "나의 이해", desc: "내가 확인하고 고친 개인 기록", to: "/doit/understanding", icon: "ri-book-open-line" },
  { label: "Just Try", desc: "시도하고, 모으고, 다시 즐겨요", to: "/doit/just-try", icon: "ri-sparkling-2-line" },
  { label: "사주·타로 (무료)", desc: "재미로 보는 무료 콘텐츠", to: "/doit/fortune", icon: "ri-magic-line" },
  { label: "등급 가이드", desc: "등급의 의미 알아보기", to: "/doit/grade", icon: "ri-medal-line" },
];

// 출시 1.0: 동작하지 않는 기능은 메뉴에서 숨긴다(src/doit/lib/releaseScope.ts).
const MENU_ITEMS = ALL_MENU_ITEMS.filter((item) => visibleInRelease(item.to));
const SHOW_NOTIFICATIONS = visibleInRelease("/doit/notifications");

export default function TopBar({
  title,
  back = false,
  showActions = true,
}: TopBarProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="doit-product-topbar sticky top-0 z-40 border-b border-background-200/70 bg-background-100/90 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {back && (
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-700 hover:bg-background-200"
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

        <div className="flex items-center gap-1">
          {/* 햄버거 메뉴 */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="메뉴"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-700 hover:bg-background-200"
            >
              <i className={`${menuOpen ? "ri-close-line" : "ri-menu-line"} text-xl`} />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-background-200 bg-background-50">
                  <p className="px-4 pb-2 pt-3 text-[11px] font-medium text-foreground-400">
                    더 보기
                  </p>
                  {MENU_ITEMS.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background-100"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-foreground-600">
                        <i className={`${item.icon} text-lg`} />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-foreground-900">
                          {item.label}
                        </span>
                        <span className="block text-[11px] text-foreground-400">
                          {item.desc}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {showActions && (
            <>
              {SHOW_NOTIFICATIONS && (
                <Link
                  to="/doit/notifications"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-700 hover:bg-background-200"
                  aria-label="알림"
                >
                  <i className="ri-notification-3-line text-xl" />
                </Link>
              )}
              <Link
                to="/doit/settings"
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-700 hover:bg-background-200"
                aria-label="설정"
              >
                <i className="ri-settings-3-line text-xl" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
