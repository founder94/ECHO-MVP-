// 타로 원화 6장 = 저장소 보관(2026-10-06 대표 「그림 복사해」). 외부 서버(Readdy) 주소 0 · 파일 6장 존재 · 두 지도 동일.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
const R = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, R), 'utf8');
const SHEETS = ['tarot-major-0-10', 'tarot-major-11-21', 'tarot-wands', 'tarot-cups', 'tarot-swords', 'tarot-pentacles'];
const KEYS = ['majorA', 'majorB', 'wands', 'cups', 'swords', 'pentacles'];

test('타로 원화 6장이 public/doit/tarot 에 있고 비어 있지 않다', () => {
  for (const s of SHEETS) {
    const st = statSync(new URL(`public/doit/tarot/${s}.webp`, R));
    assert.ok(st.size > 100_000 && st.size < 1_000_000, `${s}.webp 크기 ${st.size}`);
  }
});

for (const p of ['src/doit/app/plan-a/components/TarotCardArt.tsx', 'src/pages/do-it/fortune/cardArt.ts']) {
  test(`${p}: 시트 주소 = 저장소 경로 · 외부 서버 0`, () => {
    const src = read(p);
    assert.doesNotMatch(src, /helloreaddy|readdy\.io/i);
    KEYS.forEach((k, i) => assert.match(src, new RegExp(`${k}:\\s*["']/doit/tarot/${SHEETS[i]}\\.webp["']`)));
  });
}
