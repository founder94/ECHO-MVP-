// v17 CoreConversation 통합안 브라우저 흐름 검사(모의 서버). 실제 Supabase/OpenAI 요청은 전부 차단하고 doit-understanding v8 계약을 흉내 낸다.
// 사용: node core.mjs <out-on 폴더> <mode> [cdpPort] [httpPort]
//   mode: talk (선택 화면→대화→후보 2→맞아요·그게 아니에요→다음 질문(STALE 1회)→이야기 2→구제→프로필)
//         explain (직접 설명 = 거절+self, 저장 실패 1회 → 새로고침 → 입력 복원 → 저장)
//         resume (서버에만 기록+후보 → 표시, AI 재호출 0)
//         limit (첫 이야기 limit:1 → 서버 1개 저장·반환)
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import WebSocket from 'ws';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.argv[2]; const MODE = process.argv[3] || 'talk';
const PORT = Number(process.argv[4] || 9453); const HTTP = Number(process.argv[5] || 5203);
const BASE = `http://127.0.0.1:${HTTP}`; const REF = 'zyyhhxyupizcqhxqnxuu'; const UID = '00000000-0000-0000-0000-0000000000c1';
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const CORS = [{ name: 'access-control-allow-origin', value: '*' }, { name: 'access-control-allow-methods', value: 'GET,POST,PATCH,PUT,DELETE,OPTIONS' }, { name: 'access-control-allow-headers', value: '*' }];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const http = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, BASE).pathname); let f = join(OUT, p); if (!existsSync(f) || statSync(f).isDirectory()) f = join(OUT, 'index.html'); res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise((r) => http.listen(HTTP, '127.0.0.1', r));

