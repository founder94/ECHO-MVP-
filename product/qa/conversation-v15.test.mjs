// v15 「ECHO AI 대화구조 최종 구현명세 · 2026-09-24」 회귀 검사 — 실제 서버 코드(doit-understanding)를 가짜 AI·가짜 DB 로 돌린다.
// [가짜 AI 기준 — 진짜 OpenAI 결과가 아니다. Mock PASS ≠ 실AI PASS.]
// 대표 실사용 원문(2026-09-24 09:17~09:21 KST, 운영 이벤트 기록과 같은 문장)을 그대로 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const USER = '11111111-1111-4111-8111-111111111111';
const uuid = () => globalThis.crypto.randomUUID();
const rid = (n) => `22222222-2222-4222-8222-00000000000${n}`;
const at = (min) => new Date(Date.UTC(2026, 8, 24, 0, min)).toISOString();
const A = '진지하게 알아가고싶어';
const B = '사람을 진지하게 알아가고싶다고';
const C = '여자를 천천히 진지하게 알아가고싶다고';
const D = '뭘더 얘길해야해 너가 내 내용을 반영해서 다음 질문을 해야하는거 아니야?';
const E = '할말이없다 휴';
const OPENING = '어떤 만남을 원하세요?';
const GENERIC = /조금만 더 들려줄래요|한 가지만 더 들려줄래요|라고 하셨죠|방금 한 말/;

// 가짜 DB: 표 3개(records·insights·events) + 서버가 부르는 RPC 의 모양만 흉내 낸다(요청 번호 멱등 포함).
function fakeDb(state) {
  const tables = { doit_records: state.records, doit_insights: state.insights, doit_request_events: state.events, profiles: state.profiles };
  const chain = (table) => {
    let rows = tables[table] ?? [];
    let insertRow = null;
    const c = {
      select: () => c, order: () => c, limit: () => c,
      eq: (col, v) => { rows = rows.filter((r) => r[col] === v); return c; },
      in: (col, vals) => { rows = rows.filter((r) => vals.includes(r[col])); return c; },
      gte: (col, v) => { rows = rows.filter((r) => String(r[col] ?? '') >= v); return c; },
      insert: (row) => { insertRow = row; return c; },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (ok) => {
        if (insertRow) {
          if (tables[table].some((r) => r.user_id === insertRow.user_id && r.request_id === insertRow.request_id)) return ok({ data: null, error: { code: '23505' } });
          tables[table].push({ ...insertRow, created_at: state.now() });
          state.inserts.push({ table, row: insertRow });
          return ok({ data: null, error: null });
        }
        return ok({ data: rows, error: null });
      },
    };
    return c;
  };
  const event = (args, extra = {}) => {
    const found = state.events.find((e) => e.request_id === args.p_request_id);
    if (found) return found;
    const e = { user_id: USER, request_id: args.p_request_id, action: args.p_action, payload_hash: args.p_payload_hash, status: 'applied', created_at: state.now(), ...extra };
    state.events.push(e);
    return null;
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: USER, user_metadata: state.userMeta ?? {} } }, error: null }) },
    from: (table) => chain(table),
    rpc: async (name, args) => {
      state.rpcCalls.push({ name, args });
      const rec = state.records.find((r) => r.id === args.p_record_id);
      const context = { ok: true, record: rec, insights: state.insights, purpose: { id: 'romance', label: '연애로 이어질 만남을 원해요' }, context_hash: 'h' };
      if (name === 'doit_followup_context') return { data: rec ? context : { ok: false, code: 'FORBIDDEN' }, error: null };
      if (name === 'doit_begin_insight_generate' || name === 'doit_begin_followup') return { data: { ok: true, duplicate: false, lease_token: args.p_lease_token, context }, error: null };
      if (name === 'doit_finish_followup') {
        if (args.p_error_code) return { data: { ok: false, code: args.p_error_code }, error: null };
        state.events.push({ user_id: USER, request_id: args.p_request_id, action: 'followup_generate', status: 'applied', target_id: args.p_record_id, created_at: state.now(), response_payload: { question: { text: args.p_question } } });
        return { data: { ok: true, duplicate: false, question: { text: args.p_question, sourceRecordId: args.p_record_id } }, error: null };
      }
      if (name === 'doit_finish_insight_generate') {
        if (args.p_error_code) return { data: { ok: false, code: args.p_error_code }, error: null };
        const insights = (args.p_candidates ?? []).map((c, i) => ({ id: uuid(), text: c.text, category: c.category, status: 'candidate', origin: 'ai', source_record_id: args.p_record_id, revision: 1 }));
        state.insights.push(...insights);
        return { data: { ok: true, duplicate: false, insights, ...(args.p_rescue ? { rescued: true, rescue: args.p_rescue } : {}) }, error: null };
      }
      if (name === 'doit_apply_insight_generate') {
        const prior = event(args, { target_id: args.p_record_id });
        if (prior) return { data: { ok: true, duplicate: true, insights: state.insights.filter((i) => i.request_id === args.p_request_id) }, error: null };
        const insights = args.p_candidates.map((c) => ({ id: uuid(), user_id: USER, text: c.text, ai_text: c.text, category: c.category, status: 'candidate', origin: 'ai', source_record_id: args.p_record_id, source_text: args.p_source_text, revision: 1, request_id: args.p_request_id, created_at: state.now(), updated_at: state.now() }));
        state.insights.push(...insights);
        return { data: { ok: true, duplicate: false, insights }, error: null };
      }
      if (name === 'doit_apply_insight_transition') {
        const row = state.insights.find((i) => i.id === args.p_insight_id);
        if (event(args)) return { data: { ok: true, duplicate: true, insight: row }, error: null };
        if (!row || row.status === 'rejected' || row.revision !== args.p_expected_revision) return { data: { ok: false, code: 'INVALID_STATE' }, error: null };
        Object.assign(row, { status: args.p_new_status, revision: row.revision + 1, request_id: args.p_request_id, ...(args.p_text ? { text: args.p_text } : {}) });
        return { data: { ok: true, duplicate: false, insight: row }, error: null };
      }
      if (name === 'doit_apply_insight_self') {
        if (event(args)) return { data: { ok: true, duplicate: true, insight: state.insights.find((i) => i.request_id === args.p_request_id) }, error: null };
        const row = { id: uuid(), user_id: USER, text: args.p_text, category: args.p_category, status: 'confirmed', origin: 'self', source_record_id: args.p_record_id, revision: 1, request_id: args.p_request_id, created_at: state.now(), updated_at: state.now() };
        state.insights.push(row);
        return { data: { ok: true, duplicate: false, insight: row }, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  };
}

function stageOf(system) {
  if (system.includes('너는 다음 질문의 후보만 만든다')) return 'compose';
  if (system.includes('다음 질문 후보(question)가 대화에 내보내도 되는지')) return 'judge';
  if (system.includes('reply 를 하나로 분류하라')) return 'classify';
  if (system.includes('"내가 이렇게 이해했어요" 카드')) return 'synthesis';
  if (system.includes('topics 의 각 항목')) return 'topic';
  if (system.includes("두 문장이 '같은 뜻'")) return 'semantic';
  if (system.includes('가장 분명한 이해를')) return 'gen';
  if (system.includes('AI 에게 질문(user_question)')) return 'ask';
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
      payloads.push({ stage, user: body.messages[1].content });
      // 답마다 이해 후보(gen) 경로는 JSON 이 아니라 글("기록:\n…")을 보낸다 — 읽지 못하면 글 그대로 넘긴다(전: 여기서 오류가 나 gen 가짜 답이 한 번도 쓰이지 않았다).
      const userContent = (() => { try { return JSON.parse(body.messages[1].content); } catch { return body.messages[1].content; } })();
      const answer = ai[stage] ? ai[stage](userContent, payloads.filter((p) => p.stage === stage).length) : null;
      if (answer === 'TIMEOUT') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer ?? {}) } }] }), { status: 200 });
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: 'doit-understanding.ts' });
  const call = async (payload) => {
    const res = await handler(new Request('http://fn/', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ requestId: uuid(), ...payload }) }));
    return { status: res.status, body: await res.json() };
  };
  return { call, payloads, exports: sandbox.exports };
}
function world(over = {}) {
  let tick = 0;
  return { records: [], insights: [], events: [], profiles: [{ id: USER, purpose_label: '연애로 이어질 만남을 원해요' }], rpcCalls: [], inserts: [], logs: [], now: () => at(30 + (tick++)), ...over };
}
const addAnswer = (s, n, text, minute) => { s.records.push({ id: rid(n), user_id: USER, text, status: 'confirmed', created_at: at(minute) }); return rid(n); };
const addAsked = (s, n, text, minute) => s.events.push({ user_id: USER, request_id: uuid(), action: 'followup_generate', status: 'applied', target_id: rid(n), created_at: at(minute), response_payload: { question: { text } } });
const allow = () => ({ allowed: true });
const topics = (covered) => () => ({ covered });
const candidate = (over) => ({ ack: '', candidate_question: '', continuation_reason: '방금 답을 이어받는다', source_meaning: '', topic: 'partner_style', is_repeat: false, assumes_unconfirmed_fact: false, uses_rejected_meaning: false, basis: '', keys: [], ...over });
const composes = (payloads) => payloads.filter((p) => p.stage === 'compose').map((p) => JSON.parse(p.user));

