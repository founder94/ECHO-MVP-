// Local contract checks only. No network, real Supabase, user data, or OpenAI calls.
// Runs the actual Edge handler with controlled SDK and AI boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const filename = new URL('../functions/doit-understanding/index.ts', import.meta.url);
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.length ?? 0, 0);
const javascript = compiled.outputText.replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@2\.57\.4";$/m, '');
const uid = '11111111-1111-4111-8111-111111111111';
const rid = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const text = '자주 연락하기보다 약속을 지키는 게 중요해요.';
const context = { record: { id: rid, text, status: 'confirmed' }, insights: [], context_hash: 'context-1' };
const question = '어떤 약속을 지켜줬을 때 마음이 편했나요?';

function harness({ claim, finish, get, ai = [], env = {}, rpcError } = {}) {
  const calls = { ai: [], rpc: [], logs: [] };
  let handler;
  let lease;
  const sdk = {
    auth: { getUser: async () => ({ data: { user: { id: uid } }, error: null }) },
    rpc: async (name, args) => {
      calls.rpc.push({ name, args });
      if (rpcError) return { data: null, error: { code: rpcError } };
      if (name === 'doit_begin_followup' || name === 'doit_begin_insight_generate') {
        lease = args.p_lease_token;
        return { data: claim ?? { ok: true, context, lease_token: lease }, error: null };
      }
      if (name === 'doit_finish_followup') {
        assert.equal(args.p_lease_token, lease);
        assert.equal(args.p_user_id, uid);
        return { data: finish ?? (args.p_error_code ? { ok: false, code: args.p_error_code } :
          { ok: true, question: { text: args.p_question, sourceRecordId: rid } }), error: null };
      }
      if (name === 'doit_finish_insight_generate') {
        assert.equal(args.p_lease_token, lease);
        assert.equal(args.p_user_id, uid);
        return { data: finish ?? (args.p_error_code ? { ok: false, code: args.p_error_code } :
          { ok: true, insights: args.p_candidates.map((c, i) => ({ ...c, id: `mock-${i}`, status: 'candidate', revision: 1 })),
            ...(args.p_rescue ? { rescued: true, rescue: args.p_rescue } : {}), trace: args.p_trace }), error: null };
      }
      if (name === 'doit_get_followup') return { data: get ?? { ok: true, question: null }, error: null };
      if (name === 'doit_apply_record_create') return { data: { ok: true,
        record: { id: rid, text: args.p_text, original_text: args.p_original_text, status: args.p_status, revision: 1 } }, error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const runtime = {
    Deno: {
      env: { get: (key) => Object.prototype.hasOwnProperty.call(env, key) ? env[key] :
        ({ SUPABASE_URL: 'https://mock.invalid', SUPABASE_ANON_KEY: 'mock', SUPABASE_SERVICE_ROLE_KEY: 'mock', OPENAI_API_KEY: 'mock', OPENAI_MODEL: 'unchanged-mock-model' }[key] ?? '') },
      serve: (fn) => { handler = fn; },
    },
    createClient: () => sdk,
    crypto: webcrypto, TextEncoder, Response, Request, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      calls.ai.push({ url, body: JSON.parse(options.body) });
      const next = ai[calls.ai.length - 1];
      if (next === undefined) throw new Error('Unexpected network attempt blocked by test harness');
      if (next?.httpStatus) return new Response(JSON.stringify({ error: next.error }), { status: next.httpStatus });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(next) } }] }), { status: 200 });
    },
    console: { log: (value) => calls.logs.push(value) },
  };
  vm.runInNewContext(javascript, runtime, { filename: String(filename) });
  return {
    calls,
    request: async (action = 'followup_generate', payload = {}, auth = true) => {
      const response = await handler(new Request('https://mock.invalid/doit-understanding', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer mock' } : {}) },
        body: JSON.stringify({ action, recordId: rid, requestId, ...payload }),
      }));
      return { status: response.status, data: await response.json() };
    },
  };
}

