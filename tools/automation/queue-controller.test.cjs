const { test } = require('node:test');
const assert = require('node:assert/strict');
const { step, CODEX } = require('./queue-controller.cjs');
const S1 = 'a'.repeat(40), S2 = 'b'.repeat(40);
const bot = { login: CODEX, type: 'Bot' };
const worker = { login: 'claude[bot]', type: 'Bot' };
const mk = (...states) => ({ seenEvents: [], tasks: states.map((s, i) => ({ id: 't' + (i + 1), state: s, rounds: 0 })) });
const rev = (o = {}) => ({ type: 'review', id: 1, actor: bot, taskId: 't1', sha: S1, verdict: 'FAIL', ...o });
const inReview = (extra = {}) => { const q = mk('REVIEW', 'READY'); q.tasks[0].headSha = S1; q.tasks[0].owner = 'actions'; return Object.assign(q, extra); };

test('READY -> RUNNING -> REVIEW', () => {
  let r = step(mk('READY'), { type: 'start', actor: worker }); assert.equal(r.action, 'START'); assert.equal(r.queue.tasks[0].state, 'RUNNING');
  r = step(r.queue, { type: 'submit', actor: worker, taskId: 't1', sha: S1 }); assert.equal(r.queue.tasks[0].state, 'REVIEW'); assert.equal(r.queue.tasks[0].headSha, S1);
});
test('FAIL -> FIX -> REVIEW again with new sha -> PASS starts next', () => {
  let r = step(inReview(), rev()); assert.equal(r.action, 'FIX'); assert.equal(r.round, 1);
  r = step(r.queue, { type: 'submit', actor: worker, taskId: 't1', sha: S2 }); assert.equal(r.queue.tasks[0].state, 'REVIEW');
  r = step(r.queue, rev({ id: 2, sha: S2, verdict: 'PASS' })); assert.equal(r.action, 'START'); assert.equal(r.taskId, 't2');
});
test('PASS -> DONE and next READY starts', () => {
  const r = step(inReview(), rev({ verdict: 'PASS' }));
  assert.equal(r.queue.tasks[0].state, 'DONE'); assert.equal(r.queue.tasks[1].state, 'RUNNING');
});
test('PASS with no next task goes idle', () => {
  const q = mk('REVIEW'); q.tasks[0].headSha = S1;
  const r = step(q, rev({ verdict: 'PASS' })); assert.equal(r.action, 'IDLE'); assert.equal(r.reason, 'pass_no_more_tasks');
});
test('stale SHA ignored and not recorded', () => {
  const r = step(inReview(), rev({ sha: S2 })); assert.equal(r.reason, 'stale_sha'); assert.equal(r.queue.tasks[0].state, 'REVIEW'); assert.deepEqual(r.queue.seenEvents, []);
});
test('duplicate event ignored', () => {
  const r = step(inReview({ seenEvents: [1] }), rev()); assert.equal(r.reason, 'duplicate_event'); assert.equal(r.queue.tasks[0].state, 'REVIEW');
});
test('duplicate after processing does not double-advance', () => {
  const r1 = step(inReview(), rev()); const r2 = step(r1.queue, rev()); assert.equal(r2.reason, 'duplicate_event'); assert.equal(r2.queue.tasks[0].rounds, 1);
});
test('concurrent owner: start refused while a task is active', () => {
  for (const s of ['RUNNING', 'REVIEW', 'FIX']) { const r = step(mk(s, 'READY'), { type: 'start', actor: worker }); assert.equal(r.reason, 'concurrent_owner'); assert.equal(r.queue.tasks[1].state, 'READY'); }
});
test('round limit stops loop', () => {
  const q = inReview(); q.tasks[0].rounds = 5;
  const r = step(q, rev()); assert.equal(r.action, 'STOP'); assert.equal(r.reason, 'round_limit'); assert.equal(r.queue.halted, true);
  assert.equal(step(r.queue, { type: 'start', actor: worker }).reason, 'halted');
});
test('5th FAIL still fixes (cap 5)', () => {
  const q = inReview(); q.tasks[0].rounds = 4; assert.equal(step(q, rev()).action, 'FIX');
});
test('unauthorized event rejected', () => {
  for (const actor of [{ login: 'evil[bot]', type: 'Bot' }, { login: CODEX, type: 'User' }, { login: 'founder94', type: 'User' }, undefined]) {
    const r = step(inReview(), rev({ actor })); assert.equal(r.reason, 'unauthorized_actor'); assert.equal(r.queue.tasks[0].state, 'REVIEW');
  }
});
test('no task -> IDLE, nothing started', () => {
  assert.equal(step({ tasks: [], seenEvents: [] }, { type: 'start', actor: worker }).reason, 'no_task');
  assert.equal(step(mk('DONE'), { type: 'start', actor: worker }).action, 'IDLE');
});
test('BLOCKED stops everything, next READY not started', () => {
  const r = step(inReview(), rev({ verdict: 'BLOCKED' })); assert.equal(r.action, 'STOP'); assert.equal(r.queue.tasks[0].state, 'BLOCKED'); assert.equal(r.queue.tasks[1].state, 'READY');
  assert.equal(step(r.queue, { type: 'start', actor: worker }).action, 'IGNORE');
});
test('review for task not in REVIEW / unknown task / bad verdict ignored', () => {
  assert.equal(step(mk('RUNNING'), rev()).reason, 'bad_state');
  assert.equal(step(inReview(), rev({ taskId: 'zz' })).reason, 'unknown_task');
  assert.equal(step(inReview(), rev({ verdict: 'MAYBE' })).reason, 'bad_verdict');
});
test('submit rejects bad sha and wrong state; input queue never mutated', () => {
  const q = mk('RUNNING'); const snap = JSON.stringify(q);
  assert.equal(step(q, { type: 'submit', actor: worker, taskId: 't1', sha: 'xyz' }).reason, 'bad_sha');
  assert.equal(step(mk('READY'), { type: 'submit', actor: worker, taskId: 't1', sha: S1 }).reason, 'bad_state');
  step(q, { type: 'submit', actor: worker, taskId: 't1', sha: S1 }); assert.equal(JSON.stringify(q), snap);
});
test('invalid queue / unknown event fail closed', () => {
  assert.equal(step(null, { type: 'start', actor: worker }).action, 'STOP');
  assert.equal(step(mk('READY'), { type: 'x' }).reason, 'unknown_event');
});

