// 2026-09-26 대표 「FINAL HUMAN UX / DESIGN / PRODUCT STRUCTURE」 검사(파일·순수 함수). 화면 픽셀·경로 실측은 따로(브라우저 검사).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(path.join(root, p), 'utf8');
async function loadView() {
  const dir = mkdtempSync(path.join(tmpdir(), 'uview-'));
  const api = `export const AGENT_PURPOSE_LABELS = { relationship_intent: '원하는 만남', attraction_comfort: '편하거나 끌리는 사람', values_character: '사람을 볼 때 중요한 것', relationship_style: '알아가는 방식과 속도', boundaries: '꼭 있었으면 하는 것 · 피하고 싶은 것' };`;
  writeFileSync(path.join(dir, 'agentApi.mjs'), api);
  const js = ts.transpileModule(read('src/doit/lib/understandingView.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("'@/doit/lib/agentApi'", "'./agentApi.mjs'");
  writeFileSync(path.join(dir, 'view.mjs'), js);
  return import(pathToFileURL(path.join(dir, 'view.mjs')).href);
}

test('나의 이해: 같은 뜻 중복 → 최근 것 하나만 지금의 나 · 나머지는 지난 기록(삭제 0)', async () => {
  const V = await loadView();
  assert.equal(V.sameMeaning('연애는 하고 싶어요', '연애는 하고 싶다'), true);
  assert.equal(V.sameMeaning('주말에 한 번 만나는 것이 편하다', '매일이 아니라 주말에 한 번이 편해요'), true);
  assert.equal(V.sameMeaning('약속을 잘 지키는 사람', '약속 지키는 사람이 좋아요'), true);
  assert.equal(V.sameMeaning('차분한 사람', '활발한 사람'), false);
  assert.equal(V.sameMeaning('같이 있으면 편한 사람', '같이 있으면 불편한 사람'), false, '반대 말은 같은 뜻 아님');
  assert.equal(V.sameMeaning('가식 없는 진심이 중요하다', '취미가 비슷하면 좋다'), false);
  const it = (key, text, order) => ({ key, text, area: V.areaOf(text), origin: 'confirmed', order });
  const { current, past } = V.splitCurrent([it('a', '연애는 하고 싶어요', 1), it('b', '연애는 하고 싶다', 2), it('c', '주말에 한 번 만나는 것이 편하다', 3), it('d', '매일이 아니라 주말에 한 번이 편해요', 4), it('e', '가식 없는 진심이 중요하다', 5)]);
  assert.deepEqual(current.map((x) => x.key).sort(), ['b', 'd', 'e']);
  assert.deepEqual(past.map((x) => x.key).sort(), ['a', 'c']);
});

test('나의 이해: 다섯 칸 분류(대표 예시 그대로) · 애매하면 「아직 나누지 않은 말」', async () => {
  const V = await loadView();
  assert.equal(V.areaOf('연애는 하고 싶다'), 'relationship_intent');
  assert.equal(V.areaOf('취미생활이 같으면 좋다'), 'attraction_comfort');
  assert.equal(V.areaOf('가식 없는 진심이 중요하다'), 'values_character');
  assert.equal(V.areaOf('천천히 깊게 알고 싶다'), 'relationship_style');
  assert.equal(V.areaOf('주말에 한 번 만나는 게 편하다'), 'relationship_style');
  assert.equal(V.areaOf('담배 피우는 사람은 좀 싫어요'), 'boundaries');
  assert.equal(V.areaOf('조용한 카페를 좋아한다'), 'unsorted');
  const page = read('src/doit/pages/do-it/understanding/page.tsx');
  assert.match(page, /<h2>지금의 나<\/h2>/); assert.match(page, /지난 기록 보기/); assert.match(page, /처음 남긴 이야기 보기/);
  assert.doesNotMatch(page, /중요한 가치|반복 경향|기억할 선택/, '예전 세 분류 탭 없음');
  assert.match(read('src/doit/pages/do-it/home/page.tsx'), /splitCurrent\(/, '홈 숫자도 겹침 없이');
});

test('숨김: Just Try·KEY·등급·공간·월드·방·알림·예전 A/B 흐름 · 파일과 주소 정의는 보존', () => {
  const scope = read('src/doit/lib/releaseScope.ts');
  assert.ok(!scope.includes("'/doit/fortune':"), '사주·타로는 숨기지 않는다(2026-09-26 대표 정정)');
  for (const p of ['/doit/just-try', '/doit/key', '/doit/grade', '/doit/spaces', '/doit/world', '/doit/room', '/doit/notifications', '/doit/choose', '/doit/first-record', '/weather', '/report', '/locker', '/coming-soon/:feature']) assert.ok(scope.includes(`'${p}'`), p);
  assert.doesNotMatch(scope, /'\/payment/, '결제 경로는 이번 범위 밖(그대로)');
  const routes = read('src/doit/routes.tsx');
  assert.match(routes, /const gate = \(to: string, element: ReactElement\) => \(visibleInRelease\(to\) \? element : <Navigate to="\/doit\/home" replace \/>\);/);
  const cfg = read('src/router/config.tsx');
  assert.match(cfg, /\{ path: '\/weather', element: visibleInRelease\('\/weather'\) \? <WeatherPage \/> : <Navigate to="\/doit\/home" replace \/> \}/);
  assert.match(cfg, /\{ path: '\/payment', element: <PaymentPage \/> \}/);
  assert.match(read('src/doit/pages/do-it/choose/page.tsx'), /onSkipToFortune=\{visibleInRelease\("\/doit\/fortune"\) \?/);
});

test('햄버거: 유리 판(검정 0) · 메뉴는 대화·나의 이해·홈 화면 추가·설정', () => {
  const top = read('src/doit/components/feature/TopBar.tsx');
  assert.match(top, /className="doit-menu-panel fixed right-4/);
  assert.match(top, /createPortal\(/, "머리줄 흐림 밖으로 옮겨 그린다(겹친 흐림 방지)");
  assert.doesNotMatch(top, /bg-background-50|hover:bg-background/);
  for (const t of ['ECHO와 이야기하기', '나의 이해', '홈 화면에 ECHO 추가', '설정']) assert.ok(top.includes(`label: "${t}"`), t);
  const ui = read('src/doit/components/feature/echo-ui.css');
  // 2026-09-26 「FINAL CLOSEOUT」 §1: 햄버거만 예외 — 불투명 파스텔 그라데이션 · 흐림 0(뒤 글자 비침 0) · 글자 흰색만
  assert.match(ui, /\.doit-menu-panel\{background:linear-gradient\(165deg,#2fbf97 0%,#27b3bd 38%,#c9a444 74%,#d0785a 100%\);opacity:1;-webkit-backdrop-filter:none;backdrop-filter:none;/);
  assert.match(ui, /\.doit-menu-panel \*\{color:#fff!important;/);
});

test('ECHO UI 한 벌: 글꼴 Pretendard 하나 · 굵기 4단계(800/700/700/600) · 가는 글자 0 · 흐린 글자 흰색 · 검정 채움 → 유리 · 누른 상태도 흰 막', () => {
  const ui = read('src/doit/components/feature/echo-ui.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(ui, /--echo-font:'Pretendard'/);
  assert.match(ui, /:not\(i\)[^{]*\{font-family:var\(--echo-font\)!important;-webkit-text-stroke:0!important\}/);
  for (const w of ['800', '700', '600']) assert.match(ui, new RegExp(`font-weight:${w}!important`));
  assert.doesNotMatch(ui, /font-weight:(300|400)/);
  assert.match(ui, /\[class\*=" bg-background-"\][^{]*\{background-color:var\(--echo-glass\)!important/);
  assert.match(ui, /:not\(:disabled\):active\{background-color:var\(--echo-glass-press\)!important\}/);
  assert.doesNotMatch(ui, /#0[0-9a-f]{5}\b|#1[0-9a-f]{5}\b|rgb\(0 0 0|rgba\(0,\s*0,\s*0/i, '검정·짙은 색 0');
  for (const f of ['src/doit/components/feature/core-conversation.css', 'src/doit/components/feature/app-pastel.css']) assert.match(read(f), /@import "\.\/echo-ui\.css";/, f);
  for (const f of ['src/pages/login/page.tsx', 'src/pages/signup/page.tsx', 'src/pages/legal/LegalDocument.tsx', 'src/pages/legal/consent/page.tsx']) assert.match(read(f), /doit-app-pastel/, `${f} 파스텔`);
  assert.doesNotMatch(read('src/doit/app/plan-a/screens/PhotoCapture.tsx'), /#242832|#11141a|rgba\(0,0,0,\.78\)|bg-black\/65|#090b10/, '사진 창 검정 0');
  assert.match(read('src/lib/themeColor.ts'), /\(login\|signup\|legal\)/);
});

test('사람 말투: AI·기획서 냄새 문구 교체 · 준비 중 칸 삭제 · 「AI가 먼저 만나봅니다」(연결 화면) 교체 — 히어로 문구는 그대로', () => {
  const home = read('src/doit/pages/do-it/home/page.tsx');
  assert.doesNotMatch(home, /AI가 알아들은 것 중|여기에 답한 말로<br \/>어떤 사람을 소개할지 정해요|대화와 기록을 준비하고 있어요/);
  assert.match(home, /찾는 건 ECHO가 할게요/);
  const set = read('src/doit/pages/do-it/settings/page.tsx').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.doesNotMatch(set, /아직 제공하지 않아요|활동 · KEY · 미션 알림/);
  assert.doesNotMatch(read('src/doit/components/feature/AsleepConnections.tsx'), /const HEADLINE = <>당신이 잠든 사이,<br \/>AI가 먼저 만나봅니다\.<\/>/);
  assert.match(read('src/pages/do-it/hero/page.tsx'), /AI가 먼저 만나봅니다/, '히어로는 변경 0');
  assert.doesNotMatch(read('src/doit/pages/do-it/profile/page.tsx'), /지금의 나를 천천히 담아보세요/);
});

test('대화 서버 말투(v2.3)는 제안 패치만 — 운영 v2.2·저장소 agent.ts 그대로', () => {
  assert.match(read('supabase/functions/doit-agent/agent.ts'), /export const AGENT_VERSION = "echo-agent-v2\.2";/);
  const patch = read('docs/proposals/doit-agent-v2.3-human-tone.patch');
  assert.match(patch, /\+export const AGENT_VERSION = "echo-agent-v2\.3";/);
  assert.match(patch, /좋은 방법이죠/);
  assert.match(patch, /\+export const FIRST_QUESTION = "요즘은 어떤 만남이면 좋겠다 싶어요\?";/);
});
