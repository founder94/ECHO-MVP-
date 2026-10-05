// 2026-10-05 Codex echo-spec 20261005-company-cost-security(PR #132 댓글 5989026811) 재현 검사 — Codex 가 준 입력·기대값 그대로(가짜 DB·가짜 AI · 실제 AI·운영 0).
// 바꾼 곳은 실행 장치뿐: ECHO_SOURCE_ROOT 기본값 = 이 저장소 · 생성 도우미 파일은 임시 폴더에(qa 폴더에 파일을 남기지 않음).
// Independent company cost/security boundary review. Synthetic only.
// Reuses the exact pinned repository's existing fake DB/AI helpers; no new framework.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const source = process.env.ECHO_SOURCE_ROOT ?? fileURLToPath(new URL('../../', import.meta.url));
assert.ok(source, 'ECHO_SOURCE_ROOT must identify the reviewed source');
const original = readFileSync(path.join(source, 'product/qa/agent-server.test.mjs'), 'utf8');
const prefix = original.slice(0, original.indexOf("test('로그인 안 함"));
assert.ok(prefix.includes('function load(state)') && prefix.includes('const newState'));
const generated = prefix
  .replace("import ts from 'typescript';", `import ts from ${JSON.stringify(pathToFileURL(path.join(source, 'product/node_modules/typescript/lib/typescript.js')).href)};`)
  .replace("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);", `const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(source, 'product/supabase/functions/doit-agent/')).href + '/')});`)
  + '\nexport {load,newState,T,Q,X,rid,ID};\n';
const helperPath = pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'inflight-')), 'pinned-server-helpers.mjs'));
writeFileSync(helperPath, generated);
const { load, newState, T, Q, X, rid, ID } = await import(helperPath.href);

async function setup() {
  const state = newState();
  // Same approved QA token ceiling, with one synthetic provider only.
  state.env = { AI_POLICY: JSON.stringify({ version: 'synthetic-inflight-review', providers: { openai: { model: 'fixture', allow_user_text: true } }, tasks: { default: ['openai'] }, limits: { max_tokens_per_request: 60000 } }) };
  state.rescue = Array.from({ length: 16 }, () => ({ choices: ['잘 웃는 사람', '말을 잘 들어주는 사람'] }));
  const first = load(state), second = load(state);
  state.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const start = await first.call({ action: 'agent_start', requestId: rid(), firstAnswer: '친구' });
  assert.equal(start.status, 200, JSON.stringify(start.body));
  return { state, first, second, sessionId: start.body.session.id };
}

const turn = () => T({ extracted: [X('attraction_comfort', '조용함', '조용한')], ...Q('values_character', '뭘 봐요?') });
async function concurrentRequests({ state, first, second, sessionId }, sameRequest) {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  state.fail = { openai: [{ gate: blocked }, { gate: blocked }] };
  state.ai.push(turn(), turn());
  const before = state.providerCalls.length;
  const requestId = rid();
  const body = { action: 'agent_turn', requestId, sessionId, text: '조용한 사람' };
  const running = [first.call(body), second.call({ ...body, requestId: sameRequest ? requestId : rid() })];
  // Observe admitted provider calls while the first external response is still pending.
  for (let i = 0; i < 40 && state.providerCalls.length < before + 2; i++) await new Promise(resolve => setTimeout(resolve, 5));
  const admitted = state.providerCalls.length - before;
  release();
  const replies = await Promise.all(running);
  return { admitted, replies };
}

test('same in-flight request across two workers must start at most one paid provider call', async () => {
  const result = await concurrentRequests(await setup(), true);
  assert.equal(result.admitted, 1, `provider calls before any response: ${result.admitted}; HTTP results: ${result.replies.map(r => r.status)}`);
});

test('completed request replay returns stored result without another provider call', async () => {
  const { state, first, second, sessionId } = await setup();
  state.ai.push(turn());
  const body = { action: 'agent_turn', requestId: rid(), sessionId, text: '조용한 사람' };
  const firstResult = await first.call(body);
  assert.equal(firstResult.status, 200, JSON.stringify(firstResult.body));
  const before = state.providerCalls.length;
  const replay = await second.call(body);
  assert.equal(replay.status, 200, JSON.stringify(replay.body));
  assert.equal(replay.body.duplicate, true);
  assert.equal(state.providerCalls.length, before);
});

test('one remaining daily model turn must not admit two concurrent requests across workers', async () => {
  const fixture = await setup();
  // Existing agent_start consumes one model-use record; add 198 for a total of 199.
  fixture.state.tables.doit_request_events.push(...Array.from({ length: 198 }, () => ({
    user_id: ID.user, request_id: rid(), action: 'agent_turn', status: 'applied',
    created_at: new Date().toISOString(), response_payload: { record: { ai_usage: { attempts: 1 } } }
  })));
  const result = await concurrentRequests(fixture, false);
  assert.equal(result.admitted, 1, `daily cap boundary admitted ${result.admitted} calls before usage persisted`);
});

// ── 2026-10-05 자리 잡기(claim) 자체 검사 — 같은 가짜 DB·가짜 AI(실제 AI·운영 0)
const rows = (state, pred) => state.tables.doit_request_events.filter(pred);

