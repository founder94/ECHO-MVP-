// Registration (init) + leased bootstrap. Mock gh/git executors and local bare git only: no real GitHub, no remote branch creation.
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { gitStore } = require('./queue-store-git.cjs');
const { registerDecision, register, bootstrap, ghIo } = require('./queue-register.cjs');
const { budgetDecision } = require('./queue-budget.cjs');

const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
function pair() {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')); const bare = path.join(t, 'r.git'); g(t, 'init', '-q', '--bare', bare);
  const mk = n => { const d = path.join(t, n); fs.mkdirSync(d); g(d, 'init', '-q'); g(d, 'remote', 'add', 'origin', bare); return d; };
  return { a: gitStore({ cwd: mk('a') }), b: gitStore({ cwd: mk('b') }) };
}
const A = 'a'.repeat(40);
const REPO = 'founder94/ECHO-MVP-';
const req = (o = {}) => ({ taskId: 'T1', sourcePR: 200, baseSha: A, repository: REPO, branch: 'claude/task-1', acceptance: 'tests pass', ...o });
const ctx = (o = {}) => ({ eventName: 'workflow_dispatch', sender: { login: 'founder94', type: 'User' }, repository: REPO, pr: { number: 200, state: 'open', repository: REPO }, actualBaseSha: A, baseReachable: true, now: '2026-10-04T14:00:00Z', ...o });

test('registers only for the real founder94 User dispatch; actor/typed input/comment text cannot substitute', () => {
  assert.equal(registerDecision({}, req(), ctx()).ok, true);
  for (const sender of [{ login: 'github-actions[bot]', type: 'Bot' }, { login: 'founder94', type: 'Bot' }, { login: 'other', type: 'User' }, undefined])
    assert.equal(registerDecision({}, req(), ctx({ sender })).reason, 'start_not_by_owner');
  assert.equal(registerDecision({}, req(), ctx({ eventName: 'issue_comment' })).reason, 'not_dispatch');
  assert.equal(registerDecision({}, { ...req(), approval: { login: 'founder94', type: 'User' }, owner: { login: 'x', type: 'User' } }, ctx()).ok, true); // typed approval/owner fields are ignored, taken from sender
  const d = registerDecision({}, req(), ctx({ sender: { login: 'founder94', type: 'User' } })); assert.deepEqual(d.task.approval, { login: 'founder94', type: 'User' });
});

test('metadata verification: repo, PR, base SHA, branch, acceptance, task fields', () => {
  assert.equal(registerDecision({}, req({ repository: 'x/y' }), ctx()).reason, 'external_repo');
  assert.equal(registerDecision({}, req(), ctx({ pr: { number: 200, state: 'closed', repository: REPO } })).reason, 'pr_not_verified');
  assert.equal(registerDecision({}, req(), ctx({ pr: { number: 201, state: 'open', repository: REPO } })).reason, 'pr_not_verified');
  assert.equal(registerDecision({}, req(), ctx({ pr: undefined })).reason, 'pr_not_verified');
  assert.equal(registerDecision({}, req(), ctx({ actualBaseSha: 'b'.repeat(40) })).reason, 'base_not_verified');
  assert.equal(registerDecision({}, req(), ctx({ baseReachable: false })).reason, 'base_not_verified');
  assert.equal(registerDecision({}, req({ branch: 'main' }), ctx()).reason, 'bad_branch');
  assert.equal(registerDecision({}, req({ branch: 'claude/../x' }), ctx()).reason, 'bad_branch');
  assert.equal(registerDecision({}, req({ acceptance: ' ' }), ctx()).reason, 'no_acceptance');
  assert.equal(registerDecision({}, req({ sourcePR: 'x' }), ctx()).reason, 'bad_source_pr');
  assert.equal(registerDecision({}, req({ baseSha: 'zz' }), ctx()).reason, 'bad_base_sha');
  assert.equal(registerDecision({ legacyTasks: 'x' }, req(), ctx()).reason, 'invalid_state');
});

