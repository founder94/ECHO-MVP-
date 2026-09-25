// [MOCK] Minimal Agent B 서버 결정 검사 — 가짜 AI 응답으로 저장/비저장·정정·거절·의도 차단·재시도 상한·형식·상태 전환만 본다.
// 대화 품질(자연스러움·이어짐)은 이 검사로 판정하지 않는다. 실AI PASS 로 쓰지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newBState, runBTurn, buildBInput, B_MAX_CALLS, B_PARAMS, B_SYSTEM } from './agentB.mjs';

const reply = (o) => JSON.stringify({ turn_type: 'answer', answer_to_user: '', basis_quote: '', understanding: '', curiosity: '', question_intent: '', same_intent_as: '', next_question: '', memory_candidate: { text: '', quote: '' }, ...o });
const script = (...outs) => { const calls = []; const fn = async (system, user, params) => { calls.push({ system, user: JSON.parse(user), params }); return outs[Math.min(calls.length - 1, outs.length - 1)]; }; fn.calls = calls; return fn; };

test('[MOCK] LLM 입력에 remaining·answered_count·주제·칸 순서 없음 · A 와 같은 모델 조건', async () => {
  const s = newBState('편하게 지낼 친구');
  const input = buildBInput(s, '가볍게 우선 사람을 알아가고 싶어');
  for (const k of ['remaining', 'answered_count', 'topic', 'topics', 'next_topic', 'slots']) assert.equal(k in input, false, k);
  assert.deepEqual(B_PARAMS, { temperature: 0.2, top_p: 0.9, max_tokens: 768 });
  assert.doesNotMatch(B_SYSTEM, /몇 턴|남은|다섯 칸|remaining/);
});

test('[MOCK] 정상 답: 1번 호출 · 저장 · 질문 의도 기록', async () => {
  const s = newBState('친구');
  const llm = script(reply({ question_intent: '알아가는 방식', next_question: '처음엔 어떻게 알아가는 게 편해요?' }));
  const r = await runBTurn(s, '가볍게 우선 사람을 알아가고 싶어', llm);
  assert.equal(r.obs.calls, 1); assert.equal(r.response.saved, true); assert.equal(s.askedIntents[0], '알아가는 방식');
});

test('[MOCK] 이미 물은 의도(정규화 후 같음) → 서버 차단 → 1번 더 → 그래도 같으면 실패(상한 2)', async () => {
  const s = newBState('친구'); s.askedIntents.push('알아가는 방식'); s.lastIntent = '알아가는 방식';
  const llm = script(reply({ question_intent: '알아가는  방식!', next_question: '어떻게 알아가고 싶어요?' }));
  const r = await runBTurn(s, '천천히', llm);
  assert.equal(r.obs.calls, B_MAX_CALLS); assert.deepEqual(r.obs.retry, ['asked_intent', 'asked_intent']);
  assert.equal(r.response.question, null); assert.equal(r.response.error, 'QUESTION_FAILED');
  assert.match(llm.calls[1].user.previous_attempt.why, /이미 물었다/);
});

test('[MOCK] 문제제기(repair): 저장 0 · 직전 질문 의도를 거절 목록에 · 같은 의도 재질문 차단', async () => {
  const s = newBState('친구'); s.records.push({ text: '행동으로 보여줄때', type: 'answer', valid: true }); s.lastIntent = '진심의 형태'; s.askedIntents.push('진심의 형태'); s.lastQuestion = '진심을 어떻게 느껴요?';
  const llm = script(reply({ turn_type: 'repair', answer_to_user: '맞아요, 이미 말해 주셨어요.', question_intent: '진심의 형태', next_question: '진심은 어떨 때 느껴요?' }),
    reply({ turn_type: 'repair', answer_to_user: '맞아요, 이미 말해 주셨어요.', question_intent: '행동을 보여 주는 구체적 장면', next_question: '어떤 행동을 봤을 때 마음이 열려요?' }));
  const r = await runBTurn(s, '몇번째 같은말이야!!', llm);
  assert.equal(r.response.saved, false); assert.equal(s.records.length, 1);
  assert.ok(s.rejectedIntents.includes('진심의 형태'));
  assert.equal(r.obs.retry[0], 'rejected_intent'); assert.equal(r.response.question, '어떤 행동을 봤을 때 마음이 열려요?');
});

