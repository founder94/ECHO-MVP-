// v16 한 턴(action "turn") 검사 — 가짜 AI · 가짜 DB 기준(실제 OpenAI 아님).
// 이 검사가 보는 것: 저장 순서·칸·정보 상태·거절·정정·이미 물음·다시 만들기 1번·OpenAI 호출 수·옛 관문 미호출·관측 로그.
// 이 검사가 보지 못하는 것: 실제 OpenAI 가 어떤 질문을 만드는지(질문 문장은 가짜 AI 가 준 것이다). 품질은 대표 LEVEL 3 로만 판정한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const USER = '11111111-1111-4111-8111-111111111111';
const uuid = () => globalThis.crypto.randomUUID();
const SOURCE = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');

// 가짜 DB — 표 네 개와 RPC 네 개(운영 함수 정의를 읽고 필요한 동작만 흉내 낸다). 시각은 호출 순서대로 1초씩 증가한다.
function fakeDb(state) {
  // 서버는 연결을 두 개(사용자·서버 권한) 만든다 — 시계는 상태 하나를 같이 쓴다.
  state.tick ??= 0;
  const now = () => new Date(Date.UTC(2026, 8, 24, 12, 0, state.tick++)).toISOString();
  state.now = now;
  const tables = { doit_records: state.records, doit_insights: state.insights, doit_request_events: state.events, profiles: state.profiles };
  const chain = (name) => {
    let rows = [...(tables[name] ?? [])];
    let single = false;
    const c = {
      select: () => c,
      eq: (col, v) => { rows = rows.filter((r) => r[col] === v); return c; },
      in: (col, vals) => { rows = rows.filter((r) => vals.includes(r[col])); return c; },
      gte: (col, v) => { rows = rows.filter((r) => r[col] >= v); return c; },
      order: (col, opts = {}) => { rows.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (opts.ascending === false ? -1 : 1)); return c; },
      limit: (n) => { rows = rows.slice(0, n); return c; },
      maybeSingle: () => { single = true; return c; },
      insert: (row) => {
        const list = tables[name];
        if (name === 'doit_request_events' && list.some((r) => r.user_id === row.user_id && r.request_id === row.request_id)) return Promise.resolve({ error: { code: '23505' } });
        const t = now();
        list.push({ created_at: t, updated_at: t, ...row });
        return Promise.resolve({ error: null });
      },
      then: (ok) => ok({ data: single ? rows[0] ?? null : rows, error: null }),
    };
    return c;
  };
  const evt = (requestId) => state.events.find((e) => e.user_id === USER && e.request_id === requestId);
  return {
    auth: { getUser: async () => ({ data: { user: { id: USER, user_metadata: state.userMeta ?? {} } }, error: null }) },
    from: chain,
    rpc: async (name, a) => {
      state.rpcCalls.push(name);
      if (name === 'doit_apply_record_create') {
        const e = evt(a.p_request_id);
        if (e && e.status === 'applied') return { data: { ok: true, duplicate: true, record: state.records.find((r) => r.request_id === a.p_request_id) }, error: null };
        const t = now();
        const rec = { id: uuid(), user_id: USER, text: a.p_text, original_text: a.p_original_text, status: a.p_status, revision: 1, request_id: a.p_request_id, created_at: t, updated_at: t };
        state.records.push(rec);
        state.events.push({ user_id: USER, request_id: a.p_request_id, action: a.p_action, target_id: rec.id, status: 'applied', payload_hash: a.p_payload_hash, created_at: t, updated_at: t });
        return { data: { ok: true, duplicate: false, record: rec }, error: null };
      }
      if (name === 'doit_begin_followup') {
        const rec = state.records.find((r) => r.id === a.p_record_id);
        if (!rec) return { data: { ok: false, code: 'FORBIDDEN' }, error: null };
        const context = { record: rec, insights: state.insights, purpose: null, context_hash: `ctx-${rec.id}-${state.insights.length}` };
        const e = evt(a.p_request_id);
        if (e && e.status === 'applied' && e.response_payload?.question) return { data: { ok: true, duplicate: true, question: e.response_payload.question }, error: null };
        const cached = state.events.filter((x) => x.action === 'followup_generate' && x.target_id === rec.id && x.status === 'applied' && x.context_hash === context.context_hash).pop();
        if (cached) return { data: { ok: true, duplicate: true, question: cached.response_payload.question }, error: null };
        const t = now();
        if (e) Object.assign(e, { status: 'pending', lease_token: a.p_lease_token, context_hash: context.context_hash, updated_at: t });
        else state.events.push({ user_id: USER, request_id: a.p_request_id, action: 'followup_generate', target_id: rec.id, status: 'pending', lease_token: a.p_lease_token, context_hash: context.context_hash, payload_hash: a.p_payload_hash, created_at: t, updated_at: t });
        return { data: { ok: true, duplicate: false, lease_token: a.p_lease_token, context }, error: null };
      }
      if (name === 'doit_finish_followup') {
        const e = evt(a.p_request_id);
        if (!e || e.lease_token !== a.p_lease_token) return { data: { ok: false, code: 'IN_FLIGHT' }, error: null };
        e.updated_at = now();
        if (a.p_error_code || !a.p_question) { e.status = 'failed'; return { data: { ok: false, code: 'AI_ERROR' }, error: null }; }
        const question = { text: a.p_question.trim(), sourceRecordId: a.p_record_id };
        Object.assign(e, { status: 'applied', response_payload: { question }, lease_token: null });
        return { data: { ok: true, duplicate: false, question }, error: null };
      }
      if (name === 'doit_get_followup') {
        const e = state.events.filter((x) => x.action === 'followup_generate' && x.target_id === a.p_record_id && x.status === 'applied').pop();
        return { data: { ok: true, question: e?.response_payload?.question ?? null }, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  };
}

// 가짜 AI: 단계는 시스템 문구로 가린다. v16 한 턴 = 'turn'. 그 밖의 단계가 불리면 옛 관문이 불린 것이다.
function stageOf(system) {
  if (system.includes('너는 대화 한 턴의 후보만 만든다')) return 'turn';
  if (system.includes('너는 다음 질문의 후보만 만든다')) return 'legacy_compose';
  if (system.includes('다음 질문 후보(question)가 대화에 내보내도 되는지')) return 'legacy_judge';
  if (system.includes('topics 의 각 항목')) return 'legacy_topic';
  if (system.includes("두 문장이 '같은 뜻'")) return 'legacy_semantic';
  if (system.includes('reply 를 하나로 분류하라')) return 'legacy_classify';
  return 'unknown';
}
function loadServer(ai, state) {
  const compiled = ts.transpileModule(SOURCE, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler = null;
  const calls = [];
  const sandbox = {
    exports: {}, console: { log: (line) => state.logs.push(String(line)), error: () => {} },
    setTimeout, clearTimeout, AbortController, TextEncoder, crypto: globalThis.crypto, Request, Response, Headers, URL,
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; throw new Error(`Unexpected dependency ${name}`); },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      const stage = stageOf(body.messages[0].content);
      const input = JSON.parse(body.messages[1].content);
      calls.push({ stage, input });
      const answer = ai(input, calls.filter((c) => c.stage === 'turn').length);
      if (answer === 'TIMEOUT') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
      return new Response(JSON.stringify({ choices: [{ message: { content: typeof answer === 'string' ? answer : JSON.stringify(answer ?? {}) } }] }), { status: 200 });
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: 'doit-understanding.ts' });
  const call = async (payload, requestId = uuid()) => {
    const res = await handler(new Request('http://fn/', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ requestId, ...payload }) }));
    return { status: res.status, body: await res.json() };
  };
  return { call, calls };
}
const fresh = (over = {}) => ({ records: [], insights: [], events: [], profiles: [{ id: USER, purpose_label: '편한 친구' }], rpcCalls: [], logs: [], ...over });
const reply = (over) => ({ turn_type: 'answer', correction_rest: '', interesting_clue: '', acknowledgement: '', next_question: '', reason: '관측', repeats_asked: false, uses_rejected_meaning: false, assumes_unconfirmed_fact: false, off_purpose: false, ...over });
const turnLogs = (state) => state.logs.filter((l) => l.includes('"action":"turn"')).map((l) => JSON.parse(l));
const legacyStages = (calls) => calls.filter((c) => c.stage !== 'turn');
const FIRST = '어떤 만남을 원하세요?';

