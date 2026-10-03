// Mock-only checks for execution-connection prep: no real GitHub/gh/network calls (dispatch + lookups are injected).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { run } = require('./queue-adapter-cli.cjs');
const { gitStore } = require('./queue-store-git.cjs');
const { memoryStore, handle, CODEX } = require('./queue-adapter.cjs');
const { initQueue, drain, ghDispatcher, APPROVER } = require('./queue-exec.cjs');

const S1 = 'a'.repeat(40), S2 = 'b'.repeat(40), REPO = 'o/r', ENV = { GITHUB_REPOSITORY: REPO };
const OWNER = { login: 'founder94', type: 'User' };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qx-'));
const ev = o => { const f = path.join(tmp(), 'e.json'); fs.writeFileSync(f, JSON.stringify(o)); return f; };
const dispatchEv = (sender, tasks) => ({ repository: { full_name: REPO }, sender, inputs: { tasks: JSON.stringify(tasks) } });
const T = (id, n) => ({ id, ref: `pr:${n}`, owner: OWNER });
const fresh = () => { const s = memoryStore({ tasks: [] }); assert.strictEqual(run(['init', ev(dispatchEv(OWNER, [T('t1', 7), T('t2', 8)])), 'i'], ENV, s).out.action, 'INIT'); return s; };
const WORKER_EV = (sender = OWNER) => ({ repository: { full_name: REPO }, sender });
const ok = () => S1;

test('init: only the real owner User creates approved READY tasks; impersonation/bad input refused', () => {
  const bot = { login: 'founder94', type: 'Bot' }, other = { login: 'mallory', type: 'User' };
  for (const sender of [bot, other, undefined]) assert.strictEqual(run(['init', ev(dispatchEv(sender, [T('t', 7)])), 'i'], ENV, memoryStore({ tasks: [] })).out.error, 'init_not_by_owner');
  const bad = [[], [{ id: 't', ref: 'pr:7', owner: { login: 'mallory', type: 'User' } }], [T('t', 7), T('t', 8)], [T('t', 7), T('u', 7)], [{ id: 't', ref: 'bogus', owner: OWNER }], [{ id: '../x', ref: 'pr:7', owner: OWNER }]];
  for (const tasks of bad) assert.ok(run(['init', ev(dispatchEv(OWNER, tasks)), 'i'], ENV, memoryStore({ tasks: [] })).out.error);
  const r = initQueue({ tasks: [T('t', 7)] }, OWNER);
  assert.deepStrictEqual(r.state.tasks[0].approval, { by: APPROVER, owner: APPROVER, ref: 'pr:7' }); assert.strictEqual(r.state.tasks[0].state, 'READY');
});

test('init never overwrites an existing queue (git store create-when-exists)', () => {
  const bare = tmp(); execFileSync('git', ['init', '--bare', '-q'], { cwd: bare });
  const mk = () => { const d = tmp(); execFileSync('git', ['init', '-q'], { cwd: d }); execFileSync('git', ['remote', 'add', 'origin', bare], { cwd: d }); return d; };
  const a = mk(), b = mk(); const e = ev(dispatchEv(OWNER, [T('t1', 7)]));
  assert.strictEqual(run(['init', e, 'i1'], ENV, gitStore({ cwd: a })).out.action, 'INIT');
  assert.strictEqual(run(['init', e, 'i2'], ENV, gitStore({ cwd: b })).out.reason, 'already_initialized');
});

test('start: owner approval is separate from worker Bot identity; unapproved/impersonated start refused', () => {
  const s = fresh();
  assert.strictEqual(run(['workflow_dispatch', ev(WORKER_EV({ login: 'claude[bot]', type: 'Bot' })), 'd0'], ENV, s).out.reason, 'start_not_by_owner');
  assert.strictEqual(run(['workflow_dispatch', ev(WORKER_EV({ login: 'mallory', type: 'User' })), 'd0b'], ENV, s).out.reason, 'start_not_by_owner');
  const r = run(['workflow_dispatch', ev(WORKER_EV()), 'd1'], ENV, s);
  assert.strictEqual(r.out.action, 'START');
  const t = s.load().state.tasks[0]; assert.strictEqual(t.state, 'RUNNING'); assert.deepStrictEqual(t.worker, { login: 'github-actions[bot]', type: 'Bot' }); assert.deepStrictEqual(t.approval.owner, OWNER);
  assert.strictEqual(s.load().state.outbox[0].key, 'START:t1');
});