test('[MOCK] 되묻기(ask): 먼저 답 · 저장 0 · 같은 질문 유지 · 의도 기록 0', async () => {
  const s = newBState('친구'); s.lastQuestion = '처음엔 어떻게 알아가는 게 편해요?';
  const llm = script(reply({ turn_type: 'ask', answer_to_user: '어떤 사람을 소개할지 정하려고 여쭤봐요.' }));
  const r = await runBTurn(s, '왜 그걸 물어봐?', llm);
  assert.equal(r.response.saved, false); assert.equal(r.response.reply, '어떤 사람을 소개할지 정하려고 여쭤봐요.'); assert.equal(r.response.question, s.lastQuestion); assert.equal(s.askedIntents.length, 0);
});

test('[MOCK] 정정: 저장 · 정정 최신 · 직전 AI 문장을 거절 목록에 · 다음 입력의 correction 으로 전달', async () => {
  const s = newBState('친구'); s.lastQuestion = '마음이 중요하다는 거죠?';
  const llm = script(reply({ turn_type: 'correction', question_intent: '행동으로 느끼는 순간', next_question: '어떤 행동에서 그게 느껴져요?' }));
  await runBTurn(s, '마음이 아니라 행동이라고!!', llm);
  assert.equal(s.corrections.at(-1), '마음이 아니라 행동이라고!!'); assert.ok(s.rejected.includes('마음이 중요하다는 거죠?'));
  assert.equal(buildBInput(s, 'x').correction, '마음이 아니라 행동이라고!!');
});

test('[MOCK] 모르겠어요: 저장하되 유효 답 아님 · 유효 답 5개면 상태 전환(LLM 호출 0으로 끝나지 않고 저장 뒤 전환)', async () => {
  const s = newBState('친구');
  for (let i = 0; i < 4; i++) await runBTurn(s, `답${i}`, script(reply({ question_intent: `의도${i}`, next_question: `질문${i}?` })));
  await runBTurn(s, '모르겠어요', script(reply({ turn_type: 'unsure', question_intent: '쉬운 쪽', next_question: '쉬운 질문?' })));
  assert.equal(s.phase, 'conversation');
  const r = await runBTurn(s, '같이 산책하고 싶어요', script(reply({ question_intent: '산책', next_question: '어디로?' })));
  assert.equal(r.response.finished, true); assert.equal(s.phase, 'synthesis');
  const after = await runBTurn(s, '또 말할래', script(reply({})));
  assert.equal(after.obs.calls, 0); assert.equal(after.response.finished, true);
});

test('[MOCK] 저장 금지 입력(연락처): LLM 0번 · 저장 0', async () => {
  const s = newBState('친구'); const llm = script(reply({}));
  const r = await runBTurn(s, '제 번호 010-1234-5678 이에요', llm);
  assert.equal(llm.calls.length, 0); assert.equal(r.obs.calls, 0); assert.equal(s.records.length, 0);
});

test('[MOCK] 형식 실패(JSON 아님) 뒤 1번 더 · 그래도 못 읽으면 저장 0', async () => {
  const s = newBState('친구');
  const r = await runBTurn(s, '할말이없다 휴', script('not json', 'still not'));
  assert.equal(r.obs.calls, 2); assert.equal(r.response.saved, false); assert.equal(r.response.error, 'READ_FAILED'); assert.equal(s.records.length, 0);
});

test('[MOCK] 물음표 두 개 · 금지어 → 서버 차단', async () => {
  const s = newBState('친구');
  const r = await runBTurn(s, '취미생활?', script(reply({ question_intent: 'a', next_question: '뭐 해요? 언제 해요?' }), reply({ question_intent: 'b', next_question: '소개팅 해 봤어요?' })));
  assert.deepEqual(r.obs.retry, ['multi', 'unsafe']);
});
