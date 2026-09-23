// v14.4 대화의 논리적 연결성 검사 (대표 긴급 정정 2026-09-24 "AI 질문 자체가 앞뒤 대화와 맞지 않는다").
// 실제 서버 코드(doit-understanding)를 가짜 AI·가짜 DB 로 여러 턴 이어 돌린다. [가짜 AI 기준 — 진짜 OpenAI 결과가 아니다]
// 검사하는 것: 직전 질문 Q(n)·답 A(n)·이번 회차 앞 질문/답(history)이 실제로 다음 질문 생성(LLM 자료)에 들어가는지,
//   앞 답과 끊긴 질문(대표 예: "사람을 만날 때 무엇이 중요해요?" → "편하게 대화가 되는 사람이요." → "쉬는 날에는 무엇을 하세요?")을 서버가 막는지,
//   정정·거절이 다음 질문을 실제로 바꾸는지, AI 에게 한 질문에는 먼저 답하는지.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const USER = '11111111-1111-4111-8111-111111111111';
const uuid = () => globalThis.crypto.randomUUID();
// 서버는 기록 번호로 UUID 만 받는다.
const R = { r1: '22222222-2222-4222-8222-000000000001', r2: '22222222-2222-4222-8222-000000000002', r3: '22222222-2222-4222-8222-000000000003' };
const at = (min) => new Date(Date.UTC(2026, 8, 24, 1, min)).toISOString();

// 가짜 DB. 기록(records)·질문 이벤트(events)에 시각이 있어 "어느 답이 어느 질문에 대한 것인지"를 서버가 짝짓는다.
function fakeDb(state) {
  const chain = (rows) => {
    let filtered = rows;
    const c = {
      select: () => c, order: () => c, limit: () => c,
      in: (col, vals) => { filtered = filtered.filter((r) => !(col in r) || vals.includes(r[col])); return c; },
      eq: (col, v) => { filtered = filtered.filter((r) => !(col in r) || r[col] === v); return c; },
      gte: (col, v) => { filtered = filtered.filter((r) => !(col in r) || r[col] >= v); return c; },
      maybeSingle: () => Promise.resolve({ data: filtered[0] ?? null, error: null }),
      then: (ok) => ok({ data: filtered, error: null }),
    };
    return c;
  };
  const tables = () => ({ doit_records: state.records, doit_insights: state.insights, profiles: [], doit_request_events: state.events });
  return {
    auth: { getUser: async () => ({ data: { user: { id: USER, user_metadata: {} } }, error: null }) },
    from: (table) => chain(tables()[table] ?? []),
    rpc: async (name, args) => {
      state.rpcCalls.push({ name, args });
      const rec = state.records.find((r) => r.id === args.p_record_id);
      const context = { record: rec, insights: state.insights.filter((i) => !rec || i.source_record_id === rec.id || i.status !== 'candidate'), purpose: { id: 'friend', label: '친구' }, context_hash: 'h' };
      if (name === 'doit_begin_insight_generate' || name === 'doit_begin_followup') return { data: { ok: true, duplicate: false, lease_token: args.p_lease_token, context }, error: null };
      if (name === 'doit_finish_followup') {
        if (args.p_error_code) return { data: { ok: false, code: args.p_error_code }, error: null };
        return { data: { ok: true, duplicate: false, question: args.p_question ? { text: args.p_question, sourceRecordId: args.p_record_id } : null }, error: null };
      }
      if (name === 'doit_finish_insight_generate') {
        if (args.p_error_code) return { data: { ok: false, code: args.p_error_code }, error: null };
        return { data: { ok: true, duplicate: false, insights: [], ...(args.p_rescue ? { rescued: true, rescue: args.p_rescue } : {}) }, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  };
}

function stageOf(system) {
  if (system.includes('가장 분명한 이해를')) return 'gen';
  if (system.includes('topics 의 각 항목')) return 'topic';
  if (system.includes("두 문장이 '같은 뜻'")) return 'semantic';
  if (system.includes('아래 기록은 사용자의 답이며')) return 'rescueDir';
  if (system.includes('아래 기록 안에 실제로 있는 내용만')) return 'rescuePlain';
  if (system.includes('사용자가 방금 한 말을 받아 준 뒤(ack)')) return 'followup';
  if (system.includes('질문의 첫 줄(받아 주는 문장)')) return 'judge';
  if (system.includes('AI 에게 질문(user_question)')) return 'ask';
  if (system.includes('무슨 뜻인지 되묻거나')) return 'rephrase';
  return 'unknown';
}

function loadServer(ai, state) {
  const source = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler = null;
  const payloads = [];
  const sandbox = {
    exports: {}, console: { log: (line) => state.logs.push(String(line)), error: () => {} },
    setTimeout, clearTimeout, AbortController, TextEncoder, crypto: globalThis.crypto, Request, Response, Headers, URL,
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; throw new Error(`Unexpected dependency ${name}`); },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      const stage = stageOf(body.messages[0].content);
      payloads.push({ stage, system: body.messages[0].content, user: body.messages[1].content });
      const answer = ai[stage] ? ai[stage](body.messages[1].content, body.messages[0].content) : null;
      if (answer === 'TIMEOUT') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
      return new Response(JSON.stringify({ choices: [{ message: { content: typeof answer === 'string' ? answer : JSON.stringify(answer ?? {}) } }] }), { status: 200 });
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: 'doit-understanding.ts' });
  const call = async (payload) => {
    const res = await handler(new Request('http://fn/', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ requestId: uuid(), ...payload }) }));
    return { status: res.status, body: await res.json() };
  };
  return { call, payloads, exports: sandbox.exports };
}

