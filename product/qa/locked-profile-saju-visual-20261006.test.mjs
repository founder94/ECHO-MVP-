// 2026-10-06 대표: 추가 사진 65/35 · 스토리 자물쇠 · KEY 몇 개 안내 · 사주 그림 화면 · 홈 사주/타로 그림 문. 가짜 데이터 · 서버·AI·KEY 차감 호출 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
function load(rel, deps = {}) {
  const js = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require: (n) => { if (n in deps) return deps[n]; throw new Error('Unexpected ' + n); } });
  return module.exports;
}

test('KEY 값은 한 곳(unlockPrices): 스토리 30 · 추가 사진 20 · 아직 실제로 열리지 않음', () => {
  const m = load('src/doit/lib/unlockPrices.ts');
  assert.equal(m.UNLOCK_KEY_COST.story, 30);
  assert.equal(m.UNLOCK_KEY_COST.extraPhoto, 20);
  assert.equal(m.UNLOCK_LIVE, false);
  assert.equal(m.unlockLabel('story'), 'KEY 30개로 열기');
  assert.equal(m.viewerSees(5, { isOwner: false, unlocked: false, baseCount: 5 }), 'faded');
  assert.equal(m.viewerSees(4, { isOwner: false, unlocked: false, baseCount: 5 }), 'full');
  assert.equal(m.viewerSees(5, { isOwner: true, unlocked: false, baseCount: 5 }), 'full');
  assert.equal(m.viewerSees(5, { isOwner: false, unlocked: true, baseCount: 5 }), 'full');
});