// ── A. 대표 실제 실패 원문 ──
test('v16 A: 「그냥 편한친구 부담없이」 → 분류 뒤 답으로 저장 · 1칸 · 질문 저장 · OpenAI 1번 · 옛 관문 0', async () => {
  const state = fresh();
  const { call, calls } = loadServer(() => reply({ interesting_clue: '편한친구', next_question: '어떤 사람이면 처음 봐도 편할 것 같아요?' }), state);
  const r = await call({ action: 'turn', text: '그냥 편한친구 부담없이', answeredQuestion: FIRST });
  assert.equal(r.status, 200);
  assert.equal(r.body.saved, true);
  assert.equal(r.body.kind, 'answer');
  assert.equal(state.records.length, 1, '답으로 1번 저장');
  assert.equal(state.records[0].original_text, '그냥 편한친구 부담없이', '원문 그대로 보존');
  assert.equal(r.body.question.text, '어떤 사람이면 처음 봐도 편할 것 같아요?');
  assert.equal(r.body.question.sourceRecordId, state.records[0].id);
  assert.ok(state.events.some((e) => e.action === 'followup_generate' && e.status === 'applied'), '다음 질문은 기존 계약으로 저장(새로고침 복원)');
  assert.equal(calls.length, 1, 'OpenAI 1번');
  assert.deepEqual(legacyStages(calls), [], '옛 관문(후보 생성·판정·주제 판정·의미 판정·분류) 0번');
  const input = calls[0].input;
  assert.equal(input.user_text, '그냥 편한친구 부담없이');
  assert.equal(input.last_question, FIRST);
  for (const k of ['direction', 'hints', 'strategy', 'topic']) assert.ok(!(k in input), `서버가 주제 방향(${k})을 주지 않는다`);
  assert.equal(input.answered_count, 0);
  const log = turnLogs(state)[0];
  assert.equal(log.llm_calls, 1);
  assert.equal(log.saved, true);
  assert.equal(log.turn, 1);
  assert.ok(!state.logs.some((l) => /"stage":"(compose|topic_judge)"/.test(l)), '옛 관문 로그 0');
});