test('자리: 성공한 턴은 자리 줄이 턴 기록(agent_turn · applied)으로 바뀌고 남는 자리 0', async () => {
  const { state, first, sessionId } = await setup();
  state.ai.push(turn());
  const requestId = rid();
  const r = await first.call({ action: 'agent_turn', requestId, sessionId, text: '조용한 사람' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const mine = rows(state, (x) => x.request_id === requestId);
  assert.equal(mine.length, 1); assert.equal(mine[0].action, 'agent_turn'); assert.equal(mine[0].status, 'applied'); assert.ok(mine[0].response_payload.turn);
  assert.equal(rows(state, (x) => x.action === 'agent_turn_claim' && x.status === 'pending').length, 0, '처리 중으로 남은 자리 0');
  assert.equal(rows(state, (x) => x.action === 'agent_turn_claim' && x.request_id === requestId).length, 0, '턴 자리는 턴 기록으로 바뀜');
});

test('자리: AI 실패(502) 뒤 같은 요청 다시 보내기 = 다시 잡아 정상 처리 · 놓은 자리는 하루 한도에 두 번 세지 않음', async () => {
  const { state, first, sessionId } = await setup();
  state.fail = { openai: ['HTTP500', 'HTTP500', 'HTTP500', 'HTTP500'] };
  const body = { action: 'agent_turn', requestId: rid(), sessionId, text: '조용한 사람' };
  const r1 = await first.call(body);
  assert.equal(r1.status, 502, JSON.stringify(r1.body));
  const claim = rows(state, (x) => x.request_id === body.requestId)[0];
  assert.equal(claim.action, 'agent_turn_claim'); assert.equal(claim.status, 'failed'); assert.notEqual(claim.error_code, 'TURN_UNCERTAIN');
  state.fail = {}; state.ai.push(turn());
  const r2 = await first.call(body);
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal(rows(state, (x) => x.request_id === body.requestId)[0].action, 'agent_turn');
});

test('자리: 결과를 모르는 자리(처리 중 · 임대 시간 전)는 같은 요청이 와도 AI 를 다시 부르지 않음(409) · 하루 한도에 셈', async () => {
  const { state, first, sessionId } = await setup();
  const requestId = rid();
  const now = new Date().toISOString();
  state.tables.doit_request_events.push({ user_id: ID.user, request_id: requestId, action: 'agent_turn_claim', target_id: sessionId, status: 'failed', error_code: 'TURN_UNCERTAIN', created_at: now, updated_at: now,
    payload_hash: await (async () => { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sessionId}:조용한 사람`)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); })() });
  const before = state.providerCalls.length;
  state.ai.push(turn());
  const r = await first.call({ action: 'agent_turn', requestId, sessionId, text: '조용한 사람' });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal(state.providerCalls.length, before, '불확실한 자리 = 바로 다시 부르기 0');
});

test('자리: 같은 요청 id 에 다른 말·다른 대화는 다시 잡지 않음(409)', async () => {
  const { state, first, sessionId } = await setup();
  state.fail = { openai: ['HTTP500', 'HTTP500', 'HTTP500', 'HTTP500'] };
  const requestId = rid();
  assert.equal((await first.call({ action: 'agent_turn', requestId, sessionId, text: '조용한 사람' })).status, 502);
  state.fail = {}; state.ai.push(turn());
  const before = state.providerCalls.length;
  const other = await first.call({ action: 'agent_turn', requestId, sessionId, text: '다른 말' });
  assert.equal(other.status, 409, JSON.stringify(other.body));
  assert.equal(state.providerCalls.length, before);
});

test('Codex P2(4181336996): 모델이 필요 없는 처리 중 자리는 하루 한도에 세지 않음(199 + 그 자리 1 → 모델 요청 허용)', async () => {
  const fixture = await setup();
  fixture.state.tables.doit_request_events.push(...Array.from({ length: 198 }, () => ({ user_id: ID.user, request_id: rid(), action: 'agent_turn', status: 'applied', created_at: new Date().toISOString(), response_payload: { record: { ai_usage: { attempts: 1 } } } })));
  const now = new Date().toISOString();
  fixture.state.tables.doit_request_events.push({ user_id: ID.user, request_id: rid(), action: 'agent_turn_claim', target_id: fixture.sessionId, status: 'pending', error_code: null, created_at: now, updated_at: now, payload_hash: 'x' });
  fixture.state.ai.push(turn());
  const before = fixture.state.providerCalls.length;
  const r = await fixture.first.call({ action: 'agent_turn', requestId: rid(), sessionId: fixture.sessionId, text: '조용한 사람' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(fixture.state.providerCalls.length > before, '모델 호출 허용');
});

test('Codex P1(4181336991): 다른 요청이 잠금을 쥐고 있으면(임대 안) 자리를 잡지 않고 503 · 업체 호출 0', async () => {
  const fixture = await setup();
  const lock = fixture.state.tables.doit_request_events.find((x) => x.action === 'agent_admission');
  assert.ok(lock, '시작에서 잠금 줄이 만들어짐');
  lock.response_payload = { until: Date.now() + 60_000 }; // 다른 일꾼이 쥔 채(임대 60초)
  fixture.state.ai.push(turn());
  const before = fixture.state.providerCalls.length;
  const r = await fixture.first.call({ action: 'agent_turn', requestId: rid(), sessionId: fixture.sessionId, text: '조용한 사람' });
  assert.equal(r.status, 503, JSON.stringify(r.body));
  assert.equal(fixture.state.providerCalls.length, before);
  assert.equal(fixture.state.tables.doit_request_events.filter((x) => x.action === 'agent_turn_claim' && x.status === 'pending').length, 0, '자리 0');
});