// ── CASE A~C: 대표 실사용 세 답. 같은 뜻 재질문·"조금만 더"로 도망가면 FAIL ──
test('CASE A "진지하게 알아가고싶어": 의미를 넓히는 다음 질문은 나가고, LLM 에 직전 질문(「어떤 만남을 원하세요?」)·답이 들어간다', async () => {
  const s = world();
  addAnswer(s, 1, A, 1);
  const { call, payloads } = loadServer({ topic: topics([]), judge: allow,
    compose: () => candidate({ ack: '진지하게 알아가고 싶으시군요.', basis: '진지하게 알아가고싶어', candidate_question: '진지하게 알아가려면 어떤 사람이면 좋겠어요?', source_meaning: '진지하게 알아가고 싶다' }) }, s);
  const { status, body } = await call({ action: 'followup_generate', recordId: rid(1), answeredQuestion: OPENING });
  assert.equal(status, 200);
  assert.equal(body.question.text, '진지하게 알아가고 싶으시군요.\n진지하게 알아가려면 어떤 사람이면 좋겠어요?');
  assert.doesNotMatch(body.question.text, GENERIC);
  const sent = composes(payloads)[0];
  assert.equal(sent.last_question, OPENING);
  assert.equal(sent.record, A);
});

test('CASE A 역: "진지하게 알아가고 싶어요?"처럼 답을 그대로 되묻는 후보는 떨어지고, 떨어진 이유를 알려 준 뒤 다시 만든 질문이 나간다', async () => {
  const s = world();
  addAnswer(s, 1, A, 1);
  const { call, payloads } = loadServer({ topic: topics([]), judge: allow,
    compose: (_p, n) => n === 1
      ? candidate({ candidate_question: '진지하게 알아가고 싶어요?', basis: '진지하게', source_meaning: '진지하게 알아가고 싶다' })
      : candidate({ ack: '진지하게 알아가고 싶으시군요.', candidate_question: '진지하게 만나면 어떤 점이 제일 중요해요?', basis: '진지하게', source_meaning: '진지하게 알아가고 싶다' }) }, s);
  const { body } = await call({ action: 'followup_generate', recordId: rid(1), answeredQuestion: OPENING });
  // 짧은 답(12자 이하)은 새 갈래라 방금 답을 받아 주는 첫 줄이 있어야 나간다.
  assert.equal(body.question.text, '진지하게 알아가고 싶으시군요.\n진지하게 만나면 어떤 점이 제일 중요해요?');
  assert.match(composes(payloads)[1].rejected_candidates[0].why, /이미 답한 말을 그대로 되물었다/);
});

test('CASE B·C 운영 재현: B 뒤 "어떤 사람과 진지하게 알아가고 싶어요?"(운영에 실제로 나간 질문) · C 뒤 같은 뜻 재질문은 서버가 막는다 — 안전문장으로도 도망가지 않는다', async () => {
  const s = world();
  addAsked(s, 0, OPENING, 0);
  addAnswer(s, 1, A, 1);
  addAsked(s, 1, '"진지하게 알아가고싶어"라고 하셨죠.\n조금만 더 들려줄래요?', 2);
  addAnswer(s, 2, B, 3);
  // AI 가 계속 같은 뜻만 내면: 세 번 떨어지고 명시적 실패(운영 v24 는 여기서 "…라고 하셨죠. 조금만 더"를 냈다).
  const sameMeaning = candidate({ candidate_question: '어떤 사람과 진지하게 알아가고 싶어요?', basis: '사람을 진지하게', source_meaning: '사람을 진지하게 알아가고 싶다' });
  let r = loadServer({ topic: topics([]), judge: allow, compose: () => sameMeaning }, s);
  let res = await r.call({ action: 'followup_generate', recordId: rid(2) });
  assert.equal(res.status, 502);
  assert.equal(res.body.code, 'AI_ERROR');
  assert.doesNotMatch(JSON.stringify(res.body), GENERIC);
  assert.equal(s.logs.filter((l) => l.includes('"reason":"restate"')).length, 3);
  // C 뒤: 앞 답 셋을 받아들이고 한 걸음 나아간 질문은 나간다.
  addAsked(s, 2, '어떤 사람과 진지하게 알아가고 싶어요?', 4);
  addAnswer(s, 3, C, 5);
  r = loadServer({ topic: topics(['partner_style']), judge: allow, compose: (_p, n) => n === 1
    ? candidate({ candidate_question: '여자를 천천히 진지하게 알아가고 싶어요?', basis: '천천히', source_meaning: '천천히 알아가고 싶다' })
    : candidate({ ack: '천천히 알아가고 싶으시군요.', basis: '천천히', candidate_question: '천천히라면 처음엔 어디서 만나는 게 편해요?', source_meaning: '천천히 알아가고 싶다' }) }, s);
  res = await r.call({ action: 'followup_generate', recordId: rid(3) });
  assert.equal(res.status, 200);
  assert.equal(res.body.question.text, '천천히 알아가고 싶으시군요.\n천천히라면 처음엔 어디서 만나는 게 편해요?');
  const sent = composes(r.payloads)[0];
  assert.deepEqual(sent.history.map((h) => h.a), [A, B], '앞 답 둘이 history 로 들어간다');
  assert.equal(sent.last_question, '어떤 사람과 진지하게 알아가고 싶어요?');
});

