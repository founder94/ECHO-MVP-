// v3.2 판정식 사전 점검(대표 「v3.2 SERVER FINAL FIX」 §4 · 실제 run 전 · 결과 보기 전). run 34 에서 드러난 판정식 오탐 2개와 새 지표 7개를 run 34 와 같은 모양의 합성 행으로 확인한다.
// 실행: NODE_PATH=<tools>/node_modules node --experimental-strip-types --test spike/agent-v1-20260925/metrics-v32.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
process.env.OPENAI_API_KEY = '';
const { stats, questionActH } = await import('./run-prod-agent.mjs');
const A = await import('./candidates/agent-v3.2.ts');
const row = (o) => ({ i: 1, text: '', expect: 'answer', kind: 'answer', saved: false, extracted: [], reply: null, ack: null, question: null, qtype: null, qpurpose: null, finish: false, after: false, recovered: [], hint: null, error: null, retry: [], calls: [], total_ms: 0, core_before: 0, core_after: 0, confirmed_before: [], confirmed_after: [], prev_qtext: null, prev_qpurpose: null, intro_status: null, ...o });
const run = (flow, rows, extra = {}) => ({ flow, tone: 'polite', rows, profile: A.matchingProfile(A.newState({ tone: 'polite' })), core: 4, clarify: 0, phase: 'done', intro: { status: 'ready', lines: [] }, items: [], seed: null, handoff: null, ...extra });

test('① 감정 짐작: 「대화가」의 「화가」 오탐 0 · 사용자가 앞서 쓴 감정 말은 근거로 인정 · 진짜 짐작은 셈(run 34 3 → 0)', () => {
  const r = run('F3', [
    row({ i: 1, text: '연애로 이어질 만남을 원해요. 부담스럽지 않은 선에서 연락하고 싶어요' }),
    row({ i: 2, text: '무슨 뜻이야?', kind: 'help', reply: '대화가 잘 통한다는 건 서로 생각을 쉽게 나눈다는 뜻이에요.' }),
    row({ i: 3, text: '예를 들면?', kind: 'help', reply: '예를 들어, 부담스럽지 않은 연락은 카톡으로 가볍게 안부 묻기예요.' }),
  ]);
  const s = stats(A, [r]);
  assert.equal(s.emotion_assumption_ack, 2, '옛 식은 둘 다 셌다');
  assert.equal(s.emotion_assumption_v32, 0);
  const bad = run('F1', [row({ i: 1, text: '담배는 싫어요', reply: '담배 때문에 많이 힘드셨겠어요.' })]);
  assert.equal(stats(A, [bad]).emotion_assumption_v32, 1, '사용자가 말하지 않은 감정은 셈');
});

test('② 조기 종료(최신 종료 계약): 충분히 들었거나 더 들을 게 없어 마친 것은 아님 · 물음·불만에 끝냄 · 거의 모르는데 끝냄은 셈', () => {
  const enough = run('F2', [row({ i: 5, text: '외모도 좀 받쳐줬으묜 해', finish: true, prev_qpurpose: 'boundaries', confirmed_after: ['relationship_intent', 'attraction_comfort', 'values_character'], core_after: 4, saved: true })]);
  const stalled = run('F1', [row({ i: 5, text: '외롭진 않지', action: 'FOLLOW', confirmed_after: ['attraction_comfort'] }), row({ i: 6, text: '웅', finish: true, prev_qpurpose: 'boundaries', confirmed_after: ['attraction_comfort'], core_after: 4 })]);
  const onQuestion = run('FLOW6', [row({ i: 3, text: '질문했는데 답을 못햐?', kind: 'repair', finish: true, confirmed_after: ['relationship_intent', 'values_character'] })]);
  const thin = run('H_JOKE', [row({ i: 2, text: '농담이야 ㅎㅎ', finish: true, confirmed_after: [] })]);
  const stopped = run('F6', [row({ i: 3, text: '질문이 너무 많아', kind: 'stop', finish: true, confirmed_after: [] })]);
  const s = stats(A, [enough, stalled, onQuestion, thin, stopped]);
  assert.equal(s.early_finish_v213, 2, '옛 식은 정상 마침(enough · stalled)을 셌고 물음·거의 모름 마침은 못 셌다');
  assert.equal(s.early_finish_v32, 2, '물음에 끝냄 · 거의 모르는데 끝냄만');
});