const world = (over = {}) => ({ records: [], insights: [], events: [], rpcCalls: [], logs: [], ...over });
const addAnswer = (state, id, text, minute) => { state.records.push({ id, user_id: USER, text, created_at: at(minute) }); return id; };
const addAsked = (state, text, minute, action = 'followup_generate') => state.events.push({ user_id: USER, action, status: 'applied', created_at: at(minute), response_payload: action === 'followup_generate' ? { question: { text } } : { rescue: { text } } });
const lastFollowupPayload = (payloads) => JSON.parse(payloads.filter((p) => p.stage === 'followup').pop().user);
const judgeAllow = () => ({ allowed: true });
const topics = (covered) => () => ({ covered });

// 대표가 지시서에 적은 장면 그대로.
const Q1 = '사람을 만날 때 무엇이 중요해요?';
const A1 = '편하게 대화가 되는 사람이요.';

test('[맥락 단절 FAIL 재현] "편하게 대화가 되는 사람이요." 다음에 "쉬는 날에는 무엇을 하세요?"는 문법이 맞아도 나가지 않는다', async () => {
  const jumps = [
    { ack: '', question: '쉬는 날에는 무엇을 하세요?', basis: '', keys: ['휴일'] },                                       // 이어받는 구절 없음
    { ack: '', link: '편하게 대화가', question: '쉬는 날에는 무엇을 하세요?', basis: '', keys: ['휴일'] },                  // 구절은 댔지만 질문이 받지 않음
    { ack: '좋네요.', link: '대화가 되는 사람', question: '쉬는 날에는 무엇을 하세요?', basis: '', keys: ['휴일'] },        // 빈 받아 주기 + 건너뛰기
  ];
  for (const jump of jumps) {
    const state = world();
    addAnswer(state, R.r1, A1, 1);
    const { call } = loadServer({ topic: topics([]), followup: () => jump, judge: judgeAllow }, state);
    const { status, body } = await call({ action: 'followup_generate', recordId: R.r1, answeredQuestion: Q1 });
    assert.equal(status, 200);
    assert.ok(!body.question.text.includes('쉬는 날'), `끊긴 질문이 나갔다: ${JSON.stringify(jump)}`);
    assert.ok(state.logs.some((l) => l.includes('FOLLOWUP_NOT_LINKED')), '끊김으로 판정한 기록');
    // 대체 문장도 새 주제로 건너뛰지 않고 방금 답에 머문다.
    assert.equal(body.topic, null);
    assert.match(body.question.text, /들려줄래요\?$/);
  }
});

