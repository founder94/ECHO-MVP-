// 기억 영수증 · 「ECHO가 아는 나」 · 사주·타로 정정 · 유료 자유 대화 스위치 — QA 실서버 검사(2026-10-06 대표 승인).
// QA 서버(doit-agent) · 실제 AI · 새 시험 계정 · 운영 0 · 비밀값 0(QA 공개 키만). 실행: QA_ANON=<공개키> node qa-real/qa-memory-live.mjs
//  ① 보통 답 = 영수증 0 · ② 자유 입력 정정(「아니 그런 뜻 아니야…」) = 서버 저장 뒤 영수증 한 줄(고정 문장 · 옛 뜻→고친 뜻) · ③ 정정 직후 다음 질문에 고친 내용 인용
//  ④ 정정 뒤 AI 말에 거절된 뜻 재등장 0 · ⑤ 「ECHO가 아는 나」 네 칸(고친 것에 새 뜻 · 아니라고 한 것에 옛 뜻) · ⑥ 줄 지우기 → 사라짐 · 재등장 0
//  ⑦ 「맞아요」(agent_confirm) = 확인 시각 · ⑧ 사주·타로 이어 대화에서 해석 부정 = 고정 영수증 + correction(모델 0) · ⑨ [반영할게요](agent_self_note) = 「내가 고친 것」에 내 문장(해석 원문 0)
//  ⑩ 자유 대화 스위치 = QA 기본 꺼짐(503 FREE_TALK_OFF) — 켜져 있으면 맛보기 안내 확인 · ⑪ 다른 사용자는 내 「아는 나」를 읽지 못한다
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
  const email = `qa-mem-${Date.now()}-${tag}@do-it.company`; const password = `Qa!${randomUUID()}`;
  await http('/auth/v1/signup', { method: 'POST', body: { email, password, data: { nickname: `QA-MEM-${tag}` } } });
  const tok = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  return { jwt: tok.data?.access_token, uid: tok.data?.user?.id };
}
const short = (v) => JSON.stringify(v ?? null).slice(0, 200);
const OLD = '연락은 매일 하는 게 좋아요';
const FIX = '아니 그런 뜻 아니야. 매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요';
const OLD_MEANING = /(매일|날마다)[^.!?]{0,20}연락(하는 게 좋|을 원|이 좋)|연락[^.!?]{0,20}(매일|날마다)[^.!?]{0,10}(좋|원)/;
const NEG = /(부담|싫|말고|아니|대신|보다는|않|없)/;
const leaks = (t) => { const rx = new RegExp(OLD_MEANING.source, 'g'); let m; const out = []; while ((m = rx.exec(t ?? ''))) { if (!NEG.test((t ?? '').slice(Math.max(0, m.index - 12), m.index + m[0].length + 12))) out.push(m[0]); } return out; };

