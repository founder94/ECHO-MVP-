// 2026-10-04 대표 「홈페이지·모바일 디자인 교체」 — 소스 규칙 검사(모의 · 실제 렌더·실기기 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const execSyncList = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? execSyncList(p) : /\.(tsx?|css)$/.test(n) ? [p] : []; });

const read = (f) => readFileSync(f, 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const HOME = read('src/pages/do-it/brand-home/page.tsx');
const HCSS = read('src/pages/do-it/brand-home/brand-home.css');
// 2026-10-08 대표: 「GetLayers 구매 코드(Vesper · Solaris · Einstein–Rosen) 그대로 · 색·글씨체·3D 그대로 · 거기에 글만 넣어 · 온보딩 유지」 → 2026-10-05 「4장·지구 그림·보라 0」 잠금 해제.
const COPY = read('src/pages/do-it/brand-home/copy.ts');
const V = (f) => read(`src/vesper/${f}`);
const STAGE = V('views/home/scroll-stage.tsx');
const HERO = V('views/home/hero/hero.tsx');
const GALAXY = V('views/home/section-galaxy.tsx');
const FOOT = V('views/home/sections/site-footer.tsx');
const MOCK = V('data/mocks/home.ts');
const HEADER = V('components/common/site-header.tsx');
const MNAV = V('components/common/mobile-nav.tsx');
const SEND = V('views/home/send-request.tsx');

test('홈페이지(2026-10-09 대표 「최신 채택안」): 데스크톱 = 원본 Vesper 문서(격자 배경 + 구슬 → 은하 → 뇌 → 흰 카드(어떻게 만나나요?) → FAQ → Solaris → Onyx → 바닥글) · 1024px 미만 = 모바일 세로 배치(① 첫 화면 ② 이용 방법 ③ 짧은 브랜드 연출 ④ 서로의 선택 ⑤ FAQ + 시작 버튼 + 바닥글) · 온보딩은 그대로', () => {
  for (const t of ["from '@vesper/layouts/scroll-layout'", "from '@vesper/components/common/site-header'", "from '@vesper/views/home'", "<AdaptiveGrid />", "<ReducedMotion />", "import '@vesper/vesper.css'"]) assert.ok(HOME.includes(t), t);
  assert.match(HOME, /document\.documentElement\.classList\.add\('vesper'\)/, '원본 루트 글자 크기·바탕색은 홈페이지가 열려 있을 때만');
  assert.match(HOME, /return \(\) => document\.documentElement\.classList\.remove\('vesper'\)/);
  assert.doesNotMatch(HOME, /setAttribute\('lang'/, '글이 한글이라 문서 언어는 index.html 의 ko 그대로');
  const at = (s) => STAGE.indexOf(s);
  const order = ['<SectionGalaxy />', '<SectionBrain />', '<HydrateNear id="financial">', '<HydrateNear id="faq">', '<HydrateNear id="solaris">', '<HydrateNear id="onyx">', '<HydrateNear id="contact">', '{!robot && <HeroLattice />}', '<Hero introStarted={introStarted} />'].map(at);
  order.forEach((v, i) => assert.ok(v > 0, String(i)));
  assert.deepEqual([...order].sort((a, b) => a - b), order, '데스크톱 순서');
  assert.match(STAGE, /const mobile = useWindowWidth\(\) < MOBILE_MAX_WIDTH;/, '1024 미만 = 모바일 문서');
  assert.match(STAGE, /\{robot \? <SceneStill \/> : <SceneHostLazy \/>\}\n\s*\{!robot && <Loader copy=\{loader\} onReady=\{handleReady\} \/>\}\n[\s\S]{0,400}\{!robot && <HeroLattice \/>\}\n\s*\{mobile \? \(\n\s*<MobileStage/, '장면 캔버스·로더·격자는 한 벌(Codex 12차), 문서만 둘');
  assert.doesNotMatch(V('views/home/mobile-stage.tsx'), /HeroLattice/, '격자는 모바일 문서 안에 따로 없음');
  assert.match(V('components/common/hydrate-near.tsx'), /const dropPendingGate = \(id: string\) => \{/, '열리지 않은 문은 자리표가 내려가면 버림(Codex 12차 P1)');
  assert.match(V('utils/scroll-to.ts'), /const target = document\.getElementById\(id\) \?\? el;/, '해시 이동은 50ms 뒤 다시 찾음(Codex 12차)');
  assert.match(V('views/home/scene/deferred-mount.tsx'), /if \(mine !== generation\) return;/, '지연 마운트 idle 콜백은 세대가 다르면 무시(Codex 13차)');
  assert.match(V('layouts/scroll-layout.tsx'), /lenis\.destroy\(\);\n\s*setLenis\(null\);\n[\s\S]{0,200}useScroll\.getState\(\)\.start\(\);\n\s*enableNativeScroll\(true\);/, '떠날 때 전역 스크롤 복구(Codex 13차)');
  assert.match(HEADER, /href=\{TOP_PATH\}/, '로고도 #top'); assert.match(MNAV, /href=\{TOP_PATH\}/);
  assert.match(STAGE, /<div id="how" ref=\{outroRef\} className="mb-\[1\.667vw\]">\n\s*<Suspense fallback=\{null\}>\n\s*<HydrateNear id="financial">\n\s*<FinancialSection \/>/, '원본: 흰 카드가 떠오르며 뇌의 퇴장을 끈다');
  assert.match(STAGE, /style=\{\{ height: toLvh\(1\) \}\}/, '데스크톱 트랙(200lvh) 숫자 그대로');
  // 모바일 문서
  const M = V('views/home/mobile-stage.tsx');
  const mOrder = ['<HeroMobile introStarted={introStarted} />', '<HydrateNear id="how">', '<AgentScene trackRef={trackRef} />', '<HydrateNear id="choice">', '<HydrateNear id="faq">', '<HydrateNear id="contact">'].map((s) => M.indexOf(s));
  mOrder.forEach((v, i) => assert.ok(v > 0, `mobile ${i}`)); assert.deepEqual([...mOrder].sort((a, b) => a - b), mOrder, '모바일 순서');
  assert.doesNotMatch(M, /toLvh|SectionBrain|SectionGalaxy|setOutro/, '모바일은 원본 200lvh 트랙·뇌 장면·고정 겹 그림을 쓰지 않음');
  assert.match(M, /sceneTimeline\.setTrack\(0, progress\);\n\s*sceneTimeline\.setTrack\(1, progress\);/, '③ 구간 하나가 장면 시계 0→2(구체 → 은하)');
  assert.match(M, /id="hero"[\s\S]*min-h-\[100lvh\] flex-col justify-end/, '① 첫 화면: 제목·설명·버튼이 한 화면(min-height · 세로로 늘어남)');
  assert.match(M, /text-\[clamp\(36px,9vw,52px\)\] leading-\[1\.15\] font-normal break-keep/, '모바일 제목 clamp(36px, 9vw, 52px) · 400(주아체 한 굵기) · 행간 1.15');
  assert.match(M, /text-\[16px\] leading-\[1\.55\] break-keep/, '모바일 본문 16px/1.55');
  assert.match(M, /px-6 max-\[360px\]:px-5/, '좌우 여백 24px · 360px 이하 20px');
  assert.match(M, /min-h-\[48px\]/, '버튼 터치 영역 48px');
  assert.match(SEND, /min-h-\[48px\]/, '주요 버튼 48px');
  assert.match(V('views/home/sections/financial-section.tsx'), /<section id="financial"/, '블록 자체는 #financial(자리표와 같은 id) — #how 는 항상 마운트된 바깥 틀(Codex 13차 P1)');
  assert.match(V('views/home/loader/loader.tsx'), /<StarFall intensity=\{intensity\} \/>/, '원본 로더의 별 줄기 그대로');
  assert.match(V('views/home/loader/star-fall.tsx'), /const paused = pageMotionPaused\(\);\n\s*if \(paused && stillDrawn\) return;/, '별 줄기도 움직임 줄이기면 한 장(Codex 10차)');
  const onyx = V('views/home/sections/onyx-section.tsx');
  assert.match(onyx, /touch-pan-y/, 'Onyx 캔버스 위에서도 세로 스크롤(Codex 8차 P1)'); assert.doesNotMatch(onyx, /touch-none/);
  assert.match(onyx, /if \(!inside && !grabbed\) \{ pointerInside = false; ndc\.set\(0, 0\); return; \}/, 'Onyx 구간 밖 포인터 무시(Codex 8차) + 카메라 중립(14차)');
  assert.match(FOOT, /id="contact"/, '바닥글 id(Codex 9차)');
  assert.match(V('views/home/hero/hero-lattice.tsx'), /window\.addEventListener\('pointerdown', onDown/, '격자 누름은 window 에서(Codex 7차)');
  assert.match(MNAV, /window\.matchMedia\("\(min-width: 1024px\)"\)/, '메뉴 열린 채 넓어지면 닫힘(Codex 6차)');
  assert.match(MNAV, /const samePage = !path \|\| path === pathname;/, '해시만 있는 링크는 같은 페이지(브랜드 홈은 /do-it/landing)');
  assert.match(V('views/home/scene/deferred-mount.tsx'), /if \(mounted <= 0\) \{\n\s*mounted = 0;\n\s*next = 0;\n\s*waiting\.clear\(\);/, '장면 재마운트 시 지연 마운트 줄 초기화(Codex 11차)');
  assert.match(V('views/home/section-brain.tsx'), /hidden max-lg:block bg-\[linear-gradient\(180deg,rgba\(0,0,0,0\)_0%,rgba\(0,0,0,0\.72\)/, '휴대폰 뇌 장면: 글 뒤 어두운 막');
  const sol = V('views/home/sections/solaris-section.tsx');
  assert.match(sol, /top-0 h-\[34vh\] bg-gradient-to-b from-black via-black\/70 to-transparent/, 'Solaris 위를 검정으로 녹임(선 0)');
  const hl = V('views/home/hero/hero-lattice.tsx');
  assert.match(hl, /fixed inset-x-0 top-0 z-\[5\] h-lvh mix-blend-screen/, '격자 = 첫 화면 배경');
  assert.match(hl, /const heroOpacity = \(clock: number\) => LATTICE_STRENGTH \* \(1 - Math\.min\(Math\.max\(\(clock - 0\.08\) \/ 0\.2, 0\), 1\)\);/);
  for (const f of ['src/pages/do-it/brand-home/SceneLayer.tsx', 'src/pages/do-it/brand-home/DotText.tsx', 'src/pages/do-it/brand-home/BrandFilm.tsx', 'public/brand/film', 'public/brand/hero-earth.webp', 'src/vesper/views/home/sections/lattice-section.tsx']) assert.ok(!existsSync(f), `${f} 삭제`);
  assert.doesNotMatch(HOME, /SceneLayer|DotText|hero-earth|BrandFilm/, '옛 홈페이지 조각 0');
  // 온보딩(인트로)은 손대지 않음: 루트 → 인트로 → 홈페이지 그대로.
  const entry = read('src/pages/do-it/intro/DoItEntry.tsx');
  assert.doesNotMatch(entry, /vesper|scene_hero/i);
  assert.match(read('src/router/config.tsx'), /\{ path: '\/do-it\/intro', element: <DoItIntroPage \/> \}/);
});
test('홈페이지 글(2026-10-09 대표 「최신 채택안」): 첫 화면 「당신이 잠든 사이」 · 설명 · 선택권 안내 · 「ECHO 시작하기」 · 「어떻게 만나나요?」 원문 그대로 · 설명·FAQ 는 이용 안내 승인 문장만 · 템플릿 숫자·Vesper 문구 0 · 한글 행간 1.15/1.55', () => {
  for (const t of ["heroTitle: '당신이 잠든 사이'", "heroDesc: 'ECHO Agent와 함께 나에게 맞는 만남을 알아가는 온라인 자만추.'", "heroChoice: '관계의 시작은 서로가 선택합니다.'", "start: 'ECHO 시작하기'", "how: '어떻게 만나나요?'", "export const START_PATH = '/doit/start-journey';", "export const HOW_PATH = '#how';"]) assert.ok(COPY.includes(t), t);
  assert.match(COPY, /HOME_FAQ = \{[\s\S]*\(\['talk', 'check', 'choice', 'zzarit'\] as const\)/, 'FAQ = 이용 안내 승인 문장');
  assert.match(COPY, /howLead: guideSection\('start'\)\.body,\n\s*howSteps: guideSection\('start'\)\.points/, '이용 방법 = 이용 안내 「처음이라면」');
  assert.match(HERO, /const TITLE = HOME_V2\.heroTitle;\nconst TAGLINE = HOME_V2\.heroChoice;\nconst SUPPORT = HOME_V2\.heroDesc;\nconst TAGS = HOME_V2\.tags;/, '데스크톱 원본 글 칸에 ECHO 문구');
  assert.match(HERO, /leading-\[1\.15\] font-normal break-keep/, '한글 제목 행간 1.15'); assert.match(HERO, /leading-\[1\.55\] break-keep/, '한글 본문 행간 1.55');
  assert.match(HERO, /href=\{HOW_PATH\}[\s\S]*\{HOME_V2\.how\}/, '보조 버튼 → #how');
  assert.match(GALAXY, /\{ value: "01", label: HOME_V2\.steps\[0\]/, '은하 네 칸 = 이용 안내 항목(91k 등 템플릿 숫자 0)');
  assert.match(V('views/home/section-brain.tsx'), /const TITLE_LEFT = HOME_V2\.brainLeft\.join\(" "\);/);
  const fin = V('views/home/sections/financial-section.tsx');
  assert.match(fin, /const TITLE = HOME_V2\.howTitle;/); assert.match(fin, /src="\/brand\/stories\/story-09\.webp"/, '사진 칸 = 승인 브랜드 그림(실제 ECHO 화면은 자료 미확보)');
  for (const [n, s] of [['header', HEADER], ['mobile-nav', MNAV], ['send-request', SEND]]) { assert.match(s, /href=\{appUrl\(START_PATH\)\}/, `${n} 시작 주소`); assert.match(s, /\{HOME_V2\.start\}/, `${n} 시작 글자`); }
  assert.match(HEADER, /const NAV = HOME_V2\.nav;/);
  assert.match(FOOT, /const TITLE = HOME_V2\.footerTitle;/); assert.doesNotMatch(FOOT, /<form|<input/, '보내지 않는 연락 폼 0 → 마지막 시작 버튼 + 이용 안내');
  assert.match(FOOT, /onClick=\{\(\) => openGuide\(\)\}/);
  assert.match(MOCK, /brand: "DO IT",/); assert.match(MOCK, /heading: "ECHO", links: \[/); assert.match(MOCK, /heading: "회사", links: \[/);
  assert.match(read('src/vesper/views/home.tsx'), /faq=\{HOME_FAQ\}/);
  // mocks/home.ts 의 원본 자료(homeSections·homeOutro·homeFaq)는 화면에 안 쓰므로 템플릿 문구 검사에서 뺀다(로더·바닥글만 따로 검사).
  const vendored = ['views/home/hero/hero.tsx', 'views/home/section-galaxy.tsx', 'views/home/section-brain.tsx', 'views/home/sections/solaris-section.tsx', 'views/home/sections/financial-section.tsx', 'views/home/sections/site-footer.tsx', 'views/home/mobile-stage.tsx', 'components/common/site-header.tsx', 'components/common/mobile-nav.tsx', 'views/home/send-request.tsx'].map(V).join('\n');
  const visible = noComments(vendored).replace(/^\s*import .*$/gm, '').replace(/@vesper\//g, '');
  assert.doesNotMatch(visible, /91k|Send Request|Contact Us|Frequently asked|living interface|Motion instead of chrome|Reads presence/i, '템플릿 문구·숫자 0(원본 자료 homeSections·homeFaq 는 화면에 안 씀)');
  assert.doesNotMatch(noComments(vendored + COPY), /데이팅|소개팅|궁합|점술|심리치료|성격검사|Stripe|9,900|4,900/, '금지어·옛 가격 0');
  assert.doesNotMatch(noComments(vendored + COPY), /야간 자동|매칭 완료|만남을 보장|보장합니다/, '확인되지 않은 기능 문구 0');
});
test('홈페이지: 대표 인사말 승인 원문은 brandGreeting.ts 에 그대로(10/9 이야기 카드 삭제로 홈페이지엔 없음 · 시안 제안 문구 0) · 법적 고지·문의 보존', () => {
  assert.match(read('src/pages/do-it/landing/components/brandGreeting.ts'), /GREETING_TITLE = 'DO IT은 제가 직접 겪은 경험에서 시작됐습니다\.'/);
  assert.doesNotMatch(MOCK, /GREETING/, '인사말 칸 0(대표 10/9)'); assert.doesNotMatch(STAGE + MOCK, /GREETING|brandGreeting/, '옛 인사말 카드 0');
  assert.ok(!(MOCK + COPY + FOOT).includes('기술보다 먼저'), '시안의 제안 인사말은 넣지 않음(대표 확인 대기)');
  for (const t of ["registration: '사업자등록번호 121-46-51503 · 통신판매업 신고 제 2026-다산-0583호'", "email: '0423doit@gmail.com'", "company: '두잇(DO IT) · 대표 박진욱'"]) assert.ok(COPY.includes(t), t);
  for (const t of ['href="/legal/terms"', 'href="/legal/privacy"', 'href={`mailto:${LEGAL.email}`}', '{LEGAL.company} · {LEGAL.registration}', '{LEGAL.address}', '{LEGAL.copyright}']) assert.ok(FOOT.includes(t), t);
});
test('홈페이지 색·3D(2026-10-08 대표 「색도 3D 효과도 코드 그대로」· 글씨체만 2026-10-09 주아체로): 원본 보라 #170a2b·민트 · Solaris·격자 원본 색 · 움직임 줄이기는 원본 장치 그대로', () => {
  const css = V('vesper.css');
  assert.match(css, /--background: #170a2b;/, '원본 바탕색(10/5 「보라 0」 잠금은 10/8 대표가 해제)');
  assert.match(css, /--signal: #6cf3a3;/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /General Sans|GeneralSans|Onest'|Mulish'/, '옛 글꼴 선언 0(2026-10-09 주아체 하나)');
  assert.match(css, /--font-general-sans: 'Jua';/); assert.match(css, /font-synthesis: none;/, '가짜 굵기·기울임 0');
  assert.match(css, /html\.vesper \{/, '루트 글자 크기 사다리는 html.vesper 안에서만(전역 index.css 수정 0)');
  assert.doesNotMatch(read('index.html'), /fonts\.googleapis\.com/, '구글 글꼴 링크 0(주아체는 저장소 안 파일)');
  const sol = V('views/home/sections/solaris-section.tsx');
  assert.match(sol, /colorWarm: "#ff4c33",\n\s*colorCool: "#3366ff",/, 'Solaris 원본 색 그대로');
  const lat = V('views/home/hero/lattice-shaders.ts') + V('views/home/hero/hero-lattice.tsx');
  assert.match(lat, /lineColor: '#eef3ff', throatTint: '#ffd9a6', rimTint: '#5878ff', glowColor: '#8fb4ff'/, '격자(Einstein–Rosen) 원본 색 그대로');
  const onyx = V('views/home/sections/onyx-section.tsx');
  assert.match(onyx, /bgTop: '#fbfcfd', bgBottom: '#cfd4db', cubeColor: '#0b0c10', envTint: '#191b21', exposure: 1\.0,/, 'Onyx Cubes 원본 색 그대로(2026-10-09 대표 「이것도 추가로 · 코드 준 대로」)');
  assert.match(onyx, /cubeCount: 12, cubeSize: 1\.05, sizeVar: 0\.32, cornerR: 0\.1, spawnSpread: 2\.6,/, 'Onyx 원본 수치 그대로');
  assert.match(onyx, /import \* as CANNON from "cannon-es";/, 'Onyx 물리 = 원본과 같은 cannon-es(묶음)');
  assert.match(onyx, /world\.step\(1 \/ 120, dt, 4\);/, 'Onyx 원본 물리 걸음');
  assert.match(onyx, /new PointToPointConstraint|CANNON\.PointToPointConstraint/, 'Onyx 원본 잡기(드래그) 그대로');
  assert.match(V('components/common/reduced-motion.tsx'), /useReducedMotion\(\)/, '움직임 줄이기 = 원본 장치(react-spring 전역 skip)');
  assert.match(V('hooks/animation/use-motion-off.ts'), /prefers-reduced-motion/, '원본 장면·회전 표시도 움직임 줄이기를 읽음');
  // 3D 는 묶음(three 0.186 · @react-three/fiber) — CDN·외부 스크립트 0, 이 기기 저장(localStorage) 0.
  const all = execSyncList('src/vesper').map(read).join('\n');
  assert.doesNotMatch(noComments(all), /cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare|localStorage|sessionStorage|document\.cookie/, '외부 스크립트·기기 저장 0');
  assert.ok(all.includes('from "three"'), '3D = 묶음 three');
});
test('라우터: 새 홈페이지는 brand 빌드에서만(앱·통합 빌드 영향 0)', () => {
  const r = read('src/router/config.tsx');
  assert.match(r, /BrandHomePage \? <BrandHomePage \/> : <DoItLandingPage \/>/);
  assert.match(r, /const BrandHomePage = import\.meta\.env\.VITE_SITE_ROLE === 'brand' \? lazy\(\(\) => import\('@\/pages\/do-it\/brand-home\/page'\)\) : null;/, 'brand 빌드에서만 홈페이지 조각(app 빌드 0 · Codex PR #123)');
});

test('모바일: 정정 네 버튼 · 「이렇게 이해했는데, 맞나요?」 · 시작 문구 · 대기 문구', () => {
  const c = read('src/doit/components/feature/AgentProfileCheck.tsx');
  const order = ['>맞아요<', '>조금 달라요<', '>그게 아니에요<', '>직접 설명할게요<'].map((t) => c.indexOf(t));
  order.forEach((v) => assert.ok(v > 0)); assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(c, /CHECK_TITLE = '이렇게 이해했는데, 맞나요\?'/);
  assert.match(read('src/doit/components/feature/ConversationOpening.tsx'), /같이 하고 싶은 일이<br \/>있나요\?/);
  assert.match(read('src/doit/components/feature/ConnectionCandidates.tsx'), /선택을 보냈어요\. 상대도 선택하면 알려드릴게요\./);
});

test('KEY: 둥근 고리 · 줄기 · 톱니가 있는 열쇠 아이콘 · 잔액·차감은 다루지 않음(서버 정책 없음 = 쓰는 기능 잠김)', () => {
  const k = read('src/doit/components/feature/KeyIcon.tsx');
  assert.match(k, /\{\/\* 고리 \*\/\}\s*<circle/); assert.match(k, /\{\/\* 줄기 \*\/\}\s*<path/); assert.match(k, /\{\/\* 톱니 \*\/\}\s*<path/);
  assert.doesNotMatch(noComments(k), /balance|spend|차감|잔액/);
  assert.match(read('src/doit/lib/releaseScope.ts'), /key/, 'KEY 화면은 여전히 숨김 목록');
});

test('찌릿: 서버 mutual + match_id 뒤에만 · 같은 연결에서 한 번만(기존 계약 그대로)', () => {
  const cand = read('src/doit/components/feature/ConnectionCandidates.tsx');
  assert.match(cand, /if \(typeof out\.match_id === 'string'\) \{ if \(claimZzarit\(out\.match_id\)\) setMutual/);
  assert.ok(cand.indexOf('<ZzaritMoment') > cand.indexOf('if (mutual) return'));
});

test('홈페이지 CTA: 주요 버튼 = 확인된 시작 경로(앱 주소 + /doit/start-journey) · 보조 버튼·메뉴·바닥글 앵커는 해시만(#top·#how·#faq) · 빈 링크 0', () => {
  const vendored = execSyncList('src/vesper').map(read).join('\n');
  assert.ok(!vendored.includes("'/doit/start-journey'") && !vendored.includes('"/doit/start-journey"'), '시작 경로 글자는 copy.ts 에만');
  assert.doesNotMatch(vendored, /href="#"/, '빈 링크 0');
  assert.doesNotMatch(noComments(vendored + COPY), /"\/#|'\/#/, '"/#id" 꼴 링크 0(브랜드 홈은 /do-it/landing 이라 인트로로 되돌아감)');
  assert.match(STAGE, /<main id="top"/); assert.match(V('views/home/mobile-stage.tsx'), /<main id="top"/);
});
test('홈페이지 첫 화면·로더: 원본 Vesper 자리 그대로(글만 ECHO) · 로고 DO IT · 로더 글 ECHO', () => {
  assert.match(HERO, /<SendRequest \/>/, '첫 화면 CTA = 원본 자리');
  assert.match(MOCK, /initializing: "ECHO 를 깨우는 중",\n\s*loading: "장면 불러오는 중",/);
  for (const s of [HEADER, MNAV, FOOT]) assert.match(s, /src="\/brand\/doit-wordmark\.webp"/, '로고 = DO IT');
  assert.doesNotMatch(HEADER + MNAV + FOOT, /\/assets\/hero\/logo\.svg/, 'Vesper 로고 0');
});
test('2026-10-09 Codex 검수(PR #151 · 75c7295) 3건: 아래 블록은 가까이 올 때만 마운트(CSR 자리표) · 움직임 줄이기 · 이용 안내 열림이면 3D 루프 정지', () => {
  const hn = V('components/common/hydrate-near.tsx');
  assert.match(hn, /document\.getElementById\(id\) \?\?\n\s*document\.querySelector\(`\[data-hydrate-near="\$\{id\}"\]`\)/, '자리표도 문이 지켜본다');
  assert.match(hn, /const \[open, setOpen\] = useState\(\n\s*\(\) => typeof window === "undefined" \|\| openedGates\.has\(id\),\n\s*\);/, '효과 기반 문(render 중 use 로 바로 열리지 않음)');
  assert.match(hn, /if \(el && !document\.getElementById\(id\)\) el\.id = id;/, '같은 id 가 없을 때만 자리표가 그 id(해시 이동 유지)');
  assert.match(hn, /data-hydrate-near=\{id\}[\s\S]*className="min-h-lvh w-full"/);
  const pm = V('lib/scene/page-motion.ts');
  assert.match(pm, /prefers-reduced-motion: reduce/);
  assert.match(pm, /classList\.contains\(GUIDE_OPEN_CLASS\)/);
  assert.match(pm, /const GUIDE_OPEN_CLASS = "echo-guide-open";/, 'GuideHost 가 켜는 클래스와 같은 이름');
  assert.match(read('src/components/guide/GuideHost.tsx'), /root\.classList\.add\('echo-guide-open'\)/);
  const fg = V('views/home/scene/frame-gate.tsx');
  assert.match(fg, /if \(pageMotionPaused\(\)\) \{\n\s*const key = `\$\{sceneTimeline\.getProgress\(\)\}\|/, '원본 FrameGate: 멈춤이면 상태(스크롤)가 바뀔 때만 한 장');
  assert.match(fg, /if \(key === stillKey\) return;\n\s*stillKey = key;\n\s*invalidate\(\);\n\s*return;/);
  // 2026-10-09 Codex 2차(f64517b) P2 두 건: 멈춤 상태의 첫 장이 비어 있으면 안 된다.
  assert.match(V('views/home/scene/scene.worker.tsx'), /if \(!message\.running\) drawOnce\(\);/, '워커: 멈춤으로 시작해도 한 장');
  assert.match(V('views/home/scene/scene.worker.tsx'), /message\.type === "frame"\) \{\n\s*drawOnce\(\);/);
  assert.match(V('views/home/scene/scene.worker.tsx'), /if \(running\) advance\(seconds, true, store\.getState\(\)\);\n\s*else drawOnce\(\);/, '멈춤 중 크기 변경 뒤에도 한 장');
  assert.match(V('shims/next-navigation.ts'), /export function usePathname\(\): string \{\n\s*return useLocation\(\)\.pathname;\n\}/, 'usePathname 은 Next 처럼 해시 없이(휴대폰 메뉴 「홈」 = 같은 페이지 → 맨 위로)');
  assert.match(V('lib/scene/intro.ts'), /if \(pageMotionPaused\(\)\) \{\n\s*introValue\.set\(1\);\n\s*return;/, '멈춤이면 등장은 끝 상태로');
  assert.match(V('views/home/scene/scene-host.tsx'), /if \(pausedButShown\) send\(\{ type: "frame" \}\);/, '페이지: 멈춤이라도 상태가 바뀌면 한 장');
  assert.match(V('views/home/sections/solaris-section.tsx'), /if \(paused\) introStart = now - CONFIG\.introSeconds \* 1000;/, 'Solaris 멈춤 장 = 등장 끝난 모습');
  assert.match(V('views/home/hero/hero-lattice.tsx'), /if \(paused\) live\.t0 = Math\.min\(live\.t0, now - CONFIG\.fadeInSeconds\);/, '격자 멈춤 장 = 나타나기 끝난 모습');
  assert.match(V('views/home/scene/scene-host.tsx'), /!document\.hidden && !pageMotionPaused\(\) && getSceneCover\(\) < HANDOFF/, '워커 경로도 같은 문');
  for (const f of ['views/home/sections/solaris-section.tsx', 'views/home/hero/hero-lattice.tsx', 'views/home/sections/onyx-section.tsx']) {
    const src = V(f);
    assert.match(src, /const paused = pageMotionPaused\(\);\n\s*if \(paused && stillDrawn\)/, `${f}: 한 장만 그리고 멈춤`);
    assert.match(src, /stillDrawn = paused;/, f);
    assert.match(src, /stillDrawn = false;\n\s*\};\n\s*window\.addEventListener\("?'?resize/, `${f}: 크기 변경 뒤 멈춤 장 다시`);
  }
});

test('홈페이지 부드러운 굴림(lenis)은 원본 ScrollLayout 안에서만 · 전역 index.css 수정 0 · 앱 빌드 영향 0', () => {
  const layout = V('layouts/scroll-layout.tsx');
  assert.match(layout, /lenis/i, '원본 부드러운 굴림');
  assert.doesNotMatch(read('src/index.css'), /vesper|lenis|\.bh/, '전역 index.css 수정 0');
  assert.match(read('vite.config.ts'), /"@vesper": resolve\(import\.meta\.dirname, "\.\/src\/vesper"\)/);
  assert.match(read('eslint.config.ts'), /ignores: \['dist', 'node_modules', 'src\/vesper\/\*\*'\]/, '구매 코드는 원본 그대로(우리 lint 규칙으로 고치지 않음)');
});
test('모바일 시안 7 선택 대기: 익명 두 노드 + 점선(움직임 0) · 상대가 골랐는지 추정 표시 0', () => {
  const Z = read('src/doit/components/feature/ZzaritMoment.tsx');
  const C = read('src/doit/components/feature/ConnectionCandidates.tsx');
  assert.match(Z, /export function WaitingMark\(\)/);
  assert.match(C, /\? <><WaitingMark \/><p className="doit-connect-note echo-waiting">/, '대기 후보에만');
  const css = read('src/doit/components/feature/zzarit.css');
  assert.match(css, /\.echo-wait-link\{[^}]*border-top:2px dashed/);
  assert.doesNotMatch(css.match(/\.echo-wait[^{]*\{[^}]*\}/g).join(''), /animation/, '대기 표시는 움직임 0');
});

test('모바일 시안 8 찌릿: 연결 카드 안 이중 판 0 · 「다음 단계 보기」가 아래 메뉴에 가리지 않게 화면 안으로', () => {
  const css = read('src/doit/components/feature/zzarit.css');
  assert.match(css, /\.doit-match\[data-state="zzarit"\]\{background:none!important;border:0!important;padding:0!important/);
  assert.match(css, /\.echo-zzarit-cta\{[^}]*scroll-margin-bottom:calc\(112px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(read('src/doit/components/feature/ZzaritMoment.tsx'), /startRef\.current\?\.scrollIntoView\(\{ block: 'nearest', behavior: 'auto' \}\)/);
});

test('모바일 시안 3 Agent 대화: 직전 내 답 = 오른쪽 말풍선 · 질문 = ECHO 말풍선 · 글은 서버가 준 그대로', () => {
  const A = read('src/doit/components/feature/AgentConversation.tsx');
  assert.match(A, /<p className="echo-bubble echo-bubble--me"><span className="echo-sr">내가 한 말: <\/span>\{myAnswers\.at\(-1\)\}<\/p>/);
  assert.match(A, /<div className="echo-question-card echo-bubble--echo">\s*<p className="echo-question">\{question\}<\/p>/);
  const css = read('src/doit/components/feature/core-conversation.css');
  assert.ok(css.indexOf('.echo-bubble--me') > 0 && css.indexOf('.echo-bubble--me') < css.indexOf('/* ── 2026-09-24 대화 화면 파스텔 배경'), '파스텔 배경 규칙 구역 밖');
});

test('시작 흐름 공통 주요 버튼(PrimaryButton · .echo-primary-button)도 흰 바탕 + 깊은 청록 글자 · Codex PR #123', () => {
  const ui = read('src/doit/components/feature/echo-ui.css');
  assert.match(ui, /\.echo-primary-button\{background:#fff!important;border:1px solid #fff!important;color:var\(--echo-cta-ink\)!important/);
  assert.match(ui, /\.echo-primary-button:not\(:disabled\):active\{background:#e3f3f1!important\}/);
  assert.doesNotMatch(ui, /\.echo-primary-button\{background:var\(--echo-glass-strong\)/, '예전 흰 막 주요 버튼 0');
});

test('역할 분리: 홈페이지 빌드에도 들어가는 echo-ui.css 에 앱·관리자 코드 이름 0(CI 「브랜드에 앱·관리자 코드」 검사 · 2026-10-04 QA 게시 실패 원인)', () => {
  const ui = read('src/doit/components/feature/echo-ui.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const k of ['doit-connect', 'DoitApp', 'admin-web']) assert.ok(!ui.includes(k), k);
  assert.match(read('src/doit/components/feature/connect.css'), /\.doit-app-pastel \.doit-connect-note\{font-size:14px!important;line-height:1\.55\}/, '연결 안내 14px 는 앱 전용 connect.css 로');
});

test('2026-10-05 PM 보강: 홈페이지는 히어로 승인 원문을 두고 지금 되는 범위를 한 줄로 · 보장 말 0', () => {
  assert.match(COPY, /heroLine: \['오늘의 나를 남겨두세요\.', '내일, 뜻밖의 연결이 기다립니다\.'\]/, '히어로 승인 원문 그대로');
  const scope = COPY.match(/scope: '([^']+)'/)?.[1] ?? '';
  assert.ok(scope.includes('보여 드릴 사람이 있는지 확인') && scope.includes('서로 원할 때만'), '준비 → 확인 → 서로 원할 때');
  assert.doesNotMatch(scope, /내일|반드시|자동|알림|보장|매일|무조건/, '내일·자동·알림·보장 말 0');
  // 2026-10-09 대표 「글씨 원본 그대로 우선」: 은하 받침글은 원본 Vesper 글 · scope 문구는 copy.ts 보관(다음 단계).
});
test('바닥글: ECHO · 회사 두 묶음 · 맨 아래 법적 고지(사업자·약관·개인정보·문의) · 법적 고지 lang=ko', () => {
  assert.match(MOCK, /\{ label: HOME_V2\.how, href: HOW_PATH \},\n\s*\{ label: HOME_V2\.faq, href: FAQ_PATH \},\n\s*\{ label: HOME_V2\.install, href: appUrl\(INSTALL_PATH\) \},/);
  assert.match(MOCK, /\{ label: "이용약관", href: "\/legal\/terms" \},\n\s*\{ label: "개인정보처리방침", href: "\/legal\/privacy" \},\n\s*\{ label: "문의", href: "mailto:0423doit@gmail\.com" \},/);
  for (const t of ['href="/legal/terms"', 'href="/legal/privacy"', 'href={`mailto:${LEGAL.email}`}', '{LEGAL.company} · {LEGAL.registration}', '{LEGAL.address}', '{LEGAL.copyright}', '<div lang="ko" className=']) assert.ok(FOOT.includes(t), t);
});

// 2026-10-09 대표 「ECHO 홈페이지·모바일 최종 디자인 수정 / 대표 승인」: 주아체(Jua) 전면 적용 + 흰 카드·흰 버튼 바탕 0(투명 구성) + 3D·효과 그대로.
test('글꼴 = 주아체(Jua) 하나(400): 저장소 안 파일(OFL) · 홈페이지·앱 공통 선언 · 가짜 굵기 0 · 옛 글꼴 선언 0 · 구글 글꼴 링크 0', () => {
  const jua = read('src/fonts/jua.css');
  assert.ok((jua.match(/@font-face/g) ?? []).length >= 80, '유니코드 범위 조각 @font-face(한글 전부)');
  assert.match(jua, /font-family: 'Jua';\n\s*font-style: normal;\n\s*font-display: swap;\n\s*font-weight: 400;\n\s*src: url\('\/fonts\/jua\/jua-[\w-]+-400-normal\.woff2'\) format\('woff2'\);/);
  assert.doesNotMatch(jua, /https?:\/\//, '외부 글꼴 CDN 0');
  assert.ok(existsSync('public/fonts/jua/LICENSE.txt') && existsSync('public/fonts/jua/jua-latin-400-normal.woff2'), '글꼴 파일 + 라이선스 동봉');
  assert.ok(!existsSync('public/vesper/fonts/GeneralSans-Regular.woff2'), 'General Sans 파일 0');
  const idx = read('src/index.css');
  assert.match(idx, /^@import '\.\/fonts\/jua\.css';/m);
  assert.match(idx, /--font-heading: 'Jua', 'Pretendard'/); assert.match(idx, /--font-body: 'Jua', 'Pretendard'/); assert.match(idx, /--font-label: 'Jua', 'Pretendard'/);
  assert.match(idx, /html \{\n\s*scroll-behavior: smooth;[^}]*font-synthesis: none;/, '가짜 굵기·기울임 0(홈페이지·앱 공통)');
  assert.doesNotMatch(idx.replace(/\/\*[\s\S]*?\*\//g, ''), /Doto/, 'Doto 0');
  const tw = read('tailwind.config.ts');
  for (const k of ['general', 'display', 'tag', 'heading', 'body', 'sans']) assert.match(tw, new RegExp(`${k}: \\['Jua', 'Pretendard'`), k);
  assert.doesNotMatch(tw, /Doto|Noto Sans KR|General Sans|Mulish/);
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const f of ['src/doit/doit.css', 'src/doit/components/feature/doit-type.css', 'src/doit/components/feature/core-conversation.css', 'src/doit/components/feature/product-brand.css', 'src/doit/components/feature/asleep-connections.css', 'src/doit/app/plan-a/screens/saju.css', 'src/components/guide/guide.css', 'src/components/app-back-button.css', 'src/components/app-corner-menu.css']) {
    assert.doesNotMatch(strip(read(f)), /Gowun|Fraunces|Instrument Sans|Archivo Black|JetBrains Mono|Noto Serif KR|Gothic A1|Do Hyeon/, `${f}: 옛 글꼴 0`);
    assert.match(read(f), /Jua/, `${f}: Jua`);
  }
  assert.match(read('src/doit/components/feature/echo-ui.css'), /--echo-font:'Jua','Pretendard'/, '파스텔 앱 화면(!important 한 벌) = Jua');
  assert.match(read('src/doit/app/plan-a/theme.ts'), /export const serif = '"Jua", "Pretendard", system-ui, sans-serif';/, '플랜A 화면 인라인 글꼴 = Jua');
  assert.match(read('src/pages/do-it/fortune/cardArt.ts'), /export const SERIF = '"Jua", "Pretendard"/);
  for (const f of ['src/doit/app/plan-a/screens/LandingHero.tsx', 'src/doit/app/plan-a/components/PrimaryButton.tsx']) assert.doesNotMatch(read(f), /Do Hyeon/, f);
  for (const f of ['src/pages/do-it/photo/page.tsx', 'src/pages/do-it/grade/page.tsx', 'src/pages/do-it/hero/page.tsx']) assert.doesNotMatch(read(f), /Noto Serif KR|fontFamily: "'Pretendard'/, f);
  const vcss = V('vesper.css');
  assert.match(vcss, /html\.vesper \{ font-size: 16px; font-synthesis: none;/);
  assert.match(vcss, /html\.vesper body \{[^}]*font-family: 'Jua', 'Pretendard'/);
  assert.doesNotMatch(strip(vcss), /@font-face/, '홈페이지 조각 CSS 안 @font-face 0(공통 jua.css 하나)');
  // 굵기 클래스: 주아체는 400 하나 — 300/500 클래스 0
  for (const f of ['views/home/hero/hero.tsx', 'views/home/mobile-stage.tsx', 'views/home/sections/financial-section.tsx', 'views/home/sections/faq-section.tsx', 'views/home/send-request.tsx', 'views/home/section-galaxy.tsx', 'views/home/section-brain.tsx']) assert.doesNotMatch(V(f), /font-(light|medium|semibold|bold)\b/, `${f}: 굵기 클래스 0`);
  assert.doesNotMatch(read('index.html'), /fonts\.googleapis|fonts\.gstatic/);
  assert.match(read('index.html'), /remixicon\.min\.css/, '아이콘 글꼴은 그대로');
});

test('흰 카드·흰 버튼 바탕 0 — 설명·FAQ·CTA 가 투명하게 WebGL 장면 위에(밝은 글자 · 얇은 선 · 옅은 글자 그림자) · 3D 순서 그대로', () => {
  const fin = V('views/home/sections/financial-section.tsx'), faq = V('views/home/sections/faq-section.tsx'), mob = V('views/home/mobile-stage.tsx'), send = V('views/home/send-request.tsx');
  for (const [n, s] of [['how', fin], ['faq', faq], ['mobile', mob], ['send', send]]) {
    // 1px 선(+ 표시)·점(꼬리표·글머리)은 바탕이 아니다 — 빼고 본다.
    const body = s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/<span[^>]*\b(h-px|w-px|size-\[0\.\d+rem\])[^>]*\/>/g, '');
    assert.doesNotMatch(body, /bg-white\b(?!\/)|text-black|border-black|bg-black\b(?!\/)|SOLID_CTA|backdrop-blur/, `${n}: 흰 바탕·검정 글자·흰 채움 버튼·강한 유리 블러 0`);
  }
  assert.match(fin, /className="vesper-soft vesper-veil relative grid w-full origin-bottom grid-cols-\[minmax\(0,1fr\)_27\.361vw\][^"]*border-t border-white\/15[^"]*text-white/, '어떻게 만나나요: 내용 높이 격자 · 얇은 윗줄 · 밝은 글자');
  assert.doesNotMatch(fin, /h-\[44\.167vw\]|top-\[36\.667vw\]|position: "absolute"/, '고정 높이·절대 배치 0(내용 높이로 재정렬)');
  assert.match(fin, /CARD_REVEAL|MASK_REVEAL|LETTER_FADE|WORD_FADE/, '도착·글 연출 그대로');
  assert.match(faq, /interaction=\{LIGHT_ROW\}/); assert.match(faq, /border-b border-white\/20/); assert.match(faq, /asterisk-light\.svg/);
  assert.match(faq, /vesper-soft vesper-veil relative flex w-full origin-bottom flex-col items-center border-t border-white\/15/);
  assert.match(mob, /const CARD_FACE = "vesper-soft vesper-veil relative flex w-full origin-bottom flex-col gap-4 border-t border-white\/15 pt-6 text-white";/);
  assert.match(mob, /splitSentences\(HOME_V2\.choiceBody\)\.map/, '서로가 선택합니다: 승인 문장을 문장 단위로만 나눔(글자 변경 0)');
  assert.match(V('views/home/sentences.ts'), /split\(\/\(\?<=\[\.!\?\]\)\\s\+\/\)/);
  assert.match(send, /usePressable\(GHOST\)/); assert.match(send, /send-icon-light\.svg/); assert.match(send, /min-h-\[48px\]/, '44px 이상 터치');
  const icon = read('public/vesper/assets/hero/send-icon-light.svg');
  assert.doesNotMatch(icon, /<rect/, '아이콘 흰 배경 도형 0'); assert.match(icon, /#fdfdfd/);
  assert.match(V('lib/springs/interaction.ts'), /export const LIGHT_ROW: Interaction = \{\n\s*rest: \{ backgroundColor: alpha\(0\) \},/);
  assert.match(V('vesper.css'), /html\.vesper \.vesper-soft \{ text-shadow: 0 1px 2px rgb\(0 0 0 \/ 0\.55\), 0 0 14px rgb\(0 0 0 \/ 0\.35\); \}/, '옅은 글자 그림자만');
  assert.match(V('vesper.css'), /\.vesper-veil::before \{[^}]*background: rgb\(0 0 0 \/ 0\.38\);[^}]*mask-image: radial-gradient\(ellipse 100% 100% at 50% 50%, #000 50%, transparent 100%\)/, '경계 없는 낮은 농도 그라데이션만(판·블러 0)');
  assert.doesNotMatch(V('vesper.css'), /backdrop-filter/, '유리 블러 0');
  assert.match(read('src/pages/NotFound.tsx'), /font-body">\{location\.pathname\}/, '404 안내도 주아체');
  const stage = V('views/home/scroll-stage.tsx');
  assert.match(stage, /id="how"[\s\S]*HydrateNear id="financial"[\s\S]*HydrateNear id="faq"[\s\S]*id="solaris"[\s\S]*id="onyx"[\s\S]*HydrateNear id="contact"/, '장면 순서 그대로(어떻게 → FAQ → Solaris → Onyx → 바닥글)');
  assert.match(mob, /<HeroMobile[\s\S]*<HowCard[\s\S]*<AgentScene[\s\S]*<ChoiceCard[\s\S]*<FaqSection[\s\S]*<SiteFooter/, '모바일 ①~⑤ 순서 그대로');
});

test('Codex 13·14차(PR #151): #how 틀 항상 마운트 · Onyx touchmove 차단 0 · 격자 누름 필터 · Onyx 메뉴 위 포인터 중립 · 버린 문의 대기 콜백 취소', () => {
  const stage = V('views/home/scroll-stage.tsx');
  assert.match(stage, /<div id="how" ref=\{outroRef\}[\s\S]*<HydrateNear id="financial">/, '#how = 바깥 틀(문 열리기 전에도 있음)');
  const onyx = V('views/home/sections/onyx-section.tsx').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(onyx, /touchmove|preventDefault/, 'Onyx: 세로 제스처를 막는 touchmove 차단 0');
  assert.match(onyx, /touch-pan-y/); assert.match(onyx, /host\.contains\(target\)/, '메뉴 위 포인터는 밖'); assert.match(onyx, /pointerInside = false; ndc\.set\(0, 0\); return;/, '밖이면 카메라 중립');
  const lat = V('views/home/hero/hero-lattice.tsx');
  assert.match(lat, /if \(!visible \|\| live\.zoomStart >= 0 \|\| pageMotionPaused\(\)\) return;/);
  assert.match(lat, /closest\('a,button,input,textarea,select,\[role="dialog"\],\[aria-modal="true"\],\[data-no-zoom\]'\)/, '버튼·링크·창 위 누름 제외');
  assert.match(lat, /document\.querySelector\('\[aria-modal="true"\]'\)/); assert.match(lat, /e\.clientX < r\.left \|\| e\.clientX > r\.right/, '격자 밖 누름 제외');
  const hn = V('components/common/hydrate-near.tsx');
  assert.match(hn, /const onEngaged = \(wake: \(\) => void\): \(\(\) => void\) =>/); assert.match(hn, /engageWaiters\.delete\(wake\)/);
  assert.match(hn, /dispose: \(\) => \{\n\s*offEngaged\(\);\n\s*io\?\.disconnect\(\);/, '버린 문 = 관찰자 + 대기 콜백 모두 해제');
});

test('대표 「심볼은 왼쪽 윗상단에 배치해」(2026-10-09): 홈페이지 머리글(PC·휴대폰)·열린 메뉴 맨 왼쪽 = 공식 D 심볼(투명 표시판 · 재디자인 0) → DO IT 워드마크', () => {
  for (const f of ['components/common/site-header.tsx', 'components/common/mobile-nav.tsx']) {
    const s = V(f);
    assert.match(s, /import \{ SYMBOL_DISPLAY_SRC, fallbackToOriginal \} from "@\/components\/symbolAssets";/, f);
    const sym = s.indexOf('src={SYMBOL_DISPLAY_SRC}'), word = s.indexOf('src="/brand/doit-wordmark.webp"');
    assert.ok(sym > 0 && word > sym, `${f}: 심볼이 워드마크보다 앞(왼쪽)`);
    assert.match(s, /onError=\{\(event\) => fallbackToOriginal\(event\.currentTarget\)\}/, `${f}: 작은 판 못 읽으면 공식 원본`);
  }
  assert.match(read('src/components/symbolAssets.ts'), /SYMBOL_DISPLAY_SRC = '\/brand\/doit-symbol-intro\.webp'/);
});

test('앵커 도착 = 고정 머리글 아래(2026-10-09 모의 검사: #how 제목이 머리글 밑에 숨음): scroll-to 와 메뉴 이동 모두 anchorOffset · CSS scroll-margin-top', () => {
  const st = V('utils/scroll-to.ts');
  assert.match(st, /export const anchorOffset = \(\): number =>/); assert.match(st, /header\.getBoundingClientRect\(\)\.bottom \+ 8/);
  assert.match(st, /top: Math\.max\(0, getDistanceFromTop\(target\) - anchorOffset\(\)\)/);
  assert.match(V('components/common/mobile-nav.tsx'), /lenis\.scrollTo\(element \?\? 0, \{ duration: 1\.2, offset: element \? -anchorOffset\(\) : 0 \}\)/);
  assert.match(V('vesper.css'), /html\.vesper :is\(#how, #choice, #faq, #contact, #financial, #top\) \{ scroll-margin-top: calc\(0\.694vw \+ 3\.542vw \+ 8px\); \}/);
});
