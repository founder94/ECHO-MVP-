// 2026-10-10 기기 호환(Samsung Galaxy · Z Fold 접은 화면 280~344px · 펼친 화면 ~690px · Samsung Internet / Chrome Android / 설치 앱 · iPhone Safari / 홈 화면 앱):
// 상단 safe-area · 100svh · 화면 옮길 때 맨 위 · 휴대폰 「뒤로」 = 창 닫기·직전 단계 · 글자판 · 적던 말 지키기 · 280px 넘침 · 높이 폴백.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('P0 safe-area: 대화·프로필 확인 화면 위 여백 = 기존 값 + env(safe-area-inset-top) (일반 브라우저는 0 이라 그대로)', () => {
  const core = noComments(read('src/doit/components/feature/core-conversation.css'));
  assert.match(core, /\.echo-dialogue\{max-width:620px;margin:auto;padding:calc\(28px \+ env\(safe-area-inset-top,0px\)\) 24px 56px;/);
  assert.match(core, /@media\(min-width:768px\)\{\.echo-dialogue\{padding:calc\(44px \+ env\(safe-area-inset-top,0px\)\) 40px 72px\}/);
  assert.doesNotMatch(core, /\.echo-dialogue\{[^}]*padding:28px 24px 56px/);
  const brand = noComments(read('src/doit/components/feature/product-brand.css'));
  assert.match(brand, /\.doit-profile-review\{[^}]*padding:calc\(28px \+ env\(safe-area-inset-top,0px\)\) 24px calc\(36px \+ env\(safe-area-inset-bottom\)\)/);
  // 다른 전체 화면 맨 위 줄: 목적 고르기 첫 칸 · 프로필 입력(시작 흐름 「질문으로 돌아가기」 줄)
  assert.match(read('src/doit/app/plan-a/screens/PurposeSelect.tsx'), /<div className="px-6 pt-\[calc\(2rem\+env\(safe-area-inset-top,0px\)\)\] pb-4">/);
  assert.match(read('src/doit/pages/do-it/start-journey/page.tsx'), /<div style=\{\{ padding: "calc\(16px \+ env\(safe-area-inset-top, 0px\)\) 24px 0" \}\}>/);
  // 같은 방식(이미 맞던 곳)은 그대로
  assert.match(read('src/doit/pages/do-it/fortune/fortune-space.css'), /\.echo-fortune-space\{padding-top:calc\(env\(safe-area-inset-top\) \+ 16px\)\}/);
});

test('P1 100svh: 아래 버튼이 있는 전체 화면 = echo-min-h-svh(100vh 폴백 → 100svh) · 아래 버튼 줄 = 기존 여백 + safe-area-inset-bottom', () => {
  const css = read('src/index.css');
  // 같은 칸 두 줄은 빌드의 CSS 줄이기가 앞줄(100vh 폴백)을 지운다 → @supports 로 나눔
  assert.match(css, /\.echo-min-h-svh \{\s*min-height: 100vh;\s*\}\s*@supports \(min-height: 100svh\) \{\s*\.echo-min-h-svh \{\s*min-height: 100svh;\s*\}\s*\}/);
  const base = 'src/doit/app/plan-a/screens/';
  const files = {
    'PurposeSelect.tsx': 'className="px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shrink-0"',
    'ProfileBuild.tsx': 'className="px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))]"',
    'SajuInput.tsx': 'className="flex flex-col gap-3 px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))]"',
    'TaroCardSelect.tsx': 'className="relative z-10 flex flex-col gap-3 px-6 pt-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))]"',
    'FreeResult.tsx': 'className="px-6 pt-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))] flex flex-col gap-3"',
  };
  for (const [f, cta] of Object.entries(files)) {
    const s = read(base + f);
    assert.doesNotMatch(s, /min-h-screen/, `${f}: 100vh 0`);
    assert.match(s, /echo-min-h-svh/, `${f}: 100svh`);
    assert.ok(s.includes(cta), `${f}: 아래 버튼 safe-area`);
  }
  // 사진 화면은 바깥 두 칸의 높이 클래스만(사진·카메라 내부는 다른 작업)
  const photo = read(base + 'PhotoCapture.tsx');
  assert.equal((photo.match(/className="flex flex-col echo-min-h-svh"/g) ?? []).length, 2);
  const journey = read('src/doit/pages/do-it/start-journey/page.tsx');
  assert.doesNotMatch(journey, /min-h-screen/);
  assert.equal((journey.match(/justify-center echo-min-h-svh px-6 text-center/g) ?? []).length, 2);
});

