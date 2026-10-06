// 대화 화면 B-style 전후 캡처 + 측정(가짜 서버 기준). 실제 Supabase/OpenAI 요청 0.
// 사용: node shots.mjs <빌드 폴더> <라벨> <http 포트>
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = process.argv[2]; const LABEL = process.argv[3]; const HTTP = Number(process.argv[4] || 4690);
const BASE = `http://127.0.0.1:${HTTP}`; const DIR = `shots/${LABEL}`; mkdirSync(DIR, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, BASE).pathname); let f = join(OUT, p); if (!existsSync(f) || statSync(f).isDirectory()) f = join(OUT, 'index.html'); res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise((r) => srv.listen(HTTP, '127.0.0.1', r));

const REF = 'zyyhhxyupizcqhxqnxuu'; const UID = '00000000-0000-0000-0000-0000000000c1';
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'qa@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T00:00:00Z' };
const SESSION = { access_token: 'local-mock', refresh_token: 'local-mock', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 36000, user: USER };
const PURPOSES = [{ id: 'friend', label: '편한 친구를 만나고 싶어요', description: '부담 없이 알아가며 친구가 되고 싶어요.', sort_order: 1 }, { id: 'romantic', label: '연애로 이어질 만남을 원해요', description: '연애 가능성을 열어두고 알아가고 싶어요.', sort_order: 2 }, { id: 'hobby', label: '취미를 같이 할 사람', description: '같은 걸 좋아하는 사람과 함께하고 싶어요.', sort_order: 3 }, { id: 'talk', label: '대화가 통하는 사람', description: '깊은 이야기를 나눌 수 있는 사람을 원해요.', sort_order: 4 }];
const Q1 = '편하게 만날 수 있는 사람이면 좋겠다고 하셨죠.\n처음 만나면 어디서 보고 싶어요?';
const ERR = '다음 질문을 아직 만들지 못했어요. 적은 답은 저장돼 있어요. 「다음 질문 받기」를 눌러 주세요.';
const rec = (i, text) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, user_id: UID, text, original_text: text, emotion: '', status: 'confirmed', revision: 1, created_at: `2026-09-24T10:0${i}:00.000Z` });

// scenario: opening | start | question | unsaved | error | loading | restart
function mock(scn) {
  const state = { records: [], question: null };
  if (!['opening', 'opening-selected', 'start'].includes(scn)) { state.records = [rec(2, '보드게임 같은 거 같이 하면 좋겠어요'), rec(1, '그냥 편한친구 부담없이')]; state.question = { text: Q1, sourceRecordId: state.records[0].id, topic: 'pace' }; }
  return async (route) => {
    const req = route.request(); const url = req.url(); const m = req.method();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (url.includes('/auth/v1/user')) return json(USER);
    if (url.includes('/rest/v1/purposes')) return json(PURPOSES);
    if (url.includes('/rest/v1/profiles')) {
      if (m !== 'GET') return json([]);
      const row = { consent_version: 'v1.0', purpose_id: scn.startsWith('opening') ? null : 'friend', purpose_label: scn.startsWith('opening') ? null : '편한 친구를 만나고 싶어요', nickname: null, bio: null, region: null, life_rhythm: null };
      return json(req.headers()['accept']?.includes('vnd.pgrst.object') ? row : [row]);
    }
    if (url.includes('/functions/v1/doit-understanding')) {
      const body = JSON.parse(req.postData() || '{}');
      if (body.action === 'record_list') return json({ ok: true, records: state.records });
      if (body.action === 'insight_list') return json({ ok: true, insights: [] });
      if (body.action === 'followup_get') return json({ ok: true, question: state.question && body.recordId === state.question.sourceRecordId ? state.question : null });
      if (body.action === 'turn') {
        if (scn === 'unsaved') return json({ ok: true, kind: 'ask', saved: false, record: null, question: null, reply: '어떤 사람을 소개할지 정하려고 물어봐요.' });
        const r = rec(3, body.text || '');
        if (scn === 'error') return json({ ok: true, kind: 'answer', saved: true, record: r, question: null, questionError: ERR });
        if (scn === 'loading') await new Promise((ok) => setTimeout(ok, 6000));
        return json({ ok: true, kind: 'answer', saved: true, record: r, question: { text: '조용한 카페라고 하셨죠.\n그런 곳에서 보통 뭘 하며 쉬어요?', sourceRecordId: r.id, topic: 'together' } });
      }
      return json({ ok: true });
    }
    if (url.includes('supabase.co')) return json({});
    return route.continue();
  };
}