// ── CASE D: AI 에게 한 말·불만 ──
test('CASE D 분류: 대표 원문은 규칙만으로 불만(complaint) — 저장하지 않고(서버 저장 호출 0) 짧게 인정한다', async () => {
  const s = world();
  const { call, payloads } = loadServer({ classify: () => { throw new Error('규칙이 먼저 잡아야 한다'); } }, s);
  const { status, body } = await call({ action: 'turn_classify', text: D, question: '방금 한 말, 조금만 더 들려줄래요?' });
  assert.equal(status, 200);
  assert.equal(body.kind, 'complaint');
  assert.equal(body.reply, '맞아요. 앞에서 한 말을 이어서 다시 여쭤볼게요.');
  assert.equal(s.rpcCalls.length + s.inserts.length, 0, '기록·질문을 저장하지 않는다');
  assert.equal(payloads.length, 0, 'AI 를 부르지 않는다');
  for (const [text, kind] of [['왜 이런 걸 물어봐?', 'ask'], ['너 AI야?', 'ask'], ['그만할래', 'fatigue'], ['모르겠어', 'unsure'], ['그 뜻 아니야', 'correction']]) {
    const r = await loadServer({ ask: () => ({ reply: '여기에 답한 말로 어떤 사람을 소개할지 정해요.' }) }, world()).call({ action: 'turn_classify', text, question: '어떤 사람한테 끌려요?' });
    assert.equal(r.body.kind, kind, text);
  }
});

test('CASE D 규칙이 못 잡은 말은 AI 분류가 한 번 더 본다 · AI 가 실패하면 답으로 둔다(사용자를 막지 않는다)', async () => {
  let r = await loadServer({ classify: () => ({ kind: 'complaint', rest: '' }) }, world()).call({ action: 'turn_classify', text: '아까랑 똑같네 좀 제대로 물어봐', question: 'q?' });
  assert.equal(r.body.kind, 'complaint');
  r = await loadServer({ classify: () => ({ kind: 'answer' }) }, world()).call({ action: 'turn_classify', text: '같이 산책하는 사람이 좋아요', question: 'q?' });
  assert.equal(r.body.kind, 'answer');
  r = await loadServer({ classify: () => 'TIMEOUT' }, world()).call({ action: 'turn_classify', text: '사람 따라 다르죠 뭐', question: 'q?' });
  assert.equal(r.body.kind, 'answer');
});

test('CASE D 불만 뒤 새 질문(skip): 같은 기록에서 다른 질문을 만들고(이미 물은 질문 제외), 물은 질문은 이벤트 한 줄로 남긴다 · 같은 요청은 같은 답', async () => {
  const s = world();
  addAsked(s, 0, OPENING, 0);
  addAnswer(s, 1, A, 1);
  addAsked(s, 1, '"진지하게 알아가고싶어"라고 하셨죠.\n조금만 더 들려줄래요?', 2);
  const q = candidate({ candidate_question: '진지하게 만나려면 상대는 어떤 사람이면 좋아요?', basis: '진지하게', source_meaning: '진지하게 알아가고 싶다' });
  const { call, payloads } = loadServer({ topic: topics([]), judge: allow, compose: () => q }, s);
  const requestId = uuid();
  const r1 = await call({ action: 'followup_generate', recordId: rid(1), skip: true, requestId, answeredQuestion: '조금만 더 들려줄래요?' });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.question.text, '진지하게 만나려면 상대는 어떤 사람이면 좋아요?');
  assert.equal(s.inserts.length, 1);
  assert.equal(s.inserts[0].row.action, 'followup_skip');
  assert.ok(!s.rpcCalls.some((c) => c.name === 'doit_begin_followup'), 'DB 캐시(같은 기록 → 같은 질문)를 쓰지 않는다');
  assert.equal(composes(payloads)[0].skip_current_question, true);
  const r2 = await call({ action: 'followup_generate', recordId: rid(1), skip: true, requestId, answeredQuestion: '조금만 더 들려줄래요?' });
  assert.equal(r2.body.question.text, r1.body.question.text, '같은 요청 번호 → 저장된 같은 질문(AI 다시 부르지 않음)');
  assert.equal(composes(payloads).length, 1);
});

test('CASE D 예전 앱이 불만을 답으로 저장해 버린 경우에도 서버는 그 말로 이해 후보를 만들지 않는다(insight_generate)', async () => {
  const s = world();
  addAnswer(s, 1, B, 1);
  addAnswer(s, 2, D, 2);
  const { call, payloads } = loadServer({ topic: topics([]), judge: allow, gen: () => { throw new Error('불만으로 이해 후보를 만들면 안 된다'); },
    compose: () => candidate({ ack: '', candidate_question: '진지하게 알아가려면 어떤 사람이면 좋아요?', source_meaning: '사람을 진지하게 알아가고 싶다' }) }, s);
  const { status, body } = await call({ action: 'insight_generate', recordId: rid(2) });
  assert.equal(status, 200);
  assert.deepEqual(body.insights, []);
  assert.ok(!payloads.some((p) => p.stage === 'gen'));
  assert.equal(composes(payloads)[0].record_kind, 'complaint');
});

// ── CASE E: 지친 말 ──
test('CASE E "할말이없다 휴": 분류 = fatigue(저장 안 함) · 예전 앱이 저장해도 「할 말이 없다」 이해 후보를 만들지 않고 · 통합 카드 재료에서도 빠진다', async () => {
  let r = await loadServer({}, world()).call({ action: 'turn_classify', text: E, question: '어떤 사람한테 끌려요?' });
  assert.equal(r.body.kind, 'fatigue');
  assert.match(r.body.reply, /넘어가도 돼요/);
  const s = world();
  addAnswer(s, 1, E, 1);
  const { call, payloads } = loadServer({ topic: topics([]), judge: allow, gen: () => ({ candidates: [{ category: 'pattern', text: '할 말이 없다.', basis: '할말이없다' }] }),
    compose: () => candidate({ ack: '괜찮아요.', candidate_question: '처음 만나면 어디서 보는 게 편해요?', source_meaning: '쉬운 질문' }) }, s);
  r = await call({ action: 'insight_generate', recordId: rid(1) });
  assert.deepEqual(r.body.insights, [], '「할 말이 없다.」 카드(운영 09:20 실제)가 나오지 않는다');
  assert.ok(!payloads.some((p) => p.stage === 'gen'));
  assert.equal(r.body.rescue.text, '괜찮아요.\n처음 만나면 어디서 보는 게 편해요?');
  // 지친 말을 되풀이·해석하는 받아 주기는 뗀다
  const s2 = world(); addAnswer(s2, 1, E, 1);
  r = await loadServer({ topic: topics([]), judge: allow, compose: () => candidate({ ack: '할 말이 없으시군요.', candidate_question: '처음 만나면 어디서 보는 게 편해요?', source_meaning: '쉬운 질문' }) }, s2).call({ action: 'followup_generate', recordId: rid(1) });
  assert.equal(r.body.question.text, '처음 만나면 어디서 보는 게 편해요?');
});

