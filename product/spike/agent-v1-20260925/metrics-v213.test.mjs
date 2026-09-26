// v2.13 판정식 사전 점검(run 32 사전 등록 전 · 결과 보기 전). run 31 에서 드러난 식 결함 2개를 run 31 과 같은 모양의 합성 행으로 확인한다.
// 실행: NODE_PATH=<tools>/node_modules node --experimental-strip-types --test spike/agent-v1-20260925/metrics-v213.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
process.env.OPENAI_API_KEY = '';
const { stats } = await import('./run-prod-agent.mjs');
const A = await import('./candidates/agent-v2.13.ts');
const row = (o) => ({ i: 1, text: '', expect: 'answer', kind: 'answer', saved: false, extracted: [], reply: null, ack: null, question: null, qtype: null, qpurpose: null, finish: false, after: false, recovered: [], hint: null, error: null, retry: [], calls: [], total_ms: 0, core_before: 0, core_after: 0, confirmed_before: [], confirmed_after: [], prev_qtext: null, prev_qpurpose: null, intro_status: null, ...o });
const run = (flow, rows, extra = {}) => ({ flow, tone: 'polite', rows, profile: A.matchingProfile(A.newState({ tone: 'polite' })), core: 4, clarify: 0, phase: 'done', intro: { status: 'ready', lines: [] }, items: [], seed: null, handoff: null, ...extra });

test('① 마무리 고정 문장은 미확정 사실화로 세지 않는다(run 31 식 결함 28 → 0)', () => {
  const r = run('F1', [row({ text: '진실된마음', ack: '진실된 마음을 원하시는군요.', reply: '진실된 마음을 원하시는군요. 이제 조금 알 것 같아요.', finish: true })]);
  const s = stats(A, [r]);
  assert.equal(s.unconfirmed_fact_ack, 1, 'run 31 식은 마무리 문장을 셌다');
  assert.equal(s.unconfirmed_fact_ack_v213, 0);
  const bad = run('F7', [row({ text: '돈때문에', ack: '돈 때문에 고민이 있으시군요.', reply: '돈 때문에 고민이 있으시군요.' })]);
  assert.equal(stats(A, [bad]).unconfirmed_fact_ack_v213, 0, '「돈」 겹침이 있으면 군요형은 세지 않음(식 그대로)');
  const bad2 = run('F7', [row({ text: '딥하네', ack: '어떤 만남이 좋을지 고민하고 계신 것 같아요.' })]);
  assert.equal(stats(A, [bad2]).unconfirmed_fact_ack_v213, 1, '근거 없는 짐작은 셈');
});

test('② 핵심 질문 4개로 정상 마친 판은 조기 종료가 아니다 · run 31 FLOW6 모양만 조기 종료(14 → 1)', () => {
  const normal = run('F2', [row({ text: '주말에 한 번', finish: true, prev_qpurpose: 'relationship_style', confirmed_after: ['relationship_style'], core_after: 4 })]);
  const flow6 = run('FLOW6', [row({ text: '질문했는데 답을 못햐?', kind: 'repair', expect: 'repair', finish: true, prev_qpurpose: 'attraction_comfort', confirmed_after: [], core_after: 2 })], { core: 2 });
  const stopped = run('F4', [row({ text: '그만할래', kind: 'stop', finish: true, prev_qpurpose: 'boundaries', core_after: 3 })], { core: 3 });
  const s = stats(A, [normal, flow6, stopped]);
  assert.equal(s.early_finish_runs, 2, 'run 31 식은 정상 마침까지 셌다');
  assert.equal(s.early_finish_v213, 1);
});

test('③ 메타·불만 판정식: 같은 질문 다시 밀기 · 끝내기 · 사실 저장 · 불만 뒤 답 유실 · 빈 받아주기', () => {
  const q = '같이 있으면 편한 사람은 어떤 사람이에요?';
  const r = run('CEO_META', [
    row({ i: 1, text: '우리회사 개발얘기했는데 질문이 뭐야?', kind: 'ask', expect: 'ask', question: q, prev_qtext: q, ack: '' }),
    row({ i: 2, text: '내가 적는거랑 상관없이 질문하네', kind: 'repair', expect: 'repair', finish: true, ack: '엉뚱하게 물었네요.' }),
    row({ i: 3, text: '조용한 사람이 좋아', expect: 'answer', saved: false }),
  ], { items: [{ status: 'CONFIRMED', quote: '상관없이 질문하네', note: '', turn: 2 }, { status: 'CONFIRMED', quote: '조용한 사람', note: '', turn: 3 }] });
  const s = stats(A, [r]);
  assert.equal(s.redirect_turns, 2);
  assert.equal(s.complaint_forced_question, 1);
  assert.equal(s.redirect_finish, 1);
  assert.equal(s.meta_saved_as_fact, 1, '「조용한 사람」은 불만 문장이 아니라 세지 않음');
  assert.equal(s.post_redirect_answer_lost, 1);
  assert.equal(s.redirect_empty_reply, 1);
  const ok = run('CEO_META', [row({ i: 1, text: '고정질문으로 바뀐거니?', kind: 'ask', expect: 'ask', ack: '정해진 질문 목록은 없어요.', question: '회사 얘기 하셨는데 요즘 어떤 사람이 편해요?', prev_qtext: q })]);
  const s2 = stats(A, [ok]);
  for (const k of ['complaint_forced_question', 'redirect_finish', 'meta_saved_as_fact', 'post_redirect_answer_lost', 'redirect_empty_reply']) assert.equal(s2[k], 0, k);
});
