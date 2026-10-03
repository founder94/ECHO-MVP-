import { safeDetail } from './safe-detail.mjs'; // 실패 출력에도 비밀값 0
// CORE 실서버 검사(2026-09-29 대표 「AUTH + QA CLOSING」 §7-9·10) — QA 서버(doit-agent)·실제 AI · 새 시험 계정 · 운영 0 · 비밀값 0(QA 공개 키만).
//  ① 정정: 사용자가 「아니 그런 뜻 아니야」로 고친 뒤 최신 정정이 이긴다 — 요약·프로필에 거절된 뜻(매일 연락) 0 · 정정한 뜻(주말) 반영
//  ② 거절된 의미 재등장 0: 정정 뒤 AI 말(질문·반응)에 거절된 뜻이 사실처럼 다시 나오지 않는다
//  ③ 원문 보존: 사용자가 쓴 두 문장이 그대로 대화 기록에 남는다
//  ④ 세션 격리: 다른 사용자는 이 세션을 읽지도(agent_get) 쓰지도(agent_turn) 못한다
import { randomUUID } from 'node:crypto';
const QA_REF = 'mutniujeiyujhkobadkd';
const SB = `https://${QA_REF}.supabase.co`;
const ANON = process.env.QA_ANON;
if (!ANON) { console.error('QA_ANON 없음'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${safeDetail(detail)}` : ''}`); };
const http = async (path, { method = 'GET', jwt = null, body = null, headers = {} } = {}) => {
  const r = await fetch(`${SB}${path}`, { method, headers: { apikey: ANON, Authorization: `Bearer ${jwt ?? ANON}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t.slice(0, 200); }
  return { status: r.status, data };
};
const agent = (jwt, body) => http('/functions/v1/doit-agent', { method: 'POST', jwt, body });
async function account(tag) {
  const email = `qa-core-${Date.now()}-${tag}@do-it.company`; const password = `Qa!${randomUUID()}`;
  await http('/auth/v1/signup', { method: 'POST', body: { email, password, data: { nickname: `QA-CORE-${tag}` } } });
  const tok = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  const jwt = tok.data?.access_token; const uid = tok.data?.user?.id;
  if (jwt) await http(`/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', jwt, body: { purpose_id: 'friend', purpose_label: '친구를 만나고 싶어요', consent_version: 'v1.0' }, headers: { Prefer: 'return=minimal' } });
  return { jwt, uid };
}
const OLD = '연락은 매일 하는 게 좋아요';
const CORRECTION = '아니 그런 뜻 아니야. 매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요';
const A_MEANING = /(매일|날마다|하루도 빠짐없이)[^.!?]{0,20}연락(하는 게 좋|을 원|이 좋)|연락[^.!?]{0,20}(매일|날마다)[^.!?]{0,10}(좋|원)/;
// 거절된 뜻이 「사실로」 남았는지: 매일 연락을 원한다는 단정만 잡는다. 「매일은 부담스럽고 …」처럼 그 뜻을 부정하는 문장(정정 내용)은 누출이 아니다.
const NEGATION = /(부담|싫|말고|아니|대신|보다는|않|없)/;
const leaksIn = (text) => { const out = []; const rx = new RegExp(A_MEANING.source, 'g'); let m; while ((m = rx.exec(text))) { const neg = NEGATION.test(m[0]); out.push({ snippet: text.slice(Math.max(0, m.index - 15), m.index + m[0].length + 10), negated: neg }); } return out; };
const REST = ['카페에서 오래 이야기하는 걸 좋아해요', '솔직하고 배려 있는 사람이 좋아요', '처음엔 천천히 알아가고 싶어요', '약속 시간을 잘 지키는 게 중요해요', '오늘은 여기까지 할게요'];

const A = await account('a'); const B = await account('b');
if (!A.jwt || !B.jwt) { check('QA 시험 계정 2개', false); process.exit(1); }
const st = await agent(A.jwt, { action: 'agent_start', requestId: randomUUID(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구를 만나고 싶어요' });
let s = st.data?.session;
check('대화 시작(실서버 · 실제 AI)', st.status === 200 && !!s?.id, `status=${st.status}`);
const sid = s?.id;
let r = await agent(A.jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId: sid, text: OLD }); s = r.data?.session ?? s;
const aiBeforeCorrection = (s?.messages ?? []).filter((m) => m.role === 'ai').length;
r = await agent(A.jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId: sid, text: CORRECTION }); s = r.data?.session ?? s;
check('정정 입력 처리', r.status === 200, `status=${r.status} kind=${r.data?.turn?.kind ?? '-'}`);
for (const a of REST) { if (!s || s.phase === 'done') break; r = await agent(A.jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId: sid, text: a }); s = r.data?.session ?? s; }
const got = await agent(A.jwt, { action: 'agent_get', sessionId: sid }); s = got.data?.session ?? s;
const msgs = s?.messages ?? [];
const users = msgs.filter((m) => m.role === 'user').map((m) => m.text);
check('원문 보존(거절한 원래 말 · 정정한 말 둘 다 그대로)', users.includes(OLD) && users.includes(CORRECTION), `user_msgs=${users.length}`);
const aiAfter = msgs.filter((m) => m.role === 'ai').slice(aiBeforeCorrection).map((m) => m.text);
const aiHits = aiAfter.flatMap(leaksIn); const leaked = aiHits.filter((h) => !h.negated);
check('거절된 의미 재등장 0(정정 뒤 AI 말)', leaked.length === 0, `ai_after=${aiAfter.length} hits=${JSON.stringify(aiHits.slice(0, 3))}`);
// 판정 대상 = 「지금 사실」만: 요약 문장 · 소개 · 매칭 재료(confirmed_preferences) · 칸의 CONFIRMED 항목(note·quote).
// 정정 이력(corrected_from · SUPERSEDED/RETRACTED 항목 · 원문 turns)은 설계상 옛 값을 기록하므로 대상이 아니다(이력 보존 확인은 아래 별도).
const prof = s?.profile ?? {};
const liveItems = Object.values(prof).filter((v) => v && Array.isArray(v.items)).flatMap((v) => v.items.filter((i) => i.status === 'CONFIRMED').map((i) => `${i.note} ${i.quote}`));
const summaryText = JSON.stringify({ summary: (s?.summary ?? []).map((x) => x.text), intro: s?.intro?.text ?? null, prefs: prof.confirmed_preferences ?? [], live: liveItems });
const factHits = leaksIn(summaryText);
check('요약·프로필·소개에 거절된 뜻(매일 연락) 사실로 0', factHits.every((h) => h.negated), `phase=${s?.phase} hits=${JSON.stringify(factHits.slice(0, 4))}`);
check('최신 정정이 이긴다(요약·프로필·소개에 주말 반영 · 또는 아직 요약 전)', s?.phase !== 'done' || /주말/.test(summaryText), `phase=${s?.phase} 주말=${/주말/.test(summaryText)}`);
const lineage = JSON.stringify(Object.values(prof).filter((v) => v && Array.isArray(v.items)).flatMap((v) => v.items.flatMap((i) => [...(i.corrected_from ?? []), ...(i.status !== 'CONFIRMED' ? [i.note] : [])])));
check('정정 이력 보존(밀린 옛 값이 이력에 남음 · 지금 사실은 아님)', s?.phase !== 'done' || A_MEANING.test(lineage) || /매일/.test(lineage), `lineage=${lineage.slice(0, 160)}`);

// ④ 세션 격리
const bGet = await agent(B.jwt, { action: 'agent_get', sessionId: sid });
check('세션 격리: 다른 사용자가 이 세션 읽기 0', !(bGet.data?.session?.id === sid), `status=${bGet.status} got=${bGet.data?.session?.id === sid ? 'A 세션' : (bGet.data?.session ? '자기 세션' : 'null')}`);
const bTurn = await agent(B.jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId: sid, text: '다른 사람이 끼어들기' });
check('세션 격리: 다른 사용자가 이 세션에 쓰기 0', bTurn.status !== 200 || bTurn.data?.session?.id !== sid, `status=${bTurn.status}`);
const aAfter = await agent(A.jwt, { action: 'agent_get', sessionId: sid });
check('세션 격리: A 세션에 B 의 글 0', !(aAfter.data?.session?.messages ?? []).some((m) => m.text === '다른 사람이 끼어들기'));

// ⑤ 같은 계정 목적 세션 격리 · 말 종류 규칙(모르겠어 · 목적 방향 정정 · 질문 피로) — 새 계정 C
const C = await account('c');
const turn = (sessionId, text) => agent(C.jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId, text });
const fr = await agent(C.jwt, { action: 'agent_start', requestId: randomUUID(), tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '친구', firstAnswer: '친구를 만나고 싶어요' });
const fid = fr.data?.session?.id;
const hb = await agent(C.jwt, { action: 'agent_start', requestId: randomUUID(), tone: 'polite', mode: 'TEXT', goal: 'hobby', goalLabel: '취미', firstAnswer: '같이 등산할 사람을 찾아요' });
const hid = hb.data?.session?.id;
check('목적 격리: 같은 계정 다른 목적 = 다른 세션', !!fid && !!hid && fid !== hid && hb.data?.session?.goal === 'hobby' && fr.data?.session?.goal === 'friend', `friend=${fid?.slice(0, 8)} hobby=${hid?.slice(0, 8)} goals=${fr.data?.session?.goal}/${hb.data?.session?.goal}`);
const again = await agent(C.jwt, { action: 'agent_start', requestId: randomUUID(), tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '친구', firstAnswer: '친구를 만나고 싶어요' });
check('목적 격리: 친구 목적으로 다시 시작하면 원래 친구 세션(새로 안 만듦 · 취미 세션 안 섞임)', again.data?.session?.id === fid && again.data?.existing === true, `id=${again.data?.session?.id?.slice(0, 8)} existing=${again.data?.existing}`);
const u = await turn(fid, '잘 모르겠어요');
check("「잘 모르겠어요」 = 모르겠다(unsure) · 사실로 저장 0", u.status === 200 && u.data?.turn?.kind === 'unsure' && u.data?.turn?.saved === false, `status=${u.status} kind=${u.data?.turn?.kind} saved=${u.data?.turn?.saved}`);
const gm = await turn(fid, '연애 질문 아니야 친구 찾는 거야');
check('목적 방향 정정 = 항의(repair) · 저장 0', gm.status === 200 && gm.data?.turn?.kind === 'repair' && gm.data?.turn?.saved === false, `status=${gm.status} kind=${gm.data?.turn?.kind} saved=${gm.data?.turn?.saved}`);
const fa = await turn(fid, '질문이 너무 많아요');
check('질문 피로 = 항의(repair) · 저장 0', fa.status === 200 && ['repair', 'stop'].includes(fa.data?.turn?.kind) && fa.data?.turn?.saved === false, `status=${fa.status} kind=${fa.data?.turn?.kind} saved=${fa.data?.turn?.saved}`);
const fget = await agent(C.jwt, { action: 'agent_get', sessionId: fid });
const fmsgs = (fget.data?.session?.messages ?? []).map((m) => m.text);
check('목적 격리: 친구 세션에 취미 세션 말(등산) 0', !fmsgs.some((t) => /등산/.test(t)), `msgs=${fmsgs.length}`);
// 기대 판은 배포 작업(agent_deploy_qa)의 AGENT_VERSION 과 같게(2026-10-03 · 배포 판 v2.5.8) — EXPECT_AGENT_VERSION 으로 바꿀 수 있음
const EXPECT_VER = process.env.EXPECT_AGENT_VERSION || 'echo-agent-v2.5.8';
check(`서버 판 = ${EXPECT_VER}`, (fget.data?.session?.profile?.version ?? s?.profile?.version) === EXPECT_VER || s?.profile?.version === EXPECT_VER, `version=${s?.profile?.version ?? '-'}`);

// ── F(2026-09-29 대표 「FINAL RELEASE CLOSING」): 같은 계정 친구 ↔ 연애 세션 격리
const ro = await agent(C.jwt, { action: 'agent_start', requestId: randomUUID(), tone: 'polite', mode: 'TEXT', goal: 'romantic', goalLabel: '연애', firstAnswer: '진지한 연애를 하고 싶어요' });
const rid = ro.data?.session?.id;
check('목적 격리: 같은 계정 연애 = 친구·취미와 다른 세션 · goal=romantic', !!rid && rid !== fid && rid !== hid && ro.data?.session?.goal === 'romantic', `romantic=${rid?.slice(0, 8)} goal=${ro.data?.session?.goal}`);
// ── B: 모호한 거절 「그런 뜻 아니야」 — 바로 앞 AI 해석을 거두고, 거둔 뜻이 뒤 AI 말·지금 사실(요약·소개·confirmed_preferences)에 다시 나오지 않는다
const rt = (text) => agent(C.jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId: rid, text });
await rt('조용한 곳에서 오래 이야기하는 게 좋아요');
const before = await agent(C.jwt, { action: 'agent_get', sessionId: rid });
const aiN = (before.data?.session?.messages ?? []).filter((m) => m.role === 'ai').length;
const vr = await rt('그런 뜻 아니야');
check('「그런 뜻 아니야」 처리 · 사실로 저장 0', vr.status === 200 && vr.data?.turn?.saved === false, `status=${vr.status} kind=${vr.data?.turn?.kind} saved=${vr.data?.turn?.saved}`);
await rt('천천히 알아가는 사이가 좋아요');
const rg = (await agent(C.jwt, { action: 'agent_get', sessionId: rid })).data?.session ?? {};
const rprof = rg.profile ?? {};
const slots = Object.values(rprof).filter((v) => v && Array.isArray(v.items));
const retracted = slots.flatMap((v) => (v.history ?? []).filter((i) => i.status === 'RETRACTED').map((i) => i.note)).concat(rprof.rejected_meanings ?? []).filter(Boolean);
const liveNotes = slots.flatMap((v) => v.items.filter((i) => i.status === 'CONFIRMED').map((i) => i.note));
const aiLater = (rg.messages ?? []).filter((m) => m.role === 'ai').slice(aiN + 1).map((m) => m.text).join(' ');
const factsR = JSON.stringify({ summary: (rg.summary ?? []).map((x) => x.text), intro: rg.intro?.text ?? null, prefs: rprof.confirmed_preferences ?? [], live: liveNotes });
if (!retracted.length) console.log('INVALID 「그런 뜻 아니야」 거둠 검사: 이번 실제 AI 가 앞 답에 해석을 보이지 않아 거둘 뜻이 없음(PASS 아님 · FAIL 아님)');
else check('「그런 뜻 아니야」 거둔 뜻이 뒤 AI 말·지금 사실에 0', retracted.every((r) => !aiLater.includes(r) && !factsR.includes(r)), `retracted=${JSON.stringify(retracted.slice(0, 3))}`);
check('「그런 뜻 아니야」 사용자 원문 보존', (rg.messages ?? []).some((m) => m.role === 'user' && m.text === '조용한 곳에서 오래 이야기하는 게 좋아요') && (rg.messages ?? []).some((m) => m.role === 'user' && m.text === '그런 뜻 아니야'));
const fAfter = ((await agent(C.jwt, { action: 'agent_get', sessionId: fid })).data?.session?.messages ?? []).map((m) => m.text);
check('목적 격리: 친구 세션에 연애 세션 말 0 · 연애 세션에 친구·취미 세션 말 0', !fAfter.some((t) => /진지한 연애|조용한 곳에서 오래/.test(t)) && !(rg.messages ?? []).some((m) => m.role === 'user' && /등산|친구를 만나고 싶어요|잘 모르겠어요|질문이 너무 많아요/.test(m.text)), `friend=${fAfter.length} romantic=${(rg.messages ?? []).length}`);

const fail = results.filter((x) => !x).length;
console.log(`QA CORE LIVE: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
