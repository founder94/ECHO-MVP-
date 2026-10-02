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
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const user = { ...USER, user_metadata: { ...(server.st.userMeta ?? USER.user_metadata) } };
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, ['sb-mutniujeiyujhkobadkd-auth-token', JSON.stringify({ ...SESSION, user })]);
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
  const server = makeServer(init);
  const { ctx, page, errors } = await newPage(browser, vp, server);
  try { const detail = await fn(page, server); record(n, name, errors.length === 0, [detail, errors.length ? `JS오류 ${errors[0]}` : ''].filter(Boolean).join(' · ')); }
  catch (e) { record(n, name, false, String(e).split('\n')[0].slice(0, 200)); await page.screenshot({ path: `uxshots/fail-${n}.png` }).catch(() => {}); }
  finally { await ctx.close(); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

await run(1, 'candidate 0', IPHONE, { candidates: [] }, async (p) => {
  await go(p); const t = await text(p);
  expect(t.includes('아직 보여 드릴 사람은 없어요.'), '빈 상태 문구 없음'); expect(!/곧 나타|기다리고 있어요/.test(t), '과장 문구');
  await p.screenshot({ path: 'uxshots/01-empty.png' }); return '빈 상태 문구';
});
await run(2, 'candidate 1 (단계 공개)', IPHONE, { candidates: [cand('c1')] }, async (p) => {
  await go(p); let t = await text(p);
  expect(t.includes('ECHO가 한 사람을 발견했어요.'), '첫 문장'); expect(!t.includes('내가 직접 한 말'), '열기 전 이유 노출');
  expect(await p.getByRole('button', { name: '이어지고 싶어요' }).count() === 0, '열기 전 선택 버튼');
  await p.screenshot({ path: 'uxshots/02a-closed.png' });
  await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); t = await text(p);
  expect(t.includes('내가 직접 한 말'), '이유 표시'); expect(await p.getByRole('button', { name: /이어지고 싶어요/ }).count() === 1, '선택 버튼');
  await p.screenshot({ path: 'uxshots/02b-open.png' }); return '닫힘 → 이유 → 선택';
});
await run(3, 'candidate 3', IPHONE, { candidates: [cand('c1'), cand('c2'), cand('c3')] }, async (p) => {
  await go(p); const t = await text(p);
  expect(t.includes('ECHO가 3명을 발견했어요.'), '수'); expect((await p.locator('.doit-candidate').count()) === 3, '카드 3');
  return '카드 3 · 모두 닫힘';
});
await run(4, 'nearby 있음(서버가 모르는 거리 필드를 보내도 화면이 만들지 않음)', IPHONE, { candidates: [cand('c1', { distance_band: 'same_area', distance_m: 486 })] }, async (p) => {
  await go(p); await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); const t = await text(p);
  expect(!FORBIDDEN_NEAR.test(t), `거리 표시됨: ${t.match(FORBIDDEN_NEAR)?.[0]}`); return '거리 표시 0(서버 계약 미확정 · 확인 불가)';
});
await run(5, 'nearby 없음', IPHONE, { candidates: [cand('c1')] }, async (p) => { await go(p); expect(!FORBIDDEN_NEAR.test(await text(p)), '거리 문구'); return '거리 문구 0'; });
await run(6, 'YES → 대기', IPHONE, { candidates: [cand('c1')] }, async (p, s) => {
  await go(p); await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); await p.getByRole('button', { name: /이어지고 싶어요/ }).click(); await p.waitForTimeout(500);
  const t = await text(p); expect(t.includes('내 선택은 전해졌어요'), '대기 문구'); expect(!/상대도 (당신이 )?궁금|상대도 관심/.test(t), '상대 관심 추측');
  expect(s.st.calls.some(c => c.action === 'choose' && c.choice === 'yes'), 'choose yes 요청');
  await p.screenshot({ path: 'uxshots/06-waiting.png' }); return 'choose=yes 전송 · 대기 표시';
});
await run(7, 'NO', IPHONE, { candidates: [cand('c1')] }, async (p, s) => {
  await go(p); await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); await p.getByRole('button', { name: '이번에는 넘길게요' }).click(); await p.waitForTimeout(500);
  expect((await text(p)).includes('넘겼어요'), '넘김 문구'); expect(s.st.calls.some(c => c.choice === 'no'), 'no 요청'); return 'choose=no';
});
await run(8, 'HIDE', IPHONE, { candidates: [cand('c1')] }, async (p, s) => {
  await go(p); await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); await p.getByRole('button', { name: '숨기기' }).click(); await p.waitForTimeout(500);
  expect((await text(p)).includes('숨겼어요'), '숨김 문구'); expect(s.st.calls.some(c => c.choice === 'hide'), 'hide 요청'); return 'choose=hide';
});
await run(9, '선택 후 대기(다시 열어도 유지)', IPHONE, { candidates: [cand('c1', { my_choice: 'yes', waiting: true })] }, async (p) => {
  await go(p); const t = await text(p); expect(t.includes('내 선택은 전해졌어요.'), '대기 제목'); expect(t.includes('내가 직접 한 말'), '고른 후보는 열린 채'); return '서버 waiting 그대로';
});
await run(10, 'mutual (서버가 mutual 이라고 답할 때만)', IPHONE, { candidates: [cand('c1')], partnerYes: ['c1'] }, async (p) => {
  await go(p); await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); await p.getByRole('button', { name: /이어지고 싶어요/ }).click(); await p.waitForTimeout(600);
  const t = await text(p); expect(t.includes('텔레파시가 통했어요.') && t.includes('서로 같은 선택을 했어요.'), 'ZZARIT 문구'); expect(!/하늘|축하/.test(t), '상대 정보·과한 축하');
  await p.waitForTimeout(900); await p.screenshot({ path: 'uxshots/10-mutual.png' }); return 'ZZARIT · 상대 정보 0';
});
await run(11, 'connection (서버 match_id 로 이동)', IPHONE, { candidates: [cand('c1')], partnerYes: ['c1'] }, async (p) => {
  await go(p); await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); await p.getByRole('button', { name: /이어지고 싶어요/ }).click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /첫 이야기 시작하기/ }).click(); await p.waitForTimeout(1200);
  const focused = await p.evaluate((id) => document.activeElement?.id === `match-${id}`, MID);
  expect(focused, '그 연결로 이동 안 됨'); return `#match-${MID.slice(0, 8)} 포커스`;
});
await run(12, 'first question', IPHONE, { matches: [match()] }, async (p) => {
  await go(p); const t = await text(p); expect(t.includes('ECHO가 하나만 물어볼게요.'), '안내'); expect(t.includes('요즘 가장 편하게 쉬는 시간은 언제예요?'), '서버 질문');
  await p.screenshot({ path: 'uxshots/12-first-question.png' }); return '안내 + 서버 질문';
});
await run(13, 'A answer (동의 → 답)', IPHONE, { matches: [match()], consented: false }, async (p, s) => {
  await go(p); await p.getByRole('button', { name: /확인했어요, 답할게요/ }).click(); await p.waitForTimeout(400);
  await p.locator(`#answer-${MID}`).fill('주말 아침에 커피 마실 때요.'); await p.getByRole('button', { name: /내 답 보내기/ }).click(); await p.waitForTimeout(600);
  const t = await text(p); expect(t.includes('상대의 답을 기다리고 있어요'), '대기'); expect(!t.includes('하늘'), '상대 정보 조기 노출');
  expect(s.st.calls.some(c => c.action === 'answer'), 'answer 요청'); return '답 전송 · 상대 정보 0';
});
await run(14, 'B answer 상태(상대만 답함)', IPHONE, { matches: [match({ partner_answered: true })] }, async (p) => {
  await go(p); const t = await text(p); expect(!t.includes('하늘') && !t.includes('저녁에 산책'), '내가 답하기 전 상대 노출'); return '상대가 답해도 내 답 전엔 비공개';
});
await run(15, 'profile reveal(둘 다 답한 뒤 서버 revealed)', IPHONE, { matches: [match({ my_answer: '주말 아침', partner_answered: true, revealed: true, partner: PARTNER, messages: [] })] }, async (p) => {
  await go(p); const t = await text(p); expect(t.includes('하늘') && t.includes('저녁에 산책할 때요.'), '공개'); await p.screenshot({ path: 'uxshots/15-reveal.png' }); return '서버 revealed 뒤 공개';
});
await run(16, 'chat', IPHONE, { matches: [match({ my_answer: '주말 아침', partner_answered: true, revealed: true, partner: PARTNER, messages: [{ id: 'm1', mine: false, body: '안녕하세요!', created_at: '2026-09-30T01:00:00Z' }] })] }, async (p, s) => {
  await go(p); await p.locator(`#message-${MID}`).fill('반가워요'); await p.getByRole('button', { name: /^보내기/ }).click(); await p.waitForTimeout(700);
  const t = await text(p); expect(t.includes('반가워요') && t.includes('안녕하세요!'), '메시지 목록'); expect(s.st.calls.some(c => c.action === 'message'), 'message 요청');
  await p.screenshot({ path: 'uxshots/16-chat.png' }); return '보내기 → 목록';
});
for (const [n, name, btn, want] of [[17, 'leave', '그만할게요', { block: false, report: false }], [18, 'block', '차단할게요', { block: true, report: false }], [19, 'report(사유 고르기 · 차단 기본 함께 · 2026-10-02)', '신고할게요', { block: true, report: true, reason: 'unpleasant' }]]) {
  await run(n, name, IPHONE, { matches: [match({ my_answer: 'a', partner_answered: true, revealed: true, partner: PARTNER, messages: [] })] }, async (p, s) => {
    await go(p); await p.getByRole('button', { name: '이 연결 그만하기' }).click(); await p.getByRole('button', { name: btn, exact: true }).click(); if (want.reason) await p.getByRole('button', { name: '불쾌한 대화' }).click(); await p.waitForTimeout(600);
    const call = s.st.calls.find(c => c.action === 'leave'); expect(call && call.block === want.block && call.report === want.report && call.reason === want.reason, `보낸 값 ${JSON.stringify(call)}`);
    expect((await text(p)).includes('이 연결은 끝났어요'), '끝남 표시'); return `leave block=${want.block} report=${want.report}`;
  });
}
await run(20, 'error → 다시 확인하기', IPHONE, { candidates: [cand('c1')], fail: { my_candidates: { times: 1, status: 500 } } }, async (p) => {
  await go(p); let t = await text(p); expect(t.includes('불러오지 못했어요. 다시 확인해 볼게요.') && !t.includes('저장 결과'), '불러오기 오류 문구');
  await p.getByRole('button', { name: '다시 확인하기' }).click(); await p.waitForTimeout(600); t = await text(p);
  expect(t.includes('한 사람을 발견했어요'), '다시 불러오기 뒤 표시'); return '오류 → 재시도 성공';
});
await run(21, 'retry(보내기 실패 시 적은 말 유지)', IPHONE, { matches: [match({ my_answer: 'a', partner_answered: true, revealed: true, partner: PARTNER, messages: [] })], fail: { message: { times: 1, status: 500, message: '보내지 못했어요.' } } }, async (p) => {
  await go(p); const box = p.locator(`#message-${MID}`); await box.fill('두 번째 시도'); await p.getByRole('button', { name: /^보내기/ }).click(); await p.waitForTimeout(600);
  expect((await box.inputValue()) === '두 번째 시도', '실패 뒤 초안 사라짐'); await p.getByRole('button', { name: /^보내기/ }).click(); await p.waitForTimeout(600);
  expect((await text(p)).includes('두 번째 시도'), '재시도 성공'); return '실패 → 초안 유지 → 재시도';
});
await run(22, 'network slow(3초)', IPHONE, { candidates: [cand('c1')], delay: 3000 }, async (p) => {
  await p.goto(`${BASE}/doit/connections`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  const mid = await text(p); expect(mid.includes('ECHO가 천천히 살펴보고 있어요.'), '느릴 때 안내'); await p.waitForTimeout(4000);
  expect((await text(p)).includes('한 사람을 발견했어요'), '늦게 도착 표시'); return '로딩 문구 → 도착';
});
await run(23, 'reload', IPHONE, { candidates: [cand('c1')] }, async (p) => {
  await go(p); await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); await p.getByRole('button', { name: /이어지고 싶어요/ }).click(); await p.waitForTimeout(500);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600); expect((await text(p)).includes('내 선택은 전해졌어요.'), '새로고침 뒤 대기 유지'); return '서버 상태로 복원';
});
await run(24, 'browser back', IPHONE, { candidates: [cand('c1')] }, async (p) => {
  await p.goto(`${BASE}/doit/home`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.goto(`${BASE}/doit/connections`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.goBack(); await p.waitForTimeout(800); expect(new URL(p.url()).pathname === '/doit/home', `뒤로 → ${p.url()}`); return '연결 → 뒤로 → 홈';
});
for (const [n, name, vp] of [[25, '360px', W360], [26, 'Galaxy Flip viewport(360×880)', FLIP], [27, 'iPhone viewport(390×844)', IPHONE]]) {
  await run(n, name, vp, { candidates: [cand('c1')], matches: [match({ my_answer: 'a', partner_answered: true, revealed: true, partner: PARTNER, messages: [{ id: 'm1', mine: false, body: '안녕하세요!', created_at: '2026-09-30T01:00:00Z' }] })] }, async (p) => {
    await go(p); await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); await p.waitForTimeout(300);
    const ov = await overflow(p); expect(ov <= 0, `가로 넘침 ${ov}px`);
    const btn = await p.getByRole('button', { name: /이어지고 싶어요/ }).boundingBox(); expect(btn && btn.height >= 44, `누르는 칸 높이 ${btn?.height}`);
    await p.screenshot({ path: `uxshots/${n}-${vp.width}x${vp.height}.png`, fullPage: true }); return `가로 넘침 0 · 버튼 높이 ${Math.round(btn.height)}px`;
  });
}
// 28 PWA 첫 실행: 시작 주소(/do-it/intro?next=app) 첫 화면이 네이비 시작 그림인지(초록 0).
await run(28, 'PWA-style first launch', IPHONE, {}, async (p) => {
  await p.goto(`${BASE}/do-it/intro?next=app`, { waitUntil: 'commit' });
  await p.waitForFunction(() => document.getElementById('root')?.childElementCount > 0, null, { timeout: 20000 });
  const s = await p.evaluate(() => ({ cls: document.documentElement.className, bg: getComputedStyle(document.body).backgroundColor, after: getComputedStyle(document.body, '::after').backgroundImage.slice(0, 60) }));
  expect(s.cls.includes('echo-app-launch-root') && s.bg === 'rgb(4, 20, 51)' && s.after.includes('echo-launch-artwork'), JSON.stringify(s)); return '네이비 + E 시작 그림';
});
// 30 대화 중 폰 뒤로 = 직전 답 고치기(§19) · 고친 답은 정정으로 서버에 보내고, 다음 질문은 서버가 다시 정한 것을 쓴다.
const AGENT_SESSION = { id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', tone: 'polite', mode: 'TEXT', phase: 'talk', progress: { asked: 2, of: 5 }, current_question: '일주일에 몇 번쯤 보면 편해요?', current_hint: null, current_choices: null, messages: [{ role: 'ai', text: '어떤 친구를 만나고 싶어요?' }, { role: 'user', text: '일주일에 세 번 만나는 친구요' }, { role: 'ai', text: '일주일에 몇 번쯤 보면 편해요?' }], summary: [], closing: null, profile: null, handoff: null, goal: 'conversation', goal_label: '깊은 대화부터 시작하고 싶어요' };
await run(30, 'back guard: 폰 뒤로 → 직전 답 고치기 → 서버 재계산 질문', IPHONE, { agent: { session: AGENT_SESSION, recomputed: '한 달에 한두 번이면 주말이 편해요?' } }, async (p, s) => {
  await p.goto(`${BASE}/doit/conversation`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  await p.locator('.echo-question').filter({ hasText: '일주일에 몇 번쯤' }).first().waitFor({ timeout: 15000 });
  const before = p.url(); await p.goBack(); await p.waitForTimeout(800);
  expect(p.url() === before, `뒤로가 대화를 떠남 → ${p.url()}`);
  expect(await p.locator('.echo-notice').filter({ hasText: '직전 답으로 돌아왔어요' }).count() === 1, '직전 답 고치기 안내 없음');
  const box = p.locator('.echo-composer textarea, .echo-composer input').first();
  expect((await box.inputValue()) === '일주일에 세 번 만나는 친구요', `초안=${await box.inputValue()}`);
  await p.screenshot({ path: 'uxshots/30a-back-edit.png' });
  await box.fill('한 달에 한두 번 만나는 친구요'); await box.press('Enter').catch(() => {}); 
  if (!s.st.calls.some(c => c.action === 'agent_turn')) await p.locator('.echo-composer button[type=submit]').click();
  await p.waitForTimeout(1200);
  const turn = s.st.calls.find(c => c.action === 'agent_turn'); expect(turn && turn.correction, `정정으로 안 보냄 ${JSON.stringify(turn)?.slice(0, 120)}`);
  const q = await p.locator('.echo-question').first().innerText(); expect(q.includes('한 달에 한두 번이면 주말이 편해요?'), `새 질문=${q}`);
  await p.screenshot({ path: 'uxshots/30b-recomputed.png' }); return '뒤로 → 직전 답 편집 → correction 전송 → 서버 새 질문';
});
// 31·32 via_mutual(2026-10-01): 먼저 고른 사람도 서버가 via_mutual=true 를 줄 때만 「상대도 당신이 궁금했대요」.
await run(31, 'via_mutual=true: 먼저 고른 사람도 ZZARIT 한 번 → 서로 골랐다는 문구', IPHONE, { matches: [match({ via_mutual: true })] }, async (p) => {
  await go(p); expect((await text(p)).includes('텔레파시가 통했어요.'), '기다리던 사람 ZZARIT 없음');
  await p.getByRole('button', { name: /첫 이야기 시작하기/ }).click(); await p.waitForTimeout(300); const t = await text(p);
  expect(t.includes('상대도 당신이 궁금했대요.'), 'via_mutual 문구 없음'); expect(t.includes('ECHO가 하나만 물어볼게요.'), '첫 질문 안내');
  await p.screenshot({ path: 'uxshots/31-via-mutual.png' }); return '서버 via_mutual=true → 문구 1';
});
await run(32, 'via_mutual 없음/false: 관리자 연결·예전 서버는 문구 0', IPHONE, { matches: [match(), match({ id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeef', via_mutual: false })] }, async (p) => {
  await go(p); const t = await text(p);
  expect(!t.includes('상대도 당신이 궁금했대요'), '근거 없이 문구 표시'); return '문구 0';
});
// 33·34 FI-018(2026-10-01): 연결 준비 칸은 연결 서버 readiness 그대로(Agent 공통 계약) — 옛 「다섯 가지 질문 n/5」 숫자 0 · 서버가 사진만 부족하다고 하면 사진이 다음 할 일.
const SR = (o = {}) => ({ conversation: { ready: true, source: 'agent', finished: true, have: 3, need: 3 }, purpose: true, intro: true, photos: 3, photos_needed: 3, phone_verified: false, ...o });
await run(33, 'FI-018 서버 readiness: 대화 마침 + 사진 부족 → 다음 할 일 = 사진 · 다섯 가지 질문 0', IPHONE, { eligible: false, missing: ['photos'], readiness: SR({ photos: 2 }) }, async (p) => {
  await go(p); await p.waitForTimeout(400); const t = await text(p);
  expect(t.includes('ECHO와 대화') && t.includes('마침'), '대화 칸 = 서버 conversation.ready'); expect(!t.includes('다섯 가지 질문'), '옛 답 수 칸이 남음');
  expect(t.includes('필수 사진 세 장을 채워요'), '다음 할 일이 사진이 아님'); expect(t.includes('2 / 3'), '사진 수 = 서버 값');
  await p.screenshot({ path: 'uxshots/33-server-readiness.png' }); return '대화 마침 · 사진 2/3 · 다음 할 일 사진';
});
await run(34, 'FI-018 서버 readiness: 대화 준비 미완료 → 다음 할 일 = 대화 이어가기(숫자 대신 「조금 더」)', IPHONE, { eligible: false, missing: ['answers'], readiness: SR({ conversation: { ready: false, source: 'agent', finished: true, have: 2, need: 3 } }) }, async (p) => {
  await go(p); await p.waitForTimeout(400); const t = await text(p);
  expect(t.includes('ECHO와 대화를 조금 더 해요'), '다음 할 일이 대화가 아님'); expect(t.includes('조금 더'), '대화 칸 상태'); expect(!/\d+ \/ 5/.test(t), '옛 n/5');
  return '대화 칸 미완료 · 대화 이어가기';
});
// 2026-10-01 UI/UX FINAL CLOSE: 칸이 다 차도 서버가 목적 미선택(자격 없음)이면 「모두 마쳤어요」 0 · 다음 할 일 = 만남 고르기
await run(35, '서버 readiness: 목적 없음 → 다음 할 일 = 원하는 만남 고르기(「모두 마쳤어요」 0)', IPHONE, { eligible: false, missing: ['purpose'], readiness: SR({ purpose: false }) }, async (p) => {
  await go(p); await p.waitForTimeout(400); const t = await text(p);
  expect(t.includes('원하는 만남을 골라요'), '다음 할 일이 목적 고르기가 아님'); expect(!t.includes('연결 준비를 모두 마쳤어요'), '서버 자격 없음인데 「모두 마쳤어요」');
  return '목적 없음 · 만남 고르기';
});
await run(36, '서버 readiness: 모두 갖춤 + eligible → 「모두 마쳤어요」', IPHONE, { eligible: true, missing: [], readiness: SR({}) }, async (p) => {
  await go(p); await p.waitForTimeout(400); const t = await text(p);
  expect(t.includes('연결 준비를 모두 마쳤어요'), '자격을 갖췄는데 완료 문구 없음'); return '자격 · 완료 문구';
});
// 42~49 2026-10-01 대표 「PROFILE / PHOTO REVEAL / SCENES」: ECHO FRAME + FILM(처음 한 번) — 서버가 공개(revealed)라고 보낸 상대만.
const FP = (o = {}) => ({ ...PARTNER, photo_url: PHOTO_URL, bio: '주말엔 동네를 오래 걸어요. 조용한 카페도 좋아하고요.', ...o });
const revealedMatch = (o = {}) => match({ my_answer: '주말 아침', partner_answered: true, revealed: true, partner: FP(o), messages: [] });
const frameBox = (p) => p.evaluate(() => { const f = document.querySelector('.doit-partner-scene'); const r = f?.getBoundingClientRect(); return r ? { w: r.width, h: r.height, vw: innerWidth } : null; });
await run(42, 'P1·P23 FRAME: 한 문장 → 틀 안의 실제 사진(꽉 찬 사진 아님) → 이름·단서', IPHONE, { matches: [revealedMatch()] }, async (p) => {
  await go(p); await p.waitForTimeout(1800);
  const order = await p.evaluate(() => [...document.querySelectorAll('.doit-partner-frame > *')].map(e => e.className));
  expect(order[0] === 'doit-partner-sentence' && order[1] === 'doit-partner-scene', `순서 ${order}`);
  expect((await p.locator('.doit-partner-sentence p').innerText()) === '주말엔 동네를 오래 걸어요.', '한 문장 = 직접 쓴 소개의 첫 문장');
  const b = await frameBox(p); expect(b && b.w <= b.vw * 0.8 && Math.abs(b.w / b.h - 0.8) < 0.02, `틀 크기 ${JSON.stringify(b)}`);
  const t = await text(p); expect(!/\d+\s*%|65|35/.test(t), 'P22 숫자·퍼센트 노출');
  await p.screenshot({ path: 'uxshots/42-frame.png' }); return `문장→사진(${Math.round(b.w)}×${Math.round(b.h)})→이름`;
});
await run(43, 'P7·P8·P21 FILM: 처음 한 번만 · 다시 열면 바로', IPHONE, { matches: [revealedMatch()] }, async (p) => {
  await go(p); const first = await p.locator('.doit-partner-frame').getAttribute('data-film');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600); const again = await p.locator('.doit-partner-frame').getAttribute('data-film');
  expect(first === 'true' && again === null, `처음=${first} 다시=${again}`); return '처음 장면 진입 · 다시 열면 정지 상태';
});
await run(44, 'P9 reduced motion: 장면 진입 = 단순 흐려짐 없는 페이드', IPHONE, { matches: [revealedMatch()] }, async (p) => {
  await p.emulateMedia({ reducedMotion: 'reduce' }); await go(p);
  // 앱 공통 「움직임 줄이기」 규칙이 장면 진입을 끄거나 페이드로 바꾼다 — 어느 쪽이든 흐림·이동 없이 처음부터 다 보여야 한다.
  const st = await p.evaluate(() => ['.doit-partner-sentence', '.doit-partner-scene'].map(s => { const c = getComputedStyle(document.querySelector(s)); return { a: c.animationName, f: c.filter, t: c.transform, o: c.opacity }; }));
  expect(st.every(x => ['none', 'echo-frame-fade'].includes(x.a) && x.f === 'none' && x.t === 'none' && x.o === '1'), `움직임 ${JSON.stringify(st)}`); return st.map(x => x.a).join(',');
});
await run(45, 'P11·P24 느린 사진(3초): 자리 먼저 잡음 · 밀림 0', IPHONE, { matches: [revealedMatch()], photoDelay: 3000 }, async (p) => {
  await p.goto(`${BASE}/doit/connections`, { waitUntil: 'domcontentloaded' }); await p.locator('.doit-partner-scene').waitFor({ timeout: 15000 }); await p.waitForTimeout(1600); const before = await frameBox(p); const loading = await p.locator('.doit-partner-scene').getAttribute('data-photo');
  await p.waitForTimeout(3200); const after = await frameBox(p); const ready = await p.locator('.doit-partner-scene').getAttribute('data-photo');
  expect(loading === 'loading' && ready === 'ready' && before.h === after.h, `밀림 ${before.h}→${after.h} ${loading}/${ready}`); return `높이 ${Math.round(before.h)} 고정`;
});
await run(46, 'P12 사진 실패: 빈 틀 + ECHO 심볼 + 다시 불러오기(서버에서 새 주소)', IPHONE, { matches: [revealedMatch()], photoFail: true }, async (p, s) => {
  await go(p); await p.waitForTimeout(800);
  expect(await p.locator('.doit-partner-scene-empty').innerText().then(t => t.includes('사진을 불러오지 못했어요')), '실패 안내 없음');
  const n = s.st.calls.filter(c => c.action === 'my_matches').length; await p.locator('.doit-partner-scene-empty button').click(); await p.waitForTimeout(800);
  expect(s.st.calls.filter(c => c.action === 'my_matches').length > n, '다시 불러오기가 서버에 다시 묻지 않음'); return '빈 틀 · 서버 재요청';
});
await run(47, 'P3·SECURITY 공개 전: 상대 사진 요청 0 · DOM 사진/주소 0', IPHONE, { matches: [match({ my_answer: '주말 아침', partner_answered: true })] }, async (p, s) => {
  await go(p); await p.waitForTimeout(800);
  const dom = await p.evaluate(() => ({ imgs: [...document.querySelectorAll('.doit-match img')].length, sign: document.documentElement.outerHTML.includes('object/sign'), frame: !!document.querySelector('.doit-partner-frame'), bg: [...document.querySelectorAll('.doit-match *')].some(e => getComputedStyle(e).backgroundImage.includes('storage')) }));
  expect(!s.st.storage && dom.imgs === 0 && !dom.sign && !dom.frame && !dom.bg, `노출 ${JSON.stringify(dom)} storage=${s.st.storage ?? 0}`); return '사진 요청 0 · 주소 0 · 틀 0';
});
for (const [n, w] of [[48, 320], [49, 430]]) await run(n, `P13·P15·P17 ${w}px · 긴 한국어 소개 넘침 0`, { width: w, height: 844 }, { matches: [revealedMatch({ bio: '주말에는 오래된 동네 골목을 천천히 걸으면서 작은 서점이나 조용한 카페를 찾아다니는 걸 정말 좋아하고, 평일 저녁엔 짧게라도 산책을 꼭 해요.' })] }, async (p) => {
  await go(p); await p.waitForTimeout(1800);
  const m = await p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth, over: [...document.querySelectorAll('.doit-partner-frame *')].filter(e => e.getBoundingClientRect().right > innerWidth + .5).length }));
  expect(m.sw <= m.iw && m.over === 0, JSON.stringify(m)); if (w === 320) await p.screenshot({ path: 'uxshots/48-frame-320.png', fullPage: true }); return `넘침 0 · 긴 문장은 「…」로 줄이고 나머지는 아래에`;
});

// 50~60 FLOW + SAFETY(2026-10-01 대표 「COMPLETE PRODUCT FLOW」·「SAFETY LAYER」).
const pickReason = async (p) => { await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); };
await run(50, 'ZZARIT 은 한 번만: 서버 mutual → 보임 · 새로고침·재진입 0', IPHONE, { candidates: [cand('c1')], partnerYes: ['c1'] }, async (p) => {
  await go(p); await pickReason(p); await p.getByRole('button', { name: /이어지고 싶어요/ }).click(); await p.waitForTimeout(400);
  expect(await p.locator('.echo-zzarit').count() === 1, 'ZZARIT 없음');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
  expect(await p.locator('.echo-zzarit').count() === 0, '새로고침에 다시 뜸'); expect((await text(p)).includes('ECHO가 하나만 물어볼게요.'), '연결로 이어지지 않음');
  return '1회 · 새로고침 0';
});
await run(51, 'ZZARIT 연출 ≈1.2초 뒤 정지 · 밝기 4% · 버튼 포커스', IPHONE, { matches: [match({ via_mutual: true })] }, async (p) => {
  await go(p); await p.waitForTimeout(100);
  const during = await p.evaluate(() => document.querySelector('.echo-zzarit').getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
  await p.waitForTimeout(1400);
  const after = await p.evaluate(() => ({ run: document.querySelector('.echo-zzarit').getAnimations({ subtree: true }).filter(a => a.playState === 'running').length, lift: getComputedStyle(document.querySelector('.echo-zzarit-lift')).opacity, focus: document.activeElement?.textContent }));
  expect(during > 0 && after.run === 0, `움직임 ${during}→${after.run}`); expect(Number(after.lift) >= .03 && Number(after.lift) <= .05, `밝기 ${after.lift}`);
  expect(/첫 이야기 시작하기/.test(after.focus ?? ''), '버튼 포커스');
  await p.screenshot({ path: 'uxshots/51-zzarit-end.png' }); return `실행 중 ${during} → 1.5초 뒤 0 · 막 ${after.lift}`;
});
await run(52, 'ZZARIT 움직임 줄이기: 처음부터 정지 화면 · 진동 0', IPHONE, { matches: [match({ via_mutual: true })] }, async (p) => {
  await p.emulateMedia({ reducedMotion: 'reduce' }); await p.addInitScript(() => { window.__vib = 0; navigator.vibrate = () => { window.__vib++; return true; }; });
  await go(p); const m = await p.evaluate(() => ({ run: document.querySelector('.echo-zzarit').getAnimations({ subtree: true }).length, vib: window.__vib, title: getComputedStyle(document.querySelector('.echo-zzarit-title')).opacity }));
  expect(m.run === 0 && m.vib === 0 && m.title === '1', JSON.stringify(m)); return '움직임 0 · 진동 0 · 글자 바로 보임';
});
for (const [n, w] of [[53, 320], [54, 360], [55, 430]]) await run(n, `ZZARIT ${w}px: 넘침 0 · 버튼 화면 안`, { width: w, height: w === 320 ? 640 : 844 }, { matches: [match({ via_mutual: true })] }, async (p) => {
  await go(p); await p.waitForTimeout(1300);
  const m = await p.evaluate(() => { const b = document.querySelector('.echo-zzarit-cta').getBoundingClientRect(); return { sw: document.scrollingElement.scrollWidth, iw: innerWidth, right: b.right, h: b.height }; });
  expect(m.sw <= m.iw && m.right <= m.iw && m.h >= 44, JSON.stringify(m)); if (w === 320) await p.screenshot({ path: 'uxshots/53-zzarit-320.png', fullPage: true }); return `넘침 0 · 버튼 ${Math.round(m.h)}px`;
});
await run(56, 'SAFETY 후보 신고 3번: 불편해요 → 신고할게요 → 사유 · 서버가 접수했다고 할 때만 「접수했어요」', IPHONE, { candidates: [cand('c1')] }, async (p, s) => {
  await go(p); await pickReason(p);
  await p.getByRole('button', { name: /불편해요 · 차단 · 신고/ }).click(); await p.getByRole('button', { name: '신고할게요' }).click();
  expect(await p.locator('.doit-safety-reasons button').count() === 6, '사유 6개');
  await p.screenshot({ path: 'uxshots/56-report-reasons.png' });
  await p.getByRole('button', { name: '위협·강요' }).click(); await p.waitForTimeout(500);
  const call = s.st.calls.find(c => c.action === 'choose'); expect(call && call.choice === 'hide' && call.block === true && call.reason === 'threat', JSON.stringify(call));
  const t = await text(p); expect(t.includes('접수했어요.') && t.includes('다시 추천되지 않아요'), '접수 문구'); return 'choose hide+block+threat · 접수했어요';
});
await run(57, 'SAFETY 후보 차단 2번 · 예전 서버(저장 확인 없음)면 「접수·차단했어요」 말하지 않음', IPHONE, { candidates: [cand('c1'), cand('c2')], oldServer: true }, async (p, s) => {
  await go(p); await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).first().click();
  await p.getByRole('button', { name: /불편해요 · 차단 · 신고/ }).first().click(); await p.getByRole('button', { name: '차단할게요' }).click(); await p.waitForTimeout(500);
  const t = await text(p); expect(s.st.calls.some(c => c.action === 'choose' && c.block === true && !('reason' in c)), '차단 요청');
  expect(!t.includes('접수했어요') && !t.includes('차단했어요') && t.includes('숨겼어요'), '서버 확인 없이 차단·접수 문구'); return '서버 확인 없으면 숨김만 말함';
});
await run(58, 'SAFETY 연결 신고 3번: 그만하기 → 신고할게요 → 사유 · 접수했어요 · 끝난 연결', IPHONE, { matches: [revealedMatch()] }, async (p, s) => {
  await go(p); await p.waitForTimeout(600);
  expect((await text(p)).includes('불편하면 언제든 나갈 수 있어요.'), '안전 문구');
  await p.getByRole('button', { name: '이 연결 그만하기' }).click(); await p.getByRole('button', { name: '신고할게요', exact: true }).click();
  await p.getByRole('button', { name: '사기·금전 요구' }).click(); await p.waitForTimeout(600);
  const call = s.st.calls.find(c => c.action === 'leave'); expect(call && call.block === true && call.report === true && call.reason === 'scam', JSON.stringify(call));
  const t = await text(p); expect(t.includes('접수했어요.') && t.includes('이 연결은 끝났어요'), '접수·끝남'); expect(!t.includes('하늘의 답'), '끝난 뒤 상대 말 표시');
  return 'leave block+report+scam · 끝난 연결';
});
await run(59, '만나기 전 안내: 「약속했어요」 고른 뒤에만', IPHONE, { matches: [revealedMatch()] }, async (p) => {
  await go(p); await p.waitForTimeout(600); expect(await p.locator('.doit-meet-safety:not(.doit-meet-safety--peek)').count() === 0, '고르기 전 표시');
  await p.getByRole('button', { name: '약속했어요' }).click(); await p.waitForTimeout(300);
  const t = await p.locator('.doit-meet-safety:not(.doit-meet-safety--peek)').innerText(); expect(t.includes('사람이 많은 곳') && t.includes('신고'), t); return '선택 뒤 4줄';
});
await run(60, 'ECHO 사용법: 메뉴 → 설정 #guide · 9항목 · 320px 넘침 0', { width: 320, height: 640 }, {}, async (p) => {
  await p.goto(`${BASE}/doit/settings#guide`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const m = await p.evaluate(() => ({ n: document.querySelectorAll('#guide details').length, top: Math.round(document.getElementById('guide').getBoundingClientRect().top), sw: document.scrollingElement.scrollWidth, iw: innerWidth }));
  expect(m.n === 9 && m.top < 200 && m.sw <= m.iw, JSON.stringify(m));
  await p.locator('#guide summary', { hasText: '안전하게 쓰기' }).click(); expect((await p.locator('#guide').innerText()).includes('차단하면 다시 추천되지 않아요'), '안전 안내');
  await p.screenshot({ path: 'uxshots/60-guide-320.png' }); return `9항목 · 바로 그 자리(top ${m.top})`;
});
for (const [n, w] of [[61, 320], [62, 430]]) await run(n, `SAFETY ${w}px: 신고 사유 줄 넘침 0 · 버튼 44px`, { width: w, height: 760 }, { candidates: [cand('c1')] }, async (p) => {
  await go(p); await pickReason(p); await p.getByRole('button', { name: /불편해요 · 차단 · 신고/ }).click(); await p.getByRole('button', { name: '신고할게요' }).click();
  const m = await p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth, small: [...document.querySelectorAll('.doit-safety-reasons button')].filter(b => b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().right > innerWidth).length }));
  expect(m.sw <= m.iw && m.small === 0, JSON.stringify(m)); return '넘침 0';
});

