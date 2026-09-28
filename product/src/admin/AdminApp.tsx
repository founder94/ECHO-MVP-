// ADMIN WEB(admin.do-it.company) — 대표·운영자 전용. 공개 사용자 앱이 아니다.
// 화면 보호: 로그인 → profiles.role = 'admin' 확인. 진짜 보호는 서버(admin-web · doit-connect)가 다시 확인하는 것(여기는 보조).
import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import Dashboard from './views/Dashboard';
import Users from './views/Users';
import Conversations from './views/Conversations';
import Connect from './views/Connect';
import Safety from './views/Safety';
import { Alerts, Audit, DataCheck, Release, ServiceStatus, Settings } from './views/Ops';
import { Loading } from './ui';
import './admin-web.css';

const AuthCallbackPage = lazy(() => import('@/pages/auth/callback/page'));

export const MENUS = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'users', label: '사용자' },
  { key: 'conversations', label: 'AI 대화' },
  { key: 'facts', label: '사용자 확정 상태' },
  { key: 'profiles', label: '프로필' },
  { key: 'connect', label: '연결/매칭' },
  { key: 'safety', label: '신고·차단' },
  { key: 'status', label: '서비스 상태' },
  { key: 'release', label: '배포 관리' },
  { key: 'failures', label: '오류·실패' },
  { key: 'alerts', label: '알림' },
  { key: 'settings', label: '운영 설정' },
  { key: 'audit', label: '감사 기록' },
  { key: 'data', label: '데이터 확인' },
] as const;
export type MenuKey = (typeof MENUS)[number]['key'];

type Gate = { kind: 'checking' } | { kind: 'out' } | { kind: 'denied'; email: string | null } | { kind: 'admin'; email: string | null };

function useAdminGate(): [Gate, () => void] {
  const [gate, setGate] = useState<Gate>({ kind: 'checking' });
  const check = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setGate({ kind: 'out' }); return; }
    const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    setGate(!error && data?.role === 'admin' ? { kind: 'admin', email: user.email ?? null } : { kind: 'denied', email: user.email ?? null });
  }, []);
  useEffect(() => {
    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') void check(); });
    return () => sub.subscription.unsubscribe();
  }, [check]);
  return [gate, () => void check()];
}

export default function AdminApp() {
  useEffect(() => {
    document.title = 'DO IT 관리자';
    document.documentElement.classList.add('aw-root');
  }, []);
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/" element={<Guarded />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function Guarded() {
  const [gate] = useAdminGate();
  const { signOut } = useAuth();
  if (gate.kind === 'checking') return <div className="aw-center"><Loading /></div>;
  if (gate.kind === 'out') return <Navigate to="/login" replace />;
  if (gate.kind === 'denied') {
    return (
      <div className="aw-center">
        <div className="aw-card">
          <h1>관리자 권한이 없습니다</h1>
          <p>{gate.email ?? '이 계정'}은 관리자 계정이 아닙니다. 관리자 자료는 보이지 않습니다.</p>
          <button type="button" className="aw-btn" onClick={() => void signOut()}>로그아웃</button>
        </div>
      </div>
    );
  }
  return <Shell email={gate.email} onSignOut={() => void signOut()} />;
}

function Shell({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  const [params, setParams] = useSearchParams();
  const key = (MENUS.find((m) => m.key === params.get('m'))?.key ?? 'dashboard') as MenuKey;
  const go = (m: string) => { setParams(m === 'dashboard' ? {} : { m }); window.scrollTo(0, 0); };
  const label = MENUS.find((m) => m.key === key)?.label ?? '';
  return (
    <div className="aw">
      <aside className="aw-side" aria-label="관리자 메뉴">
        <div className="aw-brand">DO IT 관리자</div>
        <nav>{MENUS.map((m) => <button key={m.key} type="button" className={m.key === key ? 'on' : ''} aria-current={m.key === key ? 'page' : undefined} onClick={() => go(m.key)}>{m.label}</button>)}</nav>
      </aside>
      <div className="aw-main">
        <header className="aw-top">
          <h1>{label}</h1>
          <label className="aw-mobile-menu">
            <span className="aw-sr">메뉴</span>
            <select value={key} onChange={(e) => go(e.target.value)} aria-label="메뉴">{MENUS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
          </label>
          <div className="aw-me"><span>{email ?? ''}</span><button type="button" className="aw-btn aw-btn--ghost" onClick={onSignOut}>로그아웃</button></div>
        </header>
        <main>
          {key === 'dashboard' ? <Dashboard go={go} /> : null}
          {key === 'users' ? <Users mode="users" /> : null}
          {key === 'conversations' ? <Conversations mode="ai" /> : null}
          {key === 'facts' ? <Conversations mode="facts" /> : null}
          {key === 'profiles' ? <Users mode="profiles" /> : null}
          {key === 'connect' ? <Connect /> : null}
          {key === 'safety' ? <Safety /> : null}
          {key === 'status' ? <ServiceStatus /> : null}
          {key === 'release' ? <Release /> : null}
          {key === 'failures' ? <Conversations mode="failures" /> : null}
          {key === 'alerts' ? <Alerts /> : null}
          {key === 'settings' ? <Settings /> : null}
          {key === 'audit' ? <Audit /> : null}
          {key === 'data' ? <DataCheck /> : null}
        </main>
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (user) navigate('/', { replace: true }); }, [user, navigate]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    const r = await signIn(email.trim(), password);
    setBusy(false);
    if (r.error) setError('로그인하지 못했습니다. 메일과 비밀번호를 확인해 주세요.');
    else navigate('/', { replace: true });
  };
  const google = async () => {
    setBusy(true); setError('');
    const r = await signInWithGoogle('/');
    if (r.error) { setBusy(false); setError('Google 로그인을 시작하지 못했습니다.'); }
  };
  return (
    <div className="aw-center">
      <form className="aw-card" onSubmit={submit}>
        <h1>DO IT 관리자</h1>
        <p className="aw-muted">대표·운영자 전용입니다. 관리자 계정만 들어올 수 있습니다.</p>
        <label className="aw-field"><span>메일</span><input className="aw-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="aw-field"><span>비밀번호</span><input className="aw-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error ? <p className="aw-error" role="alert">{error}</p> : null}
        <button type="submit" className="aw-btn aw-btn--primary" disabled={busy}>로그인</button>
        <button type="button" className="aw-btn" disabled={busy} onClick={() => void google()}>Google로 로그인</button>
      </form>
    </div>
  );
}
