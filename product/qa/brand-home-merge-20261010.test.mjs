// 홈페이지(LOCK · prototypes/doit-echo-link)를 시험 brand 사이트에 얹는 규칙(2026-10-10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeBrandHome, mergeRedirects } from '../scripts/merge-brand-home.mjs';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'brand-home-'));
  const brand = join(dir, 'brand');
  const home = join(dir, 'home');
  mkdirSync(join(brand, 'assets'), { recursive: true });
  mkdirSync(join(home, 'echo', 'story'), { recursive: true });
  mkdirSync(join(home, 'assets'), { recursive: true });
  writeFileSync(join(brand, 'index.html'), '<div id="root"></div>');
  writeFileSync(join(brand, 'assets', 'index-a.js'), 'spa');
  writeFileSync(join(brand, '_headers'), '/*\n  X-Frame-Options: DENY\n');
  writeFileSync(join(brand, '_redirects'), '/doit/*  https://app.example/doit/:splat  302\n/login  https://app.example/login  302\n/*    /index.html   200\n');
  writeFileSync(join(home, 'index.html'), '<main>home</main>');
  writeFileSync(join(home, 'echo', 'index.html'), 'echo');
  writeFileSync(join(home, 'echo', 'story', 'index.html'), 'story');
  writeFileSync(join(home, 'assets', 'home-b.js'), 'home');
  return { brand, home };
}

test('홈페이지 = / · 제품 화면(약관 등) = spa.html · 정적 쪽 그대로', () => {
  const { brand, home } = fixture();
  mergeBrandHome(brand, home);
  assert.equal(readFileSync(join(brand, 'index.html'), 'utf8'), '<main>home</main>');
  assert.equal(readFileSync(join(brand, 'spa.html'), 'utf8'), '<div id="root"></div>');
  assert.equal(readFileSync(join(brand, 'echo', 'story', 'index.html'), 'utf8'), 'story');
  assert.ok(existsSync(join(brand, 'assets', 'index-a.js')) && existsSync(join(brand, 'assets', 'home-b.js')));
  assert.match(readFileSync(join(brand, '_headers'), 'utf8'), /X-Frame-Options: DENY/);
});

test('_redirects: 앱으로 보내는 규칙은 맨 앞 그대로 · 예전 홈 주소 → / · 나머지 = spa.html', () => {
  const out = mergeRedirects('/doit/*  https://app.example/doit/:splat  302\n/login  https://app.example/login  302\n/*    /index.html   200\n');
  const lines = out.trim().split('\n');
  assert.deepEqual(lines.slice(0, 2), ['/doit/*  https://app.example/doit/:splat  302', '/login  https://app.example/login  302']);
  assert.ok(lines.includes('/do-it/landing    /    301') && lines.includes('/do-it/hero    /    301'));
  assert.equal(lines.at(-1), '/*    /spa.html   200');
  assert.equal(lines.filter((l) => /index\.html/.test(l)).length, 0);
});

test('겹치는 파일·나머지 규칙 이상이면 멈춤(덮어쓰기 0)', () => {
  const { brand, home } = fixture();
  writeFileSync(join(home, 'assets', 'index-a.js'), 'other');
  assert.throws(() => mergeBrandHome(brand, home), /겹치는 파일/);
  assert.equal(readFileSync(join(brand, 'index.html'), 'utf8'), '<div id="root"></div>');
  assert.equal(readFileSync(join(brand, 'assets', 'index-a.js'), 'utf8'), 'spa');
  assert.throws(() => mergeRedirects('/login  https://app.example/login  302\n'), /나머지 주소 규칙이 0개/);
});

test('배포 흐름: QA brand 빌드에만 홈페이지를 얹고(운영은 대표 승인 전 그대로) 앱 주소는 빌드 값으로', () => {
  const wf = read('.github/workflows/echo-netlify-deploy.yml');
  const step = wf.slice(wf.indexOf('역할별 빌드'), wf.indexOf('빌드 검사'));
  assert.match(step, /if \[ "\$T" = qa \]; then[\s\S]*prototypes\/doit-echo-link[\s\S]*npm ci[\s\S]*VITE_ECHO_APP_URL="\$APP_O"[\s\S]*merge-brand-home\.mjs \.\.\/dist\/brand \.\.\/dist\/brand-home/);
  assert.match(step, /rm -rf \.\.\/dist\/brand-home/);
  const check = wf.slice(wf.indexOf('빌드 검사'), wf.indexOf('upload-artifact'));
  assert.match(check, /dist\/brand\/spa\.html/);
});

test('홈페이지 앱 주소: 빌드 값이 있으면 QA 기본 주소가 묶음에 남지 않는 형태', () => {
  const src = read('prototypes/doit-echo-link/src/shared/echo-app.ts');
  assert.match(src, /FROM_BUILD \? FROM_BUILD\.replace\(\/\\\/\+\$\/, ""\) : DEFAULT_APP/);
  assert.doesNotMatch(src, /\|\| DEFAULT_APP/);
});
