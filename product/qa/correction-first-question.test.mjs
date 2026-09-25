// P0-04 정정 무시 — 2026-09-18 운영 캐너리에서 실제로 난 결함을 그대로 재현한다.
//
// 실제로 일어난 일(캐너리 #3 D · #5 F, 서로 다른 정정인데 결과가 같았다):
//   사용자: "사실은 일보다 사람이 더 힘들어요" (조금 달라요)
//   서버  : "일이 많아지면서 어떤 부분이 가장 힘드신가요?"   ← 정정 이전 주제를 그대로 물었다
// 정정 우선은 프롬프트 문장으로만 지시되어 있었고, 서버 규칙이 없었다.
// ECHO 원칙: LLM 은 후보만 만들고 최종 결정은 서버가 한다 → 서버가 판정해야 한다.
//
// ① 정정 직후 첫 질문은 정정 내용을 실제로 다뤄야 한다(안 다루는 후보는 서버가 막는다)
// ② 다만 막기만 하면 대화가 죽는다 → 마지막 시도에서는 통과시킨다(빠져나갈 문)
// ③ 이미 정정을 다룬 뒤에는 이 규칙이 다시 걸리지 않는다(과차단 금지)
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDatabase, loadEdgeHandler, invoke, token } from './_edge-harness.mjs';

const MIND = '일이 너무 많아';
const STEP1_ANSWER = '일이 너무 많아서 잠을 못 자요';
const STEP2_ANSWER = '돈이 제일 크게 걸려요';
const UNDERSTANDING = '요즘 일이 너무 많아서 잠도 잘 못 주무시고, 그로 인해 돈 문제에 대한 걱정이 더욱 커지신 것 같아요.';
const CORRECTION = '조금 달라요. 반은 맞고 반은 아닌 것 같아요. 사실은 일보다 사람이 더 힘들어요';

// 운영에서 실제로 화면에 나간 문장. 정정("사람")을 전혀 다루지 않는다.
const IGNORES_CORRECTION = {
  acknowledgement: '일이 너무 많아 바쁘셨군요.',
  question: '일이 많아지면서 어떤 부분이 부담되나요?',
  anchor: '일이 너무 많아',
  assumptions: [],
  meaning: '일의 부담을 묻는다',
  keys: ['일부담'],
  reply: '',
};
const REFLECTS_CORRECTION = {
  acknowledgement: '사람이 더 힘들다고 하셨군요.',
  question: '사람과 지내면서 어떤 점이 무겁게 다가오나요?',
  anchor: '사람이 더 힘들',
  assumptions: [],
  meaning: '사람 관계에서 무엇이 힘든지',
  keys: ['사람관계'],
  reply: '',
};

const SINGLE_QUESTIONS = [
  '1. 오늘 하루는 어떻게 지내셨나요?',
  '2. 요즘 자주 떠오르는 생각은 무엇인가요?',
  '3. 그때 몸은 어떤 상태였나요?',
].join('\n');

// jsonPlan: 시도(1,2,3…)마다 어떤 후보를 줄지 정한다.
function createAi(jsonPlan) {
  const calls = { json: 0, systemPrompts: [] };
  const fetch = async (_url, options = {}) => {
    const request = JSON.parse(options.body);
    const system = String(request.messages?.[0]?.content ?? '');
    calls.systemPrompts.push(system);
    let content;
    if (request.response_format) {
      calls.json += 1;
      content = JSON.stringify({ candidates: jsonPlan(calls.json) });
    } else if (system.includes('요약해라')) {
      content = UNDERSTANDING;
    } else {
      content = SINGLE_QUESTIONS;
    }
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls };
}

async function upToCorrection(ai, user) {
  const db = new FakeDatabase();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const started = await invoke(early, user, { action: 'start', mindText: MIND, token: token(`${user}-start`) });
  const conversationId = started.body.conversationId;
  await invoke(early, user, { action: 'ask', conversationId, token: token(`${user}-a1`) });
  await invoke(early, user, { action: 'answer', conversationId, answer: STEP1_ANSWER, token: token(`${user}-n1`) });
  await invoke(early, user, { action: 'ask', conversationId, token: token(`${user}-a2`) });
  await invoke(early, user, { action: 'answer', conversationId, answer: STEP2_ANSWER, token: token(`${user}-n2`) });
  const summary = await invoke(early, user, { action: 'ask', conversationId, token: token(`${user}-u`) });
  assert.equal(summary.body.understanding, UNDERSTANDING);
  const chose = await invoke(early, user, { action: 'choose', conversationId, choice: 'alittle', text: CORRECTION, token: token(`${user}-c`) });
  assert.equal(chose.body.status, 'followup');
  return { db, early, conversationId };
}

