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

// 출시 1.0: 공간·월드는 기능이 없어 숨긴다(src/doit/lib/releaseScope.ts).
const tabs = allTabs.filter((tab) => visibleInRelease(tab.to));

export default function BottomNav({ activeTab }: { activeTab?: string }) {
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