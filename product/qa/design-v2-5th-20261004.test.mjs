// 2026-10-04 대표 「5차 마지막 묶음」 — 소스 규칙 검사(모의). 번들 포함 여부·실제 렌더는 빌드 산출물·브라우저 검사가 따로 증명한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');

test('앱 첫 화면(/): 최신 문구 + 시작하기 → 기존 시작 흐름 · 앱 역할에서만 조각 생성 · 인트로 뒤 / 로(동작 줄이기 동일)', () => {
  const welcome = read('src/doit/pages/do-it/welcome/page.tsx');
  assert.match(welcome, /같이 하고 싶은 일이 있나요\?/);
  assert.match(welcome, /어떤 만남을 원하는지 들려주세요\./);
  assert.match(welcome, />시작하기</);
  assert.match(welcome, /navigate\(PRODUCT_ENTRY_PATH\)/);
  assert.match(welcome, /ECHO/);
  const cfg = read('src/router/config.tsx');
  assert.match(cfg, /VITE_SITE_ROLE === 'app' \? lazy\(\(\) => import\('@\/doit\/pages\/do-it\/welcome\/page'\)\)/);
  assert.match(cfg, /<AppWelcomePage \/>/);
  const intro = read('src/pages/do-it/intro/page.tsx');
  assert.match(intro, /navigate\(IS_APP_SITE \? '\/' : toProduct \? PRODUCT_ENTRY_PATH : MAIN_ENTRY_PATH/);
});

test('404: 한국어 안내 + 홈 이동, 개발 도구 영어 안내 0, 앱 CSS 는 역할 조건 안에서만', () => {
  const nf = read('src/pages/NotFound.tsx');
  assert.doesNotMatch(nf, /has not been generated|Tell me more/);
  assert.match(nf, /페이지를 찾을 수 없어요\./);
  assert.match(nf, /홈으로 돌아가기/);
  assert.match(nf, /VITE_SITE_ROLE !== 'brand'\) void import\('@\/components\/state-screens\.css'\)/);
});

test('약관: app-pastel.css 정적 import 금지(홈페이지 번들 유입) · 역할 조건 동적 import · 홈페이지는 legal-page 만', () => {
  const legal = read('src/pages/legal/LegalDocument.tsx');
  assert.doesNotMatch(legal, /^import '@\/doit\/components\/feature\/app-pastel\.css'/m);
  assert.match(legal, /VITE_SITE_ROLE !== 'brand'\) void import\('@\/doit\/components\/feature\/app-pastel\.css'\)/);
  assert.match(legal, /IS_BRAND_SITE \? 'legal-page' : 'legal-page doit-app-pastel'/);
});

test('인증 콜백: 앱 유리 화면으로 · 인증 로직 줄은 그대로', () => {
  const cb = read('src/pages/auth/callback/page.tsx');
  assert.match(cb, /echo-state/);
  assert.doesNotMatch(cb, /bg-background-50/);
  assert.match(cb, /navigate\(consumeReturnPath\(\), \{ replace: true \}\)/);
  assert.match(cb, /SESSION_WAIT_MS = 8000/);
});

test('뒤로·메뉴 버튼: 밝은 민트 위에서 짙은 청록 유리 바탕 + 후보 버튼 문구 정확히 「더 알아보기」', () => {
  assert.match(read('src/components/app-corner-menu.css'), /\.echo-corner-button\{[^}]*background:rgb\(8 70 80\/\.86\)/);
  assert.match(read('src/components/app-back-button.css'), /on-pastel\{[^}]*background:rgb\(8 70 80\/\.86\)/);
  const c = read('src/doit/components/feature/ConnectionCandidates.tsx');
  assert.match(c, />더 알아보기<span/);
  assert.doesNotMatch(c, /더 알아보기 · 왜/);
});