// ── 정정: 대화 중 "그 뜻 아니야" ──
test('정정: 화면이 보낸 "아니라고 한 AI 문장"은 이번 회차에 실제로 물은 문장일 때만 정정 전 문장(superseded)이 되고, 같은 뜻 질문은 나가지 않는다', async () => {
  const s = world();
  addAnswer(s, 1, B, 1);
  addAsked(s, 1, '사람을 진지하게 알아가고 싶군요.\n어떤 사람과 진지하게 알아가고 싶어요?', 2);
  addAnswer(s, 2, '그게 아니라 천천히 알고 싶다고', 3);
  const { call, payloads } = loadServer({ topic: topics([]), judge: allow, semantic: () => ({ blocked: [] }), compose: (_p, n) => n === 1
    ? candidate({ ack: '', candidate_question: '사람을 진지하게 알아가고 싶은 거죠?', basis: '천천히', source_meaning: '천천히' })
    : candidate({ ack: '천천히가 중요하시군요.', basis: '천천히 알고 싶다', candidate_question: '천천히라면 얼마나 자주 보는 게 좋아요?', source_meaning: '천천히 알고 싶다' }) }, s);
  const { status, body } = await call({ action: 'followup_generate', recordId: rid(2), correction: '사람을 진지하게 알아가고 싶군요.' });
  assert.equal(status, 200);
  assert.equal(body.strategy, 'ACKNOWLEDGE_CORRECTION');
  assert.equal(body.question.text, '천천히가 중요하시군요.\n천천히라면 얼마나 자주 보는 게 좋아요?');
  assert.deepEqual(composes(payloads)[0].superseded, ['사람을 진지하게 알아가고 싶군요.']);
  // 물은 적 없는 문장은 받지 않는다(화면이 임의 문장을 정정 대상으로 만들 수 없다)
  const s2 = world(); addAnswer(s2, 1, '천천히요', 1);
  const r2 = loadServer({ topic: topics([]), judge: allow, compose: () => candidate({ ack: '', basis: '천천히', candidate_question: '천천히라면 얼마나 자주 보는 게 좋아요?', source_meaning: '천천히' }) }, s2);
  await r2.call({ action: 'followup_generate', recordId: rid(1), correction: '지어낸 문장' });
  assert.deepEqual(composes(r2.payloads)[0].superseded, []);
});

// ── CASE F · 통합 이해 카드(서버) ──
const fiveAnswers = (s) => { [A, B, C, '같이 산책하고 맛있는 거 먹고 싶어요', E].forEach((t, i) => addAnswer(s, i + 1, t, i * 2 + 1)); };
test('CASE F 통합 카드: 다섯 답 뒤 한 번 — 지친 말은 재료에서 빠지고, 근거 없는 항목·「할 말이 없어요」·거절한 뜻은 버리고, 항목을 근거가 된 답에 후보로 저장한다', async () => {
  const s = world({ insights: [{ id: 'old-rej', user_id: USER, text: '외로움을 많이 탄다', ai_text: '외로움을 많이 탄다', status: 'rejected', origin: 'ai', source_record_id: rid(1), created_at: at(0), updated_at: at(0) }] });
  fiveAnswers(s);
  const { call, payloads } = loadServer({ semantic: () => ({ blocked: [] }), synthesis: () => ({ items: [
    { text: '서두르기보다 천천히 알아가는 관계를 원해요.', basis: '천천히 진지하게', source: 2, category: 'value' },
    { text: '같이 산책하고 맛있는 걸 먹는 만남을 좋아해요.', basis: '같이 산책하고', source: 3, category: 'memory' },
    { text: '할 말이 없어요.', basis: '진지하게', source: 0, category: 'pattern' },
    { text: '외로움을 많이 타요.', basis: '진지하게', source: 0, category: 'pattern' },
    { text: '돈을 중요하게 여겨요.', basis: '재산', source: 1, category: 'value' },
  ] }) }, s);
  const { status, body } = await call({ action: 'synthesis_generate' });
  assert.equal(status, 200);
  assert.deepEqual(body.items.map((i) => i.text), ['서두르기보다 천천히 알아가는 관계를 원해요.', '같이 산책하고 맛있는 걸 먹는 만남을 좋아해요.']);
  assert.ok(body.items.every((i) => i.status === 'candidate'), '확인 전에는 후보(사실 아님)');
  assert.equal(body.items[0].source_record_id, rid(3));
  assert.equal(body.items[1].source_record_id, rid(4));
  const sent = JSON.parse(payloads.find((p) => p.stage === 'synthesis').user);
  assert.equal(sent.pairs.length, 4, '지친 말(할말이없다 휴)은 재료가 아니다');
  assert.ok(!sent.pairs.some((p) => p.a === E));
  assert.deepEqual(sent.rejected, ['외로움을 많이 탄다']);
  // 다시 부르면 다시 만들지 않고 같은 카드
  const again = await call({ action: 'synthesis_generate' });
  assert.equal(again.body.existing, true);
  assert.deepEqual(again.body.items.map((i) => i.id), body.items.map((i) => i.id));
  assert.equal(payloads.filter((p) => p.stage === 'synthesis').length, 1);
});

test('통합 카드 전제: 다섯 답 전에는 만들지 않는다(NOT_ENOUGH) · AI 가 항목을 못 만들면 명시적 실패(AI_ERROR) · 재료가 없으면 빈 카드로 끝', async () => {
  let s = world(); addAnswer(s, 1, A, 1);
  let r = await loadServer({}, s).call({ action: 'synthesis_generate' });
  assert.equal(r.body.code, 'NOT_ENOUGH');
  s = world(); fiveAnswers(s);
  r = await loadServer({ synthesis: () => ({ items: [{ text: '돈을 중요하게 여겨요.', basis: '재산', source: 0 }] }) }, s).call({ action: 'synthesis_generate' });
  assert.equal(r.status, 502);
  assert.equal(r.body.code, 'AI_ERROR');
  assert.equal(s.rpcCalls.filter((c) => c.name === 'doit_apply_insight_generate').length, 0, '근거 없는 항목은 저장하지 않는다');
  s = world(); ['모르겠어요', '할말이없다 휴', '몰라', '그만할래', '딱히 없어요'].forEach((t, i) => addAnswer(s, i + 1, t, i));
  r = await loadServer({ synthesis: () => { throw new Error('재료가 없으면 AI 를 부르지 않는다'); } }, s).call({ action: 'synthesis_generate' });
  assert.equal(r.body.done, true);
  assert.equal(r.body.empty, true);
});

test('통합 카드 결정: 맞아요 = 모두 확인(사실) · 그게 아니에요 = 모두 거절(같은 뜻 재등장 차단) · 남의·이미 정한 항목은 바꾸지 못함 · 같은 요청은 한 번만', async () => {
  const s = world(); fiveAnswers(s);
  const srv = loadServer({ synthesis: () => ({ items: [
    { text: '서두르기보다 천천히 알아가는 관계를 원해요.', basis: '천천히 진지하게', source: 2 },
    { text: '같이 산책하고 맛있는 걸 먹는 만남을 좋아해요.', basis: '같이 산책하고', source: 3 },
  ] }) }, s);
  const { body } = await srv.call({ action: 'synthesis_generate' });
  const ids = body.items.map((i) => i.id);
  const requestId = uuid();
  const c1 = await srv.call({ action: 'synthesis_decide', decision: 'confirm', ids, requestId });
  assert.equal(c1.status, 200);
  assert.ok(c1.body.insights.every((i) => i.status === 'confirmed'));
  const c2 = await srv.call({ action: 'synthesis_decide', decision: 'confirm', ids, requestId });
  assert.equal(c2.status, 200, '같은 요청을 다시 보내도 같은 결과');
  assert.equal(s.insights.filter((i) => i.status === 'confirmed').length, 2);
  const bad = await srv.call({ action: 'synthesis_decide', decision: 'reject', ids });
  assert.equal(bad.body.code, 'INVALID_STATE', '이미 확인한 항목을 거절로 바꾸지 못한다');
  const alien = await srv.call({ action: 'synthesis_decide', decision: 'confirm', ids: [uuid()] });
  assert.equal(alien.body.code, 'INVALID_STATE');
  const done = await srv.call({ action: 'synthesis_generate' });
  assert.equal(done.body.done, true, '이번 회차 카드는 다 정했다 — 다시 만들지 않는다');
  // 거절
  const s2 = world(); fiveAnswers(s2);
  const srv2 = loadServer({ synthesis: () => ({ items: [{ text: '서두르기보다 천천히 알아가는 관계를 원해요.', basis: '천천히 진지하게', source: 2 }] }) }, s2);
  const g2 = await srv2.call({ action: 'synthesis_generate' });
  const rj = await srv2.call({ action: 'synthesis_decide', decision: 'reject', ids: g2.body.items.map((i) => i.id) });
  assert.equal(rj.body.insights[0].status, 'rejected');
  assert.equal(s2.records.length, 5, '사용자 원문은 그대로');
});

