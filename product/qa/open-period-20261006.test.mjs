// 2026-10-06 대표 「①②③ 넣어」: 오픈 기간 무료 문장 — 가격 숫자 0 · 조급함 자극 0 · 회사 사정(심사) 0 · 네 화면에 들어감 · 문장은 한 파일에서만.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const OP = src('src/doit/lib/openPeriod.ts');
const texts = [...OP.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

test('오픈 기간 문장: 가격 숫자 0 · 서둘러·한정·곧 유료·심사 0 · 「오픈 기간」 포함', () => {
  assert.equal(texts.length, 3);
  for (const t of texts) {
    assert.doesNotMatch(t, /\d/, t);
    assert.doesNotMatch(t, /서둘러|한정|곧 유료|마감|심사|놓치/, t);
    assert.match(t, /오픈 기간/, t);
  }
  assert.match(OP, /active: true/);
});

test('네 화면이 같은 문장을 씀(홈 · 타로 결과 · 사주 결과 · KEY) · KEY 화면 데모 숫자 0', () => {
  for (const f of ['src/doit/pages/do-it/home/page.tsx', 'src/doit/app/plan-a/screens/FreeResult.tsx', 'src/doit/app/plan-a/screens/SajuResult.tsx', 'src/doit/pages/do-it/key/page.tsx']) {
    assert.match(src(f), /import \{ OPEN_PERIOD \} from "@\/doit\/lib\/openPeriod";/, f);
  }
  assert.match(src('src/doit/pages/do-it/home/page.tsx'), /OPEN_PERIOD\.active && <p className="doit-open-period">\{OPEN_PERIOD\.home\}<\/p>/);
  assert.match(src('src/doit/app/plan-a/screens/FreeResult.tsx'), /\{OPEN_PERIOD\.result\}/);
  assert.match(src('src/doit/app/plan-a/screens/SajuResult.tsx'), /\{OPEN_PERIOD\.result\}/);
  const key = src('src/doit/pages/do-it/key/page.tsx');
  assert.match(key, /\{OPEN_PERIOD\.key\}/);
  assert.doesNotMatch(key, /데모 잔액이에요|화면 데모용 예시|KEY 내역 \(데모 예시\)/);
  assert.match(key, /\{isDemo \? "—" : total\}/);
  assert.match(key, /\(isDemo \? \[\] : history\)\.map/);
  assert.match(src('src/doit/components/feature/product-brand.css'), /\.doit-open-period\{/);
});
