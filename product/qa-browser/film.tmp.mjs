// ECHO UX 흐름 브라우저 검사(2026-09-30 대표 「CLAUDE CODE FINAL MASTER」 §30).
// 대상: 이번 변경으로 만든 앱 빌드(ux-build) · 로컬 서버. 서버(Supabase) 응답은 실제 계약(doit-connect v2.0 코드)의 모양 그대로 이 검사 안에서만 대신 준다.
// 제품 코드에는 가짜 후보가 없다. 실제 QA 서버를 관통하는 검사는 qa-real/qa-match-e2e.mjs(서버 담당)가 따로 한다.
// 실행: 앱 빌드(VITE_SITE_ROLE=app …) 뒤 UX_BUILD=<빌드 폴더> PW_MODULE=<playwright 경로> [CHROMIUM=<실행 파일>] node qa-browser/ux-flow.mjs
// 저장소에는 playwright 의존성을 넣지 않는다(검사 도구). 결과 그림은 uxshots/ 에 남는다.
const { chromium } = await import(process.env.PW_MODULE ?? 'playwright');
import http from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import path from 'node:path';

const ROOT = process.env.UX_BUILD ?? 'dist/app', PORT = Number(process.env.UX_PORT ?? 4180), BASE = `http://localhost:${PORT}`;
const SB = 'https://mutniujeiyujhkobadkd.supabase.co';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); let f = path.join(ROOT, p); if (!existsSync(f) || statSync(f).isDirectory()) f = path.join(ROOT, 'index.html'); r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f)); }).listen(PORT);
mkdirSync('uxshots', { recursive: true });