test('통합 카드 직접 설명: 설명 = 직접 설명(확인된 말) · 기다리던 AI 항목은 내려놓고 · 설명을 가장 앞에 두고 다시 만든다 · 같은 요청은 한 번만', async () => {
  const s = world(); fiveAnswers(s);
  let round = 0;
  const srv = loadServer({ semantic: () => ({ blocked: [] }), synthesis: (p) => (++round === 1
    ? { items: [{ text: '서두르기보다 천천히 알아가는 관계를 원해요.', basis: '천천히 진지하게', source: 2 }] }
    : { items: [
      { text: '편하게 대화되는 사람이 제일 중요해요.', basis: '편하게 대화되는 사람', source: -1 },
      { text: '같이 산책하고 맛있는 걸 먹고 싶어해요.', basis: '같이 산책하고', source: 3 },
    ], _self: p.self }) }, s);
  const g = await srv.call({ action: 'synthesis_generate' });
  const requestId = uuid();
  const r = await srv.call({ action: 'synthesis_revise', text: '편하게 대화되는 사람이 제일 중요해요', requestId });
  assert.equal(r.status, 200);
  assert.equal(r.body.self.origin, 'self');
  assert.equal(r.body.self.status, 'confirmed', '사용자가 쓴 말은 그대로 확인된 말');
  assert.equal(s.insights.find((i) => i.id === g.body.items[0].id).status, 'rejected', '기다리던 AI 항목은 내려놓는다');
  assert.deepEqual(r.body.items.map((i) => i.text), ['같이 산책하고 맛있는 걸 먹고 싶어해요.'], '설명과 같은 뜻 항목은 겹치지 않게 뺀다');
  const again = await srv.call({ action: 'synthesis_revise', text: '편하게 대화되는 사람이 제일 중요해요', requestId });
  assert.equal(again.body.duplicate, true);
  assert.equal(s.insights.filter((i) => i.origin === 'self').length, 1, '설명은 한 번만 저장');
  const blocked = await srv.call({ action: 'synthesis_revise', text: '010-1234-5678 로 연락 주세요' });
  assert.equal(blocked.body.code, 'BLOCKED_CONTENT');
});

test('로그에 사용자 원문이 없다(분류·질문·카드 모든 경로)', async () => {
  const s = world(); fiveAnswers(s);
  const srv = loadServer({ topic: topics([]), judge: allow, semantic: () => ({ blocked: [] }),
    compose: () => candidate({ candidate_question: '같이 산책하면 어디가 좋아요?', basis: '같이 산책하고', source_meaning: '산책' }),
    synthesis: () => ({ items: [{ text: '서두르기보다 천천히 알아가는 관계를 원해요.', basis: '천천히 진지하게', source: 2 }] }) }, s);
  await srv.call({ action: 'turn_classify', text: D, question: 'q?' });
  await srv.call({ action: 'followup_generate', recordId: rid(4) });
  await srv.call({ action: 'synthesis_generate' });
  const logs = s.logs.join('\n');
  for (const t of [A, B, C, D, E, '같이 산책']) assert.ok(!logs.includes(t), `로그에 원문: ${t}`);
});

// ── v15.1 대표 결정 2 「대화 중 "그게 아니에요" 지속성」 · 결정 3 「고정 정정 안내문 조건」 [가짜 AI 기준] ──
// X = 서버가 실제로 보낸 AI 받아 주기(해석). 사용자가 "그게 아니에요" → X 를 거절로 저장 → 새로고침·재진입 뒤에도 X 는 다시 나오지 않는다.
const X = '밝은 에너지를 주는 사람이 좋으시군요.';
const XQ = `${X}\n그런 사람이랑 만나면 같이 뭐 하고 싶어요?`;
const Y = '에너지 말고 그냥 잘 웃는 게 좋다는 거예요';
const mentionsX = (text) => /에너지를\s*주는|밝은\s*에너지/.test(String(text ?? ''));
const rejectRows = (s) => s.events.filter((e) => e.action === 'followup_reject');
// 가짜 AI: 첫 후보는 일부러 X 를 되살린다(나쁜 모델) → 서버가 막아야 한다. 두 번째 후보는 Y 에서 이어진다.
const composeBadThenGood = (_p, n) => n === 1
  ? candidate({ ack: X, basis: '잘 웃는', candidate_question: '밝은 에너지를 주는 사람과 뭐 하고 싶어요?', source_meaning: '밝은 에너지', keys: ['밝은 에너지'] })
  : candidate({ ack: '잘 웃는 사람이 좋으시군요.', basis: '잘 웃는 게 좋다', candidate_question: '잘 웃는 사람과 만나면 뭐 하고 싶어요?', source_meaning: '잘 웃는 게 좋다', keys: ['잘 웃는'] });
const semanticX = (p) => ({ blocked: (p.candidates ?? []).filter((c) => mentionsX(c.text)).map((c) => c.i) });
function rejectedWorld() {
  const s = world();
  addAnswer(s, 1, '잘 웃는 사람', 10);
  addAsked(s, 1, XQ, 11);
  return s;
}

test('v15.1 A·E: "그게 아니에요" → 설명을 묻기 전에 X 를 거절로 저장(DB 변경 없이 이벤트 한 줄) · 사용자 원문은 그대로 · 다음 질문에 X 없음', async () => {
  const s = rejectedWorld();
  const recordsBefore = JSON.stringify(s.records);
  const { call, payloads } = loadServer({ topic: topics(['purpose', 'partner_style']), judge: allow, semantic: semanticX, compose: composeBadThenGood }, s);
  const c = await call({ action: 'turn_classify', text: '그게 아니에요', question: XQ, correction: X, recordId: rid(1) });
  assert.equal(c.body.kind, 'correction');
  assert.equal(c.body.rejected, true, '같은 응답 안에서 이미 저장됐다(설명 요청보다 먼저)');
  assert.match(c.body.reply, /어떤 뜻이었는지 한 줄로/);
  assert.equal(rejectRows(s).length, 1);
  assert.equal(JSON.stringify(rejectRows(s)[0].response_payload), JSON.stringify({ rejected: X }), '거절한 AI 문장만 남는다(사용자 원문 0)');
  assert.equal(JSON.stringify(s.records), recordsBefore, 'E: 사용자 원문(doit_records)은 바뀌지 않는다');
  assert.equal(s.inserts.filter((i) => i.table === 'doit_records').length, 0, '"그게 아니에요"는 답으로 저장하지 않는다');
  // 같은 거절을 한 번 더 보내도 한 줄(멱등)
  await call({ action: 'turn_classify', text: '그게 아니에요', question: XQ, correction: X, recordId: rid(1) });
  assert.equal(rejectRows(s).length, 1);
  // A: 설명 Y 뒤 다음 질문 — 화면이 정정 대상을 함께 보낸 경우
  addAnswer(s, 2, Y, 50);
  const r = await call({ action: 'followup_generate', recordId: rid(2), correction: X });
  assert.equal(r.status, 200);
  assert.ok(!mentionsX(r.body.question.text), `X 재등장 금지: ${r.body.question.text}`);
  assert.equal(r.body.strategy, 'ACKNOWLEDGE_CORRECTION');
  assert.ok(composes(payloads)[0].rejected.includes(X), 'AI 자료에도 "거절한 해석"으로 들어간다');
  assert.equal(JSON.stringify(s.records.slice(0, 1)), JSON.stringify(JSON.parse(recordsBefore)), 'E: 앞 답도 그대로');
  assert.equal(s.records[1].text, Y, 'E: 설명 Y 는 Y 그대로');
  assert.ok(!s.logs.some((l) => l.includes('에너지') || l.includes('잘 웃는')), '로그에 원문·거절 문장이 없다');
});

