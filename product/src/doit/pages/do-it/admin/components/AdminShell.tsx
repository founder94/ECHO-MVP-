import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/doit/hooks/useAuth";
import { ADMIN_MENUS } from "../meta";
import { useAdminData, type Period } from "../hooks/useAdminData";
import { useAnalytics } from "../hooks/useAnalytics";
import Dashboard from "../views/Dashboard";
import Users from "../views/Users";
import ConversationLogs from "../views/ConversationLogs";
import ConnectionApprovals from "../views/ConnectionApprovals";
import AgentConversations from "../views/AgentConversations";
import ProfileVerify from "../views/ProfileVerify";
import Purposes from "../views/Purposes";
import Spaces from "../views/Spaces";
import ReportsBlocks from "../views/ReportsBlocks";
import AuditLogs from "../views/AuditLogs";
import BlockedTable from "../views/BlockedTable";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
  { key: "all", label: "전체" },
];

export default function AdminShell() {
  const { user, signOut } = useAuth();
  // ?menu=agent 처럼 주소로 메뉴를 열 수 있다(점검표의 「사용자별로 어디서 멈췄는지 보기」 → 대화 에이전트).
  const [search] = useSearchParams();
  const menuFromUrl = search.get("menu");
  const [active, setActive] = useState<string>(() => (ADMIN_MENUS.some((m) => m.key === menuFromUrl) ? menuFromUrl! : "dashboard"));
  useEffect(() => { if (menuFromUrl && ADMIN_MENUS.some((m) => m.key === menuFromUrl)) setActive(menuFromUrl); }, [menuFromUrl]);
  const [period, setPeriod] = useState<Period>("7d");
  const [menuOpen, setMenuOpen] = useState(false);
  const { data, refresh } = useAdminData(period);
  const { data: analyticsData } = useAnalytics(period);

  const activeMenu = ADMIN_MENUS.find((m) => m.key === active) ?? ADMIN_MENUS[0];

  const renderView = () => {
    switch (active) {
      case "dashboard":
        return <Dashboard data={data} analytics={analyticsData} />;
      case "connections":
        return <ConnectionApprovals />;
      case "agent":
        return <AgentConversations />;
      case "conversation-logs":
        return <ConversationLogs period={period} />;
      case "users":
        return <Users data={data} />;
      case "profile-verify":
        return <ProfileVerify data={data} />;
      case "purposes":
        return <Purposes data={data} />;
      case "spaces":
        return <Spaces data={data} />;
      case "reports-blocks":
        return <ReportsBlocks data={data} />;
      case "audit-logs":
        return <AuditLogs data={data} />;
      case "missions":
        return <BlockedTable menu={activeMenu} state={data.missions} />;
      case "selections":
        return <BlockedTable menu={activeMenu} state={data.selections} />;
      case "key-balances":
        return <BlockedTable menu={activeMenu} state={data.keyBalances} />;
      case "key-orders":
        return <BlockedTable menu={activeMenu} state={data.keyOrders} />;
      case "saju-taro":
        return <BlockedTable menu={activeMenu} state={data.sajuTaro} />;
      case "ai-ops":
        return <BlockedTable menu={activeMenu} state={data.aiRateLimits} />;
      case "consents":
        return <BlockedTable menu={activeMenu} state={data.consents} />;
      default:
        return <Dashboard data={data} analytics={analyticsData} />;
    }
  };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* 사이드바 */}
      <aside className="w-full shrink-0 border-b border-background-200 bg-background-50 lg:min-h-dvh lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:px-5">
          <div className="flex items-center gap-2">
            <i className="ri-shield-line text-lg text-primary-600" />
            <span className="text-sm font-semibold text-foreground-950">DO IT 운영 관리자</span>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-background-200 text-foreground-700 lg:hidden"
          >
            <i className={menuOpen ? "ri-close-line" : "ri-menu-line"} />
          </button>
        </div>

        <nav
          className={`${menuOpen ? "block" : "hidden"} flex-col gap-1 px-2 pb-4 lg:flex`}
        >
          {ADMIN_MENUS.map((menu) => (
            <button
              key={menu.key}
              type="button"
              onClick={() => {
                setActive(menu.key);
                setMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 whitespace-nowrap rounded-md px-3 py-2.5 text-left text-sm transition ${
                active === menu.key
                  ? "bg-primary-500 font-semibold text-background-50"
                  : "text-foreground-700 hover:bg-background-100"
              }`}
            >
              <i className={`${menu.icon} w-4 text-center`} />
              <span className="flex-1">{menu.label}</span>
              {menu.kind === "blocked" && (
                <i className="ri-lock-line text-xs opacity-70" title="아직 없거나 볼 권한이 없는 기능" />
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* 본문 */}
      <main className="min-w-0 flex-1">
        {/* 헤더 */}
        <header className="sticky top-0 z-10 border-b border-background-200 bg-background-50/95 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold text-foreground-950">
                {activeMenu.label}
              </h1>
              {/* 대표 2026-09-25: 영어 표 이름 대신 다른 관리자 화면으로 가는 길을 둔다(관리자 화면이 두 곳). */}
              <Link to="/admin/mobile" className="inline-flex min-h-[32px] items-center rounded-full border border-background-200 px-3 text-xs text-foreground-600 hover:bg-background-100">
                옛 ECHO 운영센터(예전 대화·결제 기록) →
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full bg-background-100 p-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                      period === p.key
                        ? "bg-background-50 text-foreground-950"
                        : "text-foreground-500 hover:text-foreground-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => refresh()}
                disabled={data.loading}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-200 px-3 py-1.5 text-xs font-medium text-foreground-700 transition hover:bg-background-100 disabled:opacity-60"
              >
                <i className={`ri-refresh-line ${data.loading ? "animate-spin-slow" : ""}`} />
                새로고침
              </button>

              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-200 px-3 py-1.5 text-xs font-medium text-foreground-700 transition hover:bg-background-100"
              >
                <i className="ri-logout-box-line" />
                로그아웃
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 pb-2 text-xs text-foreground-500 md:px-6">
            <span className="truncate">로그인: {user?.email ?? "—"}</span>
            <span className="text-foreground-300">·</span>
            <span className="whitespace-nowrap">
              마지막 조회:{" "}
              {data.lastFetchedAt
                ? data.lastFetchedAt.toLocaleTimeString("ko-KR")
                : "—"}
            </span>
          </div>
        </header>

        <div className="px-4 py-6 md:px-6">{renderView()}</div>
      </main>
    </div>
  );
}