test('[정상 예] 방금 답("편하게 대화가 되는 사람")을 받아 그 뜻을 좁혀 묻는 질문은 나가고, LLM 자료에 직전 질문·답이 들어간다', async () => {
  const state = world();
  addAnswer(state, R.r1, A1, 1);
  const good = { ack: '편하게 대화되는 사람이 좋으시군요.', link: '편하게 대화가 되는 사람', question: '말없이도 편한 쪽이에요? 아니면 솔직한 대화 쪽이에요?', basis: '편하게 대화가 되는 사람', keys: ['편하게 대화'], proposed_strategy: 'CLARIFY', evidence: [{ claim: '편하게 대화가 되는 사람이 좋다', supporting_user_text: '편하게 대화가 되는 사람' }] };
  const { call, payloads } = loadServer({ topic: topics([]), followup: () => good, judge: judgeAllow }, state);
  const { body } = await call({ action: 'followup_generate', recordId: R.r1, answeredQuestion: Q1 });
  assert.equal(body.question.text, `${good.ack}\n${good.question}`);
  const sent = lastFollowupPayload(payloads);
  assert.equal(sent.last_question, Q1, '직전 질문(화면이 보낸 것)이 LLM 에 들어간다');
  assert.equal(sent.record, A1, '직전 답이 LLM 에 들어간다');
  // 판정에도 같은 사슬이 들어간다(판정이 "앞뒤 연결"을 보려면 필요하다).
  const judged = JSON.parse(payloads.find((p) => p.stage === 'judge').user);
  assert.equal(judged.evidence.last_question, Q1);
  assert.equal(judged.link, '편하게 대화가 되는 사람');
  assert.match(payloads.find((p) => p.stage === 'judge').system, /왜 갑자기 이걸 묻지/, '판정 기준에 앞뒤 연결이 들어 있다');
});

test('[연속 대화 Q1→A1→Q2→A2→Q3] 매 턴 LLM 에 정확한 직전 질문과 앞 질문·답 짝(history)이 들어가고, 나간 질문은 모두 방금 답을 이어받는다', async () => {
  const state = world();
  // 가짜 AI: 받은 자료에서 방금 답의 앞부분을 이어받는 구절로 삼아 좁혀 묻는다(진짜 AI 가 해야 할 일을 흉내).
  const followup = (user) => {
    const p = JSON.parse(user);
    const link = p.record.replace(/[.!?]/g, '').split(' ').slice(0, 2).join(' ');
    return { ack: `${link}, 좋네요.`, link, question: `${link}은 어떤 때 제일 좋아요?`, basis: link, keys: [link] };
  };
  const { call, payloads } = loadServer({ topic: topics([]), followup, judge: judgeAllow }, state);
  const turns = [
    { id: R.r1, answer: A1, answered: Q1 },
    { id: R.r2, answer: '말없이 있어도 어색하지 않은 거요' },
    { id: R.r3, answer: '같이 걸을 때 제일 좋아요' },
  ];
  const served = [Q1];
  let minute = 1;
  for (const [i, t] of turns.entries()) {
    addAnswer(state, t.id, t.answer, minute++);
    // 첫 턴만 화면이 직전 질문을 보낸다. 나머지는 새로고침을 흉내 내 서버가 저장된 질문 기록에서 짝을 찾는다.
    const { body } = await call({ action: 'followup_generate', recordId: t.id, ...(t.answered ? { answeredQuestion: t.answered } : {}) });
    const sent = lastFollowupPayload(payloads);
    assert.equal(sent.last_question, served[i], `턴 ${i + 1}: 직전 질문`);
    assert.equal(sent.record, t.answer, `턴 ${i + 1}: 직전 답`);
    assert.equal(sent.history.length, i, `턴 ${i + 1}: 앞 짝 수`);
    if (i > 0) assert.deepEqual(sent.history[i - 1], { q: i - 1 === 0 ? null : served[i - 1], a: turns[i - 1].answer }, `턴 ${i + 1}: 바로 앞 짝`);
    const q = body.question.text.split('\n').pop();
    const link = t.answer.replace(/[.!?]/g, '').split(' ').slice(0, 2).join(' ');
    assert.ok(body.question.text.includes(link), `턴 ${i + 1}: 나간 질문이 방금 답을 이어받는다: ${body.question.text}`);
    served.push(q);
    addAsked(state, body.question.text, minute++);
  }
});

