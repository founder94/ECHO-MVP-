// core-0.1 검사 — 가짜 AI(고정 JSON)로 서버 결정만 본다. 실제 AI 품질은 이 검사로 알 수 없다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from './core.mjs';

const fake = (...outs) => { const calls = []; const llm = async (kind, prompt, input) => { calls.push({ kind, input }); const o = outs.shift(); if (o instanceof Error) throw o; return typeof o === 'string' ? o : JSON.stringify(o); }; return { llm, calls }; };
const T = (o) => ({ kind: 'answer', understood: '', reply: '그렇군요.', remember: [], wrong: [], question: null, ...o });

test('정상 답: 원문 인용이 이번 말에 있는 기억만 들은 정보가 된다(띄어쓰기 무시) · 지어낸 인용은 버린다', async () => {
  const st = C.newState({ firstQuestion: '어떤 만남을 원하세요?' });
  const { llm } = fake(T({ remember: [{ area: 'pace', note: '천천히 알아가고 싶음', quote: '천천히알아가고' }, { area: 'values', note: '돈이 중요', quote: '돈이 중요해' }], question: '어떤 사람과 있을 때 편해요?' }));
  const { response } = await C.runTurn(st, '부담 없이 천천히 알아가고 싶어', llm);
  assert.equal(response.saved, true);
  assert.deepEqual(C.liveFacts(st).map((f) => f.area), ['pace']);
  assert.equal(response.question, '어떤 사람과 있을 때 편해요?');
  assert.equal(st.lastQuestion, '어떤 사람과 있을 때 편해요?');
  assert.equal(st.audit.at(-1).dropped_quotes, 1);
});

test('항의(repair): 매칭 정보로 저장하지 않음 · 직전 AI 질문을 문제 삼은 질문으로 남김 · 틀린 기억은 거둠', async () => {
  const st = C.newState({ firstQuestion: 'Q0' });
  const { llm } = fake(T({ remember: [{ area: 'values', note: '진심', quote: '진심' }], question: '진심은 어떤 모습이에요?' }),
    T({ kind: 'repair', remember: [{ area: 'values', note: '또 적음', quote: '적었잖아' }], wrong: ['진심'], reply: '제가 잘못 물었어요. 진심이라고 하셨죠.', question: '그 진심은 어떤 때 느껴져요?' }));
  await C.runTurn(st, '진심', llm);
  const { response } = await C.runTurn(st, '적었잖아', llm);
  assert.equal(response.saved, false);
  assert.equal(st.turns.at(-1).saved, false);
  assert.deepEqual(st.disputed, ['진심은 어떤 모습이에요?']);
  assert.equal(C.liveFacts(st).length, 0);
  assert.equal(response.question, '그 진심은 어떤 때 느껴져요?', '항의 뒤에도 고친 맥락에서 이어 물을 수 있다');
});

test('정정(correction): 최신 정정을 남기고 새 뜻을 기억 · 고치기 전 기억은 거둠', async () => {
  const st = C.newState({ firstQuestion: 'Q0' });
  const { llm } = fake(T({ remember: [{ area: 'person', note: '같이 운동할 사람', quote: '운동' }] }),
    T({ kind: 'correction', remember: [{ area: 'person', note: '편하게 대화하는 사람', quote: '편하게 대화하는 사람' }], wrong: ['같이 운동할 사람'] }));
  await C.runTurn(st, '운동 좋아해', llm);
  await C.runTurn(st, '그 말 말고 편하게 대화하는 사람을 원한다는 거예요', llm);
  assert.deepEqual(st.corrections, ['그 말 말고 편하게 대화하는 사람을 원한다는 거예요']);
  assert.deepEqual(C.liveFacts(st).map((f) => f.note), ['편하게 대화하는 사람']);
  assert.equal(st.facts.find((f) => f.note === '같이 운동할 사람').status, 'retracted');
});

test('AI 에게 한 질문(ask): 저장 0 · 반응(답)과 질문을 그대로 돌려줌', async () => {
  const st = C.newState({ firstQuestion: 'Q0' });
  const { llm } = fake(T({ kind: 'ask', reply: '네, AI도 틀릴 수 있어요.', remember: [{ area: 'values', note: 'x', quote: '오타' }], question: '어떤 만남을 원하는지 편하게 말해 줄래요?' }));
  const { response } = await C.runTurn(st, 'ai가 오타 날수도 있어?', llm);
  assert.equal(response.saved, false);
  assert.equal(response.reply, '네, AI도 틀릴 수 있어요.');
  assert.equal(C.liveFacts(st).length, 0);
});

test('질문 문장을 서버가 심사하지 않는다: 앞과 글자까지 같은 질문도 그대로 둔다(판단은 AI·사용자 몫) · 금지어만 뺀다', async () => {
  const st = C.newState({ firstQuestion: '어떤 사람이 편해요?' });
  const { llm } = fake(T({ question: '어떤 사람이 편해요?' }), T({ question: '궁합이 중요한가요?' }));
  assert.equal((await C.runTurn(st, '음', llm)).response.question, '어떤 사람이 편해요?');
  assert.equal((await C.runTurn(st, '글쎄', llm)).response.question, null);
});

