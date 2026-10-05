// 2026-10-05 Codex echo-review(PR #132 댓글 5990414265) 재현 — 입력·기대값 그대로(가짜 DB 쓰기 지연 · 가짜 시계 · 가짜 AI). 바꾼 곳은 실행 장치뿐(소스 경로 기본값 · 임시 폴더).
// New fault boundary: pending paid-claim INSERT delayed beyond admission lease.
// Pinned product source unchanged; reuse its fake DB and provider helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const source = process.env.ECHO_SOURCE_ROOT ?? fileURLToPath(new URL('../../', import.meta.url));
assert.ok(source, 'ECHO_SOURCE_ROOT must pin an exact reviewed source snapshot');
const original = readFileSync(path.join(source, 'product/qa/agent-server.test.mjs'), 'utf8');
let helper = original.slice(0, original.indexOf("test('로그인 안 함"));
function replaceOnce(from, to) {
  assert.equal(helper.split(from).length, 2, `Exactly one existing helper seam: ${from}`);
  helper = helper.replace(from, to);
}
replaceOnce("import ts from 'typescript';", `import ts from ${JSON.stringify(pathToFileURL(path.join(source, 'product/node_modules/typescript/lib/typescript.js')).href)};`);
replaceOnce("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);", `const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(source, 'product/supabase/functions/doit-agent/')).href + '/')});`);
replaceOnce('insert: (row) => {', `insert: async (row) => {
        if (name === 'doit_request_events' && row.action === 'agent_turn_claim' && row.error_code === 'PAID' && state.delayPaidInsert) {
          const delayed = state.delayPaidInsert;
          state.delayPaidInsert = null; // only worker A's INSERT is delayed
          delayed.entered();
          await delayed.gate; // writes have not committed, so other workers cannot count this reservation
        }`);
replaceOnce('function load(state) {', `function load(state) {
  // Advance only this synthetic worker clock, without changing product code or lock revisions.
  class ClockDate extends Date {
    constructor(...args) { args.length ? super(...args) : super(Date.now() + (state.clockOffsetMs ?? 0)); }
    static now() { return Date.now() + (state.clockOffsetMs ?? 0); }
  }`);
replaceOnce('const g = { console, setTimeout, clearTimeout, AbortController, JSON, Date,', 'const g = { console, setTimeout, clearTimeout, AbortController, JSON, Date: ClockDate,');
replaceOnce('setTimeout, clearTimeout, structuredClone, Date, JSON,', 'setTimeout, clearTimeout, structuredClone, Date: ClockDate, JSON,');
helper += '\nexport {load,newState,T,Q,X,rid,ID};\n';
const helperFile = pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'lease-write-')), 'pinned-admission-lease-write-helpers.mjs'));
writeFileSync(helperFile, helper);
const {load,newState,T,Q,X,rid,ID} = await import(helperFile.href);
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise,resolve}; };
async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 5)); }
  assert.ok(predicate(), 'Synthetic schedule reached provider boundary');
}
test('expired admission owner cannot authorize a late claim INSERT after another worker used the last daily slot', async () => {
  const state = newState();
  state.env = {AI_POLICY: JSON.stringify({version: 'synthetic-lease-write-review', providers: {openai: {model: 'fixture', allow_user_text: true}}, tasks: {default: ['openai']}, limits: {max_tokens_per_request: 60000}})};
  const first = load(state), second = load(state);
  state.ai.push(T({extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?')}));
  const start = await first.call({action: 'agent_start', requestId: rid(), firstAnswer: '친구. 편하게 만나고 싶어요'});
  assert.equal(start.status, 200);
  const rows = state.tables.doit_request_events;
  const counted = rows.filter(r => r.action === 'agent_usage' || (r.action === 'agent_turn' && (r.response_payload?.record?.ai_usage?.attempts ?? 0) > 0)).length;
  assert.ok(counted > 0 && counted < 199);
  rows.push(...Array.from({length: 199 - counted}, () => ({user_id: ID.user, request_id: rid(), action: 'agent_turn', status: 'applied', created_at: new Date().toISOString(), response_payload: {record: {ai_usage: {attempts: 1}}}})));
  state.rescue = [{choices: ['잘 웃는 사람', '말을 잘 들어주는 사람']}, {choices: ['잘 웃는 사람', '말을 잘 들어주는 사람']}];
  const entered = defer(), writeGate = defer(), providerGate = defer();
  state.delayPaidInsert = {entered: entered.resolve, gate: writeGate.promise};
  state.fail = {openai: [{gate: providerGate.promise}, {gate: providerGate.promise}]};
  const before = state.providerCalls.length;
  const a = first.call({action: 'agent_rescue', requestId: rid(), sessionId: start.body.session.id});
  const replies = [a];
  let calls;
  try {
    await entered.promise;
    // Product lease is 5000 ms. Advance 6000 ms; original lock row/revision remain untouched.
    state.clockOffsetMs = 6000;
    replies.push(second.call({action: 'agent_rescue', requestId: rid(), sessionId: start.body.session.id}));
    await waitFor(() => state.providerCalls.length >= before + 1);
    writeGate.resolve();
    for (let i = 0; i < 60 && state.providerCalls.length < before + 2; i++) await new Promise(r => setTimeout(r, 5));
    calls = state.providerCalls.length - before;
  } finally { writeGate.resolve(); providerGate.resolve(); }
  const result = await Promise.all(replies);
  const observed = {calls, statuses: result.map(r => r.status), syntheticElapsedMs: state.clockOffsetMs};
  console.log('synthetic lease/write boundary', JSON.stringify(observed));
  assert.equal(calls, 1, `Last daily slot must authorize only one provider call: ${JSON.stringify(observed)}`);
});

