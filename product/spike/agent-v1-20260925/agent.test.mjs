// echo-agent-v1 검사 — 가짜 AI(고정 JSON)로 서버 결정만 본다. 실제 AI 품질은 이 검사로 알 수 없다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from './agent.mjs';

const fake = (...outs) => { const calls = []; const llm = async (kind, prompt, input) => { calls.push({ kind, prompt, input }); const o = outs.shift(); if (o instanceof Error) throw o; if (o === undefined) throw new Error('no more fake outputs'); return typeof o === 'string' ? o : JSON.stringify(o); }; return { llm, calls }; };
const T = (o) => ({ kind: 'answer', understood: '', reply: '그렇군요.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const Q = (purpose, question, type = 'core') => ({ next: { type, purpose, question } });
const CLOSE = { summary: [], closing: '이제 조금 알 것 같아요.' };
async function opened(tone) { const st = A.newState({ tone }); await A.runOpening(st, fake({ reply: '', question: '어떤 만남을 원하는지 편하게 말해 주세요.' }).llm); return st; }

test('첫 질문: AI 가 만든 문장 = 핵심 질문 1(원하는 만남) · 목적 id 가 새어 나온 문장은 받지 않음', async () => {
  const st = await opened();
  assert.deepEqual(st.asked.map((q) => [q.type, q.purpose]), [['core', 'relationship_intent']]);
  assert.equal(await A.runOpening(A.newState(), fake({ reply: '', question: 'RELATIONSHIP_INTENT' }).llm), null, '대표 시험에서 실제로 나온 새어 나온 이름');
  assert.equal(await A.runOpening(A.newState(), fake({ reply: '', question: 'relationship_intent 를 말해 주세요?' }).llm), null);
});

test('핵심 질문은 5개를 넘지 않는다: AI 가 같은 목적만 계속 골라도 서버가 안 물은 목적으로 세고, 5개 뒤에는 질문 없이 마친다', async () => {
  const st = await opened();
  const outs = [];
  for (let i = 0; i < 5; i++) outs.push(T({ extracted: [], ...Q('relationship_intent', `질문 ${i + 2}?`) }));
  const { llm, calls } = fake(outs[0], outs[1], outs[2], outs[3], outs[4], CLOSE);
  const rs = [];
  for (const t of ['음', '글쎄', '편한 사람', '천천히', '거짓말 싫어']) rs.push((await A.runTurn(st, t, llm)).response);
  assert.equal(st.asked.filter((q) => q.type === 'core').length, 5);
  assert.deepEqual(st.asked.map((q) => q.purpose), A.PURPOSES.map((p) => p.id));
  assert.equal(rs.at(-1).finish, true); assert.equal(rs.at(-1).question, null);
  assert.equal(rs.at(-1).handoff.status, 'TEST_NOT_CONNECTED'); assert.deepEqual(rs.at(-1).handoff.candidates, []);
  assert.equal(calls.filter((c) => c.kind === 'closing').length, 1);
});

test('한 답이 여러 목적을 채우면 그 목적은 묻지 않는다 → 5개보다 적게 끝날 수 있다', async () => {
  const st = await opened();
  const { llm } = fake(
    T({ extracted: [{ purpose: 'relationship_intent', note: '친구 같은 편한 만남', quote: '친구같이 편한' }, { purpose: 'attraction_comfort', note: '어색하지 않은 사람', quote: '어색하지 않은' }, { purpose: 'relationship_style', note: '천천히', quote: '천천히' }], ...Q('values_character', '사람을 볼 때 뭘 제일 봐요?') }),
    T({ extracted: [{ purpose: 'values_character', note: '배려', quote: '배려' }, { purpose: 'boundaries', note: '거짓말은 싫음', quote: '거짓말은 싫어' }], ...Q('boundaries', '또 있어요?') }),
    CLOSE);
  await A.runTurn(st, '친구같이 편한 사람, 어색하지 않은 사람이랑 천천히', llm);
  const r = (await A.runTurn(st, '배려 그리고 거짓말은 싫어', llm)).response;
  assert.equal(r.finish, true); assert.equal(r.question, null, '다섯 목적을 다 들었으면 더 묻지 않는다');
  assert.equal(st.asked.filter((q) => q.type === 'core').length, 2);
});

test('되묻기: 목적마다 1번 · 대화 전체 2번 · 한도를 넘긴 되묻기는 안 물은 목적의 핵심 질문으로 센다', async () => {
  const st = await opened();
  const { llm } = fake(
    T({ kind: 'unsure', ...Q('relationship_intent', '어떤 뜻인지 한 번만 더 말해 줄래요?', 'clarify') }),
    T({ kind: 'unsure', ...Q('relationship_intent', '다시 한 번?', 'clarify') }));
  assert.equal((await A.runTurn(st, 'ㅁㄴㅇ', llm)).response.question_type, 'clarify');
  const r = (await A.runTurn(st, 'ㅋㅋ', llm)).response;
  assert.equal(r.question_type, 'core'); assert.equal(r.question_purpose, 'attraction_comfort');
  assert.equal(st.clarify.total, 1);
});

test('항의·넘기기·그만: 매칭 정보로 저장 0 · 넘긴 목적은 SKIPPED · 그만이면 들은 만큼으로 마침', async () => {
  const st = await opened();
  const { llm } = fake(
    T({ extracted: [{ purpose: 'relationship_intent', note: '편한 만남', quote: '편한' }], ...Q('attraction_comfort', '어떤 사람이 편해요?') }),
    T({ kind: 'repair', extracted: [{ purpose: 'attraction_comfort', note: 'x', quote: '말했' }], ...Q('values_character', '사람을 볼 때 뭘 봐요?') }),
    T({ kind: 'skip', ...Q('relationship_style', '천천히 알아가는 게 편해요?') }),
    T({ kind: 'stop', ...Q('boundaries', '더?') }), CLOSE);
  await A.runTurn(st, '편한 만남', llm);
  assert.equal((await A.runTurn(st, '아까 말했잖아', llm)).response.saved, false);
  await A.runTurn(st, '다음 질문', llm);
  assert.equal(st.slots.values_character.status, 'SKIPPED');
  const r = (await A.runTurn(st, '질문 너무 많아', llm)).response;
  assert.equal(r.finish, true); assert.equal(r.question, null);
  assert.equal(r.profile.attraction_comfort.items.length, 0);
  assert.deepEqual(r.profile.confirmed_preferences, ['편한 만남']);
});

test('매칭 프로필: 원문 인용 있는 것만 CONFIRMED · 추측은 INFERRED 로 따로 · MBTI·혈액형은 사용자가 직접 말했을 때만', async () => {
  const st = await opened();
  const { llm } = fake(T({ extracted: [{ purpose: 'relationship_intent', note: '진지한 만남', quote: '진지하게' }, { purpose: 'values_character', note: '돈', quote: '돈이 최고' }],
    inferred: [{ trait: '신중한 편', basis: '진지하게' }], declared: { mbti: 'infj', blood_type: 'A형', quote: '나 INFJ 고 A형' }, ...Q('attraction_comfort', '어떤 사람이 편해요?') }), T({ kind: 'stop' }), CLOSE);
  await A.runTurn(st, '진지하게 만나고 싶어 나 INFJ 고 A형이야', llm);
  const r = (await A.runTurn(st, '그만할래', llm)).response;
  assert.deepEqual(r.profile.confirmed_preferences, ['진지한 만남']);
  assert.deepEqual(r.profile.inferred_candidates, [{ trait: '신중한 편', basis: '진지하게', status: 'INFERRED' }]);
  assert.deepEqual(r.profile.mbti, { value: 'INFJ', status: 'CONFIRMED' }); assert.deepEqual(r.profile.blood_type, { value: 'A', status: 'CONFIRMED' });
  assert.equal(r.handoff.inferred_ignored, 1);
  const st2 = await opened();
  await A.runTurn(st2, '그냥 편한 사람', fake(T({ declared: { mbti: 'ENFP', blood_type: 'O', quote: '외향적' }, ...Q('attraction_comfort', '어떤 사람이 편해요?') })).llm);
  assert.equal(A.matchingProfile(st2).mbti.status, 'UNKNOWN', '말하지 않은 MBTI 는 사실이 되지 않는다(인용이 원문에 없음)');
});

test('끝난 뒤의 말은 고치기로만: 새 질문 0 · 틀린 것은 거두고 프로필이 바뀐다', async () => {
  const st = await opened();
  const { llm } = fake(T({ extracted: [{ purpose: 'relationship_intent', note: '연애', quote: '연애' }], ...Q('attraction_comfort', '어떤 사람이 편해요?') }), T({ kind: 'stop' }), CLOSE,
    T({ kind: 'correction', extracted: [{ purpose: 'relationship_intent', note: '친구 같은 만남', quote: '친구' }], wrong: ['연애'], ...Q('attraction_comfort', '또?') }));
  await A.runTurn(st, '연애', llm);
  await A.runTurn(st, '그만할래', llm);
  const r = (await A.runTurn(st, '연애 말고 친구야', llm)).response;
  assert.equal(r.question, null); assert.equal(r.after, true);
  assert.deepEqual(r.profile.relationship_intent.items.map((i) => i.note), ['친구 같은 만남']);
  assert.ok(r.profile.rejected_meanings.includes('연애'));
});

test('질문에 내부 id 가 새면 질문 없음으로 보고 한 번 다시 청함', async () => {
  const st = await opened();
  const a = fake(T({ ...Q('attraction_comfort', 'attraction_comfort 는 어때요?') }), T({ ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const r = await A.runTurn(st, '편한 만남', a.llm);
  assert.deepEqual(r.obs.retry, ['no_question']); assert.equal(r.response.question, '어떤 사람이 편해요?');
});

test('물을 목적이 남았는데 질문이 없으면 한 번만 다시 청함(상태 확인) · 형식이 두 번 깨지면 실패를 그대로 알림', async () => {
  const st = await opened();
  const a = fake(T({ ...Q('', '') }), T({ ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const r = await A.runTurn(st, '편한 만남', a.llm);
  assert.equal(r.obs.calls, 2); assert.deepEqual(r.obs.retry, ['no_question']); assert.equal(r.response.question, '어떤 사람이 편해요?');
  const b = fake('x', 'y');
  assert.equal((await A.runTurn(st, '음', b.llm)).response.error, 'READ_FAILED');
});

test('말투: 고른 말투가 매 턴 AI 에 전달됨(기본 = 편한 존댓말) · 저장 금지 안내도 말투를 따름 · 관측용 말투 판별', async () => {
  assert.equal(A.newState().tone, 'polite');
  const st = await opened('formal');
  const f = fake(T({ ...Q('attraction_comfort', '어떤 분이 편하신가요?') }));
  await A.runTurn(st, '편한 만남', f.llm);
  assert.ok(f.calls[0].prompt.includes('정중한 존댓말'));
  assert.ok(A.openingPrompt('casual').includes('편한 반말'));
  assert.equal((await A.runTurn(A.newState({ tone: 'casual' }), '010-1234-5678', fake().llm)).response.reply.endsWith('줘.'), true);
  assert.equal(A.toneMismatch('polite', '안녕! 오늘은 어떤 만남을 원해?'), true);
  assert.equal(A.toneMismatch('polite', '그렇군요. 어떤 사람이 편해요?'), false);
  assert.equal(A.toneMismatch('casual', '그렇구나. 어떤 사람이 편해?'), false);
  assert.equal(A.toneMismatch('casual', '그렇군요. 어떤 사람이 편해요?'), true);
});

test('AI 입력에 고정 질문·질문 목록이 없다 · 아직 안 물은 목적만 방향으로 · 목적은 다섯 개', () => {
  const st = A.newState();
  const input = A.turnInput(st, '안녕');
  assert.deepEqual(Object.keys(input).sort(), ['clarify_allowed', 'core_questions_left', 'corrections', 'current_question', 'disputed', 'heard', 'latest', 'open_purposes', 'recent', 'service_facts'].sort());
  assert.equal(A.PURPOSES.length, 5); assert.equal(A.MAX_CORE_QUESTIONS, 5);
  assert.ok(!/활동|취미/.test(A.turnPrompt('polite') + A.openingPrompt('polite') + A.closingPrompt('polite')));
});

test('휴대폰 시험 페이지는 이 agent.mjs 를 글자 그대로 담는다 · 저장된 page.html 이 지금 만든 것과 같다 · 바깥 주소는 글꼴뿐', async () => {
  const { readFileSync } = await import('node:fs');
  const { buildPage, inlineAgent } = await import('./build-page.mjs');
  const url = (f) => new URL(f, import.meta.url);
  const page = readFileSync(url('page.html'), 'utf8');
  assert.equal(page, buildPage());
  assert.ok(page.includes(inlineAgent(readFileSync(url('agent.mjs'), 'utf8'))));
  assert.ok(!/https?:\/\/(?!fonts\.g)/.test(page.replace(/https:\/\/fonts\.googleapis\.com[^"]*/g, '')));
});
