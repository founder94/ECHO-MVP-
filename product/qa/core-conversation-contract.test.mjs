import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto, randomUUID } from 'node:crypto';
import ts from 'typescript';

// Real application source with in-memory ports. Every external request is mocked.
// These checks prove client contracts, not real AI quality or production authorization.
function sourceModule(path, dependencies = {}, extra = {}) {
  const exports = {};
  const input = readFileSync(path, 'utf8').replaceAll("import.meta.env.VITE_A_STRUCTURE_SERVER_ENABLED", "'true'");
  const compiled = ts.transpileModule(input, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(compiled, {
    exports, require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    }, Error, Promise, Date, TextEncoder, Response,
    crypto: { subtle: webcrypto.subtle, randomUUID }, ...extra,
  }, { filename: path });
  return exports;
}
const { createCoreConversation } = sourceModule('src/doit/lib/coreConversation.ts');
const record = { id: 'record-1', text: '약속을 지키는 사람이 좋아요.', original_text: '약속을 지키는 사람이 좋아요.', status: 'confirmed', revision: 1, created_at: '2026-09-21T00:00:00Z' };
const candidate = { id: 'insight-1', source_record_id: record.id, text: '잦은 연락을 원해요.', ai_text: '잦은 연락을 원해요.', category: 'value', status: 'candidate', origin: 'ai', revision: 3, created_at: record.created_at };
const copy = value => JSON.parse(JSON.stringify(value));
function harness(responder = () => ({})) {
  const calls = [];
  const request = async (method, body) => {
    calls.push({ method, body: copy(body) });
    return responder(method, body);
  };
  const api = createCoreConversation({ read: body => request('read', body), write: body => request('write', body) });
  return { api, calls };
}

test('original user text is sent intact while analysis text may trim outer whitespace', async () => {
  const original = '\n  약속을 지키는 게 중요해요.\n매일 연락할 필요는 없어요.  \n';
  const { api, calls } = harness((_method, body) => ({ record: { ...record, text: body.text, original_text: body.originalText } }));
  const saved = await api.record(original);
  assert.equal(calls[0].body.originalText, original);
  assert.equal(saved.original_text, original);
  assert.equal(calls[0].body.text, original.trim());
  assert.equal(calls[0].body.emotion, '');
  assert.equal(calls[0].body.status, 'confirmed');
});

test('empty and oversized original records produce no writes', async () => {
  const { api, calls } = harness();
  for (const text of ['', '  \n ', '가'.repeat(2001), ' ' + '가'.repeat(2000)]) await assert.rejects(api.record(text), /INVALID_INPUT/);
  assert.equal(calls.length, 0);
});

test('2000 character record is accepted and returned only from server response', async () => {
  const text = '가'.repeat(2000);
  const server = { ...record, text, original_text: text };
  const { api, calls } = harness(() => ({ record: server }));
  assert.equal(await api.record(text), server);
  assert.equal(calls.length, 1);
});

test('record without server id is a failure', async () => {
  const { api } = harness(() => ({ record: {} }));
  await assert.rejects(api.record('내 이야기'), /INVALID_RESPONSE/);
});

test('load uses read operations and preserves candidate/corrected/rejected states', async () => {
  const rejected = { ...candidate, id: 'rejected', status: 'rejected' };
  const corrected = { ...candidate, id: 'corrected', status: 'corrected', text: '약속을 지키는 게 중요해요.' };
  const { api, calls } = harness((_method, body) => body.action === 'record_list' ? { records: [record] } : { insights: [candidate, corrected, rejected] });
  const loaded = await api.load();
  assert.equal(loaded.records[0].original_text, record.original_text);
  assert.equal(loaded.insights[0].status, 'candidate');
  assert.equal(loaded.insights[1].status, 'corrected');
  assert.equal(loaded.insights[2].status, 'rejected');
  assert.ok(calls.every(call => call.method === 'read' && !Object.hasOwn(call.body, 'requestId')));
});

test('load never replaces unavailable server data with empty fake success', async () => {
  const { api } = harness((_method, body) => body.action === 'record_list' ? { records: [record] } : { insights: null });
  await assert.rejects(api.load(), /INVALID_RESPONSE/);
});

test('four choices map to expected server actions and latest revision', async () => {
  const { api, calls } = harness((_method, body) => ({ insight: { ...candidate, id: body.id ?? 'self', revision: (body.expectedRevision ?? 0) + 1, text: body.text ?? candidate.text, origin: body.action === 'insight_self' ? 'self' : 'ai', status: body.action === 'insight_self' ? 'confirmed' : 'candidate', category: body.category ?? candidate.category } }));
  const confirmed = await api.react(candidate, 'confirm');
  const corrected = await api.react(confirmed, 'correct', '연락 횟수보다 약속을 지키는 게 중요해요.');
  await api.react(corrected, 'reject');
  await api.explain(record.id, 'value', '내가 직접 정한 기준이에요.');
  assert.deepEqual(calls.map(call => call.body.action), ['insight_confirm', 'insight_correct', 'insight_reject', 'insight_self']);
  assert.deepEqual(calls.slice(0, 3).map(call => call.body.expectedRevision), [3, 4, 5]);
  assert.equal(calls[3].body.recordId, record.id);
  assert.equal(calls[3].body.category, 'value');
  assert.ok(calls.every(call => !Object.hasOwn(call.body, 'originalText') && !Object.hasOwn(call.body, 'user_id')));
});