test('strict mode refuses a queue with an unapproved task (fail closed)', () => {
  const s = memoryStore({ tasks: [{ id: 't', ref: 'pr:7', state: 'READY' }] });
  assert.strictEqual(run(['workflow_dispatch', ev(WORKER_EV()), 'd1'], ENV, s).out.reason, 'unapproved_queue');
  assert.strictEqual(s.load().state.tasks[0].state, 'READY');
  const forged = memoryStore({ tasks: [{ id: 't', ref: 'pr:7', state: 'READY', approval: { by: { login: 'mallory', type: 'User' }, owner: OWNER, ref: 'pr:7' } }] });
  assert.strictEqual(run(['workflow_dispatch', ev(WORKER_EV()), 'd1'], ENV, forged).out.reason, 'unapproved_queue');
});

const handoff = (n, sha, id = 50) => ({ action: 'created', repository: { full_name: REPO }, issue: { number: n, pull_request: {} },
  comment: { id, body: `<!-- echo-handoff to=codex sha=${sha} round=1 -->\nx`, user: { login: 'claude[bot]', type: 'Bot' } } });
const native = (over = {}) => ({ action: 'submitted', repository: { full_name: REPO }, pull_request: { number: 7, head: { sha: S1 } },
  review: { id: 77, commit_id: S1, submitted_at: '2026-10-03T20:00:00Z', body: 'Codex Review', user: { login: CODEX, type: 'Bot' }, ...over } });
const toReview = s => { run(['workflow_dispatch', ev(WORKER_EV()), 'd1'], ENV, s); assert.strictEqual(run(['issue_comment', ev(handoff(7, S1)), 'd2'], ENV, s, ok).out.action, 'REVIEW'); };
const started = () => { const s = fresh(); run(['workflow_dispatch', ev(WORKER_EV()), 'd1'], ENV, s); return s; };
const finding = (over = {}) => ({ user: { login: CODEX, type: 'Bot' }, commit_id: S1, pull_request_review_id: 77, ...over });

test('native Codex: verified findings => FAIL/FIX; zero findings => BLOCKED, never PASS', () => {
  const s = fresh(); toReview(s);
  const r = run(['pull_request_review', ev(native()), 'd3'], ENV, s, ok, { getFindings: () => [finding()] });
  assert.strictEqual(r.out.action, 'FIX'); assert.strictEqual(s.load().state.tasks[0].state, 'FIX');
  const s2 = fresh(); toReview(s2);
  const r2 = run(['pull_request_review', ev(native({ body: 'Codex: no findings. Looks good!' })), 'd3'], ENV, s2, ok, { getFindings: () => [] });
  assert.strictEqual(r2.out.action, 'STOP'); assert.strictEqual(s2.load().state.tasks[0].state, 'BLOCKED'); assert.strictEqual(r2.code, 2);
});

test('native Codex: findings from others / other commit / other review do not count; lookup failure => nothing saved', () => {
  const s = fresh(); toReview(s);
  const noise = [finding({ user: OWNER }), finding({ commit_id: S2 }), finding({ pull_request_review_id: 1 })];
  assert.strictEqual(run(['pull_request_review', ev(native()), 'd3'], ENV, s, ok, { getFindings: () => noise }).out.action, 'STOP'); // 0 verified => BLOCKED, not FAIL
  const s2 = fresh(); toReview(s2); const before = JSON.stringify(s2.load().state);
  const r = run(['pull_request_review', ev(native()), 'd3'], ENV, s2, ok, { getFindings: () => { throw new Error('secret-token-xyz'); } });
  assert.strictEqual(r.code, 1); assert.strictEqual(r.out.error, 'findings_lookup_failed'); assert.ok(!JSON.stringify(r).includes('secret')); assert.strictEqual(JSON.stringify(s2.load().state), before);
});

