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
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.background_color.toLowerCase(), token);
  assert.equal(manifest.theme_color.toLowerCase(), token);
});

test('앱 빌드만 theme-color·첫 body 바탕을 파스텔로 바꾼다(없으면 빌드 실패)', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /swap\('<meta name="theme-color" content="#08070c" \/>', `<meta name="theme-color" content="\$\{APP_START_COLOR\}" \/>`\)/);
  assert.match(vite, /swap\(["']body \{ background: #08070c; \}["'], `html\.echo-app-pastel-root body \{ background: \$\{APP_START_COLOR\}; \}`\)/);
  assert.match(vite, /swap\('<html lang="ko">', '<html lang="ko" class="echo-app-pastel-root">'\)/);
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
  assert.equal(manifest.name, 'DO IT · ECHO');
  assert.equal(manifest.short_name, 'DO IT');
});

test('화면 조각을 기다리는 화면도 파스텔 앱 경로에서는 파스텔이다(검정 번쩍임 0)', () => {
  const fallback = read('src/components/RouteFallback.tsx');
  assert.match(fallback, /const pastel = IS_APP_SITE && themeColorFor\(window\.location\.pathname\) === APP_PASTEL;/);
  const css = read('src/components/route-fallback.css');
  const token = pastelFirst();
  assert.match(css, new RegExp(`\\.echo-route-fallback--pastel\\{background:linear-gradient\\(180deg,${token} 0%`));
});
