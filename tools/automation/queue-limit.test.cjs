const { test } = require('node:test');
const assert = require('node:assert/strict');
const { step, CODEX } = require('./queue-controller.cjs');
const S1 = 'a'.repeat(40), S2 = 'b'.repeat(40);
const bot = { login: CODEX, type: 'Bot' };
const worker = { login: 'claude[bot]', type: 'Bot' };
const mk = state => ({ seenEvents: [], tasks: [{ id: 't1', state, rounds: 0 }] });
const rev = (o = {}) => ({ type: 'review', id: 1, actor: bot, taskId: 't1', sha: S1, verdict: 'FAIL', ...o });

test('handoff cap: initial submit + 4 fixes = 5 handoffs; 5th FAIL stops, no 6th submit', () => {
  let r = step(mk('RUNNING'), { type: 'submit', id: 's0', actor: worker, taskId: 't1', sha: S1 });
  let q = r.queue; let handoffs = 1;
  for (let i = 1; i <= 5; i++) {
    r = step(q, rev({ id: 'r' + i, sha: q.tasks[0].headSha })); q = r.queue;
    if (i < 5) {
      assert.equal(r.action, 'FIX');
      r = step(q, { type: 'submit', id: 's' + i, actor: worker, taskId: 't1', sha: String(i).repeat(40) }); q = r.queue; handoffs++;
    }
  }
  assert.equal(handoffs, 5);
  assert.equal(r.action, 'STOP'); assert.equal(r.reason, 'round_limit'); assert.equal(q.halted, true);
});

test('submit refused at/over the cap even if state is FIX', () => {
  const q = mk('FIX'); q.tasks[0].rounds = 5;
  const r = step(q, { type: 'submit', actor: worker, taskId: 't1', sha: S2 });
  assert.equal(r.action, 'STOP'); assert.equal(r.reason, 'round_limit');
});

test('replayed submit id is ignored (no FIX->REVIEW with old sha)', () => {
  const ev = { type: 'submit', id: 'comment:9', actor: worker, taskId: 't1', sha: S1 };
  const r1 = step(mk('RUNNING'), ev);
  const back = { ...r1.queue, tasks: [{ ...r1.queue.tasks[0], state: 'FIX' }] };
  const r2 = step(back, ev);
  assert.equal(r2.reason, 'duplicate_event'); assert.equal(r2.queue.tasks[0].state, 'FIX');
});