const UID = '11111111-2222-4333-8444-555555555555';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const EXP = Math.floor(Date.now() / 1000) + 3600 * 24;
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: EXP, aud: 'authenticated' })}.sig`;
// 2026-10-02 PR #101: 영상 이용 동의는 별도 칸 — 미리보기 빌드(VITE_VIDEO_CONSENT_VERSION=video-v1)에서 기본 시험 사용자는 동의한 상태, 동의 화면 검사는 st.userMeta 로 따로.
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'qa-ux@do-it.company', app_metadata: { provider: 'email' }, user_metadata: { doit_connect_consent_version: 'connect-v1', doit_video_consent_version: 'video-v1', doit_video_consent_at: '2026-10-02T00:00:00Z' }, created_at: '2026-09-01T00:00:00Z' };
const SESSION = { access_token: JWT, token_type: 'bearer', expires_in: 86400, expires_at: EXP, refresh_token: 'r', user: USER };
const PREVIEW = { purpose: '깊은 대화부터 시작하고 싶어요', readiness: { answers: 5, answers_needed: 5, turns: 5, uninformative: 0, confirmed: 4, photos: 3, photos_needed: 3, intro: true, phone_verified: false }, eligible: true, waiting: 3, candidates: 1, common: [], note: '' };
const cand = (id, extra = {}) => ({ id, created_at: '2026-09-30T00:00:00Z', purpose: '깊은 대화부터 시작하고 싶어요', reasons: ['두 분 모두 「깊은 대화부터 시작하고 싶어요」 만남을 원한다고 직접 골랐어요.', '내가 직접 한 말 「천천히 알아가고 싶어요」 — 상대도 비슷한 이야기를 직접 했어요.'], my_choice: null, waiting: false, ...extra });
const MID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const match = (extra = {}) => ({ id: MID, status: 'open', created_at: '2026-09-30T00:00:00Z', first_question: '요즘 가장 편하게 쉬는 시간은 언제예요?', my_answer: null, partner_answered: false, revealed: false, outcome: null, ...extra });
const QA_PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd8e6"/><stop offset="1" stop-color="#f1c9a8"/></linearGradient></defs><rect width="480" height="600" fill="url(#g)"/><text x="240" y="300" font-size="22" text-anchor="middle" fill="#2c4a4a">QA 시험 그림 · 사람 아님</text></svg>';
const PHOTO_URL = `${SB}/storage/v1/object/sign/profile-photos/bbbbbbbb/1/qa.jpg?token=qa`;
const PARTNER = { nickname: '하늘', bio: '천천히 알아가는 걸 좋아해요.', purpose: '깊은 대화부터 시작하고 싶어요', answer: '저녁에 산책할 때요.', photo_url: null };

// 시나리오별 서버 상태(계약 모양 그대로). calls 에 요청 본문을 남겨 화면이 무엇을 보냈는지 본다.
function makeServer(init) {
  const st = { candidates: [], matches: [], consented: true, delay: 0, fail: {}, calls: [], ...init };
  const connect = (body) => {
    st.calls.push(body);
    const f = st.fail[body.action]; if (f && f.times > 0) { f.times--; return { status: f.status ?? 500, json: { ok: false, code: f.code ?? 'ERROR', message: f.message ?? '서버 오류' } }; }
    switch (body.action) {
      case 'my_candidates': return { json: { ok: true, eligible: st.eligible ?? true, missing: st.missing ?? [], ...(st.readiness ? { readiness: st.readiness } : {}), prepared: 0, candidates: st.candidates } };
      case 'my_turns': return { json: { ok: true, open: st.matches.length, turns: { answer: 0, reply: 0, opened: 0, choose: st.candidates.filter(c => !c.waiting).length } } };
      case 'choose': {
        const c = st.candidates.find(x => x.id === body.candidateId);
        // 2026-10-01 SAFETY: 서버 v2.1 은 차단·신고를 실제로 저장했을 때만 blocked/reported 를 준다(st.oldServer 면 예전처럼 안 줌).
        if (body.choice !== 'yes') { st.candidates = st.candidates.filter(x => x.id !== body.candidateId); return { json: { ok: true, status: 'declined', ...(st.oldServer ? {} : { blocked: body.block === true, reported: typeof body.reason === 'string' }) } }; }
        if (st.partnerYes?.includes(body.candidateId)) { st.candidates = st.candidates.filter(x => x.id !== body.candidateId); st.matches = [match({ via_mutual: true })]; return { json: { ok: true, status: 'mutual', match_id: MID, first_question: match().first_question, question_source: 'fixed' } }; }
        Object.assign(c, { my_choice: 'yes', waiting: true }); return { json: { ok: true, status: 'waiting' } };
      }
      case 'my_matches': return { json: { ok: true, matches: st.matches, consented: st.consented } };
      case 'answer': { const m = st.matches[0]; m.my_answer = body.text; if (st.partnerAnswered) { m.partner_answered = true; m.revealed = true; m.partner = PARTNER; m.messages = []; } return { json: { ok: true } }; }
      case 'message': { const m = st.matches[0]; m.messages = [...(m.messages ?? []), { id: String(Date.now()), mine: true, body: body.text, created_at: new Date().toISOString() }]; return { json: { ok: true } }; }
      case 'leave': { st.matches[0].status = 'closed'; return { json: { ok: true, ...(st.oldServer ? {} : { blocked: body.block === true, reported: typeof body.reason === 'string' || body.report === true }) } }; }
      case 'outcome': return { json: { ok: true } };
      // 2026-10-02 PR #99 마지막 구간: 기본은 지금 실서버와 같은 꺼짐(503). st.meet 가 있으면 그 상태를 계약 모양 그대로(sessionId 는 B 계약 반영 뒤 모양).
      case 'meet_status': return st.meet ? { json: { ok: true, ...st.meet } } : { status: 503, json: { ok: false, code: 'MEET_NOT_CONFIGURED' } };
      case 'meet_check': st.meet = { ...st.meet, state: 'need_my_intent', allowed: false }; return { json: { ok: true, ...st.meet, replayed: false } };
      case 'meet_intent': st.meet = { ...st.meet, state: body.intent === 'yes' ? 'waiting_partner' : 'need_my_intent', allowed: false }; return { json: { ok: true, ...st.meet, replayed: false } };
      default: return { json: { ok: true } };
    }
  };
  return { st, connect };
}

async function newPage(browser, vp, server) {
  // UX_VIDEO=<폴더>: 장면을 영상으로도 남긴다(대표 보고용 녹화 · 검사 판정과 무관).
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2, ...(process.env.UX_VIDEO ? { recordVideo: { dir: process.env.UX_VIDEO, size: vp } } : {}) });
  const user = { ...USER, user_metadata: { ...(server.st.userMeta ?? USER.user_metadata) } };
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, ['sb-mutniujeiyujhkobadkd-auth-token', JSON.stringify({ ...SESSION, user })]);
  // UX_OFFLINE=1: 바깥 인터넷이 막힌 검사 환경 — 바깥 글꼴·아이콘 요청을 바로 끊는다(기다리다 networkidle 시간 초과 방지 · 화면 동작 영향 0).
  if (process.env.UX_OFFLINE === '1') await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|mutniujeiyujhkobadkd\.supabase\.co)/, (route) => route.abort());
  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request(); const u = new URL(req.url());
    // 2026-10-01 프로필 FRAME: 서명된 사진 주소(서버가 공개 뒤에만 주는 것)를 이 검사 안에서만 대신 준다 — 사람 사진이 아닌 무늬 그림(가짜 사람 0).
    if (u.pathname.startsWith('/storage/v1/')) {
      server.st.storage = (server.st.storage ?? 0) + 1;
      if (server.st.photoDelay) await new Promise(r => setTimeout(r, server.st.photoDelay));
      if (server.st.photoFail) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: QA_PHOTO });
    }
    if (u.pathname.startsWith('/auth/v1/user')) {
      // updateUser(PUT) = 받은 data 를 그대로 합친다(값이 null 이면 지움) · 보낸 본문은 calls 에 남겨 무엇을 바꿨는지 본다.
      if (req.method() === 'PUT') { const b = JSON.parse(req.postData() ?? '{}'); server.st.calls.push({ fn: 'auth_update', data: b.data }); for (const [k, v] of Object.entries(b.data ?? {})) { if (v === null) delete user.user_metadata[k]; else user.user_metadata[k] = v; } }
      return route.fulfill({ json: user });
    }
    if (u.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: SESSION });
    if (u.pathname.startsWith('/rest/v1/profiles') && req.method() === 'GET') {
      const one = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      const row = { consent_version: 'v1.0', purpose_id: 'conversation', purpose_label: '깊은 대화부터 시작하고 싶어요', nickname: '나' };
      return route.fulfill({ json: one ? row : [row] });
    }
    if (u.pathname.startsWith('/rest/v1/')) return route.fulfill({ status: req.method() === 'GET' ? 200 : 201, json: [] });
    if (u.pathname === '/functions/v1/doit-understanding') return route.fulfill({ json: { ok: true, ...PREVIEW } });
    if (u.pathname === '/functions/v1/doit-agent') {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
      const body = JSON.parse(req.postData() ?? '{}'); server.st.calls.push({ fn: 'agent', ...body });
      const A = server.st.agent;
      if (!A) return route.fulfill({ json: { ok: true, session: null } });
      if (body.action === 'agent_get') return route.fulfill({ json: { ok: true, session: A.session } });
      if (body.action === 'agent_turn') {
        const msgs = A.session.messages.slice();
        if (body.correction) { msgs.splice(msgs.map(m => m.role).lastIndexOf('user'), 1, { role: 'user', text: body.text }); msgs.splice(msgs.length - 1, 1, { role: 'ai', text: A.recomputed }); }
        A.session = { ...A.session, messages: msgs, current_question: body.correction ? A.recomputed : A.session.current_question };
        return route.fulfill({ json: { ok: true, session: A.session, turn: { kind: body.correction ? 'correction' : 'answer', reply: '', question: A.session.current_question, saved: true, finish: false, after: false } } });
      }
      // 2026-10-01 구조대: 「잘 모르겠어요」 = agent_rescue(서버가 보기를 정해 돌려줌 · 이 검사 안에서는 init.agent.onRescue 모양 그대로)
      if (body.action === 'agent_rescue' && A.onRescue) A.session = { ...A.session, current_rescue: A.onRescue };
      return route.fulfill({ json: { ok: true, session: A.session } });
    }
    if (u.pathname === '/functions/v1/doit-connect') {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
      const body = JSON.parse(req.postData() ?? '{}');
      if (server.st.delay) await new Promise(r => setTimeout(r, server.st.delay));
      const out = server.connect(body);
      return route.fulfill({ status: out.status ?? 200, json: out.json });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  return { ctx, page, errors };
}

const results = [];
const record = (n, name, ok, detail = '') => { results.push({ n, name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${String(n).padStart(2)} ${name}${detail ? ' · ' + detail : ''}`); };
const text = async (page) => (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ');
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const FORBIDDEN_NEAR = /\d+(\.\d+)?\s?(m|km)\b|현재 위치|지도(에서|로| 핀|를)|생활권|가까운 곳에 있어요/;

const IPHONE = { width: 390, height: 844 }, W360 = { width: 360, height: 780 }, FLIP = { width: 360, height: 880 };
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const go = async (page) => { await page.goto(`${BASE}/doit/connections`, { waitUntil: 'networkidle' }); await page.waitForTimeout(600); };

async function run(n, name, vp, init, fn) {
  if (process.env.UX_ONLY && !process.env.UX_ONLY.split(",").includes(String(n))) return;
  const server = makeServer(init);
  const { ctx, page, errors } = await newPage(browser, vp, server);
  try { const detail = await fn(page, server); record(n, name, errors.length === 0, [detail, errors.length ? `JS오류 ${errors[0]}` : ''].filter(Boolean).join(' · ')); }
  catch (e) { record(n, name, false, String(e).split('\n')[0].slice(0, 200)); await page.screenshot({ path: `uxshots/fail-${n}.png` }).catch(() => {}); }
  finally { await ctx.close(); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const AGENT_SESSION = { id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', tone: 'polite', mode: 'TEXT', phase: 'talk', progress: { asked: 2, of: 5 }, current_question: '일주일에 몇 번쯤 보면 편해요?', current_hint: null, current_choices: null, messages: [{ role: 'ai', text: '어떤 친구를 만나고 싶어요?' }, { role: 'user', text: '일주일에 세 번 만나는 친구요' }, { role: 'ai', text: '일주일에 몇 번쯤 보면 편해요?' }], summary: [], closing: null, profile: null, handoff: null, goal: 'conversation', goal_label: '깊은 대화부터 시작하고 싶어요' };
const GUIDE_DONE = { ...AGENT_SESSION, phase: 'done', current_question: null, progress: { asked: 5, of: 5 }, closing: '이야기 고마워요.', summary: [],
  profile: Object.fromEntries([['relationship_intent', '천천히 알아가는 만남'], ['attraction_comfort', '이야기를 잘 들어 주는 사람'], ['values_character', '약속을 잘 지키는 편'], ['relationship_style', '전시 보고 천천히 걷기'], ['boundaries', '처음엔 낮에 만나기']].map(([k, v]) => [k, { status: 'CONFIRMED', items: [{ note: v, quote: v }] }]).concat([['mbti', { value: null, status: 'UNKNOWN' }], ['blood_type', { value: null, status: 'UNKNOWN' }], ['core_questions', 5], ['user_corrections', []]])) };

const OUT = process.env.FILM_OUT;
const Q = '요즘 어떤 시간이 가장 편해요?';
const TYPE = '주말에 전시 보고 천천히 걷는 시간이요';
const FIRST = { ...AGENT_SESSION, progress: { asked: 0, of: 5 }, current_question: Q, messages: [{ role: 'ai', text: Q }] };
const seen = async (p) => p.addInitScript(() => { for (const k of ['talk', 'check', 'choice']) try { localStorage.setItem(`echo:guide-hint-seen:${k}`, '1'); } catch {} });
await run(801, 'film: typing', IPHONE, { agent: { session: FIRST } }, async (p) => {
  await seen(p);
  await p.goto(`${BASE}/doit/conversation`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const box = p.locator('.echo-composer textarea, .echo-composer input').first();
  await box.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: `${OUT}/type-00.png` });
  await box.focus();
  for (let i = 1; i <= TYPE.length; i++) { await box.fill(TYPE.slice(0, i)); await p.evaluate(() => window.scrollTo(0, Math.max(0, document.querySelector('.echo-composer').getBoundingClientRect().bottom + scrollY - innerHeight + 24))); await p.screenshot({ path: `${OUT}/type-${String(i).padStart(2, '0')}.png` }); }
  return String(TYPE.length);
});
await run(802, 'film: check', IPHONE, { agent: { session: GUIDE_DONE } }, async (p) => {
  await seen(p);
  await p.goto(`${BASE}/doit/conversation`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const title = p.getByText('이렇게 이해했는데, 맞나요?').first(); await title.scrollIntoViewIfNeeded();
  await p.evaluate(() => { const el = [...document.querySelectorAll('p')].find(e => e.textContent.trim() === '이렇게 이해했는데, 맞나요?'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120); });
  await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/check-0.png` });
  const btn = p.getByRole('button', { name: '조금 달라요' }).first();
  await btn.hover(); await p.screenshot({ path: `${OUT}/check-1.png` });
  await btn.click(); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/check-2.png` });
  return 'ok';
});
const pass = results.filter(r => r.ok).length;
console.log(`\nTOTAL ${results.length} · PASS ${pass} · FAIL ${results.length - pass}`);
await browser.close(); srv.close();
