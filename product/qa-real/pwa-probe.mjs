// 읽기 전용 PWA 실측(2026-09-27 대표 「PWA INSTALL / ICON FAILURE」): 실제 주소가 내려주는 manifest·아이콘·index 를 받아
// Chrome(실제 브라우저)의 설치 가능 판정(Page.getInstallabilityErrors)과 manifest 해석(Page.getAppManifest)을 적는다. 쓰기 0 · 비밀값 0.
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const APPROVED_E = { '192': 'c19b9f6b50744a91', '512': '12e9af5ea8a541a4', 'maskable': 'd5e0f3c3c756e25c', '180': '4b175d5da8f2c22a' }; // 승인 E 세트(저장소 fc25367/17266da · 운영 9/25) 앞 16자리
const OLD_BLACK_D = { '192': '9a8d89b15c7e', '512': '449ae1fe52b4', 'maskable': '3b2fa8d7c37a', 'apple': '1a35f2ab9cf2' }; // 9/23 세트(ca7fb0e) 앞 12자리
const REFS = { QA: 'mutniujeiyujhkobadkd', PROD: 'zyyhhxyupizcqhxqnxuu' };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const kind = (h) => Object.values(APPROVED_E).some((p) => h.startsWith(p)) ? 'APPROVED_E' : Object.values(OLD_BLACK_D).some((p) => h.startsWith(p)) ? 'OLD_BLACK_D' : 'OTHER';
async function get(url) { try { const r = await fetch(url, { redirect: 'follow' }); const b = Buffer.from(await r.arrayBuffer()); return { status: r.status, type: r.headers.get('content-type'), cache: r.headers.get('cache-control'), body: b }; } catch (e) { return { status: 0, error: String(e.message).slice(0, 80), body: Buffer.alloc(0) }; } }
for (const base of process.argv.slice(2)) {
  const out = { base };
  const idx = await get(`${base}/`); out.index = { status: idx.status, sha: sha(idx.body).slice(0, 16) };
  const html = idx.body.toString();
  out.links = [...html.matchAll(/<link[^>]*rel="(icon|apple-touch-icon|manifest)"[^>]*>/g)].map((m) => m[0].replace(/\s+/g, ' '));
  out.apple_title = (html.match(/apple-mobile-web-app-title" content="([^"]*)"/) || [])[1] ?? null;
  const jsFiles = [...new Set([...html.matchAll(/assets\/[A-Za-z0-9_.-]+\.js/g)].map((m) => m[0]))];
  const refs = { QA: 0, PROD: 0 }; for (const js of jsFiles) { const t = (await get(`${base}/${js}`)).body.toString(); for (const [k, v] of Object.entries(REFS)) if (t.includes(v)) refs[k]++; }
  out.bundle_supabase = refs;
  const man = await get(`${base}/manifest.webmanifest`); let m = null; try { m = JSON.parse(man.body.toString()); } catch {}
  out.manifest = { status: man.status, type: man.type, cache: man.cache, parsed: !!m, name: m?.name, short_name: m?.short_name, id: m?.id, start_url: m?.start_url, scope: m?.scope, display: m?.display };
  out.icons = [];
  for (const i of m?.icons ?? []) { const r = await get(new URL(i.src, `${base}/`).href); const h = sha(r.body); out.icons.push({ src: i.src, sizes: i.sizes, purpose: i.purpose, status: r.status, type: r.type, sha: h.slice(0, 16), kind: kind(h), cache: r.cache }); }
  for (const href of out.links.map((l) => (l.match(/href="([^"]+)"/) || [])[1]).filter(Boolean).filter((h) => !/manifest/.test(h))) { const r = await get(new URL(href, `${base}/`).href); const h = sha(r.body); out.icons.push({ link: href, status: r.status, sha: h.slice(0, 16), kind: kind(h) }); }
  for (const p of ['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png', '/favicon.ico', '/sw.js', '/service-worker.js']) { const r = await get(`${base}${p}`); out[p] = { status: r.status, type: r.type, kind: r.status === 200 ? kind(sha(r.body)) : null }; }
  // 실제 Chrome 판정(모바일 화면 · 시크릿 아닌 영구 프로필)
  // 시크릿이 아닌 일반(영구) 프로필 — 시크릿 창은 설치 불가(in-incognito)라 판정이 왜곡된다.
  const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'pwa-')), { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  const page = ctx.pages()[0] ?? await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  try {
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 30000 }); await page.waitForTimeout(4000);
    const inst = await cdp.send('Page.getInstallabilityErrors'); const am = await cdp.send('Page.getAppManifest');
    out.chrome = { final_url: page.url(), installability_errors: inst.installabilityErrors.map((e) => e.errorId), manifest_url: am.url, manifest_errors: am.errors, sw_registrations: await page.evaluate(async () => (navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : -1)) };
  } catch (e) { out.chrome = { error: String(e.message).slice(0, 120) }; }
  await ctx.close();
  console.log(JSON.stringify(out, null, 1));
}
