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
          {!loading && user ? (
            // 로그인 상태는 브랜드·앱이 도메인 쿠키로 공유한다(sessionStorage.ts). 여기서 로그아웃하면 앱도 로그아웃된다.
            <button type="button" className="doit-brand-session" onClick={() => { void handleSignOut(); }} disabled={signingOut} aria-busy={signingOut}>
              {signingOut ? '로그아웃 중' : '로그아웃'} <span aria-hidden="true">↗</span>
            </button>
          ) : IS_BRAND_SITE ? (
            // 브랜드 사이트(do-it.company)에는 로그인 화면이 없다. 앱 주소의 로그인으로 보낸다.
            <a href={appUrl('/login')}>로그인 <span aria-hidden="true">↗</span></a>
          ) : loading ? (
            <span className="doit-brand-session" aria-hidden="true">로그인 <span>↗</span></span>
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
          {/* 대표 최종 승인 2026-09-24 「AGENT v1 / HOMEPAGE FINAL LOCK」 Hero 1안: 문구·버튼 글자만 바꾼다(자리·크기·색·움직임은 그대로 — Quiet Luxury · 기존 디자인 유지). */}
          <p className="doit-brand-line">좋아하는 사람보다,<br /> 편해지는 사람은<br className="doit-brand-mobile-break" /> 다를 수 있으니까.</p>
          <div className="doit-brand-invitation">
            <a className="doit-brand-start" href={IS_BRAND_SITE ? appUrl('/doit/start-journey') : '/doit/start-journey'} onClick={start}>ECHO 시작하기 <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></a>
            <p className="doit-brand-status">ECHO는 당신의 말을 조금씩 기억하며,<br /> 어떤 관계가 자연스러운지 알아갑니다.</p>
          </div>
        </div>
      </div>
      <div className="doit-brand-bottom"><span>© 2026 DO IT COMPANY</span><div className="doit-brand-bottom-actions">{onToggleMotion && <button type="button" className="doit-motion-toggle" aria-pressed={motionPaused} onClick={onToggleMotion}><span aria-hidden="true">{motionPaused ? '▷' : 'Ⅱ'}</span> 움직임 줄이기</button>}<a href="#doit-stories">아래로, 조금 더 알아보기 <span aria-hidden="true">↓</span></a></div></div>
    </section>
  );
}
