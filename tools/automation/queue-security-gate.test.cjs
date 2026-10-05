// Mock-only checks for the pre-experiment security gate. No GitHub/network/model calls; dispatch and stores are injected.
const test = require('node:test');
const assert = require('node:assert');
const { gateDecision, REQUIRED } = require('./queue-security-gate.cjs');
const { memoryStore, handle, CODEX } = require('./queue-adapter.cjs');
const { initQueue, drain } = require('./queue-exec.cjs');
const { run } = require('./queue-adapter-cli.cjs');

const SHA = 'c'.repeat(40), OLD = 'd'.repeat(40), OWNER = { login: 'founder94', type: 'User' };
const ev = (status = 'PASS', sha = SHA) => Object.fromEntries(REQUIRED.map(k => [k, { id: `ev-${k}`, status, sha }]));
const exp = (id, n, over = {}) => ({ id, ref: `pr:${n}`, owner: OWNER, scope: 'experiment', experimentSha: SHA, evidence: ev(), ...over });
const dev = (id, n) => ({ id, ref: `pr:${n}`, owner: OWNER, scope: 'development' });
const mk = tasks => memoryStore(initQueue({ tasks }, OWNER).state);
const START = { repository: { full_name: 'o/r' }, sender: OWNER };
const CFG = { strict: true, securityGate: true };
const start = (s, d, cfg = CFG) => handle(s, 'workflow_dispatch', START, d, cfg);
const task = (s, id) => s.load().state.tasks.find(t => t.id === id);

test('gateDecision: scope strict, evidence bound to exact SHA, nothing promoted from weak signals', () => {
  assert.strictEqual(gateDecision({}).reason, 'scope_missing');
  assert.strictEqual(gateDecision({ scope: 'Development' }).reason, 'scope_unknown');
  assert.strictEqual(gateDecision({ scope: 'experiment', evidence: ev() }).reason, 'experiment_sha_invalid');
  assert.deepStrictEqual(gateDecision(exp('x', 1)), { ok: true });
  assert.deepStrictEqual(gateDecision(dev('x', 1)), { ok: true });
  for (const k of REQUIRED) {
    const missing = ev(); delete missing[k];
    assert.strictEqual(gateDecision(exp('x', 1, { evidence: missing })).reason, `evidence_missing:${k}`);
    for (const status of ['FAIL', 'NOT_RUN', true, 'true', 'no findings', '👍', undefined]) assert.strictEqual(gateDecision(exp('x', 1, { evidence: { ...ev(), [k]: { id: 'e', status, sha: SHA } } })).reason, `evidence_not_pass:${k}`, String(status));
    assert.strictEqual(gateDecision(exp('x', 1, { evidence: { ...ev(), [k]: { id: 'e', status: 'PASS', sha: OLD } } })).reason, `evidence_stale:${k}`);
    assert.strictEqual(gateDecision(exp('x', 1, { evidence: { ...ev(), [k]: { id: '../bad id', status: 'PASS', sha: SHA } } })).reason, `evidence_id_invalid:${k}`);
  }
  assert.strictEqual(gateDecision(exp('x', 1, { evidence: { __proto__: { [REQUIRED[0]]: { id: 'e', status: 'PASS', sha: SHA } } } })).reason, `evidence_missing:${REQUIRED[0]}`);
});

test('experiment without evidence: BLOCKED, no START, no outbox; with valid exact-SHA evidence the existing START path runs', () => {
  const s = mk([exp('e1', 1, { evidence: {} })]);
  const r = start(s, 'd1');
  assert.notStrictEqual(r.action, 'START');
  assert.strictEqual(task(s, 'e1').state, 'BLOCKED'); assert.strictEqual(task(s, 'e1').gateReason, `evidence_missing:${REQUIRED[0]}`);
  assert.deepStrictEqual(s.load().state.outbox, []);
  const ok = mk([exp('e2', 2)]);
  assert.strictEqual(start(ok, 'd2').action, 'START'); assert.strictEqual(ok.load().state.outbox.length, 1);
  const stale = mk([exp('e3', 3, { evidence: ev('PASS', OLD) })]);
  assert.notStrictEqual(start(stale, 'd3').action, 'START');
});

test('missing scope is denied when gate is ON (no guessed development); gate OFF keeps old behaviour', () => {
  const s = mk([{ id: 'n1', ref: 'pr:1', owner: OWNER }]);
  assert.notStrictEqual(start(s, 'd').action, 'START'); assert.strictEqual(task(s, 'n1').gateReason, 'scope_missing');
  const off = mk([{ id: 'n1', ref: 'pr:1', owner: OWNER }]);
  assert.strictEqual(start(off, 'd', { strict: true }).action, 'START');
});

