import DoItSymbol from "@/components/DoItSymbol";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { visibleInRelease } from "@/doit/lib/releaseScope";

interface TopBarProps {
  title?: string;
  back?: boolean;
  showActions?: boolean;
}

// 2026-09-26 MVP: 메뉴는 「말한다 → 이해한다 → 기억한다」와 설정·설치만. 숨긴 기능(Just Try·사주·타로·등급)은 releaseScope 로 빠진다.
const ALL_MENU_ITEMS = [
  { label: "ECHO와 이야기하기", desc: "생각나는 대로 말하면 돼요", to: "/doit/conversation", icon: "ri-chat-1-line" },
  { label: "나의 이해", desc: "내가 맞다고 한 것만 모아 뒀어요", to: "/doit/understanding", icon: "ri-book-open-line" },
  { label: "홈 화면에 ECHO 추가", desc: "앱처럼 바로 열 수 있어요", to: "/doit/settings#install", icon: "ri-smartphone-line" },
  { label: "설정", desc: "소개·사진·계정", to: "/doit/settings", icon: "ri-settings-3-line" },
  { label: "Just Try", desc: "시도하고, 모으고, 다시 즐겨요", to: "/doit/just-try", icon: "ri-sparkling-2-line" },
  { label: "사주·타로 (무료)", desc: "재미로 보는 무료 콘텐츠", to: "/doit/fortune", icon: "ri-magic-line" },
  { label: "등급 가이드", desc: "등급의 의미 알아보기", to: "/doit/grade", icon: "ri-medal-line" },
];

// 메뉴 숨김 목록(src/doit/lib/releaseScope.ts). 41차는 비어 있어 운영과 같은 메뉴다.
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

        <div className="flex items-center gap-1">
          {/* 햄버거 메뉴 */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="메뉴"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-700 doit-icon-button"
            >
              <i className={`${menuOpen ? "ri-close-line" : "ri-menu-line"} text-xl`} />
            </button>

            {/* 2026-09-26: 머리줄(흐림 막) 안에 두면 메뉴 판의 흐림이 뒤 화면을 못 본다(겹친 흐림) → 화면 틀(.doit-app-pastel)로 옮겨 그린다. */}
            {menuOpen && createPortal(
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="doit-menu-panel fixed right-4 z-50 w-64 overflow-hidden rounded-2xl" style={{ top: "calc(env(safe-area-inset-top) + 80px)" }}>
                  <p className="doit-menu-caption px-4 pb-2 pt-3">
                    메뉴
                  </p>
                  {MENU_ITEMS.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className="doit-menu-item flex items-center gap-3 px-4 py-3"
                    >
                      <span className="doit-menu-icon flex h-9 w-9 items-center justify-center rounded-full">
                        <i className={`${item.icon} text-lg`} />
                      </span>
                      <span className="flex-1">
                        <span className="doit-menu-label block">
                          {item.label}
                        </span>
                        <span className="doit-menu-desc block">
                          {item.desc}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </>,
              document.querySelector(".doit-app-pastel") ?? document.body,
            )}
          </div>

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
              <Link
                to="/doit/settings"
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-700 doit-icon-button"
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