test('provider failure stops after one call, fails the lease and never caches a successful rescue', async () => {
  const failure = { httpStatus: 400, error: { code: 'unsupported_parameter', param: 'max_tokens', message: 'PRIVATE_PROVIDER_MESSAGE', secret: 'PRIVATE_KEY' } };
  const h = harness({ ai: [failure, failure, failure, failure] });
  const r = await h.request('insight_generate');
  assert.equal(r.data.code, 'AI_ERROR');
  assert.equal(h.calls.ai.length, 1);
  assert.equal(h.calls.rpc.at(-1).args.p_error_code, 'AI_ERROR');
  assert.equal(h.calls.rpc.at(-1).args.p_rescue, null);
  assert.equal(r.data.rescued, undefined);
  assert.ok(JSON.stringify(h.calls.logs).includes('provider_http_400'));
  assert.ok(JSON.stringify(h.calls.logs).includes('provider_code_unsupported_parameter'));
  assert.ok(JSON.stringify(h.calls.logs).includes('provider_param_max_tokens'));
  assert.ok(!JSON.stringify(r.data).includes('PRIVATE_'));
  assert.ok(!JSON.stringify(h.calls.logs).includes('PRIVATE_'));
});

for (const stage of ['grounding', 'rejection', 'rescue']) {
  test(`provider failure during ${stage} never becomes an accepted fallback`, async () => {
    const failure = { httpStatus: 404, error: { code: 'model_not_found', message: 'PRIVATE_MESSAGE' } };
    const candidate = { candidates: [{ category: 'value', text: '약속을 지키는 게 중요해요', keys: ['약속'] }] };
    const evidence = stage === 'grounding' ? [{ source_record_id: rid, status: 'corrected', origin: 'ai', text }] :
      stage === 'rejection' ? [{ source_record_id: rid, status: 'rejected', origin: 'ai', text: '혼자 등산을 좋아합니다' }] : [];
    const ai = stage === 'rescue' ? [{ candidates: [] }, { candidates: [] }, { candidates: [] }, failure] : [candidate, failure];
    const previous = context.insights;
    context.insights = evidence;
    const normal = harness({ ai });
    try {
      const r = await normal.request('insight_generate');
      assert.equal(r.data.code, 'AI_ERROR');
      assert.equal(normal.calls.ai.length, ai.length);
      assert.equal(normal.calls.rpc.at(-1).args.p_rescue, null);
      assert.equal(normal.calls.rpc.at(-1).args.p_error_code, 'AI_ERROR');
      assert.ok(!JSON.stringify(normal.calls.logs).includes('PRIVATE_MESSAGE'));
    } finally { context.insights = previous; }
  });
}

