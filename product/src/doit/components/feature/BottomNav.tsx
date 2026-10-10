import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { visibleInRelease } from "@/doit/lib/releaseScope";

interface Tab {
  key: string;
  label: string;
  to: string;
  icon: string;
  activeIcon: string;
}

const allTabs: Tab[] = [
  { key: "home", label: "홈", to: "/doit/home", icon: "ri-home-5-line", activeIcon: "ri-home-5-fill" },
  { key: "spaces", label: "공간", to: "/doit/spaces", icon: "ri-compass-3-line", activeIcon: "ri-compass-3-fill" },
  { key: "world", label: "월드", to: "/doit/world", icon: "ri-earth-line", activeIcon: "ri-earth-fill" },
  { key: "connections", label: "연결", to: "/doit/connections", icon: "ri-hearts-line", activeIcon: "ri-hearts-fill" },
  { key: "profile", label: "프로필", to: "/doit/profile", icon: "ri-user-3-line", activeIcon: "ri-user-3-fill" },
];

// 메뉴 숨김 목록(src/doit/lib/releaseScope.ts). 41차는 비어 있어 운영과 같은 탭이다.
const tabs = allTabs.filter((tab) => visibleInRelease(tab.to));

// 2026-10-10 기기 호환: 글을 적는 동안(입력칸에 초점) 아래 탭 줄을 숨긴다 — 휴대폰 글자판이 올라오면 화면 아래에 붙은 탭 줄이
// 글자판 바로 위로 떠올라 입력칸·보내기 버튼을 가렸다(Samsung Internet·Chrome Android·iOS Safari). 초점이 빠지면 그대로 돌아온다.
const SHOW_DELAY_MS = 400;
const NON_TEXT_INPUT = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image", "hidden"]);
function isTextField(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUT.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

export default function BottomNav({ activeTab }: { activeTab?: string }) {
  const [typing, setTyping] = useState(() => typeof document !== "undefined" && isTextField(document.activeElement));
  useEffect(() => {
    // 다시 보일 때는 조금 늦게: 입력칸에서 바로 「보내기」를 누르는 순간 탭 줄이 손가락 밑에 먼저 나타나 누름을 가로채지 않게.
    let timer = 0;
    const onIn = (event: FocusEvent) => { window.clearTimeout(timer); if (isTextField(event.target)) setTyping(true); };
    const onOut = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTyping(isTextField(document.activeElement)), SHOW_DELAY_MS);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => { window.clearTimeout(timer); document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); };
  }, []);
  if (typing) return null;
  return (
    <nav aria-label="앱 메뉴" className="doit-product-nav fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-background-200/70 bg-background-50/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <NavLink
              key={tab.key}
              to={tab.to}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
                active ? "text-primary-600" : "text-foreground-500"
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center">
                <i
                  className={`${active ? tab.activeIcon : tab.icon} text-[22px]`}
                />
              </span>
              <span className="whitespace-nowrap font-label text-[11px] font-medium">
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}