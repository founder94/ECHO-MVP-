// Independent-review regressions (copied unchanged in input/expectation); SOURCE_DIR defaults to this checkout. Synthetic memory state only.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const src = process.env.SOURCE_DIR || path.join(__dirname, '..', '..');
const { memoryStore, handle } = require(path.join(src, 'tools/automation/queue-adapter.cjs'));
const { initQueue, drain, verifyDispatch } = require(path.join(src, 'tools/automation/queue-exec.cjs'));
const { run } = require(path.join(src, 'tools/automation/queue-adapter-cli.cjs'));
const A = 'a'.repeat(40), B = 'b'.repeat(40), REPO = 'fixture/repo';
const OWNER = { login: 'founder94', type: 'User' };
const REQUIRED = ['responsible_backup', 'privacy_notice_match', 'blocked_user_exclusion', 'latest_correction_refusal', 'both_sides_choice', 'public_preconditions'];
const descriptor = () => Object.fromEntries(REQUIRED.map(criterion => [criterion, { id: `fixture-${criterion}`, status: 'PASS', sha: A }]));
const experiment = () => ({ id: 'exp1', ref: 'pr:7', owner: OWNER, scope: 'experiment', experimentSha: A, evidence: descriptor() });
const make = () => memoryStore(initQueue({ tasks: [experiment()] }, OWNER).state);
const start = (s, resolveEvidence) => handle(s, 'workflow_dispatch', { repository: { full_name: REPO }, sender: OWNER }, 'fixture-start', { strict: true, securityGate: true, resolveEvidence });
// Runtime-injected fixture attestation, never supplied by task/event/comment. This is NOT actual operating evidence.
const trusted = (id, context) => ({ id, criterion: context.criterion, taskId: context.taskId, ref: context.ref, sha: context.sha, status: 'PASS', completed: true, trusted: true });
const pr = headSha => ({ headSha, branch: 'fixture/experiment', state: 'open', draft: false, base: 'main', headRepo: REPO });
const receiverOpts = resolveEvidence => ({ getPr: () => pr(A), actor: 'github-actions[bot]', triggeringActor: 'github-actions[bot]', claimId: 'fixture-claim', repo: REPO, securityGate: true, resolveEvidence });
const dispatched = () => {
  const s = make(); const { rev, state } = s.load();
  state.tasks[0].state = 'RUNNING'; state.tasks[0].worker = { login: 'github-actions[bot]', type: 'Bot' };
  state.outbox = [{ key: 'START:exp1', action: 'START', taskId: 'exp1', ref: 'pr:7', sha: A, round: 0, status: 'DONE', attempts: 1 }];
  assert.equal(s.save(rev, state), true); return s;
};
const input = { key: 'START:exp1', action: 'START', taskId: 'exp1', ref: 'pr:7', sha: A };

test('owner approval and literal PASS descriptors without runtime proof never START an experiment', () => {
  const s = make(); const r = start(s);
  assert.notEqual(r.action, 'START');
  assert.equal(s.load().state.tasks[0].state, 'BLOCKED');
  assert.equal((s.load().state.outbox || []).length, 0);
});

test('positive control: injected completed trusted exact-SHA proof permits one START and one dispatch', () => {
  const s = make(); assert.equal(start(s, trusted).action, 'START');
  const calls = [];
  drain(s, e => calls.push(e.key), { securityGate: true, resolveEvidence: trusted, getHead: () => A });
  drain(s, e => calls.push(e.key), { securityGate: true, resolveEvidence: trusted, getHead: () => A });
  assert.deepEqual(calls, ['START:exp1']);
});

test('START evidence for SHA A cannot dispatch a PR whose current HEAD is SHA B', () => {
  const s = make(); assert.equal(start(s, trusted).action, 'START');
  const calls = []; let lookups = 0;
  drain(s, e => calls.push(e.key), { securityGate: true, resolveEvidence: trusted, getHead: () => { lookups++; return B; } });
  assert.deepEqual(calls, []);
  assert.ok(lookups > 0, 'actual source SHA must be looked up');
});

test('START source lookup failure cannot dispatch', () => {
  const s = make(); assert.equal(start(s, trusted).action, 'START');
  const calls = [];
  drain(s, e => calls.push(e.key), { securityGate: true, resolveEvidence: trusted, getHead: () => { throw new Error('fixture lookup unavailable'); } });
  assert.deepEqual(calls, []);
});

test('receiver rechecks withdrawn runtime evidence before claiming/model execution', () => {
  const s = dispatched();
  const r = verifyDispatch(s, input, receiverOpts(() => null));
  assert.equal(r.ok, false);
  assert.equal(s.load().state.outbox[0].workerClaim, undefined);
});

test('CLI receiver with security gate ON and no runtime verifier cannot claim from task PASS strings', () => {
  const s = dispatched();
  const env = { GITHUB_REPOSITORY: REPO, QUEUE_SECURITY_GATE: '1', DQ_KEY: input.key, DQ_ACTION: input.action, DQ_TASK_ID: input.taskId, DQ_REF: input.ref, DQ_SHA: A, ACTOR: 'github-actions[bot]', TRIGGERING_ACTOR: 'github-actions[bot]', CLAIM_ID: 'fixture-cli' };
  const r = run(['verify-dispatch'], env, s, undefined, { getPr: () => pr(A) });
  assert.notEqual(r.code, 0);
  assert.equal(s.load().state.outbox[0].workerClaim, undefined);
});

test('positive control: receiver with runtime verified current evidence can claim once only', () => {
  const s = dispatched();
  assert.equal(verifyDispatch(s, input, receiverOpts(trusted)).ok, true);
  assert.equal(verifyDispatch(s, input, { ...receiverOpts(trusted), claimId: 'fixture-second' }).ok, false);
});

test('old unpinned experiment START entry (sha null) fails closed at drain and receiver', () => {
  const s = make(); assert.equal(start(s, trusted).action, 'START');
  const { rev, state } = s.load(); state.outbox[0].sha = null; assert.ok(s.save(rev, state));
  const calls = [];
  drain(s, e => calls.push(e.key), { securityGate: true, resolveEvidence: trusted, getHead: () => A });
  assert.deepEqual(calls, []);
  assert.equal(s.load().state.outbox[0].status, 'GATE_BLOCKED');
});

test('START outbox entry is pinned to experimentSha', () => {
  const s = make(); start(s, trusted);
  assert.equal(s.load().state.outbox[0].sha, A);
});
