// 2026-09-27 대표 「QA FINAL FIX」: 앱 주소(app 빌드) 첫 화면 = 모바일 제품(브랜드 히어로 0) · 히어로 「움직임 줄이기」 버튼 제거.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('라우터: app 빌드의 / 는 제품 입구로 · 브랜드·통합 빌드는 랜딩(히어로) 그대로', () => {
  const s = read('src/router/config.tsx');
  assert.match(s, /const entryLanding = ROLE === 'app' \? <Navigate to=\{PRODUCT_ENTRY_PATH\} replace \/> : <DoItLandingPage \/>;/);
  assert.match(s, /\{ path: '\/', element: <DoItEntry landing=\{entryLanding\} \/> \}/);
});
test('인트로: app 빌드이거나 next=app 이면 제품 입구 · 그 밖은 기존(랜딩)', () => {
  const s = read('src/pages/do-it/intro/page.tsx');
  assert.match(s, /useState\(\(\) => IS_APP_SITE \|\| search\.get\('next'\) === 'app'\)/);
  assert.match(s, /navigate\(toProduct \? PRODUCT_ENTRY_PATH : MAIN_ENTRY_PATH, \{ replace: true \}\)/);
});
test('히어로: 「움직임 줄이기」 버튼 0 · 기기 설정 동작 줄이기(prefers-reduced-motion)는 그대로 멈춤', () => {
  const hero = read('src/components/DoItBrandHero.tsx');
  assert.doesNotMatch(hero, /<button[^>]*doit-motion-toggle/);
  assert.doesNotMatch(hero, /onToggleMotion|motionPaused/);
  assert.doesNotMatch(read('src/pages/do-it/landing/page.tsx'), /onToggleMotion|motionPaused/);
  const m = read('src/pages/do-it/landing/components/useEditorialMotion.ts');
  assert.match(m, /prefers-reduced-motion: reduce/);
  assert.match(m, /const enabled = \(\) => !media\?\.matches && !document\.hidden;/);
});
