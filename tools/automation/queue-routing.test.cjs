// Mock/local checks: reviewer-principal opt-in policy (default OFF) and legacy claude.yml owner-routing (proposed patch + queue-managed script).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { step } = require('./queue-controller.cjs');
const { normalize } = require('./queue-adapter.cjs');
const { isQueueManaged, route } = require('./queue-managed.cjs');

const SHA = 'a'.repeat(40);
const q = () => ({ tasks: [{ id: 't1', ref: 'pr:5', state: 'REVIEW', headSha: SHA, rounds: 0 }, { id: 't2', ref: 'pr:6', state: 'READY' }] });
const ev = (actor, verdict) => ({ type: 'review', id: 'comment:1', actor, taskId: 't1', sha: SHA, verdict });
const USER = { login: 'founder94', type: 'User' };
const ON = { reviewerPrincipal: USER };

test('reviewer principal is OFF by default: a real User verdict is refused', () => {
  for (const v of ['PASS', 'FAIL', 'BLOCKED']) assert.equal(step(q(), ev(USER, v)).reason, 'unauthorized_actor');
});

test('principal ON: FAIL/BLOCKED accepted, PASS never completes (BLOCKED, no next task started); other users/Bots refused', () => {
  assert.equal(step(q(), ev(USER, 'FAIL'), ON).action, 'FIX');
  assert.equal(step(q(), ev(USER, 'BLOCKED'), ON).reason, 'blocked');
  const p = step(q(), ev(USER, 'PASS'), ON);
  assert.equal(p.action, 'STOP'); assert.equal(p.reason, 'reviewer_pass_unproven');
  assert.equal(p.queue.tasks[0].state, 'BLOCKED'); assert.equal(p.queue.tasks[1].state, 'READY');
  assert.equal(step(q(), ev({ login: 'someone', type: 'User' }, 'FAIL'), ON).reason, 'unauthorized_actor');
  assert.equal(step(q(), ev({ login: 'founder94', type: 'Bot' }, 'FAIL'), ON).reason, 'unauthorized_actor');
  assert.equal(step(q(), ev(USER, 'FAIL'), { reviewerPrincipal: { login: 'founder94', type: 'Bot' } }).reason, 'unauthorized_actor');
});

test('principal path keeps exact SHA, replay and 5-round rules; actor is the real User (not rewritten to the Codex Bot)', () => {
  assert.equal(step(q(), { ...ev(USER, 'FAIL'), sha: 'b'.repeat(40) }, ON).reason, 'stale_sha');
  const r = step(q(), ev(USER, 'FAIL'), ON);
  assert.equal(step({ ...r.queue, tasks: r.queue.tasks.map(t => ({ ...t, state: 'REVIEW' })) }, ev(USER, 'FAIL'), ON).reason, 'duplicate_event');
  const last = q(); last.tasks[0].rounds = 4;
  assert.equal(step(last, ev(USER, 'FAIL'), ON).reason, 'round_limit');
  const n = normalize('issue_comment', { action: 'created', issue: { number: 5, pull_request: {} }, comment: { id: 1, user: USER, body: `<!-- echo-review from=codex sha=${SHA} verdict=FAIL -->\nx` } }, q());
  assert.deepEqual(n.actor, USER); // from=codex text does not change the author
});

test('claude-legacy-queue-routing patch applies to the current claude.yml and gates the legacy preflight', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'route-'));
  const yml = path.join(dir, '.github/workflows/claude.yml');
  fs.mkdirSync(path.dirname(yml), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../../.github/workflows/claude.yml'), yml);
  const patch = path.join(__dirname, 'proposed/claude-legacy-queue-routing.patch.txt');
  execFileSync('git', ['apply', '--check', patch], { cwd: dir });
  execFileSync('git', ['apply', patch], { cwd: dir });
  const out = fs.readFileSync(yml, 'utf8');
  assert.ok(out.indexOf('id: route') < out.indexOf('id: preflight'));
  assert.match(out, /id: preflight\n\s+if: steps\.route\.outputs\.managed != 'true'/);
  assert.match(out, /queue-managed\.cjs "\$IS_PR" "\$NUM"/);
  const removed = fs.readFileSync(patch, 'utf8').split('\n').filter(l => /^-(?!--)/.test(l));
  assert.deepEqual(removed, []); // purely additive: no legacy line is removed
});

test('routing: queue task PRs/issues are managed (legacy refused); other PRs and a missing queue keep legacy; lookup failure fails closed', () => {
  const st = { tasks: [{ ref: 'pr:5' }, { ref: 'issue:9' }] };
  assert.equal(isQueueManaged(st, 'pr:5'), true);
  assert.equal(isQueueManaged(st, 'pr:9'), false); // pr and issue numbers are distinct refs
  assert.equal(isQueueManaged(st, 'issue:9'), true);
  const mk = load => ({ load });
  assert.deepEqual(route(mk(() => ({ rev: 'x', state: st })), true, 5), { managed: true, code: 0, reason: 'checked' });
  assert.equal(route(mk(() => ({ rev: 'x', state: st })), true, 77).managed, false); // legacy product/session PR path unchanged
  assert.equal(route(mk(() => ({ rev: null, state: { tasks: [] } })), true, 5).managed, false);
  const f = route(mk(() => { throw new Error('boom token=abc'); }), true, 5);
  assert.equal(f.managed, true); assert.equal(f.code, 1); assert.ok(!JSON.stringify(f).includes('token'));
  assert.equal(route(mk(() => ({ rev: 'x', state: st })), true, NaN).managed, true);
});