test('v16 A-2: 서버 필수 검사(단서가 원문에 없음)에 걸리면 1번만 다시 만든다 → 정상 2번 이내', async () => {
  const state = fresh();
  const { call, calls } = loadServer((_in, n) => n === 1
    ? reply({ interesting_clue: '같이 하는 활동', next_question: '어떤 활동을 함께 하고 싶어요?' })
    : reply({ interesting_clue: '부담없이', next_question: '부담 없는 사이는 어떤 느낌이에요?' }), state);
  const r = await call({ action: 'turn', text: '그냥 편한친구 부담없이', answeredQuestion: FIRST });
  assert.equal(r.body.question.text, '부담 없는 사이는 어떤 느낌이에요?');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].input.previous_attempt.next_question, '어떤 활동을 함께 하고 싶어요?', '떨어진 후보와 이유를 알려 준다');
  assert.match(calls[1].input.previous_attempt.why, /source_text 안에 그대로 있지 않았다/);
  assert.deepEqual(turnLogs(state)[0].retry_reason, ['clue']);
});

test('v16 A-3: 두 번 다 서버 필수 검사에 걸리면 답은 저장하고 질문은 실패를 그대로 알린다(3번째 호출 없음 · 고정 질문 없음)', async () => {
  const state = fresh();
  const { call, calls } = loadServer(() => reply({ interesting_clue: '없는 말', next_question: '어떤 활동을 함께 하고 싶어요?' }), state);
  const r = await call({ action: 'turn', text: '그냥 편한친구 부담없이', answeredQuestion: FIRST });
  assert.equal(r.status, 200);
  assert.equal(r.body.saved, true);
  assert.equal(r.body.question, null);
  assert.match(r.body.questionError, /다음 질문을 아직 만들지 못했어요/);
  assert.equal(calls.length, 2, '최대 2번');
  assert.ok(state.events.some((e) => e.action === 'followup_generate' && e.status === 'failed'), '질문 자리는 실패로 닫는다(다음 질문 받기로 다시)');
});