const A = await account('a'); const B = await account('b');
if (!A.jwt || !B.jwt) { check('QA 시험 계정 2개', false); process.exit(1); }
const st = await agent(A.jwt, { action: 'agent_start', requestId: randomUUID(), tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '친구를 만나고 싶어요', firstAnswer: '친구를 만나고 싶어요' });
let s = st.data?.session; const sid = s?.id;
check('대화 시작(실서버 · 실제 AI)', st.status === 200 && !!sid, `status=${st.status} ${short(st.data?.error)}`);
const turn = (text) => agent(A.jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId: sid, text });
let r = await turn(OLD); s = r.data?.session ?? s;
check('① 보통 답 = 영수증 0', r.status === 200 && !r.data?.turn?.receipt, `status=${r.status} receipt=${short(r.data?.turn?.receipt)}`);
r = await turn(FIX); s = r.data?.session ?? s;
const rc = r.data?.turn?.receipt;
check('② 자유 입력 정정 = 서버 저장 뒤 영수증 한 줄', r.status === 200 && r.data?.turn?.kind === 'correction' && typeof rc?.line === 'string' && /^알겠어요\. 「.+」/.test(rc.line) && /기억할게요\.$/.test(rc.line) && rc.after?.length >= 1, `kind=${r.data?.turn?.kind} ${short(rc)}`);
const cite = r.data?.turn?.cite ?? null; const q = r.data?.turn?.question ?? '';
check('③ 정정 직후 다음 질문에 고친 내용 인용', (!!q && typeof cite === 'string' && /알아들었어요\.$/.test(cite) && (s?.current_question ?? '').startsWith(cite)) || (!q && r.data?.turn?.finish === true), `cite=${short(cite)} q=${short(q)} current=${short(s?.current_question)}`);
check('④ 정정 뒤 AI 말에 거절된 뜻 재등장 0', leaks(`${r.data?.turn?.reply ?? ''} ${q}`).length === 0, short(leaks(`${r.data?.turn?.reply ?? ''} ${q}`)));
const g1 = await agent(A.jwt, { action: 'agent_get', sessionId: sid });
const k = g1.data?.session?.known;
check('⑤ 「ECHO가 아는 나」 네 칸: 고친 것에 새 뜻 · 아니라고 한 것에 옛 뜻 · 사실(확인) 칸에 옛 뜻 0', !!k && k.corrected.some((l) => /주말|한두/.test(l.text)) && [...k.rejected, ...k.guesses].some((l) => /매일/.test(l.text) || /매일/.test(l.quote ?? '')) === true && !k.confirmed.some((l) => /매일/.test(l.text) && !NEG.test(l.text)), short(k && { c: k.confirmed.map((l) => l.text), g: k.guesses.map((l) => l.text), x: k.corrected.map((l) => l.text), r: k.rejected.map((l) => l.text) }));
const victim = k?.guesses[0] ?? k?.confirmed[0] ?? null;
if (victim) {
  const f = await agent(A.jwt, { action: 'agent_forget', requestId: randomUUID(), sessionId: sid, key: victim.key });
  const k2 = f.data?.session?.known;
  check('⑥ 줄 지우기 → 네 칸에서 사라짐 · 지운 수 +1', f.status === 200 && !!k2 && ![...k2.confirmed, ...k2.guesses, ...k2.corrected, ...k2.rejected].some((l) => l.key === victim.key) && k2.forgotten === (k.forgotten ?? 0) + 1, `status=${f.status} ${short(f.data?.error)}`);
} else check('⑥ 줄 지우기(지울 줄 없음 → 확인 불가)', false, '네 칸이 비어 있음');
const c1 = await agent(A.jwt, { action: 'agent_confirm', requestId: randomUUID(), sessionId: sid });
check('⑦ 「맞아요」 = 서버 확인 시각 기록', c1.status === 200 && !!c1.data?.session?.known?.confirmed_at, `status=${c1.status} at=${short(c1.data?.session?.known?.confirmed_at)}`);
// 사주·타로 이어 대화: 해석 부정(모델 0) → 영수증 + correction → 반영
const REF = { kind: 'pattern', key: 'peer_none' };
const open = await agent(A.jwt, { action: 'agent_ref', requestId: randomUUID(), ref: REF, history: [], text: '' });
const deny = await agent(A.jwt, { action: 'agent_ref', requestId: randomUUID(), ref: REF, history: [{ role: 'echo', text: open.data?.reply ?? '' }], text: '나 그런 사람 아닌데, 저는 사람 많은 데를 좋아해요' });
check('⑧ 해석 부정 = 고정 영수증(사주보다 당신 말이 맞아요) + 고친 문장', deny.status === 200 && /^사주보다 당신 말이 맞아요\. 「.+」(으)?로 기억할게요\.$/.test(deny.data?.reply ?? '') && deny.data?.correction?.text === '저는 사람 많은 데를 좋아해요' && deny.data?.question === null, `status=${deny.status} ${short(deny.data)}`);
const note = await agent(A.jwt, { action: 'agent_self_note', requestId: randomUUID(), text: deny.data?.correction?.text ?? '저는 사람 많은 데를 좋아해요', origin: 'ref_correction' });
const k3 = note.data?.session?.known;
check('⑨ [반영할게요] = 「내가 고친 것」에 내 문장 · 해석 원문 0', note.status === 200 && !!k3 && k3.corrected.some((l) => l.text === '저는 사람 많은 데를 좋아해요' && l.origin === 'self_note_ref') && !JSON.stringify(k3).includes('혼자 정리하는 시간'), `status=${note.status} ${short(note.data?.error)}`);
// 자유 대화 스위치
const ft = await agent(A.jwt, { action: 'agent_free_talk', requestId: randomUUID(), history: [], text: '요즘 일이 힘들어' });
const g2 = await agent(A.jwt, { action: 'agent_get', sessionId: sid });
const flag = g2.data?.free_talk;
check('⑩ 자유 대화 스위치(QA): 꺼짐 = 503 FREE_TALK_OFF · 켜짐 = 맛보기 안내(200/402)', (flag?.enabled === false && ft.status === 503 && ft.data?.code === 'FREE_TALK_OFF') || (flag?.enabled === true && [200, 402, 429].includes(ft.status)), `enabled=${short(flag)} status=${ft.status} code=${ft.data?.code}`);
// 다른 사용자 격리
const gB = await agent(B.jwt, { action: 'agent_get', sessionId: sid });
const fB = await agent(B.jwt, { action: 'agent_forget', requestId: randomUUID(), sessionId: sid, key: victim?.key ?? 'item:x:1:y' });
check('⑪ 다른 사용자는 내 「아는 나」를 읽지도 지우지도 못한다', (gB.data?.session == null || gB.data?.session?.id !== sid) && fB.status !== 200, `getB=${short(gB.data?.session?.id)} forgetB=${fB.status}`);

const fail = results.filter((x) => !x).length;
console.log(`QA MEMORY LIVE: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
