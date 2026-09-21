import { useRef, useState, type MouseEvent } from 'react';
import DoItSymbol from './DoItSymbol';
import { useAuth } from '@/context/AuthContext';
import { IS_BRAND_SITE, appUrl } from '@/lib/siteRole';
import './doit-brand-hero.css';

interface Props { onStart?: () => void; motionPaused?: boolean; onToggleMotion?: () => void }

// 2026-09-21 대표 지시: 로그인한 상태면 "로그인" 대신 "로그아웃"이 보여야 한다.
// 글자·동작만 바꾼다(위치·크기·색은 기존 nav 링크 규칙 그대로). 세션 확인 중에는 기존 "로그인" 링크를 유지한다.
export default function DoItBrandHero({ onStart, motionPaused, onToggleMotion }: Props) {
  const { user, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const signOutInFlight = useRef(false);
  const start = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onStart || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onStart();
  };
  const handleSignOut = async () => {
    if (signOutInFlight.current) return;
    signOutInFlight.current = true;
    setSigningOut(true);
    try {
      // AuthContext.signOut 은 실패해도 로컬 세션을 비우므로 여기서는 따로 오류 화면을 만들지 않는다.
      await signOut();
    } finally {
      signOutInFlight.current = false;
      setSigningOut(false);
    }
  };
  return (
    <section className="doit-brand-hero" aria-labelledby="doit-brand-title" data-motion-scene>
      <a className="doit-brand-skip" href="#doit-stories">소개로 바로가기</a>
      <header className="doit-brand-nav">
        <span className="doit-brand-company"><DoItSymbol decorative />DO IT <span>COMPANY</span></span>
        <nav aria-label="홈페이지 메뉴">
          <a href="#doit-stories">우리의 생각</a>
          {IS_BRAND_SITE ? (
            // 브랜드 사이트(do-it.company)에는 로그인이 없다. 앱 주소의 로그인으로 보낸다.
            <a href={appUrl('/login')}>로그인 <span aria-hidden="true">↗</span></a>
          ) : !loading && user ? (
            <button type="button" className="doit-brand-session" onClick={() => { void handleSignOut(); }} disabled={signingOut} aria-busy={signingOut}>
              {signingOut ? '로그아웃 중' : '로그아웃'} <span aria-hidden="true">↗</span>
            </button>
          ) : (
            <a href="/login">로그인 <span aria-hidden="true">↗</span></a>
          )}
        </nav>
      </header>
      <div className="doit-brand-main">
        <p className="doit-brand-badge"><span aria-hidden="true">●</span> JUST TRY.</p>
        <h1 id="doit-brand-title" className="doit-brand-art">
          <span className="doit-brand-sr">DO IT</span>
          <img src="/brand/doit-earth-original.png" alt="" aria-hidden="true" width="1536" height="864" fetchPriority="high" decoding="async" draggable="false" />
        </h1>
        <div className="doit-brand-intro">
          <p className="doit-brand-line">사람은 프로필보다,<br /> 함께한 행동에서<br className="doit-brand-mobile-break" /> 더 많이 보이니까.</p>
          <div className="doit-brand-invitation">
            <a className="doit-brand-start" href={IS_BRAND_SITE ? appUrl('/doit/start-journey') : '/doit/start-journey'} onClick={start}>지금 시작하기 <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></a>
            <p className="doit-brand-status">지금은 목적 선택과 프로필 준비까지.<br /> 사람 연결은 준비 중입니다.</p>
          </div>
        </div>
      </div>
      <div className="doit-brand-bottom"><span>© 2026 DO IT COMPANY</span><div className="doit-brand-bottom-actions">{onToggleMotion && <button type="button" className="doit-motion-toggle" aria-pressed={motionPaused} onClick={onToggleMotion}><span aria-hidden="true">{motionPaused ? '▷' : 'Ⅱ'}</span> 움직임 줄이기</button>}<a href="#doit-stories">아래로, 조금 더 알아보기 <span aria-hidden="true">↓</span></a></div></div>
    </section>
  );
}