test('v15.1 B: 거절 → 새로고침(화면이 정정 대상을 잊음) → 다음 질문에 X 없음 · 서버가 저장분으로 정정 전략을 되살린다', async () => {
  const s = rejectedWorld();
  s.events.push({ user_id: USER, request_id: uuid(), action: 'followup_reject', status: 'applied', target_id: rid(1), created_at: at(12), response_payload: { rejected: X } });
  addAnswer(s, 2, Y, 13);
  const { call, payloads } = loadServer({ topic: topics(['purpose', 'partner_style']), judge: allow, semantic: semanticX, compose: composeBadThenGood }, s);
  const r = await call({ action: 'followup_generate', recordId: rid(2) }); // correction 없음 = 새로고침 뒤
  assert.equal(r.status, 200);
  assert.ok(!mentionsX(r.body.question.text), r.body.question.text);
  assert.equal(r.body.strategy, 'ACKNOWLEDGE_CORRECTION', '직전 답과 이번 답 사이의 거절 = 이번 답은 그 정정의 설명');
  const first = composes(payloads)[0];
  assert.ok(first.rejected.includes(X) && first.superseded.includes(X));
});

test('v15.1 C·D: 거절 → 앱 재진입 → 여러 턴 뒤·통합 카드에서도 X 없음 · 설명 Y 가 X 보다 앞선다', async () => {
  const s = rejectedWorld();
  s.events.push({ user_id: USER, request_id: uuid(), action: 'followup_reject', status: 'applied', target_id: rid(1), created_at: at(12), response_payload: { rejected: X } });
  addAnswer(s, 2, Y, 13);
  addAnswer(s, 3, '같이 산책하고 맛있는 거 먹고 싶어요', 15);
  const later = loadServer({ topic: topics(['purpose', 'partner_style', 'together']), judge: allow, semantic: semanticX, compose: (_p, n) => n === 1
    ? candidate({ ack: '밝은 에너지가 좋으시군요.', basis: '산책', candidate_question: '밝은 에너지를 주는 사람과 산책하면 어때요?', source_meaning: '산책', keys: ['밝은 에너지'] })
    : candidate({ ack: '산책이 좋으시군요.', basis: '산책하고', candidate_question: '산책은 얼마나 자주 하고 싶어요?', source_meaning: '산책하고 맛있는 거', keys: ['산책'] }) }, s);
  const r = await later.call({ action: 'followup_generate', recordId: rid(3) });
  assert.ok(!mentionsX(r.body.question.text), `C: 여러 턴 뒤에도 X 없음: ${r.body.question.text}`);
  assert.notEqual(r.body.strategy, 'ACKNOWLEDGE_CORRECTION', '정정은 그 다음 답에만 걸린다(이번 답은 새 이야기)');
  assert.ok(composes(later.payloads)[0].rejected.includes(X), 'C: 거절은 계속 차단 목록에 있다');
  addAnswer(s, 4, '천천히 알아가고 싶어요', 17);
  addAnswer(s, 5, '주말에 한 번 정도요', 19);
  const synth = loadServer({ semantic: semanticX, synthesis: (p) => {
    assert.ok(p.rejected.includes(X), 'D: 카드 자료에 X 가 "아니라고 한 해석"으로 들어간다');
    assert.ok(p.pairs.some((x) => x.a.includes('잘 웃는 게 좋다')), 'D: 설명 Y 는 카드 재료다');
    return { items: [
      { text: '밝은 에너지를 주는 사람을 원해요.', basis: '잘 웃는 게 좋다', source: 1, category: 'value' },
      { text: '잘 웃는 사람이 좋아요.', basis: '잘 웃는 게 좋다', source: 1, category: 'value' },
      { text: '산책하고 맛있는 걸 먹고 싶어요.', basis: '산책하고 맛있는 거 먹고 싶어요', source: 2, category: 'pattern' },
    ] };
  } }, s);
  const g = await synth.call({ action: 'synthesis_generate' });
  assert.equal(g.status, 200);
  const texts = g.body.items.map((i) => i.text);
  assert.ok(!texts.some(mentionsX), `D: 카드에 X 없음: ${texts.join(' / ')}`);
  assert.ok(texts.includes('잘 웃는 사람이 좋아요.'), 'D: Y 에서 나온 항목은 남는다');
});

test('v15.1 결정 3: 정정 안내는 관계 질문으로 나가지 않고(후보가 안내문과 같으면 버림) · 이미 설명했으면 다시 묻지 않고 · 두 번째 "아니에요"면 되풀이하지 않고 넘어간다', async () => {
  // ① AI 가 정정 안내문을 질문 후보로 내면 버리고 다시 만든다(고정 대체 문장으로 쓰지 않는다)
  const s = world(); addAnswer(s, 1, '잘 웃는 사람', 1);
  const one = loadServer({ topic: topics(['purpose', 'partner_style']), judge: allow, compose: (_p, n) => n === 1
    ? candidate({ ack: '잘 웃는 사람이 좋으시군요.', basis: '잘 웃는', candidate_question: '어떤 뜻이었는지 한 줄로 알려 줄래요?', source_meaning: '잘 웃는' })
    : candidate({ ack: '잘 웃는 사람이 좋으시군요.', basis: '잘 웃는', candidate_question: '잘 웃는 사람과 뭐 하고 싶어요?', source_meaning: '잘 웃는' }) }, s);
  const q = await one.call({ action: 'followup_generate', recordId: rid(1) });
  assert.ok(!/어떤 뜻이었는지/.test(q.body.question.text), q.body.question.text);
  assert.equal(composes(one.payloads).length, 2, '안내문 후보는 떨어지고 다시 만든다');
  assert.match(JSON.stringify(composes(one.payloads)[1].rejected_candidates), /화면 안내 문장/);
  // ② 정정 내용을 이미 말했으면(설명 붙음) 안내를 보이지 않는다 — 거절은 그래도 먼저 저장
  const s2 = rejectedWorld();
  const two = loadServer({}, s2);
  const withRest = await two.call({ action: 'turn_classify', text: '그게 아니라 잘 웃는 게 좋다는 거예요', question: XQ, correction: X, recordId: rid(1) });
  assert.equal(withRest.body.kind, 'correction');
  assert.equal(withRest.body.rest, '잘 웃는 게 좋다는 거예요');
  assert.equal(withRest.body.reply, undefined, '설명을 다시 요구하지 않는다');
  assert.equal(withRest.body.rejected, true);
  // ③ 안내를 보인 뒤 또 "아니야"만 오면 같은 안내를 되풀이하지 않는다(설명 책임을 넘기지 않는다) · 안내문 자체는 거절로 저장하지 않는다
  const again = await two.call({ action: 'turn_classify', text: '아니야', question: '제가 잘못 짚었네요.\n어떤 뜻이었는지 한 줄로 알려 줄래요?', correction: '제가 잘못 짚었네요.', recordId: rid(1) });
  assert.equal(again.body.kind, 'correction');
  assert.equal(again.body.again, true);
  assert.doesNotMatch(again.body.reply, /어떤 뜻이었는지/);
  assert.equal(again.body.rejected, false, '안내문은 AI 해석이 아니다 → 거절로 저장하지 않는다');
  assert.equal(rejectRows(s2).length, 1);
  // ④ 이번 회차에 물은 적 없는 문장은 거절로 저장하지 않는다(화면이 임의 문장을 넣을 수 없다)
  const s3 = rejectedWorld();
  const three = loadServer({}, s3);
  const forged = await three.call({ action: 'turn_classify', text: '그게 아니에요', question: XQ, correction: '지어낸 문장이에요.', recordId: rid(1) });
  assert.equal(forged.body.rejected, false);
  assert.equal(rejectRows(s3).length, 0);
});