// ── B. 대표 실제 실패 원문 2 ──
async function afterFirstAnswer(ai) {
  const state = fresh();
  let n = 0;
  const server = loadServer((input, k) => { n += 1; return n === 1 ? reply({ interesting_clue: '편한친구', next_question: '어떤 활동을 함께 하고 싶어요?' }) : ai(input, k - 1); }, state);
  const first = await server.call({ action: 'turn', text: '그냥 편한친구 부담없이', answeredQuestion: FIRST });
  return { state, server, first };
}
test('v16 B: 「활동?갑자기?」 = 문제제기 → 저장 0 · 칸 0 · 사실 0 → 직전 정상 답에서 다시 질문 · OpenAI 1번', async () => {
  const { state, server, first } = await afterFirstAnswer(() => reply({ turn_type: 'complaint', acknowledgement: '제가 너무 앞서갔네요.', interesting_clue: '편한친구', next_question: '편한 친구라면 어떤 사람이 제일 편해요?' }));
  const before = { records: state.records.length, insights: state.insights.length };
  const callsBefore = server.calls.length;
  const r = await server.call({ action: 'turn', text: '활동?갑자기?', answeredQuestion: first.body.question.text, recordId: first.body.question.sourceRecordId });
  assert.equal(r.status, 200);
  assert.equal(r.body.kind, 'complaint');
  assert.equal(r.body.saved, false);
  assert.equal(state.records.length, before.records, '관계 답으로 저장 0 · 칸 증가 0');
  assert.equal(state.insights.length, before.insights, '이해 후보 0');
  assert.equal(r.body.question.text, '제가 너무 앞서갔네요.\n편한 친구라면 어떤 사람이 제일 편해요?', '먼저 문제제기에 반응 → 다시 질문');
  assert.equal(r.body.question.sourceRecordId, first.body.question.sourceRecordId);
  assert.ok(state.events.some((e) => e.action === 'followup_skip' && e.status === 'applied'), '새로고침 복원을 위해 기존 「다른 질문」 기록에 남긴다');
  const input = server.calls[callsBefore].input;
  assert.equal(input.user_text, '활동?갑자기?');
  assert.equal(input.last_answer, '그냥 편한친구 부담없이', '직전 정상 답을 함께 준다');
  assert.equal(server.calls.length - callsBefore, 1, 'OpenAI 1번');
  // 새로고침 뒤: followup_get 이 불만 뒤의 새 질문을 돌려준다(옛 질문이 다시 나오지 않는다).
  const restored = await server.call({ action: 'followup_get', recordId: first.body.question.sourceRecordId });
  assert.equal(restored.body.question.text, r.body.question.text);
});

test('v16 B-2: 문제제기 뒤 질문의 단서를 문제제기 문장에서 뽑으면(= 직전 답에서 출발 안 함) 서버가 떨어뜨리고 1번 다시', async () => {
  const { state, server, first } = await afterFirstAnswer((_i, k) => k === 1
    ? reply({ turn_type: 'complaint', interesting_clue: '활동', next_question: '그럼 어떤 활동이 좋아요?' })
    : reply({ turn_type: 'complaint', interesting_clue: '부담없이', next_question: '부담 없다는 건 어떤 느낌이에요?' }));
  const r = await server.call({ action: 'turn', text: '활동?갑자기?', answeredQuestion: first.body.question.text, recordId: first.body.question.sourceRecordId });
  assert.equal(r.body.question.text, '부담 없다는 건 어떤 느낌이에요?');
  assert.equal(state.records.length, 1);
  assert.deepEqual(turnLogs(state).at(-1).retry_reason, ['clue']);
});

test('v16 B-3(회귀): AI 가 진짜 답을 불만으로 잘못 읽어도 사용자가 「답으로 남기기」를 누르면 답으로 저장된다(빠져나갈 문)', async () => {
  const state = fresh();
  const { call, calls } = loadServer((input) => input.server_turn_type === 'answer'
    ? reply({ interesting_clue: '천천히', next_question: '천천히라면 어느 정도 속도가 편해요?' })
    : reply({ turn_type: 'complaint', interesting_clue: '천천히', next_question: '천천히라면 어느 정도 속도가 편해요?' }), state);
  const wrong = await call({ action: 'turn', text: '천천히 알아가고 싶어요', answeredQuestion: FIRST });
  assert.equal(wrong.body.saved, false, 'AI 오판이면 저장되지 않는다(원문은 화면 입력에 남는다)');
  const fixed = await call({ action: 'turn', text: '천천히 알아가고 싶어요', answeredQuestion: FIRST, asAnswer: true });
  assert.equal(fixed.body.saved, true);
  assert.equal(state.records.length, 1);
  assert.equal(calls.at(-1).input.server_turn_type, 'answer', '사용자가 고른 종류를 서버가 정해 알린다');
});