test('① 정정 직후 첫 질문: 정정을 다루지 않는 후보는 서버가 막는다', async () => {
  // 1차 시도는 운영에서 나왔던 '정정 무시' 후보만, 2차 시도에 정정을 다룬 후보를 준다.
  const ai = createAi((n) => (n === 1
    ? [IGNORES_CORRECTION, IGNORES_CORRECTION, IGNORES_CORRECTION]
    : [IGNORES_CORRECTION, REFLECTS_CORRECTION]));
  const { early, conversationId } = await upToCorrection(ai, 'corr-1');

  const followup = await invoke(early, 'corr-1', { action: 'ask', conversationId, token: token('corr-1-f') });
  assert.equal(followup.body.ok, true);
  const shown = String(followup.body.question ?? '');
  assert.ok(shown.trim(), '빈 화면이 나갔다');
  assert.ok(
    !shown.includes(IGNORES_CORRECTION.question),
    `정정("사람")을 다루지 않은 질문이 화면에 나갔다: ${shown}`,
  );
  assert.ok(shown.includes('사람'), `정정 내용이 다음 질문에 반영되지 않았다: ${shown}`);
});

test('② 빠져나갈 문: 끝까지 정정을 다룬 후보가 없어도 대화가 끊기지 않는다', async () => {
  const ai = createAi(() => [IGNORES_CORRECTION, IGNORES_CORRECTION, IGNORES_CORRECTION]);
  const { early, conversationId } = await upToCorrection(ai, 'corr-2');

  const followup = await invoke(early, 'corr-2', { action: 'ask', conversationId, token: token('corr-2-f') });
  assert.equal(followup.body.ok, true, `막다른 길: ${followup.body.code ?? ''}`);
  assert.ok(String(followup.body.question ?? '').trim(), '빈 화면이 나갔다');
});

test('③ 과차단 금지: 정정을 다룬 후보는 1차 시도에서 바로 통과한다', async () => {
  const ai = createAi(() => [REFLECTS_CORRECTION]);
  const { early, conversationId } = await upToCorrection(ai, 'corr-3');

  const before = ai.calls.json;
  const followup = await invoke(early, 'corr-3', { action: 'ask', conversationId, token: token('corr-3-f') });
  assert.equal(followup.body.ok, true);
  assert.ok(String(followup.body.question ?? '').includes(REFLECTS_CORRECTION.question));
  assert.equal(ai.calls.json - before, 1, '정정을 다룬 후보인데도 다시 만들게 했다(과차단)');
});

test('④ 대기 상한 안에 빠져나갈 문이 있다: 느린 모델로 시도가 2회로 끊겨도 막다른 길이 없다', async () => {
  // 2026-09-18 운영 캐너리(v34) 재현: 완화를 '마지막(3회째) 시도'에만 두면
  // 2회에 5초가 지나 대기 상한에 먼저 걸려 완화가 아예 실행되지 않고 NO_CANDIDATE 가 났다.
  // 한 번 호출에 2.6초 걸리는 모델을 두어 시도가 2회로 끊기게 만든다.
  const ai = createAi(() => [IGNORES_CORRECTION, IGNORES_CORRECTION, IGNORES_CORRECTION]);
  const slow = ai.fetch;
  ai.fetch = async (url, options = {}) => {
    const request = JSON.parse(options.body ?? '{}');
    if (request.response_format) await new Promise((r) => setTimeout(r, 2600));
    return slow(url, options);
  };
  const { early, conversationId } = await upToCorrection(ai, 'corr-4');

  const followup = await invoke(early, 'corr-4', { action: 'ask', conversationId, token: token('corr-4-f') });
  assert.equal(followup.body.ok, true, `막다른 길: ${followup.body.code ?? ''}`);
  assert.ok(String(followup.body.question ?? '').trim(), '빈 화면이 나갔다');
  assert.ok(ai.calls.json <= 2, `시도가 2회로 끊기지 않았다(${ai.calls.json}회) — 재현 조건이 성립하지 않음`);
});

test('⑤ 되물은 턴에서는 후보 서식이 답(reply)을 반드시 채우라고 말한다', async () => {
  // 2026-09-18 운영 진단 로그: asked 모드 차단 47건 중 39건이 reply_missing 이었다.
  // 원인은 후보 서식 줄이 '아니면 빈 문자열'을 먼저 말한 것. 물어본 턴에서는 그 줄이 바뀌어야 한다.
  const ai = createAi(() => [REFLECTS_CORRECTION]);
  const db = new FakeDatabase();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const u = 'corr-5';
  const started = await invoke(early, u, { action: 'start', mindText: MIND, token: token('c5-s') });
  const conversationId = started.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId, token: token('c5-a1') });
  await invoke(early, u, { action: 'answer', conversationId, answer: '어떻게 해야 좋을까요?', token: token('c5-n1') });
  const before = ai.calls.systemPrompts.length;
  await invoke(early, u, { action: 'ask', conversationId, token: token('c5-a2') });
  const prompt = ai.calls.systemPrompts.slice(before).join('\n');
  assert.ok(prompt.includes('[사용자가 ECHO에게 물었다'), '되물음 모드로 들어가지 않았다(검사 전제 불성립)');
  assert.ok(prompt.includes('반드시 채운다'), '되물은 턴인데 답을 반드시 채우라고 말하지 않는다');
  assert.ok(!prompt.includes('아니면 빈 문자열'), '되물은 턴인데 서식이 여전히 빈 문자열을 허락한다');
});
