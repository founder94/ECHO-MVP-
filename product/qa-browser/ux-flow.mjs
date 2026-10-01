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
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'qa-ux@do-it.company', app_metadata: { provider: 'email' }, user_metadata: { doit_connect_consent_version: 'connect-v1' }, created_at: '2026-09-01T00:00:00Z' };
const SESSION = { access_token: JWT, token_type: 'bearer', expires_in: 86400, expires_at: EXP, refresh_token: 'r', user: USER };
const PREVIEW = { purpose: '깊은 대화부터 시작하고 싶어요', readiness: { answers: 5, answers_needed: 5, turns: 5, uninformative: 0, confirmed: 4, photos: 3, photos_needed: 3, intro: true, phone_verified: false }, eligible: true, waiting: 3, candidates: 1, common: [], note: '' };
const cand = (id, extra = {}) => ({ id, created_at: '2026-09-30T00:00:00Z', purpose: '깊은 대화부터 시작하고 싶어요', reasons: ['두 분 모두 「깊은 대화부터 시작하고 싶어요」 만남을 원한다고 직접 골랐어요.', '내가 직접 한 말 「천천히 알아가고 싶어요」 — 상대도 비슷한 이야기를 직접 했어요.'], my_choice: null, waiting: false, ...extra });
const MID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const match = (extra = {}) => ({ id: MID, status: 'open', created_at: '2026-09-30T00:00:00Z', first_question: '요즘 가장 편하게 쉬는 시간은 언제예요?', my_answer: null, partner_answered: false, revealed: false, outcome: null, ...extra });
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
        if (body.choice !== 'yes') { st.candidates = st.candidates.filter(x => x.id !== body.candidateId); return { json: { ok: true, status: 'declined' } }; }
        if (st.partnerYes?.includes(body.candidateId)) { st.candidates = st.candidates.filter(x => x.id !== body.candidateId); st.matches = [match()]; return { json: { ok: true, status: 'mutual', match_id: MID, first_question: match().first_question, question_source: 'fixed' } }; }
        Object.assign(c, { my_choice: 'yes', waiting: true }); return { json: { ok: true, status: 'waiting' } };
      }
      case 'my_matches': return { json: { ok: true, matches: st.matches, consented: st.consented } };
      case 'answer': { const m = st.matches[0]; m.my_answer = body.text; if (st.partnerAnswered) { m.partner_answered = true; m.revealed = true; m.partner = PARTNER; m.messages = []; } return { json: { ok: true } }; }
      case 'message': { const m = st.matches[0]; m.messages = [...(m.messages ?? []), { id: String(Date.now()), mine: true, body: body.text, created_at: new Date().toISOString() }]; return { json: { ok: true } }; }
      case 'leave': { st.matches[0].status = 'closed'; return { json: { ok: true } }; }
      case 'outcome': return { json: { ok: true } };
      default: return { json: { ok: true } };
    }
  };
  return { st, connect };
}

async function newPage(browser, vp, server) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, ['sb-mutniujeiyujhkobadkd-auth-token', JSON.stringify(SESSION)]);
  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: USER });
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
  const t = await text(p); expect(t.includes('상대도 당신이 궁금했대요.'), '보상 문구'); expect(!/하늘|축하/.test(t), '상대 정보·과한 축하');
  await p.screenshot({ path: 'uxshots/10-mutual.png' }); return '보상 화면 · 상대 정보 0';
});
await run(11, 'connection (서버 match_id 로 이동)', IPHONE, { candidates: [cand('c1')], partnerYes: ['c1'] }, async (p) => {
  await go(p); await p.getByRole('button', { name: /왜 이 사람인지 보기/ }).click(); await p.getByRole('button', { name: /이어지고 싶어요/ }).click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /이야기 시작하기/ }).click(); await p.waitForTimeout(1200);
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
for (const [n, name, btn, want] of [[17, 'leave', '그만할게요', { block: false, report: false }], [18, 'block', '차단할게요', { block: true, report: false }], [19, 'report', '차단하고 신고할게요', { block: true, report: true }]]) {
  await run(n, name, IPHONE, { matches: [match({ my_answer: 'a', partner_answered: true, revealed: true, partner: PARTNER, messages: [] })] }, async (p, s) => {
    await go(p); await p.getByRole('button', { name: '이 연결 그만하기' }).click(); await p.getByRole('button', { name: btn, exact: true }).click(); await p.waitForTimeout(600);
    const call = s.st.calls.find(c => c.action === 'leave'); expect(call && call.block === want.block && call.report === want.report, `보낸 값 ${JSON.stringify(call)}`);
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
await run(31, 'via_mutual=true: 먼저 고른 사람도 서로 골랐다는 문구', IPHONE, { matches: [match({ via_mutual: true })] }, async (p) => {
  await go(p); const t = await text(p);
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
// 회귀: Google G · 로그인 문구
await run(29, '회귀: 로그인 Google G + 「Google로 시작하기」', IPHONE, {}, async (p) => {
  await p.context().clearCookies(); await p.evaluate(() => localStorage.clear()).catch(() => {});
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const n = await p.locator('button', { hasText: 'Google로 시작하기' }).locator('[data-google-g] svg path').count(); expect(n === 4, `G 조각 ${n}`); return '4색 G';
});

const pass = results.filter(r => r.ok).length;
console.log(`\nTOTAL ${results.length} · PASS ${pass} · FAIL ${results.length - pass}`);
await browser.close(); srv.close();
