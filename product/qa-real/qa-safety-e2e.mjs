// 2026-10-02 대표 「QA 마감 v1.1」 §7 — 실제 QA 서버 · 실제 사용자 권한 · 여러 계정 안전 쓰기 검사(doit-connect v2.1).
// QA 전용(mutniujeiyujhkobadkd) · 공개 키만 · 관리자 권한 0 · 운영 0 · 계정 삭제 0.
// 계정은 이번 실행 ID 로 구분한 시험 계정만 만들고(qa-safety-<run>-<tag>@do-it.company), 목적은 아무도 쓰지 않는 'slow' 로 둬서
// 다른 시험 계정과 섞이지 않게 한다. 끝나면 이 계정들의 목적을 비워 다음 실행의 후보 풀에 남지 않게 한다(자료·신고·차단 기록은 그대로).
// 실행: SB_KEY=<QA 공개 키> node qa-real/qa-safety-e2e.mjs
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const SB = 'https://mutniujeiyujhkobadkd.supabase.co';
const KEY = process.env.SB_KEY;
if (!KEY) throw new Error('SB_KEY missing');
const RUN = `${Date.now().toString(36)}`;
const PURPOSE = { id: 'slow', label: '사람을 천천히 알아가기', goal: 'conversation' };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); return !!ok; };
const STOP = (why) => { const f = results.filter((r) => !r.ok).length; console.log(`STOP ${why}\nQA SAFETY E2E: ${results.length - f} PASS / ${f} FAIL (STOPPED) · run=${RUN}`); process.exit(1); };