test('registered task is immutable: same id, same branch, blocked-PR reopen under a new id, live duplicate are all refused; counters never reset', () => {
  const d1 = registerDecision({}, req(), ctx()); assert.equal(d1.ok, true);
  const s = { legacyTasks: [{ ...d1.task, rounds: 3 }] };
  assert.equal(registerDecision(s, req(), ctx()).reason, 'duplicate_task_id');
  assert.equal(registerDecision(s, req({ taskId: 'T2' }), ctx()).reason, 'branch_in_use');
  assert.equal(registerDecision(s, req({ taskId: 'T2', branch: 'claude/task-2' }), ctx()).reason, 'live_task_exists');
  const blocked = { legacyTasks: [{ ...d1.task, rounds: 5, state: 'BLOCKED' }] };
  assert.equal(registerDecision(blocked, req({ taskId: 'T2', branch: 'claude/task-2' }), ctx()).reason, 'resume_policy_missing');
  assert.equal(budgetDecision({ registry: blocked.legacyTasks, pr: 200, comments: [] }).reason, 'task_blocked'); // budget gate agrees
  assert.equal(registerDecision({ legacyTasks: Array.from({ length: 20 }, (_, i) => ({ taskId: `x${i}`, sourcePR: i + 1000, branch: `claude/x${i}`, state: 'DONE' })) }, req(), ctx()).reason, 'registry_full');
  // a different approved PR/task is independent
  assert.equal(registerDecision(s, req({ taskId: 'T3', sourcePR: 201, branch: 'claude/task-3' }), ctx({ pr: { number: 201, state: 'open', repository: REPO } })).ok, true);
});

test('registered task feeds the budget gate: max 5, fresh task only after approved registration', () => {
  const t = registerDecision({}, req(), ctx()).task;
  const ok = budgetDecision({ registry: [t], pr: 200, comments: [], opts: {} });
  assert.equal(ok.allowed, true); assert.equal(ok.mode, 'task'); assert.equal(ok.limit, 5);
  assert.equal(budgetDecision({ registry: [{ ...t, rounds: 5 }], pr: 200, comments: [] }).allowed, false);
});

test('two runners register the same task / identical init: exactly one wins; loser sees nothing registered', () => {
  const { a, b } = pair();
  const stale = b.load(); const bStale = { load: () => stale, save: (e, s) => b.save(e, s) }; // both runners read the same rev first
  const r = [register(a, req(), ctx()), register(bStale, req(), ctx())];
  assert.deepEqual(r.map(x => x.ok), [true, false]); assert.equal(r[1].reason, 'cas_conflict');
  assert.equal(a.load().state.legacyTasks.length, 1);
  assert.equal(register(b, req(), ctx()).reason, 'duplicate_task_id'); // retry on the fresh rev: immutable
  assert.equal(a.load().state.legacyTasks[0].rounds, 0);
});

test('duplicate delivery of the same registration is rejected (no second entry, no reset)', () => {
  const { a } = pair(); assert.equal(register(a, req(), ctx()).ok, true);
  const rev = a.load(); const s = rev.state; s.legacyTasks[0].rounds = 2; a.save(rev.rev, s);
  assert.equal(register(a, req(), ctx()).reason, 'duplicate_task_id');
  assert.equal(a.load().state.legacyTasks[0].rounds, 2);
});

test('store failure fails closed (no registration)', () => {
  const store = { load: () => { throw new Error('tok_secret'); }, save: () => true };
  assert.throws(() => register(store, req(), ctx()));
});

function io(over = {}) {
  const calls = [];
  return { calls, measure: () => ({ repository: REPO, canPush: true, actualBaseSha: A, remote: { exists: false, head: null } }), run: argv => calls.push(argv), head: () => A, ...over };
}
function seeded() { const { a, b } = pair(); register(a, req(), ctx()); return { a, b }; }

test('bootstrap: leased, fixed argv plain push, final head re-check, receipt stored; second run is refused', () => {
  const { a, b } = seeded(); const i = io();
  const r = bootstrap(a, 'T1', i); assert.equal(r.ok, true); assert.equal(r.status, 'CREATE');
  assert.deepEqual(i.calls, [['git', 'push', 'origin', `${A}:refs/heads/claude/task-1`]]);
  assert.ok(!i.calls[0].some(x => /force|-f$|\+/.test(x)));
  const t = a.load().state.legacyTasks[0]; assert.equal(t.bootstrap.status, 'DONE'); assert.equal(t.bootstrap.receiptSha, A);
  assert.equal(bootstrap(b, 'T1', io()).reason, 'already_bootstrapped');
});

