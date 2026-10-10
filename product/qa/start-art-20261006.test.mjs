// 사주·타로 시작 화면 그림(2026-10-06 대표 지정) → 2026-10-10 대표 「기존 디자인 다 삭제 · 심볼만 살려」로 삭제.
// 이 검사는 그림이 다시 들어오지 않는지 지킨다(시작 화면 바탕 = Flora 밤 들판).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const R = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, R), 'utf8');

test('시작 그림 2장 삭제: public/doit/art 에 없다', () => {
  for (const f of ['tarot-start', 'saju-start']) assert.ok(!existsSync(new URL(`public/doit/art/${f}.webp`, R)), `${f}.webp 삭제`);
});

test('타로 시작(TaroCardSelect) · 사주 시작(SajuInput) · 홈 문: 시작 그림 참조 0', () => {
  const taro = read('src/doit/app/plan-a/screens/TaroCardSelect.tsx');
  const saju = read('src/doit/app/plan-a/screens/SajuInput.tsx');
  const doors = read('src/doit/components/feature/FortuneDoors.tsx');
  for (const s of [taro, saju, doors]) assert.doesNotMatch(s, /tarot-start|saju-start|doit-start-art/);
  assert.doesNotMatch(taro + saju, /helloreaddy/);
});
