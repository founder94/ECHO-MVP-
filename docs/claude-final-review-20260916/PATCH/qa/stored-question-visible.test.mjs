// 2026-09-17 실AI 100회 검사에서 나온 결함 재현:
//   [gsq] validate_fail reason=NOT_GROUNDED attempt=1 → single_ready attempts=2 relaxed=true
//   → 질문은 만들어져 DB 에 저장·커밋까지 됐는데 화면에는 빈 문자열이 나가고,
//     이어진 answer 가 INVALID_STATE("먼저 질문을 불러와 주세요") 로 끊겼다.
// 원인: 화면 표시 경로(latestOpenTurn)가 '저장된 질문'을 생성 때보다 센 규칙(근거 검사)으로
//       다시 검사해서 서버가 스스로 만든 질문을 스스로 지웠다.
// 실제 OpenAI 호출은 없다(가짜 fetch). 사용자 원문은 로그에 남기지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDatabase, loadEdgeHandler, invoke, token } from './_edge-harness.mjs';

const MIND = '요즘 너무 지쳐';
// 사용자 원문과 글자 겹침이 없는 질문 → 1차 시도는 NOT_GROUNDED, 2차(relaxed)에서 통과한다.
const CANDIDATES = [
  '그 마음이 하루 중 언제 가장 크게 올라오나요?',
  '그 상태를 옆에서 본다면 어떤 장면일까요?',
  '그때 몸에서 먼저 반응하는 곳은 어디인가요?',
];

function createAiFetch() {
  const calls = { openai: 0 };
  const fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    calls.openai += 1;
    const content = CANDIDATES.map((q, i) => `${i + 1}. ${q}`).join('\n');
    return new Response(JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 100, completion_tokens: 40 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

test('get-step-question: 완화된 시도로 만들어져 저장된 STEP 1 질문이 화면에도 그대로 나간다', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);

  const started = await invoke(early, 'user-1', { action: 'start', mindText: MIND, token: token('start') });
  assert.equal(started.body.status, 'step1');
  const conversationId = started.body.conversationId;

  const asked = await invoke(early, 'user-1', { action: 'ask', conversationId, token: token('ask1') });
  assert.equal(asked.body.status, 'step1');
  // 재현 전제: 1차 시도가 걸러지고 완화된 2차 시도에서 질문이 만들어졌다.
  assert.ok(ai.calls.openai >= 2, `완화 경로가 타지지 않았다 (openai=${ai.calls.openai})`);
  // 결함 지점: 저장된 질문이 빈 문자열로 나가면 안 된다.
  assert.notEqual(asked.body.question, '', '저장된 질문이 화면 응답에서 지워졌다');
  assert.equal(asked.body.needsQuestion, false, '서버가 질문을 만들고도 "질문 없음"이라고 답했다');

  // 이어지는 답변이 INVALID_STATE 로 끊기지 않아야 한다.
  const answered = await invoke(early, 'user-1', { action: 'answer', conversationId, answer: '일이 많아서 그런 것 같아', token: token('answer1') });
  assert.equal(answered.body.ok, true, `답변이 막혔다: ${answered.body.code ?? ''}`);
  assert.equal(answered.body.status, 'step2');
});