const PURPOSES = [{ id: 'friend', label: '친구를 만나고 싶어요', description: '편하게 알아가며 친구 관계를 만들고 싶어요.', sort_order: 1 }, { id: 'romantic', label: '연애로 이어질 만남을 원해요', description: '연애 가능성을 열어두고 사람을 알아가고 싶어요.', sort_order: 2 }];
const PROFILE_ROW = { purpose_id: 'romantic', purpose_label: '연애로 이어질 만남을 원해요', nickname: null, bio: null, region: null, life_rhythm: null };
const profileRows = [PROFILE_ROW];
const db = { records: [], insights: [], seen: new Map(), calls: [], followupStale: MODE === 'talk' ? 1 : 0, selfFail: MODE === 'explain' ? 1 : 0, aiRuns: 0, replays: 0 };
let seq = 0; const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const CANDS = ['처음 만날 때 조용한 장소를 편안하게 느낀다', '차분한 성향의 상대를 원한다'];
function understanding(body) {
  const a = body.action; db.calls.push({ action: a, requestId: body.requestId ?? null, limit: body.limit ?? null });
  const fail = (code, status) => ({ status, body: { ok: false, code, error: `모의:${code}` } });
  const ok = (o) => ({ status: 200, body: { ok: true, ...o } });
  if (a === 'record_list') return ok({ records: [...db.records].reverse() });
  if (a === 'insight_list') return ok({ insights: [...db.insights].reverse() });
  if (a === 'followup_get') return ok({ question: null });
  if (!body.requestId) return fail('BAD_REQUEST', 400);
  if (db.seen.has(body.requestId)) { db.replays += 1; return db.seen.get(body.requestId); }
  let out;
  if (a === 'record_create') { const r = { id: uuid(), user_id: UID, text: body.text, original_text: body.originalText, emotion: '', status: 'confirmed', revision: 1, created_at: new Date().toISOString() }; db.records.push(r); out = ok({ record: r, duplicate: false }); }
  else if (a === 'insight_generate') {
    const rec = db.records.find((r) => r.id === body.recordId); if (!rec) return fail('FORBIDDEN', 403);
    if (db.insights.some((i) => i.source_record_id === rec.id && i.status === 'candidate')) return fail('PENDING_INSIGHTS', 409);
    db.aiRuns += 1;
    if (db.records.indexOf(rec) === 0) {
      const lim = Number.isInteger(body.limit) && body.limit >= 1 && body.limit <= 3 ? body.limit : null;
      const all = CANDS.map((t) => ({ id: uuid(), user_id: UID, category: 'value', text: t, ai_text: t, source_record_id: rec.id, source_text: rec.text, status: 'candidate', origin: 'ai', revision: 1, created_at: new Date().toISOString() }));
      const rows = lim !== null && all.length > lim ? all.slice(0, lim) : all;
      db.insights.push(...rows); out = ok({ insights: rows, duplicate: false, trace: { attempts: 1, generated: 2, survived: 2, ...(lim !== null && all.length > lim ? { dropped_by_limit: all.length - lim } : {}) } });
    } else out = ok({ insights: [], rescued: true, rescue: { kind: 'quoted_question', text: '방금 남긴 기록에서 "주말에 한 번" 부분을 조금 더 들려주실 수 있을까요?' }, trace: { attempts: 3, generated: 0, survived: 0 } });
  } else if (a === 'insight_confirm' || a === 'insight_correct' || a === 'insight_reject') {
    const i = db.insights.find((x) => x.id === body.id); if (!i) return fail('FORBIDDEN', 403);
    if (i.revision !== body.expectedRevision) return fail('STALE_REVISION', 409);
    if (i.status !== 'candidate') return fail('INVALID_STATE', 409);
    i.status = a === 'insight_confirm' ? 'confirmed' : a === 'insight_reject' ? 'rejected' : 'corrected'; if (a === 'insight_correct') i.text = body.text; i.revision += 1; out = ok({ insight: { ...i }, duplicate: false });
  } else if (a === 'insight_self') {
    const rec = db.records.find((r) => r.id === body.recordId); if (!rec) return fail('FORBIDDEN', 403);
    if (db.selfFail > 0) { db.selfFail -= 1; return fail('ERROR', 500); }
    const row = { id: uuid(), user_id: UID, category: body.category, text: body.text, ai_text: null, source_record_id: rec.id, source_text: rec.text, status: 'confirmed', origin: 'self', revision: 1, created_at: new Date().toISOString() }; db.insights.push(row); out = ok({ insight: row, duplicate: false });
  } else if (a === 'followup_generate') {
    const rec = db.records.find((r) => r.id === body.recordId); if (!rec) return fail('FORBIDDEN', 403);
    if (db.insights.some((i) => i.source_record_id === rec.id && i.status === 'candidate')) return fail('PENDING_INSIGHTS', 409);
    if (db.followupStale > 0) { db.followupStale -= 1; return fail('STALE_CONTEXT', 409); }
    db.aiRuns += 1; out = ok({ question: { text: '조용한 첫 만남이라면 어떤 장소가 편하세요?', sourceRecordId: rec.id }, duplicate: false });
  } else return fail('BAD_REQUEST', 400);
  db.seen.set(body.requestId, out); return out;
}