// ── v15.1 대표 결정 5 「글자쌍 휴리스틱 공격 검사」 [가짜 AI 기준 · 경계값은 바꾸지 않았다] ──
// 휴리스틱(restatesAnswers·not_anchored·반복 판정)은 [휴리스틱 / 추가 검증 필요]. 두 방향으로 공격하고, 못 막거나 잘못 막는 쪽은 todo 로 남겨 보이게 한다.
// 답은 12자보다 길게 쓴다(짧은 답은 "새 갈래 + 받아 주는 첫 줄 필수" 규칙이 먼저 걸려 휴리스틱만 따로 볼 수 없다 — 처음 만든 검사가 그 규칙에 걸려 잘못 읽혔다).
async function probe({ answer, asked, candidateQ, ack = '', basis = '', judge = allow }) {
  const s = world();
  addAnswer(s, 1, '진지하게 알아가고싶어', 1);
  addAsked(s, 1, asked, 2);
  addAnswer(s, 2, answer, 3);
  const { call, payloads } = loadServer({ topic: topics(['purpose', 'partner_style']), judge, compose: () => candidate({ ack, basis, candidate_question: candidateQ, source_meaning: answer, keys: [] }) }, s);
  const r = await call({ action: 'followup_generate', recordId: rid(2) });
  const reasons = s.logs.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((l) => l?.stage === 'compose' && l.step === 'dropped').map((l) => l.reason);
  return { out: r.body.question?.text ?? null, code: r.body.code ?? null, strategy: r.body.strategy ?? null, drops: composes(payloads).length, reasons };
}
const LONG = '잘 웃고 대화가 편한 사람이 좋아요';
test('v15.1 휴리스틱 공격 ①-a: 이미 물은 질문과 같은 뜻·다른 표현 — 판정 AI 가 막으면 나가지 않는다(명시적 실패)', async () => {
  const judge = (p) => ({ allowed: !/스타일/.test(p.question) });
  const r = await probe({ answer: LONG, asked: '어떤 사람한테 끌려요?', candidateQ: '끌리는 사람은 어떤 스타일이에요?', judge });
  assert.equal(r.out, null);
  assert.equal(r.code, 'AI_ERROR');
  assert.deepEqual(r.reasons, ['not_coherent', 'not_coherent', 'not_coherent'], '판정 AI 불허로 떨어졌다');
});
test('v15.1 휴리스틱 공격 ①-b [휴리스틱 / 추가 검증 필요]: 같은 뜻·다른 표현을 글자 휴리스틱만으로도 막는가(판정 AI 가 허용할 때)', { todo: '글자쌍 반복 판정은 "어떤 사람한테 끌려요?" ↔ "끌리는 사람은 어떤 스타일이에요?" 같은 바꿔 말하기를 못 잡는다 — 판정 AI(의미)에 의존한다. 실제 AI 에서 얼마나 새는지는 LEVEL 2 필요' }, async () => {
  const r = await probe({ answer: LONG, asked: '어떤 사람한테 끌려요?', candidateQ: '끌리는 사람은 어떤 스타일이에요?' });
  assert.equal(r.out, null, `휴리스틱만으로는 나간다: ${r.out}`);
});
test('v15.1 휴리스틱 공격 ②-a: 글자는 비슷해도 자연스럽게 한 걸음 나아간 질문은 통과한다(되묻기 오판 없음)', async () => {
  for (const [answer, q] of [
    ['말이 잘 통하는 사람이랑 만나고 싶어요', '말이 잘 통하는 사람이랑 같이 뭐 하고 싶어요?'],
    ['조용한 카페에서 이야기하는 거 좋아해요', '조용한 카페라면 얼마나 자주 만나고 싶어요?'],
    ['천천히 알아가는 게 좋아요 서두르지 않고', '천천히라면 처음엔 어떻게 만나고 싶어요?'],
  ]) {
    const r = await probe({ answer, asked: '어떤 사람한테 끌려요?', candidateQ: q });
    assert.equal(r.strategy, 'EXPLORE_USER_MEANING', '12자 넘는 답 = 휴리스틱만 보는 경로');
    assert.equal(r.out, q, `${answer} → ${q} (떨어진 이유: ${r.reasons.join(',')})`);
  }
});
test('v15.1 휴리스틱 공격 ②-b [휴리스틱 / 추가 검증 필요]: 뜻으로는 이어지지만 글자 조각이 없고 받아 주는 첫 줄도 없는 질문', { todo: 'not_anchored(두 글자 조각) 는 "산책…" → "걷는 거 좋아하면 어디로 가고 싶어요?" 처럼 뜻만 이어진 질문을 판정 AI 가 허용해도 떨어뜨린다(첫 줄이 있으면 통과 — ②-c). 실제 AI 가 첫 줄 없이 이런 질문을 얼마나 내는지는 LEVEL 2 필요' }, async () => {
  const r = await probe({ answer: '산책하는 걸 제일 좋아해요 요즘', asked: '만나면 같이 뭐 하고 싶어요?', candidateQ: '걷는 거 좋아하면 어디로 가고 싶어요?' });
  assert.equal(r.out, '걷는 거 좋아하면 어디로 가고 싶어요?', `떨어진 이유: ${r.reasons.join(',')}`);
});
test('v15.1 휴리스틱 공격 ②-c: 같은 질문도 방금 답을 근거로 받아 주는 첫 줄이 있으면 통과한다(빠져나갈 문)', async () => {
  const r = await probe({ answer: '산책하는 걸 제일 좋아해요 요즘', asked: '만나면 같이 뭐 하고 싶어요?', candidateQ: '걷는 거 좋아하면 어디로 가고 싶어요?', ack: '산책을 좋아하시는군요.', basis: '산책하는 걸' });
  assert.equal(r.out, '산책을 좋아하시는군요.\n걷는 거 좋아하면 어디로 가고 싶어요?', `떨어진 이유: ${r.reasons.join(',')}`);
});

test('v15.1 B5: 대화 중 거절한 X 는 예전 앱 경로(답마다 이해 후보 insight_generate)에서도 후보로 나오지 않는다', async () => {
  const s = rejectedWorld();
  s.events.push({ user_id: USER, request_id: uuid(), action: 'followup_reject', status: 'applied', target_id: rid(1), created_at: at(12), response_payload: { rejected: X } });
  addAnswer(s, 2, '밝게 잘 웃고 대화가 편한 사람이 좋아요', 13);
  const { call, payloads } = loadServer({ topic: topics([]), judge: allow, semantic: semanticX,
    gen: () => ({ candidates: [
      { category: 'value', text: X, basis: '밝게 잘 웃고', meaning: '밝은 에너지', keys: ['밝게'] }, // 답에 있는 낱말(밝게)로 근거 검사는 통과 → 거절 차단만이 막는다
      { category: 'value', text: '대화가 편한 사람을 중요하게 봐요.', basis: '대화가 편한 사람', meaning: '대화가 편한 사람', keys: ['대화가 편한'] },
    ] }),
    compose: () => candidate({ ack: '', candidate_question: '대화가 편한 사람과 뭐 하고 싶어요?', basis: '대화가 편한', source_meaning: '대화가 편한 사람' }) }, s);
  const { status, body } = await call({ action: 'insight_generate', recordId: rid(2) });
  assert.equal(status, 200);
  assert.ok(payloads.some((p) => p.stage === 'gen'), '이해 후보를 실제로 만들었다');
  assert.ok(!(body.insights ?? []).some((i) => mentionsX(i.text)), `X 가 후보로 나오면 안 된다: ${JSON.stringify((body.insights ?? []).map((i) => i.text))}`);
  assert.ok(!s.insights.some((i) => mentionsX(i.text)), '저장된 후보에도 X 없음');
});