test('bootstrap: two runners race for the lease: exactly one executes', () => {
  const { a, b } = seeded(); const ia = io(), ib = io();
  // both load the same rev before either claims: simulate by claiming through a, then b with a stale load
  const stale = b.load(); const bStale = { load: () => stale, save: (e, s) => b.save(e, s) };
  const ra = bootstrap(a, 'T1', ia); const rb = bootstrap(bStale, 'T1', ib);
  assert.equal(ra.ok, true); assert.equal(rb.reason, 'cas_conflict'); assert.equal(ib.calls.length, 0); assert.equal(ia.calls.length, 1);
});

test('bootstrap: claimed-but-unfinished lease blocks re-execution', () => {
  const { a } = seeded(); const cur = a.load(); const s = cur.state; s.legacyTasks[0].bootstrap = { status: 'CLAIMED', claimId: 'x' }; a.save(cur.rev, s);
  const i = io(); assert.equal(bootstrap(a, 'T1', i).reason, 'bootstrap_in_progress'); assert.equal(i.calls.length, 0);
});

test('bootstrap failures are stored as FAILED, never DONE; no auto retry', () => {
  for (const [name, over, reason] of [
    ['no permission', { measure: () => ({ repository: REPO, canPush: false, actualBaseSha: A, remote: { exists: false } }) }, 'no_permission'],
    ['external repo', { measure: () => ({ repository: 'x/y', canPush: true, actualBaseSha: A, remote: { exists: false } }) }, 'external_repo'],
    ['base changed', { measure: () => ({ repository: REPO, canPush: true, actualBaseSha: 'b'.repeat(40), remote: { exists: false } }) }, 'base_changed'],
    ['branch exists', { measure: () => ({ repository: REPO, canPush: true, actualBaseSha: A, remote: { exists: true, head: A } }) }, 'branch_exists'],
    ['measure error', { measure: () => { throw new Error('tok_secret'); } }, 'measure_failed'],
    ['push error', { run: () => { throw new Error('tok_secret'); } }, 'exec_failed'],
    ['head changed after push', { head: () => 'c'.repeat(40) }, 'head_mismatch_after_push'],
  ]) {
    const { a } = seeded(); const r = bootstrap(a, 'T1', io(over));
    assert.equal(r.ok, false, name); assert.equal(r.reason, reason, name); assert.ok(!JSON.stringify(r).includes('tok_secret'), name);
    assert.equal(a.load().state.legacyTasks[0].bootstrap.status, 'FAILED', name);
    assert.equal(bootstrap(a, 'T1', io()).reason, 'bootstrap_failed_needs_human', name);
  }
  assert.equal(bootstrap(seeded().a, 'nope', io()).reason, 'unknown_task');
});

test('bootstrap refuses blocked task', () => {
  const { a } = seeded(); const cur = a.load(); const s = cur.state; s.legacyTasks[0].state = 'BLOCKED'; a.save(cur.rev, s);
  assert.equal(bootstrap(a, 'T1', io()).reason, 'task_blocked');
});

test('ghIo default executor uses fixed argv with mock exec (no real call)', () => {
  const calls = [];
  const exec = (c, args) => { calls.push([c, ...args]); return c === 'git' ? '' : args.includes('.permissions.push') ? 'true' : A; };
  const m = ghIo(REPO, process.cwd(), exec).measure({ branch: 'claude/task-1', baseSha: A });
  assert.deepEqual(m, { repository: REPO, canPush: true, actualBaseSha: A, remote: { exists: false, head: null } });
  assert.ok(calls.every(c => c[0] === 'git' || c[0] === 'gh'));
});

test('proposed register/bootstrap workflow: pinned source, owner-only dispatch, typed inputs, no new secret/scope, no live workflow file', () => {
  const y = fs.readFileSync(path.join(__dirname, 'proposed', 'queue-task-register.workflow.yml.txt'), 'utf8');
  assert.match(y, /workflow_dispatch:/); assert.match(y, /github\.actor == 'founder94'/); assert.match(y, /triggering_actor == 'founder94'/);
  assert.match(y, /ref: [a-f0-9]{40}/); assert.doesNotMatch(y, /ref: main/);
  assert.doesNotMatch(y, /secrets\.(?!GITHUB_TOKEN)/); assert.doesNotMatch(y, /--force|push -f/);
  assert.match(y, /queue-register\.cjs "\$MODE"/); assert.match(y, /register\|bootstrap/);
  assert.ok(!fs.existsSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'queue-task-register.yml')));
});