// ── C·D. 정상 답 ──
test('v16 C: 짧은 정상 답 「산책」 → 저장 · 글자 수로 주제를 바꾸지 않는다 · OpenAI 1번', async () => {
  const state = fresh();
  const { call, calls } = loadServer(() => reply({ interesting_clue: '산책', next_question: '산책은 주로 어디로 가요?' }), state);
  const r = await call({ action: 'turn', text: '산책', answeredQuestion: '쉬는 날엔 뭐 해요?' });
  assert.equal(r.body.saved, true);
  assert.equal(r.body.question.text, '산책은 주로 어디로 가요?');
  assert.equal(calls.length, 1);
  assert.ok(!('direction' in calls[0].input) && !('strategy' in calls[0].input));
});
test('v16 D: 긴 정상 답 → 저장 · 원문 보존 · OpenAI 1번', async () => {
  const state = fresh();
  const long = '예전에는 연락을 자주 해야 한다고 생각했는데 요즘은 각자 시간도 존중해 주면서 필요할 때 편하게 연락하는 사이가 제일 좋더라고요.';
  const { call, calls } = loadServer(() => reply({ interesting_clue: '각자 시간도 존중', next_question: '각자 시간은 보통 어떻게 보내고 싶어요?' }), state);
  const r = await call({ action: 'turn', text: long, answeredQuestion: FIRST });
  assert.equal(r.body.saved, true);
  assert.equal(state.records[0].original_text, long);
  assert.equal(calls.length, 1);
});

// ── E. 모르겠어요 ──
test('v16 E: 「모르겠어요」 → 규칙이 unsure 로 정함 · 칸은 채우고 사실은 아님 · OpenAI 1번(서버가 종류를 알려 줌)', async () => {
  const state = fresh();
  const { call, calls } = loadServer(() => reply({ turn_type: 'unsure', interesting_clue: '모르겠어요', next_question: '같이 있을 때 편했던 사람이 있었어요?' }), state);
  const r = await call({ action: 'turn', text: '모르겠어요', answeredQuestion: FIRST });
  assert.equal(r.body.kind, 'unsure');
  assert.equal(r.body.saved, true, '다섯 칸에는 센다');
  assert.equal(state.insights.length, 0, '사실(이해)로 만들지 않는다');
  assert.equal(calls[0].input.server_turn_type, 'unsure');
  assert.equal(turnLogs(state)[0].by, 'rule');
});

// ── F. AI 에게 한 질문 ──
test('v16 F: 「왜 그걸 물어봐?」 → 저장 0 · 칸 0 · 사실 안에서만 답 · 원래 질문은 그대로 · OpenAI 1번', async () => {
  const state = fresh();
  const { call, calls } = loadServer(() => reply({ turn_type: 'ask', acknowledgement: '여기에 답한 말로 어떤 사람을 소개할지 정해요.' }), state);
  const r = await call({ action: 'turn', text: '왜 그걸 물어봐?', answeredQuestion: '어떤 사람이면 편해요?' });
  assert.equal(r.body.kind, 'ask');
  assert.equal(r.body.saved, false);
  assert.equal(state.records.length, 0);
  assert.equal(r.body.reply, '여기에 답한 말로 어떤 사람을 소개할지 정해요.');
  assert.equal(calls.length, 1);
});
test('v16 F-2: AI 답이 규칙을 어기면(물음표) 사실 목록의 가장 가까운 한 줄로 바꾼다', async () => {
  const state = fresh();
  const { call } = loadServer(() => reply({ turn_type: 'ask', acknowledgement: '궁금하셨죠?' }), state);
  const r = await call({ action: 'turn', text: '왜 그걸 물어봐?', answeredQuestion: '어떤 사람이면 편해요?' });
  assert.equal(r.body.reply, '여기에 답한 말로 어떤 사람을 소개할지 정해요.');
});

// ── G. 정정 ──
test('v16 G: 「그게 아니에요」 → AI 문장을 거절로 저장(OpenAI 0번) → 다음 답은 정정 전 문장을 전제로 쓰지 못한다', async () => {
  const { state, server, first } = await afterFirstAnswer((input) => input.user_text === '그냥 부담 없는 사람이요'
    ? (input.superseded.includes('어떤 활동을 함께 하고 싶어요?') ? reply({ interesting_clue: '부담 없는', next_question: '부담 없는 사람은 어떤 사람이에요?' }) : reply({ next_question: 'X' }))
    : reply({}));
  const callsBefore = server.calls.length;
  const no = await server.call({ action: 'turn', text: '그게 아니에요', answeredQuestion: first.body.question.text, correction: '어떤 활동을 함께 하고 싶어요?', recordId: first.body.question.sourceRecordId });
  assert.equal(no.body.kind, 'correction');
  assert.equal(no.body.saved, false);
  assert.equal(no.body.rejected, true, '거절한 AI 문장을 서버에 저장');
  assert.equal(server.calls.length, callsBefore, '설명 없는 첫 정정은 OpenAI 0번');
  assert.ok(state.events.some((e) => e.action === 'followup_reject' && e.response_payload.rejected === '어떤 활동을 함께 하고 싶어요?'));
  const next = await server.call({ action: 'turn', text: '그냥 부담 없는 사람이요', answeredQuestion: no.body.reply, pendingCorrection: '어떤 활동을 함께 하고 싶어요?', recordId: first.body.question.sourceRecordId });
  assert.equal(next.body.saved, true);
  assert.equal(next.body.question.text, '부담 없는 사람은 어떤 사람이에요?', '정정 전 문장이 superseded 로 전달됨');
});
test('v16 G-2: 설명이 붙은 정정 「아니 그게 아니라 그냥 편한 사람이요」 → 거절 저장 + 원문 저장 · 설명 부분에서 출발', async () => {
  const { state, server, first } = await afterFirstAnswer(() => reply({ turn_type: 'correction', interesting_clue: '편한 사람', next_question: '편한 사람은 어떤 모습이에요?' }));
  const r = await server.call({ action: 'turn', text: '아니 그게 아니라 그냥 편한 사람이요', answeredQuestion: first.body.question.text, correction: '어떤 활동을 함께 하고 싶어요?', recordId: first.body.question.sourceRecordId });
  assert.equal(r.body.kind, 'correction');
  assert.equal(r.body.saved, true);
  assert.equal(state.records.at(-1).original_text, '아니 그게 아니라 그냥 편한 사람이요');
  assert.ok(state.events.some((e) => e.action === 'followup_reject'));
});

