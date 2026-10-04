// 2026-09-27 대표 실기기 QA 「DEVICE QA FAILURE FIX」: 설치 앱(PWA) = 제품 · Google 버튼은 제공자가 꺼진 환경에서만 숨김.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('manifest: start_url = 인트로 → 제품 입구(?next=app) · id·scope 그대로 · 아이콘은 승인 E 세트(D 심볼 0)', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.start_url, '/do-it/intro?next=app'); assert.equal(m.id, '/'); assert.equal(m.scope, '/'); assert.equal(m.display, 'standalone');
  assert.deepEqual(m.icons.map((i) => i.src.split('?')[0]), ['/pwa/echo-icon-192.png', '/pwa/echo-icon-512.png', '/pwa/echo-icon-512-maskable.png']);
  assert.ok(!JSON.stringify(m).includes('doit-symbol'), 'D 심볼은 앱 아이콘이 아님');
});
test('인트로: next=app(또는 app 빌드)이면 제품 입구(/doit/start-journey) · 그 밖은 기존(브랜드) 그대로', () => {
  const s = read('src/pages/do-it/intro/page.tsx'); const mode = read('src/lib/echo/appMode.ts');
  assert.match(mode, /export const PRODUCT_ENTRY_PATH = '\/doit\/start-journey';/);
  assert.match(s, /search\.get\('next'\) === 'app'/);
  assert.match(s, /navigate\(IS_APP_SITE \? '\/' : toProduct \? PRODUCT_ENTRY_PATH : MAIN_ENTRY_PATH, \{ replace: true \}\)/); // 2026-10-04: 앱 역할은 새 첫 화면(/), 설치 앱(next=app)·통합은 제품 입구 그대로
});
test('Google 버튼: 기본 켜짐(운영 그대로) · VITE_AUTH_GOOGLE_ENABLED=false 일 때만 로그인·가입에서 숨김 · 관리자 로그인 변경 0', () => {
  assert.match(read('src/lib/authProviders.ts'), /import\.meta\.env\.VITE_AUTH_GOOGLE_ENABLED !== 'false'/);
  for (const p of ['src/pages/login/page.tsx', 'src/pages/signup/page.tsx']) { const s = read(p); assert.match(s, /\{GOOGLE_LOGIN_ENABLED && \(/, p); assert.match(s, /Google로 시작하기/, p); assert.match(s, /<GoogleGIcon \/>/, p); }
  assert.doesNotMatch(read('src/pages/admin/login/page.tsx'), /GOOGLE_LOGIN_ENABLED/);
});
