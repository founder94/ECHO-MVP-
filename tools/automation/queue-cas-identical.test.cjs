// Regression: identical-content CAS saves from two clones (same parent/tree/message/time) must not both succeed.
const test = require('node:test'); const assert = require('node:assert'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { gitStore } = require('./queue-store-git.cjs'); const { ghWorkflowDispatcher } = require('./queue-exec.cjs');
const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
function pair() {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'cas-')); const bare = path.join(t, 'r.git'); g(t, 'init', '-q', '--bare', bare);
  const mk = n => { const d = path.join(t, n); fs.mkdirSync(d); g(d, 'init', '-q'); g(d, 'remote', 'add', 'origin', bare); return d; };
  return { a: gitStore({ cwd: mk('a') }), b: gitStore({ cwd: mk('b') }) };
}
const KEYS = ['GIT_AUTHOR_DATE', 'GIT_COMMITTER_DATE'];
const withDates = fn => {
  const o = KEYS.map(k => process.env[k]); KEYS.forEach(k => { process.env[k] = '2026-10-03T20:00:00Z'; });
  try { return fn(); } finally { KEYS.forEach((k, i) => { if (o[i] === undefined) delete process.env[k]; else process.env[k] = o[i]; }); }
};
test('identical next state on same parent: exactly one wins', () => withDates(() => {
  const { a, b } = pair(); assert.strictEqual(a.save(null, { tasks: [], n: 0 }), true);
  const ra = a.load().rev, rb = b.load().rev; const next = { tasks: [], deliveries: ['same-event'], n: 1 };
  assert.deepStrictEqual([a.save(ra, next), b.save(rb, next)], [true, false]);
}));
test('identical init race (expected=null): exactly one wins', () => withDates(() => {
  const { a, b } = pair(); const init = { tasks: [{ id: 't' }] };
  assert.deepStrictEqual([a.save(null, init), b.save(null, init)], [true, false]);
}));
test('identical outbox claim race: exactly one claimer', () => withDates(() => {
  const { a, b } = pair(); a.save(null, { tasks: [], outbox: [{ key: 'k', status: 'PENDING' }] });
  const ra = a.load().rev, rb = b.load().rev; const claimed = { tasks: [], outbox: [{ key: 'k', status: 'DISPATCHING', attempts: 1 }] };
  assert.deepStrictEqual([a.save(ra, claimed), b.save(rb, claimed)], [true, false]);
}));
test('workflow dispatcher: typed inputs only, mock exec, no free text', () => {
  const calls = []; const env = { GITHUB_REPOSITORY: 'o/r', QUEUE_WORKER_WORKFLOW: 'queue-worker.yml' };
  const d = ghWorkflowDispatcher(env, (c, args) => calls.push([c, args]));
  d({ action: 'START', key: 'k1', taskId: 't1', ref: 'pr:7' });
  assert.strictEqual(calls.length, 1); assert.deepStrictEqual(calls[0][1].slice(0, 3), ['workflow', 'run', 'queue-worker.yml']);
  d({ action: 'REVIEW', key: 'k2', taskId: 't1', ref: 'pr:7' }); assert.strictEqual(calls.length, 1);
  assert.throws(() => d({ action: 'FIX', key: 'k3', taskId: 't1; rm', ref: 'pr:7' }), /bad_entry/);
  const e = { action: 'START', key: 'k', taskId: 't', ref: 'pr:7' };
  assert.throws(() => ghWorkflowDispatcher({ GITHUB_REPOSITORY: 'o/r' }, () => {})(e), /no_worker_workflow/);
  assert.throws(() => ghWorkflowDispatcher(env, () => { throw new Error('tok_secret'); })(e), /^Error: dispatch_failed$/);
});