test('P1 화면 옮기면 맨 위부터: PUSH·REPLACE 때만 · 뒤로(POP)·#주소는 그대로 · 여러 단계 화면도 단계가 바뀌면 맨 위', () => {
  const app = read('src/App.tsx');
  assert.match(app, /import RouteScrollReset from "\.\/components\/RouteScrollReset";/);
  assert.ok(app.indexOf('<RouteScrollReset />') > app.indexOf('<BrowserRouter') && app.indexOf('<RouteScrollReset />') < app.indexOf('<AppRoutes />'));
  const r = read('src/components/RouteScrollReset.tsx');
  assert.match(r, /useNavigationType\(\)/);
  assert.match(r, /if \(navigationType === 'POP' \|\| hash\) return;/);
  assert.match(r, /window\.scrollTo\(0, 0\)/);
  assert.match(r, /\}, \[pathname\]\);/);
  assert.match(r, /return null;/);
  const step = read('src/hooks/useStepHistory.ts');
  assert.match(step, /if \(!firstRef\.current\) window\.scrollTo\(0, 0\);/);
});

test('P1 휴대폰 「뒤로」 = 열린 창만 닫기(useBackClose): 기록 한 칸 · popstate 에 닫기 · 화면 버튼으로 닫으면 내 칸이 맨 위일 때만 한 칸 되돌림 · 대화 뒤로 지킴이와 같이 삶', () => {
  const h = read('src/hooks/useBackClose.ts');
  assert.match(h, /export function useBackClose\(open: boolean, onClose: \(\(\) => void\) \| undefined\)/);
  assert.match(h, /export default useBackClose;/);
  // 기존 기록 상태(echoBackGuard 등)를 펼쳐 그대로 두고 표시만 더한다
  assert.match(h, /const next = \{ \.\.\.\(readState\(\) \?\? \{\}\), \[STATE_KEY\]: id \};\s*window\.history\.pushState\(next, ''\);/);
  // 위에 쌓인 것(이용 안내 창)이 닫힌 뒤로면 그대로
  assert.match(h, /if \(readState\(\)\?\.\[STATE_KEY\] === id\) return;/);
  // 화면 버튼으로 닫힘: 내 칸이 맨 위(다른 화면 이동·다른 창 0)일 때만 back
  assert.match(h, /if \(state\?\.\[STATE_KEY\] === id && sameKeys\(state, keys\)\) \{\s*try \{ window\.history\.back\(\); \}/);
  // 닫힌 창이 남긴 칸은 뒤로로 지나갈 때 건너뜀 · 개발 모드 두 번 실행에도 칸 하나
  assert.match(h, /if \(typeof owner === 'string' && !openIds\.has\(owner\)\)/);
  assert.match(h, /queueMicrotask\(\(\) => \{\s*if \(cancelled\) return;/);
  // 쓰는 곳
  const modal = read('src/doit/components/base/Modal.tsx');
  assert.equal((modal.match(/useBackClose\(open, onClose\);\n  if \(!open\) return null;/g) ?? []).length, 2, 'BottomSheet · Modal');
  assert.match(modal, /pb-\[calc\(2rem\+env\(safe-area-inset-bottom,0px\)\)\]/);
  const menu = read('src/components/AppCornerMenu.tsx');
  assert.match(menu, /useBackClose\(open && !IS_BRAND_SITE && !HIDDEN_PATH\.test\(location\.pathname\), \(\) => setOpen\(false\)\);/);
  assert.ok(menu.indexOf('useBackClose(') < menu.indexOf('if (IS_BRAND_SITE || HIDDEN_PATH.test(location.pathname)) return null;'), '훅은 이른 반환보다 먼저');
  const choice = read('src/doit/components/feature/AgentChoiceLayer.tsx');
  assert.match(choice, /useBackClose\(true, onClose\);/); // 닫기가 있는 히어로 선택창만(onClose 없으면 꺼짐)
  const install = read('src/components/InstallIntentSheet.tsx');
  assert.match(install, /const visible = open && !pathname\.startsWith\('\/do-it\/intro'\);\s*useBackClose\(visible, \(\) => setOpen\(false\)\);\s*if \(!visible\) return null;/);
  // 대화 화면 뒤로 지킴이는 그대로(내 칸 위에서는 직전 답 고치기로 가지 않음)
  assert.match(read('src/doit/components/feature/AgentConversation.tsx'), /if \(\(window\.history\.state as \{ echoBackGuard\?: boolean \} \| null\)\?\.echoBackGuard\) return;/);
});

test('P1 여러 단계 흐름: 화면 버튼으로 넘어간 단계 = ?step= push · 뒤로(POP) = 지나온 단계만 · 그 밖(직접 친 주소·새로고침) = 첫 칸 · 첫 칸 뒤로 = 예전처럼 나감', () => {
  const h = read('src/hooks/useStepHistory.ts');
  assert.match(h, /params\.set\('step', next\)/);
  assert.match(h, /const want: S = stepParam && isStep\(stepParam\) && visitedRef\.current\.has\(stepParam\) \? stepParam : baseRef\.current;/);
  assert.match(h, /if \(navigationType !== 'POP'\) return;/);
  assert.match(h, /next\.delete\('step'\); return next; \}, \{ replace: true \}\);/);
  const j = read('src/doit/pages/do-it/start-journey/page.tsx');
  assert.match(j, /const goStep = useStepHistory<Step>\(step, setStep, isStep\);/);
  for (const call of ['goStep("consent")', 'goStep("photo")', 'goStep("profile-build")', 'goStep("profile-review")']) assert.ok(j.includes(call), call);
  // 서버 복원·로그아웃·목적 다시 고르기는 첫 칸(setStep 그대로 · 기록 0)
  assert.match(j, /if \(goConversation\) setLeaving\(true\); else setStep\(nextStep\);/);
  assert.match(j, /setStep\(A_STRUCTURE_SERVER_ENABLED \? "consent" : "purpose"\);/);
  // 설치 앱 시작 주소: 인트로가 ?step 없이 replace 로 제품 입구에 도착 → 첫 칸
  assert.match(read('src/pages/do-it/intro/page.tsx'), /navigate\(toProduct \? PRODUCT_ENTRY_PATH : MAIN_ENTRY_PATH, \{ replace: true \}\)/);
  assert.match(read('src/lib/echo/appMode.ts'), /export const PRODUCT_ENTRY_PATH = '\/doit\/start-journey';/);
  const f = read('src/doit/pages/do-it/fortune/page.tsx');
  assert.match(f, /const goStep = useStepHistory<Step>\(step, setStep, isStep\);/);
  assert.equal((f.match(/goStep\("input"\)/g) ?? []).length, 3);
  assert.equal((f.match(/goStep\("result"\)/g) ?? []).length, 2);
});

test('P1 글자판: viewport = interactive-widget=resizes-content(viewport-fit=cover 유지) · field-sizing 없는 브라우저 입력줄 자동 높이 · 새 말 화면 안으로 · 아래 탭 줄 숨김 · 늦은 visualViewport 듣기 0', () => {
  const html = read('index.html');
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0, viewport-fit=cover, interactive-widget=resizes-content" \/>/);
  const k = read('src/lib/keyboard.ts');
  assert.match(k, /CSS\.supports\('field-sizing', 'content'\)/);
  assert.match(k, /el\.style\.height = 'auto';\s*el\.style\.height = `\$\{Math\.min\(el\.scrollHeight, max\)\}px`;/);
  assert.match(k, /export function fitTextarea\(el: HTMLTextAreaElement \| null, max = 140\)/);
  const conv = read('src/doit/components/feature/AgentConversation.tsx');
  assert.match(conv, /useEffect\(\(\) => \{ fitTextarea\(draftRef\.current\); \}, \[draft, session\?\.id\]\);/);
  assert.match(conv, /latest\.scrollIntoView\(\{ block: 'nearest', behavior: reduce \? 'auto' : 'smooth' \}\);/);
  assert.match(conv, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(conv, /<div className="echo-chat-log" ref=\{chatLogRef\}>/);
  // CSS 쪽 field-sizing 쓰는 입력줄 두 곳 모두 대체 경로가 있다
  assert.match(read('src/doit/components/feature/chat-ref.css'), /field-sizing:content/);
  const cm = read('src/doit/components/feature/ConnectionMatches.tsx');
  assert.match(cm, /useEffect\(\(\) => \{ fitTextarea\(messageRef\.current\); \}, \[draft\]\);/);
  assert.match(cm, /<textarea ref=\{messageRef\} id=\{`message-\$\{match\.id\}`\}/);
  // {once:true} 듣기가 글자판이 안 뜨면 남아 있다 나중에 사라진 칸을 움직이던 것 → 1초·초점 빠짐에 지움 + 아직 그 칸에 초점일 때만
  assert.doesNotMatch(cm, /\{ once: true \}/);
  assert.match(cm, /const keepVisible = keepInputVisible;/);
  assert.match(k, /if \(el\.isConnected && document\.activeElement === el\) el\.scrollIntoView\(\{ block: 'center' \}\);/);
  assert.match(k, /timer = window\.setTimeout\(done, 1000\);/);
  assert.match(k, /el\.addEventListener\('blur', done\);/);
  const nav = read('src/doit/components/feature/BottomNav.tsx');
  assert.match(nav, /document\.addEventListener\("focusin", onIn\);/);
  // 다시 보일 때는 늦게(입력칸에서 바로 「보내기」를 누를 때 나타난 탭 줄이 누름을 가로채지 않게)
  assert.match(nav, /timer = window\.setTimeout\(\(\) => setTyping\(isTextField\(document\.activeElement\)\), SHOW_DELAY_MS\);/);
  assert.match(nav, /if \(typing\) return null;/);
});

test('P1 적던 말 지키기: sessionStorage 에만(localStorage 0) · 사용자 id + 화면/대화 id · 0.4초 쉬면 저장 · 화면 가려지면 바로 저장 · 다시 열면 빈 칸에만 되살림 · 보내면 지움', () => {
  const h = read('src/hooks/useDraftPersist.ts');
  assert.match(h, /window\.sessionStorage\.setItem\(key, value\)/);
  assert.doesNotMatch(noComments(h).replace(/\/\/.*$/gm, ''), /localStorage/);
  assert.match(h, /return `\$\{PREFIX\}\$\{screen\}:\$\{userId \|\| 'anon'\}\$\{sessionId \? `:\$\{sessionId\}` : ''\}`;/);
  assert.match(h, /document\.visibilityState === 'hidden'/);
  assert.match(h, /window\.addEventListener\('pagehide', flush\);/);
  assert.match(h, /try \{ return window\.sessionStorage\.getItem\(key\) \?\? ''; \} catch \{ return ''; \}/);
  assert.match(h, /const SAVE_DELAY_MS = 400;/);
  const uses = {
    'src/doit/components/feature/AgentConversation.tsx': /useDraftPersist\(session \? draftKey\('agent', userId, session\.id\) : null, draft, saved => setDraft\(prev => \(prev\.trim\(\) \? prev : saved\.slice\(0, TEXT_MAX\)\)\), !editingPrevious\)/,
    'src/doit/components/feature/CoreConversation.tsx': /useDraftPersist\(draftKey\('core', userId, roundStartedAt\), draft,/,
    'src/pages/do-it/components/StepQuestionScreen.tsx': /useDraftPersist\(conversationId \? draftKey\(`step-\$\{expectedStatus\}`, user\?\.id, conversationId\) : null, answer,/,
    'src/doit/pages/do-it/talk/page.tsx': /useDraftPersist\(draftKey\('talk', userId\), draft,/,
    'src/doit/pages/do-it/free-talk/page.tsx': /useDraftPersist\(draftKey\("free-talk", user\?\.id\), draft,/,
  };
  for (const [p, re] of Object.entries(uses)) {
    const s = read(p);
    assert.match(s, re, p);
    assert.match(s, /clearDraft\(\)/, `${p}: 보내면 지움`);
  }
});

test('P2 Fold 접은 화면 280px: 사주 오행 다섯 칸이 줄어들 수 있음(minmax(0,1fr)) · 점은 칸보다 크지 않음(390px 폰에서는 그대로 40px)', () => {
  const s = noComments(read('src/doit/app/plan-a/screens/saju.css'));
  assert.match(s, /\.saju-elements\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\);gap:6px;text-align:center\}/);
  assert.match(s, /\.saju-dot\{display:grid;place-items:center;width:40px;height:40px;/);
  assert.match(s, /@supports \(aspect-ratio:1\)\{\.saju-dot\{width:min\(40px,100%\);height:auto;aspect-ratio:1\}\}/);
});

test('P2 높이 폴백 · 당겨서 새로고침: 100lvh 앞에 100vh · 대화 화면에서만 html overscroll-behavior-y:none(스크롤 그대로)', () => {
  const flora = read('src/doit/components/feature/flora-theme.css');
  assert.match(flora, /\.doit-flora-backdrop\{position:fixed;inset:0;width:100vw;height:100vh;/);
  assert.match(flora, /@supports \(height:100lvh\)\{\.doit-flora-backdrop\{height:100lvh\}\}/);
  const css = read('src/index.css');
  assert.match(css, /html:has\(\.echo-dialogue\.echo-chat\) \{\s*overscroll-behavior-y: none;\s*\}/);
  assert.doesNotMatch(noComments(css), /html\s*\{[^}]*overscroll-behavior/, '모든 화면 전역 0');
});

test('금지어·가격 0(이번 변경 파일)', () => {
  const files = ['src/hooks/useBackClose.ts', 'src/hooks/useStepHistory.ts', 'src/hooks/useDraftPersist.ts', 'src/lib/keyboard.ts', 'src/components/RouteScrollReset.tsx', 'src/doit/components/feature/BottomNav.tsx'];
  const all = files.map(read).join('\n');
  assert.doesNotMatch(all, /데이팅|소개팅|궁합|점술|심리치료|성격검사/);
  assert.doesNotMatch(all, /[0-9,]+\s*원\b|₩/);
});

test('사진 창·카메라 창도 휴대폰 「뒤로」로 그 창만 닫힘(useBackClose) · 저장 중엔 닫지 않음', () => {
  const pc = readFileSync(new URL('../src/doit/app/plan-a/screens/PhotoCapture.tsx', import.meta.url), 'utf8');
  assert.match(pc, /useBackClose\(true, \(\) => \{ if \(!busyRef\.current\) onClose\(\); \}\);/);
  const cam = readFileSync(new URL('../src/doit/app/plan-a/components/CameraSheet.tsx', import.meta.url), 'utf8');
  assert.match(cam, /useBackClose\(true, onClose\);/);
});