test('[새로고침] 이 답 "뒤에" 물은 질문을 직전 질문으로 잘못 읽지 않는다(시각으로 짝짓기)', async () => {
  const state = world();
  addAsked(state, 'Q-before', 1);
  addAnswer(state, R.r1, '잘 웃는 사람', 2);
  addAsked(state, 'Q-after-rescue', 3, 'insight_generate'); // 이 답을 읽고 낸 구제 질문(답보다 뒤)
  const { call, payloads } = loadServer({ topic: topics([]), followup: () => ({ ack: '잘 웃는 사람이 좋으시군요.', link: '잘 웃는 사람', question: '잘 웃는 사람이랑 뭐 하면 좋아요?', basis: '잘 웃는 사람', keys: ['잘 웃는'] }), judge: judgeAllow }, state);
  await call({ action: 'followup_generate', recordId: R.r1 });
  assert.equal(lastFollowupPayload(payloads).last_question, 'Q-before');
});

test('[첫 답] 화면 고정 첫 질문·첫 화면 질문처럼 서버 기록에 없는 질문도 화면이 보낸 answeredQuestion 으로 직전 질문이 된다(전: 비어 있었다)', async () => {
  const state = world();
  addAnswer(state, R.r1, '천천히 알아가고 싶어요', 1);
  const { call, payloads } = loadServer({ topic: topics([]), followup: () => ({ ack: '천천히 알아가고 싶으시군요.', link: '천천히 알아가고', question: '천천히라면 처음엔 어떻게 만나는 게 편해요?', basis: '천천히 알아가고', keys: ['천천히'] }), judge: judgeAllow }, state);
  await call({ action: 'followup_generate', recordId: R.r1, answeredQuestion: '어떤 만남을 원하세요?' });
  assert.equal(lastFollowupPayload(payloads).last_question, '어떤 만남을 원하세요?');
  // 화면이 보낸 문장은 첫 줄(받아 주는 말)을 떼고 질문만 쓴다. 저장 금지 입력이 섞이면 버린다.
  const state2 = world(); addAnswer(state2, R.r1, '천천히 알아가고 싶어요', 1);
  const s2 = loadServer({ topic: topics([]), followup: () => ({}), judge: judgeAllow }, state2);
  await s2.call({ action: 'followup_generate', recordId: R.r1, answeredQuestion: '좋아요.\n어떤 만남을 원하세요?' });
  assert.equal(lastFollowupPayload(s2.payloads).last_question, '어떤 만남을 원하세요?');
  const state3 = world(); addAnswer(state3, R.r1, '천천히 알아가고 싶어요', 1);
  const s3 = loadServer({ topic: topics([]), followup: () => ({}), judge: judgeAllow }, state3);
  await s3.call({ action: 'followup_generate', recordId: R.r1, answeredQuestion: '010-1234-5678 로 연락 주세요?' });
  assert.equal(lastFollowupPayload(s3.payloads).last_question, null);
});

