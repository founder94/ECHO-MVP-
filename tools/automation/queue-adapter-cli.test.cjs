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

test('repo mismatch is ignored', () => {
  const p = review(); p.repository.full_name = 'x/y';
  assert.strictEqual(run(['pull_request_review', ev(p), 'd1'], ENV, seed()).out.reason, 'repo_mismatch');
});
test('review commit not on PR head is ignored', () => {
  const p = review(); p.pull_request.head.sha = 'b'.repeat(40);
  assert.strictEqual(run(['pull_request_review', ev(p), 'd1'], ENV, seed()).out.reason, 'review_not_on_head');
});
test('valid Codex marker review is handled via CLI', () => {
  const r = run(['pull_request_review', ev(review()), 'd1'], ENV, seed());
  assert.strictEqual(r.code, 0); assert.strictEqual(r.out.action, 'IDLE');
});
test('standard Codex review without marker never passes', () => {
  const r = run(['pull_request_review', ev(review({ body: 'no findings' })), 'd1'], ENV, seed());
  assert.strictEqual(r.out.reason, 'no_verdict_marker');
});
test('BLOCKED exits 2; missing args / bad file exit 1', () => {
  const p = review({ body: `<!-- echo-review from=codex sha=${SHA} verdict=BLOCKED -->` });
  assert.strictEqual(run(['pull_request_review', ev(p), 'd1'], ENV, seed()).code, 2);
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
  const r = run(['pull_request_review', ev(review()), 'd1'], { ...ENV, QUEUE_STORE_DIR: b });
  assert.strictEqual(r.code, 0);
  const s = gitStore({ cwd: a }).load().state;
  assert.strictEqual(s.tasks[0].state, 'DONE'); assert.deepStrictEqual(s.deliveries, ['d1']);
});