// 글꼴: 구글 폰트는 curl 로 받아 넘기고(같은 요청 캐시), Pretendard 는 같은 판(v1.3.9) 로컬 사본으로 채운다 — 캡처가 실제 글꼴로 찍히도록.
const PRET = '../fontpkg/package/dist/web/static'; const fcache = new Map();
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
async function fontRoute(r) {
  const u = r.request().url();
  try { if (!fcache.has(u)) fcache.set(u, execFileSync('curl', ['-sS', '--max-time', '20', '-A', UA, u], { maxBuffer: 20 * 1024 * 1024 })); await r.fulfill({ status: 200, contentType: /gstatic/.test(u) ? 'font/woff2' : 'text/css', body: fcache.get(u), headers: { 'access-control-allow-origin': '*' } }); }
  catch { await r.fulfill({ status: 200, contentType: 'text/css', body: '' }); }
}
const WIDTHS = [[360, 780], [390, 844], [430, 932], [1440, 900]];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const report = [];
async function open(w, h, scn) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800, deviceScaleFactor: 1 });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); sessionStorage.setItem('doit:intro-seen', '1'); localStorage.setItem('doit:install-card', 'collapsed'); } catch {} }, [`sb-${REF}-auth-token`, JSON.stringify(SESSION)]);
  await ctx.route(/fonts\.googleapis|fonts\.gstatic/, fontRoute);
  await ctx.route(/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard/, (r) => { const rel = r.request().url().split('/dist/web/static/')[1]?.split('?')[0]; const f = rel && join(PRET, rel === 'pretendard.min.css' ? 'pretendard.css' : rel); if (f && existsSync(f)) return r.fulfill({ status: 200, contentType: f.endsWith('.css') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(f) }); return r.fulfill({ status: 404, body: '' }); });
  await ctx.route(/cdnjs|jsdelivr/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route(/supabase\.co|helloreaddy|readdy/, mock(scn));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  return { ctx, page, errors };
}
async function measure(page) {
  return page.evaluate(async () => {
    const cs = (sel) => { const el = document.querySelector(sel); if (!el) return null; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { font: s.fontFamily.split(',')[0], size: s.fontSize, weight: s.fontWeight, color: s.color, bg: s.backgroundColor, bgImg: s.backgroundImage.slice(0, 40), radius: s.borderRadius, border: s.borderTopColor + ' ' + s.borderTopWidth, h: Math.round(r.height), w: Math.round(r.width), anim: s.animationName }; };
    const clipped = [...document.querySelectorAll('.echo-dialogue *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1); }).map((el) => el.className || el.tagName).slice(0, 5);
    await document.fonts.ready; return { fonts: { pretendard: document.fonts.check('700 24px Pretendard'), gowun: document.fonts.check('16px "Gowun Batang"') }, overflow: document.documentElement.scrollWidth > window.innerWidth, clipped, question: cs('.echo-question'), h1: cs('.echo-dialogue h1'), primary: cs('.echo-dialogue .echo-primary'), secondary: cs('.echo-dialogue .echo-secondary'), restart: cs('.echo-restart-pill'), textarea: cs('#echo-message'), send: cs('.echo-composer-footer button'), steps: cs('.echo-steps-count'), bar: cs('.echo-steps-bar'), textBtn: cs('.echo-text-button'), error: cs('.echo-error'), root: cs('.echo-dialogue') };
  });
}
async function scene(w, h, scn) {
  const { ctx, page, errors } = await open(w, h, scn);
  await page.goto(`${BASE}/doit/conversation`); await page.waitForTimeout(2500);
  if (scn === 'unsaved' || scn === 'error' || scn === 'loading') {
    await page.fill('#echo-message', scn === 'unsaved' ? '왜 이런 걸 물어봐?' : '조용한 카페'); await page.click('.echo-composer-footer button');
    await page.waitForTimeout(scn === 'loading' ? 900 : 1500);
  }
  if (scn === 'restart') { await page.click('.echo-restart-top .echo-restart-pill'); await page.waitForTimeout(500); }
  const metrics = await measure(page);
  const text = await page.locator('body').innerText();
  await page.screenshot({ path: `${DIR}/${w}-${scn}.png`, fullPage: w < 800 });
  if (w < 800) await page.screenshot({ path: `${DIR}/${w}-${scn}-first.png` });
  report.push({ w, scn, errors, metrics, seen: { question: text.includes('처음 만나면 어디서') || text.includes('어떤 만남을 원하세요'), error: text.includes('다음 질문을 아직 만들지 못했어요'), unsaved: text.includes('이 말은 답으로 남길게요'), restartConfirm: text.includes('계속할게요'), loading: text.includes('방금 한 말을 읽고 있어요') } });
  await ctx.close();
}

// 글자 둘레 실측: 글자 획에서 2~3px 떨어진 실제 픽셀(그림자·유리 포함)과 글자색의 대비. 하위 10% 값으로 판정.
const GLASS = '.echo-brief,.echo-done,.echo-synthesis,.echo-restart,.echo-pause,.echo-insight,.echo-editor,.echo-opening-tile,.echo-secondary,.echo-restart-pill,.echo-reactions button,textarea';
async function glyphMeasure(w, h, scn, cfg) {
  const { ctx, page } = await open(w, h, scn);
  await page.goto(`${BASE}/doit/conversation`); await page.waitForTimeout(2500);
  if (scn === 'error' || scn === 'unsaved') { await page.fill('#echo-message', scn === 'unsaved' ? '왜 이런 걸 물어봐?' : '조용한 카페'); await page.click('.echo-composer-footer button'); await page.waitForTimeout(1500); }
  if (scn === 'restart') { await page.click('.echo-restart-top .echo-restart-pill'); await page.waitForTimeout(500); }
  if (scn === 'opening-selected') { await page.click('.echo-opening-tile >> nth=0'); await page.waitForTimeout(300); }
  await page.addStyleTag({ content: `.echo-dialogue.echo-dialogue--pastel{${cfg.alpha != null ? `--conversation-glass-alpha:${cfg.alpha}!important;` : ''}${cfg.halo != null ? `--conversation-text-halo:${cfg.halo}!important;` : ''}} *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}` });
  if (cfg.scrollBottom) await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(cfg.scrollBottom ? 1500 : 250);
  const items = await page.evaluate((GLASS) => {
    const root = document.querySelector('.echo-dialogue'); const out = []; const seen = new Set();
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const t = w.currentNode; if (!t.textContent.trim()) continue; const el = t.parentElement; if (seen.has(el)) continue; seen.add(el);
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.top < 0 || r.bottom > innerHeight || getComputedStyle(el).visibility === 'hidden') continue;
      const s = getComputedStyle(el); const fill = s.webkitTextFillColor && !/rgba\(0, 0, 0, 0\)/.test(s.webkitTextFillColor) ? s.webkitTextFillColor : s.color;
      if (/rgba\(0, 0, 0, 0\)/.test(fill)) continue;
      const px = parseFloat(s.fontSize); out.push({ text: t.textContent.trim().slice(0, 18), color: fill, large: px >= 24 || (px >= 18.66 && +s.fontWeight >= 700), glass: !!el.closest(GLASS), rect: { x: r.x, y: r.y, w: r.width, h: r.height } }); }
    for (const ta of root.querySelectorAll('textarea')) { if (ta.value) continue; const r = ta.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) continue; const s = getComputedStyle(ta); out.push({ text: '(placeholder) ' + ta.placeholder.slice(0, 12), color: getComputedStyle(ta, '::placeholder').color, large: false, glass: true, rect: { x: r.x + parseFloat(s.paddingLeft) - 2, y: r.y + parseFloat(s.paddingTop) - 2, w: r.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) + 4, h: parseFloat(s.lineHeight) * 1.2 + 4 } }); }
    return out;
  }, GLASS);
  const C = await page.screenshot();
  // S: 글자는 투명, 그림자는 그대로 — 글자 뒤·둘레의 실제 바탕(그림자 포함)
  const sTag = await page.addStyleTag({ content: '.echo-dialogue--pastel,.echo-dialogue--pastel *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-decoration-color:transparent!important}.echo-dialogue--pastel textarea::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}.echo-dialogue--pastel svg,.echo-dialogue--pastel img,.echo-dialogue--pastel canvas{visibility:hidden!important}' });
  await page.waitForTimeout(150);
  const S = await page.screenshot();
  await sTag.evaluate((n) => n.remove());
  await page.addStyleTag({ content: '.echo-dialogue--pastel,.echo-dialogue--pastel *{color:#f0f!important;-webkit-text-fill-color:#f0f!important;text-shadow:none!important;text-decoration-color:#f0f!important}.echo-dialogue--pastel textarea::placeholder{color:#f0f!important;-webkit-text-fill-color:#f0f!important}.echo-dialogue--pastel svg,.echo-dialogue--pastel img,.echo-dialogue--pastel canvas{visibility:hidden!important}' });
  await page.waitForTimeout(150);
  const A = await page.screenshot();
  await page.addStyleTag({ content: '.echo-dialogue--pastel,.echo-dialogue--pastel *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-decoration-color:transparent!important}.echo-dialogue--pastel textarea::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}' });
  await page.waitForTimeout(150);
  const B = await page.screenshot();
  const probe = await ctx.newPage();
  const res = await probe.evaluate(async ({ a, b, c, s, items, RING_MIN, RING_MAX, STAT }) => {
    const load = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const g = cv.getContext('2d'); g.drawImage(i, 0, 0); return { d: g.getImageData(0, 0, i.width, i.height).data, W: i.width, H: i.height }; };
    const A = await load(a), B = await load(b), C = await load(s);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return items.map((it) => {
      const x0 = Math.max(0, Math.floor(it.rect.x) - 3), y0 = Math.max(0, Math.floor(it.rect.y) - 3), x1 = Math.min(A.W - 1, Math.ceil(it.rect.x + it.rect.w) + 3), y1 = Math.min(A.H - 1, Math.ceil(it.rect.y + it.rect.h) + 3);
      const W = x1 - x0 + 1, H = y1 - y0 + 1; const ink = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = ((y + y0) * A.W + (x + x0)) * 4; if (Math.abs(A.d[k] - B.d[k]) + Math.abs(A.d[k + 1] - B.d[k + 1]) + Math.abs(A.d[k + 2] - B.d[k + 2]) > 10) ink[y * W + x] = 1; } // 글자 = 자홍 글자 화면과 글자 없는 화면이 다른 곳(가는 획의 흐린 가장자리까지)
      let inkN = 0; for (const v of ink) inkN += v;
      if (!inkN) return { ...it, skip: true };
      const tc = it.color.match(/[\d.]+/g).map(Number); const Lt = L(tc[0], tc[1], tc[2]);
      const vals = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (ink[y * W + x]) continue; let dmin = 9; for (let dy = -3; dy <= 3 && dmin > 1; dy++) for (let dx = -3; dx <= 3; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= H || xx >= W) continue; if (ink[yy * W + xx]) { const d = Math.max(Math.abs(dx), Math.abs(dy)); if (d < dmin) dmin = d; } }
        if (dmin >= RING_MIN && dmin <= RING_MAX) { const k = ((y + y0) * C.W + (x + x0)) * 4; const Lb = L(C.d[k], C.d[k + 1], C.d[k + 2]); vals.push((Math.max(Lt, Lb) + 0.05) / (Math.min(Lt, Lb) + 0.05)); } }
      vals.sort((p, q) => p - q);
      return { text: it.text, glass: it.glass, large: it.large, need: it.large ? 3 : 4.5, p10: +(vals[Math.floor(vals.length * (STAT === 'median' ? 0.5 : 0.1))] ?? 0).toFixed(2), min: +(vals[0] ?? 0).toFixed(2), n: vals.length };
    });
  }, { a: A.toString('base64'), b: B.toString('base64'), c: C.toString('base64'), s: S.toString('base64'), items, RING_MIN: +(process.env.RING_MIN || 1), RING_MAX: +(process.env.RING_MAX || 3), STAT: process.env.STAT || 'p10' });
  if (cfg.shot) { writeFileSync(`${DIR}/${cfg.shot}-${w}-${scn}.png`, C); writeFileSync(`${DIR}/${cfg.shot}-${w}-${scn}-A.png`, A); writeFileSync(`${DIR}/${cfg.shot}-${w}-${scn}-B.png`, B); writeFileSync(`${DIR}/${cfg.shot}-${w}-${scn}-S.png`, S); writeFileSync(`${DIR}/${cfg.shot}-${w}-${scn}-items.json`, JSON.stringify(items)); }
  await ctx.close();
  return res.filter((r) => !r.skip);
}
const cfgs = JSON.parse(process.argv[5]);
const SCN = (process.env.SCN || 'opening,opening-selected,start,question,unsaved,error,restart').split(',');
const WS = (process.env.WS || '360,390,430,1440').split(',').map(Number);
const summary = [];
for (const cfg of cfgs) {
  const rows = [];
  for (const w of WS) for (const scn of SCN) for (const sb of (process.env.BOTTOM ? [false, true] : [false])) { const h = { 360: 780, 390: 844, 430: 932, 1440: 900 }[w]; for (const r of await glyphMeasure(w, h, scn, { ...cfg, scrollBottom: sb })) rows.push({ w, scn: scn + (sb ? '↓' : ''), ...r }); }
  const g = rows.filter((r) => r.glass), f = rows.filter((r) => !r.glass);
  const fails = rows.filter((r) => r.p10 < r.need);
  const minOf = (a) => a.length ? a.reduce((m, r) => (r.p10 / r.need < m.p10 / m.need ? r : m)) : null;
  const wg = minOf(g), wf = minOf(f);
  const line = `${cfg.name}: 글자 ${rows.length}개 · 미달 ${fails.length} · 유리 안 최저 ${wg ? `${wg.p10} "${wg.text}" ${wg.w}/${wg.scn}` : '-'} · 파스텔 위 최저 ${wf ? `${wf.p10}(need ${wf.need}) "${wf.text}" ${wf.w}/${wf.scn}` : '-'}`;
  console.log(line); if (process.env.PER) for (const r of rows.filter((r) => !r.glass)) console.log(`      ${r.text.padEnd(18)} p10=${r.p10}`); for (const x of fails.slice(0, 0)) console.log(`    미달 ${x.w}/${x.scn} ${x.glass ? '유리' : '파스텔'} "${x.text}" p10=${x.p10} need=${x.need}`);
  summary.push({ cfg, n: rows.length, fails, rows });
}
writeFileSync(`${DIR}/glyph-${Date.now()}.json`, JSON.stringify(summary, null, 1));
await browser.close(); srv.close();