test('[구제 경로도 같은 계약] 후보가 없어 서버가 바로 질문할 때도(긴 답·짧은 답 두 길 모두) 직전 질문이 들어가고, 끊긴 질문은 버린다', async () => {
  // 긴 답 = 방향 없는 구제(rescuePlain), 짧은 답 = 새 갈래 구제(rescueDir). 두 길 모두 AI 가 딴 주제를 내게 한다.
  for (const [answer, stage] of [[A1, 'rescuePlain'], ['잘 웃는 사람', 'rescueDir']]) {
    const state = world();
    addAsked(state, Q1, 1);
    addAnswer(state, R.r1, answer, 2);
    const jump = () => ({ ack: '', link: answer.slice(0, 4), question: '쉬는 날에는 무엇을 하세요?' });
    const { call, payloads } = loadServer({ gen: () => ({ candidates: [] }), topic: topics(['partner_style']), rescueDir: jump, rescuePlain: jump }, state);
    const { body } = await call({ action: 'insight_generate', recordId: R.r1 });
    assert.ok(payloads.some((p) => p.stage === stage), `${stage} 길을 실제로 탔다`);
    assert.ok(!body.rescue.text.includes('쉬는 날'), `${stage}: 끊긴 질문이 나갔다`);
    assert.equal(body.rescue.topic, null);
    const sent = payloads.find((p) => p.stage === stage).user;
    assert.ok(sent.includes(`[직전 질문`) && sent.includes(Q1), `${stage}: AI 자료에 직전 질문`);
    assert.ok(state.logs.some((l) => l.includes('ai_not_linked')), `${stage}: 끊김으로 판정`);
  }
});

test('[정정 우선] "그게 아니에요" 뒤 고친 말이 이어받을 근거가 되고, 정정 전 해석을 전제로 한 질문은 판정이 막는다(다음 질문이 실제로 바뀜)', async () => {
  const state = world({ insights: [{ id: 'i1', text: '좋아하는 게 아니라 그냥 미안한 거예요', ai_text: '그 사람을 아직 좋아한다', status: 'corrected', origin: 'ai', source_record_id: R.r1, updated_at: at(3) }] });
  addAnswer(state, R.r1, '예전에 친했던 사람이 자꾸 생각나요', 2);
  const judge = (user) => ({ allowed: !JSON.parse(user).question.includes('좋아') });
  let s = loadServer({ topic: topics([]), followup: () => ({ ack: '', link: '미안한 거예요', question: '아직 좋아하는 마음이 미안한 거예요?', basis: '', keys: ['좋아'] }), judge }, state);
  let { body } = await s.call({ action: 'followup_generate', recordId: R.r1 });
  assert.ok(!body.question.text.includes('좋아'), '정정 전 해석(좋아한다)은 다음 질문에 없다');
  const sent = lastFollowupPayload(s.payloads);
  assert.equal(sent.strategy, 'ACKNOWLEDGE_CORRECTION');
  assert.deepEqual(sent.superseded, ['그 사람을 아직 좋아한다']);
  s = loadServer({ topic: topics([]), followup: () => ({ ack: '미안한 마음이 크시군요.', link: '미안한 거예요', question: '미안한 마음, 전하고 싶은 게 있어요?', basis: '미안한 거예요', keys: ['미안'] }), judge }, state);
  ({ body } = await s.call({ action: 'followup_generate', recordId: R.r1 }));
  assert.equal(body.question.text, '미안한 마음이 크시군요.\n미안한 마음, 전하고 싶은 게 있어요?', '고친 말에서 이어지는 질문은 나간다');
});

test('[거절 차단] 거절한 뜻을 표현만 바꿔 다시 묻는 질문은 막히고, 거절 직후에는 "잘못 짚었다"는 열린 질문으로 바뀐다', async () => {
  const rejected = { id: 'i0', text: '다시 가까워지고 싶은 마음', ai_text: '다시 가까워지고 싶은 마음', status: 'rejected', origin: 'ai', source_record_id: R.r1, updated_at: at(3) };
  const state = world({ insights: [rejected] });
  addAnswer(state, R.r1, '예전에 친했던 사람이 자꾸 생각나요', 2);
  let s = loadServer({ topic: topics([]), followup: () => ({ ack: '', question: '다시 가까워지고 싶은 마음이 커요?', basis: '', keys: ['가까워지고'] }), judge: judgeAllow }, state);
  let { body } = await s.call({ action: 'followup_generate', recordId: R.r1 });
  assert.ok(!body.question.text.includes('가까워지'));
  assert.match(body.question.text, /제가 잘못 알아들었네요/);
  s = loadServer({ topic: topics([]), followup: () => ({ ack: '제가 방향을 잘못 짚었네요.', question: '그 사람이 생각나면 어떤 마음이 먼저 들어요?', basis: '', keys: ['생각나'] }), judge: judgeAllow, semantic: () => ({ blocked: [] }) }, state);
  ({ body } = await s.call({ action: 'followup_generate', recordId: R.r1 }));
  assert.equal(body.strategy, 'RECOVER_FROM_REJECTION');
  assert.ok(body.question.text.endsWith('그 사람이 생각나면 어떤 마음이 먼저 들어요?'), '거절 직후 열린 질문은 방금 답 인용 없이도 나간다(거절한 뜻을 되살리지 않기 위해)');
});

