// ECHO-QA 실제 AI 검사(2026-09-28 대표 「CONVERSATION QUALITY + PURPOSE ISOLATION + SESSION SAFETY」 §18·§22) — QA 프로젝트 전용 · 비밀값 출력 0.
// friend 20 · romantic 20 · colleague 20 · 같은 계정 두 세션(friend+romantic 동시) 20. 모든 대화는 배포된 doit-agent(실제 AI)로.
// 판정은 사용자에게 보인 것(세션 목적·턴 종류·저장 여부)과 화면에 보인 글(질문·받아주기·정리·마무리·소개)만으로 한다. 사용자 역할 말은 시나리오별 고정 목록(사람 역할) — 질문은 AI 가 만든다.
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const { QA_REF, QA_ANON, QA_PW_SEED, N = '20', PREFIX = 'g', OUT } = process.env;
if (QA_REF !== 'mutniujeiyujhkobadkd' || !QA_ANON || !QA_PW_SEED) { console.error('QA 환경값 없음/불일치'); process.exit(2); }
const URL0 = `https://${QA_REF}.supabase.co`;
const pw = (run, tag) => `Qa!${createHash('sha256').update(`${QA_PW_SEED}:${run}:${tag}`).digest('base64url').slice(0, 24)}`;
async function http(path, { method = 'GET', jwt = null, body = null } = {}) {
  for (let a = 0; a < 3; a++) {
    const r = await fetch(`${URL0}${path}`, { method, headers: { apikey: QA_ANON, Authorization: `Bearer ${jwt ?? QA_ANON}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch { d = t.slice(0, 200); }
    if (r.status === 429 && a < 2) { await new Promise((ok) => setTimeout(ok, 8000)); continue; }
    return { status: r.status, data: d };
  }
}
const login = async (email, password) => (await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).data?.access_token ?? null;
const fn = (jwt, body) => http('/functions/v1/doit-agent', { method: 'POST', jwt, body: { requestId: randomUUID(), ...body } });

const ROMANCE = /연애|연인|애인|이상형|설레|설렘|호감|끌리|끌림|썸\s*타|데이트|결혼|교제|스킨십/;
const FRIEND_GOAL = /친구\s*(사이|관계)|친구를\s*(원|만나|찾|사귀)|친구로\s*(지내|만나)|친구\s*같은\s*사이/;
const RESIDUE = { friend: ROMANCE, colleague: ROMANCE, romantic: FRIEND_GOAL };
const COUNSEL = /그렇군요|힘드셨겠|들려주실 수 있을까요|중요하군요/;
const bare = (t) => String(t ?? '').normalize('NFKC').replace(/\s+/g, '').replace(/[.,!?~…·"'「」]/g, '');
const pairs = (t) => { const o = new Set(); for (let i = 0; i < t.length - 1; i++) o.add(t.slice(i, i + 2)); return o; };
const dice = (a, b) => { const A = pairs(a), B = pairs(b); if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return (2 * n) / (A.size + B.size); };
const GOAL_LABEL = { friend: '친구를 만나고 싶어요', romantic: '연애로 이어질 만남을 원해요', colleague: '함께 일할 사람을 찾고 있어요' };
const LINES = {
  friend: ['카페에서 얘기하는 게 좋아', '한 달에 두세 번 편하게 보는 정도가 좋아', '말이 잘 통하고 약속 잘 지키는 사람이면 좋겠어', '너무 자주 연락하는 건 좀 부담스러워', '주말 낮에 동네에서 보는 게 편해', '같이 산책하거나 전시 보는 것도 좋아'],
  romantic: ['다정하고 대화가 잘 통하는 사람한테 마음이 가요', '천천히 알아가면서 진지하게 만나고 싶어요', '연락은 하루에 한두 번이면 충분해요', '거짓말하지 않는 게 제일 중요해요', '주말에 같이 맛집 다니는 거 좋아해요', '표현을 잘 해주는 사람이면 좋겠어요'],
  colleague: ['사이드 프로젝트로 앱을 같이 만들 사람을 찾아요', '맡은 일은 끝까지 책임지는 사람이 좋아요', '의견이 다르면 바로 얘기하고 정리하는 편이에요', '저는 기획을 하고 개발을 맡아줄 사람이 필요해요', '주에 한 번은 온라인으로 회의하고 싶어요', '연락 없이 사라지는 건 피하고 싶어요'],
};
const SPECIAL = { correction: { friend: '연애 질문 아니야, 친구 얘기야', colleague: '연애 얘기 아니고 일 얘기예요', romantic: '친구 얘기 아니고 연애 얘기예요' }, unsure: '잘 모르겠어', repeat: '그 질문 전에 했잖아' };

async function converse(jwt, goal, run, special, extraOpening = '') {
  const first = `${GOAL_LABEL[goal]}${extraOpening}`;
  const st0 = await fn(jwt, { action: 'agent_start', tone: 'polite', mode: 'TEXT', goal, goalLabel: GOAL_LABEL[goal], firstAnswer: first });
  if (st0.status !== 200 || !st0.data?.session?.id) throw new Error(`start ${st0.status} ${st0.data?.code ?? ''}`);
  const sid = st0.data.session.id; const log = []; let sess = st0.data.session; let k = 0; const firstQ = sess.current_question;
  const lines = LINES[goal]; let turn = 0;
  while (sess.phase === 'talk' && turn < 8) {
    turn++;
    let text = lines[k % lines.length];
    if (special === 'correction' && turn === 1) text = SPECIAL.correction[goal];
    else if (special === 'unsure' && turn === 2) text = SPECIAL.unsure;
    else if (special === 'repeat' && turn === 3) text = SPECIAL.repeat;
    else k++;
    const before = sess.current_question;
    const r = await fn(jwt, { action: 'agent_turn', sessionId: sid, text });
    if (r.status !== 200) throw new Error(`turn ${r.status} ${r.data?.code ?? ''}`);
    sess = r.data.session; log.push({ q: before, user: text, kind: r.data.turn.kind, saved: r.data.turn.saved, reply: r.data.turn.reply, next: r.data.turn.question });
  }
  return { sid, log, sess, firstQ };
}

// 판정은 사용자에게 보인 것(질문·받아주기·정리·마무리·소개 · 세션 목적 · 턴 종류/저장 여부)만으로 한다(관리자 권한 0).
function judge(goal, sess, log, special, firstQ) {
  const asked = [firstQ, ...log.map((l) => l.next)].filter(Boolean);
  const shown = [...asked, ...log.map((l) => l.reply)].filter(Boolean);
  const residue = shown.filter((t) => RESIDUE[goal].test(t));
  const dup = []; for (let i = 0; i < asked.length; i++) for (let j = i + 1; j < asked.length; j++) if (dice(bare(asked[i]), bare(asked[j])) >= 0.55) dup.push([asked[i], asked[j]]);
  const summaryTexts = [...(sess.summary ?? []).map((x) => x.text), sess.closing ?? '', sess.intro?.text ?? ''];
  const summaryResidue = summaryTexts.filter((t) => t && RESIDUE[goal].test(t));
  const counsel = log.filter((l) => l.reply && COUNSEL.test(l.reply)).map((l) => l.reply);
  const emptyAck = log.filter((l) => l.kind === 'answer' && !l.reply).length;
  let correctionOk = null;
  if (special === 'correction') { const l = log.find((x) => x.user === SPECIAL.correction[goal]); correctionOk = !!l && l.kind === 'repair' && !l.saved && !!l.next && dice(bare(l.q), bare(l.next)) < 0.55 && !RESIDUE[goal].test(l.next) && !RESIDUE[goal].test(l.reply ?? ''); }
  let repeatOk = null;
  if (special === 'repeat') { const k = log.findIndex((x) => x.user === SPECIAL.repeat); const l = log[k]; repeatOk = !!l && l.kind === 'repair' && !l.saved && (!l.next || ![firstQ, ...log.slice(0, k).map((x) => x.next)].filter(Boolean).some((a) => dice(bare(a), bare(l.next)) >= 0.55)); }
  let unsureOk = null;
  if (special === 'unsure') { const l = log.find((x) => x.user === SPECIAL.unsure); unsureOk = !!l && !l.saved; }
  const linked = log.filter((l) => l.next && l.kind === 'answer').map((l) => [...pairs(bare(l.user))].some((p) => bare(l.next).includes(p) && !/[요어해]$/.test(p)));
  const fail = residue.length > 0 || dup.length > 0 || summaryResidue.length > 0 || counsel.length > 0 || sess.goal !== goal || sess.profile?.goal !== goal || correctionOk === false || repeatOk === false || unsureOk === false || sess.phase !== 'done';
  return { goal_saved: sess.goal, profile_goal: sess.profile?.goal ?? null, questions: sess.progress?.asked, finished: sess.phase === 'done', residue, dup, summary_residue: summaryResidue, counsel, empty_ack: emptyAck,
    correction_ok: correctionOk, repeat_ok: repeatOk, unsure_ok: unsureOk, linked: linked.length ? `${linked.filter(Boolean).length}/${linked.length}` : '0/0', fail, asked, replies: log.map((l) => l.reply), summary: summaryTexts.filter(Boolean), users: log.map((l) => l.user) };
}

async function signup(run) {
  const email = `qa-${run}-20260928@do-it.company`; const password = pw(run, 'user');
  const su = await http('/auth/v1/signup', { method: 'POST', body: { email, password, data: { nickname: `QA-${run}` } } });
  return su.data?.access_token ?? await login(email, password);
}
const specials = ['none', 'correction', 'unsure', 'repeat', 'none'];
async function single(goal, k) {
  const run = `${PREFIX}${goal[0]}${String(k).padStart(2, '0')}`; const jwt = await signup(run); if (!jwt) return { run, goal, error: 'signup' };
  const special = specials[k % specials.length];
  const { log, sess, firstQ } = await converse(jwt, goal, run, special);
  return { run, goal, special, ...judge(goal, sess, log, special, firstQ) };
}
async function dual(k) {
  const run = `${PREFIX}d${String(k).padStart(2, '0')}`; const jwt = await signup(run); if (!jwt) return { run, goal: 'dual', error: 'signup' };
  // 같은 계정 두 기기: 동시에 시작(친구 · 연애)
  const [A, B] = await Promise.all([converse(jwt, 'friend', run, 'none'), converse(jwt, 'romantic', run, 'none')]);
  // 각 기기가 다시 불러올 때도 자기 세션(기억한 id)만 받는다
  const [GA, GB] = await Promise.all([fn(jwt, { action: 'agent_get', sessionId: A.sid }), fn(jwt, { action: 'agent_get', sessionId: B.sid })]);
  const SA = GA.data?.session, SB = GB.data?.session;
  const ja = judge('friend', SA, A.log, 'none', A.firstQ), jb = judge('romantic', SB, B.log, 'none', B.firstQ);
  const aUser = SA.messages.filter((m) => m.role === 'user').map((m) => m.text).join('|'), bUser = SB.messages.filter((m) => m.role === 'user').map((m) => m.text).join('|');
  const cross = LINES.romantic.some((l) => aUser.includes(l)) || LINES.friend.some((l) => bUser.includes(l)) || A.sid === B.sid || SA.id !== A.sid || SB.id !== B.sid;
  const profCross = SA.profile?.goal !== 'friend' || SB.profile?.goal !== 'romantic';
  return { run, goal: 'dual', same_session: A.sid === B.sid, cross_state: cross, profile_goal_cross: !!profCross, friend: ja, romantic: jb, fail: cross || !!profCross || ja.fail || jb.fail };
}

const n = +N; const jobs = [];
for (let k = 1; k <= n; k++) { jobs.push(() => single('friend', k)); jobs.push(() => single('romantic', k)); jobs.push(() => single('colleague', k)); jobs.push(() => dual(k)); }
const results = []; let next = 0; const conc = 4;
await Promise.all(Array.from({ length: conc }, async () => { while (next < jobs.length) { const j = jobs[next++]; try { results.push(await j()); } catch (e) { results.push({ error: String(e.message ?? e).slice(0, 120) }); } } }));
const by = (g) => results.filter((r) => r.goal === g && !r.error);
const agg = (rs) => ({ runs: rs.length, fail: rs.filter((r) => r.fail).length, residue: rs.filter((r) => r.residue?.length).length, dup_questions: rs.filter((r) => r.dup?.length).length, summary_residue: rs.filter((r) => r.summary_residue?.length).length,
  counsel_ack: rs.filter((r) => r.counsel?.length).length, correction_fail: rs.filter((r) => r.correction_ok === false).length, repeat_fail: rs.filter((r) => r.repeat_ok === false).length, unsure_fail: rs.filter((r) => r.unsure_ok === false).length,
  goal_mismatch: rs.filter((r) => r.goal_saved && r.goal_saved !== r.goal).length, unfinished: rs.filter((r) => r.finished === false).length, avg_questions: +(rs.reduce((a, r) => a + (r.questions ?? 0), 0) / Math.max(1, rs.length)).toFixed(2) });
// 목적 이름만 바꾼 질문(친구 질문에서 「친구」를 빼면 연애 질문과 거의 같은지 · 교차 비교)
const strip = (t) => bare(t).replace(/친구|연인|연애|사람|상대|분/g, '');
const fq = by('friend').flatMap((r) => r.asked.slice(1)), rq = by('romantic').flatMap((r) => r.asked.slice(1));
const labelOnly = fq.filter((a) => rq.some((b) => dice(strip(a), strip(b)) >= 0.8));
const duals = results.filter((r) => r.goal === 'dual' && !r.error);
const summary = { total_jobs: jobs.length, errors: results.filter((r) => r.error).length, error_samples: results.filter((r) => r.error).slice(0, 5).map((r) => r.error),
  friend: agg(by('friend')), romantic: agg(by('romantic')), colleague: agg(by('colleague')),
  dual: { runs: duals.length, fail: duals.filter((r) => r.fail).length, same_session: duals.filter((r) => r.same_session).length, cross_state: duals.filter((r) => r.cross_state).length, profile_goal_cross: duals.filter((r) => r.profile_goal_cross).length,
    friend_side_fail: duals.filter((r) => r.friend.fail).length, romantic_side_fail: duals.filter((r) => r.romantic.fail).length },
  label_only_rewrites: labelOnly.length, label_only_samples: labelOnly.slice(0, 5) };
summary.total_fail = summary.friend.fail + summary.romantic.fail + summary.colleague.fail + summary.dual.fail + summary.errors + (labelOnly.length ? 1 : 0);
if (OUT) writeFileSync(OUT, JSON.stringify({ summary, results }, null, 1));
console.log(JSON.stringify(summary, null, 1));
process.exitCode = summary.total_fail ? 1 : 0;
