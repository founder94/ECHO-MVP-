import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ADMIN_MENUS, PERIODS, type AdminMenuKey, type Period } from '../meta';
import { useAdminData } from '../hooks/useAdminData';
import Dashboard from '../views/Dashboard';
import Users from '../views/Users';
import Conversations from '../views/Conversations';
import Payments from '../views/Payments';
import Errors from '../views/Errors';
import '../admin.css';

export default function AdminShell() {
  const { user, signOut } = useAuth();
  const [active, setActive] = useState<AdminMenuKey>('overview');
  const [period, setPeriod] = useState<Period>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversationRefreshNonce, setConversationRefreshNonce] = useState(0);
  const { data, refresh } = useAdminData(period);

  const refreshActiveView = () => {
    void refresh();
    if (active === 'journey') {
      setConversationRefreshNonce((value) => value + 1);
    }
  };

  const renderView = () => {
    switch (active) {
      case 'users':
        return <Users data={data} />;
      case 'journey':
        return <Conversations key={`conversations-${conversationRefreshNonce}`} period={period} />;
      case 'payments':
        return <Payments data={data} />;
      case 'errors':
        return <Errors data={data} />;
      case 'overview':
      default:
        return <Dashboard data={data} />;
    }
  };

  const navButtons = (
    <>
      {ADMIN_MENUS.map((menu) => (
        <button
          key={menu.key}
          type="button"
          onClick={() => setActive(menu.key)}
          className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2.5 text-left text-sm transition ${
            active === menu.key
              ? 'bg-primary-500 font-semibold text-background-50'
              : 'text-foreground-700 hover:bg-background-100'
          }`}
        >
          <i className={`${menu.icon} w-4 text-center`} />
          <span>{menu.label}</span>
        </button>
      ))}
    </>
  );

  return (
    <div className="echo-admin light flex min-h-dvh flex-col bg-background-50 text-foreground-950 lg:flex-row">
      {/* 데스크톱 왼쪽 사이드바 */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-background-200 bg-background-50 lg:flex">
        <div className="flex items-center gap-2 px-5 py-4">
          <i className="ri-shield-line text-lg text-primary-600" />
          <span className="text-sm font-semibold text-foreground-950">운영센터</span>
        </div>
        <nav className="flex flex-col gap-1 px-2 pb-4">{navButtons}</nav>
      </aside>

      {/* 본문 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 상단 헤더 */}
        <header className="sticky top-0 z-10 border-b border-background-200 bg-background-50/95 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground-950 md:text-2xl">
                  ECHO · DO IT 운영센터
                </h1>
                <p className="mt-0.5 text-sm text-foreground-500">
                  서비스 상태와 사용자 흐름을 한눈에 확인합니다.
                </p>
                {/* 대표 2026-09-25: 지금 서비스(DO IT·AI 대화·연결 승인)는 다른 관리자 화면에 있다. */}
                <Link to="/doit/admin/mobile" className="mt-2 inline-flex min-h-[36px] items-center rounded-full border border-primary-300 px-3 text-sm font-medium text-primary-700 hover:bg-primary-50">
                  지금 서비스 관리(DO IT 운영 관리자)로 가기 →
                </Link>
              </div>

              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshActiveView}
                  disabled={data.loading}
                  className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-md border border-background-200 px-3 text-sm font-medium text-foreground-700 transition hover:bg-background-100 disabled:opacity-60"
                >
                  <i className={`ri-refresh-line ${data.loading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>

                {/* 설정(상단 메뉴) */}
                <button
                  type="button"
                  onClick={() => setSettingsOpen((v) => !v)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-background-200 text-foreground-700 transition hover:bg-background-100"
                  aria-label="설정"
                >
                  <i className="ri-settings-3-line" />
                </button>

                {settingsOpen && (
                  <div className="absolute right-0 top-12 z-20 w-56 rounded-lg border border-background-200 bg-background-50 p-2">
                    <div className="border-b border-background-100 px-3 py-2">
                      <p className="text-xs text-foreground-500">로그인 계정</p>
                      <p className="truncate text-sm text-foreground-900">{user?.email ?? '—'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsOpen(false);
                        void signOut();
                      }}
                      className="mt-1 flex w-full items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-foreground-700 transition hover:bg-background-100"
                    >
                      <i className="ri-logout-box-line" />
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* 기간 선택 */}
              <div className="flex rounded-full bg-background-100 px-1 py-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                      period === p.key
                        ? 'bg-background-50 text-foreground-950'
                        : 'text-foreground-500 hover:text-foreground-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <p className="whitespace-nowrap text-xs text-foreground-500">
                마지막 업데이트:{' '}
                {data.lastFetchedAt
                  ? data.lastFetchedAt.toLocaleString('ko-KR', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </p>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-6 lg:pb-8">{renderView()}</main>
      </div>

      {/* 모바일 하단 메뉴(5개) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-background-200 bg-background-50 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {ADMIN_MENUS.map((menu) => (
          <button
            key={menu.key}
            type="button"
            onClick={() => setActive(menu.key)}
            className={`flex flex-1 flex-col items-center gap-1 whitespace-nowrap py-2.5 text-xs transition ${
              active === menu.key ? 'text-primary-600' : 'text-foreground-500'
            }`}
          >
            <i className={`${menu.icon} text-lg`} />
            <span>{menu.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
