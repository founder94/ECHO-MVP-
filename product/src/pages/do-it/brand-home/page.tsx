import { useEffect, useRef, useState, type MouseEvent } from 'react';
import DoItSymbol from '@/components/DoItSymbol';
import { useAuth } from '@/context/AuthContext';
import { APP_ORIGIN, appUrl } from '@/lib/siteRole';
import { DESKTOP_QUERY, INSTALL_PATH } from '@/pages/do-it/landing/components/BrandSections';
import { GREETING, GREETING_CLOSING, GREETING_TITLE } from '@/pages/do-it/landing/components/brandGreeting';
import GuideHost from '@/components/guide/GuideHost';
import BrandFilm, { BRAND_FILM_COPY } from './BrandFilm';
import { openGuide } from '@/lib/guide/bus';
import './brand-home.css';

// 2026-10-04 대표 「홈페이지·모바일 디자인 교체」(홈페이지 검수안 4화면): 회사 홈페이지(do-it.company) 전용.
// 순서 = 브랜드 → ECHO → 회사 정보 → 대표 인사말(맨 마지막) → 법적 고지. 검정·흰색·은색 + 사진 속 파랑·새벽빛만(보라·네온·옆 스침 0).
// 사진은 기존 승인 자산(public/brand) 그대로 · 로고는 공식 원본(DO IT 지구 그림의 로고 띠만 잘라 보여 줌 · 다시 그리지 않음).
// 앱(app.do-it.company)은 이 화면을 쓰지 않는다(라우터가 brand 역할에서만 연결).

const START_PATH = '/doit/start-journey';
export const BRAND_HOME_COPY = {
  heroTitle: '대화로 시작하는 만남.',
  heroLine: '말이 통하는 사람을 만나는 일.',
  echoTitle: ['당신이 잠든 사이,', 'AI가 먼저 만나봅니다.'],
  echoSoon: '관련 기능 준비 중',
  companyLead: ['대화로 시작하는 만남을', '만듭니다.'],
  start: '모바일 시작하기',
  install: '앱 설치 안내',
  learn: 'ECHO 알아보기',
} as const;

// ECHO 가 지금 하는 일(실제 동작만) · 누르면 카드가 앞으로 커지며 열린다.
const ECHO_STEPS: Array<{ title: string; body: string; soon?: boolean }> = [
  { title: '내 말로 이야기해요', body: 'ECHO와 짧게 이야기해요. 어떤 만남을 원하는지, 어떤 사람이 편한지.' },
  { title: '틀리면 바로 고쳐요', body: 'ECHO가 잘못 이해하면 내가 직접 고쳐요. 아니라고 한 것은 다시 단정하지 않아요.' },
  { title: '두 사람이 모두 고를 때만', body: '내 말과 겹치는 사람을 ECHO가 먼저 살펴봐요. 두 사람이 모두 고를 때만 이어져요.', soon: true },
];

const matches = (query: string) => { try { return typeof window.matchMedia === 'function' && window.matchMedia(query).matches; } catch { return false; } };
const reduced = () => matches('(prefers-reduced-motion: reduce)');

// 화면에 들어온 구간에 표시만 붙인다(움직임은 CSS · 움직임 줄이기면 CSS 가 끈다). 화면 밖은 관찰을 멈춘다.
function useDepthReveal() {
  const rootRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-depth]'));
    if (typeof IntersectionObserver !== 'function' || reduced()) { items.forEach((el) => el.setAttribute('data-in', '')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.setAttribute('data-in', ''); io.unobserve(e.target); } });
    }, { threshold: 0.18 });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return rootRef;
}

// 「모바일 시작하기」 전부(첫 화면 포함): 컴퓨터에서는 앱으로 바로 넘기지 않고 QR 구간으로(휴대폰으로 시작) — 기존 홈페이지와 같은 규칙.
// 「이 컴퓨터에서 열기」는 QR 구간 안에 그대로 남는다.
const goStart = (event: MouseEvent<HTMLAnchorElement>) => {
  if (!matches(DESKTOP_QUERY)) return;
  const qr = document.getElementById('bh-start-qr');
  if (!qr) return;
  event.preventDefault();
  qr.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
};

const openInstallGuide = (event: MouseEvent<HTMLAnchorElement>) => {
  if (event.metaKey || event.ctrlKey) return; // 새 탭이면 앱 설치 화면 그대로
  event.preventDefault();
  openGuide('install');
};

// 2026-10-05 대표 「모바일로 시작하기 버튼이 두 개야 … 히어로 페이지에만 있고 나머지 삭제해」: 「모바일 시작하기」는 첫 화면(히어로) 하나뿐.
// 아래 구간에는 「앱 설치 안내」 글자 링크만 ECHO 소개 한 곳에 남긴다(컴퓨터에서 첫 화면 버튼을 누르면 내려오는 QR 구간 바로 위).
function InstallLink() {
  return (
    <div className="bh-actions">
      {/* 2026-10-04 이용 안내 통합: 「앱 설치 안내」 = 이용 안내의 설치 항목(이 자리에서 열림). 새 탭·주소로는 앱 설치 화면 그대로. */}
      <a className="bh-btn bh-btn--text" href={appUrl(INSTALL_PATH)} onClick={openInstallGuide}>{BRAND_HOME_COPY.install}</a>
    </div>
  );
}

