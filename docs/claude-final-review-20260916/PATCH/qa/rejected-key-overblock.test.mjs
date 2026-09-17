// P0-06 사용자 원문 과차단 — 실패하는 검사를 먼저 쓴다(FINAL LOCK §11).
// 장면: 사용자가 "돈 걱정이 많아요" 라고 썼다 → AI 요약이 그 말을 그대로 인용한다(근거 규칙상 당연)
//       → 사용자가 "그게 아니에요" → 서버가 거절 문장을 낱말로 쪼개 '걱정' 까지 금지어로 만든다
//       → 다음 질문은 사용자 표현을 붙잡아야 하는데(anchor 규칙) 붙잡는 순간 차단된다 → 대화 중단.
// 지켜야 할 두 가지를 한 파일에서 같이 본다:
//   ① 사용자 원문은 계속 쓸 수 있어야 한다(과차단 0)
//   ② 거절한 AI 주장은 표현만 바꿔도 다시 나오면 안 된다(재등장 0)
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDatabase, loadEdgeHandler, invoke, token } from './_edge-harness.mjs';

const MIND = '요즘 돈 걱정이 많아요';
const S1 = '일이 줄어든 상황이에요';
const S2 = '수입이 불안정해요';
// 요약은 규칙상 사용자 말에 근거해야 한다. 근거를 많이 댈수록 더 많은 사용자 낱말이 금지어가 된다 — 그게 이 결함이다.
const WRONG = '돈 걱정과 일이 줄어든 상황 때문에 마음이 무거우신 것 같아요.';
const CORRECTION = '무겁다기보다 그냥 걱정이 습관이 된 거예요'; // 사용자가 자기 말을 다시 쓴다

// 사용자 원문('걱정')을 붙잡은 정상 후보만 준다. 거절한 '마음이 무겁다' 는 쓰지 않는다.
const FROM_USER_WORDS = [
  { anchor: '걱정', keys: ['걱정'], q: '그 걱정이 습관이 됐다는 건 어떤 뜻인가요?' },
  { anchor: '일이', keys: ['일이'], q: '일이 줄어든 뒤로 하루가 어떻게 달라졌나요?' },
  { anchor: '상황', keys: ['상황'], q: '그 상황에서 가장 먼저 떠오르는 건 무엇인가요?' },
];
// 거절한 해석을 표현만 바꿔 되살린 후보(반드시 막혀야 한다)
const REVIVES = { anchor: '걱정', keys: ['마음이무거움'], q: '마음이 무거워지는 건 어떤 순간인가요?' };

function ai({ revive = false } = {}) {
  const calls = { json: 0 };
  const fetch = async (_u, o = {}) => {
    const req = JSON.parse(o.body);
    const sys = String(req.messages?.[0]?.content ?? '');
    let content;
    if (req.response_format) {
      calls.json += 1;
      const mk = (c) => ({ acknowledgement: `${c.anchor}라고 하셨네요.`, question: c.q, anchor: c.anchor, assumptions: [], meaning: `${c.anchor} 탐색`, keys: c.keys, reply: '' });
      content = JSON.stringify({ candidates: (revive ? [REVIVES] : FROM_USER_WORDS).map(mk) });
    } else if (sys.includes('요약해라')) content = WRONG;
    else content = ['1. 돈 걱정이 어떤 순간에 가장 커지나요?', '2. 일이 줄어서 달라진 점은 무엇인가요?', '3. 수입이 불안정하다는 건 어떤 뜻인가요?'].join('\n');
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

async function upToRejection(handler, u) {
  const s = await invoke(handler, u, { action: 'start', mindText: MIND, token: token(`${u}-s`) });
  const cid = s.body.conversationId;
  await invoke(handler, u, { action: 'ask', conversationId: cid, token: token(`${u}-a1`) });
  await invoke(handler, u, { action: 'answer', conversationId: cid, answer: S1, token: token(`${u}-n1`) });
  await invoke(handler, u, { action: 'ask', conversationId: cid, token: token(`${u}-a2`) });
  await invoke(handler, u, { action: 'answer', conversationId: cid, answer: S2, token: token(`${u}-n2`) });
  const sum = await invoke(handler, u, { action: 'ask', conversationId: cid, token: token(`${u}-un`) });
  assert.equal(sum.body.understanding, WRONG);
  const no = await invoke(handler, u, { action: 'choose', conversationId: cid, choice: 'no', text: CORRECTION, token: token(`${u}-no`) });
  assert.equal(no.body.status, 'followup', '거절이 서버 상태를 바꾸지 않았다');
  return cid;
}

test('P0-06: 거절 뒤에도 사용자 자기 표현으로 다음 질문을 만들 수 있다', async () => {
  const db = new FakeDatabase();
  const a = ai();
  const h = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, a);
  const cid = await upToRejection(h, 'ob-user');

  const f = await invoke(h, 'ob-user', { action: 'ask', conversationId: cid, token: token('ob-fu') });
  assert.equal(f.body.ok, true, `후속 질문이 막혔다: ${f.body.code ?? ''} — 사용자 원문 과차단(P0-06)`);
  const shown = String(f.body.question ?? '');
  assert.notEqual(shown.trim(), '', '빈 응답');
  // 사용자가 실제로 쓴 표현 중 '아무거나 하나' 는 계속 쓸 수 있어야 한다.
  assert.ok(/걱정|일이|상황|수입|습관/.test(shown), `사용자가 쓴 표현을 하나도 쓰지 못했다: ${shown}`);
});

test('P0-05: 그래도 거절한 해석은 표현만 바꿔도 다시 나오지 않는다', async () => {
  const db = new FakeDatabase();
  const a = ai({ revive: true });
  const h = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, a);
  const cid = await upToRejection(h, 'rv-user');

  const f = await invoke(h, 'rv-user', { action: 'ask', conversationId: cid, token: token('rv-fu') });
  const shown = String(f.body.question ?? '');
  assert.ok(!shown.includes(REVIVES.q), `거절한 해석이 표현만 바뀌어 다시 나왔다: ${shown}`);
});
