// 대표 지정 ECHO 앱 아이콘(2026-09-25) — 원본 보존 · 크기별 파일 · manifest/앱 빌드 연결 · 브랜드 파비콘 그대로. 가짜 기준 아님(파일·설정 검사).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const at = (p) => new URL(`../${p}`, import.meta.url);
const pngSize = (p) => { const b = readFileSync(at(p)); assert.equal(b.subarray(1, 4).toString(), 'PNG', `${p} PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('원본: 대표 첨부 파일 그대로(SHA-256 고정)', () => {
  const sha = createHash('sha256').update(readFileSync(at('brand-src/echo-app-icon-original-20260925.jpg'))).digest('hex');
  assert.equal(sha, 'aba61478581c43ed4759713411fdf7d514aea3329a559f8c8f8fabf3befa67ff');
});

test('크기별 아이콘: 정사각 PNG · 크기 맞음', () => {
  for (const [f, n] of [['echo-icon-16', 16], ['echo-icon-32', 32], ['echo-icon-48', 48], ['echo-icon-180', 180], ['echo-icon-192', 192], ['echo-icon-512', 512], ['echo-icon-512-maskable', 512]]) {
    assert.deepEqual(pngSize(`public/pwa/${f}.png`), [n, n], f);
  }
});

test('manifest: any 192·512 + maskable 512 = 새 아이콘만', () => {
  const m = JSON.parse(readFileSync(at('public/manifest.webmanifest'), 'utf8'));
  // 대표 2026-09-25 「설치된 아이콘이 옛날 것」: 주소에 판 표시(?v=)를 붙여 브라우저가 새 아이콘으로 다시 받게 한다.
  assert.ok(m.icons.every((i) => /\?v=\d{8}[a-z]?$/.test(i.src)), '아이콘 주소에 판 표시');
  assert.deepEqual(m.icons.map((i) => `${i.src.split('?')[0]}|${i.sizes}|${i.purpose}`), ['/pwa/echo-icon-192.png|192x192|any', '/pwa/echo-icon-512.png|512x512|any', '/pwa/echo-icon-512-maskable.png|512x512|maskable']);
  for (const i of m.icons) assert.ok(statSync(at(`public${i.src.split('?')[0]}`)).size > 0);
});

test('앱 빌드만: apple-touch-icon 180 · 파비콘 PNG · 브랜드는 기존 favicon.svg 그대로', () => {
  const v = readFileSync(at('vite.config.ts'), 'utf8');
  assert.match(v, /rel="apple-touch-icon" sizes="180x180" href="\/pwa\/echo-icon-180.png\?v=\d{8}[a-z]?"/);
  assert.match(v, /if \(siteRole !== "app"\) return html;[\s\S]{0,200}const favicon = '<link rel="icon" type="image\/svg\+xml" href="\/favicon.svg" \/>'/);
  assert.match(readFileSync(at('index.html'), 'utf8'), /<link rel="icon" type="image\/svg\+xml" href="\/favicon.svg" \/>/, '브랜드 기본 파비콘 줄 유지');
});