export default function BrandHomePage() {
  const rootRef = useDepthReveal();
  const { user, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const productionApp = APP_ORIGIN === 'https://app.do-it.company';

  useEffect(() => {
    if (!menuOpen && openStep === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); setOpenStep(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, openStep]);

  const close = () => setMenuOpen(false);
  return (
    <main ref={rootRef} className="bh">
      <a className="bh-skip" href="#bh-echo">소개로 바로가기</a>
      <header className="bh-nav">
        <span className="bh-brand"><DoItSymbol decorative />DO IT <small>COMPANY</small></span>
        <button ref={menuBtnRef} type="button" className="bh-menu-btn" aria-expanded={menuOpen} aria-controls="bh-menu" onClick={() => setMenuOpen((v) => !v)}>
          <span className="bh-sr">{menuOpen ? '메뉴 닫기' : '메뉴 열기'}</span><i aria-hidden="true" /><i aria-hidden="true" />
        </button>
        {menuOpen && (
          <nav id="bh-menu" className="bh-menu" aria-label="홈페이지 메뉴">
            <a href="#bh-echo" onClick={close}>ECHO</a>
            <a href="#bh-company" onClick={close}>회사 소개</a>
            <a href="#bh-greeting" onClick={close}>대표 인사말</a>
            <button type="button" onClick={() => { close(); openGuide(undefined, menuBtnRef.current); }}>이용 안내</button>
            {!loading && user
              ? <button type="button" onClick={() => { close(); void signOut(); }}>로그아웃</button>
              : <a href={appUrl('/login')}>로그인 <span aria-hidden="true">↗</span></a>}
          </nav>
        )}
      </header>

      {/* 1. 브랜드: 지구 가장자리가 밝아지고 → 로고가 앞으로 나와 멈춘다 */}
      <section className="bh-sec bh-hero" aria-labelledby="bh-hero-title">
        <div className="bh-stars" aria-hidden="true" />
        <h1 className="bh-logo">
          <span className="bh-sr">DO IT</span>
          <span className="bh-logo-band" aria-hidden="true"><img src="/brand/doit-earth-original.png" alt="" width="1536" height="864" fetchPriority="high" decoding="async" draggable="false" /></span>
        </h1>
        <p className="bh-justtry" aria-hidden="true">JUST TRY.</p>
        <div className="bh-hero-copy">
          <p id="bh-hero-title" className="bh-hero-title">{BRAND_HOME_COPY.heroTitle}</p>
          <p className="bh-hero-line">{BRAND_HOME_COPY.heroLine}</p>
          <span className="bh-rule" aria-hidden="true" />
          <div className="bh-actions">
            {/* 명세: 시안에서는 「ECHO 알아보기」가 주 버튼처럼 보여도 「모바일 시작하기」가 주 행동 · ECHO 알아보기는 보조 */}
            <a className="bh-btn bh-btn--outline" href={appUrl(START_PATH)} onClick={goStart}>{BRAND_HOME_COPY.start}<span aria-hidden="true">→</span></a>
            <a className="bh-btn bh-btn--text" href="#bh-echo">{BRAND_HOME_COPY.learn}</a>
          </div>
        </div>
      </section>

      {/* 2. ECHO: 원래 문구 유지 + 실제 제공 전이라 「관련 기능 준비 중」 */}
      <section className="bh-sec bh-photo bh-echo" id="bh-echo" aria-labelledby="bh-echo-title" data-depth>
        <img className="bh-bg" src="/brand/stories/story-08.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" width="941" height="1672" />
        <div className="bh-content">
          <p className="bh-kicker">ECHO</p>
          <h2 id="bh-echo-title" className="bh-title">{BRAND_HOME_COPY.echoTitle[0]}<br />{BRAND_HOME_COPY.echoTitle[1]}</h2>
          <span className="bh-rule" aria-hidden="true" />
          <p className="bh-soon">{BRAND_HOME_COPY.echoSoon}</p>
          <ol className="bh-cards">
            {ECHO_STEPS.map((step, i) => (
              <li key={step.title}>
                <button type="button" className="bh-card" aria-expanded={openStep === i} onClick={() => setOpenStep(openStep === i ? null : i)}>
                  <span className="bh-card-no" aria-hidden="true">{i + 1}</span>
                  <span className="bh-card-title">{step.title}{step.soon && <em className="bh-tag">준비 중</em>}</span>
                </button>
                {openStep === i && <p className="bh-card-body" data-open>{step.body}</p>}
              </li>
            ))}
          </ol>
          <InstallLink />
          <div className="bh-qr" id="bh-start-qr">
            {productionApp && <img src="/brand/app-qr.svg" width="132" height="132" alt="app.do-it.company 로 가는 QR 코드" />}
            <div>
              <p className="bh-qr-title">{productionApp ? '휴대폰 카메라로 비춰 보세요.' : 'ECHO 앱을 열어 보세요.'}</p>
              <p>주소는 <strong>{APP_ORIGIN}</strong></p>
              <a className="bh-btn bh-btn--text" href={appUrl(START_PATH)}>이 컴퓨터에서 열기</a>
            </div>
          </div>
        </div>
      </section>

      {/* 2-1. 홈페이지 제작과정 영상(2026-10-05 대표 교체 · 처음 자리는 2026-10-04 「브랜드 영상」): ECHO 소개 다음 · 회사 소개 앞. */}
      <section className="bh-sec bh-film-sec" id="bh-film" aria-labelledby="bh-film-title" data-depth>
        <div className="bh-stars" aria-hidden="true" />
        <div className="bh-content">
          <p className="bh-kicker">MAKING FILM</p>
          <h2 id="bh-film-title" className="bh-title">{BRAND_FILM_COPY.title}</h2>
          <BrandFilm />
        </div>
      </section>

      {/* 3. 회사 정보 */}
      <section className="bh-sec bh-company" id="bh-company" aria-labelledby="bh-company-title" data-depth>
        <div className="bh-stars" aria-hidden="true" />
        <div className="bh-content">
          <p className="bh-kicker">COMPANY</p>
          <h2 id="bh-company-title" className="bh-title bh-title--wide">DO IT COMPANY</h2>
          <p className="bh-lead">{BRAND_HOME_COPY.companyLead[0]}<br />{BRAND_HOME_COPY.companyLead[1]}</p>
          <figure className="bh-figure"><img src="/brand/stories/story-03.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" width="941" height="1672" /></figure>
          <dl className="bh-rows">
            <div><dt>서비스</dt><dd><a href={appUrl('/')}>{APP_ORIGIN.replace('https://', '')}<span aria-hidden="true">↗</span></a></dd></div>
            <div><dt>문의</dt><dd><a href="mailto:0423doit@gmail.com">0423doit@gmail.com<span aria-hidden="true">↗</span></a></dd></div>
            <div className="bh-rows-links"><dd><a href="/legal/terms">이용약관<span aria-hidden="true">›</span></a></dd><dd><a href="/legal/privacy">개인정보처리방침<span aria-hidden="true">›</span></a></dd></div>
          </dl>
        </div>
      </section>

      {/* 4. 대표 인사말(맨 마지막): 따뜻한 새벽 · 기존 승인 원문 그대로 */}
      <section className="bh-sec bh-photo bh-greeting" id="bh-greeting" aria-labelledby="bh-greeting-title" data-depth>
        <img className="bh-bg" src="/brand/stories/story-06.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" width="941" height="1672" />
        <div className="bh-content">
          <p className="bh-kicker">대표 인사말</p>
          <h2 id="bh-greeting-title" className="bh-title bh-title--greeting">{GREETING_TITLE}</h2>
          <div className="bh-greeting-body">
            {GREETING.map((line) => <p key={line}>{line}</p>)}
            <p className="bh-greeting-closing">{GREETING_CLOSING[0]}<br />{GREETING_CLOSING[1]}</p>
          </div>
          <span className="bh-rule" aria-hidden="true" />
          <p className="bh-sign">대표 <strong>박진욱</strong></p>
        </div>
      </section>

      <footer className="bh-legal">
        <details><summary>DO IT COMPANY · 사업자 정보</summary><p>두잇(DO IT) · 대표 박진욱</p><p>사업자등록번호 121-46-51503 · 통신판매업 신고 제 2026-다산-0583호</p><p>경기도 남양주시 강변북로632번길 41-7, 102동 101호(수석동)</p></details>
        <p><button type="button" className="bh-legal-link" onClick={() => openGuide()}>이용 안내</button> · <a href="/legal/terms">이용약관</a> · <a href="/legal/privacy">개인정보처리방침</a> · <a href="mailto:0423doit@gmail.com">문의 · 0423doit@gmail.com</a></p>
        <p>© 2026 DO IT COMPANY</p>
      </footer>
      {/* 이용 안내 창(검정·흰색·은색). 설치는 앱 주소에서만 — 이 회사 홈페이지를 설치하게 하지 않는다. */}
      <GuideHost theme="brand" extra={{ install: <p className="bh-guide-install">설치는 앱 주소({APP_ORIGIN.replace('https://', '')})에서 해요. 이 회사 홈페이지는 설치하지 않아도 돼요. <a href={appUrl(INSTALL_PATH)}>앱 주소에서 설치하기<span aria-hidden="true">↗</span></a></p> }} />
    </main>
  );
}
