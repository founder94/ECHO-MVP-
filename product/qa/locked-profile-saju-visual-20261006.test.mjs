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
  assert.ok(f.includes('deep === "saju" || deep === "taro" ? "input" : "entry"'));
});