test('네 영역을 다 들으면 질문 없이 마무리 1번 · 매칭 재료는 서버 상태에서(요약이 아님)', async () => {
  const st = C.newState({ purpose: '편하게 지낼 친구를 원해요', firstQuestion: 'Q0' });
  const { llm, calls } = fake(
    T({ remember: [{ area: 'person', note: '배려하는 사람', quote: '배려' }, { area: 'values', note: '행동으로 보여줌', quote: '행동' }], question: '더?' }),
    T({ remember: [{ area: 'pace', note: '천천히', quote: '천천히' }], question: '그럼 또?' }),
    { summary: [{ area: 'person', text: '배려' }], closing: '이제 조금 알 것 같아요.' });
  const r1 = await C.runTurn(st, '배려하고 행동으로 보여주는 사람', llm);
  assert.equal(r1.response.finish, false);
  const r2 = await C.runTurn(st, '천천히', llm);
  assert.equal(r2.response.finish, true);
  assert.equal(r2.response.question, null);
  assert.equal(r2.response.closing, '이제 조금 알 것 같아요.');
  assert.equal(calls.filter((c) => c.kind === 'closing').length, 1);
  assert.deepEqual(r2.response.profile.areas.intent.map((x) => x.note), ['편하게 지낼 친구를 원해요']);
  assert.equal(st.phase, 'done');
});

test('그만하고 싶다(stop): 들은 만큼으로 마무리 · 끝난 뒤에도 새 말이 오면 다시 이어감', async () => {
  const st = C.newState({ firstQuestion: 'Q0' });
  const { llm } = fake(T({ kind: 'stop', question: '더 말해 줄래요?' }), { summary: [], closing: '정리해 둘게요.' }, T({ kind: 'correction', reply: '알겠어요.', question: '어떤 점이요?' }));
  const r = await C.runTurn(st, '그만할래', llm);
  assert.equal(r.response.finish, true); assert.equal(r.response.question, null); assert.equal(st.phase, 'done');
  const r2 = await C.runTurn(st, '아 그게 아니라', llm);
  assert.equal(st.phase, 'talk'); assert.equal(r2.response.question, '어떤 점이요?');
});

test('저장 금지 입력은 AI 를 부르지 않는다 · 형식이 두 번 깨지면 실패를 그대로 알린다(대신 쓰는 고정 질문 0)', async () => {
  const st = C.newState({ firstQuestion: 'Q0' });
  const a = fake();
  assert.equal((await C.runTurn(st, '010-1234-5678 로 연락줘', a.llm)).response.kind, 'blocked');
  assert.equal(a.calls.length, 0);
  const b = fake('not json', '{"kind":"nope"}');
  const r = await C.runTurn(st, '안녕', b.llm);
  assert.equal(r.response.error, 'READ_FAILED'); assert.equal(r.obs.calls, 2); assert.equal(r.response.question, undefined);
  const c = fake('oops', T({ question: '네?' }));
  assert.equal((await C.runTurn(st, '안녕', c.llm)).obs.calls, 2);
});

test('AI 입력에는 주제 순서·남은 수·질문 목록이 없다 · 아직 모르는 영역만 방향으로', () => {
  const st = C.newState({ purpose: '연애로 이어질 만남을 원해요', firstQuestion: 'Q0' });
  const input = C.turnInput(st, '안녕');
  assert.deepEqual(Object.keys(input).sort(), ['corrections', 'disputed', 'heard', 'last_ai', 'latest', 'not_yet_known', 'recent', 'service_facts'].sort());
  assert.deepEqual(input.not_yet_known.map((a) => a.area), ['person', 'values', 'pace']);
  assert.ok(!/활동|취미/.test(C.TURN_PROMPT + C.OPENING_PROMPT + C.CLOSING_PROMPT), '프롬프트가 특정 주제 낱말로 방향을 주지 않는다');
});

test('첫 말: 원하는 만남을 묻는 질문을 AI 가 만든다(고정 문장 0) · 비었거나 금지어면 실패로 돌려줌', async () => {
  const st = C.newState();
  assert.deepEqual(await C.runOpening(st, fake({ reply: '', question: '어떤 만남을 원하는지 편하게 말해 주세요?' }).llm), { reply: '', question: '어떤 만남을 원하는지 편하게 말해 주세요?' });
  assert.equal(st.lastQuestion, '어떤 만남을 원하는지 편하게 말해 주세요?');
  assert.equal(await C.runOpening(C.newState(), fake({ reply: '', question: '' }).llm), null);
});

test('휴대폰 시험 페이지는 이 core.mjs 를 글자 그대로 담는다(export 낱말만 뺌) · 저장된 page.html 이 지금 만든 것과 같다', async () => {
  const { readFileSync } = await import('node:fs');
  const { buildPage, inlineCore } = await import('./build-page.mjs');
  const url = (f) => new URL(f, import.meta.url);
  const page = readFileSync(url('page.html'), 'utf8');
  assert.equal(page, buildPage());
  assert.ok(page.includes(inlineCore(readFileSync(url('core.mjs'), 'utf8'))));
  assert.ok(!/https?:\/\/(?!fonts\.g)/.test(page.replace(/https:\/\/fonts\.googleapis\.com[^"]*/g, '')), '페이지가 바깥 주소를 부르지 않는다(글꼴만)');
});