// ── H. 거절 ──
test('v16 H: 아니라고 한 해석을 다시 쓰는 질문은 서버가 막는다 → 1번 다시 → 그래도면 실패를 알린다(3번째 없음)', async () => {
  const insights = [{ id: 'i1', user_id: USER, text: '할 말이 없다.', ai_text: '할 말이 없다.', status: 'rejected', origin: 'ai', source_record_id: 'old', category: 'value', revision: 2, created_at: '2026-09-24T00:00:00Z', updated_at: '2026-09-24T00:00:00Z' }];
  const state = fresh({ insights });
  const { call, calls } = loadServer((_i, n) => n === 1
    ? reply({ interesting_clue: '편한친구', next_question: '할 말이 없다고 느낄 때도 있어요?' })
    : reply({ interesting_clue: '편한친구', next_question: '편한 친구와는 뭘 하며 지내요?' }), state);
  const r = await call({ action: 'turn', text: '그냥 편한친구 부담없이', answeredQuestion: FIRST });
  assert.equal(r.body.question.text, '편한 친구와는 뭘 하며 지내요?');
  assert.equal(calls.length, 2);
  assert.deepEqual(turnLogs(state)[0].retry_reason, ['rejected']);
  assert.deepEqual(calls[0].input.rejected, ['할 말이 없다.'], '거절한 해석을 LLM 에 준다');
});