test('native review by a human (founder) or stale head is never treated as Codex', () => {
  const s = fresh(); toReview(s);
  const r = run(['pull_request_review', ev(native({ user: OWNER })), 'd3'], ENV, s, ok, { getFindings: () => [finding()] });
  assert.strictEqual(r.out.reason, 'no_verdict_marker'); assert.strictEqual(s.load().state.tasks[0].state, 'REVIEW');
  assert.strictEqual(run(['pull_request_review', ev(native()), 'd4'], ENV, s, () => S2, { getFindings: () => [finding()] }).out.reason, 'stale_head');
  assert.strictEqual(run(['pull_request_review', ev(native({ submitted_at: null })), 'd5'], ENV, s, ok, { getFindings: () => [finding()] }).out.reason, 'native_not_trusted');
});

test('outbox: START/REVIEW/FIX recorded in the same commit; replay adds no second entry', () => {
  const s = fresh(); toReview(s);
  run(['pull_request_review', ev(native()), 'd3'], ENV, s, ok, { getFindings: () => [finding()] });
  assert.deepStrictEqual(s.load().state.outbox.map(e => e.key), ['START:t1', 'REVIEW:t1:' + S1, 'FIX:t1:1']);
  run(['pull_request_review', ev(native()), 'd9'], ENV, s, ok, { getFindings: () => [finding()] }); // same review id replayed under a new delivery id
  assert.strictEqual(s.load().state.outbox.length, 3);
});

test('drain: dispatches each key once through the injected executor; second drain does nothing', () => {
  const s = started(); const calls = [];
  assert.strictEqual(run(['drain'], ENV, s, ok, { dispatch: e => calls.push(e.key) }).code, 0);
  assert.strictEqual(run(['issue_comment', ev(handoff(7, S1)), 'd2'], ENV, s, ok).out.action, 'REVIEW');
  run(['drain'], ENV, s, ok, { dispatch: e => calls.push(e.key) });
  assert.deepStrictEqual(calls, ['START:t1', 'REVIEW:t1:' + S1]);
  run(['drain'], ENV, s, ok, { dispatch: e => calls.push(e.key) }); assert.strictEqual(calls.length, 2);
  assert.ok(s.load().state.outbox.every(e => e.status === 'DONE'));
});

test('drain: failure is FAILED not DONE, exit 3, retried later; stops after max attempts', () => {
  const s = started(); let n = 0;
  const r = run(['drain'], ENV, s, ok, { dispatch: () => { n++; throw new Error('boom'); } });
  assert.strictEqual(r.code, 3); assert.strictEqual(r.out.stopped, 'dispatch_failed'); assert.strictEqual(s.load().state.outbox[0].status, 'FAILED');
  for (let i = 0; i < 5; i++) run(['drain'], ENV, s, ok, { dispatch: () => { n++; throw new Error('boom'); } });
  assert.strictEqual(n, 3);
  const calls = []; run(['drain'], ENV, s, ok, { dispatch: e => calls.push(e) }); assert.strictEqual(calls.length, 0);
});

test('drain: crash after claim (DISPATCHING) is never auto-redispatched (uncertain boundary)', () => {
  const s = started(); const { rev, state } = s.load();
  state.outbox[0].status = 'DISPATCHING'; assert.ok(s.save(rev, state));
  const calls = []; const r = run(['drain'], ENV, s, ok, { dispatch: e => calls.push(e) });
  assert.strictEqual(calls.length, 0); assert.strictEqual(r.out.stopped, 'uncertain_dispatch'); assert.strictEqual(r.code, 3);
});

test('drain: two runners racing on one store dispatch an entry exactly once', () => {
  const s = started(); const calls = [];
  // runner B claims the same entry between runner A's load and claim: A loses the CAS and must not dispatch it
  const racing = { load: s.load, save(exp, st) { return s.save(exp, st); } };
  let first = true;
  const a = { load() { const l = s.load(); if (first) { first = false; drain(s, e => calls.push('B:' + e.key), { getHead: ok }); } return l; }, save: racing.save };
  drain(a, e => calls.push('A:' + e.key), { getHead: ok });
  assert.strictEqual(calls.filter(c => c.endsWith('START:t1')).length, 1);
});

