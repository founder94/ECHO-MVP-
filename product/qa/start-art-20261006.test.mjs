// 사주·타로 시작 화면 그림(2026-10-06 대표 지정): 파일 2장 존재 · 각 화면이 저장소 경로를 쓴다 · 장식용(alt 빈 값).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
const R = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, R), 'utf8');

test('시작 그림 2장이 public/doit/art 에 있다', () => {
  for (const f of ['tarot-start', 'saju-start']) {
    const st = statSync(new URL(`public/doit/art/${f}.webp`, R));
    assert.ok(st.size > 20_000 && st.size < 300_000, `${f}.webp 크기 ${st.size}`);
  }
});

test('타로 시작(TaroCardSelect) = tarot-start · 사주 시작(SajuInput) = saju-start', () => {
  const taro = read('src/doit/app/plan-a/screens/TaroCardSelect.tsx');
  const saju = read('src/doit/app/plan-a/screens/SajuInput.tsx');
  assert.match(taro, /src="\/doit\/art\/tarot-start\.webp"[\s\S]{0,200}alt=""/);
  assert.match(saju, /src="\/doit\/art\/saju-start\.webp"[\s\S]{0,200}alt=""/);
  assert.doesNotMatch(taro, /saju-start/); assert.doesNotMatch(saju, /tarot-start/);
  assert.doesNotMatch(taro + saju, /helloreaddy/);
});