// 63~66 2026-10-02 QA 마감 v1.1: 신고와 차단은 별도 · 저장 실패면 「접수/차단」 거짓 표시 0 · 만나기 전 안내는 이야기 화면에서도.
await run(63, 'SAFETY 신고만(차단 체크 해제): block=false · 접수했어요 · 「차단했어요」 0', IPHONE, { candidates: [cand('c1')] }, async (p, s) => {
  await go(p); await pickReason(p); await p.getByRole('button', { name: /불편해요 · 차단 · 신고/ }).click(); await p.getByRole('button', { name: '신고할게요' }).click();
  await p.getByLabel('차단도 함께 하기').uncheck(); await p.getByRole('button', { name: '스팸' }).click(); await p.waitForTimeout(500);
  const call = s.st.calls.find(c => c.action === 'choose'); expect(call && call.block === false && call.reason === 'spam', JSON.stringify(call));
  const t = await text(p); expect(t.includes('접수했어요') && !t.includes('차단했어요'), t.slice(0, 200)); return 'block=false · 접수만';
});
await run(64, 'SAFETY 저장 실패(500): 「접수했어요」·「차단했어요」 0 · 다시 누를 수 있음', IPHONE, { candidates: [cand('c1')], fail: { choose: { times: 1, status: 500, message: '저장하지 못했어요. 다시 눌러 주세요.' } } }, async (p) => {
  await go(p); await pickReason(p); await p.getByRole('button', { name: /불편해요 · 차단 · 신고/ }).click(); await p.getByRole('button', { name: '차단할게요' }).click(); await p.waitForTimeout(500);
  const t = await text(p); expect(!/접수했어요|차단했어요|숨겼어요/.test(t), '실패인데 완료 문구'); expect(await p.locator('.doit-candidates [role=alert]').count() === 1, `실패 안내 없음 ${t.slice(0, 160)}`);
  return '실패 안내만';
});
await run(65, 'SAFETY 연결 신고 저장 실패: 끝남·접수 거짓 표시 0', IPHONE, { matches: [revealedMatch()], fail: { leave: { times: 1, status: 500, message: '지금은 끝내지 못했어요. 다시 눌러 주세요.' } } }, async (p) => {
  await go(p); await p.waitForTimeout(500);
  await p.getByRole('button', { name: '이 연결 그만하기' }).click(); await p.getByRole('button', { name: '신고할게요', exact: true }).click(); await p.getByRole('button', { name: '위협·강요' }).click(); await p.waitForTimeout(600);
  const t = await text(p); expect(!/접수했어요|차단했어요|이 연결은 끝났어요/.test(t), '실패인데 완료'); expect(await p.locator('.doit-match [role=alert]').count() === 1, `실패 안내 ${t.slice(0, 160)}`);
  return '실패 안내 · 연결 유지';
});
await run(66, '만나기 전 안전 안내: 이야기 화면에서 「약속했어요」 없이도 열림', IPHONE, { matches: [revealedMatch()] }, async (p) => {
  await go(p); await p.waitForTimeout(500); await p.getByText('만나기 전 안전 안내').click();
  const t = await p.locator('.doit-meet-safety--peek').innerText(); expect(t.includes('사람이 많은 곳'), t); return '이야기 화면에서 열림';
});
// 37~42 2026-10-01 대표 「P0 QUESTION UX CONTRACT RESTORE」: 주관식 본체 + 객관식 구조대(서버 계약 모양 그대로 · 보기는 서버가 준 것만).
const RQ = '첫 만남은 어떤 분위기로 하고 싶으세요?';
const RS = (o = {}) => ({ ...AGENT_SESSION, current_question: RQ, messages: [{ role: 'ai', text: '어떤 친구를 만나고 싶어요?' }, { role: 'user', text: '편하게 얘기할 친구요' }, { role: 'ai', text: RQ }], current_rescue: { options: ['조용하고 편하게', '밝고 가볍게', '밥 먹으면서'], symbols: ['🫧', '🫧', '🍽️'], show: false, fallback: false }, previous: null, ...o });
const openConv = async (p) => { await p.goto(`${BASE}/doit/conversation`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000); await p.locator('.echo-question').filter({ hasText: RQ }).first().waitFor({ timeout: 15000 }); };
await run(37, '구조대 기본: 주관식 본체 · 보기 0 → 잘 모르겠어요 → 보기 3 · 눌러도 안 넘어감 · 보내면 choice', IPHONE, { agent: { session: RS() } }, async (p, s) => {
  await openConv(p);
  expect(await p.locator('#echo-message').isVisible(), 'Q1 주관식 입력칸 없음');
  expect(await p.locator('.echo-rescue').count() === 0, 'Q1 보기가 먼저 펼쳐짐');
  const help = p.locator('.echo-reactions button', { hasText: '잘 모르겠어요' }); expect(await help.count() === 1, '잘 모르겠어요 버튼 없음');
  expect(await p.locator('.echo-reactions button', { hasText: '이 질문 넘어가기' }).count() === 1, '넘어가기 버튼 없음');
  await p.screenshot({ path: 'uxshots/37a-default.png' });
  await help.click(); await p.waitForTimeout(300);
  expect(!s.st.calls.some(c => c.action === 'agent_rescue'), '서버가 들고 있던 보기인데 다시 청함');
  const opts = p.locator('.echo-rescue .echo-choice'); const n = await opts.count();
  expect(n >= 2 && n <= 4, `Q2·Q13 보기 수 ${n}`); expect((await p.locator('.echo-rescue-lead').innerText()).includes('이런 느낌 중에 가까운 게 있어요?'), '안내 문구');
  for (let k = 0; k < n; k++) { const h = (await opts.nth(k).boundingBox()).height; expect(h >= 44 && h <= 64, `누름 높이 ${h}`); }
  const texts = await opts.allInnerTexts(); expect(!texts.some(t => /모르|선호|외향|[A-Za-z]{3,}/.test(t)), `Q14 보기 말 ${texts}`);
  await opts.nth(1).click(); await p.waitForTimeout(400);
  expect(await opts.nth(1).getAttribute('aria-pressed') === 'true', '고른 표시 없음');
  const sel = await opts.nth(1).evaluate(e => { const c = getComputedStyle(e); return { bg: c.backgroundColor, color: c.color, bw: c.borderTopWidth }; }); const off = await opts.nth(0).evaluate(e => getComputedStyle(e).backgroundColor);
  const mark = await opts.nth(1).evaluate(e => getComputedStyle(e.querySelector('.echo-option-text') ?? e, '::after').content + getComputedStyle(e, '::before').content);
  const sym = await opts.nth(0).locator('.echo-option-mark').innerText(); expect(sym.length > 0 && sym.length <= 3, `심볼 칸 ${sym}`);
  expect(sel.bg !== off && parseFloat(sel.bw) >= 1 && mark.includes('✓'), `고른 표시가 또렷하지 않음 ${JSON.stringify(sel)} vs ${off} ${mark}`);
  expect(!s.st.calls.some(c => c.action === 'agent_turn'), '보기를 누르자 바로 넘어감(자동 진행 금지)');
  await p.screenshot({ path: 'uxshots/37b-picked.png' });
  await p.locator('.echo-composer button[type=submit]').click(); await p.waitForTimeout(800);
  const turn = s.st.calls.find(c => c.action === 'agent_turn');
  expect(turn && turn.text === '밝고 가볍게' && turn.choice === '밝고 가볍게' && turn.rescueOpen === true, `Q7 보낸 것 ${JSON.stringify(turn)?.slice(0, 160)}`);
  return '본체 주관식 · 보기 3 · 고른 표시 · 보내기 = choice';
});
await run(38, '「직접 설명할게요」 = 보기 접고 주관식(입력칸 초점) · 적으면 고른 보기 풀림', IPHONE, { agent: { session: RS({ current_rescue: { options: ['조용하고 편하게', '밝고 가볍게'], show: true, fallback: false } }) } }, async (p, s) => {
  await openConv(p);
  expect(await p.locator('.echo-rescue').count() === 1, '서버가 먼저 펼친 보기(C·D)가 안 보임');
  expect(await p.locator('.echo-reactions button', { hasText: '잘 모르겠어요' }).count() === 0, '보기가 펼쳐졌는데 잘 모르겠어요 버튼이 남음');
  await p.locator('.echo-rescue .echo-choice').first().click();
  await p.locator('.echo-rescue-self').click(); await p.waitForTimeout(300);
  expect(await p.locator('.echo-rescue').count() === 0, 'Q12 보기가 안 접힘');
  expect(await p.evaluate(() => document.activeElement?.id) === 'echo-message', 'Q12 입력칸 초점 아님');
  await p.locator('#echo-message').fill('조용한 데서 천천히요'); await p.locator('.echo-composer button[type=submit]').click(); await p.waitForTimeout(800);
  const turn = s.st.calls.find(c => c.action === 'agent_turn'); expect(turn && !turn.choice && turn.text === '조용한 데서 천천히요', `주관식으로 보냄 ${JSON.stringify(turn)?.slice(0, 120)}`);
  await p.screenshot({ path: 'uxshots/38-explain-self.png' }); return '보기 접힘 · 입력칸 초점 · 주관식 전송(choice 0)';
});
await run(39, '보기를 못 만들면 안전 안내(직접 설명할게요 / 잘 모르겠어요 / 이 질문은 넘어갈게요)', IPHONE, { agent: { session: RS({ current_rescue: { options: [], show: false, fallback: false } }), onRescue: { options: [], show: false, fallback: true } } }, async (p, s) => {
  await openConv(p);
  await p.locator('.echo-reactions button', { hasText: '잘 모르겠어요' }).click(); await p.waitForTimeout(800);
  expect(s.st.calls.some(c => c.action === 'agent_rescue'), '보기가 없는데 서버에 청하지 않음');
  const t = await p.locator('.echo-rescue').innerText();
  for (const w of ['직접 설명할게요', '잘 모르겠어요', '이 질문은 넘어갈게요']) expect(t.includes(w), `안전 안내 ${w} 없음`);
  await p.screenshot({ path: 'uxshots/39-fallback.png' });
  await p.locator('.echo-rescue .echo-choice', { hasText: '이 질문은 넘어갈게요' }).click(); await p.waitForTimeout(800);
  const turn = s.st.calls.find(c => c.action === 'agent_turn'); expect(turn && turn.text === '이 질문은 넘어갈게요' && !turn.choice, `넘기기 전송 ${JSON.stringify(turn)?.slice(0, 120)}`);
  return 'fallback 3 버튼 · 넘기기 = SKIP 전송(choice 0)';
});
await run(40, '뒤로 = 직전 질문 · 고른 보기 · 보기 목록 복원(Q11)', IPHONE, { agent: { session: RS({ messages: [{ role: 'ai', text: '처음 만나면 어디가 편해요?' }, { role: 'user', text: '조용한 카페' }, { role: 'ai', text: RQ }], previous: { question: '처음 만나면 어디가 편해요?', options: ['조용한 카페', '같이 걷기', '밥 먹으면서'], chosen: '조용한 카페' } }), recomputed: RQ } }, async (p, s) => {
  await openConv(p);
  await p.goBack(); await p.waitForTimeout(800);
  expect((await p.locator('.echo-question').first().innerText()).includes('처음 만나면 어디가 편해요?'), '직전 질문 복원 안 됨');
  expect(await p.locator('#echo-message').inputValue() === '조용한 카페', '고른 답 복원 안 됨');
  const chosen = p.locator('.echo-choice[aria-pressed="true"]'); expect(await chosen.count() === 1 && (await chosen.innerText()).includes('조용한 카페'), '고른 보기 표시 복원 안 됨');
  await p.screenshot({ path: 'uxshots/40-back-restore.png' });
  await p.locator('.echo-choice', { hasText: '같이 걷기' }).click(); await p.locator('.echo-composer button[type=submit]').click(); await p.waitForTimeout(800);
  const turn = s.st.calls.find(c => c.action === 'agent_turn'); expect(turn && turn.correction && turn.text === '같이 걷기', `정정 전송 ${JSON.stringify(turn)?.slice(0, 120)}`);
  return '질문·고른 보기·목록 복원 · 바꾼 보기 = 정정';
});
await run(41, 'Q15 넘침 0(320~430px) · 보기 4개 긴 글자 · 누름 높이 44+', IPHONE, { agent: { session: RS({ current_rescue: { options: ['조용한 카페에서 수다', '공원에서 같이 걷기', '맛있는 밥 먹으면서', '전시 보고 커피 한 잔'], show: true, fallback: false } }) } }, async (p) => {
  const out = [];
  for (const w of [320, 360, 375, 390, 414, 430]) {
    await p.setViewportSize({ width: w, height: 844 }); await openConv(p);
    const m = await p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth, over: [...document.querySelectorAll('.echo-rescue .echo-choice, .echo-reactions button, .echo-composer')].filter(e => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.left < -0.5; }).length, low: [...document.querySelectorAll('.echo-rescue .echo-choice, .echo-rescue-self, .echo-reactions button')].filter(e => e.getBoundingClientRect().height < 44).length }));
    expect(m.sw <= m.iw && m.over === 0 && m.low === 0, `${w}px ${JSON.stringify(m)}`); out.push(w);
    if (w === 320) await p.screenshot({ path: 'uxshots/41-320.png', fullPage: true });
  }
  return `넘침 0 · ${out.join('/')}px`;
});
// ── 2026-10-02 PR #99 마지막 구간(격리 미리보기 · 모의 서버 · 실제 영상·저장 PASS 아님) ──
const MSID = '50000000-0000-4000-8000-00000000000e', MVER = 'ab'.repeat(32);
const talkMatch = () => [match({ my_answer: '주말 아침', partner_answered: true, revealed: true, partner: PARTNER, messages: [] })];
await run(42, 'MEET 꺼짐(지금 실서버 503) = 구간 0 · 기존 이야기 화면 그대로', IPHONE, { matches: talkMatch(), userMeta: { doit_connect_consent_version: 'connect-v1' } }, async (p, s) => {
  await go(p); await p.waitForTimeout(400);
  expect(await p.locator('.doit-meet').count() === 0, '꺼짐인데 구간이 보임'); expect(s.st.calls.filter(c => c.action === 'meet_status').length === 1, 'meet_status 한 번만');
  expect(await p.locator(`#message-${MID}`).count() === 1, '이야기 입력 사라짐'); return '그리지 않음 · 요청 1회';
});
for (const [n, state] of [[43, 'unavailable'], [44, 'need_video']]) {
  await run(n, `MEET ${state}`, IPHONE, { matches: talkMatch(), meet: { state, allowed: false, sessionId: null } }, async (p) => {
    await go(p); await p.waitForTimeout(400); const c = await p.locator('.doit-meet').count(); const btn = await p.locator('.doit-meet button').filter({ hasNotText: '영상 이용 동의 거두기' }).count();
    if (state === 'unavailable') expect(c === 0 || (await p.locator('.doit-meet').innerText()).trim() === '영상 이용 동의 거두기', '「지금은 어려움」인데 이유·구간이 보임'); else { expect(c === 1 && btn === 0, `영상 안내만(버튼 ${btn})`); await p.locator('.doit-meet').screenshot({ path: 'uxshots/44-meet-video.png' }); }
    return state === 'unavailable' ? '그리지 않음' : '안내 문장만 · 버튼 0(영상 연결 전)';
  });
}
await run(45, 'MEET 번호 없는 지금 계약 = 확인 버튼 0', IPHONE, { matches: talkMatch(), meet: { state: 'need_my_check', allowed: false } }, async (p) => {
  await go(p); await p.waitForTimeout(400); expect(await p.locator('.doit-meet button').filter({ hasNotText: '영상 이용 동의 거두기' }).count() === 0, '번호 없이 버튼'); return '버튼 0';
});
await run(46, 'MEET 모습 확인 → 만남 의사 → 기다림(번호는 보내기만 · 화면 글자 0)', IPHONE, { matches: talkMatch(), meet: { state: 'need_my_check', allowed: false, sessionId: MSID, stateVersion: MVER } }, async (p, s) => {
  await go(p); await p.waitForTimeout(400);
  await p.locator('.doit-meet').screenshot({ path: 'uxshots/46a-meet-check.png' });
  await p.getByRole('button', { name: /상대 모습을 확인했어요/ }).click(); await p.waitForTimeout(500);
  const chk = s.st.calls.find(c => c.action === 'meet_check'); expect(chk && chk.sessionId === MSID && chk.stateVersion === MVER && chk.matchId === MID && !('allowed' in chk) && !('user_id' in chk), `확인 요청 ${JSON.stringify(chk)}`);
  await p.locator('.doit-meet').screenshot({ path: 'uxshots/46b-meet-intent.png' });
  await p.getByRole('button', { name: '만나 보고 싶어요' }).click(); await p.waitForTimeout(500);
  const it = s.st.calls.find(c => c.action === 'meet_intent'); expect(it && it.intent === 'yes' && it.sessionId === MSID && it.stateVersion === MVER && /^[0-9a-f-]{36}$/.test(it.requestId), `의사 요청 ${JSON.stringify(it)}`);
  const t = await text(p); expect(t.includes('상대의 선택을 기다리고 있어요'), '기다림'); expect(!t.includes(MSID), '번호가 화면에 보임');
  await p.locator('.doit-meet').screenshot({ path: 'uxshots/46c-meet-wait.png' }); return '확인 → 의사 → 기다림';
});
await run(47, 'MEET 조금 더 생각할게요 = 저장 0 · 다시 보기', IPHONE, { matches: talkMatch(), meet: { state: 'need_my_check', allowed: false, sessionId: MSID, stateVersion: MVER } }, async (p, s) => {
  await go(p); await p.waitForTimeout(400); await p.getByRole('button', { name: '조금 더 생각할게요' }).click(); await p.waitForTimeout(200);
  expect(!s.st.calls.some(c => c.action === 'meet_check'), '저장 요청이 감'); await p.getByRole('button', { name: '다시 보기' }).click();
  expect(await p.getByRole('button', { name: /상대 모습을 확인했어요/ }).count() === 1, '다시 보기'); return '저장 0';
});
await run(48, 'MEET 둘 다 원함(allowed) = 약속 안내 + 안전 안내 · 보증 표현 0', IPHONE, { matches: talkMatch(), meet: { state: 'allowed', allowed: true, sessionId: MSID, stateVersion: MVER } }, async (p) => {
  await go(p); await p.waitForTimeout(400); const t = await p.locator('.doit-meet').innerText();
  expect(t.includes('두 분 모두 만나 보고 싶어 해요') && t.includes('사람이 많은 곳'), '약속·안전 안내'); expect(t.includes('보증하지 않아요') && !/인증된|안전한 사람/.test(t), '보증 표현');
  await p.locator('.doit-meet').screenshot({ path: 'uxshots/48-meet-allowed.png' }); return '약속 안내 · 안전 안내';
});
await run(50, 'MEET 그사이 상태가 바뀜(STATE_CHANGED) → 다시 읽어 서버 상태대로 · 저장 0', IPHONE, { matches: talkMatch(), meet: { state: 'need_my_check', allowed: false, sessionId: MSID, stateVersion: MVER }, fail: { meet_check: { times: 1, status: 409, code: 'STATE_CHANGED', message: '상태가 바뀌었어요' } } }, async (p, s) => {
  await go(p); await p.waitForTimeout(400); s.st.meet = { state: 'unavailable', allowed: false };
  await p.getByRole('button', { name: /상대 모습을 확인했어요/ }).click(); await p.waitForTimeout(600);
  expect(s.st.calls.filter(c => c.action === 'meet_status').length === 2, '다시 읽기 없음'); const left = await p.locator('.doit-meet').count() ? (await p.locator('.doit-meet').innerText()).trim() : ''; expect(left === '' || left === '영상 이용 동의 거두기', `바뀐 서버 상태(unavailable)대로 · 이유 0 · ${left}`); expect(s.st.calls.filter(c => c.action === 'meet_check').length === 1, '저절로 다시 보내기 0'); return '다시 읽기 → 이유 없이 닫힘';
});
const NO_VIDEO = { doit_connect_consent_version: 'connect-v1' };
// ── PR #101: 켜졌는데 읽기 실패 = 안내 + 다시 불러오기(숨기지 않음) · 영상 이용 동의(공개 동의와 별도) ──
await run(51, 'MEET 켜졌는데 읽기 실패 = 「불러오지 못했어요 · 다시 불러오기」 → 다시 읽으면 서버 상태대로', IPHONE, { matches: talkMatch(), meet: { state: 'need_my_check', allowed: false, sessionId: MSID, stateVersion: MVER }, fail: { meet_status: { times: 1, status: 503, code: 'MEET_READ_FAILED', message: 'x' } } }, async (p, s) => {
  await go(p); await p.waitForTimeout(400);
  const t = await p.locator('.doit-meet').innerText(); expect(t.includes('불러오지 못했어요') && !t.includes('상대 모습을 확인했어요'), `실패 안내 ${t}`);
  await p.locator('.doit-meet').screenshot({ path: 'uxshots/51-meet-error.png' });
  await p.getByRole('button', { name: '다시 불러오기' }).click(); await p.waitForTimeout(500);
  expect(await p.getByRole('button', { name: /상대 모습을 확인했어요/ }).count() === 1, '다시 읽은 뒤 서버 상태'); return '안내 → 다시 불러오기 → 정상';
});
await run(52, 'MEET 영상 이용 동의 없음 → 동의 안내만(버튼 0) · 동의는 영상 칸만 바꿈 · 공개 동의 그대로 · 저절로 확인·의사 보내기 0', IPHONE, { matches: talkMatch(), userMeta: NO_VIDEO, meet: { state: 'unavailable', allowed: false } }, async (p, s) => {
  await go(p); await p.waitForTimeout(400);
  const t = await p.locator('.doit-meet').innerText();
  expect(t.includes('영상으로 인사해 볼까요') && t.includes('이름·사진 공개 동의와 따로') && t.includes('보증하지 않아요'), `동의 안내 ${t}`);
  expect(await p.getByRole('button', { name: /상대 모습을 확인했어요/ }).count() === 0, '동의 전 확인 버튼');
  await p.locator('.doit-meet').screenshot({ path: 'uxshots/52-meet-consent.png' });
  s.st.meet = { state: 'need_my_check', allowed: false, sessionId: MSID, stateVersion: MVER }; // 동의 뒤 서버 상태(판이 바뀜)
  await p.getByRole('button', { name: /영상 이용에 동의할게요/ }).click(); await p.waitForTimeout(600);
  const upd = s.st.calls.find(c => c.fn === 'auth_update');
  expect(upd && Object.keys(upd.data).sort().join() === 'doit_video_consent_at,doit_video_consent_version' && upd.data.doit_video_consent_version === 'video-v1', `동의 저장 ${JSON.stringify(upd)}`);
  expect(await p.getByRole('button', { name: /상대 모습을 확인했어요/ }).count() === 1, '동의 뒤 서버 상태대로');
  expect(!s.st.calls.some(c => c.action === 'meet_check' || c.action === 'meet_intent'), '저절로 보내기');
  return '동의 → 영상 칸만 → 다시 읽기';
});
await run(53, 'MEET 영상 이용 동의 거두기 = 영상 칸만 지움 · 다시 동의 안내', IPHONE, { matches: talkMatch(), meet: { state: 'need_my_intent', allowed: false, sessionId: MSID, stateVersion: MVER } }, async (p, s) => {
  await go(p); await p.waitForTimeout(400); s.st.meet = { state: 'unavailable', allowed: false };
  await p.getByRole('button', { name: '영상 이용 동의 거두기' }).click(); await p.waitForTimeout(600);
  const upd = s.st.calls.find(c => c.fn === 'auth_update');
  expect(upd && upd.data.doit_video_consent_version === null && !('doit_connect_consent_version' in upd.data), `거두기 ${JSON.stringify(upd)}`);
  const t = await p.locator('.doit-meet').innerText(); expect(t.includes('영상으로 인사해 볼까요'), '다시 동의 안내'); return '거두기 → 안내';
});
await run(54, 'MEET 「지금은 어려움」 + 이미 동의 = 이유 0 · 거두기 버튼만', IPHONE, { matches: talkMatch(), meet: { state: 'unavailable', allowed: false } }, async (p) => {
  await go(p); await p.waitForTimeout(400);
  const t = (await p.locator('.doit-meet').innerText()).trim(); expect(t === '영상 이용 동의 거두기', `거두기만 ${t}`); return '거두기만';
});
await run(55, 'MEET 꺼짐인데 남은 영상 동의 있음 = 거두기 버튼만(다른 단계 0) → 거두면 영상 칸만 지움', IPHONE, { matches: talkMatch() }, async (p, s) => {
  await go(p); await p.waitForTimeout(400);
  const t = (await p.locator('.doit-meet').innerText()).trim(); expect(t === '영상 이용 동의 거두기', `꺼짐 거두기만 ${t}`);
  await p.getByRole('button', { name: '영상 이용 동의 거두기' }).click(); await p.waitForTimeout(600);
  const upd = s.st.calls.find(c => c.fn === 'auth_update'); expect(upd && upd.data.doit_video_consent_version === null && !('doit_connect_consent_version' in upd.data), `거두기 ${JSON.stringify(upd)}`);
  expect(await p.locator('.doit-meet').count() === 0, '거둔 뒤 꺼짐 = 숨김'); return '꺼짐에서도 거두기';
});
await run(56, 'MEET 불러오기 실패 + 남은 영상 동의 = 실패 안내 + 다시 불러오기 + 거두기', IPHONE, { matches: talkMatch(), fail: { meet_status: { times: 5, status: 503, code: 'MEET_READ_FAILED', message: 'x' } } }, async (p) => {
  await go(p); await p.waitForTimeout(400); const t = await p.locator('.doit-meet').innerText();
  expect(t.includes('불러오지 못했어요') && t.includes('다시 불러오기') && t.includes('영상 이용 동의 거두기'), `실패+거두기 ${t}`); return '실패에서도 거두기';
});
await run(49, 'MEET 360px 넘침 0', W360, { matches: talkMatch(), meet: { state: 'need_my_intent', allowed: false, sessionId: MSID, stateVersion: MVER } }, async (p) => {
  await go(p); await p.waitForTimeout(400); expect(await overflow(p) <= 0, '가로 넘침');
  const low = await p.evaluate(() => [...document.querySelectorAll('.doit-meet button')].filter(b => b.getBoundingClientRect().height < 40).length); expect(low === 0, `작은 버튼 ${low}`);
  await p.locator('.doit-meet').screenshot({ path: 'uxshots/49-meet-360.png' }); return '넘침 0';
});

// 회귀: Google G · 로그인 문구
await run(29, '회귀: 로그인 Google G + 「Google로 시작하기」', IPHONE, {}, async (p) => {
  await p.context().clearCookies(); await p.evaluate(() => localStorage.clear()).catch(() => {});
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const n = await p.locator('button', { hasText: 'Google로 시작하기' }).locator('[data-google-g] svg path').count(); expect(n === 4, `G 조각 ${n}`); return '4색 G';
});

const pass = results.filter(r => r.ok).length;
console.log(`\nTOTAL ${results.length} · PASS ${pass} · FAIL ${results.length - pass}`);
await browser.close(); srv.close();
