import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { IS_BRAND_SITE } from '@/lib/siteRole';
import { visibleInRelease } from '@/doit/lib/releaseScope';
import { openGuide } from '@/lib/guide/bus';
import './app-corner-menu.css';

// 2026-09-28 대표 「FINAL MASTER」 §13·§14: 햄버거(메뉴·설정)는 처음 시작부터 모든 제품 화면의 오른쪽 맨 위, 한 자리에 하나.
// - 화면마다 따로 두던 메뉴·설정 아이콘(TopBar·대화 머리줄·사주·타로)을 이 하나로 합쳤다(같은 버튼 두 개 0).
// - 브랜드 홈페이지 빌드와 로그인 복귀·관리자·QA 화면에는 두지 않는다. 앱의 시작/온보딩/히어로/랜딩에서도 오른쪽 위 메뉴는 실제로 보인다.
// - 메뉴에는 꼭 필요한 것만: 대화 · 나의 이해 · (사주·타로) · 앱 설치 · 설정(계정) · 약관·개인정보 · 로그인/로그아웃.
const HIDDEN_PATH = /^\/(?:auth\/callback\/?$|admin(?:\/|$)|qa\/)/;

const ITEMS = [
  { label: 'ECHO와 이야기하기', desc: '생각나는 대로 말하면 돼요', to: '/doit/conversation' },
  { label: '나의 이해', desc: '맞다고 한 것만 모아 뒀어요', to: '/doit/understanding' },
  { label: '오늘의 나 · 사주·타로', desc: '재미로 가볍게 보는 무료 콘텐츠', to: '/doit/fortune' },
  { label: '앱 설치', desc: '홈 화면에서 바로 열어요', to: '/doit/settings#install' },
  // 2026-10-04 대표 「이용 안내 통합」: 화면을 옮기지 않고 그 자리에서 안내 창을 연다(적던 글 그대로). 새 탭·주소로는 설정 #guide 가 같은 내용.
  { label: '이용 안내', desc: '처음 쓰는 법 · 궁금한 기능', to: '/doit/settings#guide', guide: true },
  { label: '설정', desc: '소개·사진·계정', to: '/doit/settings' },
  { label: '약관 · 개인정보', desc: '서비스 규칙과 내 정보', to: '/doit/settings#policy' },
].filter((item) => visibleInRelease(item.to.split('#')[0]));

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      {open
        ? <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        : <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

export default function AppCornerMenu() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const firstItem = useRef<HTMLAnchorElement>(null);
  const cornerButton = useRef<HTMLButtonElement>(null);

  // iOS 사파리는 문서에 터치 듣기가 하나라도 있어야 :active(눌림 표시)를 그린다.
  useEffect(() => {
    const noop = () => {};
    document.addEventListener('touchstart', noop, { passive: true });
    return () => document.removeEventListener('touchstart', noop);
  }, []);
  useEffect(() => { setOpen(false); setError(null); }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (IS_BRAND_SITE || HIDDEN_PATH.test(location.pathname)) return null;

  const handleSignOut = async () => {
    if (inFlight.current || loading || !user) return;
    inFlight.current = true;
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      setOpen(false);
      navigate('/doit/start-journey', { replace: true });
    } catch {
      setError('로그아웃하지 못했어요. 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      inFlight.current = false;
      setSigningOut(false);
    }
  };

  return (
    <>
      <button ref={cornerButton} type="button" className="echo-corner-button" aria-label={open ? '메뉴 닫기' : '메뉴'} aria-expanded={open} aria-controls="echo-corner-panel" onClick={() => setOpen((v) => !v)}>
        <MenuIcon open={open} />
      </button>
      {open && createPortal(
        <>
          <div className="echo-corner-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <nav id="echo-corner-panel" className="echo-corner-panel" aria-label="메뉴">
            <p className="echo-corner-caption">메뉴</p>
            {ITEMS.map((item, index) => (
              <Link key={item.to} ref={index === 0 ? firstItem : undefined} to={item.to} className="echo-corner-item" onClick={(e) => { setOpen(false); if ('guide' in item && item.guide && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openGuide(undefined, cornerButton.current); } }}>
                <span className="echo-corner-label">{item.label}</span>
                <span className="echo-corner-desc">{item.desc}</span>
              </Link>
            ))}
            <div className="echo-corner-account">
              {!loading && !user ? (
                <Link to="/login" state={{ from: location.pathname }} className="echo-corner-session" onClick={() => setOpen(false)}>로그인</Link>
              ) : (
                <button type="button" className="echo-corner-session" onClick={() => void handleSignOut()} disabled={loading || signingOut} aria-busy={signingOut}>
                  {loading ? '로그인 상태 확인 중' : signingOut ? '로그아웃 중' : '로그아웃'}
                </button>
              )}
              {error && <p className="echo-corner-error" role="alert">{error}</p>}
            </div>
          </nav>
        </>,
        document.body,
      )}
    </>
  );
}
