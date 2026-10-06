// SCENE 3 "그게 아니에요" 전체 사슬을 한 번에 증명한다(대표 지시 검증 항목).
//   ① 버튼 → 서버 상태 변경(understanding → followup)
//   ② 거절한 해석·정정 내용이 DB 에 그대로 저장
//   ③ 전략 변경: 다음 프롬프트에 [거절한 해석]과 [직접 설명·정정한 내용]이 실제로 들어간다
//   ④ 같은 뜻의 후보는 서버가 차단한다(LLM 이 아니라 서버가 고른다)
//   ⑤ 실제 다음 질문이 거절한 해석이 아니라 정정 내용에서 나온다
// 실제 OpenAI 호출 없음(가짜 fetch). 사용자 원문은 로그에 남기지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDatabase, loadEdgeHandler, invoke, token } from './_edge-harness.mjs';

const MIND = '오늘은 마음이 편안해요';
const STEP1_ANSWER = '일이 끝나서 그런 것 같아요';
const STEP2_ANSWER = '정리가 되니까 좋아요';
const WRONG_UNDERSTANDING = '인정받고 싶은 마음이 크신 것 같아요.';
const CORRECTION = '사실은 몸이 피곤해서 그런 거예요';

// 서버가 버려야 할 후보(거절한 해석과 같은 뜻) + 살려야 할 후보(정정에서 나온 뜻)
// 문장은 앞 질문·거절 문장과 겹치지 않게 두고, '뜻(keys)'만 거절한 해석과 같게 만든다.
// 그래야 이 후보를 막는 것이 '반복 규칙'이 아니라 '거절 의미 차단'임이 증명된다.
const REVIVES_REJECTED = {
  acknowledgement: '피곤해서 그러셨군요.',
  question: '남들 눈에 어떻게 보이고 싶은지 말해줄 수 있나요?',
  anchor: '피곤해서',
  assumptions: [],
  meaning: '인정 욕구를 다시 확인',
  keys: ['인정받고'],
  reply: '',
};
const FROM_CORRECTION = {
  acknowledgement: '몸이 피곤해서 그러셨군요.',
  question: '그 피곤함은 하루 중 언제 가장 크게 올라오나요?',
  anchor: '피곤해서',
  assumptions: [],
  meaning: '피로가 드러나는 때를 묻는다',
  keys: ['피로'],
  reply: '',
};

function createAiFetch() {
  const calls = { systemPrompts: [], jsonCalls: 0 };
  const fetch = async (_url, options = {}) => {
    const request = JSON.parse(options.body);
    const system = String(request.messages?.[0]?.content ?? '');
    calls.systemPrompts.push(system);
    let content;
    if (request.response_format) {
      calls.jsonCalls += 1;
      // 서버가 고르는지 보려고 '막혀야 할 후보'를 일부러 먼저 준다.
      content = JSON.stringify({ candidates: [REVIVES_REJECTED, FROM_CORRECTION] });
    } else if (system.includes('요약해라')) {
      content = WRONG_UNDERSTANDING;
    } else {
      content = [
        '1. 오늘 편안한 마음은 어떤 순간에 가장 크게 느껴지나요?',
        '2. 일이 끝나서 달라진 점은 무엇인가요?',
        '3. 정리가 되니까 좋다는 건 어떤 뜻인가요?',
      ].join('\n');
    }
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls };
}

test('SCENE 3: 그게 아니에요 → 서버 상태 변경 → 전략 변경 → 실제 다음 질문 변경', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const u = 'scene3-user';

  const started = await invoke(early, u, { action: 'start', mindText: MIND, token: token('s3-start') });
  const conversationId = started.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId, token: token('s3-ask1') });
  await invoke(early, u, { action: 'answer', conversationId, answer: STEP1_ANSWER, token: token('s3-ans1') });
  await invoke(early, u, { action: 'ask', conversationId, token: token('s3-ask2') });
  const afterStep2 = await invoke(early, u, { action: 'answer', conversationId, answer: STEP2_ANSWER, token: token('s3-ans2') });
  assert.equal(afterStep2.body.status, 'understanding');

  const summary = await invoke(early, u, { action: 'ask', conversationId, token: token('s3-under') });
  assert.equal(summary.body.understanding, WRONG_UNDERSTANDING);

  // ① 버튼 → 서버 상태 변경
  const rejected = await invoke(early, u, { action: 'choose', conversationId, choice: 'no', text: CORRECTION, token: token('s3-no') });
  assert.equal(rejected.body.ok, true);
  assert.equal(rejected.body.status, 'followup', '그게 아니에요 가 서버 상태를 바꾸지 않았다');

  // ② 거절한 해석·정정이 그대로 저장
  const row = db.rows.understanding_results.at(-1);
  assert.equal(row.choice, 'no');
  assert.equal(row.rejected_interpretation, WRONG_UNDERSTANDING, '거절한 해석이 저장되지 않았다');
  assert.equal(row.correction_text, CORRECTION, '정정 내용이 저장되지 않았다');

  const promptsBefore = ai.calls.systemPrompts.length;
  const followup = await invoke(early, u, { action: 'ask', conversationId, token: token('s3-follow') });
  assert.equal(followup.body.ok, true);
  assert.equal(followup.body.status, 'followup');

  // ③ 전략 변경: 다음 프롬프트가 거절·정정을 실제로 싣는다
  const prompt = ai.calls.systemPrompts.slice(promptsBefore).join('\n');
  assert.ok(prompt.includes('[사용자가 거절한 해석'), '거절한 해석 블록이 프롬프트에 없다');
  assert.ok(prompt.includes(WRONG_UNDERSTANDING), '거절한 해석 원문이 프롬프트에 없다');
  assert.ok(prompt.includes('[사용자가 직접 설명·정정한 내용'), '정정 우선 블록이 프롬프트에 없다');
  assert.ok(prompt.includes(CORRECTION), '정정 원문이 프롬프트에 없다');

  // ④ 서버가 고른다: 거절한 뜻을 되살린 후보는 버리고 정정에서 나온 후보를 쓴다
  const shown = String(followup.body.question ?? '');
  // 공감 문장이 아니라 '질문 문장'으로 판정한다(공감 문장은 두 후보가 비슷할 수 있다).
  assert.ok(!shown.includes(REVIVES_REJECTED.question), `거절한 뜻의 후보가 화면에 나갔다: ${shown}`);
  assert.ok(!shown.includes(WRONG_UNDERSTANDING), '거절한 해석이 그대로 다시 나왔다');

  // ⑤ 실제 다음 질문이 정정 내용에서 나온다
  assert.ok(shown.includes(FROM_CORRECTION.question), `정정에서 나온 질문이 선택되지 않았다: ${shown}`);
  assert.match(shown, /\?$/);

  // 이어서 답하면 단계가 정상으로 이어진다(막다른 길 아님)
  const answered = await invoke(early, u, { action: 'answer', conversationId, answer: '저녁마다 특히 심해요', token: token('s3-ans3') });
  assert.equal(answered.body.ok, true);
  assert.equal(answered.body.status, 'understanding');
});