test('③ 한 턴 질문 2개: 물음표 없는 받아주기 질문도 셈 · 짚는 말은 질문 아님', () => {
  const r = run('F1', [
    row({ i: 1, text: '친구같이 편한사람', ack: '친구처럼 편한 사람과 있으면 어떤 순간이 가장 좋으세요', question: '요즘 만남에서 특히 중요하게 생각하는 점은 뭐예요' }),
    row({ i: 2, text: '다정한 사람', ack: '어떤 이야기를 주로 나누는지 궁금해요.', question: '주말엔 뭐 해요?' }),
    row({ i: 3, text: '주말에 한 번', ack: '어떤 사람이 좋은지 알 것 같아요.', question: '주말엔 보통 뭐 해요?' }),
    row({ i: 4, text: '응', ack: '천천히 알아가고 싶다고 하셨죠. 그 말씀이 기억나요.', question: '연락은 언제가 편해요?' }),
  ]);
  assert.equal(stats(A, [r]).double_question_turns, 2);
  assert.equal(questionActH('편한 사람이라고 하셨는데, 같이 있으면 어떤 점이 편하게 느껴지세요'), true);
});

test('④ 끝난 뒤 질문 발화 · ⑥ 끝난 뒤 불만에 일반 듣기 문장', () => {
  const r = run('F5', [
    row({ i: 6, text: '담배는 싫어요', after: true, ack: '담배는 싫다고 하셨네요. 평소에 담배 냄새가 나는 곳은 피하는 편이신가요' }),
    row({ i: 7, text: '느낌 근데 질문이 왜케 많아?', after: true, kind: 'repair', ack: '네, 이어서 편하게 말해 주세요.' }),
    row({ i: 8, text: '응', after: true, ack: '알겠어요.' }),
  ]);
  const s = stats(A, [r]);
  assert.equal(s.after_close_question_acts, 1);
  assert.equal(s.close_complaint_generic, 1);
});

test('⑤ 지친 신호 뒤 계속: 「질문이 너무 많아」에 안 마침 · 질문 양 지적에 질문 · 「다음 질문으로 넘어가」는 세지 않음', () => {
  const r = run('F6', [
    row({ i: 3, text: '질문이 너무 많아', kind: 'repair', ack: '매일 연락하는 게 좋다고 하셨죠.', question: '평소에 연락할 때 어떤 방식이 가장 편하세요' }),
    row({ i: 4, text: '근데 질문이 왜케 많아?', kind: 'repair', ack: '질문이 많게 느껴졌군요.', question: '요즘 어떤 만남이 좋아요?' }),
    row({ i: 5, text: '다음 질문으로 넘어가', kind: 'skip', question: '주말엔 뭐 해요?' }),
    row({ i: 6, text: '여기까지만 할래', kind: 'stop', finish: true }),
  ]);
  assert.equal(stats(A, [r]).fatigue_continued, 2);
});

test('⑦ 소개 뒤집힘: 바라는 상대 → 「저는 그런 사람」만 셈 · 자기 이야기·바람 문장은 세지 않음', () => {
  const r = run('F6', [row({ i: 1, text: 'x', finish: true })], { intro: { status: 'ready', lines: [
    { text: '저는 약속을 잘 지키는 사람입니다.', basis: '약속 잘 지키는 사람' },
    { text: '거짓말을 하지 않는 사람입니다.', basis: '거짓말 안 하는 사람' },
    { text: '약속을 잘 지키는 사람이 좋아요.', basis: '약속 잘 지키는 사람' },
    { text: '저는 먼저 다가가는 편이에요.', basis: '나는 오히려 먼저 다가가는 편이야' },
  ] } });
  assert.equal(stats(A, [r]).role_reversal_in_intro, 2);
});
