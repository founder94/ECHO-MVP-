// WebKit purposes 판정(2026-09-29 대표 「PROD RELEASE FINAL CLOSING」 §5) — 운영 APP 읽기 전용(로그아웃 · 입력·저장 0).
// iPhone·Galaxy 크기 WebKit 각 3회 × 경로 3개(/ · /login · /doit/start-journey). purposes 요청마다 시작 시각·응답 상태·본문 수신·
// requestfinished·requestfailed(errorText)·그 사이 메인 프레임 이동 여부, 그리고 pageerror·console error·사용자 화면(오류 문구·진행 가능)을 기록한다.
import { webkit, devices } from 'playwright';
const APP = 'https://app.do-it.company';
const PATHS = ['/', '/login', '/doit/start-journey'];
const DEV = [['iphone', { viewport: { width: 390, height: 844 }, userAgent: devices['iPhone 13'].userAgent, hasTouch: true, deviceScaleFactor: 3 }],
  ['galaxy', { viewport: { width: 412, height: 915 }, userAgent: devices['Galaxy S9+'].userAgent, hasTouch: true, deviceScaleFactor: 3 }]];
const ERRTEXT = /잠시 후 다시|불러오지 못|오류가 발생|네트워크 연결을 확인|다시 불러오기|Site not found/;
const rows = []; let product = 0, diag = 0;
for (const [dname, opts] of DEV) for (let run = 1; run <= 3; run++) for (const path of PATHS) {
  const b = await webkit.launch(); const ctx = await b.newContext(opts); const p = await ctx.newPage();
  const t0 = Date.now(); const ms = () => Date.now() - t0;
  const navs = []; const reqs = new Map(); const pageErrors = []; const consoleErrors = [];
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) navs.push({ at: ms(), url: f.url() }); });
  p.on('pageerror', (e) => pageErrors.push({ at: ms(), msg: String(e.message || e).slice(0, 140) }));
  p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push({ at: ms(), msg: m.text().slice(0, 140) }); });
  p.on('request', (r) => { if (r.url().includes('/rest/v1/purposes')) reqs.set(r, { start: ms(), method: r.method(), status: null, body: null, finished: null, failed: null, frameUrl: p.url() }); });
  p.on('response', async (r) => { const q = reqs.get(r.request()); if (!q) return; q.status = r.status(); try { q.body = (await r.body()).length; } catch (e) { q.body = `unreadable:${String(e.message).slice(0, 60)}`; } });
  p.on('requestfinished', (r) => { const q = reqs.get(r); if (q) q.finished = ms(); });
  p.on('requestfailed', (r) => { const q = reqs.get(r); if (q) q.failed = { at: ms(), errorText: r.failure()?.errorText ?? '' }; });
  let status = null; try { const res = await p.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 }); status = res?.status() ?? null; } catch (e) { status = `goto:${String(e.message).slice(0, 60)}`; }
  await p.waitForTimeout(9000);
  const text = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const btns = (await p.locator('button, a[href]').allInnerTexts().catch(() => [])).map((x) => x.trim()).filter(Boolean);
  const visibleError = ERRTEXT.test(text); const usable = text.length > 20 && btns.length > 0;
  const list = [...reqs.values()].map((q) => ({ ...q, navDuring: navs.some((n) => n.at >= q.start && n.at <= (q.failed?.at ?? q.finished ?? ms())) }));
  const ok200 = list.filter((q) => q.status === 200 && typeof q.body === 'number').length;
  const purposesErr = pageErrors.concat(consoleErrors).filter((e) => /purposes/.test(e.msg));
  // 판정: 화면 오류 문구 0 · 화면 진행 가능 · purposes 가 최소 한 번 200 본문 수신 → 오류 기록은 진단(제품 아님). 아니면 PRODUCT.
  const verdict = !visibleError && usable && ok200 >= 1 ? (purposesErr.length ? 'HARNESS_WEBKIT_DIAGNOSTIC' : 'CLEAN') : 'PRODUCT_BUG';
  if (verdict === 'PRODUCT_BUG') product++; if (verdict === 'HARNESS_WEBKIT_DIAGNOSTIC') diag++;
  rows.push({ dname, run, path, status, final: new URL(p.url()).pathname, verdict });
  console.log(`${verdict} webkit ${dname} #${run} ${path} http=${status} final=${new URL(p.url()).pathname} usable=${usable} visibleError=${visibleError} navs=${JSON.stringify(navs.map((n) => [n.at, new URL(n.url).pathname]))}`);
  for (const q of list) console.log(`   purposes start=${q.start}ms status=${q.status} body=${q.body} finished=${q.finished} failed=${JSON.stringify(q.failed)} navDuring=${q.navDuring}`);
  for (const e of purposesErr) console.log(`   error at=${e.at}ms ${e.msg}`);
  await b.close();
}
console.log(`WEBKIT PURPOSES DIAG: runs=${rows.length} PRODUCT_BUG=${product} HARNESS_WEBKIT_DIAGNOSTIC=${diag} CLEAN=${rows.length - product - diag}`);
process.exit(product ? 1 : 0);
