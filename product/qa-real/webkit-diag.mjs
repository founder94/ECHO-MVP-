// WebKit 직접 진입 진단(2026-09-29 대표 「FINAL RELEASE CLOSING」 §5) — 읽기 전용 · 운영은 로그아웃 상태만 · 로그인 상태는 QA 새 시험 계정.
// 목적: 「app.do-it.company 를 직접 열면 가끔 로딩/빈 인트로/브라우저 멈춤」이 제품 결함인지, 검사 타이밍·자동화 환경 문제인지 가른다.
// 경우마다: HTTP · 경로 변화 시각표 · 의미 있는 첫 화면까지 걸린 시간 · 로딩 문구가 떠 있던 시간 · JS 오류 · 콘솔 오류 · 요청 실패 · 페이지 멈춤(crash).
import { chromium, webkit, devices } from 'playwright';
import { randomUUID } from 'node:crypto';
const PROD = 'https://app.do-it.company';
const QA = 'https://echo-app-qa.netlify.app';
const QA_SB = 'https://mutniujeiyujhkobadkd.supabase.co';
const ANON = process.env.QA_ANON;
const LOADING = /가져오고 있어요|확인하고 있어요|불러오고 있어요|잠시만/;
const DEVICES = {
  iphone: { viewport: { width: 390, height: 844 }, userAgent: devices['iPhone 13'].userAgent, hasTouch: true, deviceScaleFactor: 3 },
  galaxy: { viewport: { width: 412, height: 915 }, userAgent: devices['Galaxy S9+'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
};
const rows = [];

async function runCase({ base, bname, type, dname, state, path, dsf = null, session = null, attempt = 1 }) {
  const opts = { ...DEVICES[dname], ...(dsf ? { deviceScaleFactor: dsf } : {}), ...(bname === 'webkit' ? { isMobile: undefined } : {}) };
  const b = await type.launch();
  const ctx = await b.newContext(opts);
  if (state === 'introSeen') await ctx.addInitScript(() => { try { sessionStorage.setItem('doit:intro-seen', '1'); } catch { /* 무시 */ } });
  if (session) await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* 무시 */ } }, session);
  const p = await ctx.newPage();
  const r = { base: base === PROD ? 'prod' : 'qa', browser: bname, device: dname, dsf: opts.deviceScaleFactor, state: session ? `${state}+login` : state, path, attempt, http: null, timeline: [], meaningfulMs: null, loadingMs: 0, final: null, pageErrors: [], consoleErrors: [], failed: [], crash: false, err: null };
  p.on('pageerror', (e) => r.pageErrors.push(String(e).slice(0, 120)));
  p.on('console', (m) => { if (m.type() === 'error') r.consoleErrors.push(m.text().slice(0, 120)); });
  p.on('requestfailed', (q) => { const u = q.url(); if (!/google-analytics|googletagmanager/.test(u)) r.failed.push(`${q.failure()?.errorText ?? '?'} ${u.slice(0, 80)}`); });
  p.on('crash', () => { r.crash = true; });
  const t0 = Date.now();
  try {
    const resp = await p.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    r.http = resp?.status() ?? null;
    let lastPath = ''; let loadingSince = null;
    while (Date.now() - t0 < 20000 && !r.crash) {
      const now = Date.now() - t0;
      let cur = ''; let txt = '';
      try { cur = new URL(p.url()).pathname; txt = await p.evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').trim() ?? ''); } catch { if (r.crash) break; }
      if (cur !== lastPath) { r.timeline.push(`${now}ms ${cur}`); lastPath = cur; }
      const loading = LOADING.test(txt) && txt.length < 60;
      if (loading && loadingSince === null) loadingSince = now;
      if (!loading && loadingSince !== null) { r.loadingMs += now - loadingSince; loadingSince = null; }
      if (r.meaningfulMs === null && txt.length > 20 && !loading && cur !== '/do-it/intro') r.meaningfulMs = now;
      if (r.meaningfulMs !== null && now - r.meaningfulMs > 1500) break;
      await p.waitForTimeout(250);
    }
    if (loadingSince !== null) r.loadingMs += (Date.now() - t0) - loadingSince;
    try { r.final = `${new URL(p.url()).pathname} · ${(await p.evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').trim() ?? '')).slice(0, 40)}`; } catch { r.final = r.crash ? 'CRASH' : '?'; }
  } catch (e) { r.err = String(e).split('\n')[0].slice(0, 120); }
  await b.close().catch(() => {});
  rows.push(r);
  console.log(`ROW ${JSON.stringify(r)}`);
  if (r.crash && attempt === 1) await runCase({ base, bname, type, dname, state, path, dsf, session, attempt: 2 }); // 멈춤이면 같은 경우를 한 번 더(자동화 환경 문제인지 가르기)
}

