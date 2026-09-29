import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 대표 2026-09-26 PRE-DEPLOY FINAL FIX
// #1 앱 공유 정보(canonical·og·twitter)는 https://app.do-it.company 기준.
// #2 앱 첫 바탕색은 검정(#08070c)이 아니라 실제 파스텔 토큰(pastel-bg.css --pastel-underlay 첫 색).
// 브랜드 사이트(do-it.company)는 그대로다 — 원본 index.html 은 브랜드 값을 유지하고, 앱 빌드에서만 바꾼다.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

const pastelFirst = () => read('src/doit/components/feature/pastel-bg.css').match(/--pastel-underlay:\s*linear-gradient\(180deg,\s*(#[0-9a-f]{6}) 0%/i)?.[1]?.toLowerCase();

test('앱 첫 바탕색은 지어낸 색이 아니라 파스텔 토큰의 첫 색이다', () => {
  const token = pastelFirst();
  assert.ok(token, 'pastel-bg.css 토큰을 찾지 못했다');
  assert.match(read('vite.config.ts'), new RegExp(`const APP_START_COLOR = "${token}";`, 'i'));
  assert.match(read('src/lib/themeColor.ts'), new RegExp(`export const APP_PASTEL = '${token}';`, 'i'));
});

// 2026-09-29 대표 「시작 화면 배경 변경」: 앱 아이콘을 누른 뒤 시작 화면(Android 는 manifest background_color 로 그림)은 대표 선택 딥 네이비. 초록 0.
test('시작 화면(설치 앱 splash)은 대표 선택 딥 네이비 · 초록 0 · 아이콘 파일은 그대로', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.background_color.toLowerCase(), '#041433');
  assert.equal(manifest.theme_color.toLowerCase(), '#041433');
  assert.match(read('vite.config.ts'), /const APP_LAUNCH_COLOR = "#041433";/);
  assert.match(read('src/lib/themeColor.ts'), /export const APP_LAUNCH_COLOR = '#041433';/);
  assert.deepEqual(manifest.icons.map((i) => i.src), ['/pwa/echo-icon-192.png?v=20260925b', '/pwa/echo-icon-512.png?v=20260925b', '/pwa/echo-icon-512-maskable.png?v=20260925b']);
  assert.equal(manifest.start_url, '/do-it/intro?next=app');
});

test('시작 주소(/do-it/intro)의 React 전 첫 바탕만 네이비 — React 가 뜨면 표시를 떼고, 파스텔 앱 화면 첫 바탕은 그대로', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /html\.echo-app-launch-root body::after \{ content: ''; position: fixed; inset: 0;/);
  assert.match(vite, /echo-launch-artwork\.webp/);
  assert.match(vite, /apple-touch-startup-image/);
  assert.match(vite, /var p=location\.pathname/);
  assert.match(vite, /p\.indexOf\("\/do-it\/intro"\)===0/);
  assert.match(read('src/components/ThemeColorSync.tsx'), /classList\.remove\(APP_LAUNCH_CLASS\)/);
  assert.match(read('src/lib/themeColor.ts'), /export const APP_PASTEL = '#3fdcb3';/);
});

test('2026-09-30 온보딩 전 스플래시: 페이지를 연 때부터 실제 이미지 준비 뒤 최소 1.5초 · 흐려지며 사라짐 · 온보딩 경로에서만 · 라우팅 변경 0', () => {
  const sync = read('src/components/ThemeColorSync.tsx');
  const theme = read('src/lib/themeColor.ts');
  const vite = read('vite.config.ts');
  assert.match(theme, /APP_LAUNCH_MIN_MS = 1500;/);
  assert.match(theme, /APP_LAUNCH_FADE_MS = 260;/);
  assert.match(sync, /artwork\.decode/);
  assert.match(sync, /startVisibleHold/);
  assert.doesNotMatch(sync, /APP_LAUNCH_MIN_MS - performance\.now\(\)/);
  assert.match(sync, /classList\.add\(APP_LAUNCH_OUT_CLASS\)/);
  assert.doesNotMatch(sync, /navigate\(/, '스플래시가 목적지를 정하지 않는다');
  assert.match(vite, /html\.echo-app-launch-root\.echo-app-launch-out body::after \{ opacity: 0; \}/);
  assert.match(vite, /APP_LAUNCH_ASSET = '\/pwa\/echo-launch-artwork\.webp\?v=20260930f'/);
  assert.match(vite, /href="\$\{APP_LAUNCH_ASSET\}"/);
});

test('앱 빌드만 theme-color·첫 body 바탕을 파스텔로 바꾼다(없으면 빌드 실패)', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /swap\('<meta name="theme-color" content="#08070c" \/>', `<meta name="theme-color" content="\$\{APP_LAUNCH_COLOR\}" \/>`\)/);
  assert.match(vite, /body \{ background: #08070c; \}/);
  assert.match(vite, /html\.echo-app-pastel-root body \{ background: \$\{APP_START_COLOR\}; \}/);
  assert.match(vite, /swap\('<html lang="ko">', '<html lang="ko" class="echo-app-launch-root">'\)/);
  assert.match(read('src/lib/themeColor.ts'), /export const APP_ROOT_CLASS = 'echo-app-pastel-root';/);
  assert.match(read('src/components/ThemeColorSync.tsx'), /classList\.toggle\(APP_ROOT_CLASS, color === APP_PASTEL\)/);
  assert.match(vite, /if \(!html\.includes\(from\)\) throw new Error/);
});

test('앱 공유 정보는 app.do-it.company 기준이고 잘린 주소가 없다', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /https:\/\/app\.do-it\.company/);
  assert.match(vite, /<link rel="canonical" href="\$\{appOrigin\}\/" \/>/);
  assert.match(vite, /<meta property="og:url" content="\$\{appOrigin\}\/" \/>/);
  assert.match(vite, /twitter:card/);
  assert.ok(!vite.includes('echo.do-it.company'));
  assert.ok(!/app\.do["'/`]/.test(vite), '잘린 app.do 주소');
});

test('휴대폰 윗줄 색: 앱 화면(/doit)은 파스텔, 인트로·히어로(/)와 관리자는 검정 그대로', () => {
  const src = read('src/lib/themeColor.ts');
  assert.match(src, /if \(pathname\.startsWith\('\/doit\/admin'\)\) return DARK;/);
  assert.match(src, /return pathname\.startsWith\('\/doit\/'\) \|\| pathname === '\/doit' \? APP_PASTEL : DARK;/);
  const sync = read('src/components/ThemeColorSync.tsx');
  assert.match(sync, /if \(!IS_APP_SITE\) return;/);
  assert.match(read('src/App.tsx'), /<ThemeColorSync \/>/);
});

test('앱 이름·짧은 이름은 대표 승인 없이 바꾸지 않았다', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.name, 'ECHO');
  assert.equal(manifest.short_name, 'ECHO');
});

test('화면 조각을 기다리는 화면도 파스텔 앱 경로에서는 파스텔이다(검정 번쩍임 0)', () => {
  const fallback = read('src/components/RouteFallback.tsx');
  assert.match(fallback, /const pastel = IS_APP_SITE && themeColorFor\(window\.location\.pathname\) === APP_PASTEL;/);
  const css = read('src/components/route-fallback.css');
  const token = pastelFirst();
  assert.match(css, new RegExp(`\\.echo-route-fallback--pastel\\{background:linear-gradient\\(180deg,${token} 0%`));
});
