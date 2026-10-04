// 2026-09-30 대표 「ECHO QA · 최종 수정 지시」: 네이비 E 시작 그림 · 초록 0 · 그림이 그려진 때부터 최소 1초 · Google 버튼 멀티컬러 G.
// 파일 규칙 검사다. 실제 화면 순서는 브라우저 실측(프레임 기록)과 실기기 확인이 따로 있다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('앱 설치 시작 화면·첫 바탕은 딥 네이비(초록 0) · 시작 주소는 온보딩', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.background_color, '#041433');
  assert.equal(m.theme_color, '#041433');
  assert.match(m.start_url, /^\/do-it\/intro/);
  const vite = read('vite.config.ts');
  assert.match(vite, /<html lang="ko" class="echo-app-launch-root">/, '첫 픽셀부터 네이비 표시');
  assert.match(vite, /rel="preload" as="image"[^`]*fetchpriority="high"/, '그림 미리 받기 · 높은 우선순위');
  assert.match(vite, /z-index: 2147483647/, '화면 전체 · 가장 위');
});

test('그림이 늦게 오면 그림이 온 때부터 다시 센다(0.1초만 보이고 사라지지 않게) · 목적지는 정하지 않는다', () => {
  const s = read('src/components/ThemeColorSync.tsx');
  assert.match(s, /startVisibleHold\(started && root\.classList\.contains\(APP_LAUNCH_CLASS\) && !root\.classList\.contains\(APP_LAUNCH_OUT_CLASS\)\)/);
  assert.match(s, /artwork\.decode\(\)/, 'decode 끝난 뒤부터 센다');
  assert.doesNotMatch(s, /navigate\(/);
  assert.ok(Number(read('src/lib/themeColor.ts').match(/APP_LAUNCH_MIN_MS = (\d+)/)[1]) >= 1000, '최소 1000ms');
});

test('Google 로그인·가입 버튼: 멀티컬러 G(4색) + 「Google로 시작하기」 · OAuth 호출은 그대로', () => {
  const g = read('src/components/GoogleGIcon.tsx');
  for (const c of ['#EA4335', '#4285F4', '#FBBC05', '#34A853']) assert.ok(g.includes(c), c);
  for (const p of ['src/pages/login/page.tsx', 'src/pages/signup/page.tsx']) {
    const s = read(p);
    assert.match(s, /<GoogleGIcon \/>\s*Google로 시작하기/, p);
    assert.doesNotMatch(s, /ri-google-fill/, `${p} 단색 G 없음`);
    assert.match(s, /signInWithGoogle\(from\)/, `${p} OAuth 호출 그대로`);
  }
});

test('온보딩은 시작 그림이 걷힌 뒤부터 센다(그림 아래에서 흘러가 가려지지 않게) · 온보딩 내용·목적지는 그대로', () => {
  const s = read('src/pages/do-it/intro/page.tsx');
  assert.match(s, /if \(reducedMotion === null \|\| !launchDone\) return;/);
  assert.match(s, /new MutationObserver\(check\)/);
  assert.match(s, /navigate\(IS_APP_SITE \? '\/' : toProduct \? PRODUCT_ENTRY_PATH : MAIN_ENTRY_PATH, \{ replace: true \}\)/, '목적지: 앱은 새 첫 화면(/) · 그 밖은 그대로(2026-10-04 승인)');
});