async function qaSession() {
  if (!ANON) return null;
  const h = (path, body, jwt) => fetch(`${QA_SB}${path}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jwt ?? ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json());
  const email = `qa-webkitdiag-${Date.now()}@do-it.company`; const password = `Qa!${randomUUID()}`;
  await h('/auth/v1/signup', { email, password });
  const s = await h('/auth/v1/token?grant_type=password', { email, password });
  if (!s?.access_token) return null;
  await fetch(`${QA_SB}/rest/v1/profiles?id=eq.${s.user.id}`, { method: 'PATCH', headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ purpose_id: 'friend', purpose_label: '친구를 만나고 싶어요', consent_version: 'v1.0' }) });
  return ['sb-mutniujeiyujhkobadkd-auth-token', JSON.stringify(s)];
}

const BROWSERS = [['chrome', chromium], ['webkit', webkit]];
// ① 운영 · 로그아웃 · 전체 매트릭스
for (const [bname, type] of BROWSERS) for (const dname of ['iphone', 'galaxy']) for (const state of ['fresh', 'introSeen']) for (const path of ['/', '/login', '/do-it/intro', '/doit/start-journey']) {
  await runCase({ base: PROD, bname, type, dname, state, path });
}
// ② WebKit 화면 배율 비교(3 vs 1) · 운영 · / fresh · 3회씩 — 멈춤이 큰 캔버스(1170×2532)와 관련 있는지
for (const dsf of [3, 1]) for (let i = 0; i < 3; i++) await runCase({ base: PROD, bname: 'webkit', type: webkit, dname: 'iphone', state: 'fresh', path: '/', dsf });
// ③ 로그인 상태(QA 새 계정) · / · start-journey
const sess = await qaSession();
if (sess) for (const [bname, type] of BROWSERS) for (const state of ['fresh', 'introSeen']) for (const path of ['/', '/doit/start-journey']) await runCase({ base: QA, bname, type, dname: 'iphone', state, path, session: sess });

// 요약
const key = (r) => `${r.base} ${r.browser} ${r.device} dsf${r.dsf} ${r.state} ${r.path}`;
console.log('\n=== SUMMARY ===');
for (const r of rows) console.log(`${key(r).padEnd(52)} http=${r.http} meaningful=${r.meaningfulMs ?? 'NONE'}ms loading=${r.loadingMs}ms crash=${r.crash} try=${r.attempt} errs=${r.pageErrors.length}/${r.consoleErrors.length} failed=${r.failed.length} timeline=[${r.timeline.join(' → ')}] final=${r.final}${r.err ? ` err=${r.err}` : ''}`);
const agg = (f) => rows.filter(f);
const stat = (label, f) => { const xs = agg(f); const ms = xs.map((r) => r.meaningfulMs).filter((x) => x != null).sort((a, b) => a - b); console.log(`AGG ${label}: n=${xs.length} crash=${xs.filter((r) => r.crash).length} none=${xs.filter((r) => r.meaningfulMs == null && !r.crash).length} p50=${ms[Math.floor(ms.length / 2)] ?? '-'}ms max=${ms[ms.length - 1] ?? '-'}ms`); };
stat('chrome all', (r) => r.browser === 'chrome');
stat('webkit all', (r) => r.browser === 'webkit');
stat('webkit / fresh', (r) => r.browser === 'webkit' && r.path === '/' && r.state.startsWith('fresh'));
stat('webkit / introSeen', (r) => r.browser === 'webkit' && r.path === '/' && r.state.startsWith('introSeen'));
stat('webkit dsf3 / fresh', (r) => r.browser === 'webkit' && r.path === '/' && r.state === 'fresh' && r.dsf === 3);
stat('webkit dsf1 / fresh', (r) => r.browser === 'webkit' && r.path === '/' && r.state === 'fresh' && r.dsf === 1);
stat('webkit /do-it/intro', (r) => r.browser === 'webkit' && r.path === '/do-it/intro');
stat('chrome /do-it/intro', (r) => r.browser === 'chrome' && r.path === '/do-it/intro');