test('잠긴 조각: KEY 를 빼는 코드·서버 호출이 없다(준비 중 안내만)', () => {
  for (const f of ['src/doit/components/feature/LockedProfileParts.tsx', 'src/doit/components/feature/ProfileAsOthersSee.tsx']) {
    const s = read(f);
    assert.ok(!/deductKeys|useKeyWallet|functions\.invoke|\.insert\(|\.update\(|fetch\(/.test(s), f);
  }
  const p = read('src/doit/components/feature/LockedProfileParts.tsx');
  assert.ok(p.includes('EXTRA_PHOTO_VISIBLE_PERCENT'), '65% 는 정책 값에서 온다');
  assert.ok(p.includes('<Lock') && p.includes('doit-story-lock-btn'), '자물쇠가 스토리 버튼 안에');
  assert.ok(p.includes('KEY도 쓰지 않아요') && p.includes('아직 KEY를 쓰지 않아요'), '준비 중 정직 안내');
  assert.ok(!/놓치면|마지막 기회|서두르/.test(p.replace(/^\s*\/\/.*$/gm, '')), '불안 자극 문구 금지(주석 제외)');
});

test('페이드 CSS: 위 65%는 그대로, 경계 아래부터 흐림 · 전역 변경 0', () => {
  const c = read('src/doit/components/feature/locked-profile.css');
  assert.ok(c.includes('var(--doit-visible)') && c.includes('blur('));
  assert.ok(!/(^|\})\s*(body|:root|html)\s*[,{]/.test(c));
});

test('사진 화면: 추가 사진 칸은 대표 사진으로 못 고르고, 위쪽만 보인다고 먼저 알린다', () => {
  const s = read('src/doit/app/plan-a/screens/PhotoCapture.tsx');
  assert.ok(s.includes('savedPhoto && !isExtraSlot(index) &&'));
  assert.ok(s.includes('상대에겐 위 {EXTRA_PHOTO_VISIBLE_PERCENT}%만'));
  assert.ok(s.includes('기본 {savedList.filter((p) => !isExtraSlot(p.slot)).length} / {PHOTO_BASE_COUNT}장'));
});

test('내 프로필에 「다른 사람에게는 이렇게 보여요」 · 대표 사진은 칸과 상관없이 그대로', () => {
  assert.ok(read('src/doit/pages/do-it/profile/page.tsx').includes('<ProfileAsOthersSee'));
  const s = read('src/doit/components/feature/ProfileAsOthersSee.tsx');
  assert.ok(s.includes('isExtraSlot(p.slot) && !p.isPrimary'));
});

test('2단계 DB 초안은 drafts 에만(PENDING) · migrations 에 없다', () => {
  assert.ok(existsSync(path.join(root, 'supabase/drafts/PENDING_20261006_extra_photos_story_keys.sql')));
  const mig = readdirSync(path.join(root, 'supabase/migrations')).join('\n');
  assert.ok(!/extra_photos_story_keys/.test(mig));
  const sql = read('supabase/drafts/PENDING_20261006_extra_photos_story_keys.sql');
  assert.ok(sql.includes("('story_unlock', 30") && sql.includes("('extra_photo_unlock', 20"), '앱 값과 같다');
});

test('사주 결과: 기운 색 타일 · 다섯 기운 바퀴 · 장 번호 · 금지어 0', () => {
  const s = read('src/doit/app/plan-a/screens/SajuResult.tsx');
  for (const k of ['function Tile', 'function ElementWheel', 'saju-hero', '1 · 나', '3 · 다섯 기운', 'saju-next']) assert.ok(s.includes(k), k);
  assert.ok(!/PillarBox|EL_COLOR/.test(s), '옛 칸 정리');
  const css = read('src/doit/app/plan-a/screens/saju.css');
  for (const k of ['.saju-tile', '.saju-wheel', '.saju-hero', '.saju-step', '.saju-col']) assert.ok(css.includes(k), k);
});

test('홈: 사주·타로 그림 문 → 바로 입력 화면(mode 주소) · 이미지 파일 있음', () => {
  const d = read('src/doit/components/feature/FortuneDoors.tsx');
  assert.ok(d.includes('/doit/fortune?mode=saju') && d.includes('/doit/fortune?mode=taro'));
  assert.ok(d.includes('나의 이해나 연결에는 쓰지 않아요'));
  for (const f of ['public/doit/art/saju-start.webp', 'public/doit/art/tarot-start.webp']) assert.ok(existsSync(path.join(root, f)), f);
  assert.ok(read('src/doit/pages/do-it/home/page.tsx').includes('<FortuneDoors'));
  const f = read('src/doit/pages/do-it/fortune/page.tsx');
  assert.ok(f.includes('const deepMode: Mode | null = !backToTaro && (deep === "saju" || deep === "taro") ? deep : null;'));
  assert.match(f, /if \(deepMode && !deepApplied\) \{\n\s*setDeepApplied\(true\);\n\s*setMode\(deepMode\);\n\s*setStep\("input"\);/);
});

// Codex PR #141 b7a8bb4 P1: 프로필 화면이 그대로 있는 채 계정이 A → B 로 바뀌면, B 의 사진을 받기 전에도 A 의 사진·실패 표시가 보이면 안 된다.
// 작은 가짜 React(상태·효과만)로 컴포넌트를 실제로 돌린다(모의 — 브라우저 아님).
test('Codex P1: 계정이 바뀌면 앞 계정 사진이 한 장도 보이지 않음(새 사진을 받기 전에도)', async () => {
  const ts = (await import('typescript')).default;
  const code = ts.transpileModule(read('src/doit/components/feature/ProfileAsOthersSee.tsx'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const slots = []; let si = 0; const effects = []; let ei = 0;
  const React = {
    useState(init) { const i = si++; if (!(i in slots)) slots[i] = init; return [slots[i], (v) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useEffect(fn, deps) { const i = ei++; const prev = effects[i]; if (!prev || deps.some((d, k) => d !== prev.deps[k])) { prev?.cleanup?.(); effects[i] = { deps, cleanup: undefined, run: fn }; } },
  };
  const pending = {};
  const mods = {
    react: React,
    'react/jsx-runtime': { jsx: (t, p) => ({ t, p }), jsxs: (t, p) => ({ t, p }), Fragment: 'F' },
    '@/doit/lib/photoStorage': { restorePhotos: (uid) => new Promise((res) => { pending[uid] = res; }) },
    '@/doit/lib/photoPolicy': { PHOTO_BASE_COUNT: 5, isExtraSlot: (s) => s >= 5 },
    '@/doit/components/feature/LockedProfileParts': { FadedExtraPhoto: 'FadedExtraPhoto', StoryLockButton: 'StoryLockButton' },
    './locked-profile.css': {},
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((m) => mods[m], module, module.exports);
  const Comp = module.exports.default;
  const render = (userId) => { si = 0; ei = 0; const tree = Comp({ userId }); for (const e of effects) if (e.run) { const r = e.run; e.run = undefined; e.cleanup = r(); } return tree; };
  const srcs = (n, out = []) => { if (!n || typeof n !== 'object') return out; if (Array.isArray(n)) { n.forEach((x) => srcs(x, out)); return out; } if (n.p?.src) out.push(n.p.src); srcs(n.p?.children, out); return out; };
  render('A');
  pending.A([{ photoId: 'a1', slot: 0, url: 'https://x/A-private.jpg', isPrimary: true }]);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(srcs(render('A')), ['https://x/A-private.jpg'], 'A 는 자기 사진을 본다');
  const treeB = render('B');
  assert.deepEqual(srcs(treeB), [], 'B 로 바뀐 순간 A 사진 0');
  assert.deepEqual(srcs(render('B')), [], 'B 를 받기 전 다시 그려도 A 사진 0');
  pending.A?.([]);
  pending.B([{ photoId: 'b1', slot: 0, url: 'https://x/B.jpg', isPrimary: true }]);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(srcs(render('B')), ['https://x/B.jpg']);

  // Codex PR #141 4500978 P2: 불러오기 실패 = 「사진 없음」이 아니라 실패 안내 + 다시 불러오기
  const texts = (n, out = []) => { if (n == null || typeof n === 'boolean') return out; if (typeof n === 'string') { out.push(n); return out; } if (Array.isArray(n)) { n.forEach((x) => texts(x, out)); return out; } texts(n.p?.children, out); return out; };
  const buttons = (n, out = []) => { if (!n || typeof n !== 'object') return out; if (Array.isArray(n)) { n.forEach((x) => buttons(x, out)); return out; } if (n.t === 'button') out.push(n); buttons(n.p?.children, out); return out; };
  render('C');
  let rejectC; const firstC = new Promise((_, rej) => { rejectC = rej; }); firstC.catch(() => {});
  delete pending.C;
  mods['@/doit/lib/photoStorage'].restorePhotos = (uid) => uid === 'C' && rejectC ? (() => { const r = rejectC; rejectC = null; return new Promise((_, rej) => r && rej(new Error('net'))) ; })() : new Promise((res) => { pending[uid] = res; });
  si = 0; ei = 0; effects.length = 0; slots.length = 0;
  render('C');
  await new Promise((r) => setTimeout(r, 0));
  const failTree = render('C');
  const t = texts(failTree).join(' ');
  assert.ok(t.includes('사진을 불러오지 못했어요'), t);
  assert.ok(!t.includes('사진을 올리면'), '실패를 「사진 없음」으로 보이지 않음');
  const retry = buttons(failTree).find((b) => texts(b).join('').includes('다시 불러오기'));
  assert.ok(retry, '다시 불러오기 버튼');
  retry.p.onClick();
  render('C');
  assert.equal(typeof pending.C, 'function', '다시 누르면 사진을 새로 받음');
  pending.C([{ photoId: 'c1', slot: 0, url: 'https://x/C.jpg', isPrimary: true }]);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(srcs(render('C')), ['https://x/C.jpg']);

  // Codex 1add81c P2: 목록은 받았는데 사진 한 장이 실패 → 그 칸에 「다시 불러오기」 → 누르면 주소를 새로 받고 실패 표시가 사라짐
  const imgs = (n, out = []) => { if (!n || typeof n !== 'object') return out; if (Array.isArray(n)) { n.forEach((x) => imgs(x, out)); return out; } if (n.p?.onError) out.push(n); imgs(n.p?.children, out); return out; };
  imgs(render('C'))[0].p.onError();
  const broken = render('C');
  assert.deepEqual(srcs(broken), [], '실패한 칸은 그림 대신 안내');
  const again = buttons(broken).find((b) => texts(b).join('').includes('다시 불러오기'));
  assert.ok(again, '사진 한 장 실패에도 다시 불러오기');
  delete pending.C;
  again.p.onClick();
  render('C');
  assert.equal(typeof pending.C, 'function', '주소를 새로 받음');
  pending.C([{ photoId: 'c1', slot: 0, url: 'https://x/C2.jpg', isPrimary: true }]);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(srcs(render('C')), ['https://x/C2.jpg']);
});