test('correction never rewrites input insight or original record', async () => {
  const originalCandidate = copy(candidate);
  const originalRecord = copy(record);
  const { api } = harness(() => ({ insight: { ...candidate, text: '내가 직접 고친 설명', status: 'corrected', revision: 4 } }));
  const changed = await api.react(candidate, 'correct', '내가 직접 고친 설명');
  assert.equal(changed.text, '내가 직접 고친 설명');
  assert.deepEqual(candidate, originalCandidate);
  assert.deepEqual(record, originalRecord);
});

test('correction and direct explanation reject empty or >200 before request', async () => {
  const { api, calls } = harness();
  for (const text of ['', '   ', '가'.repeat(201)]) {
    await assert.rejects(api.react(candidate, 'correct', text), /INVALID_INPUT/);
    await assert.rejects(api.explain(record.id, 'memory', text), /INVALID_INPUT/);
  }
  assert.equal(calls.length, 0);
});

test('correction and direct explanation accept 200 characters without shortening', async () => {
  const text = '가'.repeat(200);
  const { api, calls } = harness((_method, body) => ({ insight: { ...candidate, text: body.text, origin: body.action === 'insight_self' ? 'self' : 'ai', category: body.category ?? candidate.category } }));
  assert.equal((await api.react(candidate, 'correct', text)).text.length, 200);
  assert.equal((await api.explain(record.id, 'memory', text)).text.length, 200);
  assert.equal(calls[0].body.text, text);
  assert.equal(calls[1].body.text, text);
});

test('generation returns server candidates/rescue without inventing fallback', async () => {
  const returned = { insights: [], rescue: { text: '약속을 지킨다는 건 어떤 행동일까요?', kind: 'ai_question' } };
  const { api, calls } = harness(() => returned);
  assert.equal(await api.generate(record.id), returned);
  assert.equal(calls[0].body.recordId, record.id);
  assert.equal(calls[0].body.action, 'insight_generate');
});

test('malformed generation response is rejected before UI consumes it', async () => {
  for (const response of [{}, { insights: null }, { insights: [{ ...candidate, source_record_id: 'different-record' }] }]) {
    const { api } = harness(() => response);
    await assert.rejects(api.generate(record.id), /INVALID_RESPONSE/);
  }
});

test('next question displays exactly server text tied to the requested record', async () => {
  const question = { text: '약속이 지켜졌다고 느꼈던 일을 이야기해 주실래요?', sourceRecordId: record.id };
  // v16: 「다음 질문 받기」도 한 턴(turn)으로 보낸다. 서버 질문 객체를 그대로 쓴다.
  const { api, calls } = harness(() => ({ kind: 'answer', saved: false, question }));
  assert.equal(await api.nextQuestion(record.id), question);
  assert.equal(calls[0].body.action, 'turn');
  assert.equal(calls[0].body.recordId, record.id);
  assert.equal('text' in calls[0].body, false, '새 말 없이 기록만 보낸다');
});

test('missing/foreign/empty/nontext questions cannot become displayed questions', async () => {
  const ok = { kind: 'answer', saved: false };
  const responses = [{}, { ...ok }, { ...ok, question: { text: '다른 질문', sourceRecordId: 'other' } }, { ...ok, question: { text: '   ', sourceRecordId: record.id } }, { ...ok, question: { text: { unexpected: true }, sourceRecordId: record.id } }];
  for (const response of responses) {
    const { api } = harness(() => response);
    await assert.rejects(api.nextQuestion(record.id), /INVALID_RESPONSE/);
  }
});

test('question generation failure is propagated with no local fallback', async () => {
  const failure = new Error('AI_ERROR');
  const { api } = harness(() => { throw failure; });
  await assert.rejects(api.nextQuestion(record.id), error => error === failure);
});

test('saved question is read-only and cannot cross record context', async () => {
  const { api, calls } = harness(() => ({ question: { text: '다른 기록의 질문', sourceRecordId: 'other' } }));
  await assert.rejects(api.savedQuestion(record.id), /INVALID_RESPONSE/);
  assert.equal(calls[0].method, 'read');
  assert.equal(calls[0].body.action, 'followup_get');
});

