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

// 2026-10-10 대표 「기존 디자인 다 삭제 · 심볼만 살려」: 따뜻한 빛·결 무늬 삭제 — 사주·타로도 앱과 같은 Flora 밤 들판 · 판은 Flora 유리.
test('사주·타로 = 앱과 같은 Flora 바탕(따뜻한 빛·결 0) · 깊이(그림자)만 · 움직임·흐림 추가 0 · 전역 0', () => {
  assert.match(css, /\.echo-fortune-light\{display:none\}/, '따뜻한 빛 0');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /repeating-linear-gradient|255 244 214|#f4ead2|#fff6dc/, '옛 따뜻한 빛·결·베이지 0');
  assert.match(css, /--fortune-shadow:/, '깊이');
  assert.match(css, /--app-surface-border:rgb\(255 255 255\/\.16\)/, 'Flora 얇은 선');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /Serif|Myeongjo|Myungjo|Georgia/, '명조 제목 0(2026-10-01 DESIGN 100%: Pretendard 한 벌)');
  assert.doesNotMatch(css, /animation|backdrop-filter|filter:blur/);
  assert.doesNotMatch(css, /(^|[\s,}])(body|html|:root)\s*[{,]/);
  assert.doesNotMatch(css, /#0a0d14|#07090f|#1d2340/i, '예전 어두운 남색 바탕 0');
});

test('사주·타로: 위 여백이 safe-area 를 포함해 「뒤로」 알약 아래에서 시작(iPhone PWA 가림 0) · 결과 화면은 두 번 더하지 않음', () => {
  const css = readFileSync('src/doit/pages/do-it/fortune/fortune-space.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.echo-fortune-space\{padding-top:calc\(env\(safe-area-inset-top\) \+ 16px\)\}/);
  assert.match(css, /\.echo-fortune-space \.saju-page\{padding-top:40px\}/);
  assert.match(readFileSync('src/components/app-back-button.css', 'utf8'), /\.doit-back-pill\{position:absolute;top:calc\(env\(safe-area-inset-top\) \+ 8px\)/);
});