test('unauthenticated follow-up never reaches DB or AI', async () => {
  const h = harness(); const r = await h.request('followup_generate', {}, false);
  assert.equal(r.data.code, 'UNAUTHORIZED'); assert.equal(h.calls.rpc.length, 0); assert.equal(h.calls.ai.length, 0);
});
for (const code of ['PENDING_INSIGHTS', 'IN_FLIGHT', 'STALE_CONTEXT', 'REQUEST_CONFLICT']) {
  test(`${code} stops before any AI work`, async () => {
    const h = harness({ claim: { ok: false, code } }); const r = await h.request();
    assert.equal(r.data.code, code); assert.equal(h.calls.ai.length, 0); assert.equal(h.calls.rpc.length, 1);
  });
}
test('missing migration returns explicit unavailable status without AI', async () => {
  const h = harness({ rpcError: 'PGRST202' }); const r = await h.request();
  assert.equal(r.status, 503); assert.equal(r.data.code, 'SERVER_UPDATE_REQUIRED'); assert.equal(h.calls.ai.length, 0);
});
test('accepted replay returns exactly the saved question, never regenerates', async () => {
  const h = harness({ claim: { ok: true, duplicate: true, question: { text: question, sourceRecordId: rid } } });
  const r = await h.request(); assert.equal(r.data.question.text, question); assert.equal(r.data.duplicate, true); assert.equal(h.calls.ai.length, 0);
});
test('question is accepted only after grounded AI quality judgment and DB completion', async () => {
  const h = harness({ ai: [{ question, basis: '약속을 지키는 게 중요해요', meaning: '약속을 중요하게 여김', keys: ['약속'] }, { allowed: true }] });
  const r = await h.request(); assert.equal(r.data.question.text, question); assert.equal(h.calls.ai.length, 2);
  assert.deepEqual(h.calls.rpc.map((c) => c.name), ['doit_begin_followup', 'doit_finish_followup']);
  assert.equal(h.calls.rpc[1].args.p_context_hash, 'context-1');
  assert.equal(h.calls.ai[0].body.model, 'unchanged-mock-model');
});
test('fabricated grounding is rejected without a fixed fallback question', async () => {
  const h = harness({ ai: [{ question: '어릴 때 어떤 상처가 있었나요?', basis: '존재하지 않는 근거' }] });
  const r = await h.request(); assert.equal(r.data.code, 'AI_ERROR'); assert.equal(r.data.question, undefined);
  assert.equal(h.calls.rpc[1].args.p_question, null); assert.equal(h.calls.ai.length, 1);
});
test('unsafe judgment fails closed and keeps question out of response', async () => {
  const h = harness({ ai: [{ question, basis: '약속을 지키는 게 중요해요' }, { allowed: false }] });
  const r = await h.request(); assert.equal(r.data.code, 'AI_ERROR'); assert.equal(r.data.question, undefined);
});
test('a correction during generation invalidates the old candidate question', async () => {
  const h = harness({ ai: [{ question, basis: '약속을 지키는 게 중요해요' }, { allowed: true }], finish: { ok: false, code: 'STALE_CONTEXT' } });
  const r = await h.request(); assert.equal(r.data.code, 'STALE_CONTEXT'); assert.equal(r.data.question, undefined);
});
test('rejection is included in evidence and semantic veto rejects paraphrases', async () => {
  const updated = { ...context, insights: [{ status: 'rejected', text: '친구를 통제하고 싶다', ai_text: '관계를 지배하려는 성향', updated_at: '2026-09-20T00:00:00Z' }] };
  // claim lease is injected dynamically by wrapping the captured RPC default context in a fixture below.
  const h = harness({ ai: [{ question, basis: '약속을 지키는 게 중요해요', keys: ['약속'] }, { allowed: true }, { blocked: [0] }] });
  context.insights = updated.insights;
  try {
    const r = await h.request(); assert.equal(r.data.code, 'AI_ERROR'); assert.equal(r.data.question, undefined);
    assert.equal(h.calls.ai.length, 3); assert.ok(h.calls.ai[0].body.messages[1].content.includes('관계를 지배하려는 성향'));
  } finally { context.insights = []; }
});
test('reload restores only server question and never starts generation', async () => {
  const h = harness({ get: { ok: true, question: { text: question, sourceRecordId: rid } } });
  const r = await h.request('followup_get', { requestId: undefined });
  assert.equal(r.data.question.text, question); assert.equal(h.calls.ai.length, 0); assert.equal(h.calls.rpc[0].name, 'doit_get_followup');
});
test('stale restore is an empty state without invented text', async () => {
  const h = harness(); const r = await h.request('followup_get'); assert.equal(r.data.question, null); assert.equal(h.calls.ai.length, 0);
});
test('missing AI configuration does not reserve a request', async () => {
  const h = harness({ env: { OPENAI_MODEL: '' } }); const r = await h.request();
  assert.equal(r.data.code, 'AI_NOT_CONFIGURED'); assert.equal(h.calls.rpc.length, 0);
});
test('record create preserves original spacing while keeping cleaned working text', async () => {
  const h = harness(); const originalText = '  약속이 중요해요.\n  그렇지만 제 시간도 필요해요.  ';
  const r = await h.request('record_create', { text: originalText, originalText, emotion: '', status: 'confirmed' });
  assert.equal(r.data.record.original_text, originalText);
  assert.equal(r.data.record.text, originalText.trim());
  assert.equal(h.calls.ai.length, 0);
});
test('oversized original text is rejected before any DB write', async () => {
  const h = harness(); const r = await h.request('record_create', { text: '짧은 내용', originalText: '가'.repeat(2001), status: 'confirmed' });
  assert.equal(r.data.code, 'BAD_REQUEST'); assert.equal(h.calls.rpc.length, 0);
});
test('current-record correction survives more than twelve newer AI confirmations elsewhere', async () => {
  const h = harness({ ai: [{ question, basis: '약속을 지키는 게 중요해요' }, { allowed: true }] });
  context.insights = [
    { id: 'own-correction', source_record_id: rid, status: 'corrected', origin: 'ai', text: '매일 연락보다 제 시간을 존중받고 싶어요', updated_at: '2026-09-19T00:00:00Z' },
    ...Array.from({ length: 13 }, (_, i) => ({ id: `other-${i}`, source_record_id: 'other', status: 'confirmed', origin: 'ai', text: `취미에 관한 확인 ${String.fromCharCode(65 + i)}`, updated_at: '2026-09-20T00:00:00Z' })),
  ];
  try {
    await h.request();
    const evidence = JSON.parse(h.calls.ai[0].body.messages[1].content);
    assert.equal(evidence.confirmed[0].text, '매일 연락보다 제 시간을 존중받고 싶어요');
    assert.equal(evidence.confirmed[0].kind, 'corrected');
    assert.ok(h.calls.ai[1].body.messages[1].content.includes('매일 연락보다 제 시간을 존중받고 싶어요'));
  } finally { context.insights = []; }
});
for (const code of ['IN_FLIGHT', 'PENDING_INSIGHTS', 'STALE_CONTEXT']) {
  test(`candidate generation ${code} cannot reach AI or apply RPC`, async () => {
    const h = harness({ claim: { ok: false, code } }); const r = await h.request('insight_generate');
    assert.equal(r.data.code, code); assert.equal(h.calls.ai.length, 0); assert.equal(h.calls.rpc.length, 1);
    assert.equal(h.calls.rpc[0].name, 'doit_begin_insight_generate');
  });
}
test('candidate duplicate returns original rows without another AI call', async () => {
  const h = harness({ claim: { ok: true, duplicate: true, insights: [{ id: 'kept', text: '약속을 중요하게 여겨요', status: 'candidate' }] } });
  const r = await h.request('insight_generate'); assert.equal(r.data.insights[0].id, 'kept'); assert.equal(r.data.duplicate, true); assert.equal(h.calls.ai.length, 0);
});
test('lost rescue response is replayed exactly without a second AI request', async () => {
  const rescue = { kind: 'quoted_question', text: '약속을 지키는 게 중요하다고 느낀 이유를 들려주세요.' };
  const h = harness({ claim: { ok: true, duplicate: true, insights: [], rescued: true, rescue } });
  const r = await h.request('insight_generate'); assert.deepEqual(r.data.rescue, rescue); assert.equal(r.data.rescued, true); assert.equal(h.calls.ai.length, 0);
});
test('candidate generation claims first and passes the exact snapshot to atomic finish', async () => {
  const h = harness({ ai: [{ candidates: [{ category: 'value', text: '약속을 지키는 게 중요해요', meaning: '약속 존중', keys: ['약속'] }] }] });
  const r = await h.request('insight_generate'); assert.equal(r.data.insights[0].status, 'candidate');
  assert.deepEqual(h.calls.rpc.map(c => c.name), ['doit_begin_insight_generate', 'doit_finish_insight_generate']);
  assert.equal(h.calls.rpc[1].args.p_context_hash, 'context-1'); assert.equal(h.calls.rpc[1].args.p_source_text, text);
  assert.equal(h.calls.ai.length, 1);
});
test('candidate generation cannot publish output after context changed', async () => {
  const h = harness({ ai: [{ candidates: [{ category: 'value', text: '약속을 지키는 게 중요해요', keys: ['약속'] }] }], finish: { ok: false, code: 'STALE_CONTEXT' } });
  const r = await h.request('insight_generate'); assert.equal(r.data.code, 'STALE_CONTEXT'); assert.equal(r.data.insights, undefined);
});
test('new rescue response is sent to the atomic finish for durable retry restoration', async () => {
  const h = harness({ ai: [{ candidates: [] }, { candidates: [] }, { candidates: [] }, { question: '약속을 지켰던 이야기를 더 들려주실 수 있을까요?' }] });
  const r = await h.request('insight_generate'); assert.equal(r.data.rescued, true); assert.equal(r.data.insights.length, 0);
  assert.equal(h.calls.rpc[1].args.p_rescue.text, r.data.rescue.text);
});