test('drain: stale head or failed head lookup dispatches nothing', () => {
  const s = started(); const calls = [];
  run(['drain'], ENV, s, ok, { dispatch: e => calls.push(e.key) });
  run(['issue_comment', ev(handoff(7, S1)), 'd2'], ENV, s, ok);
  run(['pull_request_review', ev(native()), 'd3'], ENV, s, ok, { getFindings: () => [finding()] });
  assert.strictEqual(drain(s, e => calls.push(e.key), { getHead: () => { throw new Error('x'); } }).stopped, 'head_lookup_failed');
  assert.deepStrictEqual(calls, ['START:t1']); // only the entry without a sha ran; the sha-bound REVIEW waits
  const r = drain(s, e => calls.push(e.key), { getHead: () => S2 });
  assert.strictEqual(r.stopped, null); assert.deepStrictEqual(calls, ['START:t1']); // REVIEW/FIX bound to old head => STALE/OBSOLETE, not dispatched
  assert.ok(s.load().state.outbox.filter(e => e.action !== 'START').every(e => ['STALE', 'OBSOLETE'].includes(e.status)));
});

test('gh dispatcher: idempotent by key marker, needs approved trigger, never dispatches REVIEW by default (mock exec)', () => {
  const log = []; const mkExec = existing => (cmd, args) => { log.push(args.join(' ')); return args[0] === 'api' ? String(existing) : ''; };
  const entry = { key: 'FIX:t1:1', action: 'FIX', taskId: 't1', ref: 'pr:7', sha: S1 };
  assert.throws(() => ghDispatcher(ENV, mkExec(0))(entry), /no_trigger/);
  ghDispatcher({ ...ENV, QUEUE_WORKER_TRIGGER: 'TRIGGER-TEXT' }, mkExec(1))(entry); assert.ok(!log.some(l => l.startsWith('pr comment'))); // already posted
  ghDispatcher({ ...ENV, QUEUE_WORKER_TRIGGER: 'TRIGGER-TEXT' }, mkExec(0))(entry); assert.ok(log.some(l => l.startsWith('pr comment 7 --repo o/r') && l.includes('echo-dispatch key=FIX:t1:1')));
  const n = log.length; ghDispatcher(ENV, mkExec(0))({ ...entry, action: 'REVIEW' }); assert.strictEqual(log.length, n);
  assert.throws(() => ghDispatcher({ ...ENV, QUEUE_WORKER_TRIGGER: 'x' }, () => { throw new Error('token abc'); })(entry), /^Error: dispatch_failed$/);
});

test('5-handoff cap and single owner still hold in strict mode', () => {
  const s = fresh(); run(['workflow_dispatch', ev(WORKER_EV()), 'd1'], ENV, s);
  assert.strictEqual(run(['workflow_dispatch', ev(WORKER_EV()), 'd1b'], ENV, s).out.reason, 'concurrent_owner');
  assert.strictEqual(s.load().state.tasks[1].state, 'READY');
  let last;
  for (let i = 1; i <= 5; i++) {
    const head = String.fromCharCode(96 + i).repeat(40);
    assert.strictEqual(run(['issue_comment', ev(handoff(7, head, 100 + i)), 'h' + i], ENV, s, () => head).out.action, 'REVIEW', `submit ${i}`);
    const rv = { action: 'submitted', repository: { full_name: REPO }, pull_request: { number: 7, head: { sha: head } }, review: { id: 200 + i, commit_id: head, submitted_at: 'x', body: `<!-- echo-review from=codex sha=${head} verdict=FAIL -->`, user: { login: CODEX, type: 'Bot' } } };
    last = run(['pull_request_review', ev(rv), 'r' + i], ENV, s, () => head);
  }
  assert.strictEqual(last.out.reason, 'round_limit'); assert.strictEqual(last.code, 2);
});
