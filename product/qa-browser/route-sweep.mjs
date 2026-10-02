const { chromium } = await import(process.env.PW_MODULE);
import http from 'node:http'; import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs'; import path from 'node:path';
const ROOT = process.env.ROOT, PORT = 4201, SB = 'https://mutniujeiyujhkobadkd.supabase.co';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) f = path.join(ROOT, 'index.html'); r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f)); }).listen(PORT);
const UID = '11111111-2222-4333-8444-555555555555'; const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); const EXP = Math.floor(Date.now() / 1000) + 86400;
const JWT = `${b64({ alg: 'HS256' })}.${b64({ sub: UID, role: 'authenticated', exp: EXP, aud: 'authenticated' })}.sig`;
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'qa-route@do-it.company', app_metadata: { provider: 'email' }, user_metadata: { doit_connect_consent_version: 'connect-v1' }, created_at: '2026-09-01T00:00:00Z' };
const SESSION = { access_token: JWT, token_type: 'bearer', expires_in: 86400, expires_at: EXP, refresh_token: 'r', user: USER };
const ROUTES = ['/', '/login', '/signup', '/legal/consent', '/legal/terms', '/legal/privacy', '/do-it/hero', '/do-it/landing', '/payment', '/payment/success', '/payment/fail', '/home', '/start', '/weather', '/white-door', '/report', '/locker',
  '/doit/landing', '/doit/fortune', '/doit/verify', '/doit/home', '/doit/first-record', '/doit/review', '/doit/understanding', '/doit/timeline', '/doit/value', '/doit/pattern', '/doit/memory', '/doit/spaces', '/doit/choose', '/doit/start-journey', '/doit/conversation', '/doit/world', '/doit/room', '/doit/grade', '/doit/just-try', '/doit/connections', '/doit/key', '/doit/notifications', '/doit/settings', '/doit/settings#guide', '/doit/profile', '/doit/admin/mobile', '/no-such-page'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const rows = [];
for (const auth of [true, false]) for (const w of [320, 430]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, isMobile: true, hasTouch: true });
  if (auth) await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, ['sb-mutniujeiyujhkobadkd-auth-token', JSON.stringify(SESSION)]);
  await ctx.route(`${SB}/**`, async (route) => {
    const u = new URL(route.request().url()); const m = route.request().method();
    if (m === 'OPTIONS') return route.fulfill({ status: 204 });
    if (u.pathname.startsWith('/auth/v1/user')) return auth ? route.fulfill({ json: USER }) : route.fulfill({ status: 401, json: {} });
    if (u.pathname.startsWith('/rest/v1/profiles')) return route.fulfill({ json: (route.request().headers().accept ?? '').includes('object') ? { consent_version: 'v1.0', purpose_id: 'friend', purpose_label: '친구를 만나고 싶어요', nickname: '나', role: 'user' } : [{ consent_version: 'v1.0', purpose_id: 'friend', purpose_label: '친구를 만나고 싶어요', nickname: '나', role: 'user' }] });
    if (u.pathname.startsWith('/rest/v1/')) return route.fulfill({ status: m === 'GET' ? 200 : 201, json: [] });
    if (u.pathname.startsWith('/functions/v1/doit-connect')) return route.fulfill({ json: { ok: true, eligible: false, missing: ['photos'], candidates: [], matches: [], consented: true, open: 0, turns: { answer: 0, reply: 0, opened: 0, choose: 0 } } });
    if (u.pathname.startsWith('/functions/v1/')) return route.fulfill({ json: { ok: true, session: null } });
    return route.fulfill({ status: 404, json: {} });
  });
  for (const r of ROUTES) {
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
    try {
      await p.goto(`http://localhost:${PORT}${r}`, { waitUntil: 'domcontentloaded', timeout: 20000 }); await p.waitForTimeout(1800);
      const m = await p.evaluate(() => {
        const t = document.body.innerText.replace(/\s+/g, ' ');
        const over = [...document.querySelectorAll('body *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).length;
        return { final: location.pathname + location.hash, sw: document.scrollingElement.scrollWidth, iw: innerWidth, over, h: (document.querySelector('h1,h2')?.textContent ?? '').trim().slice(0, 30), price: (t.match(/\d[\d,]*\s?원/g) ?? []).slice(0, 2), stripe: /stripe/i.test(t), len: t.length, fake: /(가짜|더미|lorem|sample)/i.test(t) };
      });
      rows.push({ auth, w, r, ...m, errs: errs.length });
    } catch (e) { rows.push({ auth, w, r, err: String(e).slice(0, 80) }); }
    await p.close();
  }
  await ctx.close();
}
await browser.close(); srv.close();
writeFileSync(process.env.OUT, JSON.stringify(rows, null, 1));
const bad = rows.filter((x) => x.err || x.errs || x.sw > x.iw || x.stripe || x.len < 20 || x.fake);
console.log(`ROUTES ${rows.length} · 문제 ${bad.length}`); for (const b of bad) console.log(JSON.stringify(b));
const prices = rows.filter((x) => x.price?.length); console.log('가격 표시:', JSON.stringify([...new Set(prices.map((x) => `${x.r}→${x.final}:${x.price.join('|')}`))]));