test('saved record survives generation failure; retry needs no duplicate record write', async () => {
  let generations = 0;
  const { api, calls } = harness((_method, body) => {
    if (body.action === 'record_create') return { record };
    if (body.action === 'record_list') return { records: [record] };
    if (body.action === 'insight_list') return { insights: [] };
    if (body.action === 'insight_generate') {
      if (++generations === 1) throw new Error('AI_ERROR');
      return { insights: [candidate] };
    }
    throw new Error('Unexpected action');
  });
  const saved = await api.record(record.text);
  await assert.rejects(api.generate(saved.id), /AI_ERROR/);
  const restored = await api.load();
  assert.equal(restored.records[0].original_text, record.original_text);
  await api.generate(restored.records[0].id);
  assert.equal(calls.filter(call => call.body.action === 'record_create').length, 1);
});

test('direct explanation failure does not claim rejection was undone or explanation saved', async () => {
  let rejected = false;
  const { api } = harness((_method, body) => {
    if (body.action === 'insight_reject') { rejected = true; return { insight: { ...candidate, status: 'rejected', revision: 4 } }; }
    if (body.action === 'insight_self') throw new Error('NETWORK_ERROR');
    if (body.action === 'record_list') return { records: [record] };
    if (body.action === 'insight_list') return { insights: [{ ...candidate, status: rejected ? 'rejected' : 'candidate', revision: rejected ? 4 : 3 }] };
    throw new Error('Unexpected action');
  });
  await api.react(candidate, 'reject');
  await assert.rejects(api.explain(record.id, 'value', '나의 말'), /NETWORK_ERROR/);
  const loaded = await api.load();
  assert.equal(loaded.insights[0].status, 'rejected');
  assert.equal(loaded.insights.some(insight => insight.origin === 'self'), false);
  assert.equal(loaded.records[0].original_text, record.original_text);
});

function transportHarness(sessions, invoke) {
  let sessionIndex = 0;
  const calls = [];
  const memory = new Map();
  const sessionFor = id => id ? { user: { id }, access_token: 'mock-token' } : null;
  const supabase = {
    auth: { async getSession() { return { data: { session: sessionFor(sessions[Math.min(sessionIndex++, sessions.length - 1)]) }, error: null }; } },
    functions: { async invoke(name, options) { calls.push({ name, ...options }); return invoke ? invoke(name, options) : { data: { ok: true, insights: [] }, error: null }; } },
  };
  const api = sourceModule('src/doit/lib/understandingApi.ts', { '@/lib/supabase/client': { supabase } }, {
    localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) },
  });
  return { api, calls, memory };
}

test('transport rejects absent or different account before any function call', async () => {
  for (const current of [null, 'other']) {
    const { api, calls } = transportHarness([current]);
    await assert.rejects(api.understandingRequest({ action: 'record_list' }, 'owner'), error => error.code === 'UNAUTHORIZED');
    assert.equal(calls.length, 0);
  }
});

test('late response from previous account is not exposed after account switch', async () => {
  const { api, calls } = transportHarness(['owner', 'other']);
  await assert.rejects(api.understandingRequest({ action: 'record_list' }, 'owner'), error => error.code === 'UNAUTHORIZED');
  assert.equal(calls.length, 1);
});

test('retry ids are stable per account/body and contain no original user text', async () => {
  const { api, memory } = transportHarness(['owner']);
  const body = { action: 'insight_correct', id: 'i1', expectedRevision: 4, text: '개인적인 설명 원문' };
  const first = await api.prepareUnderstandingRequest('owner', body);
  const same = await api.prepareUnderstandingRequest('owner', body);
  const other = await api.prepareUnderstandingRequest('other', body);
  assert.equal(first.body.requestId, same.body.requestId);
  assert.notEqual(first.body.requestId, other.body.requestId);
  assert.ok([...memory.keys()].every(key => !key.includes(body.text)));
  assert.ok([...memory.values()].every(value => !value.includes(body.text)));
  first.complete();
  assert.equal(memory.size, 1);
  assert.ok([...memory.keys()][0].startsWith('doit:request:other:'));
});


test('revision conflict is propagated; client cannot synthesize a successful revision', async () => {
  const conflict = Object.assign(new Error('다른 화면에서 변경'), { code: 'STALE_REVISION' });
  const { api, calls } = harness(() => { throw conflict; });
  await assert.rejects(api.react(candidate, 'correct', '내가 고친 말'), error => error === conflict);
  assert.equal(calls[0].body.expectedRevision, candidate.revision);
  assert.equal(candidate.revision, 3);
});

test('only explicit server null represents no saved followup question', async () => {
  const { api } = harness(() => ({ question: null }));
  assert.equal(await api.savedQuestion(record.id), null);
  for (const response of [{}, { question: { text: '   ', sourceRecordId: record.id } }]) {
    const invalid = harness(() => response);
    await assert.rejects(invalid.api.savedQuestion(record.id), /INVALID_RESPONSE/);
  }
});
