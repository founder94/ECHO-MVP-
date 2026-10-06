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
  if (!['opening', 'start'].includes(scn)) { state.records = [rec(2, '보드게임 같은 거 같이 하면 좋겠어요'), rec(1, '그냥 편한친구 부담없이')]; state.question = { text: Q1, sourceRecordId: state.records[0].id, topic: 'pace' }; }
  return async (route) => {
    const req = route.request(); const url = req.url(); const m = req.method();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (url.includes('/auth/v1/user')) return json(USER);
    if (url.includes('/rest/v1/purposes')) return json(PURPOSES);
    if (url.includes('/rest/v1/profiles')) {
      if (m !== 'GET') return json([]);
      const row = { consent_version: 'v1.0', purpose_id: scn === 'opening' ? null : 'friend', purpose_label: scn === 'opening' ? null : '편한 친구를 만나고 싶어요', nickname: null, bio: null, region: null, life_rhythm: null };
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

// 목적 선택 카드(유리) — 지금 값 실측 + 투명도별 글자 대비·파스텔 비침 실측
const glass = (a) => a === null ? '' : `.echo-dialogue.echo-dialogue--pastel .echo-opening-tile{background:rgb(23 26 32/${a})!important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-color:rgb(255 255 255/.14)!important}.echo-dialogue.echo-dialogue--pastel .echo-opening-tile.is-selected{background:rgb(34 38 46/${a})!important;border-color:#ffffff9c!important}${process.env.DESC ? `.echo-dialogue.echo-dialogue--pastel .echo-opening-tile-desc{color:${process.env.DESC}!important}` : ""}`;
async function measureTiles(w, h, a, select, shot) {
  const { ctx, page } = await open(w, h, 'opening');
  await page.goto(`${BASE}/doit/conversation`); await page.waitForTimeout(2500);
  await page.addStyleTag({ content: glass(a) + '*,*::before,*::after{animation:none!important;transition:none!important}' });
  if (select) { await page.click('.echo-opening-tile >> nth=0'); await page.waitForTimeout(200); }
  await page.evaluate(() => document.querySelector('.echo-opening-tiles')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
  const cur = await page.evaluate(() => [...document.querySelectorAll('.echo-opening-tile')].slice(0, 2).map((el) => { const s = getComputedStyle(el); return { cls: el.className, background: s.backgroundColor, opacity: s.opacity, border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`, radius: s.borderRadius, shadow: s.boxShadow, backdrop: s.backdropFilter || s.webkitBackdropFilter, color: s.color, label: getComputedStyle(el.querySelector('.echo-opening-tile-label')).color, desc: getComputedStyle(el.querySelector('.echo-opening-tile-desc')).color }; }));
  if (shot) await page.screenshot({ path: shot });
  const items = await page.evaluate(() => [...document.querySelectorAll('.echo-opening-tile')].flatMap((tile, i) => [...tile.querySelectorAll('span')].map((el) => { const r = el.getBoundingClientRect(); const t = tile.getBoundingClientRect(); const s = getComputedStyle(el); return { i, sel: tile.classList.contains('is-selected'), text: el.textContent.slice(0, 14), color: s.color, px: parseFloat(s.fontSize), rect: { x: r.x, y: r.y, w: r.width, h: r.height }, tile: { x: t.x + 3, y: t.y + 3, w: t.width - 6, h: t.height - 6 } }; })).filter((it) => it.rect.y > 0 && it.rect.y + it.rect.h < innerHeight));
  await page.addStyleTag({ content: '.echo-opening-tile span{visibility:hidden!important}' }); await page.waitForTimeout(100);
  const png = await page.screenshot();
  const probe = await ctx.newPage();
  const res = await probe.evaluate(async ({ b64, items }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = ([r, gg, b]) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    const px = (r) => g.getImageData(r.x | 0, r.y | 0, Math.max(1, r.w | 0), Math.max(1, r.h | 0)).data;
    return items.map((it) => { const d = px(it.rect); const tc = it.color.match(/[\d.]+/g).map(Number); const Lt = L(tc); let worst = 99;
      for (let i = 0; i < d.length; i += 28) { const Lb = L([d[i], d[i + 1], d[i + 2]]); worst = Math.min(worst, (Math.max(Lt, Lb) + 0.05) / (Math.min(Lt, Lb) + 0.05)); }
      const t = px(it.tile); let chroma = 0, n = 0; for (let i = 0; i < t.length; i += 40) { chroma += Math.max(t[i], t[i + 1], t[i + 2]) - Math.min(t[i], t[i + 1], t[i + 2]); n++; }
      return { i: it.i, sel: it.sel, text: it.text, px: it.px, ratio: +worst.toFixed(2), chroma: +(chroma / n).toFixed(1) }; });
  }, { b64: png.toString('base64'), items });
  await ctx.close();
  return { cur, res };
}
const mode = process.argv[5] || 'sweep';
if (mode === 'current') {
  for (const [w, h] of WIDTHS.slice(0, 3)) for (const sel of [false, true]) { const { cur, res } = await measureTiles(w, h, null, sel, `${DIR}/tiles-${w}${sel ? '-selected' : ''}.png`); if (w === 390) console.log(JSON.stringify(cur, null, 1)); console.log(w, sel ? 'selected' : 'none', 'min ratio', Math.min(...res.map((r) => r.ratio)), 'chroma', Math.min(...res.map((r) => r.chroma))); }
} else {
  for (const a of mode.split(',').map(Number)) {
    let minR = 99, minC = 999, fails = []; 
    for (const [w, h] of WIDTHS.slice(0, 3)) for (const sel of [false, true]) { const { res } = await measureTiles(w, h, a, sel, process.env.SHOT ? `${DIR}/tiles-${a}-${w}${sel ? '-selected' : ''}.png` : null); for (const r of res) { minR = Math.min(minR, r.ratio); minC = Math.min(minC, r.chroma); if (r.ratio < 4.5) fails.push(`${w}${sel ? 'S' : ''} tile${r.i} "${r.text}" ${r.ratio}`); } }
    console.log(`alpha ${a}: min ratio ${minR} · min chroma(파스텔 비침, 0=무채색) ${minC} · fails ${fails.length}`, fails.slice(0, 4).join(' | '));
  }
}
await browser.close(); srv.close();
