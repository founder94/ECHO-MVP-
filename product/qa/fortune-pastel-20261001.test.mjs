// 2026-10-01 대표 결정 「Saju / Tarot = ECHO 파스텔 세계관 유지」 — 완전한 어두운 앱 분리 0 · 빛·깊이·재질·글자만 다르게.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const page = read('src/doit/pages/do-it/fortune/page.tsx');
const css = read('src/doit/pages/do-it/fortune/fortune-space.css').replace(/\/\*[\s\S]*?\*\//g, '');
const screens = ['SajuTaroEntry', 'SajuInput', 'TaroCardSelect', 'FreeResult', 'FreeResult.parts'].map((f) => [f, read(`src/doit/app/plan-a/screens/${f}.tsx`)]);

test('사주·타로 모든 단계가 같은 파스텔 공간(.doit-app-pastel) 안 · 빈 조각(<>) 0', () => {
  assert.match(page, /className="doit-app-pastel echo-fortune-space"/);
  assert.equal((page.match(/<FortuneSpace>/g) ?? []).length, 5, '입구 · 사주 입력 · 타로 · 사주 결과 · 타로 결과');
  assert.doesNotMatch(page, /<>/);
  assert.match(page, /import "@\/doit\/components\/feature\/app-pastel\.css";/);
});

test('어두운 전용 바탕 0: 화면들이 바탕·판·흐린 글자에 공통 토큰(surfaces)만 쓴다', () => {
  for (const [f, s] of screens) assert.doesNotMatch(s, /colors\.(bg|bgDeep|surface|textMuted|textFaint)\b/, f);
  assert.match(css, /\.echo-fortune-space \.saju-page\{background:transparent\}/);
  assert.match(css, /--app-page:transparent/);
});

test('다른 방 느낌 = 빛·깊이·재질·글자만(색 세계 교체 0 · 움직임·흐림 추가 0 · 전역 0)', () => {
  assert.match(css, /\.echo-fortune-light\{position:fixed[^}]*radial-gradient/, '빛');
  assert.match(css, /--fortune-shadow:/, '깊이');
  assert.match(css, /repeating-linear-gradient/, '재질(결)');
  assert.match(css, /Noto Serif KR/, '글자');
  assert.doesNotMatch(css, /animation|backdrop-filter|filter:blur/);
  assert.doesNotMatch(css, /(^|[\s,}])(body|html|:root)\s*[{,]/);
  assert.doesNotMatch(css, /#0a0d14|#07090f|#1d2340/i, '예전 어두운 남색 바탕 0');
});
