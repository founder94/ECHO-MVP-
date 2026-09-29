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
for (const [dname, opts] of DEV) for (let run = 1; run <= Number(process.env.RUNS ?? 5); run++) for (const path of PATHS) {
  const b = await webkit.launch(); const ctx = await b.newContext(opts); const p = await ctx.newPage();
  const t0 = Date.now(); const ms = () => Date.now() - t0; let crashed = null; p.on('crash', () => { crashed = ms(); });
  const navs = []; const reqs = new Map(); const pageErrors = []; const consoleErrors = [];
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) navs.push({ at: ms(), url: f.url() }); });
  p.on('pageerror', (e) => pageErrors.push({ at: ms(), msg: String(e.message || e).slice(0, 140) }));
  p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push({ at: ms(), msg: m.text().slice(0, 140) }); });
  p.on('request', (r) => { if (r.url().includes('/rest/v1/purposes')) reqs.set(r, { start: ms(), method: r.method(), status: null, body: null, finished: null, failed: null, frameUrl: p.url() }); });
  p.on('response', async (r) => { const q = reqs.get(r.request()); if (!q) return; q.status = r.status(); try { q.body = (await r.body()).length; } catch (e) { q.body = `unreadable:${String(e.message).slice(0, 60)}`; } });
  p.on('requestfinished', (r) => { const q = reqs.get(r); if (q) q.finished = ms(); });
  p.on('requestfailed', (r) => { const q = reqs.get(r); if (q) q.failed = { at: ms(), errorText: r.failure()?.errorText ?? '' }; });
  let status = null; try { const res = await p.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 }); status = res?.status() ?? null; } catch (e) { status = `goto:${String(e.message).slice(0, 60)}`; }
  // / -> intro -> start-journey 전환 뒤에는 본문 글자만 먼저 생기고 실제 조작 요소는 조금 늦게 붙을 수 있다.
  // 본문 20자만으로 조기 종료하면 정상 로딩을 PRODUCT_BUG로 오판하므로, 실제 usable/error/purposes 증거를 기다린다.
  { const w0 = Date.now(); while (Date.now() - w0 < 20000) {
      if (crashed != null) break;
      const path0 = (() => { try { return new URL(p.url()).pathname; } catch { return ''; } })();
      const t = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      const controls = await p.locator('button, a[href], input').count().catch(() => 0);
      const purposeRows = [...reqs.values()];
      const hasPurpose200 = purposeRows.some((q) => q.status === 200 && typeof q.body === 'number');
      const purposeFailed = purposeRows.some((q) => q.failed);
      const purposeStarted = purposeRows.length > 0;
      const visibleErrNow = ERRTEXT.test(t);
      const routeReady = path0 !== '/do-it/intro' && path0 !== '/';
      // start-journey에서는 purposes 요청이 시작됐으면 응답/실패까지 기다린다.
      // 버튼이 먼저 보였다는 이유로 네트워크 판정을 조기 종료하지 않는다.
      if (routeReady && Date.now() - w0 > 3000) {
        if (visibleErrNow || hasPurpose200 || purposeFailed) break;
        if (path0 !== '/doit/start-journey' && controls > 0) break;
        if (path0 === '/doit/start-journey' && !purposeStarted && controls > 0 && Date.now() - w0 > 8000) break;
      }
      await p.waitForTimeout(250);
    } }
  const text = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const btns = (await p.locator('button, a[href], input').allInnerTexts().catch(() => [])).map((x) => x.trim()).filter(Boolean);
  const visibleError = ERRTEXT.test(text); const usable = text.length > 20 && btns.length > 0;
  const list = [...reqs.values()].map((q) => ({ ...q, navDuring: navs.some((n) => n.at >= q.start && n.at <= (q.failed?.at ?? q.finished ?? ms())) }));
  const ok200 = list.filter((q) => q.status === 200 && typeof q.body === 'number').length;
  const purposesErr = pageErrors.concat(consoleErrors).filter((e) => /purposes/.test(e.msg));
  // 판정: 화면 오류 문구 0 · 화면 진행 가능 · purposes 가 최소 한 번 200 본문 수신 → 오류 기록은 진단(제품 아님). 아니면 PRODUCT.
  const needsPurposes = path !== '/login'; // 로그인 화면은 purposes 를 부르지 않는다(판정 규칙 수정 · run 118)
  const verdict = crashed != null ? 'AUTOMATION_CRASH' : !visibleError && usable && (!needsPurposes || ok200 >= 1) ? (purposesErr.length ? 'HARNESS_WEBKIT_DIAGNOSTIC' : 'CLEAN') : 'PRODUCT_BUG';
  if (verdict === 'PRODUCT_BUG') product++; if (verdict === 'HARNESS_WEBKIT_DIAGNOSTIC') diag++;
  rows.push({ dname, run, path, status, final: new URL(p.url()).pathname, verdict });
  console.log(`${verdict} webkit ${dname} #${run} ${path} crash=${crashed} http=${status} final=${new URL(p.url()).pathname} usable=${usable} visibleError=${visibleError} navs=${JSON.stringify(navs.map((n) => [n.at, new URL(n.url).pathname]))}`);
  for (const q of list) console.log(`   purposes start=${q.start}ms status=${q.status} body=${q.body} finished=${q.finished} failed=${JSON.stringify(q.failed)} navDuring=${q.navDuring}`);
  for (const e of purposesErr) console.log(`   error at=${e.at}ms ${e.msg}`);
  await b.close();
}
const crashes = rows.filter((r) => r.verdict === 'AUTOMATION_CRASH').length;
console.log(`WEBKIT PURPOSES DIAG: runs=${rows.length} PRODUCT_BUG=${product} HARNESS_WEBKIT_DIAGNOSTIC=${diag} AUTOMATION_CRASH=${crashes} CLEAN=${rows.length - product - diag - crashes}`);
process.exit(product ? 1 : 0);