// ── 상태·재시도·회귀 ──
test('v16 중복 요청: 같은 requestId 재전송 → 답 1개 · OpenAI 0번 · 같은 질문', async () => {
  const state = fresh();
  const { call, calls } = loadServer(() => reply({ interesting_clue: '편한친구', next_question: '편한 친구는 어떤 사람이에요?' }), state);
  const id = uuid();
  const a = await call({ action: 'turn', text: '그냥 편한친구 부담없이', answeredQuestion: FIRST }, id);
  const b = await call({ action: 'turn', text: '그냥 편한친구 부담없이', answeredQuestion: FIRST }, id);
  assert.equal(state.records.length, 1);
  assert.equal(b.body.duplicate, true);
  assert.equal(b.body.question.text, a.body.question.text);
  assert.equal(calls.length, 1, '두 번째는 OpenAI 0번');
});
test('v16 다음 질문 받기: 저장된 질문이 있으면 OpenAI 0번 · 없으면 1번', async () => {
  const state = fresh();
  let fail = true;
  const { call, calls } = loadServer(() => fail ? reply({ next_question: '' }) : reply({ interesting_clue: '부담없이', next_question: '부담 없다는 건 어떤 느낌이에요?' }), state);
  const a = await call({ action: 'turn', text: '그냥 편한친구 부담없이', answeredQuestion: FIRST });
  assert.equal(a.body.question, null);
  fail = false;
  const before = calls.length;
  const b = await call({ action: 'turn', recordId: a.body.record.id });
  assert.equal(b.body.question.text, '부담 없다는 건 어떤 느낌이에요?');
  assert.equal(calls.length - before, 1);
  const c = await call({ action: 'turn', recordId: a.body.record.id });
  assert.equal(c.body.question.text, b.body.question.text);
  assert.equal(calls.length - before, 1, '이미 저장된 질문은 OpenAI 0번');
});
test('v16 다른 질문 받기: 직전 질문과 다른 질문 · 새로고침 복원', async () => {
  const { state, server, first } = await afterFirstAnswer(() => reply({ interesting_clue: '부담없이', next_question: '부담 없는 사이는 어떤 느낌이에요?' }));
  const r = await server.call({ action: 'turn', recordId: first.body.question.sourceRecordId, skip: true, answeredQuestion: first.body.question.text });
  assert.equal(r.body.question.text, '부담 없는 사이는 어떤 느낌이에요?');
  assert.equal(server.calls.at(-1).input.skip, true);
  const restored = await server.call({ action: 'followup_get', recordId: first.body.question.sourceRecordId });
  assert.equal(restored.body.question.text, r.body.question.text);
  assert.equal(state.records.length, 1);
});
test('v16 다섯 번째 답: 끝 · 질문 없음 · 규칙이 종류를 정했으면 OpenAI 0번', async () => {
  const records = [1, 2, 3, 4].map((i) => ({ id: uuid(), user_id: USER, text: `답 ${i}`, original_text: `답 ${i}`, status: 'confirmed', revision: 1, created_at: `2026-09-24T11:0${i}:00.000Z` }));
  const state = fresh({ records });
  const { call, calls } = loadServer(() => reply({}), state);
  const r = await call({ action: 'turn', text: '모르겠어요', answeredQuestion: '다섯 번째 질문이에요?' });
  assert.equal(r.body.saved, true);
  assert.equal(r.body.finished, true);
  assert.equal(r.body.question, null);
  assert.equal(calls.length, 0);
});
test('v16 처음부터 시작하기 뒤: 새 회차 기록만 칸·맥락으로 본다(지난 원문은 그대로)', async () => {
  const old = { id: uuid(), user_id: USER, text: '지난 회차 답', original_text: '지난 회차 답', status: 'confirmed', revision: 1, created_at: '2026-09-24T09:00:00.000Z' };
  const state = fresh({ records: [old], userMeta: { doit_round_started_at: '2026-09-24T10:00:00.000Z' } });
  const { call, calls } = loadServer(() => reply({ interesting_clue: '편한친구', next_question: '편한 친구는 어떤 사람이에요?' }), state);
  await call({ action: 'turn', text: '그냥 편한친구 부담없이', answeredQuestion: FIRST });
  assert.equal(calls[0].input.answered_count, 0, '지난 회차 답은 이번 칸에 안 센다');
  assert.deepEqual(calls[0].input.recent, [], '지난 회차 답은 맥락에 안 넣는다');
  assert.equal(state.records.length, 2, '지난 원문 삭제 0');
});
test('v16 AI 가 두 번 다 형식을 못 지키면 → 저장 0 · 502 · 입력창 보존 문구 (메타가 답으로 올라가지 않는다)', async () => {
  const state = fresh();
  const { call, calls } = loadServer(() => 'not json', state);
  const r = await call({ action: 'turn', text: '활동?갑자기?', answeredQuestion: '어떤 활동을 함께 하고 싶어요?' });
  assert.equal(r.status, 502);
  assert.match(r.body.error, /적은 말은 입력창에 그대로 있어요/);
  assert.equal(state.records.length, 0);
  assert.equal(calls.length, 2);
});
test('v16 지친 말: 규칙이 정하면 OpenAI 0번 · 저장 0 · 쉬어 가기', async () => {
  const state = fresh();
  const { call, calls } = loadServer(() => reply({}), state);
  const r = await call({ action: 'turn', text: '할말이없다 휴', answeredQuestion: '어떤 사람이면 편해요?' });
  assert.equal(r.body.kind, 'fatigue');
  assert.equal(r.body.pause, true);
  assert.equal(state.records.length, 0);
  assert.equal(calls.length, 0);
});
test('v16 저장 금지 입력: AI 를 부르기 전에 막는다', async () => {
  const state = fresh();
  const { call, calls } = loadServer(() => reply({}), state);
  const r = await call({ action: 'turn', text: '제 번호는 010-1234-5678이에요', answeredQuestion: FIRST });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'BLOCKED_CONTENT');
  assert.equal(calls.length, 0);
  assert.equal(state.records.length, 0);
});

