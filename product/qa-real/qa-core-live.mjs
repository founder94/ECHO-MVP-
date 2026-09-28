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
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); };
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
const summaryText = JSON.stringify({ summary: s?.summary ?? [], profile: s?.profile ?? null, intro: s?.intro?.text ?? null });
const factHits = leaksIn(summaryText);
check('요약·프로필·소개에 거절된 뜻(매일 연락) 사실로 0', factHits.every((h) => h.negated), `phase=${s?.phase} hits=${JSON.stringify(factHits.slice(0, 4))}`);
check('최신 정정이 이긴다(요약·프로필·소개에 주말 반영 · 또는 아직 요약 전)', s?.phase !== 'done' || /주말/.test(summaryText), `phase=${s?.phase} 주말=${/주말/.test(summaryText)}`);

// ④ 세션 격리
const bGet = await agent(B.jwt, { action: 'agent_get', sessionId: sid });
check('세션 격리: 다른 사용자가 이 세션 읽기 0', !(bGet.data?.session?.id === sid), `status=${bGet.status} got=${bGet.data?.session?.id === sid ? 'A 세션' : (bGet.data?.session ? '자기 세션' : 'null')}`);
const bTurn = await agent(B.jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId: sid, text: '다른 사람이 끼어들기' });
check('세션 격리: 다른 사용자가 이 세션에 쓰기 0', bTurn.status !== 200 || bTurn.data?.session?.id !== sid, `status=${bTurn.status}`);
const aAfter = await agent(A.jwt, { action: 'agent_get', sessionId: sid });
check('세션 격리: A 세션에 B 의 글 0', !(aAfter.data?.session?.messages ?? []).some((m) => m.text === '다른 사람이 끼어들기'));

const fail = results.filter((x) => !x).length;
console.log(`QA CORE LIVE: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
