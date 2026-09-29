// 2026-09-27 대표 「QA FINAL FIX」: 앱 주소(app 빌드) 첫 화면 = 모바일 제품(브랜드 히어로 0) · 히어로 「움직임 줄이기」 버튼 제거.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('라우터: app 빌드의 / 는 제품 입구로 · 브랜드·통합 빌드는 랜딩(히어로) 그대로', () => {
  const s = read('src/router/config.tsx');
  assert.match(s, /const entryLanding = ROLE === 'app' \? <Navigate to=\{PRODUCT_ENTRY_PATH\} replace \/> : <DoItLandingPage \/>;/);
  assert.match(s, /\{ path: '\/', element: <DoItEntry landing=\{entryLanding\} \/> \}/);
});
test('인트로: app 빌드이거나 next=app 이면 제품 입구 · 그 밖은 기존(랜딩)', () => {
  const s = read('src/pages/do-it/intro/page.tsx');
  assert.match(s, /useState\(\(\) => IS_APP_SITE \|\| search\.get\('next'\) === 'app'\)/);
  assert.match(s, /navigate\(toProduct \? PRODUCT_ENTRY_PATH : MAIN_ENTRY_PATH, \{ replace: true \}\)/);
});
test('히어로: 「움직임 줄이기」 버튼 0 · 기기 설정 동작 줄이기(prefers-reduced-motion)는 그대로 멈춤', () => {
  const hero = read('src/components/DoItBrandHero.tsx');
  assert.doesNotMatch(hero, /<button[^>]*doit-motion-toggle/);
  assert.doesNotMatch(hero, /onToggleMotion|motionPaused/);
  assert.doesNotMatch(read('src/pages/do-it/landing/page.tsx'), /onToggleMotion|motionPaused/);
  const m = read('src/pages/do-it/landing/components/useEditorialMotion.ts');
  assert.match(m, /prefers-reduced-motion: reduce/);
  assert.match(m, /const enabled = \(\) => !media\?\.matches && !document\.hidden;/);
});

// 2026-09-28 「FINAL MASTER」 §12~§15
test('공통 메뉴: 앱 시작·온보딩부터 오른쪽 맨 위 하나(안전 영역 포함) · 브랜드·OAuth 복귀·관리자·QA만 숨김 · 화면별 중복 메뉴 0', () => {
  const menu = read('src/components/AppCornerMenu.tsx');
  const css = read('src/components/app-corner-menu.css');
  assert.match(read('src/App.tsx'), /<AppCornerMenu \/>/);
  assert.match(menu, /if \(IS_BRAND_SITE \|\| HIDDEN_PATH\.test\(location\.pathname\)\) return null;/);
  const hidden = new RegExp(menu.match(/const HIDDEN_PATH = \/(.*)\/;/)[1]);
  for (const p of ['/auth/callback', '/admin/mobile', '/qa/test']) assert.ok(hidden.test(p), p);
  for (const p of ['/', '/do-it/intro', '/do-it/hero', '/do-it/landing', '/doit/start-journey', '/login', '/signup', '/doit/conversation', '/doit/profile', '/doit/settings', '/doit/connections']) assert.ok(!hidden.test(p), p);
  assert.match(css, /\.echo-corner-button\{position:fixed;top:calc\(env\(safe-area-inset-top\) \+ 8px\);right:calc\(env\(safe-area-inset-right\) \+ 12px\);z-index:70;[^}]*width:44px;height:44px/);
  for (const p of ['src/doit/components/feature/TopBar.tsx', 'src/doit/components/feature/AgentConversation.tsx', 'src/doit/pages/do-it/fortune/page.tsx']) {
    const s = read(p); assert.doesNotMatch(s, /MenuButton|ri-settings-3-line/, p);
  }
  assert.match(css, /\.echo-dialogue \.echo-dialogue-header\{padding-right:52px\}/);
  assert.match(read('src/doit/components/feature/TopBar.tsx'), /pr-12/);
  for (const p of ['src/pages/login/page.tsx', 'src/pages/signup/page.tsx']) assert.match(read(p), /pt-\[max\(1\.25rem,env\(safe-area-inset-top\)\)\]/, p);
});
test('눌림 표시: 제품 화면 틀 안 버튼·카드 · scale 0.97 · 0.18초 · 동작 줄이기면 크기 변화 0 · iOS :active 켜기', () => {
  const css = read('src/components/app-corner-menu.css');
  assert.match(css, /:is\(\.doit-root,\.doit-app-pastel,\.echo-dialogue\) :is\(button,\[role="button"\],\[role="radio"\][^{]*:active\{scale:\.97;filter:brightness\(\.94\)\}/);
  assert.match(css, /transition-duration:\.18s/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{:is\(\.doit-root,\.doit-app-pastel,\.echo-dialogue\) [^{]*:active\{scale:1!important\}\}/);
  assert.doesNotMatch(css, /(^|[^-])transform:/, 'transform 을 덮어쓰지 않는다(자리 흔들림 0)');
  assert.match(read('src/components/AppCornerMenu.tsx'), /document\.addEventListener\('touchstart', noop, \{ passive: true \}\)/);
});
// 2026-09-28 대표 최신 지시: 「움직임 줄이기」 사용자 토글은 제품 어디에도 두지 않는다(설정 포함). 기기 설정(prefers-reduced-motion)은 그대로 따른다.
test('움직임 줄이기: 사용자 토글·문구 0(설정·히어로·제품 화면) · 기기 설정 동작 줄이기는 계속 따름', () => {
  for (const p of ['src/doit/pages/do-it/settings/page.tsx', 'src/components/DoItBrandHero.tsx', 'src/components/AppCornerMenu.tsx', 'src/doit/pages/do-it/start-journey/page.tsx', 'src/doit/components/feature/AgentConversation.tsx']) assert.doesNotMatch(read(p), /움직임 줄이기|reduce-motion|motionPreference/, p);
  assert.doesNotMatch(read('src/components/app-corner-menu.css'), /data-echo-reduce-motion/);
  assert.match(read('src/components/app-corner-menu.css'), /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(read('src/pages/do-it/landing/components/useEditorialMotion.ts'), /prefers-reduced-motion: reduce/);
});

// 2026-09-28 대표 「SESSION SAFETY」: 기기마다 자기 세션 · 시작할 때 고른 목적(goal)을 서버로.
test('세션 격리(앱): 기기가 세션 id 를 기억해 agent_get 에 보냄 · agent_start 에 목적 id/이름 · 새 회차면 기억 지움 · 머리글은 이 세션 목적', () => {
  const api = read('src/doit/lib/agentApi.ts');
  assert.match(api, /\{ action: 'agent_get', \.\.\.\(sessionId \? \{ sessionId \} : \{\}\) \}/);
  assert.match(api, /\.\.\.\(input\.goal \? \{ goal: input\.goal\.id, goalLabel: input\.goal\.label \} : \{\}\)/);
  assert.match(api, /localStorage\.setItem\(SESSION_KEY\(userId\), id\)/);
  assert.match(read('src/doit/lib/conversationRound.ts'), /forgetAgentSession\(userId\);/);
  assert.match(read('src/doit/pages/do-it/conversation/page.tsx'), /goal=\{goal\}/);
  assert.match(read('src/doit/components/feature/AgentConversation.tsx'), /session\?\.goal_label \?\? purposeLabel/);
});