test('[반복 방지] history 에 이미 답한 것을 다시 묻는 질문은 판정이 막는다(판정 자료에 history 가 들어간다)', async () => {
  const state = world();
  addAsked(state, '만나면 같이 뭐 하고 싶어요?', 1);
  addAnswer(state, R.r1, '산책이요', 2);
  addAsked(state, '산책이요, 누구랑 걷는 게 좋아요?', 3);
  addAnswer(state, R.r2, '말이 잘 통하는 사람이랑요', 4);
  const judge = (user) => { const j = JSON.parse(user); const answered = j.evidence.history.map((h) => h.a).join(' '); return { allowed: !(j.question.includes('같이 뭐') && answered.includes('산책')) }; };
  const s = loadServer({ topic: topics([]), followup: () => ({ ack: '말이 잘 통하는 사람이 좋으시군요.', link: '말이 잘 통하는 사람', question: '말이 잘 통하는 사람이랑 같이 뭐 하고 싶어요?', basis: '말이 잘 통하는 사람', keys: ['말이 잘 통하는'] }), judge }, state);
  const { body } = await s.call({ action: 'followup_generate', recordId: R.r2 });
  assert.ok(!body.question.text.includes('같이 뭐 하고 싶어요'), '이미 답한 「같이 하고 싶은 것」을 다시 묻지 않는다');
  const judged = JSON.parse(s.payloads.find((p) => p.stage === 'judge').user);
  assert.deepEqual(judged.evidence.history.map((h) => h.a), ['산책이요']);
  assert.equal(judged.evidence.history[0].q, '만나면 같이 뭐 하고 싶어요?');
});

test('[사용자 질문 먼저] "근데 왜 이런 걸 물어봐?" → 새 질문 없이 먼저 답하고 같은 질문을 다시 건넨다. 기록은 만들지 않는다', async () => {
  const state = world();
  const { call, payloads } = loadServer({ ask: () => ({ reply: '여기에 답한 말로 어떤 사람을 소개할지 정해요.' }) }, state);
  const r = await call({ action: 'rephrase', question: '좋네요.\n어떤 사람을 만나고 싶어요?', text: '근데 왜 이런 걸 물어봐?' });
  assert.equal(r.status, 200);
  assert.equal(r.body.kind, 'ask');
  assert.equal(r.body.reply, '여기에 답한 말로 어떤 사람을 소개할지 정해요.');
  assert.equal(r.body.question, '어떤 사람을 만나고 싶어요?', '같은 질문을 다시 건넨다(새 질문 아님)');
  assert.ok(!state.rpcCalls.length, '기록·질문을 저장하지 않는다');
  const facts = JSON.parse(payloads.find((p) => p.stage === 'ask').user).facts;
  assert.ok(facts.why && facts.seen && facts.count, 'AI 에게 사실 목록만 준다');
});