test('follow-up uses the server canonical purpose and ignores a browser-supplied replacement', async () => {
  context.purpose = { id: 'relationship', label: '연애로 이어질 만남을 원해요' };
  const h = harness({ ai: [{ question, basis: '약속을 지키는 게 중요해요' }, { allowed: true }] });
  try {
    const r = await h.request('followup_generate', { purpose: { id: 'fake', label: '브라우저가 만든 목적' } });
    assert.equal(r.data.question.text, question);
    const evidence = JSON.parse(h.calls.ai[0].body.messages[1].content);
    assert.deepEqual(evidence.purpose, context.purpose);
    assert.ok(!h.calls.ai[0].body.messages[1].content.includes('브라우저가 만든 목적'));
    assert.ok(h.calls.ai[1].body.messages[1].content.includes(context.purpose.label));
  } finally { delete context.purpose; }
});

test('purpose alone is not an acceptable grounding quote for a follow-up question', async () => {
  context.purpose = { id: 'relationship', label: '연애로 이어질 만남을 원해요' };
  const h = harness({ ai: [{ question: '운명의 상대를 기다리시나요?', basis: context.purpose.label }] });
  try {
    const r = await h.request();
    assert.equal(r.data.code, 'AI_ERROR'); assert.equal(r.data.question, undefined);
    assert.equal(h.calls.ai.length, 1); assert.equal(h.calls.rpc[1].args.p_question, null);
  } finally { delete context.purpose; }
});

