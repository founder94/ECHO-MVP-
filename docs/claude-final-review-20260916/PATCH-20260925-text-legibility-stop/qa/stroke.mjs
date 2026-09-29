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
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800, deviceScaleFactor: +(process.env.DPR || 1) });
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

// 투명 판 안 흰 글씨 — 얇은 테두리(stroke)·최소 그림자 비교. 실제 휴대폰처럼 배율 3배로 찍는다.
// 재는 것: ① 표준(WCAG) = 글자색 ↔ 글자 뒤 파스텔(테두리·그림자 제외) ② 테두리 기준 = 글자색 ↔ 글자 바로 둘레 1기기픽셀(테두리·그림자 포함)
const SURF = '.echo-dialogue.echo-dialogue--pastel :is(textarea,.echo-secondary,.echo-restart-pill,.echo-opening-tile,.echo-brief,.echo-done,.echo-synthesis,.echo-restart,.echo-pause,.echo-insight,.echo-editor,.echo-reactions button:not(:first-child))';
const cfgCss = (c) => !c.stroke && !c.shadow ? '' : `${SURF}{${c.stroke ? `-webkit-text-stroke:${c.stroke};paint-order:stroke fill;` : ''}${c.shadow ? `text-shadow:${c.shadow};` : ''}}${c.shadow ? `.echo-dialogue.echo-dialogue--pastel textarea::placeholder{text-shadow:${c.shadow}}` : ''}`;
const TARGET = ['.echo-restart-pill', '.echo-opening-tile-label', '.echo-opening-tile-desc', '.echo-secondary', '.echo-error p', 'TEXTAREA'];
async function run(w, h, scn, c) {
  const { ctx, page } = await open(w, h, scn.replace(/-typed|-bottom/g, ''));
  await page.goto(`${BASE}/doit/conversation`); await page.waitForTimeout(2500);
  if (scn === 'opening-selected') { await page.click('.echo-opening-tile >> nth=0'); await page.waitForTimeout(300); }
  if (scn === 'error') { await page.fill('#echo-message', '조용한 카페'); await page.click('.echo-composer-footer button'); await page.waitForTimeout(1500); }
  if (scn.endsWith('-typed')) { await page.fill('#echo-message', '주말에 조용한 카페에서 보고 싶어요'); await page.evaluate(() => document.activeElement?.blur()); }
  await page.addStyleTag({ content: cfgCss(c) + '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  if (scn.endsWith('-bottom')) await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  if (scn === 'question-typed') await page.evaluate(() => document.querySelector('#echo-message').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(1200);
  const items = await page.evaluate((TARGET) => {
    const out = []; const root = document.querySelector('.echo-dialogue');
    const push = (el, label, color, rect, kind) => { if (rect.width < 2 || rect.top < 0 || rect.bottom > innerHeight) return; out.push({ label, color, kind, rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } }); };
    for (const sel of TARGET) for (const el of root.querySelectorAll(sel)) {
      const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (el.tagName === 'TEXTAREA') { const pad = (k) => parseFloat(s[k]); const lh = parseFloat(s.lineHeight) || 24; const box = { x: r.x + pad('paddingLeft') - 2, y: r.y + pad('paddingTop') - 2, width: r.width - pad('paddingLeft') - pad('paddingRight') + 4, height: lh * (el.value ? 2 : 1) + 4 }; box.top = box.y; box.bottom = box.y + box.height;
        push(el, el.value ? '입력 글자' : '입력창 안내 글(placeholder)', el.value ? s.color : getComputedStyle(el, '::placeholder').color, box, el.value ? 'typed' : 'placeholder'); continue; }
      const t = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
      if (!t) continue;
      push(el, `${sel} "${t.slice(0, 12)}"`, s.webkitTextFillColor && !/0\)$/.test(s.webkitTextFillColor) ? s.webkitTextFillColor : s.color, r, 'text');
    }
    const send = root.querySelector('.echo-composer-footer button'); if (send) { const r = send.getBoundingClientRect(); push(send, '보내기 버튼(↑ 그림)', getComputedStyle(send).color, { x: r.x + 10, y: r.y + 10, width: r.width - 20, height: r.height - 20, top: r.top, bottom: r.bottom }, 'icon'); }
    return out;
  }, TARGET);
  const shot = () => page.screenshot();
  const C = await shot();
  const hideFill = '.echo-dialogue--pastel,.echo-dialogue--pastel *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-decoration-color:transparent!important}.echo-dialogue--pastel textarea::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}.echo-dialogue--pastel img,.echo-dialogue--pastel canvas{visibility:hidden!important}';
  const t1 = await page.addStyleTag({ content: hideFill }); await page.waitForTimeout(120); const S = await shot();
  const t2 = await page.addStyleTag({ content: '.echo-dialogue--pastel,.echo-dialogue--pastel *,.echo-dialogue--pastel textarea::placeholder{-webkit-text-stroke:0!important;text-shadow:none!important}.echo-dialogue--pastel svg{visibility:hidden!important}' }); await page.waitForTimeout(120); const B = await shot();
  await t1.evaluate((n) => n.remove());
  await page.addStyleTag({ content: '.echo-dialogue--pastel,.echo-dialogue--pastel *{color:#f0f!important;-webkit-text-fill-color:#f0f!important}.echo-dialogue--pastel textarea::placeholder{color:#f0f!important;-webkit-text-fill-color:#f0f!important}.echo-dialogue--pastel svg{visibility:visible!important;color:#f0f!important}.echo-dialogue--pastel svg *{stroke:#f0f!important}' }); await page.waitForTimeout(120);
  const A = await shot();
  const dpr = +(process.env.DPR || 1);
  const probe = await ctx.newPage();
  const res = await probe.evaluate(async ({ a, b, c, s, items, dpr }) => {
    const load = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const g = cv.getContext('2d'); g.drawImage(i, 0, 0); return { d: g.getImageData(0, 0, i.width, i.height).data, W: i.width, H: i.height }; };
    const A = await load(a), B = await load(b), S = await load(s);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = (r, g, bb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bb);
    const cr = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    return items.map((it) => {
      const x0 = Math.max(0, Math.floor((it.rect.x - 3) * dpr)), y0 = Math.max(0, Math.floor((it.rect.y - 3) * dpr)), x1 = Math.min(A.W - 1, Math.ceil((it.rect.x + it.rect.w + 3) * dpr)), y1 = Math.min(A.H - 1, Math.ceil((it.rect.y + it.rect.h + 3) * dpr));
      const W = x1 - x0 + 1, H = y1 - y0 + 1; const ink = new Uint8Array(W * H); let inkN = 0, sr = 0, sg = 0, sb = 0, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = ((y + y0) * A.W + (x + x0)) * 4; const df = Math.abs(A.d[k] - B.d[k]) + Math.abs(A.d[k + 1] - B.d[k + 1]) + Math.abs(A.d[k + 2] - B.d[k + 2]); if (df > 30) { ink[y * W + x] = 1; inkN++; } else { sr += B.d[k]; sg += B.d[k + 1]; sb += B.d[k + 2]; n++; } }
      if (!inkN) return { ...it, skip: true };
      const bg = [sr / n, sg / n, sb / n];
      const region = bg[0] > 200 && bg[1] > 195 && bg[2] < 190 ? '노랑' : bg[0] - bg[1] > 25 ? '코랄' : '민트';
      const tc = it.color.match(/[\d.]+/g).map(Number); const Lt = L(tc[0], tc[1], tc[2]);
      const near = (x, y, dmax) => { let dmin = 99; for (let dy = -dmax; dy <= dmax; dy++) for (let dx = -dmax; dx <= dmax; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= H || xx >= W) continue; if (ink[yy * W + xx]) dmin = Math.min(dmin, Math.max(Math.abs(dx), Math.abs(dy))); } return dmin; };
      const formal = [], edge = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (ink[y * W + x]) continue; const d = near(x, y, 3); if (d > 3) continue; const k = ((y + y0) * A.W + (x + x0)) * 4;
        formal.push(cr(Lt, L(B.d[k], B.d[k + 1], B.d[k + 2])));
        if (d === 1) edge.push(cr(Lt, L(S.d[k], S.d[k + 1], S.d[k + 2]))); }
      formal.sort((p, q) => p - q); edge.sort((p, q) => p - q);
      const q = (arr, f) => +(arr[Math.floor(arr.length * f)] ?? 0).toFixed(2);
      return { label: it.label, kind: it.kind, region, formalMin: q(formal, 0.1), edgeP10: q(edge, 0.1), edgeMed: q(edge, 0.5) };
    });
  }, { a: A.toString('base64'), b: B.toString('base64'), c: C.toString('base64'), s: S.toString('base64'), items, dpr });
  if (c.shot) writeFileSync(`${DIR}/${c.name}-${w}-${scn}.png`, C);
  await ctx.close();
  return res.filter((r) => !r.skip);
}
const CFGS = JSON.parse(process.argv[5]);
const SCN = (process.env.SCN || 'opening-selected,question,question-typed,question-bottom,error').split(',');
const WS = (process.env.WS || '360,390,430').split(',').map(Number);
const all = [];
for (const c of CFGS) {
  const rows = [];
  for (const w of WS) for (const scn of SCN) { const h = { 360: 780, 390: 844, 430: 932 }[w]; for (const r of await run(w, h, scn, c)) rows.push({ w, scn, ...r }); }
  all.push({ cfg: c, rows });
  const by = {}; for (const r of rows) { const k = r.region; (by[k] ??= []).push(r); }
  const fmt = (arr, key) => arr.length ? Math.min(...arr.map((r) => r[key])).toFixed(2) : '-';
  console.log(`\n[${c.name}] stroke=${c.stroke || '없음'} · shadow=${c.shadow || '없음'} · 글자 ${rows.length}개`);
  for (const k of ['민트', '노랑', '코랄']) { const a = by[k] ?? []; console.log(`  ${k.padEnd(3)} ${String(a.length).padStart(3)}개 · 표준 최저 ${fmt(a, 'formalMin')} · 테두리 기준 p10 최저 ${fmt(a, 'edgeP10')} · 중앙값 최저 ${fmt(a, 'edgeMed')} · 기준 미달(테두리 p10<4.5) ${a.filter((r) => r.edgeP10 < 4.5).length}`); }
}
writeFileSync(`${DIR}/stroke-${Date.now()}.json`, JSON.stringify(all, null, 1));
await browser.close(); srv.close();
