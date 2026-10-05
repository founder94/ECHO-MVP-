import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { APP_ORIGIN, appUrl } from '@/lib/siteRole';
import { DESKTOP_QUERY, INSTALL_PATH } from '@/pages/do-it/landing/components/BrandSections';
import { GREETING, GREETING_CLOSING, GREETING_TITLE } from '@/pages/do-it/landing/components/brandGreeting';
import GuideHost from '@/components/guide/GuideHost';
import { GUIDE_SECTIONS } from '@/lib/guide/content';
import BrandFilm, { BRAND_FILM_COPY } from './BrandFilm';
import MakingFilm, { MAKING_FILM_COPY } from './MakingFilm';
import DotText from './DotText';
import SceneLayer from './SceneLayer';
import { openGuide } from '@/lib/guide/bus';
import './brand-home.css';

// 2026-10-05 대표 「홈페이지 최종」: 회사 홈페이지(do-it.company) 전용. 홈페이지 = 한 편의 브랜드 영상처럼 넘겨 보는 이야기.
// 2026-10-05 대표 「홈페이지가 너무 길다 · 핵심 4페이지만 스크롤 · 나머지는 버튼 누르면 배경 그림이 뜨고 설명」:
// 스크롤 = 히어로 → 이야기(9장면 고르기) → 제작 과정 영상 → 웹 설치하기(+ 더 알아보기: 브랜드 영상 · 회사 소개 · 대표 인사말) → 법적 고지.
// 이야기 장면·브랜드 영상·회사·인사말은 누르면 화면 가득 장면 창(SceneLayer)으로 열린다. 시작(앱으로 가기) 버튼은 히어로 하나뿐. 사진·영상은 대표가 준 원본 그대로(public/brand).
// 앱(app.do-it.company)은 이 화면을 쓰지 않는다(라우터가 brand 역할에서만 연결).

const START_PATH = '/doit/start-journey';
export const BRAND_HOME_COPY = {
  eyebrow: 'ECHO · ONLINE SERENDIPITY',
  heroTitle: ['당신이 잠든 사이,', 'AI가 먼저 만나봅니다.'],
  heroLine: ['오늘의 나를 남겨두세요.', '내일, 뜻밖의 연결이 기다립니다.'],
  // 시안의 「사주 또는 타로로 가볍게 시작해요」는 시작 흐름(목적 고르기 → 대화)과 맞지 않아 지금 되는 일만 적는다(옛 홈페이지 승인 문장).
  heroNote: '지금은 당신의 이야기를 듣는 데서 시작합니다.',
  companyLead: ['대화로 시작하는 만남을', '만듭니다.'],
  start: '모바일로 시작하기',
  install: '웹 설치하기',
  storyTitle: ['잘 쓴 소개보다,', '함께한 시간이 궁금해서.'],
  storyLead: '아홉 장면 중 하나를 눌러 열어 보세요.',
  // 2026-10-05 PM 보강(Codex echo-spec 20261005-plan-a-pm-retention · PR #130 댓글 5989280410 ⑤): 히어로 「내일, 뜻밖의 연결이 기다립니다.」는 승인 원문이라 그대로 두고,
  //   지금 되는 범위(준비 → 보여 줄 사람이 있는지 확인 → 서로 원할 때만 다음)를 한 줄로 적는다. 내일·자동·알림·후보 보장 말 0.
  scope: '지금 ECHO에서는 이야기를 나누고 소개와 사진을 준비하면, 지금 보여 드릴 사람이 있는지 확인할 수 있어요. 서로 원할 때만 다음 단계가 열려요.',
} as const;

type Layer = { kind: 'story'; i: number } | { kind: 'film' } | { kind: 'company' } | { kind: 'greeting' };

