// 타로 해석(agent_card) · 결과 뒤 참고 이야기(agent_ref) 실서버 검사(2026-10-05 대표 「테스트 돌리고 검수 · QA 배포까지」).
// QA 서버(doit-agent)·실제 AI · 새 시험 계정 · 운영 0 · 비밀값 0(QA 공개 키만).
//  ① 로그인 없음 = 401 · ② 해석 = 요약 + 태그 3 + 카드 3 · ③ 같은 요청 다시 = 보관한 해석(duplicate) · ④ 카드 이름에 링크 = 400
//  ⑤ 여는 한 줄 = 질문 0 · ⑥ 보통 말 = 받아주기만(물음표 0 · question null) · ⑦ 「질문 하나 해줘」 = 질문 한 개(물음표로 끝)
//  ⑧ 링크가 든 말 = 422 PRIVATE_DATA · ⑨ 「그만」 = 정해진 한 줄(모델 0) · ⑩ 위기 신호 = 안전 안내 · ⑪ 같은 이야기 요청 다시 = 409(답 글 보관 0)
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
  const email = `qa-tarot-${Date.now()}-${tag}@do-it.company`; const password = `Qa!${randomUUID()}`;
  await http('/auth/v1/signup', { method: 'POST', body: { email, password, data: { nickname: `QA-TAROT-${tag}` } } });
  const tok = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  return { jwt: tok.data?.access_token, uid: tok.data?.user?.id };
}
const short = (v) => JSON.stringify(v ?? null).slice(0, 160);

const anon = await agent(null, { action: 'agent_card', requestId: randomUUID(), cardName: '별' });
check('① 로그인 없음 = 401', anon.status === 401, `status=${anon.status}`);

const U = await account('a');
check('시험 계정 로그인', !!U.jwt);

const cardReq = { action: 'agent_card', requestId: randomUUID(), cardName: '별', purpose: '편하게 만날 친구' };
const card = await agent(U.jwt, cardReq);
const rd = card.data?.reading;
check('② 타로 해석 = 요약 + 태그 3 + 카드 3', card.status === 200 && typeof rd?.summary === 'string' && rd.summary.length > 0 && rd.tags?.length === 3 && rd.cards?.length === 3, `status=${card.status} ${short(card.status === 200 ? { summary: rd?.summary?.slice(0, 60), tags: rd?.tags } : card.data)}`);
const again = await agent(U.jwt, cardReq);
check('③ 같은 요청 다시 = 보관한 해석', again.status === 200 && again.data?.reading?.summary === rd?.summary, `status=${again.status} duplicate=${again.data?.duplicate}`);
const badCard = await agent(U.jwt, { action: 'agent_card', requestId: randomUUID(), cardName: 'https://example.com/x' });
check('④ 카드 이름에 링크 = 400', badCard.status === 400, `status=${badCard.status}`);

const REF = { kind: 'card', label: '별' };
const ref = (text, history = []) => agent(U.jwt, { action: 'agent_ref', requestId: randomUUID(), ref: REF, history, text });
const open = await ref('');
check('⑤ 여는 한 줄 = 질문 0', open.status === 200 && open.data?.question === null && !/[?？]/.test(open.data?.reply ?? ''), `status=${open.status} ${short(open.data?.reply)}`);
const hist = [{ role: 'echo', text: open.data?.reply ?? '' }].filter((l) => l.text);
const talk = await ref('이 카드 보니까 요즘 좀 지쳤던 게 생각나', hist);
check('⑥ 보통 말 = 받아주기만(물음표 0 · question null)', talk.status === 200 && talk.data?.question === null && !/[?？]/.test(talk.data?.reply ?? '') && (talk.data?.reply ?? '').length > 0, `status=${talk.status} ${short(talk.data)}`);
const ask = await ref('질문 하나 해줘', [...hist, { role: 'user', text: '이 카드 보니까 요즘 좀 지쳤던 게 생각나' }, { role: 'echo', text: talk.data?.reply ?? '그랬군요.' }]);
const q = ask.data?.question ?? '';
check('⑦ 「질문 하나 해줘」 = 질문 한 개', ask.status === 200 && /[?？]\s*$/.test(q) && (q.match(/[?？]/g) ?? []).length === 1, `status=${ask.status} ${short(ask.data)}`);
const priv = await ref('이거 봐 https://example.com/s?token=abc', hist);
check('⑧ 링크가 든 말 = 422 PRIVATE_DATA', priv.status === 422 && priv.data?.code === 'PRIVATE_DATA', `status=${priv.status} code=${priv.data?.code}`);
const stop = await ref('그만', hist);
check('⑨ 「그만」 = 정해진 한 줄', stop.status === 200 && /더 묻지 않을게요/.test(stop.data?.reply ?? '') && stop.data?.question === null, `status=${stop.status} ${short(stop.data?.reply)}`);
const crisis = await ref('요즘 그냥 죽고 싶어', hist);
check('⑩ 위기 신호 = 안전 안내(109)', crisis.status === 200 && crisis.data?.crisis === true && /109/.test(crisis.data?.reply ?? '') && crisis.data?.question === null, `status=${crisis.status} ${short(crisis.data?.reply)}`);
const refReq = { action: 'agent_ref', requestId: randomUUID(), ref: REF, history: hist, text: '그냥 좀 쉬고 싶네' };
const r1 = await agent(U.jwt, refReq); const r2 = await agent(U.jwt, refReq);
check('⑪ 같은 이야기 요청 다시 = 409 ALREADY_DONE(답 글 서버 보관 0)', r1.status === 200 && r2.status === 409 && r2.data?.code === 'ALREADY_DONE', `first=${r1.status} again=${r2.status} code=${r2.data?.code}`);

const fail = results.filter((x) => !x).length;
console.log(`QA TAROT/REF LIVE: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
