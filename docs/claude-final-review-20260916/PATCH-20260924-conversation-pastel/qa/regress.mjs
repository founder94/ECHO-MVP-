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

// ── 기능 회귀 클릭 검사(가짜 서버 기준) ──
function statefulMock(st) {
  return async (route) => {
    const req = route.request(); const url = req.url(); const m = req.method();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const one = req.headers()['accept']?.includes('vnd.pgrst.object');
    if (url.includes('/auth/v1/user')) { if (m === 'PUT') { st.calls.push('auth_update'); return json({ ...USER, user_metadata: { doit_round_started_at: new Date().toISOString() } }); } return json(USER); }
    if (url.includes('/rest/v1/purposes')) return json(PURPOSES);
    if (url.includes('/rest/v1/profiles')) {
      if (m === 'PATCH') { const b = JSON.parse(req.postData() || '{}'); st.calls.push(`profile_patch:${b.purpose_id ?? 'null'}`); if ('purpose_id' in b) { st.purpose = b.purpose_id; st.purposeLabel = b.purpose_label; } return json(one ? { id: UID } : [{ id: UID }]); }
      const row = { consent_version: 'v1.0', purpose_id: st.purpose, purpose_label: st.purposeLabel, nickname: null, bio: null, region: null, life_rhythm: null };
      return json(one ? row : [row]);
    }
    if (url.includes('/functions/v1/doit-understanding')) {
      const body = JSON.parse(req.postData() || '{}'); st.calls.push(`${body.action}${body.asAnswer ? '+asAnswer' : ''}${body.pendingCorrection ? '+pendingCorrection' : ''}${body.recordId && !body.text ? '+recordOnly' : ''}`);
      if (body.action === 'record_list') return json({ ok: true, records: st.records });
      if (body.action === 'insight_list') return json({ ok: true, insights: [] });
      if (body.action === 'followup_get') return json({ ok: true, question: st.question && body.recordId === st.question.sourceRecordId ? st.question : null });
      if (body.action === 'turn') {
        const next = st.script.shift() ?? 'answer';
        if (next === 'slow') await new Promise((r) => setTimeout(r, 2500));
        if (next === 'ask') return json({ ok: true, kind: 'ask', saved: false, record: null, question: null, reply: '어떤 사람을 소개할지 정하려고 물어봐요.' });
        if (next === 'correction') return json({ ok: true, kind: 'correction', saved: false, record: null, question: null, rejected: true, reply: '제가 잘못 알아들었어요. 어떤 뜻이었는지 한 줄만 알려 주세요.' });
        const r = rec(st.records.length + 1, body.text || '(다음 질문)'); if (body.text) st.records.unshift(r);
        const target = body.text ? r : st.records[0];
        if (next === 'error') return json({ ok: true, kind: 'answer', saved: !!body.text, record: body.text ? r : null, question: null, questionError: ERR });
        st.question = { text: `잘 알겠어요.\n다음 질문 ${st.calls.length}번이에요?`, sourceRecordId: target.id, topic: 'together' };
        return json({ ok: true, kind: 'answer', saved: !!body.text, record: body.text ? r : null, question: st.question });
      }
      return json({ ok: true });
    }
    if (url.includes('supabase.co')) return json({});
    return route.continue();
  };
}
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ' · ' + detail : ''}`); };
async function session(w, h, st) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800 });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); sessionStorage.setItem('doit:intro-seen', '1'); localStorage.setItem('doit:install-card', 'collapsed'); } catch {} }, [`sb-${REF}-auth-token`, JSON.stringify(SESSION)]);
  await ctx.route(/fonts\.googleapis|fonts\.gstatic|cdnjs|jsdelivr/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route(/supabase\.co|helloreaddy|readdy/, statefulMock(st));
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
}
const newState = (o = {}) => ({ purpose: null, purposeLabel: null, records: [], question: null, script: [], calls: [], ...o });
const seeded = () => { const r2 = rec(2, '보드게임 같은 거 같이 하면 좋겠어요'), r1 = rec(1, '그냥 편한친구 부담없이'); return { purpose: 'friend', purposeLabel: '편한 친구를 만나고 싶어요', records: [r2, r1], question: { text: Q1, sourceRecordId: r2.id, topic: 'pace' } }; };

for (const [w, h] of [[360, 780], [390, 844], [430, 932]]) {
  // 1) 목적 카드 선택 · 선택 바꾸기 · 다음 진행
  { const st = newState(); const { ctx, page, errors } = await session(w, h, st);
    await page.goto(`${BASE}/doit/conversation`); await page.waitForSelector('.echo-opening-tile');
    const tiles = page.locator('.echo-opening-tile');
    await tiles.nth(0).click(); const a = await tiles.nth(0).getAttribute('aria-checked');
    await tiles.nth(2).click(); const b0 = await tiles.nth(0).getAttribute('aria-checked'), b2 = await tiles.nth(2).getAttribute('aria-checked');
    const glass = await tiles.nth(2).evaluate((el) => { const s = getComputedStyle(el); return s.backgroundColor + ' ' + (s.backdropFilter || s.webkitBackdropFilter); });
    await page.fill('#echo-opening-line', '천천히 알아가고 싶어요'); await page.click('.echo-opening-line button[type=submit]');
    await page.waitForFunction(() => /다섯 가지만|잘 들었어요|다음 질문/.test(document.body.innerText) && !document.querySelector('.echo-opening-tile'), null, { timeout: 8000 }).catch(() => {});
    const txt = await page.locator('body').innerText();
    check(`${w} 카드 선택`, a === 'true', `aria-checked=${a}`);
    check(`${w} 선택 바꾸기`, b0 === 'false' && b2 === 'true', `첫 카드 ${b0} · 셋째 ${b2} · ${glass}`);
    check(`${w} 다음 진행(목적 저장 → 대화)`, st.calls.includes('profile_patch:hobby') && /다섯 가지만|잘 들었어요|다음 질문/.test(txt), st.calls.filter((c) => !/list|followup_get/.test(c)).join(','));
    check(`${w} 오류 0(목적)`, errors.length === 0, errors.join('|')); await ctx.close(); }
  // 2) 답 입력 · 전송 · 로딩 · 다음 질문
  { const st = newState({ ...seeded(), script: ['slow'] }); const { ctx, page, errors } = await session(w, h, st);
    await page.goto(`${BASE}/doit/conversation`); await page.waitForSelector('#echo-message');
    await page.fill('#echo-message', '조용한 카페'); await page.click('.echo-composer-footer button');
    await page.waitForTimeout(600); const loading = await page.locator('.echo-thinking').isVisible().catch(() => false);
    await page.waitForFunction(() => [...document.querySelectorAll('.echo-question')].some((e) => /다음 질문 \d+번이에요/.test(e.textContent)), null, { timeout: 8000 }).catch(() => {});
    const q = (await page.locator('.echo-question').allInnerTexts()).join(' | ');
    check(`${w} 입력·전송·로딩 보임`, loading, `loading=${loading}`);
    check(`${w} 다음 질문 표시`, /다음 질문 \d+번이에요/.test(q), q);
    check(`${w} 오류 0(전송)`, errors.length === 0, errors.join('|')); await ctx.close(); }
  // 3) 오류 → 「다음 질문 받기」(다시 받기)
  { const st = newState({ ...seeded(), script: ['error', 'answer'] }); const { ctx, page, errors } = await session(w, h, st);
    await page.goto(`${BASE}/doit/conversation`); await page.waitForSelector('#echo-message');
    await page.fill('#echo-message', '조용한 카페'); await page.click('.echo-composer-footer button');
    await page.waitForSelector('.echo-error'); const err = await page.locator('.echo-error').innerText();
    await page.click('.echo-next .echo-secondary'); await page.waitForSelector('.echo-next .echo-question-card', { timeout: 8000 }).catch(() => {});
    const q = await page.locator('.echo-next .echo-question').innerText().catch(() => '');
    check(`${w} 오류 문장 그대로`, err.includes('다음 질문을 아직 만들지 못했어요'), err.slice(0, 40));
    check(`${w} 다음 질문 받기(재시도)`, /다음 질문 \d+번이에요/.test(q) && st.calls.includes('turn+recordOnly'), q);
    check(`${w} 오류 0(재시도)`, errors.length === 0, errors.join('|')); await ctx.close(); }
  // 4) 되묻기 → 「이 말은 답으로 남길게요」 · 정정/거절
  { const st = newState({ ...seeded(), script: ['ask', 'answer', 'correction', 'answer'] }); const { ctx, page, errors } = await session(w, h, st);
    await page.goto(`${BASE}/doit/conversation`); await page.waitForSelector('#echo-message');
    await page.fill('#echo-message', '왜 이런 걸 물어봐?'); await page.click('.echo-composer-footer button');
    await page.waitForSelector('.echo-unsaved'); await page.click('.echo-unsaved .echo-text-button');
    await page.waitForTimeout(1200);
    check(`${w} 이 말은 답으로 남길게요`, st.calls.includes('turn+asAnswer'), st.calls.filter((c) => c.startsWith('turn')).join(','));
    await page.fill('#echo-message', '그게 아니에요'); await page.click('.echo-composer-footer button'); await page.waitForTimeout(1000);
    const body = await page.locator('body').innerText();
    check(`${w} 정정·거절 안내 표시`, body.includes('어떤 뜻이었는지 한 줄만'), '');
    await page.fill('#echo-message', '천천히 친해지는 사이요'); await page.click('.echo-composer-footer button'); await page.waitForTimeout(1200);
    check(`${w} 정정 뒤 다음 답에 정정 표시 전달`, st.calls.includes('turn+pendingCorrection'), st.calls.filter((c) => c.startsWith('turn')).join(','));
    check(`${w} 오류 0(정정)`, errors.length === 0, errors.join('|')); await ctx.close(); }
  // 5) 처음부터 시작하기 → 확인 → 첫 질문
  { const st = newState({ ...seeded() }); const { ctx, page, errors } = await session(w, h, st);
    await page.goto(`${BASE}/doit/conversation`); await page.waitForSelector('.echo-restart-top .echo-restart-pill');
    await page.click('.echo-restart-top .echo-restart-pill'); await page.waitForSelector('.echo-restart');
    await page.locator('.echo-restart .echo-reactions button', { hasText: '처음부터 시작할게요' }).click();
    await page.waitForSelector('.echo-opening-tile', { timeout: 8000 }).catch(() => {});
    check(`${w} 처음부터 시작하기`, st.calls.includes('auth_update') && st.calls.includes('profile_patch:null') && await page.locator('.echo-opening-tile').count() === 4, st.calls.filter((c) => /auth|patch/.test(c)).join(','));
    check(`${w} 오류 0(처음부터)`, errors.length === 0, errors.join('|')); await ctx.close(); }
  // 6) 뒤로 · 키보드(화면 높이 줄임) · 가로 넘침
  { const st = newState({ ...seeded() }); const { ctx, page, errors } = await session(w, h, st);
    await page.goto(`${BASE}/doit/home`); await page.waitForTimeout(1500); await page.goto(`${BASE}/doit/conversation`); await page.waitForSelector('#echo-message');
    await page.setViewportSize({ width: w, height: 420 }); await page.focus('#echo-message'); await page.keyboard.type('카'); await page.waitForTimeout(400);
    const vis = await page.evaluate(() => { const t = document.querySelector('#echo-message').getBoundingClientRect(); return t.top >= 0 && t.top < innerHeight; });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(`${w} 키보드 흉내(높이 420): 입력칸 보임`, vis); check(`${w} 가로 넘침 0`, !overflow);
    // 앱 안에서 이동한 뒤(머리말 「내가 맞다고 한 말」) 「뒤로」 → 대화로 돌아와야 한다. (주소를 직접 열면 기록이 없어 시작 화면으로 가는 것이 원래 설계)
    await page.setViewportSize({ width: w, height: h }); await page.evaluate(() => window.scrollTo(0, 0));
    await page.goto(`${BASE}/doit/home`); await page.waitForTimeout(1500);
    const link = page.locator('a[href^="/doit/conversation"]').first(); const hasLink = await link.count();
    if (hasLink) { await link.click(); await page.waitForSelector('.echo-dialogue', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800); }
    const back = page.locator('button', { hasText: '뒤로' }).first();
    if (await back.count()) { await back.click(); await page.waitForTimeout(1200); check(`${w} 뒤로(홈 → 대화 → 뒤로)`, !!hasLink && page.url().endsWith('/doit/home'), page.url()); } else check(`${w} 뒤로`, false, '뒤로 버튼 없음');
    check(`${w} 오류 0(뒤로)`, errors.length === 0, errors.join('|')); await ctx.close(); }
}
writeFileSync(`${DIR}/regression.json`, JSON.stringify(results, null, 1));
console.log(`합계 ${results.filter((r) => r.ok).length}/${results.length}`);
await browser.close(); srv.close();
