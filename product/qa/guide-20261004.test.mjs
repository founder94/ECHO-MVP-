// 2026-10-04 대표 「추가 구현 명세 — 홈페이지·모바일 사용자 이용 안내 통합」 — 소스 규칙 검사(모의 · 실제 렌더·실기기 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const CONTENT = read('src/lib/guide/content.ts');
const BUS = read('src/lib/guide/bus.ts');
const HOST = read('src/components/guide/GuideHost.tsx');
const HINT = read('src/components/guide/GuideHint.tsx');
const CSS = read('src/components/guide/guide.css');
const HOME = read('src/pages/do-it/brand-home/page.tsx');
const APP = read('src/App.tsx');

test('안내 내용 한 벌: 8개 명세 항목(+그 밖에) · 명세 제목 그대로 · 순서 고정', () => {
  const ids = [...CONTENT.matchAll(/^    id: '([a-z]+)',$/gm)].map((m) => m[1]);
  assert.deepEqual(ids, ['start', 'talk', 'check', 'choice', 'key', 'zzarit', 'install', 'safety', 'more']);
  for (const t of ['처음이라면, 여기부터 보세요.', '잘 정리해서 말하지 않아도 괜찮아요.', '내 생각과 다르면, 고쳐주세요.', '추천을 받아도, 선택은 내가 해요.', 'KEY, 어디에 쓰나요?', '‘찌릿!’은 서로 선택했다는 뜻이에요.', '홈 화면에서 바로 시작하세요.', '불편한 일이 있으면 알려주세요.']) assert.ok(CONTENT.includes(`title: '${t}'`), t);
  for (const t of ['맞아요 — ', '조금 달라요 — ', '그게 아니에요 — ', '직접 설명할게요 — ']) assert.ok(CONTENT.includes(t), t);
  assert.ok(CONTENT.includes('추천을 받았다고 바로 연결되는 것은 아니에요.'));
});

test('안내 내용: 없는 기능·옛 결제·내부 구조를 말하지 않음 · 홈페이지 빌드에 섞여도 되는 이름만', () => {
  const body = noComments(CONTENT);
  assert.doesNotMatch(body, /Stripe|9,?900|4,?900|리포트 결제|보고서|자기이해 서비스|OpenAI|GPT|Claude|Gemini|엔진|테이블|65\s*%|35\s*%|궁합|운명|데이팅|소개팅/);
  assert.doesNotMatch(body, /바로 대화할 수 있어요|무조건|다섯 번이면/);
  for (const k of ['doit-connect', 'DoitApp', 'admin-web']) assert.ok(!body.includes(k), k); // 역할 분리 검사(홈페이지 빌드)
  const key = CONTENT.slice(CONTENT.indexOf("id: 'key'"), CONTENT.indexOf("id: 'zzarit'"));
  assert.match(key, /soon: true/); assert.match(key, /아직 준비 중/); assert.doesNotMatch(key, /\d/, 'KEY 수량·가격 숫자 0');
});