// 옛 홈페이지(우주인 이야기 9장면)의 승인 문구·사진·순서 그대로. pos = 사진 구도에 맞춘 글자 자리.
type Story = { no: string; label: string; title: [string, string]; body: [string, string]; img: string; pos: 'top' | 'middle' | 'bottom'; focus: string };
const STORIES: Story[] = [
  { no: '01', label: '당신의 하루', title: ['잘 쓴 소개보다,', '함께한 시간이 궁금해서.'], body: ['어떤 사람인지 묻기 전에,', '같이 무언가를 해보면 어떨까요.'], img: 'story-01', pos: 'top', focus: 'center bottom' },
  { no: '02', label: 'AI의 이해', title: ['내 이야기는,', '내 말로.'], body: ['정해진 답에 나를 맞추지 않고,', '내가 느낀 감정부터 이야기합니다.'], img: 'story-02', pos: 'top', focus: '70% center' },
  { no: '03', label: '연결의 시작', title: ['나를 설명하는', '마지막 말은, 나에게.'], body: ['AI의 해석이 나와 다르면 고칠 수 있어야 합니다.', '우리가 지키려는 약속입니다.'], img: 'story-03', pos: 'top', focus: 'center bottom' },
  { no: '04', label: '메아리의 답', title: ['대화가 끝나도,', '나에 대한 이해는 남도록.'], body: ['흘려보냈던 말에서 내 기준을 발견하고,', '다음 선택에 다시 꺼내볼 수 있도록.'], img: 'story-04', pos: 'bottom', focus: 'center center' },
  { no: '05', label: '감정의 이유', title: ['오늘의 감정에도', '이유가 있으니까.'], body: ['좋은 날만 이야기하지 않아도 괜찮습니다.', '설명하기 어려운 마음도 나의 일부니까요.'], img: 'story-05', pos: 'bottom', focus: '65% center' },
  { no: '06', label: '감정의 변화', title: ['어제와 다른 나여도,', '괜찮습니다.'], body: ['늘 같은 답을 할 필요는 없습니다.', '지금의 내 말을 먼저 듣는 것부터.'], img: 'story-06', pos: 'middle', focus: 'center bottom' },
  { no: '07', label: '새로운 시선', title: ['조금 다른 시선으로,', '나를 다시 봅니다.'], body: ['내가 당연하게 여겼던 것들.', '누군가와 함께하면 새롭게 보이기도 합니다.'], img: 'story-07', pos: 'top', focus: 'center center' },
  { no: '08', label: '우주의 연결', title: ['연결의 속도는,', '각자가 정합니다.'], body: ['서두르지 않고, 내가 원하는 관계부터.', '서로의 선택을 존중하는 연결을 생각합니다.'], img: 'story-08', pos: 'top', focus: 'center center' },
  { no: '09', label: '이제, 당신의 이야기', title: ['어떤 사람을', '만나고 싶으세요?'], body: ['친구가 필요한지, 새로운 관계를 원하는지.', '지금의 내 마음에 맞는 목적부터 고르세요.'], img: 'story-09', pos: 'top', focus: 'center bottom' },
];

// 웹 설치하기: 방법은 이용 안내(설치 항목)와 같은 문장 하나를 함께 쓴다(두 곳이 어긋나지 않게).
const INSTALL = GUIDE_SECTIONS.find((s) => s.id === 'install');
const INSTALL_WAYS = (INSTALL?.points ?? []).map((p) => { const [who, how] = p.split(' — '); return { who, how: how ?? '' }; });

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

// 「모바일로 시작하기」: 컴퓨터에서는 앱으로 바로 넘기지 않고 웹 설치하기의 QR 로(휴대폰으로 시작) — 기존 홈페이지와 같은 규칙.
const goStart = (event: MouseEvent<HTMLAnchorElement>) => {
  if (!matches(DESKTOP_QUERY)) return;
  const qr = document.getElementById('bh-start-qr');
  // Codex PR #130 P2: QR 그림이 없는 빌드(QA 등 운영 외 앱 주소)에서는 막지 않는다 — 버튼이 그대로 앱 주소로 간다.
  if (!qr || !qr.querySelector('img')) return;
  event.preventDefault();
  qr.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
};