// ---- review 5972966203 boundary repros ----
test('repro1: submit from unauthorized actor is refused', () => {
  const q = { tasks: [{ id: 't', state: 'RUNNING', owner: 'actions' }] };
  for (const actor of [{ login: 'outsider', type: 'User' }, { login: 'claude[bot]', type: 'User' }, { login: CODEX, type: 'Bot' }, undefined]) {
    const r = step(q, { type: 'submit', taskId: 't', sha: 'a'.repeat(40), actor });
    assert.equal(r.action, 'IGNORE'); assert.equal(r.reason, 'unauthorized_actor'); assert.equal(r.queue.tasks[0].state, 'RUNNING'); assert.equal(r.queue.tasks[0].headSha, undefined);
  }
  assert.equal(step(q, { type: 'submit', taskId: 't', sha: 'a'.repeat(40), actor: worker }).action, 'REVIEW');
});
test('repro1b: unauthorized submit cannot replace headSha of a task in REVIEW', () => {
  const q = mk('REVIEW'); q.tasks[0].headSha = S1;
  const r = step(q, { type: 'submit', taskId: 't1', sha: S2, actor: { login: 'outsider', type: 'User' } });
  assert.equal(r.reason, 'unauthorized_actor'); assert.equal(r.queue.tasks[0].headSha, S1);
});
test('repro1c: start from unauthorized actor is refused', () => {
  for (const actor of [{ login: 'outsider', type: 'User' }, undefined]) {
    const r = step(mk('READY'), { type: 'start', actor }); assert.equal(r.reason, 'unauthorized_actor'); assert.equal(r.queue.tasks[0].state, 'READY');
  }
});
test('repro2: non-finite / non-integer / over-approved maxRounds fail closed', () => {
  const q = inReview(); q.tasks[0].rounds = 1000;
  for (const maxRounds of [Infinity, NaN, -1, 0, 1.5, 6, 1000, '5', null, {}]) {
    const r = step(q, rev(), { maxRounds }); assert.equal(r.action, 'STOP'); assert.equal(r.reason, 'invalid_config'); assert.equal(r.queue.tasks[0].state, 'REVIEW');
  }
  assert.equal(step(q, rev(), { maxRounds: 5 }).reason, 'round_limit');
  assert.equal(step(q, rev(), 'x').reason, 'invalid_config');
});