test('안내 창: 화면 이동 0(포털) · 뒤로 = 창만 닫기 · Esc · 초점 가두기/돌려주기 · 읽는 동안 뒤 움직임 정지 · 움직임 줄이기', () => {
  assert.match(HOST, /createPortal\(/);
  assert.doesNotMatch(noComments(HOST), /useNavigate|navigate\(|window\.location/);
  assert.match(HOST, /window\.history\.pushState\(\{ \.\.\.\(window\.history\.state \?\? \{\}\), echoGuide: true \}, ''\)/);
  assert.match(HOST, /const onPop = \(\) => \{ if \(pushedRef\.current\) \{ pushedRef\.current = false; finish\(\); \} \};/);
  assert.match(HOST, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); close\(\); return; \}/);
  assert.match(HOST, /opener\.focus\(\{ preventScroll: true \}\)/);
  assert.match(HOST, /role="dialog" aria-modal="true" aria-labelledby="echo-guide-title"/);
  assert.match(CSS, /html\.echo-guide-open body \*:not\(\.echo-guide\):not\(\.echo-guide \*\)\{animation-play-state:paused!important\}/);
  assert.match(CSS, /@media \(prefers-reduced-motion:reduce\)\{[^}]*\.echo-guide-panel[^}]*animation:none!important/);
  assert.match(CSS, /@media \(min-width:900px\)\{[^@]*\.echo-guide-panel\{width:440px/, '넓은 화면 = 옆 패널');
  const globalRules = CSS.split('\n').filter((l) => !l.startsWith('html.echo-guide-open ')).join('\n');
  assert.doesNotMatch(globalRules, /(^|[\s,}])(body|:root|html)\s*\{/m, '전역 규칙 0(열려 있을 때의 html.echo-guide-open 만)');
  assert.equal((CSS.match(/^html\.echo-guide-open /gm) ?? []).length, 2);
});

test('짧은 도움말: 처음 한 번 → 그 뒤 작은 링크 · 이 기기에만 저장 · 동의 값 0', () => {
  assert.match(HINT, /const \[seen, setSeen\] = useState\(\(\) => hintSeen\(id\) \|\| !section\.hint\)/);
  assert.match(HINT, /<button ref=\{linkRef\} type="button" className="echo-guide-link" onClick=\{\(\) => openGuide\(id\)\}>\{linkLabel\}<\/button>/);
  assert.match(HINT, /if \(after === 'open'\) openGuide\(id, link\); else link\?\.focus\(\{ preventScroll: true \}\);/, '「자세히 보기」 뒤 초점은 남아 있는 링크로');
  assert.match(BUS, /localStorage\.setItem\(HINT_KEY\(id\), '1'\)/);
  assert.doesNotMatch(noComments(BUS + HINT), /consent|agree|동의/i);
});

test('홈페이지: 메뉴·바닥글에 「이용 안내」 · 「웹 설치하기」 = 설치 항목 문장 · 검정 테마 · 설치는 앱 주소에서만', () => {
  // 2026-10-09 대표 「기존 홈페이지는 다 삭제」: 설치 카드 0 → 「웹 설치하기」는 바닥글에서 앱 주소로(이용 안내 설치 항목과 같은 곳) · 방법 문장은 이용 안내 설치 항목에.
  // 2026-10-09 대표 「글씨는 내가 준 코드 원본 그대로 우선」: 홈페이지 메뉴·바닥글은 원본 Vesper 글 → 「이용 안내」·「웹 설치하기」 링크는 다음 단계(글 넣기)에서. 이용 안내 창(GuideHost)은 그대로 둔다.
  assert.doesNotMatch(read('src/vesper/data/mocks/home.ts'), /BRAND_HOME_COPY|INSTALL_PATH/, '바닥글 글 = 원본');
  assert.match(HOME, /<GuideHost theme="brand"/);
  assert.match(HOME, /이 회사 홈페이지는 설치하지 않아도 돼요\./);
  assert.ok(read('src/vesper/views/home/send-request.tsx').includes('Send Request'), '본문 CTA = 원본(10/9)');
});

test('앱: 안내 창 하나(앱 테마) · 설치 항목 = 실제 설치 카드 · 기능 옆 도움말(이야기·확인·후보·찌릿)', () => {
  assert.match(APP, /\{!IS_BRAND_SITE && <GuideHost theme="app" extra=\{\{ install: <InstallAppCard variant="menu" \/> \}\} \/>\}/);
  const at = (f, re) => assert.match(read(f), re, f);
  at('src/doit/components/feature/AgentConversation.tsx', /\{!done && myAnswers\.length === 0 && <GuideHint id="talk" \/>\}/);
  at('src/doit/components/feature/AgentProfileCheck.tsx', /\{view\.kind === 'review' && !ok && <GuideHint id="check" \/>\}/);
  at('src/doit/components/feature/ConnectionCandidates.tsx', /\{load\.candidates\.length > 0 && <GuideHint id="choice" \/>\}/);
  at('src/doit/components/feature/ZzaritMoment.tsx', /<GuideHint id="zzarit" linkLabel="‘찌릿!’이 뭐예요\?" \/>/);
});

test('대화 화면의 「뒤로 = 직전 답 고치기」는 이용 안내 창을 닫는 뒤로에는 반응하지 않음(적던 글 그대로)', () => {
  const A = read('src/doit/components/feature/AgentConversation.tsx');
  assert.match(A, /const onPop = \(\) => \{\n\s*\/\/[^\n]*\n\s*if \(\(window\.history\.state as \{ echoBackGuard\?: boolean \} \| null\)\?\.echoBackGuard\) return;\n\s*mark\(\);/);
});

test('Codex 리뷰 반영: 인트로 시간 정지 · 찌릿 이 기기 한정 · 설정 #guide 제목 · 메뉴로 연 뒤 초점은 메뉴 버튼으로', () => {
  const INTRO = read('src/pages/do-it/intro/page.tsx');
  assert.match(INTRO, /if \(document\.documentElement\.classList\.contains\('echo-guide-open'\)\) \{\n\s*lastNowRef\.current = now;\n\s*rafRef\.current = requestAnimationFrame\(tick\);\n\s*return;/);
  assert.ok(CONTENT.includes('같은 연결에서는 이 기기에서 한 번만 보여요.'));
  assert.match(read('src/doit/pages/do-it/settings/page.tsx'), /<p><strong>\{item\.title\}<\/strong><\/p><p>\{item\.body\}<\/p>/);
  assert.match(read('src/components/AppCornerMenu.tsx'), /openGuide\(undefined, cornerButton\.current\)/);
  assert.match(HOST, /openerRef\.current = detail\?\.opener \?\? \(document\.activeElement instanceof HTMLElement/);
});