const dir = mkdtempSync(join(tmpdir(), 'core-'));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-proxy-server', '--disable-dev-shm-usage', `--user-data-dir=${dir}`, `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let wsUrl = null; chrome.stderr.on('data', (d) => { const m = String(d).match(/ws:\/\/[^\s]+/); if (m && !wsUrl) wsUrl = m[0]; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 200 && !wsUrl; i++) await sleep(100);
const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
let id = 0; const pend = new Map(); const errors = []; let sid = null; const blocked = [];
ws.on('message', (raw) => { const m = JSON.parse(String(raw)); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; } if (m.method === 'Fetch.requestPaused') void paused(m.params); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.description ?? a.value).join(' ').slice(0, 160)); });
const send = (method, params = {}, s) => { const i = ++id; return new Promise((res) => { pend.set(i, (m) => res(m.result ?? m.error)); ws.send(JSON.stringify({ id: i, method, params, ...(s ? { sessionId: s } : {}) })); }); };
const json = (rid, code, body) => send('Fetch.fulfillRequest', { requestId: rid, responseCode: code, responseHeaders: [...CORS, { name: 'content-type', value: 'application/json; charset=utf-8' }], body: b64(JSON.stringify(body)) }, sid);
async function paused(p) {
  const u = p.request.url, m = p.request.method;
  if (u.startsWith(BASE)) return send('Fetch.continueRequest', { requestId: p.requestId }, sid);
  if (m === 'OPTIONS') return send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 204, responseHeaders: CORS, body: b64('') }, sid);
  if (u.includes('/functions/v1/doit-understanding')) { let body = {}; try { body = JSON.parse(p.request.postData ?? '{}'); } catch { /* */ } const r = understanding(body); return json(p.requestId, r.status, r.body); }
  if (u.includes('/rest/v1/purposes')) return json(p.requestId, 200, PURPOSES);
  if (u.includes('/rest/v1/profiles')) { if (m === 'GET') return json(p.requestId, 200, profileRows); if (m === 'PATCH') return json(p.requestId, 200, [{ id: UID }]); return json(p.requestId, 201, []); }
  if (u.includes('/rest/v1/profile_photos')) return json(p.requestId, 200, []);
  if (u.includes('supabase.co') || u.includes('openai.com')) { blocked.push(m + ' ' + u.slice(0, 70)); return json(p.requestId, 200, {}); }
  return json(p.requestId, 200, {});
}
await new Promise((r) => ws.on('open', r));
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
sid = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
await send('Page.enable', {}, sid); await send('Runtime.enable', {}, sid);
const session = { access_token: 'local-mock', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'local-mock-r', user: { id: UID, aud: 'authenticated', role: 'authenticated', email: 'local-mock@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(JSON.stringify(session))})}catch(e){}` }, sid);
await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, sid);
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sid)).result?.value;
const go = async (path, ms = 5000) => { await send('Page.navigate', { url: BASE + path }, sid); await sleep(ms); };
const state = async () => JSON.parse(await ev(`JSON.stringify({path: location.pathname + location.search, text: document.body.innerText.slice(0, 900), btn: Array.from(document.querySelectorAll('button,a.echo-primary,a.echo-secondary')).map(b=>({t:(b.innerText||b.getAttribute('aria-label')||'').trim().slice(0,30),d:!!b.disabled}))})`));
const ops = { taps: 0, texts: 0 };
const click = async (label) => { ops.taps += 1; return ev(`(()=>{const bs=Array.from(document.querySelectorAll('button,a'));const b=bs.find(x=>(x.innerText||'').trim().startsWith(${JSON.stringify(label)})||x.getAttribute('aria-label')===${JSON.stringify(label)});if(!b)return 'NOT_FOUND';if(b.disabled)return 'DISABLED';b.click();return 'CLICKED';})()`); };
const typeInto = async (sel, v) => { ops.texts += 1; return ev(`(()=>{const t=document.querySelector(${JSON.stringify(sel)});if(!t)return 'NO_INPUT';const s=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;s.call(t,${JSON.stringify(v)});t.dispatchEvent(new Event('input',{bubbles:true}));return 'TYPED';})()`); };
const valueOf = async (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})||{}).value ?? null`);
const R = []; let pass = 0, fail = 0;
const check = (n, ok, d = '') => { if (ok) { pass++; R.push('PASS  ' + n); } else { fail++; R.push('FAIL  ' + n + '  ' + d); } };
const T = (s) => s.text.replace(/\n/g, ' / ').slice(0, 200);
const actions = () => db.calls.map((c) => c.action).join(',');

if (MODE === 'talk') {
  await go('/doit/start-journey'); let s = await state();
  check('진입: 목적 있음+프로필 없음 → 선택 화면(대화 / 먼저 프로필)', s.text.includes('대화로 내 소개 정리하기') && s.text.includes('먼저 프로필 만들기'), T(s));
  await click('대화로 내 소개 정리하기'); await sleep(4000); s = await state();
  check('선택 → /doit/conversation?from=journey 대화 화면', s.path.startsWith('/doit/conversation') && s.text.includes('내 말로 시작하는 대화'), `${s.path} | ${T(s)}`);
  check('진입 시 서버 쓰기·AI 호출 0', !db.calls.some((c) => c.action !== 'record_list' && c.action !== 'insight_list' && c.action !== 'followup_get'), actions());
  await typeInto('#echo-message', '처음 만날 때는 조용한 곳이 좋아요. 주말에 한 번 만나는 게 편해요'); await sleep(200);
  await click('이야기 보내기'); await sleep(3000); s = await state();
  check('이야기 저장 → 후보(한 번에 1개) 표시 + 4버튼', s.text.includes('아직 확인하지 않은 AI의 이해') && ['맞아요', '조금 달라요', '그게 아니에요', '직접 설명할게요'].every((l) => s.btn.some((b) => b.t === l)), T(s));
  check('후보 대기 중 입력창 잠김', s.btn.some((b) => b.t === '이야기 보내기' && b.d), JSON.stringify(s.btn.filter((b) => b.t === '이야기 보내기')));
  check('서버 호출: record_create → insight_generate', actions().includes('record_create,insight_generate'), actions());
  await click('맞아요'); await sleep(2500); s = await state();
  check('맞아요 → 다음 후보 표시(차분한 성향…)', s.text.includes(CANDS[1]), T(s));
  check('후보 남아 있는 동안 followup_generate 호출 없음', !db.calls.some((c) => c.action === 'followup_generate'));
  await click('그게 아니에요'); await sleep(2500); s = await state();
  const rej = db.insights.find((i) => i.text === CANDS[1]);
  check('그게 아니에요 → rejected 저장·ai_text 보존', rej?.status === 'rejected' && rej?.ai_text === CANDS[1], JSON.stringify(rej));
  check('후보 전부 처리 → "이어서 이야기하기" 버튼', s.btn.some((b) => b.t.startsWith('이어서 이야기하기') && !b.d), JSON.stringify(s.btn));
  await click('이어서 이야기하기'); await sleep(3500); s = await state();
  const fu = db.calls.filter((c) => c.action === 'followup_generate');
  check('STALE_CONTEXT 1회 → 새 requestId 로 자동 1회 재시도', fu.length === 2 && fu[0].requestId !== fu[1].requestId, JSON.stringify(fu));
  check('다음 질문(서버 생성) 표시', s.text.includes('조용한 첫 만남이라면'), T(s));
  check('거절한 해석 문장이 화면에 없음', !s.text.includes(CANDS[1]), T(s));
  await typeInto('#echo-message', '모르겠어요'); await sleep(200); await click('이야기 보내기'); await sleep(3000); s = await state();
  check('"모르겠어요" → 기록 2건 저장 + 구제 질문 표시(후보 0, 지어내지 않음)', db.records.length === 2 && s.text.includes('주말에 한 번') && !db.insights.some((i) => i.source_record_id === db.records[1].id), T(s));
  await click('내 소개와 사진 준비하기'); await sleep(3000); s = await state();
  check('프로필 준비 → start-journey?edit=profile → 프로필 입력', s.path.includes('/doit/start-journey') && s.text.includes('닉네임'), `${s.path} | ${T(s)}`);
}

if (MODE === 'explain') {
  const EXPLAIN = '사람은 활발해도 좋아요. 장소만 조용했으면 해요';
  await go('/doit/conversation'); await typeInto('#echo-message', '처음 만날 때는 조용한 곳이 좋아요'); await sleep(200); await click('이야기 보내기'); await sleep(3000);
  await click('직접 설명할게요'); await sleep(500); let s = await state();
  check('직접 설명 입력 상자 열림', s.text.includes('내 말로 설명해 주세요'), T(s));
  await typeInto('#echo-correction', EXPLAIN); await sleep(200); await click('이 설명으로 저장하기'); await sleep(3000); s = await state();
  const cand = db.insights.find((i) => i.text === CANDS[0]);
  check('거절 성공(rejected) + 설명 저장 1회 실패 → 오류 안내, 입력 유지', cand?.status === 'rejected' && s.text.includes('다시 시도') && (await valueOf('#echo-correction')) === EXPLAIN, T(s));
  check('실패 시 self 행 0', !db.insights.some((i) => i.origin === 'self'));
  const pendingRaw = await ev(`sessionStorage.getItem('doit:conversation:pending-self:${UID}')`);
  check('설명이 이 기기 세션에 예약됨(pendingSelf)', typeof pendingRaw === 'string' && pendingRaw.includes(EXPLAIN));
  await go('/doit/conversation'); s = await state();
  check('새로고침 → 입력 상자가 예약된 설명으로 다시 열림 + "이전 AI 해석은 제외했어요"', (await valueOf('#echo-correction')) === EXPLAIN && s.text.includes('이전 AI 해석은 제외했어요'), T(s));
  check('새로고침 시 자동 저장·AI 호출 없음', db.calls.filter((c) => c.action === 'insight_self').length === 1 && db.aiRuns === 1, actions());
  await click('이 설명으로 저장하기'); await sleep(3000); s = await state();
  const selfRows = db.insights.filter((i) => i.origin === 'self'); const selfCalls = db.calls.filter((c) => c.action === 'insight_self');
  check('저장 → self 행 1(confirmed, origin=self)', selfRows.length === 1 && selfRows[0].status === 'confirmed' && selfRows[0].text === EXPLAIN, JSON.stringify(selfRows));
  check('재시도는 같은 requestId · 후보 재거절 0', selfCalls.length === 2 && selfCalls[0].requestId === selfCalls[1].requestId && db.calls.filter((c) => c.action === 'insight_reject').length === 1, JSON.stringify(selfCalls));
  check('예약 해제', (await ev(`sessionStorage.getItem('doit:conversation:pending-self:${UID}')`)) === null);
  check('"직접 설명해 주신 내용으로 저장했어요" 안내', s.text.includes('직접 설명해 주신 내용으로 저장했어요'), T(s));
}

if (MODE === 'resume') {
  const r1 = { id: uuid(), user_id: UID, text: '조용한 곳이 좋아요', original_text: '조용한 곳이 좋아요', emotion: '', status: 'confirmed', revision: 1, created_at: new Date().toISOString() }; db.records.push(r1);
  db.insights.push(...CANDS.map((t) => ({ id: uuid(), user_id: UID, category: 'value', text: t, ai_text: t, source_record_id: r1.id, source_text: r1.text, status: 'candidate', origin: 'ai', revision: 1, created_at: new Date().toISOString() })));
  await go('/doit/conversation'); const s = await state();
  check('서버에만 기록+후보 → 후보 표시(원문 함께)', s.text.includes('아직 확인하지 않은 AI의 이해') && s.text.includes('조용한 곳이 좋아요'), T(s));
  check('복원 시 AI 재호출·기록 생성 0', db.aiRuns === 0 && !db.calls.some((c) => c.action === 'record_create'), actions());
}

if (MODE === 'limit') {
  await go('/doit/conversation'); await typeInto('#echo-message', '처음 만날 때는 조용한 곳이 좋아요'); await sleep(200); await click('이야기 보내기'); await sleep(3000); let s = await state();
  const g1 = db.calls.find((c) => c.action === 'insight_generate');
  check('첫 이야기 → limit:1 전달', g1?.limit === 1, JSON.stringify(g1));
  check('서버가 1개만 저장·반환', db.insights.filter((i) => i.status === 'candidate').length === 1 && s.text.includes(CANDS[0]) && !s.text.includes(CANDS[1]), T(s));
  await click('맞아요'); await sleep(2500); await typeInto('#echo-message', '주말이 편해요'); await sleep(200); await click('이야기 보내기'); await sleep(3000);
  const g2 = db.calls.filter((c) => c.action === 'insight_generate')[1];
  check('두 번째 이야기 → limit:3 전달, 후보 0(구제) 허용', g2?.limit === 3 && !db.insights.some((i) => i.source_record_id === db.records[1].id), JSON.stringify(g2));
}

check(`[${MODE}] 콘솔 오류 0`, errors.length === 0, JSON.stringify(errors.slice(0, 3)));
check(`[${MODE}] 실제 OpenAI/그 외 Supabase 호출 0`, blocked.length === 0, JSON.stringify(blocked.slice(0, 3)));
console.log(R.join('\n'));
console.log(`=== [${MODE}] PASS ${pass} / FAIL ${fail} === ops: taps ${ops.taps} texts ${ops.texts} | ai_runs ${db.aiRuns} replays ${db.replays} | calls: ${actions()}`);
ws.close(); chrome.kill(); http.close(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
process.exit(fail ? 1 : 0);
