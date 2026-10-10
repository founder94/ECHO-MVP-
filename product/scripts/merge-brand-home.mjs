#!/usr/bin/env node
// 홈페이지(대표 완성 LOCK 2026-10-10 · prototypes/doit-echo-link 빌드)를 brand 빌드(dist/brand) 위에 얹는다.
//
// - 홈페이지 쪽(/ · /how/ · /echo/ · /echo/story/ · /echo/connected/)은 정적 파일 그대로 — 디자인·문구 변경 0.
// - 제품 brand 빌드가 맡던 화면(/legal/terms · /legal/privacy · /do-it/intro · 없는 주소의 NotFound)은 그대로 남긴다:
//   제품 index.html 을 spa.html 로 옮기고, 마지막 「나머지 주소」 규칙만 spa.html 로 돌린다(Netlify 는 있는 파일을 먼저 내준다).
// - 제품 경로 → 앱 주소 302 규칙(brand vite 설정이 만든 것)은 순서·목적지 그대로 맨 앞에 둔다.
// - 예전 홈페이지 주소(/do-it/landing · /do-it/hero)는 새 홈페이지(/)로.
// - 보안 정책(CSP)은 그대로 두고 홈페이지 3D 모델 압축 풀기(Draco)에 필요한 두 가지만 더한다(Codex #152 P2):
//   worker-src 'self' blob: (풀기 일꾼을 blob 주소로 만듦) · script-src 'wasm-unsafe-eval'(WASM 번역만 허용 — 글자 eval 은 계속 금지).
// - 같은 이름 파일이 겹치면 덮어쓰지 않고 멈춘다(어느 쪽이 사라졌는지 모르게 되는 일 0).
//
// 쓰는 법: node scripts/merge-brand-home.mjs <brand 빌드 폴더> <홈페이지 빌드 폴더>
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FALLBACK = /^\/\*\s+\/index\.html\s+200\s*$/;

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function mergeRedirects(text) {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const fallbacks = lines.filter((line) => FALLBACK.test(line));
  if (fallbacks.length !== 1) throw new Error(`brand _redirects 의 나머지 주소 규칙이 ${fallbacks.length}개 — 1개여야 함`);
  const kept = lines.filter((line) => !FALLBACK.test(line));
  return [
    ...kept,
    '/do-it/landing    /    301',
    '/do-it/hero    /    301',
    '/*    /spa.html   200',
    '',
  ].join('\n');
}

export function relaxCspForHome(text) {
  return text.split('\n').map((line) => {
    const m = line.match(/^(\s*Content-Security-Policy:\s*)(.*)$/);
    if (!m) return line;
    const parts = m[2].split(';').map((d) => d.trim()).filter(Boolean);
    const script = parts.findIndex((d) => d.startsWith('script-src '));
    if (script < 0) throw new Error('CSP 에 script-src 가 없음');
    if (!parts[script].includes("'wasm-unsafe-eval'")) parts[script] += " 'wasm-unsafe-eval'";
    if (!parts.some((d) => d.startsWith('worker-src '))) parts.splice(script + 1, 0, "worker-src 'self' blob:");
    return `${m[1]}${parts.join('; ')}`;
  }).join('\n');
}

export function mergeBrandHome(brandDir, homeDir) {
  const brandIndex = join(brandDir, 'index.html');
  const spa = join(brandDir, 'spa.html');
  const redirects = join(brandDir, '_redirects');
  if (!existsSync(brandIndex)) throw new Error('brand 빌드에 index.html 없음');
  if (!existsSync(join(homeDir, 'index.html'))) throw new Error('홈페이지 빌드에 index.html 없음');
  if (!existsSync(redirects)) throw new Error('brand 빌드에 _redirects 없음');
  if (existsSync(spa)) throw new Error('brand 빌드에 이미 spa.html 있음');

  const files = listFiles(homeDir).map((full) => relative(homeDir, full));
  const clash = files.filter((rel) => rel !== 'index.html' && existsSync(join(brandDir, rel)));
  if (clash.length) throw new Error(`이름이 겹치는 파일: ${clash.slice(0, 5).join(', ')}`);
  if (files.some((rel) => rel === '_redirects' || rel === '_headers' || rel === 'spa.html')) {
    throw new Error('홈페이지 빌드에 _redirects/_headers/spa.html 이 있으면 안 됨');
  }

  const merged = mergeRedirects(readFileSync(redirects, 'utf8'));
  const headersPath = join(brandDir, '_headers');
  const headers = existsSync(headersPath) ? relaxCspForHome(readFileSync(headersPath, 'utf8')) : null;
  renameSync(brandIndex, spa);
  for (const rel of files) {
    const dest = join(brandDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(homeDir, rel), dest);
  }
  writeFileSync(redirects, merged);
  if (headers !== null) writeFileSync(headersPath, headers);
  return { copied: files.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [brandDir, homeDir] = process.argv.slice(2);
  if (!brandDir || !homeDir) {
    console.error('쓰는 법: node scripts/merge-brand-home.mjs <brand 빌드 폴더> <홈페이지 빌드 폴더>');
    process.exit(2);
  }
  const { copied } = mergeBrandHome(brandDir, homeDir);
  console.log(`홈페이지 얹기 완료: 파일 ${copied}개 · 제품 화면 = spa.html`);
}