// ── v15.1 서버 본래 역할(Conversation State Machine) · 톤 고정 [가짜 AI 기준] ──
test('v15.1 상태 관문: 이번 회차 답이 다섯 개면 서버가 더 묻지 않는다(AI·저장 RPC 호출 0) — 화면만 멈추던 것을 서버가 결정', async () => {
  const s = world();
  [A, '잘 웃는 사람이요 대화가 편한', '산책하고 맛있는 거 먹기', '천천히요', '주말에 한 번 정도요'].forEach((t, i) => addAnswer(s, i + 1, t, i * 2 + 1));
  const { call, payloads } = loadServer({ topic: topics([]), judge: allow, compose: () => { throw new Error('다섯 칸 뒤에는 AI 를 부르면 안 된다'); } }, s);
  for (const extra of [{}, { skip: true }]) {
    const r = await call({ action: 'followup_generate', recordId: rid(5), ...extra });
    assert.equal(r.status, 200);
    assert.equal(r.body.question, null);
    assert.equal(r.body.finished, true);
  }
  assert.equal(payloads.length, 0, 'AI 호출 0');
  assert.ok(!s.rpcCalls.some((c) => c.name === 'doit_begin_followup'), '다음 질문 자리도 만들지 않는다');
  // 아니라고 한 기록은 칸에 세지 않는다 → 네 칸이면 계속 묻는다
  const s2 = world();
  [A, '잘 웃는 사람이요 대화가 편한', '산책하고 맛있는 거 먹기', '천천히요'].forEach((t, i) => addAnswer(s2, i + 1, t, i * 2 + 1));
  s2.records.push({ id: rid(9), user_id: USER, text: '지운 답', status: 'rejected', created_at: at(9) });
  const r2 = loadServer({ topic: topics(['purpose', 'partner_style', 'together']), judge: allow, compose: () => candidate({ ack: '천천히가 좋으시군요.', basis: '천천히', candidate_question: '처음엔 얼마나 자주 보고 싶어요?', source_meaning: '천천히' }) }, s2);
  const q2 = await r2.call({ action: 'followup_generate', recordId: rid(4) });
  assert.ok(q2.body.question?.text, '네 칸이면 계속 묻는다');
});

test('v15.1 톤 고정: "왜"를 연달아 묻지 않는다(직전 질문이 "왜"면 "왜" 후보는 떨어지고 가벼운 다른 물음으로)', async () => {
  const s = world();
  addAnswer(s, 1, '진지하게 알아가고싶어', 1);
  addAsked(s, 1, '진지한 만남이 좋으시군요.\n왜 진지한 만남이 좋아요?', 2);
  addAnswer(s, 2, '가볍게 만나는 건 지쳐서 그런 것 같아요', 3);
  const { call, payloads } = loadServer({ topic: topics(['purpose']), judge: allow, compose: (_p, n) => n === 1
    ? candidate({ ack: '', basis: '지쳐서', candidate_question: '왜 가볍게 만나는 게 지쳤어요?', source_meaning: '가볍게 만나는 건 지쳐서' })
    : candidate({ ack: '', basis: '가볍게 만나는', candidate_question: '가볍게 말고 어떻게 만나고 싶어요?', source_meaning: '가볍게 만나는 건 지쳐서' }) }, s);
  const r = await call({ action: 'followup_generate', recordId: rid(2) });
  const whyReasons = s.logs.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((l) => l?.stage === 'compose' && l.step === 'dropped').map((l) => l.reason);
  assert.equal(r.body.question?.text, '가볍게 말고 어떻게 만나고 싶어요?', `떨어진 이유: ${whyReasons.join(',')}`);
  assert.match(JSON.stringify(composes(payloads)[1].rejected_candidates), /'왜'를 연달아/);
  // 직전 질문에 "왜"가 없으면 "왜" 한 번은 막지 않는다(규칙은 "연속"만)
  const s2 = world();
  addAnswer(s2, 1, '진지하게 알아가고싶어', 1);
  addAsked(s2, 1, '어떤 만남을 원하세요?', 2);
  addAnswer(s2, 2, '가볍게 만나는 건 지쳐서 그런 것 같아요', 3);
  // (답을 그대로 되묻는 "왜 가볍게 만나는 게 지쳤어요?"는 되묻기 검사가 따로 막는다 — 여기서는 되묻지 않는 "왜" 하나를 쓴다)
  const two = loadServer({ topic: topics(['purpose']), judge: allow, compose: () => candidate({ ack: '', basis: '지쳐서', candidate_question: '왜 가벼운 만남은 지쳐요?', source_meaning: '가볍게 만나는 건 지쳐서' }) }, s2);
  assert.equal((await two.call({ action: 'followup_generate', recordId: rid(2) })).body.question?.text, '왜 가벼운 만남은 지쳐요?');
});

test('v15.1 목적·톤 관문: 판정 AI 는 관계 목적·톤 기준과 사용자가 고른 목적을 함께 받고, 불허하면 나가지 않는다(판정은 뜻 판단 — 글자 규칙으로 대신하지 않음)', async () => {
  const s = world();
  addAnswer(s, 1, '편하게 대화가 되는 사람이요 말이 잘 통하는', 1);
  let seen = null;
  const judge = (p) => { seen = p; return { allowed: !/날씨/.test(p.question) }; };
  const { call, payloads } = loadServer({ topic: topics(['purpose']), judge, compose: (_p, n) => n === 1
    ? candidate({ ack: '', basis: '대화가 되는', candidate_question: '대화가 되는 날엔 날씨가 어때요?', source_meaning: '편하게 대화' })
    : candidate({ ack: '', basis: '대화가 되는', candidate_question: '대화가 잘 되는 사람과 뭐 하고 싶어요?', source_meaning: '편하게 대화' }) }, s);
  const r = await call({ action: 'followup_generate', recordId: rid(1) });
  assert.equal(r.body.question.text, '대화가 잘 되는 사람과 뭐 하고 싶어요?');
  assert.equal(seen.evidence.purpose?.label, '연애로 이어질 만남을 원해요', '판정 AI 가 사용자가 고른 목적을 받는다');
  const src = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');
  const judgeSystem = src.slice(src.indexOf('const judgeSystem'), src.indexOf('const judgeOnce'));
  for (const rule of ['목적 관문', '톤 관문', '여러 정보를 요구', '과거·상처·내면·이유', '면접·설문·심문·심리상담']) assert.ok(judgeSystem.includes(rule), `판정 기준에 「${rule}」`);
  const style = src.slice(src.indexOf('const QUESTION_STYLE'), src.indexOf('const ACK_STYLE'));
  for (const rule of ['가볍게·짧게·심플하게', '한 번에 하나만 묻는다', '단서 하나만', '한 단계만', "'왜'를 연달아", '가볍게 답하면 가볍게', '면접·설문·심문·심리상담']) assert.ok(style.includes(rule), `질문 말투 기준에 「${rule}」`);
  assert.ok(payloads.filter((p) => p.stage === 'judge').length >= 2);
});