test('candidate generation sees canonical purpose but purpose is excluded from grounding evidence', async () => {
  context.purpose = { id: 'relationship', label: '연애로 이어질 만남을 원해요' };
  const h = harness({ ai: [
    { candidates: [{ category: 'pattern', text: '운명적인 배우자를 기다립니다', keys: ['배우자'] }] },
    { grounded: [] },
    { candidates: [{ category: 'value', text: '약속을 지키는 게 중요해요', keys: ['약속'] }] },
  ] });
  try {
    const r = await h.request('insight_generate', { purpose: { id: 'fake', label: '브라우저가 만든 목적' } });
    assert.equal(r.data.insights.length, 1);
    assert.equal(r.data.insights[0].text, '약속을 지키는 게 중요해요');
    assert.ok(h.calls.ai[0].body.messages[1].content.includes(context.purpose.label));
    assert.ok(!h.calls.ai[0].body.messages[1].content.includes('브라우저가 만든 목적'));
    const grounds = JSON.parse(h.calls.ai[1].body.messages[1].content).grounds;
    assert.deepEqual(grounds, [text]);
  } finally { delete context.purpose; }
});

test('a word-overlapping candidate that contradicts the user correction must pass semantic grounding', async () => {
  const correction = '약속을 지키는 것보다 일정 변경을 서로 편하게 말하는 게 중요해요';
  context.insights = [{ id: 'correction', source_record_id: rid, status: 'corrected', origin: 'ai', text: correction, updated_at: '2026-09-20T00:00:00Z' }];
  const h = harness({ ai: [
    { candidates: [{ category: 'value', text: '약속을 지키는 게 중요해요', keys: ['약속'] }] },
    { grounded: [] },
    { candidates: [{ category: 'value', text: correction, keys: ['일정 변경'] }] },
    { grounded: [0] },
  ] });
  try {
    const r = await h.request('insight_generate');
    assert.equal(r.data.insights.length, 1); assert.equal(r.data.insights[0].text, correction);
    assert.equal(h.calls.ai.length, 4);
    const judgment = JSON.parse(h.calls.ai[1].body.messages[1].content);
    assert.equal(judgment.candidates[0].text, '약속을 지키는 게 중요해요');
    assert.equal(judgment.confirmed[0].kind, 'corrected');
    assert.equal(judgment.confirmed[0].text, correction);
    assert.equal(h.calls.rpc[1].args.p_trace.dropped_not_grounded, 1);
  } finally { context.insights = []; }
});

test('failed mandatory grounding cannot accept an overlapping candidate when a direct explanation exists', async () => {
  context.insights = [{ id: 'direct', source_record_id: rid, status: 'confirmed', origin: 'self', text: '약속보다 일정 변경을 편하게 말하는 것이 중요해요', updated_at: '2026-09-20T00:00:00Z' }];
  const h = harness({ ai: [
    { candidates: [{ category: 'value', text: '약속을 지키는 게 중요해요', keys: ['약속'] }] },
    { malformed: true },
    { candidates: [] },
    { candidates: [] },
    { question: '편하게 말할 수 있었던 경험을 더 들려주세요.' },
  ] });
  try {
    const r = await h.request('insight_generate');
    assert.equal(r.data.insights.length, 0); assert.equal(r.data.rescued, true);
    assert.equal(h.calls.ai.length, 5);
    assert.equal(h.calls.rpc[1].args.p_candidates.length, 0);
    assert.equal(h.calls.rpc[1].args.p_trace.dropped_not_grounded, 1);
  } finally { context.insights = []; }
});