const http = async (path, { method = 'GET', jwt = null, body = null, raw = null, headers = {} } = {}) => {
  const r = await fetch(`${SB}${path}`, { method, headers: { apikey: KEY, Authorization: `Bearer ${jwt ?? KEY}`, ...(raw ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t.slice(0, 200); }
  return { status: r.status, data };
};
const fn = (name, jwt, body) => http(`/functions/v1/${name}`, { method: 'POST', jwt, body });
const connect = (u, body) => fn('doit-connect', u.jwt, body);

const JPEG = readFileSync(new URL('../brand-src/echo-app-icon-original-20260925.jpg', import.meta.url));
const ANSWERS = ['처음엔 카페에서 한두 시간 편하게 이야기하고 싶어요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '약속 시간을 잘 지키는 건 중요해요', '연락은 이틀에 한 번 정도면 편해요', '갑자기 잠수하는 건 피하고 싶어요', '전시나 산책처럼 같이 이야기할 거리가 있으면 좋아요', '처음부터 너무 가까워지기보다 천천히 알아가고 싶어요', '오늘은 여기까지 할게요'];

async function login(email, password) {
  const tok = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  return { jwt: tok.data?.access_token, uid: tok.data?.user?.id, refresh: tok.data?.refresh_token };
}
async function account(tag, eligible = true) {
  const email = `qa-safety-${RUN}-${tag}@do-it.company`; const password = `Qa!${randomUUID()}aA1`;
  const su = await http('/auth/v1/signup', { method: 'POST', body: { email, password } });
  if (!check(`${tag}: QA 가입`, [200, 201].includes(su.status), `status=${su.status}`)) STOP('signup');
  let { jwt, uid, refresh } = await login(email, password);
  if (!check(`${tag}: 로그인`, !!jwt, '')) STOP('login');
  const u = { tag, email, password, jwt, uid };
  if (!eligible) return u;
  const now = new Date().toISOString();
  await http('/auth/v1/user', { method: 'PUT', jwt, body: { data: { doit_round_started_at: now, doit_connect_consent_version: 'connect-v1', doit_connect_consent_at: now } } });
  u.jwt = (await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refresh } })).data?.access_token ?? jwt;
  const pr = await http(`/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', jwt: u.jwt, body: { purpose_id: PURPOSE.id, purpose_label: PURPOSE.label, consent_version: 'v1.0', bio: `QA SAFETY ${tag} — 천천히 알아갈 사람을 찾고 있어요.` }, headers: { Prefer: 'return=minimal' } });
  if (!check(`${tag}: 목적·소개`, pr.status === 204, `status=${pr.status}`)) STOP('profile');
  for (const slot of [1, 2, 3]) {
    const path = `${uid}/${slot}/${randomUUID()}.jpg`;
    const up = await http(`/storage/v1/object/profile-photos/${path}`, { method: 'POST', jwt: u.jwt, raw: Buffer.concat([JPEG, Buffer.from(`\nQA-SAFETY-${RUN}-${tag}-${slot}\n`)]), headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' } });
    const row = await http('/rest/v1/profile_photos?on_conflict=user_id,slot', { method: 'POST', jwt: u.jwt, body: { user_id: uid, slot, storage_path: path, is_primary: slot === 1, updated_at: new Date().toISOString() }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
    if (!check(`${tag}: 사진 ${slot}`, [200, 201].includes(up.status) && [200, 201, 204].includes(row.status), `${up.status}/${row.status}`)) STOP('photo');
  }
  const st = await fn('doit-agent', u.jwt, { action: 'agent_start', requestId: randomUUID(), tone: 'polite', mode: 'TEXT', goal: PURPOSE.goal, goalLabel: PURPOSE.label, firstAnswer: PURPOSE.label });
  let s = st.data?.session;
  for (const text of ANSWERS) { if (!s || s.phase === 'done') break; const r = await fn('doit-agent', u.jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId: s.id, text }); s = r.data?.session ?? s; }
  if (!check(`${tag}: Agent 대화 완료(실제 AI)`, s?.phase === 'done', `phase=${s?.phase}`)) STOP('agent');
  return u;
}
const list = async (u) => { const r = await connect(u, { action: 'my_candidates' }); return { status: r.status, eligible: r.data?.eligible, ids: (r.data?.candidates ?? []).map((c) => c.id) }; };
const myReports = async (u) => (await http(`/rest/v1/user_reports?select=id,target_user_id,reason,detail,status&reporter_id=eq.${u.uid}`, { jwt: u.jwt })).data ?? [];
const myBlocks = async (u) => (await http(`/rest/v1/blocks?select=blocked_user_id,reason&blocker_id=eq.${u.uid}`, { jwt: u.jwt })).data ?? [];

const people = [];
for (const tag of ['a', 'b', 'c', 'd', 'e']) people.push(await account(tag));
const X = await account('x', false); // 비참가자(자격 없음)
console.log(`run=${RUN} accounts=${people.map((p) => p.tag).join(',')}+x`);

// 쓸 수 있는 쌍(두 사람에게 모두 보이는 같은 후보)을 실제 서버 응답으로 찾는다 — 쌍을 지어내지 않는다.
const used = new Set();
async function pairs() {
  const lists = new Map();
  for (const p of people) { const l = await list(p); if (!check(`${p.tag}: 후보 조회 200 · 자격`, l.status === 200 && l.eligible === true, `status=${l.status}`)) STOP('list'); lists.set(p.tag, l.ids); }
  const out = [];
  for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
    const shared = lists.get(people[i].tag).filter((id) => lists.get(people[j].tag).includes(id) && !used.has(id));
    for (const id of shared) out.push({ id, x: people[i], y: people[j] });
  }
  return out;
}
async function take() { for (let round = 0; round < 3; round++) { const p = (await pairs()).find((q) => !used.has(q.id) && !blockedTags.has(`${q.x.tag}${q.y.tag}`)); if (p) { used.add(p.id); return p; } } STOP('no pair'); }
const blockedTags = new Set();
const noLongerPaired = async (x, y, id, label) => {
  const lx = await list(x), ly = await list(y);
  const sharedAgain = lx.ids.filter((k) => ly.ids.includes(k));
  check(`${label}: 양쪽 목록에서 사라짐 · 다시 짝지어지지 않음`, !lx.ids.includes(id) && !ly.ids.includes(id) && sharedAgain.filter((k) => !used.has(k)).length === 0, `x=${lx.ids.length} y=${ly.ids.length} 공통=${sharedAgain.length}`);
};

// ① 숨기기만(차단·신고 0)
{
  const { id, x, y } = await take();
  const r = await connect(x, { action: 'choose', candidateId: id, choice: 'hide' });
  check('① 숨기기 = 200 declined · 차단 0 · 신고 0', r.status === 200 && r.data?.status === 'declined' && r.data?.blocked === false && r.data?.reported === false, JSON.stringify(r.data));
  check('① 숨긴 뒤 상대가 이어지고 싶어요 = 409(연결 0)', (await connect(y, { action: 'choose', candidateId: id, choice: 'yes' })).status === 409);
  await noLongerPaired(x, y, id, '①');
  check('① 숨기기는 신고·차단 기록 0', (await myReports(x)).length === 0 && (await myBlocks(x)).length === 0);
  blockedTags.add(`${x.tag}${y.tag}`);
}
// ② 차단만(사유 없음 · 한 번에)
let blockedPair;
{
  const { id, x, y } = await take();
  const r = await connect(x, { action: 'choose', candidateId: id, choice: 'hide', block: true });
  check('② 차단 = 200 · blocked=true · reported=false', r.status === 200 && r.data?.blocked === true && r.data?.reported === false, JSON.stringify(r.data));
  check('② 차단 기록 실제 저장(본인 권한으로 다시 읽음)', (await myBlocks(x)).some((b) => b.blocked_user_id === y.uid && b.reason === 'candidate'));
  check('② 차단만 하면 신고 0', !(await myReports(x)).some((p) => p.target_user_id === y.uid));
  blockedPair = { x, y }; blockedTags.add(`${x.tag}${y.tag}`);
}
// ③ 신고(+ 재시도 · 다른 사유 · 두 탭 동시)
{
  const { id, x, y } = await take();
  const r = await connect(x, { action: 'choose', candidateId: id, choice: 'hide', block: true, reason: 'spam' });
  check('③ 신고 = 200 · reported=true · blocked=true', r.status === 200 && r.data?.reported === true && r.data?.blocked === true, JSON.stringify(r.data));
  const again = await connect(x, { action: 'choose', candidateId: id, choice: 'hide', block: true, reason: 'spam' });
  check('③ 같은 신고 재시도(네트워크 재시도) = 200 · 중복 0', again.status === 200 && (await myReports(x)).filter((p) => p.target_user_id === y.uid).length === 1, `status=${again.status}`);
  const other = await connect(x, { action: 'choose', candidateId: id, choice: 'hide', reason: 'fake' });
  const mine = (await myReports(x)).filter((p) => p.target_user_id === y.uid);
  check('③ 다른 사유(추가 증거)는 따로 남음', other.status === 200 && mine.length === 2 && mine.some((p) => p.reason === 'candidate:spam 스팸') && mine.some((p) => p.reason === 'candidate:fake 허위 정보'), mine.map((p) => p.reason).join(' / '));
  check('③ 신고 원문 자유 글 저장 0 · 접수 상태 open', mine.every((p) => p.detail === null && p.status === 'open'));
  const [t1, t2] = await Promise.all([connect(x, { action: 'choose', candidateId: id, choice: 'hide', reason: 'threat' }), connect(x, { action: 'choose', candidateId: id, choice: 'hide', reason: 'threat' })]);
  const threat = (await myReports(x)).filter((p) => p.target_user_id === y.uid && p.reason.startsWith('candidate:threat')).length;
  check('③ 두 탭 동시 같은 신고 = 1건', t1.status === 200 && t2.status === 200 && threat === 1, `저장 ${threat}건`);
  check('③ 신고당한 사람은 신고 기록을 읽지 못함', (await http(`/rest/v1/user_reports?select=id&target_user_id=eq.${y.uid}`, { jwt: y.jwt })).data?.length === 0);
  blockedTags.add(`${x.tag}${y.tag}`);
}
// ④ 서로 고름 → 연결 → 공개 → 이야기 → 차단·신고(그만하기)
let matchId, mx, my;
{
  const { id, x, y } = await take();
  await connect(x, { action: 'choose', candidateId: id, choice: 'yes' });
  const m = await connect(y, { action: 'choose', candidateId: id, choice: 'yes' });
  if (!check('④ 둘 다 이어지고 싶어요 = mutual · match_id', m.status === 200 && m.data?.status === 'mutual' && !!m.data?.match_id, JSON.stringify(m.data))) STOP('mutual');
  matchId = m.data.match_id; mx = x; my = y;
  await connect(x, { action: 'answer', matchId, text: '저는 주말 오전 산책이 제일 편해요' });
  await connect(y, { action: 'answer', matchId, text: '저녁에 조용한 카페에 있을 때요' });
  const seen = (await connect(x, { action: 'my_matches' })).data?.matches?.find((k) => k.id === matchId);
  check('④ 둘 다 답한 뒤 공개(revealed)', seen?.revealed === true && !!seen?.partner);
  check('④ 이야기 보내기', (await connect(x, { action: 'message', matchId, text: '안녕하세요, 반가워요' })).status === 200);
  const lv = await connect(y, { action: 'leave', matchId, block: true, report: true, reason: 'unpleasant' });
  check('④ 연결 신고+차단 = 200 · reported · blocked', lv.status === 200 && lv.data?.reported === true && lv.data?.blocked === true, JSON.stringify(lv.data));
  check('④ 신고 저장(connection:unpleasant)', (await myReports(y)).some((p) => p.target_user_id === x.uid && p.reason === 'connection:unpleasant 불쾌한 대화'));
  const afterX = (await connect(x, { action: 'my_matches' })).data?.matches?.find((k) => k.id === matchId);
  check('④ 차단 뒤 상대 화면: 끝난 연결 · 이름·사진·이야기 0', afterX?.status === 'closed' && !afterX?.partner && !afterX?.messages, JSON.stringify(afterX ?? {}).slice(0, 120));
  const msg = await connect(x, { action: 'message', matchId, text: '왜 나가셨어요?' });
  check('④ 차단 뒤 새 메시지 거부', msg.status >= 400, `status=${msg.status}`);
  const ans = await connect(x, { action: 'answer', matchId, text: '다시 답할게요' });
  check('④ 차단 뒤 추가 답(공개) 거부', ans.status >= 400, `status=${ans.status}`);
  blockedTags.add(`${x.tag}${y.tag}`);
}
// ⑤ 차단과 이어지고 싶어요가 동시에
{
  const { id, x, y } = await take();
  const [yes, block] = await Promise.all([connect(x, { action: 'choose', candidateId: id, choice: 'yes' }), connect(y, { action: 'choose', candidateId: id, choice: 'hide', block: true })]);
  const mx2 = (await connect(x, { action: 'my_matches' })).data?.matches ?? [];
  const opened = mx2.some((k) => k.status === 'open' && !k.revealed && k.id && k.id !== matchId);
  check('⑤ 동시 요청: 차단 성공 · 열린 연결 0', block.status === 200 && block.data?.blocked === true && !opened, `yes=${yes.status}/${yes.data?.status} block=${block.status}`);
  blockedTags.add(`${x.tag}${y.tag}`);
}
// ⑥ 다시 로그인(새로고침·재접속)해도 차단·신고·끝남 상태 그대로 · 차단한 사이 다시 짝 0
{
  const re = await login(blockedPair.x.email, blockedPair.x.password); blockedPair.x.jwt = re.jwt;
  const l1 = await list(blockedPair.x), l2 = await list(blockedPair.y);
  check('⑥ 재접속 뒤 차단 유지 · 차단한 사이 공통 후보 0', l1.ids.filter((k) => l2.ids.includes(k) && !used.has(k)).length === 0 && (await myBlocks(blockedPair.x)).some((b) => b.blocked_user_id === blockedPair.y.uid));
  const re2 = await login(mx.email, mx.password); mx.jwt = re2.jwt;
  const again = (await connect(mx, { action: 'my_matches' })).data?.matches?.find((k) => k.id === matchId);
  check('⑥ 재접속 뒤에도 끝난 연결은 상대 정보 0', again?.status === 'closed' && !again?.partner);
}
// ⑦ 비참가자 X: 남의 연결·대화·신고·후보에 접근 0
{
  check('⑦ X: 남의 연결 이야기 보내기 = 404', (await connect(X, { action: 'message', matchId, text: '끼어들기' })).status === 404);
  check('⑦ X: 남의 연결 그만하기·신고 = 404', (await connect(X, { action: 'leave', matchId, block: true, reason: 'spam' })).status === 404);
  check('⑦ X: 남의 후보 고르기 = 404', (await connect(X, { action: 'choose', candidateId: [...used][0], choice: 'hide', block: true })).status === 404);
  check('⑦ X: 내 연결 목록에 남의 연결 0', ((await connect(X, { action: 'my_matches' })).data?.matches ?? []).length === 0);
  const rest = await Promise.all(['user_reports', 'blocks', 'doit_matches', 'doit_match_messages', 'doit_match_answers', 'doit_match_candidates'].map(async (t) => [t, (await http(`/rest/v1/${t}?select=*&limit=5`, { jwt: X.jwt }))]));
  check('⑦ X: 표 직접 읽기(신고·차단·연결·이야기·답·후보) 0줄', rest.every(([, r]) => r.status !== 200 || (Array.isArray(r.data) && r.data.length === 0)), rest.map(([t, r]) => `${t}:${r.status}/${Array.isArray(r.data) ? r.data.length : '-'}`).join(' '));
  check('⑦ X: 관리자 동작 = 403', (await connect(X, { action: 'admin_matches' })).status === 403);
  const aw = await fn('admin-web', X.jwt, { action: 'overview', period: 'today' });
  check('⑦ X: 관리자 웹 자료 = 403 · 자료 0', aw.status === 403 && !aw.data?.users, `status=${aw.status}`);
  const aws = await fn('admin-web', X.jwt, { action: 'safety' });
  check('⑦ X: 관리자 신고 목록 = 403', aws.status === 403 && !aws.data?.reports, `status=${aws.status}`);
  // 일반 사용자가 스스로 관리자가 되려 해도(자기 profiles.role 수정) 서버·DB 가 막는지 — 결과를 다시 읽어 확인
  const up = await http(`/rest/v1/profiles?id=eq.${X.uid}`, { method: 'PATCH', jwt: X.jwt, body: { role: 'admin' }, headers: { Prefer: 'return=minimal' } });
  const role = (await http(`/rest/v1/profiles?select=role&id=eq.${X.uid}`, { jwt: X.jwt })).data?.[0]?.role ?? null;
  check('⑦ X: 자기 role 승격 시도 = 반영 0', role !== 'admin', `patch=${up.status} role=${role}`);
  if (role === 'admin') { await http(`/rest/v1/profiles?id=eq.${X.uid}`, { method: 'PATCH', jwt: X.jwt, body: { role: 'user' }, headers: { Prefer: 'return=minimal' } }); console.log('SECURITY: role 승격 가능 — 즉시 되돌림 시도'); }
  check('⑦ X: 승격 시도 뒤에도 관리자 웹 = 403', (await fn('admin-web', X.jwt, { action: 'overview', period: 'today' })).status === 403);
}
// 정리: 이번 실행 계정의 목적을 비워 다음 실행 후보 풀에서 뺀다(삭제 0 · 기록 보존).
for (const p of people) await http(`/rest/v1/profiles?id=eq.${p.uid}`, { method: 'PATCH', jwt: p.jwt, body: { purpose_id: null, purpose_label: null }, headers: { Prefer: 'return=minimal' } });
const f = results.filter((r) => !r.ok).length;
console.log(`QA SAFETY E2E: ${results.length - f} PASS / ${f} FAIL · run=${RUN} · users=${people.map((p) => p.uid.slice(0, 8)).join(',')} x=${X.uid.slice(0, 8)}`);
process.exit(f ? 1 : 0);
