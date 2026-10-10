// 사주·타로 시작 그림(2026-10-06 대표 지정 · 2026-10-10 「사주 타로 첫화면에 타로 2번째 · 사주 7번째 이미지 박아」로 다시 넣음):
// 파일 2장 존재 · 첫 화면 카드·시작 화면·홈 문이 저장소 경로를 쓴다 · 장식용(alt 빈 값).
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

test('첫 화면(SajuTaroEntry) 사주 카드 = saju-start · 타로 카드 = tarot-start · 후킹 한 줄', () => {
  const e = read('src/doit/app/plan-a/screens/SajuTaroEntry.tsx');
  assert.match(e, /label="무료 사주"[\s\S]{0,200}image="\/doit\/art\/saju-start\.webp"\s*hook="[^"]+"/);
  assert.match(e, /label="무료 타로"[\s\S]{0,200}image="\/doit\/art\/tarot-start\.webp"\s*hook="[^"]+"/);
  assert.match(e, /className="echo-fortune-art"[\s\S]{0,60}alt=""/);
});

test('타로 시작(TaroCardSelect) = tarot-start · 사주 시작(SajuInput) = saju-start · 홈 문 2장', () => {
  const taro = read('src/doit/app/plan-a/screens/TaroCardSelect.tsx');
  const saju = read('src/doit/app/plan-a/screens/SajuInput.tsx');
  assert.match(taro, /src="\/doit\/art\/tarot-start\.webp"[\s\S]{0,200}alt=""/);
  assert.match(saju, /src="\/doit\/art\/saju-start\.webp"[\s\S]{0,200}alt=""/);
  assert.doesNotMatch(taro, /saju-start/); assert.doesNotMatch(saju, /tarot-start/);
  assert.doesNotMatch(taro + saju, /helloreaddy/);
  const doors = read('src/doit/components/feature/FortuneDoors.tsx');
  assert.match(doors, /<img src="\/doit\/art\/saju-start\.webp" alt=""/); assert.match(doors, /<img src="\/doit\/art\/tarot-start\.webp" alt=""/);
});