test('[사용자 질문 먼저] AI 가 못 하거나 규칙을 어기면(물음표·새 질문·금지어) 가장 가까운 사실 한 줄로 답한다 — 지어내지 않는다', async () => {
  for (const [bad, text, expectKey] of [
    ['TIMEOUT', '이거 누가 봐요?', 'seen'],
    [{ reply: '궁금하세요? 그럼 다른 걸 물어볼게요.' }, '몇 개 남았어요?', 'count'],
    [{ reply: '데이팅 앱이라서요.' }, '왜 이런 걸 물어봐?', 'why'],
    [{ reply: '' }, '넌 누구야?', 'who'],
  ]) {
    const state = world();
    const { call, exports } = loadServer({ ask: () => bad }, state);
    const r = await call({ action: 'rephrase', question: '어떤 사람한테 끌려요?', text });
    assert.equal(r.body.kind, 'ask', text);
    assert.equal(r.body.reply, exports.ASK_FACTS[expectKey], text);
    assert.equal(r.body.fallback, true);
    assert.equal(r.body.question, '어떤 사람한테 끌려요?');
  }
});

test('[사용자 질문 판정] 실제로 치는 말: AI 에게 하는 질문은 잡고, 진짜 답("왜냐면 편해서요"·"기록 되는 게 싫어요")은 답으로 둔다. 화면·서버 규칙이 같다', () => {
  const src = readFileSync('src/doit/lib/conversationRules.ts', 'utf8');
  const exp = {};
  vm.runInNewContext(ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exp });
  const asks = ['근데 왜 이런 걸 물어봐?', '왜 물어봐요?', '이거 왜 알아야 해?', '이거 어디에 써요?', '누가 봐요?', '몇 개 남았어요?', '언제 끝나요?', '넌 누구야?', '너 AI야?', '이거 저장돼요?', '이거 뭐하는 앱이야?', '공개되나요?'];
  const answers = ['왜냐면 편해서요', '왜 그런지 모르겠는데 조용한 사람이 좋아요', '산책', '모르겠어요', '누가 먼저 연락하는 게 좋아요', '기록 되는 게 싫어요', '저장해 둔 사진 보면 설레요', A1, '몇 번 만나 보고 천천히요', '언제든 연락 되는 사람', '👍', 'ㅋㅋ 몰라'];
  for (const a of asks) assert.equal(exp.isAskingAi(a), true, `질문: ${a}`);
  for (const a of answers) assert.equal(exp.isAskingAi(a), false, `답: ${a}`);
});

test('[구조] 다음 질문 경로 두 곳(이어 묻기·구제) 모두 이어받는 구절을 검사하고, 새 갈래 예외·"억지로 잇지 않아도 된다" 문구가 없다', () => {
  const src = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!code.includes('억지로 잇지 않아도'), '원인 문구 삭제');
  const compose = code.slice(code.indexOf('async function composeFollowup('), code.indexOf('function generationRpcError('));
  assert.match(compose, /throw new Error\("FOLLOWUP_NOT_LINKED"\)/);
  assert.match(compose, /throw new Error\("FOLLOWUP_NO_BRIDGE"\)/);
  assert.match(compose, /if \(!allowed\) throw new Error\("FOLLOWUP_NOT_COHERENT"\)/, '판정 불허면 첫 줄만 떼고 내보내지 않는다');
  assert.ok(!/if \(newBranch\) question = askedQ/.test(compose), '전: 새 갈래는 판정 불허여도 첫 줄만 떼고 냈다');
  const rescue = code.slice(code.indexOf('async function buildRescue('), code.indexOf('// ── 후보 생성 파이프라인 ──'));
  assert.match(rescue, /linkIn\(o\?\.link, \[recordText\]\)/);
  assert.match(rescue, /lastNote\}\$\{historyNote\(history\)\}/, '구제 AI 자료에도 직전 질문·history');
  const client = readFileSync('src/doit/components/feature/CoreConversation.tsx', 'utf8');
  assert.match(client, /api\.generate\(record\.id, first \? 1 : undefined, answered\)/, '화면이 직전 질문을 함께 보낸다');
  assert.match(client, /api\.nextQuestion\(recordId, answeredFor\.current\.get\(recordId\) \?\? null\)/);
  assert.match(client, /sendText\(initialMessage, OPENING_QUESTION\)/, '첫 화면에서 적은 한 줄은 「어떤 만남을 원하세요?」의 답');
  assert.match(readFileSync('src/doit/components/feature/ConversationOpening.tsx', 'utf8'), /어떤 만남을<br \/>원하세요\?/);
});
