const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { run } = require('./queue-adapter-cli.cjs');
const { gitStore } = require('./queue-store-git.cjs');
const { memoryStore, CODEX } = require('./queue-adapter.cjs');

const SHA = 'a'.repeat(40);
const REPO = 'o/r';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'q-'));
const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
function repos() {
  const bare = tmp(); g(bare, 'init', '--bare', '-q');
  const mk = () => { const d = tmp(); g(d, 'init', '-q'); g(d, 'remote', 'add', 'origin', bare); return d; };
  return { a: mk(), b: mk() };
}
const ev = o => { const f = path.join(tmp(), 'e.json'); fs.writeFileSync(f, JSON.stringify(o)); return f; };
const review = (over = {}) => ({ action: 'submitted', repository: { full_name: REPO }, pull_request: { number: 7, head: { sha: SHA } },
  review: { id: 1, commit_id: SHA, body: `<!-- echo-review from=codex sha=${SHA} verdict=PASS -->\nok`, user: { login: CODEX, type: 'Bot' }, ...over } });
const seed = () => memoryStore({ tasks: [{ id: 't', ref: 'pr:7', state: 'REVIEW', headSha: SHA }] });
const ENV = { GITHUB_REPOSITORY: REPO };
const HEAD = () => SHA; // injected current-head lookup (mock; no network)
const comment = body => ({ action: 'created', repository: { full_name: REPO }, issue: { number: 7, pull_request: {} },
  comment: { id: 9, body, user: { login: CODEX, type: 'Bot' } } });
const marker = (sha = SHA) => `<!-- echo-review from=codex sha=${sha} verdict=PASS -->`;

test('repo mismatch is ignored', () => {
  const p = review(); p.repository.full_name = 'x/y';
  assert.strictEqual(run(['pull_request_review', ev(p), 'd1'], ENV, seed()).out.reason, 'repo_mismatch');
});
test('review commit not on PR head is ignored', () => {
  const p = review(); p.pull_request.head.sha = 'b'.repeat(40);
  assert.strictEqual(run(['pull_request_review', ev(p), 'd1'], ENV, seed()).out.reason, 'review_not_on_head');
});
test('valid Codex marker review is handled via CLI', () => {
  const r = run(['pull_request_review', ev(review()), 'd1'], ENV, seed(), HEAD);
  assert.strictEqual(r.code, 0); assert.strictEqual(r.out.action, 'IDLE');
});
test('standard Codex review without marker never passes', () => {
  const r = run(['pull_request_review', ev(review({ body: 'no findings' })), 'd1'], ENV, seed(), HEAD);
  assert.strictEqual(r.out.reason, 'no_verdict_marker');
});
test('BLOCKED exits 2; missing args / bad file exit 1', () => {
  const p = review({ body: `<!-- echo-review from=codex sha=${SHA} verdict=BLOCKED -->` });
  assert.strictEqual(run(['pull_request_review', ev(p), 'd1'], ENV, seed(), HEAD).code, 2);
  assert.strictEqual(run([], ENV).code, 1);
  assert.strictEqual(run(['x', '/nonexistent', 'd'], ENV).code, 1);
});
test('git store persists across runners and CAS rejects a stale writer', () => {
  const { a, b } = repos();
  const sa = gitStore({ cwd: a }), sb = gitStore({ cwd: b });
  assert.strictEqual(sa.load().rev, null);
  assert.ok(sa.save(null, { tasks: [{ id: 't' }], n: 1 }));
  const lb = sb.load(); assert.strictEqual(lb.state.n, 1);
  assert.ok(sa.save(sa.load().rev, { tasks: [], n: 2 }));
  assert.strictEqual(sb.save(lb.rev, { tasks: [], n: 3 }), false); // stale rev loses
  assert.strictEqual(sb.load().state.n, 2);
  assert.strictEqual(gitStore({ cwd: a }).save(null, { tasks: [] }), false); // create-when-exists loses
});
test('git store fails closed on unreachable remote', () => {
  const d = tmp(); g(d, 'init', '-q'); g(d, 'remote', 'add', 'origin', path.join(tmp(), 'missing'));
  assert.throws(() => gitStore({ cwd: d }).load());
});
test('end-to-end: CLI with git store handles a review and persists the log', () => {
  const { a, b } = repos();
  gitStore({ cwd: a }).save(null, { tasks: [{ id: 't', ref: 'pr:7', state: 'REVIEW', headSha: SHA }] });
  const r = run(['pull_request_review', ev(review()), 'd1'], { ...ENV, QUEUE_STORE_DIR: b }, undefined, HEAD);
  assert.strictEqual(r.code, 0);
  const s = gitStore({ cwd: a }).load().state;
  assert.strictEqual(s.tasks[0].state, 'DONE'); assert.deepStrictEqual(s.deliveries, ['d1']);
});