export default function BrandHomePage() {
  const rootRef = useDepthReveal();
  const { user, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const productionApp = APP_ORIGIN === 'https://app.do-it.company';
  const appHost = APP_ORIGIN.replace('https://', '');

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const close = () => setMenuOpen(false);
  const [layer, setLayer] = useState<Layer | null>(null);
  const layerOpener = useRef<HTMLElement | null>(null);
  const closeLayer = useCallback(() => setLayer(null), []);
  // 연 단추를 상태를 바꾸기 전에 잡아 둔다 — 메뉴에서 열면 메뉴 항목이 사라지므로 메뉴 단추로 돌아간다(Codex PR #130 P2)
  // Codex PR #130 P2: Safari 는 눌러도 단추에 초점을 주지 않으므로 activeElement 대신 누른 단추(currentTarget)를 받는다
  const openLayer = (next: Layer, trigger?: HTMLElement | null) => { layerOpener.current = menuOpen ? menuBtnRef.current : (trigger ?? (document.activeElement as HTMLElement | null)); close(); setLayer(next); };

  const renderLayer = (l: Layer) => {
    if (l.kind === 'story') {
      const s = STORIES[l.i];
      const go = (d: number) => setLayer({ kind: 'story', i: (l.i + d + STORIES.length) % STORIES.length });
      return (
        <SceneLayer opener={layerOpener.current} label={`${s.no} ${s.label}`} image={`/brand/stories/${s.img}.webp`} focus={s.focus} onClose={closeLayer}
          footer={<><button type="button" className="bh-layer-nav" onClick={() => go(-1)}><span aria-hidden="true">←</span> 이전 장면</button><span className="bh-layer-count">{s.no} / 09</span><button type="button" className="bh-layer-nav" onClick={() => go(1)}>다음 장면 <span aria-hidden="true">→</span></button></>}>
          <p className="bh-kicker">{s.no} — {s.label}</p>
          <h2 className="bh-title">{s.title[0]}<br />{s.title[1]}</h2>
          <p className="bh-lead">{s.body[0]}<br />{s.body[1]}</p>
        </SceneLayer>
      );
    }
    if (l.kind === 'film') return (
      <SceneLayer opener={layerOpener.current} label={BRAND_FILM_COPY.title} onClose={closeLayer}>
        <p className="bh-kicker">BRAND FILM</p>
        <h2 className="bh-title">{BRAND_FILM_COPY.title}</h2>
        <BrandFilm />
      </SceneLayer>
    );
    if (l.kind === 'company') return (
      <SceneLayer opener={layerOpener.current} label="회사 소개" image="/brand/stories/story-03.webp" focus="center 74%" onClose={closeLayer}>
        <p className="bh-kicker">COMPANY</p>
        <h2 className="bh-title bh-title--wide">DO IT COMPANY</h2>
        <p className="bh-lead">{BRAND_HOME_COPY.companyLead[0]}<br />{BRAND_HOME_COPY.companyLead[1]}</p>
        <dl className="bh-rows">
          <div><dt>서비스</dt><dd><a href={appUrl('/')}>{appHost}<span aria-hidden="true">↗</span></a></dd></div>
          <div><dt>문의</dt><dd><a href="mailto:0423doit@gmail.com">0423doit@gmail.com<span aria-hidden="true">↗</span></a></dd></div>
          <div className="bh-rows-links"><dd><a href="/legal/terms">이용약관<span aria-hidden="true">›</span></a></dd><dd><a href="/legal/privacy">개인정보처리방침<span aria-hidden="true">›</span></a></dd></div>
        </dl>
      </SceneLayer>
    );
    return (
      <SceneLayer opener={layerOpener.current} label="대표 인사말" image="/brand/stories/story-06.webp" focus="center 78%" onClose={closeLayer}>
        <p className="bh-kicker">대표 인사말</p>
        <h2 className="bh-title bh-title--greeting">{GREETING_TITLE}</h2>
        <div className="bh-greeting-body">
          {GREETING.map((line) => <p key={line}>{line}</p>)}
          <p className="bh-greeting-closing">{GREETING_CLOSING[0]}<br />{GREETING_CLOSING[1]}</p>
        </div>
        <span className="bh-rule" aria-hidden="true" />
        <p className="bh-sign">대표 <strong>박진욱</strong></p>
      </SceneLayer>
    );
  };

  return (
    <main ref={rootRef} className="bh">
      <a className="bh-skip" href="#bh-story">이야기로 바로가기</a>
      <header className="bh-nav">
        {/* 왼쪽 위: 회사 슬로건을 빛나는 점 글자로 작게(2026-10-05 대표 「두번째 이미지처럼 점박으로 · 크게 말고 비율에 맞게 왼쪽 윗상단」) */}
        <p className="bh-stamp"><DotText text="JUST TRY." className="bh-dots" /></p>
        <button ref={menuBtnRef} type="button" className="bh-menu-btn" aria-expanded={menuOpen} aria-controls="bh-menu" onClick={() => setMenuOpen((v) => !v)}>
          <span className="bh-sr">{menuOpen ? '메뉴 닫기' : '메뉴 열기'}</span><i aria-hidden="true" /><i aria-hidden="true" />
        </button>
        {menuOpen && (
          <nav id="bh-menu" className="bh-menu" aria-label="홈페이지 메뉴">
            <a href="#bh-story" onClick={close}>이야기</a>
            <a href="#bh-making" onClick={close}>제작 과정</a>
            <a href="#bh-install" onClick={close}>{BRAND_HOME_COPY.install}</a>
            <button type="button" onClick={(e) => openLayer({ kind: 'film' }, e.currentTarget)}>브랜드 영상</button>
            <button type="button" onClick={(e) => openLayer({ kind: 'company' }, e.currentTarget)}>회사 소개</button>
            <button type="button" onClick={(e) => openLayer({ kind: 'greeting' }, e.currentTarget)}>대표 인사말</button>
            <button type="button" onClick={() => { close(); openGuide(undefined, menuBtnRef.current); }}>이용 안내</button>
            {!loading && user
              ? <button type="button" onClick={() => { close(); void signOut(); }}>로그아웃</button>
              : <a href={appUrl('/login')}>로그인 <span aria-hidden="true">↗</span></a>}
          </nav>
        )}
      </header>

      {/* 1. 히어로: 대표가 준 지구 그림 위에 시안 첫 화면 그대로(버튼 글자만 「모바일로 시작하기」) */}
      <section className="bh-sec bh-hero" aria-labelledby="bh-hero-title">
        <div className="bh-stars" aria-hidden="true" />
        <img className="bh-earth" src="/brand/hero-earth.webp" alt="" aria-hidden="true" width="1206" height="1150" fetchPriority="high" decoding="async" draggable="false" />
        <div className="bh-hero-copy">
          <p className="bh-eyebrow">{BRAND_HOME_COPY.eyebrow}</p>
          {/* 2026-10-05 대표 「폰트 브랜드 이미지 이걸로 박아」: 접힌 종이 DOIT 글자 = 공식 원본 그림(doit-earth-original.png)에서 글자만 오려 낸 것 · 다시 그리지 않음 */}
          <h1 className="bh-wordmark"><span className="bh-sr">DO IT</span><img src="/brand/doit-wordmark.webp" alt="" aria-hidden="true" width="994" height="265" fetchPriority="high" decoding="async" draggable="false" /></h1>
          <span className="bh-rule" aria-hidden="true" />
          <p id="bh-hero-title" className="bh-hero-title">{BRAND_HOME_COPY.heroTitle[0]}<br />{BRAND_HOME_COPY.heroTitle[1]}</p>
          <p className="bh-hero-line">{BRAND_HOME_COPY.heroLine[0]}<br />{BRAND_HOME_COPY.heroLine[1]}</p>
          <a className="bh-btn bh-btn--start" href={appUrl(START_PATH)} onClick={goStart}>{BRAND_HOME_COPY.start}<span aria-hidden="true">→</span></a>
          <p className="bh-hero-note">{BRAND_HOME_COPY.heroNote}</p>
        </div>
      </section>

      {/* 2. 이야기: 9장면을 한 화면에 사진 칸으로 · 누르면 그 장면이 화면 가득 열린다 */}
      <section className="bh-sec bh-photo bh-story" id="bh-story" aria-labelledby="bh-story-title" data-depth>
        <img className="bh-bg" src="/brand/stories/story-02.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" width="941" height="1672" style={{ objectPosition: '70% center' }} />
        <div className="bh-content">
          <p className="bh-kicker">ECHO STORY</p>
          <h2 id="bh-story-title" className="bh-title">{BRAND_HOME_COPY.storyTitle[0]}<br />{BRAND_HOME_COPY.storyTitle[1]}</h2>
          <p className="bh-lead">{BRAND_HOME_COPY.storyLead}</p>
          <ol className="bh-tiles">
            {STORIES.map((s, i) => (
              <li key={s.no}>
                <button type="button" className="bh-tile" onClick={(e) => openLayer({ kind: 'story', i }, e.currentTarget)}>
                  <img src={`/brand/stories/${s.img}.webp`} alt="" aria-hidden="true" loading="lazy" decoding="async" width="941" height="1672" style={{ objectPosition: s.focus }} />
                  <span className="bh-tile-no">{s.no}</span>
                  <span className="bh-tile-label">{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="bh-scope">{BRAND_HOME_COPY.scope}</p>
        </div>
      </section>

      {/* 3. 제작 과정(2026-10-05 대표 「동영상 제작과정이라고 홈페이지 안에 그대로 박아」) */}
      <section className="bh-sec bh-film-sec bh-making" id="bh-making" aria-labelledby="bh-making-title" data-depth>
        <div className="bh-stars" aria-hidden="true" />
        <div className="bh-content">
          <p className="bh-kicker">MAKING FILM</p>
          <h2 id="bh-making-title" className="bh-title">{MAKING_FILM_COPY.title}</h2>
          <MakingFilm />
        </div>
      </section>

      {/* 4. 웹 설치하기: 홈 화면에 ECHO 아이콘이 놓이는 모습 + 휴대폰별 방법 · 컴퓨터에서는 QR. 버튼 없음. */}
      <section className="bh-sec bh-photo bh-install" id="bh-install" aria-labelledby="bh-install-title" data-depth>
        <img className="bh-bg" src="/brand/stories/story-07.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" width="941" height="1672" />
        <div className="bh-content">
          <p className="bh-kicker">WEB INSTALL</p>
          <h2 id="bh-install-title" className="bh-title">{INSTALL?.title ?? '홈 화면에서 바로 시작하세요.'}</h2>
          <p className="bh-lead">앱 스토어에 가지 않아도 돼요. 브라우저에서 홈 화면에 두면 앱처럼 한 번에 열려요.</p>
          <div className="bh-home" aria-hidden="true">
            <div className="bh-home-screen">
              {Array.from({ length: 11 }, (_, i) => <span key={i} className="bh-home-app" />)}
              <span className="bh-home-echo"><img src="/pwa/echo-icon-192.png" alt="" width="192" height="192" /><em>ECHO</em></span>
            </div>
          </div>
          <ol className="bh-ways">
            {INSTALL_WAYS.map((w) => <li key={w.who}><strong>{w.who}</strong><span>{w.how}</span></li>)}
          </ol>
          <p className="bh-install-note">설치하지 않아도 웹에서 그대로 쓸 수 있어요. 앱 주소는 <strong>{appHost}</strong></p>
          <div className="bh-qr" id="bh-start-qr">
            {productionApp && <img src="/brand/app-qr.svg" width="132" height="132" alt="app.do-it.company 로 가는 QR 코드" />}
            <div>
              <p className="bh-qr-title">{productionApp ? '휴대폰 카메라로 비춰 보세요.' : '휴대폰에서 앱 주소를 열어 보세요.'}</p>
              <p>주소는 <strong><a href={appUrl('/')}>{APP_ORIGIN}</a></strong></p>
            </div>
          </div>
        </div>
      </section>

      {/* 더 알아보기(2026-10-05 대표 「나머지는 버튼 누르면」): 브랜드 영상 · 회사 소개 · 대표 인사말 — 누르면 화면 가득 열린다 */}
      <nav className="bh-more" aria-label="더 알아보기">
        <p className="bh-kicker">MORE</p>
        <ul>
          <li><button type="button" className="bh-tile bh-tile--wide" onClick={(e) => openLayer({ kind: 'film' }, e.currentTarget)}><img src="/brand/film/poster-portrait.jpg" alt="" aria-hidden="true" loading="lazy" decoding="async" /><span className="bh-tile-no">25초</span><span className="bh-tile-label">브랜드 영상</span></button></li>
          <li><button type="button" className="bh-tile bh-tile--wide" onClick={(e) => openLayer({ kind: 'company' }, e.currentTarget)}><img src="/brand/stories/story-03.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ objectPosition: 'center 74%' }} /><span className="bh-tile-no">DO IT</span><span className="bh-tile-label">회사 소개</span></button></li>
          <li><button type="button" className="bh-tile bh-tile--wide" onClick={(e) => openLayer({ kind: 'greeting' }, e.currentTarget)}><img src="/brand/stories/story-06.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ objectPosition: 'center 78%' }} /><span className="bh-tile-no">CEO</span><span className="bh-tile-label">대표 인사말</span></button></li>
        </ul>
      </nav>

      <footer className="bh-legal">
        <details><summary>DO IT COMPANY · 사업자 정보</summary><p>두잇(DO IT) · 대표 박진욱</p><p>사업자등록번호 121-46-51503 · 통신판매업 신고 제 2026-다산-0583호</p><p>경기도 남양주시 강변북로632번길 41-7, 102동 101호(수석동)</p></details>
        <p><button type="button" className="bh-legal-link" onClick={() => openGuide()}>이용 안내</button> · <a href="/legal/terms">이용약관</a> · <a href="/legal/privacy">개인정보처리방침</a> · <a href="mailto:0423doit@gmail.com">문의 · 0423doit@gmail.com</a></p>
        <p>© 2026 DO IT COMPANY</p>
      </footer>
      {layer && renderLayer(layer)}
      {/* 이용 안내 창(검정·흰색·은색). 설치는 앱 주소에서만 — 이 회사 홈페이지를 설치하게 하지 않는다. */}
      <GuideHost theme="brand" extra={{ install: <p className="bh-guide-install">설치는 앱 주소({appHost})에서 해요. 이 회사 홈페이지는 설치하지 않아도 돼요. <a href={appUrl(INSTALL_PATH)}>앱 주소에서 설치하기<span aria-hidden="true">↗</span></a></p> }} />
    </main>
  );
}