// ── 관측 · 옛 관문 미호출 증명 ──
test('v16 관측 로그: 원문 없이 호출 수·호출별 ms·DB ms·검사 ms·다시 만든 이유·전체 ms', async () => {
  const state = fresh();
  const { call } = loadServer(() => reply({ interesting_clue: '편한친구', next_question: '편한 친구는 어떤 사람이에요?' }), state);
  await call({ action: 'turn', text: '그냥 편한친구 부담없이', answeredQuestion: FIRST });
  const log = turnLogs(state)[0];
  for (const k of ['request_id', 'turn', 'turn_type', 'llm_calls', 'llm_ms', 'db_ms', 'validate_ms', 'retry_reason', 'total_ms']) assert.ok(k in log, k);
  assert.equal(log.llm_ms.length, log.llm_calls);
  assert.ok(!state.logs.some((l) => l.includes('편한친구') || l.includes('편한 친구')), '사용자 원문·질문 문장은 로그에 없다');
});
test('v16 코드 증명: 한 턴 경로는 옛 관문(글자 수 분기·주제 칸·no_bridge·앵커·연결·되묻기·판정)을 부르지 않는다', () => {
  const start = SOURCE.indexOf('// ── v16 Conversation Architecture');
  const end = SOURCE.indexOf('Deno.serve(async (req: Request)');
  const block = SOURCE.slice(start, end);
  assert.ok(start > 0 && end > start);
  for (const name of ['pickStrategy', 'pickNextTopic', 'judgeCoveredTopics', 'composeQuestion', 'checkCandidate', 'generateFollowup', 'sharesWords', 'restatesAnswers', 'judgeSemanticBlock', 'classifyTurn', 'askReply', 'rephraseQuestion', 'lightQuestion', 'SHORT_ANSWER_MAX', 'CHANGE_DIRECTION', 'STRATEGY_GUIDE', 'QUESTION_STYLE', 'ACK_STYLE', 'no_bridge', 'not_anchored', 'directionOf']) {
    assert.ok(!new RegExp(`\\b${name}\\b`).test(block.replace(/^\s*\/\/.*$/gm, '')), `v16 경로가 ${name} 을(를) 쓰지 않는다(주석 제외)`);
  }
  assert.match(SOURCE, /if \(action === TURN_ACTION\) return await handleTurn/);
});

// ── 화면 계약 ↔ 서버(가짜 AI·가짜 DB) 이어 붙이기: 실제 화면 API(coreConversation.ts)가 실제 서버 응답을 받아들이는지 ──
function loadClientApi(server) {
  const js = ts.transpileModule(readFileSync('src/doit/lib/coreConversation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports }, { filename: 'coreConversation.ts' });
  const sent = [];
  const unwrap = async (body) => {
    sent.push(body);
    const r = await server.call(body);
    if (!r.body.ok) { const e = new Error(r.body.error); e.code = r.body.code; throw e; }
    return r.body;
  };
  return { api: module.exports.createCoreConversation({ read: unwrap, write: unwrap }), sent };
}
test('v16 화면↔서버: 「그냥 편한친구 부담없이」 → 「활동?갑자기?」 → 다른 질문 받기 — 화면 계약 검사를 모두 통과', async () => {
  const state = fresh();
  let n = 0;
  const server = loadServer(() => {
    n += 1;
    if (n === 1) return reply({ interesting_clue: '편한친구', next_question: '어떤 활동을 함께 하고 싶어요?' });
    if (n === 2) return reply({ turn_type: 'complaint', acknowledgement: '제가 너무 앞서갔네요.', interesting_clue: '부담없이', next_question: '부담 없는 사람은 어떤 사람이에요?' });
    return reply({ interesting_clue: '편한친구', next_question: '편한 친구랑은 주로 어디서 봐요?' });
  }, state);
  const { api, sent } = loadClientApi(server);
  const a = await api.turn({ text: '그냥 편한친구 부담없이', answeredQuestion: FIRST });
  assert.equal(a.saved, true);
  assert.equal(a.question.sourceRecordId, a.record.id);
  const b = await api.turn({ text: '활동?갑자기?', answeredQuestion: a.question.text, recordId: a.record.id });
  assert.equal(b.saved, false);
  assert.equal(b.kind, 'complaint');
  assert.equal(b.question.text, '제가 너무 앞서갔네요.\n부담 없는 사람은 어떤 사람이에요?');
  const c = await api.nextQuestion(a.record.id, b.question.text, { skip: true });
  assert.equal(c.text, '편한 친구랑은 주로 어디서 봐요?');
  assert.ok(sent.every((body) => body.action === 'turn'), '화면은 turn 한 가지 요청만 보낸다');
  assert.equal(state.records.length, 1, '문제제기·다른 질문 받기는 칸을 늘리지 않는다');
});