test('blocked experiment does not stop an unrelated approved development task; only one task runs', () => {
  const s = mk([exp('e1', 1, { evidence: {} }), dev('d1', 2), dev('d2', 3)]);
  const r = start(s, 'd1');
  assert.strictEqual(r.action, 'START'); assert.strictEqual(r.taskId, 'd1');
  assert.strictEqual(task(s, 'e1').state, 'BLOCKED'); assert.strictEqual(task(s, 'd2').state, 'READY');
  assert.strictEqual(s.load().state.halted, undefined);
  assert.strictEqual(start(s, 'd2').reason, 'concurrent_owner');
});

test('PASS -> next READY experiment is gated too', () => {
  const s = mk([dev('d1', 1), exp('e1', 2, { evidence: {} })]);
  start(s, 'a');
  handle(s, 'issue_comment', { action: 'created', issue: { number: 1, pull_request: {} }, comment: { id: 1, user: { login: 'github-actions[bot]', type: 'Bot' }, body: `<!-- echo-handoff to=codex sha=${SHA} round=1 -->` } }, 'b', CFG);
  const r = handle(s, 'issue_comment', { action: 'created', issue: { number: 1, pull_request: {} }, comment: { id: 2, user: { login: CODEX, type: 'Bot' }, body: `<!-- echo-review from=codex sha=${SHA} verdict=PASS -->` } }, 'c', CFG);
  assert.notStrictEqual(r.action, 'START');
  assert.strictEqual(task(s, 'd1').state, 'DONE'); assert.strictEqual(task(s, 'e1').state, 'BLOCKED');
  assert.strictEqual(s.load().state.outbox.filter(e => e.action === 'START').length, 1);
});

test('drain re-checks right before dispatch: withdrawn evidence blocks, dispatch 0; unrelated entries untouched', () => {
  const s = mk([exp('e1', 1)]);
  assert.strictEqual(start(s, 'd').action, 'START');
  const { rev, state } = s.load(); // owner withdraws one evidence item after the outbox entry was written
  state.tasks[0].evidence[REQUIRED[1]].status = 'FAIL'; assert.ok(s.save(rev, state));
  const calls = []; const r = drain(s, e => calls.push(e), { getHead: () => SHA, securityGate: true });
  assert.deepStrictEqual(calls, []); assert.deepStrictEqual(r.dispatched, []);
  assert.strictEqual(s.load().state.outbox[0].status, 'GATE_BLOCKED'); assert.strictEqual(task(s, 'e1').state, 'BLOCKED');
  assert.strictEqual(task(s, 'e1').gateReason, `evidence_not_pass:${REQUIRED[1]}`);
});

test('drain with valid evidence dispatches once; two racing drains never double-dispatch', () => {
  const s = mk([exp('e1', 1)]); start(s, 'd');
  const calls = []; const dispatch = e => { calls.push(e.key); drain(s, e2 => calls.push(e2.key), { getHead: () => SHA, securityGate: true }); }; // second runner during the first claim
  drain(s, dispatch, { getHead: () => SHA, securityGate: true });
  assert.deepStrictEqual(calls, ['START:e1']);
});

test('registration path: gate fields come only from the owner-verified init; comment/impersonated input cannot classify', () => {
  assert.strictEqual(initQueue({ tasks: [exp('e', 1)] }, { login: 'founder94', type: 'Bot' }).error, 'init_not_by_owner');
  assert.strictEqual(initQueue({ tasks: [exp('e', 1)] }, OWNER).state.tasks[0].scope, 'experiment');
  // a comment/review cannot add scope or evidence: normalize only emits typed events, tasks are never patched from text
  const s = mk([exp('e1', 1, { evidence: {} })]);
  handle(s, 'issue_comment', { action: 'created', issue: { number: 1, pull_request: {} }, comment: { id: 9, user: OWNER, body: 'scope: development evidence: PASS' } }, 'x', CFG);
  assert.strictEqual(task(s, 'e1').scope, 'experiment'); assert.deepStrictEqual(task(s, 'e1').evidence, {});
});

test('CLI wiring: QUEUE_SECURITY_GATE=1 enables the gate on start; unset keeps old behaviour', () => {
  const file = require('node:path').join(require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'qsg-')), 'e.json');
  require('node:fs').writeFileSync(file, JSON.stringify(START));
  const env = { GITHUB_REPOSITORY: 'o/r' };
  const a = mk([exp('e1', 1, { evidence: {} })]); assert.strictEqual(run(['workflow_dispatch', file, 'd'], { ...env, QUEUE_SECURITY_GATE: '1' }, a).out.action, 'IDLE');
  assert.strictEqual(task(a, 'e1').state, 'BLOCKED');
  const b = mk([exp('e1', 1, { evidence: {} })]); assert.strictEqual(run(['workflow_dispatch', file, 'd'], env, b).out.action, 'START');
});