// --- A: dedicated non-protected branch, plain FF push (no force) ---
test('default ref is a non-protected working branch and push never uses force', () => {
  const src = fs.readFileSync(path.join(__dirname, 'queue-store-git.cjs'), 'utf8');
  assert.ok(src.includes("'refs/heads/echo-automation-state'"));
  assert.ok(!/force/i.test(src.replace(/\/\/.*$/gm, '')), 'no force/force-with-lease in code');
  const { a } = repos(); const bare = g(a, 'remote', 'get-url', 'origin');
  gitStore({ cwd: a }).save(null, { tasks: [] });
  assert.ok(g(bare, 'rev-parse', 'refs/heads/echo-automation-state')); // exists as a branch on the bare remote
  assert.throws(() => g(bare, 'rev-parse', '--verify', 'refs/echo/queue-state'));
});
test('each commit is a child of expected; history is linear and FF-only', () => {
  const { a, b } = repos(); const bare = g(a, 'remote', 'get-url', 'origin');
  const sa = gitStore({ cwd: a }), sb = gitStore({ cwd: b });
  assert.ok(sa.save(null, { tasks: [], n: 1 }));
  const r1 = sb.load().rev;
  assert.ok(sb.save(r1, { tasks: [], n: 2 }));
  const tip = g(bare, 'rev-parse', 'refs/heads/echo-automation-state');
  assert.strictEqual(g(bare, 'rev-parse', `${tip}^`), r1);
  assert.strictEqual(g(bare, 'rev-list', '--count', tip), '2');
});
test('two runners racing from the same rev: exactly one wins, tip is not overwritten', () => {
  const { a, b } = repos();
  const sa = gitStore({ cwd: a }), sb = gitStore({ cwd: b });
  sa.save(null, { tasks: [], n: 0 });
  const ra = sa.load().rev, rb = sb.load().rev;
  const wins = [sa.save(ra, { tasks: [], n: 'A' }), sb.save(rb, { tasks: [], n: 'B' })];
  assert.deepStrictEqual(wins, [true, false]);
  assert.strictEqual(sb.load().state.n, 'A');
  assert.strictEqual(sb.save(sb.load().rev, { tasks: [], n: 'B2' }), true); // survives: loser retries from new rev
});
test('create-when-exists is rejected and does not disturb existing state', () => {
  const { a, b } = repos();
  assert.ok(gitStore({ cwd: a }).save(null, { tasks: [], n: 1 }));
  assert.strictEqual(gitStore({ cwd: b }).save(null, { tasks: [], n: 'x' }), false);
  assert.strictEqual(gitStore({ cwd: b }).load().state.n, 1);
});
test('network error on save/load is closed (no silent success)', () => {
  const d = tmp(); g(d, 'init', '-q'); g(d, 'remote', 'add', 'origin', path.join(tmp(), 'missing'));
  const s = gitStore({ cwd: d });
  assert.strictEqual(s.save(null, { tasks: [] }), false);
  assert.throws(() => s.load());
});

// --- B: current-head verification (injected lookup) ---
const OLD = 'c'.repeat(40), NEW = 'd'.repeat(40);
const spyStore = () => { const s = seed(); const c = { saves: 0 }; return { c, store: { load: s.load, save: (...a) => { c.saves++; return s.save(...a); } } }; };
test('pull_request_review: snapshot head=old but current head=new is rejected, nothing saved', () => {
  const p = review({ commit_id: OLD, body: marker(OLD) }); p.pull_request.head.sha = OLD;
  const { c, store } = spyStore();
  const r = run(['pull_request_review', ev(p), 'd1'], ENV, store, () => NEW);
  assert.strictEqual(r.out.reason, 'stale_head'); assert.strictEqual(c.saves, 0);
});
test('issue_comment echo-review: marker sha != current head is rejected, nothing saved', () => {
  const { c, store } = spyStore();
  const r = run(['issue_comment', ev(comment(marker(OLD))), 'd1'], ENV, store, () => NEW);
  assert.strictEqual(r.out.reason, 'stale_head'); assert.strictEqual(c.saves, 0);
});
test('issue_comment echo-review on current head is handled; task headSha matches', () => {
  const { c, store } = spyStore();
  const r = run(['issue_comment', ev(comment(marker())), 'd1'], ENV, store, HEAD);
  assert.strictEqual(r.code, 0); assert.strictEqual(r.out.action, 'IDLE'); assert.strictEqual(c.saves, 1);
});
test('issue_comment review on a non-PR issue is rejected', () => {
  const p = comment(marker()); delete p.issue.pull_request;
  assert.strictEqual(run(['issue_comment', ev(p), 'd1'], ENV, seed(), HEAD).out.reason, 'not_a_pr');
});
test('lookup failure or malformed head: exit 1, no verdict/save/dispatch, no token in output', () => {
  const secret = 'ghs_SECRETTOKEN123';
  for (const bad of [() => { throw new Error(`boom ${secret}`); }, () => 'nothex', () => undefined]) {
    for (const [name, p] of [['pull_request_review', review()], ['issue_comment', comment(marker())]]) {
      const { c, store } = spyStore();
      const r = run([name, ev(p), 'd1'], { ...ENV, GH_TOKEN: secret }, store, bad);
      assert.strictEqual(r.code, 1); assert.deepStrictEqual(r.out, { error: 'head_lookup_failed' });
      assert.strictEqual(c.saves, 0); assert.ok(!JSON.stringify(r).includes(secret));
    }
  }
});
test('non-verdict comments need no lookup', () => {
  const r = run(['issue_comment', ev(comment('hello')), 'd1'], ENV, seed(), () => { throw new Error('should not be called'); });
  assert.strictEqual(r.out.reason, 'no_marker');
});
test('handoff comment is also bound to current head', () => {
  const h = sha => comment(`<!-- echo-handoff to=codex sha=${sha} round=1 -->`);
  const r = run(['issue_comment', ev(h(OLD)), 'd1'], ENV, seed(), () => NEW);
  assert.strictEqual(r.out.reason, 'stale_head');
});
test('ghHead fails with fixed message (no stderr leak) when gh unavailable', () => {
  const { ghHead } = require('./queue-adapter-cli.cjs');
  const old = process.env.PATH; process.env.PATH = '/nonexistent';
  try { assert.throws(() => ghHead(REPO, 7), { message: 'head_lookup_failed' }); } finally { process.env.PATH = old; }
});
